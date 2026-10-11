package com.dactor.patient.service

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.model.Appointment
import com.dactor.patient.data.model.DactorNotification
import com.dactor.patient.data.model.NotificationTemplateData
import com.dactor.patient.data.model.QueueEntry
import com.dactor.patient.di.AppModule
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate

class NotificationSyncWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            // Clean up any lingering watchdog notification
            try {
                val nm = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
                nm?.cancel(99101)
            } catch (_: Exception) {}

            val sessionManager = UserSessionManager(context)
            val client = AppModule.provideSupabaseClient()
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

            // Automatic today appointment & queue alerts
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
                            context = context,
                            id = (autoApptKey.hashCode() and 0x7FFFFFFF) % 100000,
                            title = "Appointment Reminder • #$code",
                            message = msg,
                            appointmentId = code,
                            type = "queue_alert"
                        )
                    }
                }
            }

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
                        context = context,
                        id = notifId,
                        title = notif.title,
                        message = notif.message,
                        appointmentId = notif.appointmentId,
                        type = notif.type
                    )
                }
            }

            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}

