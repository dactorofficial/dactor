package com.dactor.clinic

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.dactor.clinic.data.local.RegistrationDraftManager
import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.repository.*
import com.dactor.clinic.ui.navigation.DactorClinicNavHost
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.os.Build
import com.dactor.clinic.service.NotificationHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import java.util.UUID
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var authRepository: AuthRepository
    @Inject lateinit var clinicRepository: ClinicRepository
    @Inject lateinit var doctorRepository: DoctorRepository
    @Inject lateinit var appointmentRepository: AppointmentRepository
    @Inject lateinit var queueRepository: QueueRepository
    @Inject lateinit var billingRepository: BillingRepository
    @Inject lateinit var labReportRepository: LabReportRepository
    @Inject lateinit var slotRepository: SlotRepository
    @Inject lateinit var invitationRepository: InvitationRepository
    @Inject lateinit var notificationRepository: NotificationRepository
    @Inject lateinit var draftManager: RegistrationDraftManager
    @Inject lateinit var sessionManager: com.dactor.clinic.data.local.UserSessionManager

    private val seenNotifIds = mutableSetOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)

        // 1. Initialize Notification Channel
        NotificationHelper.createNotificationChannel(this)

        // 2. Request Android 13+ Notification Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 102)
            }
        }

        // 3. Start background watcher for broadcast and staff alerts
        lifecycleScope.launch(Dispatchers.IO) {
            var isFirstPoll = true
            while (isActive) {
                try {
                    val userId = authRepository.getCurrentUser()
                    val notifs = notificationRepository.getNotifications(userId = userId)

                    if (isFirstPoll) {
                        seenNotifIds.addAll(notifs.map { it.id })
                        isFirstPoll = false
                    } else {
                        for (notif in notifs) {
                            if (!seenNotifIds.contains(notif.id)) {
                                seenNotifIds.add(notif.id)
                                val notifId = (notif.id.hashCode() and 0x7FFFFFFF) % 100000
                                NotificationHelper.showSystemNotification(
                                    context = this@MainActivity,
                                    id = notifId,
                                    title = notif.title.ifBlank { "Dactor Clinic Alert" },
                                    message = notif.message
                                )
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(4000L)
            }
        }
        setContent {
            com.dactor.clinic.ui.theme.DactorClinicTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .navigationBarsPadding(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    com.dactor.clinic.ui.components.NetworkConnectivityGate {
                        com.dactor.clinic.ui.components.NotificationPermissionEnforcer()
                        DactorClinicNavHost(
                            authRepository = authRepository,
                            clinicRepository = clinicRepository,
                            doctorRepository = doctorRepository,
                            appointmentRepository = appointmentRepository,
                            queueRepository = queueRepository,
                            billingRepository = billingRepository,
                            labReportRepository = labReportRepository,
                            slotRepository = slotRepository,
                            invitationRepository = invitationRepository,
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
                if (handled || uri.scheme.equals("dactor", ignoreCase = true)) {
                    // Deep link confirmed! If drafts are saved, sync directly to server
                    val clinicDraft = draftManager.getClinicDraft()
                    if (clinicDraft != null) {
                        val clinic = Clinic(
                            id = UUID.randomUUID().toString(),
                            name = clinicDraft.name.trim(),
                            type = clinicDraft.type,
                            verificationStatus = "approved",
                            contactPhone = clinicDraft.phone.trim(),
                            contactEmail = clinicDraft.email.trim().lowercase(),
                            addressText = clinicDraft.address.trim(),
                            latitude = clinicDraft.latitude,
                            longitude = clinicDraft.longitude,
                            autoNotifyThreshold = 2,
                            description = clinicDraft.description?.trim()?.ifBlank { null }
                        )
                        clinicRepository.createClinic(clinic)
                        draftManager.clearClinicDraft()
                    }

                    val doctorDraft = draftManager.getDoctorDraft()
                    if (doctorDraft != null) {
                        val doctor = Doctor(
                            id = UUID.randomUUID().toString(),
                            fullName = doctorDraft.fullName.trim(),
                            email = doctorDraft.email.trim().lowercase(),
                            specialty = doctorDraft.specialty.trim(),
                            nmcLicenseNumber = "NMC-VERIFIED",
                            kycStatus = "approved",
                            isInClinic = true,
                            consultationFee = doctorDraft.fee
                        )
                        doctorRepository.createDoctor(doctor)
                        draftManager.clearDoctorDraft()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
