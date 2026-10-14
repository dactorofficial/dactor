package com.dactor.patient

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.lifecycle.lifecycleScope
import com.dactor.patient.data.local.RegistrationDraftManager
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.repository.*
import com.dactor.patient.service.NotificationHelper
import com.dactor.patient.ui.navigation.DactorNavHost
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var authRepository: AuthRepository
    @Inject lateinit var clinicRepository: ClinicRepository
    @Inject lateinit var doctorRepository: DoctorRepository
    @Inject lateinit var appointmentRepository: AppointmentRepository
    @Inject lateinit var queueRepository: QueueRepository
    @Inject lateinit var slotRepository: SlotRepository
    @Inject lateinit var labReportRepository: LabReportRepository
    @Inject lateinit var notificationRepository: NotificationRepository
    @Inject lateinit var draftManager: RegistrationDraftManager
    @Inject lateinit var sessionManager: UserSessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)

        // 1. Initialize Notification Channel for urgent doctor alerts
        NotificationHelper.createNotificationChannel(this)

        // 2. Request Android 13+ Notification Permission if required
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        // 3. Register Firebase Cloud Messaging and subscribe to topics
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    sessionManager.saveFcmToken(token)
                }
            }
            FirebaseMessaging.getInstance().subscribeToTopic("all_users")
            FirebaseMessaging.getInstance().subscribeToTopic("patients")
            FirebaseMessaging.getInstance().subscribeToTopic("patient_alerts")
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 4. Dismiss any lingering watchdog notifications
        try {
            val nm = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
            nm?.cancel(99101)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                nm?.deleteNotificationChannel("dactor_background_sync")
            }
        } catch (ignored: Exception) {}

        lifecycleScope.launch(Dispatchers.IO) {
            var isFirstPoll = true
            while (isActive) {
                try {
                    val userId = authRepository.getCurrentUser() ?: sessionManager.getSavedPatientId()
                    val email = sessionManager.getSavedEmail()?.takeIf { it.isNotBlank() }
                        ?: authRepository.getCurrentUserEmail()?.takeIf { it.isNotBlank() }
                    val phone = sessionManager.getSavedPhone()?.takeIf { it.isNotBlank() }
                    val savedCodes = sessionManager.getSavedTrackingCodes().map { it.first }
                    val allIds = savedCodes.toMutableSet()

                    var patientAppointments = emptyList<com.dactor.patient.data.model.Appointment>()
                    try {
                        patientAppointments = appointmentRepository.getAllPatientAppointments(
                            userId = userId,
                            email = email,
                            phone = phone,
                            trackingCodes = savedCodes
                        )
                        for (appt in patientAppointments) {
                            if (appt.id.isNotBlank()) allIds.add(appt.id)
                            if (appt.trackingCode10Digit.isNotBlank()) allIds.add(appt.trackingCode10Digit)
                        }
                    } catch (_: Exception) {}

                    val notifs = notificationRepository.getNotifications(
                        userId = userId,
                        appointmentIds = allIds.toList()
                    )

                    if (isFirstPoll) {
                        // Mark existing historical notifications as seen so they don't spam the user on app launch
                        for (notif in notifs) {
                            sessionManager.markNotificationSeen(notif.id)
                        }
                        isFirstPoll = false
                    } else {
                        // Only notify for truly new incoming notifications
                        for (notif in notifs) {
                            if (!sessionManager.isNotificationSeen(notif.id)) {
                                sessionManager.markNotificationSeen(notif.id)

                                // Check whether the notification targets a completed/finished appointment
                                val matchedAppt = patientAppointments.find { appt ->
                                    (notif.appointmentId != null && (appt.id == notif.appointmentId || appt.trackingCode10Digit == notif.appointmentId)) ||
                                    (notif.toTemplateData().trackingCode?.isNotBlank() == true && (appt.id == notif.toTemplateData().trackingCode || appt.trackingCode10Digit == notif.toTemplateData().trackingCode))
                                }
                                val isMatchedFinished = matchedAppt != null && matchedAppt.checkinStatus.lowercase() in listOf("done", "completed", "cancelled", "finished")

                                // Lab reports and invoices/bills can still be delivered even if appointment is completed
                                val isReportOrBill = notif.type in listOf("lab_report", "report_prepared", "billing_invoice", "payment_receipt") ||
                                    notif.title.contains("report", ignoreCase = true) ||
                                    notif.title.contains("bill", ignoreCase = true) ||
                                    notif.title.contains("receipt", ignoreCase = true)

                                // If the appointment is already finished and this is not a report/bill, suppress it!
                                if (isMatchedFinished && !isReportOrBill) {
                                    continue
                                }

                                // Queue alerts, arrival calls, doctor presence, clinic breaks, and "come to clinic" calls require an active queue appointment
                                val isQueueOrArrivalAlert = notif.type in listOf(
                                    "doctor_arrival", "doctor_presence", "clinic_break", "doctor_status",
                                    "manual_alert", "queue_alert", "early_arrival", "turn_call", "urgent_call"
                                ) || notif.title.contains("doctor", ignoreCase = true)
                                  || notif.title.contains("clinic", ignoreCase = true)
                                  || notif.title.contains("queue", ignoreCase = true)
                                  || notif.title.contains("turn", ignoreCase = true)
                                  || notif.title.contains("come", ignoreCase = true)
                                  || notif.title.contains("arrive", ignoreCase = true)
                                  || notif.message.contains("come to", ignoreCase = true)
                                  || notif.message.contains("arrive", ignoreCase = true)
                                  || notif.message.contains("turn", ignoreCase = true)

                                if (isQueueOrArrivalAlert && !isReportOrBill) {
                                    val hasActiveQueueAppt = patientAppointments.any {
                                        it.checkinStatus.lowercase() in listOf("waiting", "checked_in", "booked", "inside", "pending")
                                    }
                                    if (!hasActiveQueueAppt) {
                                        continue
                                    }
                                }

                                val notifId = (notif.id.hashCode() and 0x7FFFFFFF) % 100000
                                NotificationHelper.showSystemNotification(
                                    context = this@MainActivity,
                                    id = notifId,
                                    title = notif.title.ifBlank { "Dactor Health Alert" },
                                    message = notif.message,
                                    appointmentId = notif.appointmentId,
                                    type = notif.type
                                )
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(4000L) // Poll every 4 seconds for instant alerts
            }
        }

        setContent {
            com.dactor.patient.ui.theme.DactorPatientTheme {
                androidx.compose.material3.Surface(
                    modifier = androidx.compose.ui.Modifier
                        .fillMaxSize()
                        .navigationBarsPadding(),
                    color = androidx.compose.material3.MaterialTheme.colorScheme.background
                ) {
                    com.dactor.patient.ui.components.NetworkConnectivityGate {
                        com.dactor.patient.ui.components.NotificationPermissionEnforcer()
                        DactorNavHost(
                            authRepository = authRepository,
                            clinicRepository = clinicRepository,
                            doctorRepository = doctorRepository,
                            appointmentRepository = appointmentRepository,
                            queueRepository = queueRepository,
                            slotRepository = slotRepository,
                            labReportRepository = labReportRepository,
                            notificationRepository = notificationRepository,
                            draftManager = draftManager,
                            sessionManager = sessionManager
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val handled = authRepository.handleAuthCallback(uri)
                if (handled || uri.scheme.equals("dactor", ignoreCase = true) || uri.scheme.equals("dactorpatient", ignoreCase = true)) {
                    val draft = draftManager.getPatientDraft()
                    val userId = authRepository.getCurrentUser()
                    if (draft != null && !userId.isNullOrBlank()) {
                        authRepository.createPatientProfile(
                            userId = userId,
                            email = draft.email,
                            fullName = draft.fullName,
                            phone = draft.phone
                        )
                        draftManager.clearPatientDraft()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
