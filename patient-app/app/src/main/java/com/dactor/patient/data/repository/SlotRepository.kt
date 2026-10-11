package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Slot
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SlotRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    private val cachedSlotsByDate = ConcurrentHashMap<String, Map<String, List<Slot>>>()

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
         * Returns true if the slot's ending time is already over for the given [dateStr].
         * As long as the ending time has not passed (endMins > nowMins), the slot remains active and bookable.
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

    private fun filterActiveSlotsForDate(slots: List<Slot>, date: String): List<Slot> {
        return slots.filter { slot ->
            !isSlotEndTimeOver(slot.endTime, date.ifBlank { slot.slotDate }, slot.startTime)
        }
    }

    fun getCachedSlotsForDate(date: String): Map<String, List<Slot>>? {
        val cached = cachedSlotsByDate[date] ?: return null
        return cached.mapValues { (_, list) -> filterActiveSlotsForDate(list, date) }
    }

    /**
     * Fetches ALL slots and appointments for [date] across all clinics in 1 parallel round-trip (2 queries total)
     * instead of 2*N queries per clinic. Automatically removes slots whose ending time is over.
     */
    suspend fun getAllAvailableSlotsForDate(
        date: String,
        forceRefresh: Boolean = false
    ): Map<String, List<Slot>> = coroutineScope {
        if (!forceRefresh && cachedSlotsByDate.containsKey(date)) {
            return@coroutineScope cachedSlotsByDate[date]!!.mapValues { (_, list) ->
                filterActiveSlotsForDate(list, date)
            }
        }

        val slotsDeferred = async {
            try {
                supabaseClient.postgrest["slots"]
                    .select {
                        filter {
                            eq("slot_date", date)
                        }
                    }
                    .decodeList<Slot>()
            } catch (e: Exception) {
                emptyList()
            }
        }

        val apptsDeferred = async {
            try {
                supabaseClient.postgrest["appointments"]
                    .select {
                        filter {
                            eq("appointment_date", date)
                        }
                    }
                    .decodeList<com.dactor.patient.data.model.Appointment>()
            } catch (e: Exception) {
                emptyList()
            }
        }

        val allSlots = slotsDeferred.await()
        val allAppts = apptsDeferred.await()

        val activeCountBySlotId = allAppts
            .filter { it.checkinStatus != "cancelled" && !it.slotId.isNullOrBlank() }
            .groupingBy { it.slotId!! }
            .eachCount()

        val enrichedSlots = filterActiveSlotsForDate(
            allSlots.map { slot ->
                val registeredCount = activeCountBySlotId[slot.id] ?: slot.bookedCount
                slot.copy(bookedCount = registeredCount)
            },
            date
        )

        val grouped = enrichedSlots.groupBy { it.clinicId }
        cachedSlotsByDate[date] = grouped
        grouped
    }

    suspend fun getAvailableSlots(clinicId: String, date: String): List<Slot> = coroutineScope {
        cachedSlotsByDate[date]?.get(clinicId)?.let {
            return@coroutineScope filterActiveSlotsForDate(it, date)
        }

        val slotsDeferred = async {
            try {
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
        }

        val apptsDeferred = async {
            try {
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
        }

        val slots = slotsDeferred.await()
        val appointments = apptsDeferred.await()

        val activeCountBySlotId = appointments
            .filter { it.checkinStatus != "cancelled" && !it.slotId.isNullOrBlank() }
            .groupingBy { it.slotId!! }
            .eachCount()

        filterActiveSlotsForDate(
            slots.map { slot ->
                val registeredCount = activeCountBySlotId[slot.id] ?: slot.bookedCount
                slot.copy(bookedCount = registeredCount)
            },
            date
        )
    }

    suspend fun incrementSlotBookedCount(slotId: String): Boolean {
        cachedSlotsByDate.clear()
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
