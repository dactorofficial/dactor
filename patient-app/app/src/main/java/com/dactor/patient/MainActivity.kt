package com.dactor.patient

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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

        // 4. Start real-time background watcher for doctor alerts
        lifecycleScope.launch(Dispatchers.IO) {
            while (isActive) {
                try {
                    val userId = authRepository.getCurrentUser() ?: sessionManager.getSavedPatientId()
                    val savedCodes = sessionManager.getSavedTrackingCodes().map { it.first }
                    val notifs = notificationRepository.getNotifications(userId = userId, appointmentIds = savedCodes)

                    for (notif in notifs) {
                        if (!sessionManager.isNotificationSeen(notif.id)) {
                            sessionManager.markNotificationSeen(notif.id)
                            val notifId = (notif.id.hashCode() and 0x7FFFFFFF) % 100000
                            NotificationHelper.showSystemNotification(
                                context = this@MainActivity,
                                id = notifId,
                                title = notif.title,
                                message = notif.message,
                                appointmentId = notif.appointmentId
                            )
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(6000L) // Poll every 6 seconds for instant alerts from doctor
            }
        }

        setContent {
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
