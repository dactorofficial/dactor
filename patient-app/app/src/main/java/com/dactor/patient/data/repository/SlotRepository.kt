package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Slot
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SlotRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getAvailableSlots(clinicId: String, date: String): List<Slot> {
        val slots = try {
            supabaseClient.postgrest["slots"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        eq("slot_date", date)
                    }
                }
                .decodeList<Slot>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }

        // Count all registered appointments (including completed visits) for strict capacity countdown
        val appointments = try {
            supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        eq("appointment_date", date)
                    }
                }
                .decodeList<com.dactor.patient.data.model.Appointment>()
        } catch (e: Exception) {
            emptyList()
        }

        return slots.map { slot ->
            val registeredCount = appointments.count { it.slotId == slot.id && it.checkinStatus != "cancelled" }
            if (slot.bookedCount != registeredCount) {
                try {
                    supabaseClient.postgrest["slots"].update({
                        set("booked_count", registeredCount)
                    }) {
                        filter { eq("id", slot.id) }
                    }
                } catch (ignored: Exception) {}
            }
            slot.copy(bookedCount = registeredCount)
        }
    }

    suspend fun incrementSlotBookedCount(slotId: String): Boolean {
        return try {
            val slot = getSlotById(slotId) ?: return false
            supabaseClient.postgrest["slots"]
                .update({
                    set("booked_count", slot.bookedCount + 1)
                }) {
                    filter { eq("id", slotId) }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getSlotById(slotId: String): Slot? {
        return try {
            supabaseClient.postgrest["slots"]
                .select { filter { eq("id", slotId) } }
                .decodeSingleOrNull<Slot>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun acquireSlotLock(slotId: String, userId: String): Result<String> {
        return Result.success("dummy-lock-id") // Simplified for scaffolding
    }

    suspend fun releaseSlotLock(lockId: String) {
        // Simplified for scaffolding
    }
}
