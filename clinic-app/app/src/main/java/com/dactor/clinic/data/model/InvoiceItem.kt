package com.dactor.clinic.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class InvoiceItem(
    @SerialName("item_name") val itemName: String,
    @SerialName("quantity") val quantity: Int,
    @SerialName("price") val price: Double,
    @SerialName("total") val total: Double
)
