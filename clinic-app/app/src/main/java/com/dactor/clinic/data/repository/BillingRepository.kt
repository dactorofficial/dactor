package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.BillingInvoice
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
            supabaseClient.postgrest["billing_invoices"]
                .select {
                    filter {
                        eq("appointment_id", appointmentId)
                    }
                }.decodeSingleOrNull<BillingInvoice>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun saveInvoice(invoice: BillingInvoice): BillingInvoice? = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["billing_invoices"]
                .upsert(invoice) {
                    select()
                }.decodeSingleOrNull<BillingInvoice>() ?: invoice
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
