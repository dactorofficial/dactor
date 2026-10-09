package com.dactor.patient.ui.navigation

sealed class NavRoutes(val route: String) {
    object Landing : NavRoutes("landing")
    object Login : NavRoutes("login")
    object Register : NavRoutes("register")
    object Discovery : NavRoutes("discovery")
    object ClinicDetail : NavRoutes("clinic_detail/{clinicId}") {
        fun createRoute(clinicId: String) = "clinic_detail/$clinicId"
    }
    object DoctorDetail : NavRoutes("doctor_detail/{doctorId}") {
        fun createRoute(doctorId: String) = "doctor_detail/$doctorId"
    }
    object Booking : NavRoutes("booking/{clinicId}") {
        fun createRoute(clinicId: String) = "booking/$clinicId"
    }
    object BookingForm : NavRoutes("booking_form/{slotId}") {
        fun createRoute(slotId: String) = "booking_form/$slotId"
        fun createRoute(slotId: String, clinicId: String) = if (clinicId.isNotBlank()) "booking_form/$slotId/$clinicId" else "booking_form/$slotId"
    }
    object Payment : NavRoutes("payment/{appointmentId}") {
        fun createRoute(appointmentId: String) = "payment/$appointmentId"
    }
    object AppointmentConfirmed : NavRoutes("appointment_confirmed/{appointmentId}") {
        fun createRoute(appointmentId: String) = "appointment_confirmed/$appointmentId"
    }
    object TrackingLookup : NavRoutes("tracking_lookup")
    object QueueStatus : NavRoutes("queue_status/{appointmentId}") {
        fun createRoute(appointmentId: String) = "queue_status/$appointmentId"
    }
    object Profile : NavRoutes("profile")
    object LabReport : NavRoutes("lab_report/{reportId}") {
        fun createRoute(reportId: String = "") = if (reportId.isNotBlank()) "lab_report/$reportId" else "lab_report/all"
    }
    object Notifications : NavRoutes("notifications")
}
