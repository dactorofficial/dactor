package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Profile
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
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

            // Also explicitly trigger resend to ensure Supabase dispatches confirmation to Gmail
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
                // User already exists in Auth: dispatch confirmation email to their Gmail
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

    /**
     * Resends the confirmation link directly to the user's Gmail with mobile redirect.
     */
    suspend fun resendConfirmationLink(
        email: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
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

    /**
     * Handles incoming deep links (dactor://auth/callback) from Gmail confirmation clicks.
     */
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

    /**
     * Checks whether the user has confirmed their email address via the link sent to their Gmail.
     * Attempts to sign in. If it succeeds, the email has been confirmed.
     * If it fails with "Email not confirmed", returns NotConfirmed.
     */
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

    /**
     * Dispatches a 6-digit numeric OTP directly to the user's Gmail inbox.
     * Uses Supabase OTP provider so no confirmation link or email confirmation is needed.
     */
    suspend fun sendOtpToEmail(email: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val trimmedEmail = email.trim()
            supabaseClient.auth.signInWith(io.github.jan.supabase.gotrue.providers.builtin.OTP) {
                this.email = trimmedEmail
                this.createUser = true
            }
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                supabaseClient.auth.resendEmail(
                    type = io.github.jan.supabase.gotrue.OtpType.Email.SIGNUP,
                    email = email.trim()
                )
                Result.success(true)
            } catch (e2: Exception) {
                Result.failure(e)
            }
        }
    }

    /**
     * Verifies the 6-digit OTP code received in Gmail.
     * Optionally sets password so user can sign in via email+password later.
     */
    suspend fun verifyEmailOtp(email: String, token: String, passwordToSet: String? = null): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val trimmedEmail = email.trim()
            val trimmedToken = token.trim()

            var verified = false
            var lastError: Exception? = null

            // Primary: OtpType.Email.EMAIL (numeric token delivered to Gmail)
            try {
                supabaseClient.auth.verifyEmailOtp(
                    type = io.github.jan.supabase.gotrue.OtpType.Email.EMAIL,
                    email = trimmedEmail,
                    token = trimmedToken
                )
                verified = true
            } catch (e: Exception) {
                lastError = e
            }

            // Fallback: OtpType.Email.SIGNUP
            if (!verified) {
                try {
                    supabaseClient.auth.verifyEmailOtp(
                        type = io.github.jan.supabase.gotrue.OtpType.Email.SIGNUP,
                        email = trimmedEmail,
                        token = trimmedToken
                    )
                    verified = true
                } catch (e: Exception) {
                    lastError = e
                }
            }

            // Fallback: OtpType.Email.MAGIC_LINK
            if (!verified) {
                try {
                    supabaseClient.auth.verifyEmailOtp(
                        type = io.github.jan.supabase.gotrue.OtpType.Email.MAGIC_LINK,
                        email = trimmedEmail,
                        token = trimmedToken
                    )
                    verified = true
                } catch (e: Exception) {
                    lastError = e
                }
            }

            if (!verified) {
                return@withContext Result.failure(lastError ?: Exception("Invalid OTP code. Please check your Gmail."))
            }

            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun resendEmailOtp(email: String): Result<Boolean> = withContext(Dispatchers.IO) {
        sendOtpToEmail(email)
    }

    suspend fun signIn(email: String, password: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.auth.signInWith(Email) {
                this.email = email
                this.password = password
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
        return supabaseClient.auth.currentUserOrNull()?.id
    }

    fun getCurrentUserEmail(): String? {
        return supabaseClient.auth.currentUserOrNull()?.email
    }

    fun isLoggedIn(): Boolean {
        return getCurrentUser() != null
    }

    suspend fun getUserProfile(userId: String): Profile? = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["profiles"]
                .select {
                    filter {
                        eq("auth_uid", userId)
                    }
                }.decodeSingleOrNull<Profile>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun syncProfile(
        authUid: String,
        email: String,
        fullName: String,
        role: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val trimmedEmail = email.trim().lowercase()
            val existing = supabaseClient.postgrest["profiles"].select {
                filter {
                    eq("email", trimmedEmail)
                }
            }.decodeSingleOrNull<Profile>()

            if (existing != null) {
                supabaseClient.postgrest["profiles"].update({
                    set("role", role)
                    if (fullName.isNotBlank()) set("full_name", fullName.trim())
                }) {
                    filter {
                        eq("id", existing.id)
                    }
                }
            } else {
                val newId = java.util.UUID.randomUUID().toString()
                supabaseClient.postgrest["profiles"].insert(
                    mapOf(
                        "id" to newId,
                        "email" to trimmedEmail,
                        "full_name" to fullName.trim(),
                        "role" to role
                    )
                )
            }
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            // Return success anyway so login/portal is not blocked
            Result.success(true)
        }
    }

    suspend fun registerPatient(
        fullName: String,
        phone: String,
        gender: String,
        age: Int?,
        email: String? = null
    ): Result<Profile> = withContext(Dispatchers.IO) {
        val cleanPhone = phone.trim()
        val cleanEmail = email?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        val effectiveEmail = cleanEmail
            ?: "patient_${cleanPhone.takeLast(10)}_${System.currentTimeMillis() % 10000}@dactor.internal"

        // Check if a patient profile already exists for this email (e.g. signed in before or saved from an earlier appointment)
        val existingByEmail = if (cleanEmail != null) {
            try {
                supabaseClient.postgrest["profiles"]
                    .select { filter { ilike("email", cleanEmail) } }
                    .decodeList<Profile>()
                    .firstOrNull()
            } catch (e: Exception) {
                try {
                    supabaseClient.postgrest["profiles"]
                        .select { filter { eq("email", cleanEmail) } }
                        .decodeList<Profile>()
                        .firstOrNull()
                } catch (e2: Exception) {
                    null
                }
            }
        } else null

        val patientId = existingByEmail?.id ?: java.util.UUID.randomUUID().toString()

        val created = Profile(
            id = patientId,
            authUid = existingByEmail?.authUid,
            email = effectiveEmail,
            fullName = fullName.trim().ifBlank { existingByEmail?.fullName ?: "" },
            role = "patient",
            phone = cleanPhone.ifBlank { existingByEmail?.phone ?: "" },
            gender = gender.trim().ifBlank { existingByEmail?.gender ?: "Male" },
            age = age ?: existingByEmail?.age
        )

        if (existingByEmail != null) {
            try {
                supabaseClient.postgrest["profiles"].update({
                    if (fullName.isNotBlank()) set("full_name", fullName.trim())
                    if (cleanPhone.isNotBlank()) set("phone", cleanPhone)
                    if (gender.isNotBlank()) set("gender", gender.trim())
                    if (age != null) set("age", age)
                }) {
                    filter { eq("id", existingByEmail.id) }
                }
            } catch (ignored: Exception) {}
            Result.success(created)
        } else {
            try {
                val payload = buildJsonObject {
                    put("id", patientId)
                    put("email", effectiveEmail)
                    put("full_name", fullName.trim())
                    put("role", "patient")
                    put("phone", cleanPhone)
                    put("gender", gender.trim())
                    if (age != null) {
                        put("age", age)
                    }
                }
                supabaseClient.postgrest["profiles"].insert(payload)
                Result.success(created)
            } catch (e: Exception) {
                try {
                    val minimalPayload = buildJsonObject {
                        put("id", patientId)
                        put("email", effectiveEmail)
                        put("full_name", fullName.trim())
                        put("role", "patient")
                    }
                    supabaseClient.postgrest["profiles"].insert(minimalPayload)
                } catch (e2: Exception) {
                    e2.printStackTrace()
                }
                // Still return created profile so the directory appointment record can be saved
                Result.success(created)
            }
        }
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

    suspend fun getAllPatientProfiles(): List<Profile> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["profiles"]
                .select {
                    filter {
                        eq("role", "patient")
                        eq("is_archived", false)
                    }
                }.decodeList<Profile>()
        } catch (e: Exception) {
            try {
                supabaseClient.postgrest["profiles"]
                    .select {
                        filter {
                            eq("role", "patient")
                        }
                    }.decodeList<Profile>()
            } catch (err: Exception) {
                err.printStackTrace()
                emptyList()
            }
        }
    }
}

