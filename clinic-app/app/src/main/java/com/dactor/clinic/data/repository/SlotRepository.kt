package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Slot
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SlotRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getSlots(clinicId: String, date: String): List<Slot> = withContext(Dispatchers.IO) {
        try {
            val slots = supabaseClient.postgrest["slots"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        eq("slot_date", date)
                    }
                }.decodeList<Slot>()

            val appointments = try {
                supabaseClient.postgrest["appointments"]
                    .select {
                        filter {
                            eq("clinic_id", clinicId)
                            eq("appointment_date", date)
                        }
                    }.decodeList<com.dactor.clinic.data.model.Appointment>()
            } catch (e: Exception) {
                emptyList()
            }

            slots.map { slot ->
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
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun incrementSlotBookedCount(slotId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val slot = supabaseClient.postgrest["slots"]
                .select { filter { eq("id", slotId) } }
                .decodeSingleOrNull<Slot>() ?: return@withContext false
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

    suspend fun createSlot(slot: Slot): Slot? = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["slots"]
                .insert(slot) {
                    select()
                }.decodeSingleOrNull<Slot>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun deleteSlot(id: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["slots"]
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

    suspend fun updateSlotCapacity(slotId: String, newCapacity: Int): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["slots"]
                .update({
                    set("max_capacity", newCapacity)
                }) {
                    filter {
                        eq("id", slotId)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
