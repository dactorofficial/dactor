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
    companion object {
        fun parseTimeToMinutes(raw: String): Int? {
            val clean = raw.trim().uppercase(java.util.Locale.US)
            if (clean.isBlank()) return null
            return try {
                val isPm = clean.contains("PM")
                val isAm = clean.contains("AM")
                val timePart = clean.replace("AM", "").replace("PM", "").trim()
                val parts = timePart.split(":")
                if (parts.size < 2) return null
                var hour = parts[0].trim().toInt()
                val minute = parts[1].trim().take(2).filter { it.isDigit() }.toInt()
                if (isPm && hour < 12) hour += 12
                if (isAm && hour == 12) hour = 0
                hour * 60 + minute
            } catch (e: Exception) {
                null
            }
        }

        /**
         * Checks whether the ending time of a slot/window is already over for [dateStr].
         * If the ending time has not passed yet, returns false (slot is still active & valid).
         */
        fun isSlotEndTimeOver(endTimeStr: String, dateStr: String, startTimeStr: String = ""): Boolean {
            return try {
                val today = java.time.LocalDate.now().toString()
                if (dateStr < today) return true
                if (dateStr > today) return false
                var endMins = parseTimeToMinutes(endTimeStr) ?: return false
                val startMins = parseTimeToMinutes(startTimeStr)
                if (endMins == 0 && (startMins == null || startMins > 0)) {
                    endMins = 24 * 60
                } else if (startMins != null && endMins < startMins) {
                    endMins += 24 * 60
                }
                val now = java.time.LocalTime.now()
                val nowMins = now.hour * 60 + now.minute
                endMins <= nowMins
            } catch (e: Exception) {
                false
            }
        }
    }

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

    suspend fun getSlotsForClinic(clinicId: String): List<Slot> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["slots"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<Slot>()
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
