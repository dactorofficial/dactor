package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.QueueEntry
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QueueRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getQueueForClinic(clinicId: String): List<QueueEntry> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["queue_entries"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<QueueEntry>()
                .sortedBy { it.queuePosition }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getQueueForDoctor(doctorId: String): List<QueueEntry> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["queue_entries"]
                .select {
                    filter {
                        eq("doctor_id", doctorId)
                    }
                }.decodeList<QueueEntry>()
                .sortedBy { it.queuePosition }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun updateQueueStatus(id: String, status: String, clinicId: String? = null): Boolean = withContext(Dispatchers.IO) {
        try {
            val now = Instant.now().toString()
            supabaseClient.postgrest["queue_entries"]
                .update({
                    set("status", status)
                    when (status) {
                        "inside" -> set("inside_at", now)
                        "done" -> set("completed_at", now)
                        "no_show" -> set("completed_at", now)
                    }
                }) {
                    filter {
                        eq("id", id)
                    }
                }

            if (status == "done") {
                // Also update the linked appointment to completed
                val entry = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("id", id) } }
                    .decodeSingleOrNull<QueueEntry>()
                if (entry != null) {
                    try {
                        supabaseClient.postgrest["appointments"]
                            .update({ set("checkin_status", "completed") }) {
                                filter { eq("id", entry.appointmentId) }
                            }
                    } catch (ignored: Exception) {}
                    val effectiveCId = if (!clinicId.isNullOrBlank()) clinicId else entry.clinicId
                    if (effectiveCId.isNotBlank()) {
                        reindexActiveQueue(effectiveCId)
                    }
                }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun reindexActiveQueue(clinicId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val activeEntries = supabaseClient.postgrest["queue_entries"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        or {
                            eq("status", "waiting")
                            eq("status", "inside")
                        }
                    }
                }.decodeList<QueueEntry>()

            if (activeEntries.isEmpty()) return@withContext true

            val appointments = try {
                supabaseClient.postgrest["appointments"]
                    .select {
                        filter {
                            eq("clinic_id", clinicId)
                        }
                    }.decodeList<com.dactor.clinic.data.model.Appointment>()
            } catch (e: Exception) {
                emptyList()
            }
            val apptMap = appointments.associateBy { it.id }

            // Chronological slot sort:
            // Patients in earlier time slots (e.g. 3-4 PM) strictly precede patients in later time slots (4-5 PM).
            // Within the same time slot, preserve original relative queue position.
            val sortedEntries = activeEntries.sortedWith(
                compareBy<QueueEntry> { entry ->
                    val appt = apptMap[entry.appointmentId]
                    AppointmentRepository.parseTimeToMinutes(appt?.appointmentTime)
                }.thenBy { it.queuePosition }
            )

            sortedEntries.forEachIndexed { index, entry ->
                val newPosition = index + 1
                if (entry.queuePosition != newPosition) {
                    try {
                        supabaseClient.postgrest["queue_entries"]
                            .update({ set("queue_position", newPosition) }) {
                                filter { eq("id", entry.id) }
                            }
                    } catch (ignored: Exception) {}
                }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun reorderQueue(orderedEntries: List<QueueEntry>): Boolean = withContext(Dispatchers.IO) {
        try {
            orderedEntries.forEachIndexed { index, entry ->
                supabaseClient.postgrest["queue_entries"]
                    .update({
                        set("queue_position", index + 1)
                    }) {
                        filter {
                            eq("id", entry.id)
                        }
                    }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun sendManualNotification(appointmentId: String, title: String, message: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["notifications"]
                .insert(
                    mapOf(
                        "appointment_id" to appointmentId,
                        "title" to title,
                        "message" to message,
                        "type" to "manual_alert",
                        "target_audience" to "all_users",
                        "is_read" to false
                    )
                )
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
