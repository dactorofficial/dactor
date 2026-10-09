package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Appointment
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppointmentRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getAppointmentByTrackingCode(code: String): Appointment? = withContext(Dispatchers.IO) {
        try {
            val appt = supabaseClient.postgrest["appointments"]
                .select { filter { eq("tracking_code_10_digit", code) } }
                .decodeSingleOrNull<Appointment>()
            if (appt != null) {
                val q = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", appt.id) } }
                    .decodeSingleOrNull<com.dactor.patient.data.model.QueueEntry>()
                if (q?.status == "done") {
                    return@withContext appt.copy(checkinStatus = "completed")
                }
            }
            appt
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getAppointmentById(id: String): Appointment? = withContext(Dispatchers.IO) {
        try {
            val appt = supabaseClient.postgrest["appointments"]
                .select { filter { eq("id", id) } }
                .decodeSingleOrNull<Appointment>()
            if (appt != null) {
                val q = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", appt.id) } }
                    .decodeSingleOrNull<com.dactor.patient.data.model.QueueEntry>()
                if (q?.status == "done") {
                    return@withContext appt.copy(checkinStatus = "completed")
                }
            }
            appt
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getUserAppointments(userId: String): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val appts = supabaseClient.postgrest["appointments"]
                .select { filter { eq("user_id", userId) } }
                .decodeList<Appointment>()
            if (appts.isEmpty()) return@withContext emptyList()
            val queueEntries = supabaseClient.postgrest["queue_entries"]
                .select()
                .decodeList<com.dactor.patient.data.model.QueueEntry>()
            val doneIds = queueEntries.filter { it.status == "done" }.map { it.appointmentId }.toSet()
            appts.map {
                if (doneIds.contains(it.id)) it.copy(checkinStatus = "completed") else it
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun createAppointment(appointment: Appointment): Appointment = withContext(Dispatchers.IO) {
        val created = try {
            supabaseClient.postgrest["appointments"]
                .insert(appointment) { select() }
                .decodeSingle<Appointment>()
        } catch (e: Exception) {
            e.printStackTrace()
            if (appointment.userId != null) {
                try {
                    val safeAppt = appointment.copy(userId = null)
                    supabaseClient.postgrest["appointments"]
                        .insert(safeAppt) { select() }
                        .decodeSingle<Appointment>()
                } catch (retryEx: Exception) {
                    retryEx.printStackTrace()
                    appointment
                }
            } else {
                appointment
            }
        }

        if (created.slotId != null) {
            try {
                val apptsForSlot = supabaseClient.postgrest["appointments"]
                    .select { filter { eq("slot_id", created.slotId) } }
                    .decodeList<Appointment>()
                val realCount = apptsForSlot.count { it.checkinStatus != "cancelled" }
                supabaseClient.postgrest["slots"].update({
                    set("booked_count", realCount)
                }) {
                    filter { eq("id", created.slotId) }
                }
            } catch (ignored: Exception) {}
        }
        created
    }

    suspend fun rescheduleAppointment(id: String, newDate: String, newTime: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["appointments"]
                .update({
                    set("appointment_date", newDate)
                    set("appointment_time", newTime)
                }) {
                    filter { eq("id", id) }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun claimAppointment(appointmentId: String, userId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["appointments"]
                .update({
                    set("user_id", userId)
                }) {
                    filter { eq("id", appointmentId) }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun confirmPaymentAndJoinQueue(appointmentId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["appointments"]
                .update({
                    set("payment_status", "paid")
                    set("checkin_status", "not_checked_in")
                }) {
                    filter { eq("id", appointmentId) }
                }
            // Strict single-booking count: slot was already accounted for during createAppointment
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getInvoiceForAppointment(appointmentId: String): com.dactor.patient.data.model.BillingInvoice? = withContext(Dispatchers.IO) {
        if (appointmentId.isBlank()) return@withContext null
        try {
            supabaseClient.postgrest["billing_invoices"]
                .select {
                    filter {
                        eq("appointment_id", appointmentId)
                    }
                }.decodeSingleOrNull<com.dactor.patient.data.model.BillingInvoice>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getRemarksForAppointment(appointmentId: String): String? = withContext(Dispatchers.IO) {
        try {
            val invoice = getInvoiceForAppointment(appointmentId)
            invoice?.remarks?.ifBlank { null }
        } catch (e: Exception) {
            null
        }
    }
}
