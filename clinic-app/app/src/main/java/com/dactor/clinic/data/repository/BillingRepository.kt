package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.BillingInvoice
import com.dactor.clinic.data.model.InvoiceItem
import com.dactor.clinic.data.model.CatalogItem
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BillingRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getInvoiceByAppointment(appointmentId: String): BillingInvoice? = withContext(Dispatchers.IO) {
        try {
            val list = supabaseClient.postgrest["billing_invoices"]
                .select {
                    filter {
                        eq("appointment_id", appointmentId)
                    }
                }.decodeList<BillingInvoice>()
            if (list.isEmpty()) return@withContext null
            list.firstOrNull { it.totalAmount > 0.0 || it.items.isNotEmpty() } ?: list.last()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun saveInvoice(invoice: BillingInvoice): BillingInvoice? = withContext(Dispatchers.IO) {
        try {
            val existing = getInvoiceByAppointment(invoice.appointmentId)
            val invoiceToSave = if (existing != null) {
                invoice.copy(
                    id = existing.id,
                    remarks = invoice.remarks?.takeIf { it.isNotBlank() } ?: existing.remarks
                )
            } else {
                invoice
            }
            val saved = supabaseClient.postgrest["billing_invoices"]
                .upsert(invoiceToSave) {
                    select()
                }.decodeSingleOrNull<BillingInvoice>() ?: invoiceToSave

            // Also sync fee_amount and payment_status on the appointments table so patient profile & directory always see the bill
            try {
                supabaseClient.postgrest["appointments"].update({
                    set("fee_amount", invoiceToSave.totalAmount)
                    set("payment_status", invoiceToSave.paymentStatus)
                }) {
                    filter { eq("id", invoiceToSave.appointmentId) }
                }
            } catch (ignored: Exception) {}

            saved
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getInvoicesForClinic(clinicId: String): List<BillingInvoice> = withContext(Dispatchers.IO) {
        if (clinicId.isBlank()) return@withContext emptyList()
        try {
            supabaseClient.postgrest["billing_invoices"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<BillingInvoice>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    /**
     * Pushes a quick payment entry with date (e.g. Paid 1000 with no other detail required).
     * Automatically adds into the patient's total bill and paid amount with a date-stamped ledger entry.
     */
    suspend fun pushQuickPayment(
        appointment: com.dactor.clinic.data.model.Appointment,
        paymentDate: String,
        paidAmount: Double,
        note: String? = null
    ): BillingInvoice? = withContext(Dispatchers.IO) {
        try {
            val safePaid = paidAmount.coerceAtLeast(0.0)
            val cleanDate = paymentDate.trim().ifBlank { java.time.LocalDate.now().toString() }
            val existing = getInvoiceByAppointment(appointment.id)
            val nowIso = java.time.Instant.now().toString()

            val entryDescription = if (!note.isNullOrBlank()) {
                "Payment Received ($cleanDate) • ${note.trim()}"
            } else {
                "Payment Received ($cleanDate)"
            }

            val newEntryItem = InvoiceItem(
                itemName = entryDescription,
                quantity = 1,
                price = safePaid,
                total = safePaid
            )

            val invoiceToSave = if (existing != null) {
                val updatedItems = existing.items + newEntryItem
                val newPaidAmount = (existing.effectivePaidAmount + safePaid).coerceAtLeast(0.0)
                // If previous total was already fully covered or empty, add the new payment to total bill
                val newTotalAmount = if (existing.totalAmount <= existing.effectivePaidAmount) {
                    (existing.totalAmount + safePaid).coerceAtLeast(safePaid)
                } else {
                    kotlin.math.max(existing.totalAmount, newPaidAmount)
                }
                val newBalance = (newTotalAmount - newPaidAmount).coerceAtLeast(0.0)
                val newStatus = when {
                    newBalance <= 0.0 && newTotalAmount > 0.0 -> "paid"
                    newPaidAmount > 0.0 -> "partial"
                    else -> "pending"
                }
                existing.copy(
                    items = updatedItems,
                    totalAmount = newTotalAmount,
                    paidAmount = newPaidAmount,
                    balanceDue = newBalance,
                    paymentStatus = newStatus,
                    paidAt = nowIso,
                    remarks = note?.takeIf { it.isNotBlank() } ?: existing.remarks
                )
            } else {
                BillingInvoice(
                    id = java.util.UUID.randomUUID().toString(),
                    appointmentId = appointment.id,
                    clinicId = appointment.clinicId,
                    items = listOf(newEntryItem),
                    totalAmount = safePaid,
                    paidAmount = safePaid,
                    balanceDue = 0.0,
                    paymentStatus = "paid",
                    paidAt = nowIso,
                    remarks = note?.takeIf { it.isNotBlank() }
                )
            }

            saveInvoice(invoiceToSave)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getRemarkForAppointment(appointmentId: String): String? = withContext(Dispatchers.IO) {
        try {
            val invoice = getInvoiceByAppointment(appointmentId)
            invoice?.remarks?.ifBlank { null }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getRemarksForAppointments(appointmentIds: List<String>): Map<String, String> = withContext(Dispatchers.IO) {
        if (appointmentIds.isEmpty()) return@withContext emptyMap()
        try {
            val invoices = supabaseClient.postgrest["billing_invoices"]
                .select {
                    filter {
                        isIn("appointment_id", appointmentIds)
                    }
                }.decodeList<BillingInvoice>()
            invoices.mapNotNull { inv ->
                val r = inv.remarks?.trim()
                if (!r.isNullOrBlank()) inv.appointmentId to r else null
            }.toMap()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyMap()
        }
    }

    suspend fun saveRemarkForAppointment(appointmentId: String, clinicId: String, remarks: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val existing = getInvoiceByAppointment(appointmentId)
            if (existing != null) {
                supabaseClient.postgrest["billing_invoices"]
                    .update({
                        set("remarks", remarks)
                    }) {
                        filter { eq("id", existing.id) }
                    }
            } else {
                val newInvoice = BillingInvoice(
                    id = java.util.UUID.randomUUID().toString(),
                    appointmentId = appointmentId,
                    clinicId = clinicId,
                    items = emptyList(),
                    totalAmount = 0.0,
                    paidAmount = 0.0,
                    balanceDue = 0.0,
                    paymentStatus = "paid",
                    remarks = remarks
                )
                supabaseClient.postgrest["billing_invoices"].insert(newInvoice)
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getCatalog(clinicId: String): List<CatalogItem> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinic_catalog"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<CatalogItem>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun addCatalogItem(item: CatalogItem): CatalogItem? = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinic_catalog"]
                .insert(item) {
                    select()
                }.decodeSingleOrNull<CatalogItem>() ?: item
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun deleteCatalogItem(id: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["clinic_catalog"]
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
}
