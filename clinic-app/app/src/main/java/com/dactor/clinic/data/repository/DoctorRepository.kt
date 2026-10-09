package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.ClinicInvitation
import com.dactor.clinic.data.model.Doctor
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class DoctorBaseDto(
    @SerialName("id") val id: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("clinic_id") val clinicId: String? = null,
    @SerialName("full_name") val fullName: String,
    @SerialName("email") val email: String,
    @SerialName("specialty") val specialty: String? = null,
    @SerialName("nmc_license_number") val nmcLicenseNumber: String? = null,
    @SerialName("license_doc_url") val licenseDocUrl: String? = null,
    @SerialName("certificates_doc_url") val certificatesDocUrl: String? = null,
    @SerialName("kyc_status") val kycStatus: String? = null,
    @SerialName("is_in_clinic") val isInClinic: Boolean = false,
    @SerialName("consultation_fee") val consultationFee: Double? = null
)

@Serializable
data class DoctorExtendedMeta(
    val gender: String? = null,
    val age: Int? = null,
    val starting_practicing_year: Int? = null,
    val profile_picture_url: String? = null,
    val education: String? = null,
    val personal_mobile_number: String? = null,
    val public_mobile_number: String? = null,
    val description: String? = null,
    val original_certificates_doc_url: String? = null
)

@Singleton
class DoctorRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true; encodeDefaults = true }

    private fun enrichDoctor(doctor: Doctor): Doctor {
        val certs = doctor.certificatesDocUrl
        if (!certs.isNullOrBlank() && certs.trim().startsWith("{")) {
            try {
                val meta = json.decodeFromString<DoctorExtendedMeta>(certs)
                return doctor.copy(
                    gender = doctor.gender ?: meta.gender,
                    age = doctor.age ?: meta.age,
                    startingPracticingYear = doctor.startingPracticingYear ?: meta.starting_practicing_year,
                    profilePictureUrl = doctor.profilePictureUrl ?: meta.profile_picture_url,
                    education = doctor.education ?: meta.education,
                    personalMobileNumber = doctor.personalMobileNumber ?: meta.personal_mobile_number,
                    publicMobileNumber = doctor.publicMobileNumber ?: meta.public_mobile_number,
                    description = doctor.description ?: meta.description,
                    certificatesDocUrl = meta.original_certificates_doc_url
                )
            } catch (ignored: Exception) {}
        }
        return doctor
    }

    private fun packDoctorMetadata(doctor: Doctor): String {
        val meta = DoctorExtendedMeta(
            gender = doctor.gender,
            age = doctor.age,
            starting_practicing_year = doctor.startingPracticingYear,
            profile_picture_url = doctor.profilePictureUrl,
            education = doctor.education,
            personal_mobile_number = doctor.personalMobileNumber,
            public_mobile_number = doctor.publicMobileNumber,
            description = doctor.description,
            original_certificates_doc_url = doctor.certificatesDocUrl
        )
        return json.encodeToString(DoctorExtendedMeta.serializer(), meta)
    }

    suspend fun getDoctorsByClinic(clinicId: String): List<Doctor> = withContext(Dispatchers.IO) {
        try {
            // 1. Direct assigned doctors
            val directDocs = try {
                supabaseClient.postgrest["doctors"]
                    .select {
                        filter {
                            eq("clinic_id", clinicId)
                        }
                    }.decodeList<Doctor>().map { enrichDoctor(it) }
            } catch (e: Exception) {
                emptyList()
            }

            // 2. Doctors affiliated via accepted clinic invitations
            val acceptedInvites = try {
                supabaseClient.postgrest["clinic_invitations"]
                    .select {
                        filter {
                            eq("clinic_id", clinicId)
                            eq("status", "accepted")
                        }
                    }.decodeList<ClinicInvitation>()
            } catch (e: Exception) {
                emptyList()
            }

            val invitedEmails = acceptedInvites.map { it.email.trim().lowercase() }.toSet()
            val invitedDocs = if (invitedEmails.isNotEmpty()) {
                try {
                    val allDocs = supabaseClient.postgrest["doctors"].select().decodeList<Doctor>().map { enrichDoctor(it) }
                    allDocs.filter { it.email.trim().lowercase() in invitedEmails }
                } catch (e: Exception) {
                    emptyList()
                }
            } else emptyList()

            val allRoster = (directDocs + invitedDocs).distinctBy { it.id }

            allRoster.map { doc ->
                val isPresentHere = doc.clinicId == clinicId && (doc.isInClinic == true)
                doc.copy(isInClinic = isPresentHere)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getDoctorById(id: String): Doctor? = withContext(Dispatchers.IO) {
        try {
            val doc = supabaseClient.postgrest["doctors"]
                .select {
                    filter {
                        eq("id", id)
                    }
                }.decodeSingleOrNull<Doctor>()
            doc?.let { enrichDoctor(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun createDoctor(doctor: Doctor): Doctor? = withContext(Dispatchers.IO) {
        // Attempt 1: Full insert (if all columns exist in database)
        try {
            val inserted = supabaseClient.postgrest["doctors"]
                .insert(doctor) {
                    select()
                }.decodeSingleOrNull<Doctor>()
            if (inserted != null) return@withContext enrichDoctor(inserted)
        } catch (e: Exception) {
            println("Full doctor insert failed, attempting fallback with metadata packing: ${e.message}")
        }

        // Attempt 2: Base schema insert packing extended fields in certificates_doc_url JSON
        try {
            val metaJson = packDoctorMetadata(doctor)
            val baseDto = DoctorBaseDto(
                id = doctor.id,
                userId = doctor.userId,
                clinicId = doctor.clinicId,
                fullName = doctor.fullName,
                email = doctor.email.trim().lowercase(),
                specialty = doctor.specialty,
                nmcLicenseNumber = doctor.nmcLicenseNumber,
                licenseDocUrl = doctor.licenseDocUrl,
                certificatesDocUrl = metaJson,
                kycStatus = doctor.kycStatus ?: "pending",
                isInClinic = doctor.isInClinic,
                consultationFee = doctor.consultationFee ?: 500.0
            )
            val insertedBase = supabaseClient.postgrest["doctors"]
                .insert(baseDto) {
                    select()
                }.decodeSingleOrNull<DoctorBaseDto>()

            if (insertedBase != null) {
                return@withContext doctor
            }
        } catch (e2: Exception) {
            e2.printStackTrace()
        }
        null
    }

    suspend fun toggleDoctorPresence(doctorId: String, isInClinic: Boolean): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["doctors"]
                .update(mapOf("is_in_clinic" to isInClinic)) {
                    filter {
                        eq("id", doctorId)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun submitDoctorKyc(
        doctorId: String,
        nmcLicense: String,
        licenseDocUrl: String?,
        certificatesDocUrl: String?
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["doctors"]
                .update({
                    set("nmc_license_number", nmcLicense)
                    set("kyc_status", "pending")
                    if (licenseDocUrl != null) set("license_doc_url", licenseDocUrl)
                    if (certificatesDocUrl != null) set("certificates_doc_url", certificatesDocUrl)
                }) {
                    filter {
                        eq("id", doctorId)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun uploadKycFile(fileName: String, fileBytes: ByteArray): String? = withContext(Dispatchers.IO) {
        try {
            val bucket = supabaseClient.storage["doctor-kyc"]
            bucket.upload(fileName, fileBytes, upsert = true)
            bucket.publicUrl(fileName)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getDoctorByEmail(email: String): Doctor? = withContext(Dispatchers.IO) {
        try {
            val targetEmail = email.trim().lowercase()
            val doc = supabaseClient.postgrest["doctors"]
                .select {
                    filter {
                        ilike("email", targetEmail)
                    }
                }.decodeSingleOrNull<Doctor>()
            doc?.let { enrichDoctor(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getAllDoctors(): List<Doctor> = withContext(Dispatchers.IO) {
        try {
            val list = supabaseClient.postgrest["doctors"]
                .select()
                .decodeList<Doctor>()
            list.map { enrichDoctor(it) }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun updateDoctor(doctor: Doctor): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["doctors"]
                .update(doctor) {
                    filter {
                        eq("id", doctor.id)
                    }
                }
            true
        } catch (e: Exception) {
            try {
                val metaJson = packDoctorMetadata(doctor)
                val baseMap = mapOf(
                    "full_name" to doctor.fullName,
                    "email" to doctor.email.trim().lowercase(),
                    "specialty" to (doctor.specialty ?: ""),
                    "nmc_license_number" to (doctor.nmcLicenseNumber ?: ""),
                    "license_doc_url" to (doctor.licenseDocUrl ?: ""),
                    "certificates_doc_url" to metaJson,
                    "kyc_status" to (doctor.kycStatus ?: "pending"),
                    "is_in_clinic" to doctor.isInClinic,
                    "consultation_fee" to (doctor.consultationFee ?: 500.0)
                )
                supabaseClient.postgrest["doctors"].update(baseMap) {
                    filter { eq("id", doctor.id) }
                }
                true
            } catch (e2: Exception) {
                e2.printStackTrace()
                false
            }
        }
    }

    suspend fun updateDoctorProfile(id: String, specialty: String, consultationFee: Double): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["doctors"]
                .update(mapOf(
                    "specialty" to specialty.trim(),
                    "consultation_fee" to consultationFee
                )) {
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

    suspend fun updateDoctorFullProfile(
        id: String,
        fullName: String,
        gender: String?,
        age: Int?,
        startingYear: Int?,
        pictureUrl: String?,
        specialty: String,
        education: String?,
        nmcLicenseNumber: String?,
        personalMobile: String?,
        publicMobile: String?,
        description: String?,
        consultationFee: Double
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val current = getDoctorById(id)
            if (current != null) {
                val updated = current.copy(
                    fullName = fullName.trim(),
                    gender = gender,
                    age = age,
                    startingPracticingYear = startingYear,
                    profilePictureUrl = pictureUrl,
                    specialty = specialty.trim(),
                    education = education,
                    nmcLicenseNumber = nmcLicenseNumber,
                    personalMobileNumber = personalMobile,
                    publicMobileNumber = publicMobile,
                    description = description,
                    consultationFee = consultationFee
                )
                updateDoctor(updated)
            } else {
                false
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun linkClinicToDoctor(doctorId: String, clinicId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["doctors"]
                .update(mapOf("clinic_id" to clinicId)) {
                    filter {
                        eq("id", doctorId)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getAffiliatedClinicsForDoctor(doctorId: String, doctorEmail: String): List<Clinic> = withContext(Dispatchers.IO) {
        try {
            val clinicIds = mutableSetOf<String>()

            val doc = getDoctorById(doctorId)
            if (!doc?.clinicId.isNullOrBlank()) {
                clinicIds.add(doc!!.clinicId!!)
            }

            if (doctorEmail.isNotBlank()) {
                val acceptedInvites = supabaseClient.postgrest["clinic_invitations"]
                    .select {
                        filter {
                            eq("email", doctorEmail.trim().lowercase())
                            eq("status", "accepted")
                        }
                    }.decodeList<ClinicInvitation>()
                for (inv in acceptedInvites) {
                    if (inv.clinicId.isNotBlank()) {
                        clinicIds.add(inv.clinicId)
                    }
                }
            }

            if (clinicIds.isEmpty()) return@withContext emptyList()

            val allClinics = supabaseClient.postgrest["clinics"]
                .select()
                .decodeList<Clinic>()
            allClinics.filter { it.id in clinicIds }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun switchActiveClinic(doctorId: String, clinicId: String, setInClinic: Boolean): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["doctors"]
                .update(mapOf(
                    "clinic_id" to clinicId,
                    "is_in_clinic" to setInClinic
                )) {
                    filter {
                        eq("id", doctorId)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
