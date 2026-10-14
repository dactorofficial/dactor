package com.dactor.clinic.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class InvoiceItem(
    @SerialName("item_name") val itemName: String,
    @SerialName("quantity") val quantity: Int = 1,
    @SerialName("price") val price: Double,
    @SerialName("total") val total: Double = 0.0
) {
    val effectiveTotal: Double get() = if (total > 0.0) total else price * quantity
}
