package com.dactor.patient.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Doctor(
    @SerialName("id") val id: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("clinic_id") val clinicId: String? = null,
    @SerialName("full_name") val fullName: String,
    @SerialName("email") val email: String? = null,
    @SerialName("specialty") val specialty: String? = "General Physician",
    @SerialName("gender") val gender: String? = null,
    @SerialName("age") val age: Int? = null,
    @SerialName("starting_practicing_year") val startingPracticingYear: Int? = null,
    @SerialName("profile_picture_url") val profilePictureUrl: String? = null,
    @SerialName("education") val education: String? = null,
    @SerialName("personal_mobile_number") val personalMobileNumber: String? = null,
    @SerialName("public_mobile_number") val publicMobileNumber: String? = null,
    @SerialName("description") val description: String? = null,
    @SerialName("nmc_license_number") val nmcLicenseNumber: String? = null,
    @SerialName("license_doc_url") val licenseDocUrl: String? = null,
    @SerialName("certificates_doc_url") val certificatesDocUrl: String? = null,
    @SerialName("kyc_status") val kycStatus: String? = "approved",
    @SerialName("is_in_clinic") val isInClinic: Boolean? = true,
    @SerialName("consultation_fee") val consultationFee: Double? = 500.0
)
