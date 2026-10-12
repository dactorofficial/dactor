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
            .putBoolean("is_guest_mode", false)
            .putBoolean("has_seen_onboarding", true)
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
    fun isLoggedIn(): Boolean {
        val prefLoggedIn = prefs.getBoolean("is_logged_in", false)
        val hasEmail = !prefs.getString("user_email", null).isNullOrBlank()
        val fbUser = try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser } catch (_: Exception) { null }
        return (prefLoggedIn && hasEmail) || (fbUser != null && !fbUser.email.isNullOrBlank())
    }

    fun hasSeenOnboarding(): Boolean = prefs.getBoolean("has_seen_onboarding", false)
    fun setHasSeenOnboarding(seen: Boolean) {
        prefs.edit().putBoolean("has_seen_onboarding", seen).apply()
    }

    fun isGuestMode(): Boolean {
        if (isLoggedIn()) return false
        return prefs.getBoolean("is_guest_mode", false)
    }
    fun setGuestMode(isGuest: Boolean) {
        prefs.edit().putBoolean("is_guest_mode", isGuest).apply()
    }

    fun setPendingVerifiedEmail(email: String?) {
        if (email.isNullOrBlank()) {
            prefs.edit().remove("pending_verified_google_email").apply()
        } else {
            prefs.edit().putString("pending_verified_google_email", email.trim().lowercase()).apply()
        }
    }

    fun consumePendingVerifiedEmail(): String? {
        val email = prefs.getString("pending_verified_google_email", null)
        if (!email.isNullOrBlank()) {
            prefs.edit().remove("pending_verified_google_email").apply()
            return email
        }
        return null
    }

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

    fun isOneHourReminderTriggered(appointmentId: String): Boolean =
        prefs.getBoolean("one_hour_reminder_triggered_$appointmentId", false)

    fun markOneHourReminderTriggered(appointmentId: String) {
        prefs.edit().putBoolean("one_hour_reminder_triggered_$appointmentId", true).apply()
    }

    fun saveFcmToken(token: String) {
        prefs.edit().putString("fcm_token", token).apply()
    }
    fun getFcmToken(): String? = prefs.getString("fcm_token", null)

    data class PendingBookingRedirect(
        val route: String,
        val clinicId: String,
        val doctorId: String?,
        val selectedDate: String?,
        val selectedSlotId: String?,
        val scrollIndex: Int = 0,
        val scrollOffset: Int = 0
    )

    fun savePendingBookingRedirect(
        route: String,
        clinicId: String,
        doctorId: String? = null,
        selectedDate: String? = null,
        selectedSlotId: String? = null,
        scrollIndex: Int = 0,
        scrollOffset: Int = 0
    ) {
        prefs.edit()
            .putBoolean("has_pending_booking_redirect", true)
            .putString("pending_booking_route", route)
            .putString("pending_booking_clinic_id", clinicId)
            .putString("pending_booking_doctor_id", doctorId)
            .putString("pending_booking_date", selectedDate)
            .putString("pending_booking_slot_id", selectedSlotId)
            .putInt("pending_booking_scroll_index", scrollIndex)
            .putInt("pending_booking_scroll_offset", scrollOffset)
            .apply()
    }

    fun getPendingBookingRedirect(): PendingBookingRedirect? {
        if (!prefs.getBoolean("has_pending_booking_redirect", false)) return null
        val route = prefs.getString("pending_booking_route", null) ?: return null
        val clinicId = prefs.getString("pending_booking_clinic_id", "") ?: ""
        return PendingBookingRedirect(
            route = route,
            clinicId = clinicId,
            doctorId = prefs.getString("pending_booking_doctor_id", null),
            selectedDate = prefs.getString("pending_booking_date", null),
            selectedSlotId = prefs.getString("pending_booking_slot_id", null),
            scrollIndex = prefs.getInt("pending_booking_scroll_index", 0),
            scrollOffset = prefs.getInt("pending_booking_scroll_offset", 0)
        )
    }

    fun clearPendingBookingRedirect() {
        prefs.edit()
            .remove("has_pending_booking_redirect")
            .remove("pending_booking_route")
            .remove("pending_booking_clinic_id")
            .remove("pending_booking_doctor_id")
            .remove("pending_booking_date")
            .remove("pending_booking_slot_id")
            .remove("pending_booking_scroll_index")
            .remove("pending_booking_scroll_offset")
            .apply()
    }

    data class ActivePaymentSession(
        val appointmentId: String,
        val clinicId: String,
        val doctorId: String? = null,
        val slotId: String? = null,
        val appointmentDate: String? = null,
        val amount: Double = 0.0,
        val transactionId: String = "",
        val expiresAtEpochMs: Long = 0L,
        val patientName: String = "",
        val trackingCode: String = ""
    ) {
        fun isExpired(): Boolean = System.currentTimeMillis() >= expiresAtEpochMs
        fun remainingSeconds(): Int {
            val rem = (expiresAtEpochMs - System.currentTimeMillis()) / 1000L
            return if (rem > 0) rem.toInt() else 0
        }
    }

    fun saveActivePaymentSession(
        appointmentId: String,
        clinicId: String,
        doctorId: String? = null,
        slotId: String? = null,
        appointmentDate: String? = null,
        amount: Double,
        transactionId: String,
        expiresAtEpochMs: Long,
        patientName: String = "",
        trackingCode: String = ""
    ) {
        prefs.edit()
            .putBoolean("has_active_payment_session", true)
            .putString("payment_session_appointment_id", appointmentId)
            .putString("payment_session_clinic_id", clinicId)
            .putString("payment_session_doctor_id", doctorId)
            .putString("payment_session_slot_id", slotId)
            .putString("payment_session_date", appointmentDate)
            .putFloat("payment_session_amount", amount.toFloat())
            .putString("payment_session_tx_id", transactionId)
            .putLong("payment_session_expires_at", expiresAtEpochMs)
            .putString("payment_session_patient_name", patientName)
            .putString("payment_session_tracking_code", trackingCode)
            .apply()
    }

    fun getActivePaymentSession(): ActivePaymentSession? {
        if (!prefs.getBoolean("has_active_payment_session", false)) return null
        val apptId = prefs.getString("payment_session_appointment_id", null) ?: return null
        val expiresAt = prefs.getLong("payment_session_expires_at", 0L)
        if (System.currentTimeMillis() >= expiresAt) {
            clearActivePaymentSession()
            return null
        }
        return ActivePaymentSession(
            appointmentId = apptId,
            clinicId = prefs.getString("payment_session_clinic_id", "") ?: "",
            doctorId = prefs.getString("payment_session_doctor_id", null),
            slotId = prefs.getString("payment_session_slot_id", null),
            appointmentDate = prefs.getString("payment_session_date", null),
            amount = prefs.getFloat("payment_session_amount", 0f).toDouble(),
            transactionId = prefs.getString("payment_session_tx_id", "") ?: "",
            expiresAtEpochMs = expiresAt,
            patientName = prefs.getString("payment_session_patient_name", "") ?: "",
            trackingCode = prefs.getString("payment_session_tracking_code", "") ?: ""
        )
    }

    fun clearActivePaymentSession() {
        prefs.edit()
            .remove("has_active_payment_session")
            .remove("payment_session_appointment_id")
            .remove("payment_session_clinic_id")
            .remove("payment_session_doctor_id")
            .remove("payment_session_slot_id")
            .remove("payment_session_date")
            .remove("payment_session_amount")
            .remove("payment_session_tx_id")
            .remove("payment_session_expires_at")
            .remove("payment_session_patient_name")
            .remove("payment_session_tracking_code")
            .apply()
    }

    fun setShowTransactionFailedBanner(show: Boolean) {
        prefs.edit().putBoolean("show_transaction_failed_banner", show).apply()
    }

    fun consumeTransactionFailedBanner(): Boolean {
        val show = prefs.getBoolean("show_transaction_failed_banner", false)
        if (show) {
            prefs.edit().putBoolean("show_transaction_failed_banner", false).apply()
        }
        return show
    }

    fun saveLocalTransactionRecord(record: com.dactor.patient.data.model.PatientTransactionRecord) {
        try {
            val list = getLocalTransactionRecords().toMutableList()
            list.removeAll { it.id == record.id || it.appointmentId == record.appointmentId }
            list.add(0, record)
            val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; encodeDefaults = true }
            val serialized = json.encodeToString(kotlinx.serialization.builtins.ListSerializer(com.dactor.patient.data.model.PatientTransactionRecord.serializer()), list.take(30))
            prefs.edit().putString("local_cached_transactions", serialized).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getLocalTransactionRecords(): List<com.dactor.patient.data.model.PatientTransactionRecord> {
        val raw = prefs.getString("local_cached_transactions", null) ?: return emptyList()
        if (raw.isBlank()) return emptyList()
        return try {
            val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
            json.decodeFromString(kotlinx.serialization.builtins.ListSerializer(com.dactor.patient.data.model.PatientTransactionRecord.serializer()), raw)
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun clearSession() {
        val savedCodes = prefs.getString("saved_tracking_codes", null)
        val fcm = prefs.getString("fcm_token", null)
        val txs = prefs.getString("local_cached_transactions", null)
        val hasSeen = prefs.getBoolean("has_seen_onboarding", false)
        prefs.edit().clear().apply()
        prefs.edit().putBoolean("has_seen_onboarding", hasSeen).apply()
        if (!savedCodes.isNullOrBlank()) {
            prefs.edit().putString("saved_tracking_codes", savedCodes).apply()
        }
        if (!fcm.isNullOrBlank()) {
            prefs.edit().putString("fcm_token", fcm).apply()
        }
        if (!txs.isNullOrBlank()) {
            prefs.edit().putString("local_cached_transactions", txs).apply()
        }
    }

    suspend fun awaitIdentityResolved(timeoutMs: Long = 3000): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (!getSavedPatientId().isNullOrBlank() || !getSavedEmail().isNullOrBlank()) {
                return true
            }
            kotlinx.coroutines.delay(100)
        }
        return !getSavedPatientId().isNullOrBlank() || !getSavedEmail().isNullOrBlank()
    }
}
