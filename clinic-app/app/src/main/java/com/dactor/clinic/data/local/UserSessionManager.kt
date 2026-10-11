package com.dactor.clinic.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class PendingSubmission(
    val email: String,
    val role: String, // "clinic" or "doctor"
    val name: String,
    val id: String,
    val details: String,
    val status: String
)

@Singleton
class UserSessionManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences("dactor_user_session", Context.MODE_PRIVATE)

    fun saveClinicSession(clinicId: String, email: String, name: String) {
        prefs.edit()
            .remove("doctor_id")
            .putString("clinic_id", clinicId)
            .putString("user_email", email.trim().lowercase())
            .putString("user_name", name.trim())
            .putString("user_role", "clinic")
            .putBoolean("is_logged_in", true)
            .apply()
    }

    fun saveDoctorSession(doctorId: String, email: String, name: String) {
        prefs.edit()
            .remove("clinic_id")
            .putString("doctor_id", doctorId)
            .putString("user_email", email.trim().lowercase())
            .putString("user_name", name.trim())
            .putString("user_role", "doctor")
            .putBoolean("is_logged_in", true)
            .apply()
    }

    fun getSavedClinicId(): String? = prefs.getString("clinic_id", null)
    fun getClinicId(): String = getSavedClinicId().orEmpty()
    fun getSavedDoctorId(): String? = prefs.getString("doctor_id", null)
    fun saveActiveClinicIdForDoctor(clinicId: String) {
        prefs.edit().putString("doctor_active_clinic_id", clinicId.trim()).apply()
    }
    fun getSavedActiveClinicIdForDoctor(): String? = prefs.getString("doctor_active_clinic_id", null)
    fun getSavedEmail(): String? = prefs.getString("user_email", null)
    fun getSavedName(): String? = prefs.getString("user_name", null)
    fun getUserRole(): String? = prefs.getString("user_role", null)
    fun isLoggedIn(): Boolean = prefs.getBoolean("is_logged_in", false)
    fun isClinicArchived(): Boolean = prefs.getBoolean("is_clinic_archived", false)
    fun getClinicDeletionScheduledAt(): String? = prefs.getString("clinic_deletion_scheduled_at", null)

    fun setClinicArchivedStatus(isArchived: Boolean, deletionScheduledAt: String?) {
        prefs.edit()
            .putBoolean("is_clinic_archived", isArchived)
            .putString("clinic_deletion_scheduled_at", deletionScheduledAt)
            .apply()
    }

    fun savePendingVerification(
        email: String,
        role: String,
        name: String,
        id: String,
        details: String,
        status: String
    ) {
        prefs.edit()
            .putString("pending_email", email.trim().lowercase())
            .putString("pending_role", role)
            .putString("pending_name", name)
            .putString("pending_id", id)
            .putString("pending_details", details)
            .putString("pending_status", status)
            .apply()
    }

    fun getPendingVerification(): PendingSubmission? {
        val email = prefs.getString("pending_email", null) ?: return null
        return PendingSubmission(
            email = email,
            role = prefs.getString("pending_role", "clinic") ?: "clinic",
            name = prefs.getString("pending_name", "") ?: "",
            id = prefs.getString("pending_id", "") ?: "",
            details = prefs.getString("pending_details", "") ?: "",
            status = prefs.getString("pending_status", "pending") ?: "pending"
        )
    }

    fun clearPendingVerification() {
        prefs.edit()
            .remove("pending_email")
            .remove("pending_role")
            .remove("pending_name")
            .remove("pending_id")
            .remove("pending_details")
            .remove("pending_status")
            .apply()
    }

    fun clearActiveLoginSession() {
        prefs.edit()
            .remove("clinic_id")
            .remove("doctor_id")
            .remove("user_email")
            .remove("user_name")
            .remove("user_role")
            .putBoolean("is_logged_in", false)
            .remove("is_clinic_archived")
            .remove("clinic_deletion_scheduled_at")
            .apply()
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    fun saveAverageConsultationTimeMinutes(clinicId: String, minutes: Int) {
        prefs.edit().putInt("avg_consultation_time_${clinicId}", minutes).apply()
    }

    fun getAverageConsultationTimeMinutes(clinicId: String): Int {
        return prefs.getInt("avg_consultation_time_${clinicId}", 10)
    }

    fun saveManualAverageConsultationTimeMinutes(clinicId: String, minutes: Int) {
        prefs.edit().putInt("manual_avg_consultation_time_${clinicId}", minutes).apply()
    }

    fun getManualAverageConsultationTimeMinutes(clinicId: String): Int {
        return prefs.getInt("manual_avg_consultation_time_${clinicId}", 10)
    }

    fun saveCalculatedAverageConsultationTimeMinutes(clinicId: String, minutes: Int) {
        prefs.edit().putInt("calc_avg_consultation_time_${clinicId}", minutes).apply()
    }

    fun getCalculatedAverageConsultationTimeMinutes(clinicId: String): Int? {
        val v = prefs.getInt("calc_avg_consultation_time_${clinicId}", -1)
        return if (v > 0) v else null
    }

    fun saveAverageTimeMode(clinicId: String, mode: String) {
        prefs.edit().putString("avg_time_mode_${clinicId}", mode).apply()
    }

    fun getAverageTimeMode(clinicId: String): String {
        return prefs.getString("avg_time_mode_${clinicId}", "auto") ?: "auto"
    }
}

typealias ClinicSessionManager = UserSessionManager

