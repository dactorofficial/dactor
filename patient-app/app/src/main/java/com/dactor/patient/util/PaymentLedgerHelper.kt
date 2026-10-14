package com.dactor.patient.util

import com.dactor.patient.data.model.PaymentRecord
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object PaymentLedgerHelper {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private const val START_TAG = "<!--PAYMENT_LOG_START-->"
    private const val END_TAG = "<!--PAYMENT_LOG_END-->"

    fun parsePaymentRecords(
        rawRemarks: String?,
        fallbackPaidAmount: Double = 0.0,
        fallbackDate: String? = null
    ): List<PaymentRecord> {
        if (!rawRemarks.isNullOrBlank() && rawRemarks.contains(START_TAG) && rawRemarks.contains(END_TAG)) {
            try {
                val jsonStr = rawRemarks.substringAfter(START_TAG).substringBefore(END_TAG).trim()
                if (jsonStr.isNotBlank()) {
                    val list = json.decodeFromString<List<PaymentRecord>>(jsonStr)
                    if (list.isNotEmpty()) return list
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        // Fallback: If legacy invoice has paidAmount > 0 and no payment log tag
        if (fallbackPaidAmount > 0.0) {
            val dateStr = fallbackDate?.take(16)?.replace("T", " ") ?: java.time.LocalDate.now().toString()
            return listOf(
                PaymentRecord(
                    amount = fallbackPaidAmount,
                    dateTime = dateStr,
                    note = "Payment Received"
                )
            )
        }
        return emptyList()
    }

    fun extractCleanClinicalRemarks(rawRemarks: String?): String {
        if (rawRemarks.isNullOrBlank()) return ""
        if (!rawRemarks.contains(START_TAG)) return rawRemarks.trim()
        val before = rawRemarks.substringBefore(START_TAG).trim()
        val after = if (rawRemarks.contains(END_TAG)) rawRemarks.substringAfter(END_TAG).trim() else ""
        return listOf(before, after).filter { it.isNotBlank() }.joinToString("\n").trim()
    }

    fun buildCombinedRemarks(cleanRemarks: String, paymentRecords: List<PaymentRecord>): String {
        val trimmedRemarks = cleanRemarks.trim()
        if (paymentRecords.isEmpty()) return trimmedRemarks
        val recordsJson = json.encodeToString(paymentRecords)
        val logBlock = "$START_TAG\n$recordsJson\n$END_TAG"
        return if (trimmedRemarks.isNotBlank()) {
            "$trimmedRemarks\n\n$logBlock"
        } else {
            logBlock
        }
    }
}
