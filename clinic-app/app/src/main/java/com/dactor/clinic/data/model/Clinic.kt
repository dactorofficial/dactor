package com.dactor.clinic.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Clinic(
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
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("registration_doc_url") val registrationDocUrl: String? = null,
    @SerialName("pan_number") val panNumber: String? = null,
    @SerialName("manager_phone") val managerPhone: String? = null,
    @SerialName("pictures") val pictures: List<String> = emptyList(),
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

