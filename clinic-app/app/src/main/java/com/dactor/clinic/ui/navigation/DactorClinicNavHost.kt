package com.dactor.clinic.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.dactor.clinic.data.local.RegistrationDraftManager
import com.dactor.clinic.data.repository.*
import com.dactor.clinic.ui.appointments.FutureAppointmentsScreen
import com.dactor.clinic.ui.auth.*
import com.dactor.clinic.ui.billing.BillingScreen
import com.dactor.clinic.ui.billing.CatalogManagerScreen
import com.dactor.clinic.ui.dashboard.DashboardScreen
import com.dactor.clinic.ui.dashboard.DoctorDashboardScreen
import com.dactor.clinic.ui.invitations.InvitationManagerScreen
import com.dactor.clinic.ui.lab.LabWorkflowScreen
import com.dactor.clinic.ui.patients.PatientDetailScreen
import com.dactor.clinic.ui.patients.PatientDirectoryScreen
import com.dactor.clinic.ui.queue.QueueBoardScreen
import com.dactor.clinic.ui.services.ServicesScreen
import com.dactor.clinic.ui.settings.ClinicSettingsScreen
import com.dactor.clinic.ui.slots.SlotManagerScreen
import com.dactor.clinic.ui.walkin.WalkinBookingScreen

@Composable
fun DactorClinicNavHost(
    authRepository: AuthRepository? = null,
    clinicRepository: ClinicRepository? = null,
    doctorRepository: DoctorRepository? = null,
    appointmentRepository: AppointmentRepository? = null,
    queueRepository: QueueRepository? = null,
    billingRepository: BillingRepository? = null,
    labReportRepository: LabReportRepository? = null,
    slotRepository: SlotRepository? = null,
    invitationRepository: InvitationRepository? = null,
    draftManager: RegistrationDraftManager? = null,
    sessionManager: com.dactor.clinic.data.local.UserSessionManager? = null
) {
    val navController = rememberNavController()

    val startRoute = remember {
        if (sessionManager != null && sessionManager.isLoggedIn()) {
            val role = sessionManager.getUserRole()
            val docId = sessionManager.getSavedDoctorId()
            val clinicId = sessionManager.getSavedClinicId()
            if (role == "doctor" && !docId.isNullOrBlank()) {
                "${NavRoutes.DoctorDashboard}/$docId"
            } else if (!clinicId.isNullOrBlank()) {
                "${NavRoutes.Dashboard}/$clinicId"
            } else {
                NavRoutes.ClinicLogin
            }
        } else {
            NavRoutes.ClinicLogin
        }
    }

    NavHost(navController = navController, startDestination = startRoute) {
        composable(NavRoutes.ClinicLogin) {
            ClinicLoginScreen(
                navController = navController,
                authRepository = authRepository,
                doctorRepository = doctorRepository,
                clinicRepository = clinicRepository,
                draftManager = draftManager,
                sessionManager = sessionManager
            )
        }
        composable(NavRoutes.ClinicRegister) {
            ClinicRegisterScreen(
                navController = navController,
                clinicRepository = clinicRepository,
                authRepository = authRepository,
                draftManager = draftManager
            )
        }
        composable(NavRoutes.DoctorLogin) {
            DoctorLoginScreen(
                navController = navController,
                authRepository = authRepository,
                doctorRepository = doctorRepository
            )
        }
        composable(NavRoutes.DoctorRegister) {
            DoctorRegisterScreen(
                navController = navController,
                doctorRepository = doctorRepository,
                authRepository = authRepository,
                draftManager = draftManager
            )
        }
        composable(NavRoutes.DoctorKYC) {
            DoctorKYCScreen(navController = navController, doctorRepository = doctorRepository)
        }
        composable("${NavRoutes.DoctorKYC}/{doctorId}") { backStackEntry ->
            val docId = backStackEntry.arguments?.getString("doctorId")
            DoctorKYCScreen(navController = navController, doctorId = docId, doctorRepository = doctorRepository)
        }
        composable(NavRoutes.Dashboard) {
            DashboardScreen(navController = navController, doctorRepository = doctorRepository, clinicRepository = clinicRepository, authRepository = authRepository)
        }
        composable("${NavRoutes.Dashboard}/{clinicId}") { backStackEntry ->
            val clinicId = backStackEntry.arguments?.getString("clinicId")
            DashboardScreen(navController = navController, clinicId = clinicId, doctorRepository = doctorRepository, clinicRepository = clinicRepository, authRepository = authRepository)
        }
        composable(NavRoutes.DoctorDashboard) {
            DoctorDashboardScreen(
                navController = navController,
                doctorRepository = doctorRepository,
                queueRepository = queueRepository,
                appointmentRepository = appointmentRepository,
                invitationRepository = invitationRepository,
                clinicRepository = clinicRepository
            )
        }
        composable("${NavRoutes.DoctorDashboard}/{doctorId}") { backStackEntry ->
            val docId = backStackEntry.arguments?.getString("doctorId")
            DoctorDashboardScreen(
                navController = navController,
                doctorId = docId,
                doctorRepository = doctorRepository,
                queueRepository = queueRepository,
                appointmentRepository = appointmentRepository,
                invitationRepository = invitationRepository,
                clinicRepository = clinicRepository
            )
        }
        val savedClinicId = sessionManager?.getSavedClinicId() ?: ""

        composable(NavRoutes.SlotManager) {
            SlotManagerScreen(
                navController = navController,
                clinicId = savedClinicId,
                slotRepository = slotRepository,
                doctorRepository = doctorRepository
            )
        }
        composable("${NavRoutes.SlotManager}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            SlotManagerScreen(
                navController = navController,
                clinicId = cid,
                slotRepository = slotRepository,
                doctorRepository = doctorRepository
            )
        }
        composable(NavRoutes.QueueBoard) {
            QueueBoardScreen(
                navController = navController,
                clinicId = savedClinicId,
                queueRepository = queueRepository,
                appointmentRepository = appointmentRepository
            )
        }
        composable("${NavRoutes.QueueBoard}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            QueueBoardScreen(
                navController = navController,
                clinicId = cid,
                queueRepository = queueRepository,
                appointmentRepository = appointmentRepository
            )
        }
        composable(NavRoutes.PatientDirectory) {
            PatientDirectoryScreen(
                navController = navController,
                clinicId = savedClinicId,
                appointmentRepository = appointmentRepository,
                doctorRepository = doctorRepository,
                billingRepository = billingRepository,
                sessionManager = sessionManager
            )
        }
        composable("${NavRoutes.PatientDirectory}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            PatientDirectoryScreen(
                navController = navController,
                clinicId = cid,
                appointmentRepository = appointmentRepository,
                doctorRepository = doctorRepository,
                billingRepository = billingRepository,
                sessionManager = sessionManager
            )
        }
        composable(NavRoutes.PatientDetail) {
            PatientDetailScreen(
                navController = navController,
                appointmentRepository = appointmentRepository,
                queueRepository = queueRepository,
                billingRepository = billingRepository
            )
        }
        composable("${NavRoutes.PatientDetail}/{appointmentId}") { backStackEntry ->
            val apptId = backStackEntry.arguments?.getString("appointmentId") ?: ""
            PatientDetailScreen(
                navController = navController,
                appointmentId = apptId,
                appointmentRepository = appointmentRepository,
                queueRepository = queueRepository,
                billingRepository = billingRepository
            )
        }
        composable(NavRoutes.BillingScreen) {
            BillingScreen(
                navController = navController,
                clinicId = savedClinicId,
                billingRepository = billingRepository,
                appointmentRepository = appointmentRepository
            )
        }
        composable("${NavRoutes.BillingScreen}/{appointmentId}") { backStackEntry ->
            val apptId = backStackEntry.arguments?.getString("appointmentId") ?: ""
            BillingScreen(
                navController = navController,
                clinicId = savedClinicId,
                appointmentId = apptId,
                billingRepository = billingRepository,
                appointmentRepository = appointmentRepository
            )
        }
        composable(NavRoutes.CatalogManager) {
            CatalogManagerScreen(
                navController = navController,
                clinicId = savedClinicId,
                billingRepository = billingRepository
            )
        }
        composable("${NavRoutes.CatalogManager}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            CatalogManagerScreen(
                navController = navController,
                clinicId = cid,
                billingRepository = billingRepository
            )
        }
        composable(NavRoutes.FutureAppointments) {
            FutureAppointmentsScreen(
                navController = navController,
                clinicId = savedClinicId,
                appointmentRepository = appointmentRepository
            )
        }
        composable("${NavRoutes.FutureAppointments}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            FutureAppointmentsScreen(
                navController = navController,
                clinicId = cid,
                appointmentRepository = appointmentRepository
            )
        }
        composable(NavRoutes.WalkinBooking) {
            WalkinBookingScreen(
                navController = navController,
                clinicId = savedClinicId,
                appointmentRepository = appointmentRepository,
                doctorRepository = doctorRepository,
                slotRepository = slotRepository
            )
        }
        composable("${NavRoutes.WalkinBooking}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            WalkinBookingScreen(
                navController = navController,
                clinicId = cid,
                appointmentRepository = appointmentRepository,
                doctorRepository = doctorRepository,
                slotRepository = slotRepository
            )
        }
        composable(NavRoutes.LabWorkflow) {
            LabWorkflowScreen(
                navController = navController,
                clinicId = savedClinicId,
                labReportRepository = labReportRepository
            )
        }
        composable("${NavRoutes.LabWorkflow}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            LabWorkflowScreen(
                navController = navController,
                clinicId = cid,
                labReportRepository = labReportRepository
            )
        }
        composable(NavRoutes.InvitationManager) {
            InvitationManagerScreen(
                navController = navController,
                clinicId = savedClinicId,
                invitationRepository = invitationRepository,
                doctorRepository = doctorRepository,
                authRepository = authRepository
            )
        }
        composable("${NavRoutes.InvitationManager}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            InvitationManagerScreen(
                navController = navController,
                clinicId = cid,
                invitationRepository = invitationRepository,
                doctorRepository = doctorRepository,
                authRepository = authRepository
            )
        }
        composable(NavRoutes.ClinicSettings) {
            ClinicSettingsScreen(
                navController = navController,
                clinicId = savedClinicId,
                clinicRepository = clinicRepository
            )
        }
        composable("${NavRoutes.ClinicSettings}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            ClinicSettingsScreen(
                navController = navController,
                clinicId = cid,
                clinicRepository = clinicRepository
            )
        }
        composable(NavRoutes.ServicesScreen) {
            ServicesScreen(
                navController = navController,
                clinicId = savedClinicId,
                clinicRepository = clinicRepository
            )
        }
        composable("${NavRoutes.ServicesScreen}/{clinicId}") { backStackEntry ->
            val cid = backStackEntry.arguments?.getString("clinicId") ?: savedClinicId
            ServicesScreen(
                navController = navController,
                clinicId = cid,
                clinicRepository = clinicRepository
            )
        }
    }
}
