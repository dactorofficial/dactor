package com.dactor.patient.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class InvoiceItem(
    @SerialName("item_name") val itemName: String,
    @SerialName("quantity") val quantity: Int = 1,
    @SerialName("price") val price: Double,
    @SerialName("total") val total: Double = price * quantity
)

@Serializable
data class BillingInvoice(
    @SerialName("id") val id: String,
    @SerialName("appointment_id") val appointmentId: String,
    @SerialName("clinic_id") val clinicId: String,
    @SerialName("items") val items: List<InvoiceItem> = emptyList(),
    @SerialName("total_amount") val totalAmount: Double = 0.0,
    @SerialName("paid_amount") val paidAmount: Double = 0.0,
    @SerialName("balance_due") val balanceDue: Double = 0.0,
    @SerialName("payment_status") val paymentStatus: String = "paid",
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("remarks") val remarks: String? = null
)
