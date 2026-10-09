package com.dactor.patient.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DactorNotification(
    val id: String,
    @SerialName("user_id") val userId: String?,
    @SerialName("appointment_id") val appointmentId: String?,
    val title: String,
    val message: String,
    val type: String,
    @SerialName("is_read") val isRead: Boolean,
    @SerialName("created_at") val createdAt: String
)
