package com.dactor.patient.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserSessionManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs = context.getSharedPreferences("dactor_patient_session", Context.MODE_PRIVATE)

    fun savePatientSession(
        patientId: String,
        email: String,
        name: String,
        phone: String,
        gender: String? = null,
        age: Int? = null,
        isArchived: Boolean = false,
        deletionScheduledAt: String? = null
    ) {
        prefs.edit()
            .putString("patient_id", patientId)
            .putString("user_email", email.trim().lowercase())
            .putString("user_name", name.trim())
            .putString("user_phone", phone.trim())
            .putString("user_gender", gender)
            .putInt("user_age", age ?: 0)
            .putBoolean("is_archived", isArchived)
            .putString("deletion_scheduled_at", deletionScheduledAt)
            .putBoolean("is_logged_in", true)
            .apply()
    }

    fun updateProfileInfo(name: String, phone: String, gender: String?, age: Int?) {
        val editor = prefs.edit()
            .putString("user_name", name.trim())
            .putString("user_phone", phone.trim())
        if (gender != null) editor.putString("user_gender", gender)
        if (age != null) editor.putInt("user_age", age)
        editor.apply()
    }

    fun setArchivedStatus(isArchived: Boolean, deletionScheduledAt: String?) {
        prefs.edit()
            .putBoolean("is_archived", isArchived)
            .putString("deletion_scheduled_at", deletionScheduledAt)
            .apply()
    }

    fun isAccountArchived(): Boolean = prefs.getBoolean("is_archived", false)
    fun getDeletionScheduledAt(): String? = prefs.getString("deletion_scheduled_at", null)
    fun getSavedGender(): String? = prefs.getString("user_gender", null)
    fun getSavedAge(): Int? = prefs.getInt("user_age", 0).let { if (it > 0) it else null }

    fun getSavedPatientId(): String? = prefs.getString("patient_id", null)
    fun getSavedEmail(): String? = prefs.getString("user_email", null)
    fun getSavedName(): String? = prefs.getString("user_name", null)
    fun getSavedPhone(): String? = prefs.getString("user_phone", null)
    fun isLoggedIn(): Boolean = prefs.getBoolean("is_logged_in", false)

    fun saveTrackingCode(code: String, label: String = "Patient Appointment") {
        val trimmedCode = code.trim()
        if (trimmedCode.length != 10) return
        val current = getSavedTrackingCodes().toMutableList()
        current.removeAll { it.first == trimmedCode }
        current.add(0, Pair(trimmedCode, label.trim().ifBlank { "Appointment $trimmedCode" }))
        val serialized = current.take(20).joinToString(";;") { "${it.first}|${it.second}" }
        prefs.edit().putString("saved_tracking_codes", serialized).apply()
    }

    fun getSavedTrackingCodes(): List<Pair<String, String>> {
        val raw = prefs.getString("saved_tracking_codes", null) ?: return emptyList()
        if (raw.isBlank()) return emptyList()
        return raw.split(";;").mapNotNull { entry ->
            val parts = entry.split("|")
            if (parts.size >= 2 && parts[0].isNotBlank()) {
                Pair(parts[0], parts[1])
            } else null
        }
    }

    fun removeTrackingCode(code: String) {
        val current = getSavedTrackingCodes().toMutableList()
        current.removeAll { it.first == code.trim() }
        val serialized = current.joinToString(";;") { "${it.first}|${it.second}" }
        prefs.edit().putString("saved_tracking_codes", serialized).apply()
    }

    fun clearSavedTrackingCodes() {
        prefs.edit().remove("saved_tracking_codes").apply()
    }

    fun isNotificationSeen(id: String): Boolean = prefs.getBoolean("notif_seen_$id", false)
    fun markNotificationSeen(id: String) {
        prefs.edit().putBoolean("notif_seen_$id", true).apply()
    }

    fun saveFcmToken(token: String) {
        prefs.edit().putString("fcm_token", token).apply()
    }
    fun getFcmToken(): String? = prefs.getString("fcm_token", null)

    fun clearSession() {
        prefs.edit().clear().apply()
    }
}
