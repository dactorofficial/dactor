package com.dactor.patient.data.repository

import com.dactor.patient.data.model.QueueEntry
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class QueueRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getQueueStatus(appointmentId: String): QueueEntry? {
        if (appointmentId.isBlank()) return null
        return try {
            supabaseClient.postgrest["queue_entries"]
                .select { filter { eq("appointment_id", appointmentId) } }
                .decodeSingleOrNull<QueueEntry>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getQueueEntriesForClinic(clinicId: String): List<QueueEntry> {
        if (clinicId.isBlank()) return emptyList()
        return try {
            supabaseClient.postgrest["queue_entries"]
                .select { filter { eq("clinic_id", clinicId) } }
                .decodeList<QueueEntry>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    fun subscribeToQueueUpdates(clinicId: String, onUpdate: (List<QueueEntry>) -> Unit) {
        // Implementation simplified for compilation
    }
}
