package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.ClinicService
import com.dactor.clinic.data.model.MedicalSpecialty
import com.dactor.clinic.data.model.MedicalQualification
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
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
    val specialties: List<String> = emptyList(),
    val registration_doc_url: String? = null,
    val is_archived: Boolean? = false,
    val archived_at: String? = null,
    val deletion_scheduled_at: String? = null,
    val payment_gateway_provider: String? = "esewa",
    val payment_api_key: String? = null,
    val payment_secret_key: String? = null,
    val merchant_id: String? = null,
    val is_direct_payment_enabled: Boolean? = false,
    val payment_gateways_json: String? = null,
    val is_activated: Boolean? = true,
    val activation_expires_at: String? = null,
    val activation_plan: String? = "1_month",
    val activation_paid_amount: Double? = 0.0,
    val activation_notes: String? = null,
    val activation_payment_proof_url: String? = null,
    val avg_consultation_time_minutes: Int? = 10,
    val manual_avg_consultation_time_minutes: Int? = 10,
    val calculated_avg_consultation_time_minutes: Int? = null,
    val avg_time_mode: String? = "auto",
    val is_on_break: Boolean? = false,
    val break_updated_at: String? = null,
    val weekly_schedule_json: String? = null,
    val declared_holidays: List<String> = emptyList()
)

@Serializable
data class ClinicUpdateDto(
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
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("registration_doc_url") val registrationDocUrl: String? = null,
    @SerialName("pan_number") val panNumber: String? = null,
    @SerialName("manager_phone") val managerPhone: String? = null,
    @SerialName("pictures") val pictures: List<String> = emptyList(),
    @SerialName("specialties") val specialties: List<String> = emptyList(),
    @SerialName("is_archived") val isArchived: Boolean? = false,
    @SerialName("archived_at") val archivedAt: String? = null,
    @SerialName("deletion_scheduled_at") val deletionScheduledAt: String? = null,
    @SerialName("payment_gateway_provider") val paymentGatewayProvider: String? = "esewa",
    @SerialName("payment_api_key") val paymentApiKey: String? = null,
    @SerialName("payment_secret_key") val paymentSecretKey: String? = null,
    @SerialName("merchant_id") val merchantId: String? = null,
    @SerialName("is_direct_payment_enabled") val isDirectPaymentEnabled: Boolean? = false,
    @SerialName("is_activated") val isActivated: Boolean? = true,
    @SerialName("activation_expires_at") val activationExpiresAt: String? = null,
    @SerialName("activation_plan") val activationPlan: String? = "1_month",
    @SerialName("activation_paid_amount") val activationPaidAmount: Double? = 0.0,
    @SerialName("activation_notes") val activationNotes: String? = null,
    @SerialName("activation_payment_proof_url") val activationPaymentProofUrl: String? = null
)

@Serializable
data class ClinicBaseUpdateDto(
    @SerialName("name") val name: String,
    @SerialName("type") val type: String? = null,
    @SerialName("verification_status") val verificationStatus: String? = null,
    @SerialName("contact_phone") val contactPhone: String? = null,
    @SerialName("contact_email") val contactEmail: String? = null,
    @SerialName("address_text") val addressText: String? = null,
    @SerialName("latitude") val latitude: Double? = null,
    @SerialName("longitude") val longitude: Double? = null,
    @SerialName("auto_notify_threshold") val autoNotifyThreshold: Int? = null,
    @SerialName("description") val description: String? = null
)

@Singleton
class ClinicRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true; encodeDefaults = true }
    private val cachedClinicsById = java.util.concurrent.ConcurrentHashMap<String, Clinic>()

    fun getCachedClinicById(id: String): Clinic? = cachedClinicsById[id]

    fun clearCache() {
        cachedClinicsById.clear()
    }

    private fun enrichClinic(clinic: Clinic): Clinic {
        val descStr = clinic.description
        if (!descStr.isNullOrBlank() && descStr.trim().startsWith("{")) {
            try {
                val meta = json.decodeFromString<ClinicExtendedMeta>(descStr)
                val cleanDesc = if (!meta.desc.isNullOrBlank() && meta.desc.trim().startsWith("{")) {
                    try { json.decodeFromString<ClinicExtendedMeta>(meta.desc).desc ?: "" } catch (_: Exception) { meta.desc }
                } else {
                    meta.desc ?: ""
                }
                return clinic.copy(
                    description = cleanDesc,
                    panNumber = clinic.panNumber ?: meta.pan_number,
                    managerPhone = clinic.managerPhone ?: meta.manager_phone,
                    pictures = if (clinic.pictures.isNotEmpty()) clinic.pictures else meta.pictures,
                    specialties = if (clinic.specialties.isNotEmpty()) clinic.specialties else meta.specialties,
                    registrationDocUrl = clinic.registrationDocUrl ?: meta.registration_doc_url,
                    isArchived = meta.is_archived ?: clinic.isArchived,
                    archivedAt = clinic.archivedAt ?: meta.archived_at,
                    deletionScheduledAt = clinic.deletionScheduledAt ?: meta.deletion_scheduled_at,
                    paymentGatewayProvider = meta.payment_gateway_provider ?: clinic.paymentGatewayProvider,
                    paymentApiKey = meta.payment_api_key ?: clinic.paymentApiKey,
                    paymentSecretKey = meta.payment_secret_key ?: clinic.paymentSecretKey,
                    merchantId = meta.merchant_id ?: clinic.merchantId,
                    isDirectPaymentEnabled = meta.is_direct_payment_enabled ?: clinic.isDirectPaymentEnabled,
                    paymentGatewaysJson = clinic.paymentGatewaysJson ?: meta.payment_gateways_json,
                    isActivated = meta.is_activated ?: clinic.isActivated,
                    activationExpiresAt = clinic.activationExpiresAt ?: meta.activation_expires_at,
                    activationPlan = clinic.activationPlan ?: meta.activation_plan,
                    activationPaidAmount = clinic.activationPaidAmount ?: meta.activation_paid_amount,
                    activationNotes = clinic.activationNotes ?: meta.activation_notes,
                    activationPaymentProofUrl = clinic.activationPaymentProofUrl ?: meta.activation_payment_proof_url,
                    avgConsultationTimeMinutes = meta.avg_consultation_time_minutes ?: clinic.avgConsultationTimeMinutes ?: 10,
                    manualAvgConsultationTimeMinutes = meta.manual_avg_consultation_time_minutes ?: clinic.manualAvgConsultationTimeMinutes ?: 10,
                    calculatedAvgConsultationTimeMinutes = meta.calculated_avg_consultation_time_minutes ?: clinic.calculatedAvgConsultationTimeMinutes,
                    avgTimeMode = meta.avg_time_mode ?: clinic.avgTimeMode ?: "auto",
                    isOnBreak = meta.is_on_break ?: clinic.isOnBreak ?: false,
                    breakUpdatedAt = meta.break_updated_at ?: clinic.breakUpdatedAt,
                    weeklyScheduleJson = meta.weekly_schedule_json ?: clinic.weeklyScheduleJson,
                    declaredHolidays = meta.declared_holidays
                )
            } catch (ignored: Exception) {}
        }
        return clinic
    }

    private fun packClinicMetadata(clinic: Clinic): String {
        val rawDesc = clinic.description
        val cleanDesc = if (!rawDesc.isNullOrBlank() && rawDesc.trim().startsWith("{")) {
            try { json.decodeFromString<ClinicExtendedMeta>(rawDesc).desc } catch (_: Exception) { rawDesc }
        } else {
            rawDesc
        }
        val meta = ClinicExtendedMeta(
            desc = cleanDesc,
            pan_number = clinic.panNumber,
            manager_phone = clinic.managerPhone,
            pictures = clinic.pictures,
            specialties = clinic.specialties,
            registration_doc_url = clinic.registrationDocUrl,
            is_archived = clinic.isArchived,
            archived_at = clinic.archivedAt,
            deletion_scheduled_at = clinic.deletionScheduledAt,
            payment_gateway_provider = clinic.paymentGatewayProvider,
            payment_api_key = clinic.paymentApiKey,
            payment_secret_key = clinic.paymentSecretKey,
            merchant_id = clinic.merchantId,
            is_direct_payment_enabled = clinic.isDirectPaymentEnabled,
            payment_gateways_json = clinic.paymentGatewaysJson,
            is_activated = clinic.isActivated,
            activation_expires_at = clinic.activationExpiresAt,
            activation_plan = clinic.activationPlan,
            activation_paid_amount = clinic.activationPaidAmount,
            activation_notes = clinic.activationNotes,
            activation_payment_proof_url = clinic.activationPaymentProofUrl,
            avg_consultation_time_minutes = clinic.avgConsultationTimeMinutes ?: 10,
            manual_avg_consultation_time_minutes = clinic.manualAvgConsultationTimeMinutes ?: 10,
            calculated_avg_consultation_time_minutes = clinic.calculatedAvgConsultationTimeMinutes,
            avg_time_mode = clinic.avgTimeMode ?: "auto",
            is_on_break = clinic.isOnBreak ?: false,
            break_updated_at = clinic.breakUpdatedAt,
            weekly_schedule_json = clinic.weeklyScheduleJson,
            declared_holidays = clinic.declaredHolidays
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
            val enriched = clinic?.let { enrichClinic(it) }
            if (enriched != null) {
                cachedClinicsById[enriched.id] = enriched
            }
            enriched
        } catch (e: Exception) {
            e.printStackTrace()
            cachedClinicsById[id]
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
            val enriched = clinic?.let { enrichClinic(it) }
            if (enriched != null) {
                cachedClinicsById[enriched.id] = enriched
            }
            enriched
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
            val enrichedList = list.map { enrichClinic(it) }
            enrichedList.forEach { cachedClinicsById[it.id] = it }
            enrichedList
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun createClinic(clinic: Clinic): Clinic? = withContext(Dispatchers.IO) {
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
                cachedClinicsById[clinic.id] = clinic
                return@withContext clinic
            }
        } catch (e2: Exception) {
            e2.printStackTrace()
        }
        null
    }

    suspend fun updateClinic(id: String, clinic: Clinic): Boolean = withContext(Dispatchers.IO) {
        val metaJson = packClinicMetadata(clinic)
        cachedClinicsById[id] = clinic
        val dto = ClinicUpdateDto(
            name = clinic.name,
            type = clinic.type ?: "multi_visit",
            verificationStatus = clinic.verificationStatus ?: "pending",
            contactPhone = clinic.contactPhone,
            contactEmail = clinic.contactEmail?.trim()?.lowercase(),
            addressText = clinic.addressText,
            latitude = clinic.latitude ?: 27.7052,
            longitude = clinic.longitude ?: 85.3193,
            autoNotifyThreshold = clinic.autoNotifyThreshold ?: 2,
            description = metaJson,
            logoUrl = clinic.logoUrl,
            registrationDocUrl = clinic.registrationDocUrl,
            panNumber = clinic.panNumber,
            managerPhone = clinic.managerPhone,
            pictures = clinic.pictures,
            specialties = clinic.specialties,
            isArchived = clinic.isArchived ?: false,
            archivedAt = clinic.archivedAt,
            deletionScheduledAt = clinic.deletionScheduledAt,
            paymentGatewayProvider = clinic.paymentGatewayProvider ?: "esewa",
            paymentApiKey = clinic.paymentApiKey,
            paymentSecretKey = clinic.paymentSecretKey,
            merchantId = clinic.merchantId,
            isDirectPaymentEnabled = clinic.isDirectPaymentEnabled ?: false,
            isActivated = clinic.isActivated ?: true,
            activationExpiresAt = clinic.activationExpiresAt,
            activationPlan = clinic.activationPlan,
            activationPaidAmount = clinic.activationPaidAmount,
            activationNotes = clinic.activationNotes,
            activationPaymentProofUrl = clinic.activationPaymentProofUrl
        )

        try {
            supabaseClient.postgrest["clinics"].update(dto) {
                filter { eq("id", id) }
            }
            return@withContext true
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                val baseDto = ClinicBaseUpdateDto(
                    name = clinic.name,
                    type = clinic.type ?: "multi_visit",
                    verificationStatus = clinic.verificationStatus ?: "pending",
                    contactPhone = clinic.contactPhone,
                    contactEmail = clinic.contactEmail?.trim()?.lowercase(),
                    addressText = clinic.addressText,
                    latitude = clinic.latitude ?: 27.7052,
                    longitude = clinic.longitude ?: 85.3193,
                    autoNotifyThreshold = clinic.autoNotifyThreshold ?: 2,
                    description = metaJson
                )
                supabaseClient.postgrest["clinics"].update(baseDto) {
                    filter { eq("id", id) }
                }
                return@withContext true
            } catch (e2: Exception) {
                e2.printStackTrace()
                return@withContext false
            }
        }
    }

    suspend fun toggleClinicBreak(clinicId: String, isOnBreak: Boolean): Clinic? = withContext(Dispatchers.IO) {
        val current = getCachedClinicById(clinicId) ?: getClinicById(clinicId) ?: return@withContext null
        val updated = current.copy(
            isOnBreak = isOnBreak,
            breakUpdatedAt = Instant.now().toString()
        )
        cachedClinicsById[clinicId] = updated
        val ok = updateClinic(clinicId, updated)
        if (ok) updated else null
    }

    suspend fun saveWeeklySchedule(
        clinicId: String,
        days: List<com.dactor.clinic.data.model.DayScheduleInfo>,
        isOnBreak: Boolean? = null
    ): Clinic? = withContext(Dispatchers.IO) {
        val current = getCachedClinicById(clinicId) ?: getClinicById(clinicId) ?: return@withContext null
        val scheduleJson = com.dactor.clinic.data.model.ClinicScheduleHelper.encodeWeeklySchedule(days)
        val updated = current.copy(
            weeklyScheduleJson = scheduleJson,
            isOnBreak = isOnBreak ?: current.isOnBreak,
            breakUpdatedAt = if (isOnBreak != null) Instant.now().toString() else current.breakUpdatedAt
        )
        cachedClinicsById[clinicId] = updated
        val ok = updateClinic(clinicId, updated)
        if (ok) updated else null
    }

    suspend fun toggleClinicHoliday(clinicId: String, dateStr: String, isHoliday: Boolean): Clinic? = withContext(Dispatchers.IO) {
        val current = getCachedClinicById(clinicId) ?: getClinicById(clinicId) ?: return@withContext null
        val cleanDate = dateStr.trim()
        val updatedSet = current.declaredHolidays.map { it.trim() }.toMutableSet()
        if (isHoliday) {
            updatedSet.add(cleanDate)
        } else {
            updatedSet.remove(cleanDate)
        }
        val updated = current.copy(declaredHolidays = updatedSet.sorted())
        cachedClinicsById[clinicId] = updated
        val ok = updateClinic(clinicId, updated)
        if (ok) updated else null
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

    suspend fun updatePaymentGatewayKeys(
        clinicId: String,
        gatewayProvider: String,
        apiKey: String,
        secretKey: String?,
        merchantId: String?,
        isDirectPaymentEnabled: Boolean
    ): Result<Boolean> = updatePaymentApiKeys(clinicId, gatewayProvider, apiKey, secretKey, merchantId, isDirectPaymentEnabled)

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

    suspend fun uploadClinicFile(fileName: String, fileBytes: ByteArray, bucketName: String = "clinic_photos"): String? = withContext(Dispatchers.IO) {
        try {
            val compressed = com.dactor.clinic.domain.util.FileCompressor.compressBytes(fileBytes, fileName)
            val finalName = compressed.fileName
            val bucket = supabaseClient.storage[bucketName]
            bucket.upload(finalName, compressed.bytes, upsert = true)
            bucket.publicUrl(finalName)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getSpecialties(): List<MedicalSpecialty> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["medical_specialties"]
                .select {
                    filter {
                        eq("is_active", true)
                    }
                }
                .decodeList<MedicalSpecialty>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getQualifications(): List<MedicalQualification> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["medical_qualifications"]
                .select {
                    filter {
                        eq("is_active", true)
                    }
                }
                .decodeList<MedicalQualification>()
                .filter { it.level != "LOCATION_OPTION" && it.level != "PLATFORM_PAYMENT_CONFIG" }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    /**
     * Fetches the Admin's platform payment gateway APIs/keys from Supabase (`medical_qualifications` where level = 'PLATFORM_PAYMENT_CONFIG')
     * so clinics can pay the admin directly for clinic activation & subscription renewals.
     */
    suspend fun getPlatformPaymentConfig(): com.dactor.clinic.data.model.PaymentGatewaysConfig = withContext(Dispatchers.IO) {
        try {
            val rows = supabaseClient.postgrest["medical_qualifications"]
                .select {
                    filter {
                        eq("level", "PLATFORM_PAYMENT_CONFIG")
                    }
                }
                .decodeList<MedicalQualification>()
            val configRow = rows.firstOrNull { it.degreeName == "ADMIN_PAYMENT_GATEWAYS" } ?: rows.firstOrNull()
            if (configRow != null && !configRow.description.isNullOrBlank()) {
                return@withContext com.dactor.clinic.data.model.PaymentGatewaysConfig.parse(configRow.description)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        com.dactor.clinic.data.model.PaymentGatewaysConfig()
    }

    /**
     * Completes a clinic-to-admin subscription payment (via real gateway or testing bypass)
     * and immediately activates / extends the clinic's subscription in Supabase.
     */
    suspend fun completeClinicSubscriptionPayment(
        clinicId: String,
        daysToAdd: Int,
        planName: String,
        paidAmount: Double,
        transactionId: String,
        gateway: String
    ): Result<Clinic> = withContext(Dispatchers.IO) {
        try {
            val current = getClinicById(clinicId) ?: return@withContext Result.failure(Exception("Clinic not found"))
            val baseInstant = try {
                val existingExp = current.activationExpiresAt
                if (!existingExp.isNullOrBlank()) {
                    val parsed = Instant.parse(existingExp)
                    if (parsed.isAfter(Instant.now())) parsed else Instant.now()
                } else {
                    Instant.now()
                }
            } catch (_: Exception) {
                Instant.now()
            }
            val newExpiryIso = baseInstant.plus(daysToAdd.toLong(), ChronoUnit.DAYS).toString()
            val noteSummary = "Paid NPR ${paidAmount.toInt()} via ${gateway.uppercase()} • Txn #$transactionId • ${Instant.now()}"
            val updated = current.copy(
                isActivated = true,
                activationExpiresAt = newExpiryIso,
                activationPlan = planName,
                activationPaidAmount = paidAmount,
                activationNotes = noteSummary
            )
            val saved = updateClinic(clinicId, updated)
            if (saved) {
                cachedClinicsById[clinicId] = updated
                Result.success(updated)
            } else {
                Result.failure(Exception("Failed to save clinic subscription activation to Supabase"))
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure(e)
        }
    }
}
