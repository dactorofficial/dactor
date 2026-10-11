package com.dactor.patient.service

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.dactor.patient.R
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.model.Appointment
import com.dactor.patient.data.model.DactorNotification
import com.dactor.patient.data.model.NotificationTemplateData
import com.dactor.patient.data.model.QueueEntry
import com.dactor.patient.di.AppModule
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.*
import java.time.LocalDate

class NotificationWatchdogService : Service() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)
    private var isPollingStarted = false

    companion object {
        private const val WATCHDOG_CHANNEL_ID = "dactor_background_sync"
        private const val WATCHDOG_NOTIF_ID = 99101
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        promoteToForegroundSafely()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        promoteToForegroundSafely()
        if (!isPollingStarted) {
            isPollingStarted = true
            startPolling()
        }
        return START_STICKY
    }

    private fun promoteToForegroundSafely() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                val channel = NotificationChannel(
                    WATCHDOG_CHANNEL_ID,
                    "Dactor Live Queue & Appointment Monitor",
                    NotificationManager.IMPORTANCE_MIN
                ).apply {
                    description = "Keeps live OPD queue and appointment alerts active when the app is closed."
                    setShowBadge(false)
                }
                nm.createNotificationChannel(channel)
            }
            val notification = NotificationCompat.Builder(this, WATCHDOG_CHANNEL_ID)
                .setSmallIcon(R.drawable.app_logo)
                .setContentTitle("Dactor Live Queue Monitor")
                .setContentText("Monitoring your appointment & clinic alerts in real time")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setOngoing(true)
                .setSilent(true)
                .build()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    WATCHDOG_NOTIF_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(WATCHDOG_NOTIF_ID, notification)
            }
        } catch (ignored: Exception) {}
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        try {
            val restartIntent = Intent(applicationContext, NotificationWatchdogService::class.java)
            val pendingIntent = PendingIntent.getService(
                applicationContext,
                1,
                restartIntent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.set(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + 2000L,
                pendingIntent
            )
        } catch (ignored: Exception) {}
    }

    private fun startPolling() {
        serviceScope.launch {
            val sessionManager = UserSessionManager(applicationContext)
            val client = AppModule.provideSupabaseClient()

            while (isActive) {
                try {
                    val userId = sessionManager.getSavedPatientId()
                    val savedEmail = sessionManager.getSavedEmail()?.trim()?.lowercase()
                    val savedPhone = sessionManager.getSavedPhone()?.filter { it.isDigit() }?.takeLast(10)
                    val savedCodes = sessionManager.getSavedTrackingCodes().map { it.first.trim() }.filter { it.isNotBlank() }
                    val resolvedIds = savedCodes.toMutableSet()
                    val myAppointments = mutableListOf<Appointment>()

                    try {
                        val allAppts = client.postgrest["appointments"]
                            .select()
                            .decodeList<Appointment>()
                        for (appt in allAppts) {
                            val matchesUser = !userId.isNullOrBlank() && appt.userId == userId
                            val matchesEmail = !savedEmail.isNullOrBlank() && appt.patientEmail?.trim()?.lowercase() == savedEmail
                            val apptPhone = appt.patientMobile.filter { it.isDigit() }.takeLast(10)
                            val matchesPhone = !savedPhone.isNullOrBlank() && savedPhone.length == 10 && apptPhone == savedPhone
                            val matchesCode = appt.id in resolvedIds || appt.trackingCode10Digit in resolvedIds
                            if (matchesUser || matchesEmail || matchesPhone || matchesCode) {
                                myAppointments.add(appt)
                                if (appt.id.isNotBlank()) resolvedIds.add(appt.id)
                                if (appt.trackingCode10Digit.isNotBlank()) resolvedIds.add(appt.trackingCode10Digit)
                            }
                        }
                    } catch (_: Exception) {}

                    // 1. Check Automatic Appointment, Live Queue & Lab Status Alerts (Works when app is closed)
                    val todayStr = LocalDate.now().toString()
                    val todayActiveAppts = myAppointments.filter { it.appointmentDate == todayStr }
                    if (todayActiveAppts.isNotEmpty()) {
                        val queueEntries = try {
                            client.postgrest["live_queue"]
                                .select()
                                .decodeList<QueueEntry>()
                        } catch (_: Exception) { emptyList() }

                        for (appt in todayActiveAppts) {
                            val code = appt.trackingCode10Digit.ifBlank { appt.id.take(10) }
                            val slotTime = appt.appointmentTime.take(5).ifBlank { "Today" }
                            val qEntry = queueEntries.firstOrNull { it.appointmentId == appt.id }
                            val qPos = qEntry?.queuePosition ?: 1
                            val estWait = if (qPos <= 1) "Next in Line" else "~${(qPos - 1) * 10} mins"

                            // (a) Automatic Appointment Confirmed / Today Reminder Alert
                            val autoApptKey = "auto_appt_today_${appt.id}"
                            if (appt.checkinStatus in listOf("waiting", "checked_in") && !sessionManager.isNotificationSeen(autoApptKey)) {
                                sessionManager.markNotificationSeen(autoApptKey)
                                val msg = NotificationTemplateData.buildMessageWithMeta(
                                    cleanMessage = "Hi ${appt.patientName}, your appointment (#$code) is scheduled for today at $slotTime. Track your live queue turn anytime.",
                                    leftLabel = "Estimated Wait",
                                    leftValue = estWait,
                                    rightLabel = "Appointment Time",
                                    rightValue = slotTime,
                                    trackingCode = code
                                )
                                NotificationHelper.showSystemNotification(
                                    context = applicationContext,
                                    id = (autoApptKey.hashCode() and 0x7FFFFFFF) % 100000,
                                    title = "Appointment Reminder • #$code",
                                    message = msg,
                                    appointmentId = code,
                                    type = "queue_alert"
                                )
                            }

                            // (b) Automatic Live Queue Turn Approaching (Position 1 or 2)
                            if (qEntry != null && qEntry.status == "waiting" && qEntry.queuePosition in 1..2) {
                                val autoPosKey = "auto_qpos_${appt.id}_${qEntry.queuePosition}"
                                if (!sessionManager.isNotificationSeen(autoPosKey)) {
                                    sessionManager.markNotificationSeen(autoPosKey)
                                    val waitLabel = if (qEntry.queuePosition == 1) "Up Next (~5 mins)" else "~10-15 mins"
                                    val msg = NotificationTemplateData.buildMessageWithMeta(
                                        cleanMessage = "Hi ${appt.patientName}, you are now #${qEntry.queuePosition} in the live queue (#$code). Please be ready near the consultation room.",
                                        leftLabel = "Estimated Time Left",
                                        leftValue = waitLabel,
                                        rightLabel = "Queue Position",
                                        rightValue = "#${qEntry.queuePosition} (Queue Position #${qEntry.queuePosition})",
                                        trackingCode = code
                                    )
                                    NotificationHelper.showSystemNotification(
                                        context = applicationContext,
                                        id = (autoPosKey.hashCode() and 0x7FFFFFFF) % 100000,
                                        title = "Your Turn Is Approaching (#${qEntry.queuePosition})",
                                        message = msg,
                                        appointmentId = code,
                                        type = "queue_alert"
                                    )
                                }
                            }

                            // (c) Automatic Doctor Calling Inside Alert
                            if (qEntry?.status == "inside" || appt.checkinStatus == "inside") {
                                val autoInsideKey = "auto_inside_${appt.id}"
                                if (!sessionManager.isNotificationSeen(autoInsideKey)) {
                                    sessionManager.markNotificationSeen(autoInsideKey)
                                    val msg = NotificationTemplateData.buildMessageWithMeta(
                                        cleanMessage = "Hi ${appt.patientName}, the doctor is calling you inside now for appointment #$code. Please proceed to the room immediately.",
                                        leftLabel = "Estimated Time Left",
                                        leftValue = "Now (0 mins)",
                                        rightLabel = "Your Token",
                                        rightValue = "Token #${qEntry?.queuePosition ?: 1}",
                                        trackingCode = code
                                    )
                                    NotificationHelper.showSystemNotification(
                                        context = applicationContext,
                                        id = (autoInsideKey.hashCode() and 0x7FFFFFFF) % 100000,
                                        title = "Doctor Calling You Inside Now!",
                                        message = msg,
                                        appointmentId = code,
                                        type = "queue_alert"
                                    )
                                }
                            }

                            // (d) Automatic Lab Sample Collected / Report Prepared Alerts
                            if (appt.checkinStatus == "processing") {
                                val autoProcKey = "auto_lab_proc_${appt.id}"
                                if (!sessionManager.isNotificationSeen(autoProcKey)) {
                                    sessionManager.markNotificationSeen(autoProcKey)
                                    val msg = NotificationTemplateData.buildMessageWithMeta(
                                        cleanMessage = "Hi ${appt.patientName}, your lab sample for #$code has been collected and is now processing in the laboratory.",
                                        leftLabel = "Lab Status",
                                        leftValue = "Processing",
                                        rightLabel = "Tracking Code",
                                        rightValue = "#$code",
                                        trackingCode = code
                                    )
                                    NotificationHelper.showSystemNotification(
                                        context = applicationContext,
                                        id = (autoProcKey.hashCode() and 0x7FFFFFFF) % 100000,
                                        title = "Sample Collected • Processing Started",
                                        message = msg,
                                        appointmentId = code,
                                        type = "lab_report"
                                    )
                                }
                            } else if (appt.checkinStatus == "prepared") {
                                val autoPrepKey = "auto_lab_prep_${appt.id}"
                                if (!sessionManager.isNotificationSeen(autoPrepKey)) {
                                    sessionManager.markNotificationSeen(autoPrepKey)
                                    val msg = NotificationTemplateData.buildMessageWithMeta(
                                        cleanMessage = "Hi ${appt.patientName}, your diagnostic lab report for #$code is prepared and ready to view or download.",
                                        leftLabel = "Report Status",
                                        leftValue = "Prepared & Ready",
                                        rightLabel = "Verification",
                                        rightValue = "Name / Mobile",
                                        trackingCode = code
                                    )
                                    NotificationHelper.showSystemNotification(
                                        context = applicationContext,
                                        id = (autoPrepKey.hashCode() and 0x7FFFFFFF) % 100000,
                                        title = "Lab Report Prepared (#$code)",
                                        message = msg,
                                        appointmentId = code,
                                        type = "lab_report"
                                    )
                                }
                            }
                        }
                    }

                    // 2. Check Clinic-Side Notifications & Broadcasts in `notifications` table
                    val list = client.postgrest["notifications"]
                        .select()
                        .decodeList<DactorNotification>()
                        .sortedByDescending { it.createdAt }

                    val relevant = list.filter { notif ->
                        val audience = notif.targetAudience?.lowercase()
                        val isTargetedType = notif.type in listOf("manual_alert", "queue_alert", "lab_report", "clinic_break")
                        val isBroadcast = (audience == "all_users" || audience == "patients" || audience == null || notif.type == "broadcast") &&
                            !isTargetedType
                        val isUserSpecific = (!userId.isNullOrBlank() && notif.userId == userId)
                        val metaCode = notif.toTemplateData().trackingCode
                        val matchesSavedCode = resolvedIds.isNotEmpty() && (
                            (notif.appointmentId != null && (resolvedIds.contains(notif.appointmentId) || resolvedIds.any { code -> notif.appointmentId.contains(code) })) ||
                            (!metaCode.isNullOrBlank() && resolvedIds.contains(metaCode)) ||
                            resolvedIds.any { code -> code.length >= 8 && (notif.message.contains(code) || notif.title.contains(code)) }
                        )
                        val isAppointmentSpecific = matchesSavedCode
                        val isTargetedAlert = isTargetedType && (isUserSpecific || isAppointmentSpecific)

                        isBroadcast || isUserSpecific || isAppointmentSpecific || isTargetedAlert
                    }

                    for (notif in relevant) {
                        if (!sessionManager.isNotificationSeen(notif.id)) {
                            sessionManager.markNotificationSeen(notif.id)
                            val notifId = (notif.id.hashCode() and 0x7FFFFFFF) % 100000
                            NotificationHelper.showSystemNotification(
                                context = applicationContext,
                                id = notifId,
                                title = notif.title,
                                message = notif.message,
                                appointmentId = notif.appointmentId,
                                type = notif.type
                            )
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(5000L) // Poll every 5 seconds for real-time delivery even when app is closed
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
    }
}

