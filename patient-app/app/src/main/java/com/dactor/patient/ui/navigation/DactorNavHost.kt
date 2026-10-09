package com.dactor.patient.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.dactor.patient.data.repository.*
import com.dactor.patient.ui.auth.LoginScreen
import com.dactor.patient.ui.auth.RegisterScreen
import com.dactor.patient.ui.booking.AppointmentConfirmedScreen
import com.dactor.patient.ui.booking.BookingFormScreen
import com.dactor.patient.ui.booking.BookingScreen
import com.dactor.patient.ui.booking.PaymentScreen
import com.dactor.patient.ui.discovery.ClinicDetailScreen
import com.dactor.patient.ui.discovery.DiscoveryScreen
import com.dactor.patient.ui.labreport.LabReportScreen
import com.dactor.patient.ui.landing.LandingScreen
import com.dactor.patient.ui.notifications.NotificationsScreen
import com.dactor.patient.ui.profile.ProfileScreen
import com.dactor.patient.ui.tracker.QueueStatusScreen
import com.dactor.patient.ui.tracker.TrackingLookupScreen

@Composable
fun DactorNavHost(
    authRepository: AuthRepository? = null,
    clinicRepository: ClinicRepository? = null,
    doctorRepository: DoctorRepository? = null,
    appointmentRepository: AppointmentRepository? = null,
    queueRepository: QueueRepository? = null,
    slotRepository: SlotRepository? = null,
    labReportRepository: LabReportRepository? = null,
    notificationRepository: NotificationRepository? = null,
    draftManager: com.dactor.patient.data.local.RegistrationDraftManager? = null,
    sessionManager: com.dactor.patient.data.local.UserSessionManager? = null
) {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = NavRoutes.Landing.route) {
        composable(NavRoutes.Landing.route) { LandingScreen(navController) }
        composable(NavRoutes.Login.route) { LoginScreen(navController, authRepository, draftManager, sessionManager) }
        composable(NavRoutes.Register.route) { RegisterScreen(navController, authRepository, draftManager, sessionManager) }
        composable(NavRoutes.Discovery.route) {
            DiscoveryScreen(navController, clinicRepository, doctorRepository)
        }
        composable(NavRoutes.ClinicDetail.route) { backStackEntry ->
            val clinicId = backStackEntry.arguments?.getString("clinicId") ?: ""
            ClinicDetailScreen(navController = navController, clinicId = clinicId, clinicRepository = clinicRepository, doctorRepository = doctorRepository)
        }
        composable(NavRoutes.Booking.route) { backStackEntry ->
            val clinicId = backStackEntry.arguments?.getString("clinicId") ?: ""
            BookingScreen(
                navController = navController,
                clinicId = clinicId,
                slotRepository = slotRepository,
                doctorRepository = doctorRepository,
                authRepository = authRepository,
                sessionManager = sessionManager
            )
        }
        composable(NavRoutes.BookingForm.route) { backStackEntry ->
            val slotId = backStackEntry.arguments?.getString("slotId") ?: ""
            BookingFormScreen(
                navController = navController,
                slotId = slotId,
                appointmentRepository = appointmentRepository,
                slotRepository = slotRepository,
                clinicRepository = clinicRepository,
                authRepository = authRepository,
                sessionManager = sessionManager,
                doctorRepository = doctorRepository
            )
        }
        composable("booking_form/{slotId}/{clinicId}") { backStackEntry ->
            val slotId = backStackEntry.arguments?.getString("slotId") ?: ""
            val clinicId = backStackEntry.arguments?.getString("clinicId") ?: ""
            BookingFormScreen(
                navController = navController,
                slotId = slotId,
                clinicId = clinicId,
                appointmentRepository = appointmentRepository,
                slotRepository = slotRepository,
                clinicRepository = clinicRepository,
                authRepository = authRepository,
                sessionManager = sessionManager,
                doctorRepository = doctorRepository
            )
        }
        composable(NavRoutes.Payment.route) { backStackEntry ->
            val appointmentId = backStackEntry.arguments?.getString("appointmentId") ?: ""
            PaymentScreen(
                navController = navController,
                appointmentId = appointmentId,
                slotRepository = slotRepository,
                appointmentRepository = appointmentRepository,
                sessionManager = sessionManager
            )
        }
        composable(NavRoutes.AppointmentConfirmed.route) { backStackEntry ->
            val appointmentId = backStackEntry.arguments?.getString("appointmentId") ?: ""
            AppointmentConfirmedScreen(
                navController = navController,
                appointmentId = appointmentId,
                appointmentRepository = appointmentRepository,
                sessionManager = sessionManager
            )
        }
        composable(NavRoutes.TrackingLookup.route) { TrackingLookupScreen(navController) }
        composable(NavRoutes.QueueStatus.route) { backStackEntry ->
            val appointmentId = backStackEntry.arguments?.getString("appointmentId") ?: ""
            QueueStatusScreen(
                navController = navController,
                appointmentIdOrCode = appointmentId,
                appointmentRepository = appointmentRepository,
                queueRepository = queueRepository,
                clinicRepository = clinicRepository,
                doctorRepository = doctorRepository,
                slotRepository = slotRepository,
                labReportRepository = labReportRepository,
                sessionManager = sessionManager
            )
        }
        composable(NavRoutes.Profile.route) { ProfileScreen(navController, authRepository, appointmentRepository, sessionManager) }
        composable(NavRoutes.LabReport.route) { backStackEntry ->
            val reportId = backStackEntry.arguments?.getString("reportId") ?: ""
            LabReportScreen(
                navController = navController,
                reportId = reportId,
                labReportRepository = labReportRepository,
                appointmentRepository = appointmentRepository,
                sessionManager = sessionManager
            )
        }
        composable("lab_report") {
            LabReportScreen(
                navController = navController,
                reportId = "",
                labReportRepository = labReportRepository,
                appointmentRepository = appointmentRepository,
                sessionManager = sessionManager
            )
        }
        composable(NavRoutes.Notifications.route) {
            NotificationsScreen(
                navController = navController,
                notificationRepository = notificationRepository,
                sessionManager = sessionManager,
                authRepository = authRepository,
                appointmentRepository = appointmentRepository
            )
        }
    }
}
