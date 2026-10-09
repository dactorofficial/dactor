package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.ClinicService
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class ClinicBaseDto(
    @SerialName("id") val id: String,
    @SerialName("name") val name: String,
    @SerialName("type") val type: String? = null,
    @SerialName("verification_status") val verificationStatus: String? = null,
    @SerialName("contact_phone") val contactPhone: String? = null,
    @SerialName("contact_email") val contactEmail: String? = null,
    @SerialName("address_text") val addressText: String? = null,
    @SerialName("latitude") val latitude: Double? = null,
    @SerialName("longitude") val longitude: Double? = null,
    @SerialName("auto_notify_threshold") val autoNotifyThreshold: Int? = null,
    @SerialName("description") val description: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null
)

@Serializable
data class ClinicExtendedMeta(
    val desc: String? = null,
    val pan_number: String? = null,
    val manager_phone: String? = null,
    val pictures: List<String> = emptyList(),
    val registration_doc_url: String? = null,
    val is_archived: Boolean? = false,
    val archived_at: String? = null,
    val deletion_scheduled_at: String? = null,
    val payment_gateway_provider: String? = "esewa",
    val payment_api_key: String? = null,
    val payment_secret_key: String? = null,
    val merchant_id: String? = null,
    val is_direct_payment_enabled: Boolean? = false,
    val is_activated: Boolean? = true,
    val activation_expires_at: String? = null,
    val activation_plan: String? = "1_month",
    val activation_paid_amount: Double? = 0.0,
    val activation_notes: String? = null,
    val activation_payment_proof_url: String? = null
)

@Singleton
class ClinicRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true; encodeDefaults = true }

    private fun enrichClinic(clinic: Clinic): Clinic {
        val descStr = clinic.description
        if (!descStr.isNullOrBlank() && descStr.trim().startsWith("{")) {
            try {
                val meta = json.decodeFromString<ClinicExtendedMeta>(descStr)
                return clinic.copy(
                    description = meta.desc ?: descStr,
                    panNumber = clinic.panNumber ?: meta.pan_number,
                    managerPhone = clinic.managerPhone ?: meta.manager_phone,
                    pictures = if (clinic.pictures.isNotEmpty()) clinic.pictures else meta.pictures,
                    registrationDocUrl = clinic.registrationDocUrl ?: meta.registration_doc_url,
                    isArchived = clinic.isArchived ?: meta.is_archived,
                    archivedAt = clinic.archivedAt ?: meta.archived_at,
                    deletionScheduledAt = clinic.deletionScheduledAt ?: meta.deletion_scheduled_at,
                    paymentGatewayProvider = clinic.paymentGatewayProvider ?: meta.payment_gateway_provider,
                    paymentApiKey = clinic.paymentApiKey ?: meta.payment_api_key,
                    paymentSecretKey = clinic.paymentSecretKey ?: meta.payment_secret_key,
                    merchantId = clinic.merchantId ?: meta.merchant_id,
                    isDirectPaymentEnabled = clinic.isDirectPaymentEnabled ?: meta.is_direct_payment_enabled,
                    isActivated = clinic.isActivated ?: meta.is_activated,
                    activationExpiresAt = clinic.activationExpiresAt ?: meta.activation_expires_at,
                    activationPlan = clinic.activationPlan ?: meta.activation_plan,
                    activationPaidAmount = clinic.activationPaidAmount ?: meta.activation_paid_amount,
                    activationNotes = clinic.activationNotes ?: meta.activation_notes,
                    activationPaymentProofUrl = clinic.activationPaymentProofUrl ?: meta.activation_payment_proof_url
                )
            } catch (ignored: Exception) {}
        }
        return clinic
    }

    private fun packClinicMetadata(clinic: Clinic): String {
        val meta = ClinicExtendedMeta(
            desc = clinic.description,
            pan_number = clinic.panNumber,
            manager_phone = clinic.managerPhone,
            pictures = clinic.pictures,
            registration_doc_url = clinic.registrationDocUrl,
            is_archived = clinic.isArchived,
            archived_at = clinic.archivedAt,
            deletion_scheduled_at = clinic.deletionScheduledAt,
            payment_gateway_provider = clinic.paymentGatewayProvider,
            payment_api_key = clinic.paymentApiKey,
            payment_secret_key = clinic.paymentSecretKey,
            merchant_id = clinic.merchantId,
            is_direct_payment_enabled = clinic.isDirectPaymentEnabled,
            is_activated = clinic.isActivated,
            activation_expires_at = clinic.activationExpiresAt,
            activation_plan = clinic.activationPlan,
            activation_paid_amount = clinic.activationPaidAmount,
            activation_notes = clinic.activationNotes,
            activation_payment_proof_url = clinic.activationPaymentProofUrl
        )
        return json.encodeToString(ClinicExtendedMeta.serializer(), meta)
    }

    suspend fun getClinicById(id: String): Clinic? = withContext(Dispatchers.IO) {
        try {
            val clinic = supabaseClient.postgrest["clinics"]
                .select {
                    filter {
                        eq("id", id)
                    }
                }.decodeSingleOrNull<Clinic>()
            clinic?.let { enrichClinic(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getClinicByEmail(email: String): Clinic? = withContext(Dispatchers.IO) {
        try {
            val targetEmail = email.trim().lowercase()
            val clinic = supabaseClient.postgrest["clinics"]
                .select {
                    filter {
                        ilike("contact_email", targetEmail)
                    }
                }.decodeSingleOrNull<Clinic>()
            clinic?.let { enrichClinic(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getClinics(): List<Clinic> = withContext(Dispatchers.IO) {
        try {
            val list = supabaseClient.postgrest["clinics"]
                .select()
                .decodeList<Clinic>()
            list.map { enrichClinic(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun createClinic(clinic: Clinic): Clinic? = withContext(Dispatchers.IO) {
        // Attempt 1: Full insert (if all columns exist in database)
        try {
            val inserted = supabaseClient.postgrest["clinics"]
                .insert(clinic) {
                    select()
                }.decodeSingleOrNull<Clinic>()
            if (inserted != null) return@withContext enrichClinic(inserted)
        } catch (e: Exception) {
            // Log notice and try fallback
            println("Full clinic insert failed, attempting fallback with metadata packing: ${e.message}")
        }

        // Attempt 2: Base schema insert packing extended fields in description JSON
        try {
            val metaJson = packClinicMetadata(clinic)
            val baseDto = ClinicBaseDto(
                id = clinic.id,
                name = clinic.name,
                type = clinic.type,
                verificationStatus = clinic.verificationStatus,
                contactPhone = clinic.contactPhone,
                contactEmail = clinic.contactEmail?.trim()?.lowercase(),
                addressText = clinic.addressText,
                latitude = clinic.latitude,
                longitude = clinic.longitude,
                autoNotifyThreshold = clinic.autoNotifyThreshold ?: 2,
                description = metaJson,
                logoUrl = clinic.logoUrl
            )
            val insertedBase = supabaseClient.postgrest["clinics"]
                .insert(baseDto) {
                    select()
                }.decodeSingleOrNull<ClinicBaseDto>()

            if (insertedBase != null) {
                return@withContext clinic
            }
        } catch (e2: Exception) {
            e2.printStackTrace()
        }
        null
    }

    suspend fun updateClinic(id: String, clinic: Clinic): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinics"]
                .update(clinic) {
                    filter {
                        eq("id", id)
                    }
                }
            return@withContext true
        } catch (e: Exception) {
            // Fallback: update base columns with packed metadata
            try {
                val metaJson = packClinicMetadata(clinic)
                val baseMap = mapOf(
                    "name" to clinic.name,
                    "type" to (clinic.type ?: "single_visit"),
                    "verification_status" to (clinic.verificationStatus ?: "pending"),
                    "contact_phone" to (clinic.contactPhone ?: ""),
                    "contact_email" to (clinic.contactEmail?.trim()?.lowercase() ?: ""),
                    "address_text" to (clinic.addressText ?: ""),
                    "latitude" to (clinic.latitude ?: 27.7172),
                    "longitude" to (clinic.longitude ?: 85.3240),
                    "description" to metaJson
                )
                supabaseClient.postgrest["clinics"].update(baseMap) {
                    filter { eq("id", id) }
                }
                return@withContext true
            } catch (e2: Exception) {
                e2.printStackTrace()
                return@withContext false
            }
        }
    }

    suspend fun updateClinicType(id: String, newType: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinics"]
                .update(mapOf("type" to newType)) {
                    filter {
                        eq("id", id)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getClinicServices(clinicId: String): List<ClinicService> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinic_services"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<ClinicService>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun addService(service: ClinicService): ClinicService? = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinic_services"]
                .insert(service) {
                    select()
                }.decodeSingleOrNull<ClinicService>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun deleteService(id: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinic_services"]
                .delete {
                    filter {
                        eq("id", id)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun scheduleClinicDeletion(clinicId: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val nowInstant = Instant.now()
            val scheduledInstant = nowInstant.plus(30, ChronoUnit.DAYS)
            val deletionScheduledAt = scheduledInstant.toString()
            val archivedAt = nowInstant.toString()

            val current = getClinicById(clinicId)
            if (current != null) {
                val updated = current.copy(
                    isArchived = true,
                    archivedAt = archivedAt,
                    deletionScheduledAt = deletionScheduledAt
                )
                updateClinic(clinicId, updated)
            } else {
                val updateMap = mapOf(
                    "is_archived" to true,
                    "archived_at" to archivedAt,
                    "deletion_scheduled_at" to deletionScheduledAt,
                    "updated_at" to archivedAt
                )
                supabaseClient.postgrest["clinics"].update(updateMap) {
                    filter { eq("id", clinicId) }
                }
            }
            Result.success(deletionScheduledAt)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun cancelClinicDeletion(clinicId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val current = getClinicById(clinicId)
            if (current != null) {
                val updated = current.copy(
                    isArchived = false,
                    archivedAt = null,
                    deletionScheduledAt = null
                )
                updateClinic(clinicId, updated)
            } else {
                supabaseClient.postgrest["clinics"].update({
                    set("is_archived", false)
                    set<String?>("archived_at", null)
                    set<String?>("deletion_scheduled_at", null)
                    set("updated_at", Instant.now().toString())
                }) {
                    filter { eq("id", clinicId) }
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun purgeExceededArchivedClinicData(clinicId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            try {
                supabaseClient.postgrest["queue_entries"].delete { filter { eq("clinic_id", clinicId) } }
            } catch (ignored: Exception) {}

            try {
                supabaseClient.postgrest["lab_reports"].delete { filter { eq("clinic_id", clinicId) } }
            } catch (ignored: Exception) {}

            try {
                supabaseClient.postgrest["billing_invoices"].delete { filter { eq("clinic_id", clinicId) } }
            } catch (ignored: Exception) {}

            try {
                supabaseClient.postgrest["appointments"].delete { filter { eq("clinic_id", clinicId) } }
            } catch (ignored: Exception) {}

            try {
                supabaseClient.postgrest["slots"].delete { filter { eq("clinic_id", clinicId) } }
            } catch (ignored: Exception) {}

            try {
                supabaseClient.postgrest["clinic_services"].delete { filter { eq("clinic_id", clinicId) } }
            } catch (ignored: Exception) {}

            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun updatePaymentApiKeys(
        clinicId: String,
        gatewayProvider: String,
        apiKey: String,
        secretKey: String?,
        merchantId: String?,
        isDirectPaymentEnabled: Boolean
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val current = getClinicById(clinicId)
            if (current != null) {
                val updated = current.copy(
                    paymentGatewayProvider = gatewayProvider,
                    paymentApiKey = apiKey.trim(),
                    paymentSecretKey = secretKey?.trim(),
                    merchantId = merchantId?.trim(),
                    isDirectPaymentEnabled = isDirectPaymentEnabled
                )
                updateClinic(clinicId, updated)
            } else {
                val updateMap = mutableMapOf<String, Any>(
                    "payment_gateway_provider" to gatewayProvider,
                    "payment_api_key" to apiKey.trim(),
                    "is_direct_payment_enabled" to isDirectPaymentEnabled,
                    "updated_at" to Instant.now().toString()
                )
                if (!secretKey.isNullOrBlank()) updateMap["payment_secret_key"] = secretKey.trim()
                if (!merchantId.isNullOrBlank()) updateMap["merchant_id"] = merchantId.trim()

                supabaseClient.postgrest["clinics"].update(updateMap) {
                    filter { eq("id", clinicId) }
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }

    suspend fun requestActivationRenewal(
        clinicId: String,
        plan: String,
        amount: Double,
        notes: String
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val current = getClinicById(clinicId)
            if (current != null) {
                val updated = current.copy(
                    activationPlan = plan,
                    activationPaidAmount = amount,
                    activationNotes = notes.trim()
                )
                updateClinic(clinicId, updated)
            } else {
                val updateMap = mapOf(
                    "activation_plan" to plan,
                    "activation_paid_amount" to amount,
                    "activation_notes" to notes.trim(),
                    "updated_at" to Instant.now().toString()
                )
                supabaseClient.postgrest["clinics"].update(updateMap) {
                    filter { eq("id", clinicId) }
                }
            }
            Result.success(true)
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }
}
