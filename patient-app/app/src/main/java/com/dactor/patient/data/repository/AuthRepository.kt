package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Profile
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    sealed class SignUpResult {
        data class NeedsEmailConfirmation(val email: String) : SignUpResult()
        data class AlreadyConfirmed(val userId: String) : SignUpResult()
        data class Failure(val exception: Throwable) : SignUpResult()
    }

    sealed class EmailConfirmationResult {
        data class Confirmed(val userId: String) : EmailConfirmationResult()
        object NotConfirmed : EmailConfirmationResult()
        data class Error(val message: String) : EmailConfirmationResult()
    }

    suspend fun signUp(
        email: String,
        password: String,
        redirectUrl: String = "dactor://auth/callback"
    ): SignUpResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        val trimmedPassword = password.trim()
        try {
            supabaseClient.auth.signUpWith(Email, redirectUrl = redirectUrl) {
                this.email = trimmedEmail
                this.password = trimmedPassword
            }

            try {
                supabaseClient.auth.resendEmail(
                    type = io.github.jan.supabase.gotrue.OtpType.Email.SIGNUP,
                    email = trimmedEmail
                )
            } catch (ignored: Exception) {}

            SignUpResult.NeedsEmailConfirmation(trimmedEmail)
        } catch (e: Exception) {
            e.printStackTrace()
            val msg = e.message ?: ""
            if (msg.contains("already registered", ignoreCase = true) || msg.contains("User already exists", ignoreCase = true)) {
                try {
                    supabaseClient.auth.resendEmail(
                        type = io.github.jan.supabase.gotrue.OtpType.Email.SIGNUP,
                        email = trimmedEmail
                    )
                } catch (ignored: Exception) {}
                SignUpResult.NeedsEmailConfirmation(trimmedEmail)
            } else {
                SignUpResult.Failure(e)
            }
        }
    }

    suspend fun checkEmailConfirmed(email: String, password: String): EmailConfirmationResult = withContext(Dispatchers.IO) {
        try {
            val signInResult = signIn(email.trim(), password.trim())
            if (signInResult.isSuccess) {
                EmailConfirmationResult.Confirmed(signInResult.getOrNull() ?: "")
            } else {
                val ex = signInResult.exceptionOrNull()
                val msg = ex?.message ?: ""
                if (msg.contains("not confirmed", ignoreCase = true) ||
                    msg.contains("email_not_confirmed", ignoreCase = true) ||
                    msg.contains("confirmation", ignoreCase = true)) {
                    EmailConfirmationResult.NotConfirmed
                } else {
                    EmailConfirmationResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            val msg = e.message ?: ""
            if (msg.contains("not confirmed", ignoreCase = true) ||
                msg.contains("email_not_confirmed", ignoreCase = true) ||
                msg.contains("confirmation", ignoreCase = true)) {
                EmailConfirmationResult.NotConfirmed
            } else {
                EmailConfirmationResult.Error(msg)
            }
        }
    }

    suspend fun resendConfirmationLink(email: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.auth.resendEmail(
                type = io.github.jan.supabase.gotrue.OtpType.Email.SIGNUP,
                email = email.trim()
            )
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun syncPatientProfile(
        userId: String,
        email: String,
        fullName: String,
        phone: String = "",
        gender: String? = null,
        age: Int? = null
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val trimmedEmail = email.trim().lowercase()
            val existing = try {
                supabaseClient.postgrest["profiles"].select {
                    filter {
                        ilike("email", trimmedEmail)
                    }
                }.decodeList<Profile>().firstOrNull()
            } catch (e: Exception) {
                supabaseClient.postgrest["profiles"].select {
                    filter {
                        eq("email", trimmedEmail)
                    }
                }.decodeList<Profile>().firstOrNull()
            }

            // Check if there are any pre-existing appointments saved with this email before sign-in
            val emailAppts = if (trimmedEmail.isNotBlank()) {
                try {
                    supabaseClient.postgrest["appointments"].select {
                        filter {
                            ilike("patient_email", trimmedEmail)
                        }
                    }.decodeList<com.dactor.patient.data.model.Appointment>()
                } catch (e: Exception) {
                    emptyList()
                }
            } else emptyList()

            val latestEmailAppt = emailAppts.maxByOrNull { it.appointmentDate }
            val effectiveName = fullName.trim().ifBlank {
                existing?.fullName?.trim().orEmpty().ifBlank { latestEmailAppt?.patientName?.trim().orEmpty() }
            }
            val effectivePhone = phone.trim().ifBlank {
                existing?.phone?.trim().orEmpty().ifBlank { latestEmailAppt?.patientMobile?.trim().orEmpty() }
            }
            val effectiveGender = gender?.trim()?.ifBlank { null }
                ?: existing?.gender?.ifBlank { null }
                ?: latestEmailAppt?.patientGender
            val effectiveAge = age?.takeIf { it > 0 }
                ?: existing?.age
                ?: latestEmailAppt?.patientAge

            val profileId = existing?.id
                ?: emailAppts.firstNotNullOfOrNull { it.userId?.takeIf { uid -> uid.isNotBlank() } }
                ?: userId.takeIf { it.isNotBlank() }
                ?: java.util.UUID.randomUUID().toString()

            if (existing != null) {
                supabaseClient.postgrest["profiles"].update({
                    set("role", "patient")
                    set("email", trimmedEmail)
                    if (effectiveName.isNotBlank()) set("full_name", effectiveName)
                    if (effectivePhone.isNotBlank()) set("phone", effectivePhone)
                    if (!effectiveGender.isNullOrBlank()) set("gender", effectiveGender)
                    if (effectiveAge != null && effectiveAge > 0) set("age", effectiveAge)
                }) {
                    filter {
                        eq("id", existing.id)
                    }
                }
            } else {
                val insertMap = mutableMapOf<String, Any>(
                    "id" to profileId,
                    "email" to trimmedEmail,
                    "full_name" to effectiveName,
                    "role" to "patient",
                    "phone" to effectivePhone
                )
                if (!effectiveGender.isNullOrBlank()) insertMap["gender"] = effectiveGender
                if (effectiveAge != null && effectiveAge > 0) insertMap["age"] = effectiveAge
                try {
                    supabaseClient.postgrest["profiles"].insert(insertMap)
                } catch (e: Exception) {
                    supabaseClient.postgrest["profiles"].insert(
                        mapOf(
                            "id" to profileId,
                            "email" to trimmedEmail,
                            "full_name" to effectiveName,
                            "role" to "patient",
                            "phone" to effectivePhone
                        )
                    )
                }
            }

            // Retroactively sync any past or live walk-in/guest appointments matching email or phone
            try {
                if (effectivePhone.isNotBlank()) {
                    supabaseClient.postgrest["appointments"].update(
                        mapOf("user_id" to profileId)
                    ) {
                        filter {
                            eq("patient_mobile", effectivePhone)
                        }
                    }
                }
                if (trimmedEmail.isNotBlank()) {
                    supabaseClient.postgrest["appointments"].update(
                        mapOf("user_id" to profileId, "patient_email" to trimmedEmail)
                    ) {
                        filter {
                            ilike("patient_email", trimmedEmail)
                        }
                    }
                }
            } catch (re: Exception) {
                re.printStackTrace()
            }

            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            // Always return success so patient navigation proceeds
            Result.success(true)
        }
    }

    suspend fun createPatientProfile(
        userId: String,
        email: String,
        fullName: String,
        phone: String,
        gender: String? = null,
        age: Int? = null
    ): Result<Boolean> = syncPatientProfile(userId, email, fullName, phone, gender, age)

    suspend fun handleAuthCallback(uri: android.net.Uri): Boolean = withContext(Dispatchers.IO) {
        try {
            val fragment = uri.fragment
            val code = uri.getQueryParameter("code")
            if (!code.isNullOrBlank()) {
                supabaseClient.auth.exchangeCodeForSession(code = code, saveSession = true)
                return@withContext true
            } else if (!fragment.isNullOrBlank()) {
                val params = fragment.split("&").associate {
                    val parts = it.split("=")
                    if (parts.size == 2) parts[0] to parts[1] else parts[0] to ""
                }
                val accessToken = params["access_token"]
                val refreshToken = params["refresh_token"]
                if (!accessToken.isNullOrBlank() && !refreshToken.isNullOrBlank()) {
                    supabaseClient.auth.importAuthToken(accessToken = accessToken, refreshToken = refreshToken, autoRefresh = true)
                    return@withContext true
                }
            }
            false
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun signIn(email: String, password: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.auth.signInWith(Email) {
                this.email = email.trim()
                this.password = password.trim()
            }
            val userId = supabaseClient.auth.currentUserOrNull()?.id ?: ""
            Result.success(userId)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        try {
            supabaseClient.auth.signOut()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getCurrentUser(): String? {
        val firebaseUid = try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid } catch (e: Exception) { null }
        if (!firebaseUid.isNullOrBlank()) return firebaseUid
        return supabaseClient.auth.currentUserOrNull()?.id
    }

    fun getCurrentUserEmail(): String? {
        val firebaseEmail = try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email } catch (e: Exception) { null }
        if (!firebaseEmail.isNullOrBlank()) return firebaseEmail
        return supabaseClient.auth.currentUserOrNull()?.email
    }

    fun isLoggedIn(): Boolean {
        val firebaseUser = try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser } catch (e: Exception) { null }
        if (firebaseUser != null) return true
        return getCurrentUser() != null
    }

    suspend fun getCurrentProfile(): Profile? = withContext(Dispatchers.IO) {
        val email = getCurrentUserEmail() ?: return@withContext null
        getProfileByEmail(email)
    }

    suspend fun getProfileByEmail(email: String): Profile? = withContext(Dispatchers.IO) {
        val cleanEmail = email.trim().lowercase()
        if (cleanEmail.isBlank()) return@withContext null
        try {
            supabaseClient.postgrest["profiles"]
                .select {
                    filter {
                        ilike("email", cleanEmail)
                    }
                }.decodeList<Profile>().firstOrNull()
        } catch (e: Exception) {
            try {
                supabaseClient.postgrest["profiles"]
                    .select {
                        filter {
                            eq("email", cleanEmail)
                        }
                    }.decodeList<Profile>().firstOrNull()
            } catch (e2: Exception) {
                e2.printStackTrace()
                null
            }
        }
    }

    suspend fun getProfileById(userId: String): Profile? = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["profiles"]
                .select {
                    filter {
                        or {
                            eq("id", userId)
                            eq("auth_uid", userId)
                        }
                    }
                }.decodeSingleOrNull<Profile>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun updatePatientProfileDetails(
        userId: String,
        fullName: String,
        phone: String,
        gender: String?,
        age: Int?
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val updateMap = mutableMapOf<String, Any>(
                "full_name" to fullName.trim(),
                "phone" to phone.trim(),
                "updated_at" to Instant.now().toString()
            )
            if (!gender.isNullOrBlank()) updateMap["gender"] = gender
            if (age != null && age > 0) updateMap["age"] = age

            supabaseClient.postgrest["profiles"].update(updateMap) {
                filter {
                    or {
                        eq("id", userId)
                        eq("auth_uid", userId)
                    }
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun scheduleAccountDeletion(
        userId: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val nowInstant = Instant.now()
            val scheduledInstant = nowInstant.plus(30, ChronoUnit.DAYS)
            val deletionScheduledAt = scheduledInstant.toString()
            val archivedAt = nowInstant.toString()

            val updateMap = mapOf(
                "is_archived" to true,
                "archived_at" to archivedAt,
                "deletion_scheduled_at" to deletionScheduledAt,
                "updated_at" to archivedAt
            )

            // CRITICAL: We DO NOT delete any appointments, clinic records, invoices, or lab reports in Supabase.
            // All historical appointments and clinic data remain securely preserved.
            supabaseClient.postgrest["profiles"].update(updateMap) {
                filter {
                    or {
                        eq("id", userId)
                        eq("auth_uid", userId)
                    }
                }
            }
            Result.success(deletionScheduledAt)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun cancelAccountDeletion(
        userId: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["profiles"].update({
                set("is_archived", false)
                set<String?>("archived_at", null)
                set<String?>("deletion_scheduled_at", null)
                set("updated_at", Instant.now().toString())
            }) {
                filter {
                    or {
                        eq("id", userId)
                        eq("auth_uid", userId)
                    }
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }
}
