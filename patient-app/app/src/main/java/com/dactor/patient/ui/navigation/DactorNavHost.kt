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
import com.dactor.patient.ui.notifications.NotificationsScreen
import com.dactor.patient.ui.profile.ProfileScreen
import com.dactor.patient.ui.tracker.QueueStatusScreen
import com.dactor.patient.ui.tracker.TrackingLookupScreen

import com.dactor.patient.ui.main.PatientMainScreen
import com.dactor.patient.ui.onboarding.OnboardingScreen

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
    val activePaymentSession = sessionManager?.getActivePaymentSession()
    val isUserLoggedIn = sessionManager?.isLoggedIn() == true || (authRepository?.isLoggedIn() == true)
    val hasSeenOnboarding = sessionManager?.hasSeenOnboarding() == true
    val startDest = if (activePaymentSession != null && !activePaymentSession.isExpired()) {
        NavRoutes.Payment.createRoute(activePaymentSession.appointmentId)
    } else if (isUserLoggedIn || hasSeenOnboarding) {
        NavRoutes.PatientMain.route
    } else {
        NavRoutes.Onboarding.route
    }

    NavHost(navController = navController, startDestination = startDest) {
        composable(NavRoutes.Onboarding.route) {
            OnboardingScreen(
                navController = navController,
                authRepository = authRepository,
                sessionManager = sessionManager,
                appointmentRepository = appointmentRepository
            )
        }
        composable(NavRoutes.Landing.route) {
            // Block old landing page completely: immediately redirect to PatientMain or Onboarding
            androidx.compose.runtime.LaunchedEffect(Unit) {
                val target = if (sessionManager?.hasSeenOnboarding() == true || isUserLoggedIn) {
                    NavRoutes.PatientMain.route
                } else {
                    NavRoutes.Onboarding.route
                }
                navController.navigate(target) {
                    popUpTo(0) { inclusive = true }
                    launchSingleTop = true
                }
            }
        }
        composable(NavRoutes.Login.route) { LoginScreen(navController, authRepository, draftManager, sessionManager, appointmentRepository) }
        composable(NavRoutes.Register.route) { RegisterScreen(navController, authRepository, draftManager, sessionManager) }
        composable(NavRoutes.Discovery.route) {
            PatientMainScreen(
                navController = navController,
                clinicRepository = clinicRepository,
                doctorRepository = doctorRepository,
                slotRepository = slotRepository,
                appointmentRepository = appointmentRepository,
                queueRepository = queueRepository,
                labReportRepository = labReportRepository,
                notificationRepository = notificationRepository,
                authRepository = authRepository,
                sessionManager = sessionManager,
                initialTab = 0
            )
        }
        composable(NavRoutes.PatientMain.route) {
            PatientMainScreen(
                navController = navController,
                clinicRepository = clinicRepository,
                doctorRepository = doctorRepository,
                slotRepository = slotRepository,
                appointmentRepository = appointmentRepository,
                queueRepository = queueRepository,
                labReportRepository = labReportRepository,
                notificationRepository = notificationRepository,
                authRepository = authRepository,
                sessionManager = sessionManager,
                initialTab = 0
            )
        }
        composable("patient_main?tab={tab}") { backStackEntry ->
            val tab = backStackEntry.arguments?.getString("tab")?.toIntOrNull() ?: 0
            PatientMainScreen(
                navController = navController,
                clinicRepository = clinicRepository,
                doctorRepository = doctorRepository,
                slotRepository = slotRepository,
                appointmentRepository = appointmentRepository,
                queueRepository = queueRepository,
                labReportRepository = labReportRepository,
                notificationRepository = notificationRepository,
                authRepository = authRepository,
                sessionManager = sessionManager,
                initialTab = tab
            )
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
                initialDoctorId = null,
                slotRepository = slotRepository,
                doctorRepository = doctorRepository,
                clinicRepository = clinicRepository,
                authRepository = authRepository,
                sessionManager = sessionManager
            )
        }
        composable("booking/{clinicId}?doctorId={doctorId}") { backStackEntry ->
            val clinicId = backStackEntry.arguments?.getString("clinicId") ?: ""
            val doctorId = backStackEntry.arguments?.getString("doctorId")
            BookingScreen(
                navController = navController,
                clinicId = clinicId,
                initialDoctorId = doctorId,
                slotRepository = slotRepository,
                doctorRepository = doctorRepository,
                clinicRepository = clinicRepository,
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
                clinicRepository = clinicRepository,
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
        composable(NavRoutes.TrackingLookup.route) {
            TrackingLookupScreen(
                navController = navController,
                appointmentRepository = appointmentRepository,
                authRepository = authRepository,
                sessionManager = sessionManager
            )
        }
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
