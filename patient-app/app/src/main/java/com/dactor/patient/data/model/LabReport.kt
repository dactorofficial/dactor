package com.dactor.patient.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LabReport(
    val id: String,
    @SerialName("appointment_id") val appointmentId: String,
    @SerialName("clinic_id") val clinicId: String,
    @SerialName("test_name") val testName: String,
    val stage: String,
    @SerialName("file_url") val fileUrl: String?,
    @SerialName("file_name") val fileName: String?,
    @SerialName("file_type") val fileType: String?,
    @SerialName("patient_name_verification") val patientNameVerification: String,
    @SerialName("sample_collected_at") val sampleCollectedAt: String,
    @SerialName("prepared_at") val preparedAt: String?
)
