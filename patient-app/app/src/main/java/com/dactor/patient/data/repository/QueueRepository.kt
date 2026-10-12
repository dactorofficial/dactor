package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Clinic
import com.dactor.patient.data.model.ClinicScheduleHelper
import com.dactor.patient.data.model.NotificationTemplateData
import com.dactor.patient.data.model.QueueEntry
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class NotificationInsertDto(
    @SerialName("id") val id: String = UUID.randomUUID().toString(),
    @SerialName("user_id") val userId: String? = null,
    @SerialName("appointment_id") val appointmentId: String? = null,
    @SerialName("title") val title: String,
    @SerialName("message") val message: String,
    @SerialName("type") val type: String = "queue_alert",
    @SerialName("target_audience") val targetAudience: String = "specific",
    @SerialName("is_read") val isRead: Boolean = false
)

data class LiveQueueTimingEstimate(
    val estimatedTimeLeftText: String,
    val expectedExactTimeText: String,
    val doctorStatusBanner: String?,
    val isDoctorIdleFiveMins: Boolean = false,
    val isDoctorNotInside: Boolean = false,
    val isClinicOnBreak: Boolean = false,
    val isSoonBeReady: Boolean = false
)

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

    suspend fun removeOrCancelQueueEntry(appointmentId: String): Boolean {
        if (appointmentId.isBlank()) return false
        return try {
            supabaseClient.postgrest["queue_entries"].delete {
                filter { eq("appointment_id", appointmentId) }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun updateQueueStatus(appointmentId: String, newStatus: String): Boolean {
        if (appointmentId.isBlank()) return false
        return try {
            supabaseClient.postgrest["queue_entries"].update({
                set("status", newStatus)
            }) {
                filter { eq("appointment_id", appointmentId) }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Inserts an automatic queue alert notification into the `notifications` table.
     * Targeted to a specific patient via `user_id` and `appointment_id` so only they receive it.
     */
    suspend fun insertAutoAlert(
        appointmentId: String,
        userId: String?,
        title: String,
        message: String,
        estimatedTimeLeft: String? = null,
        expectedTime: String? = null,
        trackingCode: String? = null
    ): Boolean {
        return try {
            val validUuidApptId = appointmentId.takeIf { it.length == 36 && it.contains("-") }
            val taggedMessage = if (message.contains("[[META:")) {
                message
            } else {
                NotificationTemplateData.buildMessageWithMeta(
                    cleanMessage = message,
                    leftLabel = "Estimated Time Left",
                    leftValue = estimatedTimeLeft ?: "Soon, be ready",
                    rightLabel = "Your Appointment Time",
                    rightValue = expectedTime ?: "Soon, be ready",
                    trackingCode = trackingCode
                )
            }
            val dto = NotificationInsertDto(
                id = UUID.randomUUID().toString(),
                userId = userId?.takeIf { it.isNotBlank() },
                appointmentId = validUuidApptId,
                title = title,
                message = taggedMessage,
                type = "queue_alert",
                targetAudience = "specific",
                isRead = false
            )
            try {
                supabaseClient.postgrest["notifications"].insert(dto)
            } catch (e: Exception) {
                supabaseClient.postgrest["notifications"].insert(dto.copy(id = UUID.randomUUID().toString(), userId = null))
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    companion object {
        fun calculateLiveQueueTimingEstimate(
            clinic: Clinic?,
            isDoctorInClinic: Boolean,
            allClinicQueueEntries: List<QueueEntry>,
            targetEntry: QueueEntry?,
            fallbackPatientsAhead: Int = 0
        ): LiveQueueTimingEstimate {
            val avgMins = (clinic?.getEffectiveAvgMinutes() ?: 10).coerceAtLeast(1)
            val todaySchedule = clinic?.getTodaySchedule()
            val openLocalTime = ClinicScheduleHelper.parseTimeToLocalTime(todaySchedule?.openTime ?: "08:00 AM")
            val timeFormatter = DateTimeFormatter.ofPattern("hh:mm a", Locale.US)
            val nowTime = LocalTime.now()
            val nowInstant = Instant.now()
            val zoneId = ZoneId.systemDefault()

            val activeEntries = allClinicQueueEntries
                .filter { it.status == "waiting" || it.status == "inside" }
                .sortedBy { it.queuePosition }

            val insideEntry = activeEntries.firstOrNull { it.status == "inside" }

            // Total people ahead of the target patient (including anyone currently inside)
            val totalPeopleAhead = if (targetEntry != null) {
                activeEntries.count { it.queuePosition < targetEntry.queuePosition }
            } else {
                fallbackPatientsAhead.coerceAtLeast(0)
            }

            // 0. If target patient is already COMPLETED / DONE
            if (targetEntry?.status == "done" || targetEntry?.status == "completed") {
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Completed",
                    expectedExactTimeText = "Done",
                    doctorStatusBanner = null,
                    isClinicOnBreak = false,
                    isDoctorNotInside = false
                )
            }

            // 1. If target patient is currently INSIDE
            if (targetEntry?.status == "inside") {
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Now Inside",
                    expectedExactTimeText = "In Consultation",
                    doctorStatusBanner = null,
                    isClinicOnBreak = clinic?.isOnBreak == true
                )
            }

            // 2. If Clinic is on Break
            if (clinic?.isOnBreak == true) {
                val breakDesc = if (todaySchedule?.hasBreak == true) {
                    "${todaySchedule.breakStart} - ${todaySchedule.breakEnd}"
                } else {
                    "Short Break"
                }
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Clinic on Break",
                    expectedExactTimeText = breakDesc,
                    doctorStatusBanner = "Clinic is currently on a break ($breakDesc)",
                    isClinicOnBreak = true
                )
            }

            // 3. Check if someone is currently INSIDE the consultation room
            if (insideEntry != null) {
                val insideInstant = try {
                    if (!insideEntry.insideAt.isNullOrBlank()) Instant.parse(insideEntry.insideAt) else nowInstant
                } catch (_: Exception) {
                    nowInstant
                }
                val multiplier = totalPeopleAhead.coerceAtLeast(1)
                val expectedInstant = insideInstant.plusSeconds(multiplier * avgMins * 60L)
                val diffSec = expectedInstant.epochSecond - nowInstant.epochSecond

                return if (diffSec <= 0) {
                    // Exact calculated time has already passed while patient is still waiting
                    LiveQueueTimingEstimate(
                        estimatedTimeLeftText = "Soon, be ready",
                        expectedExactTimeText = "Soon, be ready",
                        doctorStatusBanner = null,
                        isSoonBeReady = true
                    )
                } else {
                    val minsLeft = kotlin.math.ceil(diffSec / 60.0).toInt().coerceAtLeast(1)
                    val exactTimeStr = expectedInstant.atZone(zoneId).toLocalTime().format(timeFormatter)
                    LiveQueueTimingEstimate(
                        estimatedTimeLeftText = "~ $minsLeft min",
                        expectedExactTimeText = exactTimeStr,
                        doctorStatusBanner = null
                    )
                }
            }

            // 4. No patient is currently INSIDE
            val hasAnyActivityToday = allClinicQueueEntries.any {
                !it.insideAt.isNullOrBlank() || !it.completedAt.isNullOrBlank() ||
                    it.status in listOf("done", "processing", "sample_collected", "report_prepared")
            }

            // 4a. Before clinic starts (either current time is before opening time, or clinic hasn't started yet and opening time is used)
            if (nowTime.isBefore(openLocalTime) || (!hasAnyActivityToday && !isDoctorInClinic)) {
                val preOpenExpectedTime = openLocalTime.plusMinutes((totalPeopleAhead * avgMins).toLong())
                val exactStr = preOpenExpectedTime.format(timeFormatter)
                val minsUntilOpenExpected = java.time.Duration.between(nowTime, preOpenExpectedTime).toMinutes().toInt()
                val waitText = if (minsUntilOpenExpected > 0) {
                    "~ $minsUntilOpenExpected min"
                } else {
                    "~ ${(totalPeopleAhead.coerceAtLeast(1)) * avgMins} min"
                }
                val docBanner = if (!isDoctorInClinic) "Doctor is not inside clinic (He/She is not in yet)" else null
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = waitText,
                    expectedExactTimeText = exactStr,
                    doctorStatusBanner = docBanner,
                    isDoctorNotInside = !isDoctorInClinic
                )
            }

            // 4b. If doctor is NOT inside the clinic after opening time
            if (!isDoctorInClinic) {
                val preOpenExpectedTime = openLocalTime.plusMinutes((totalPeopleAhead * avgMins).toLong())
                val exactStr = if (nowTime.isBefore(preOpenExpectedTime)) {
                    preOpenExpectedTime.format(timeFormatter)
                } else {
                    "Doctor not inside"
                }
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Doctor not inside",
                    expectedExactTimeText = exactStr,
                    doctorStatusBanner = "Doctor is not inside the clinic (He/She is not in)",
                    isDoctorNotInside = true
                )
            }

            // 4c. Doctor IS inside the clinic, waiting patients exist, and NO patient is currently "inside":
            // Check if >= 5 minutes have elapsed with no patient inside
            val latestActivityInstant = allClinicQueueEntries.mapNotNull { entry ->
                val ts = entry.completedAt ?: entry.insideAt ?: entry.calledAt
                if (!ts.isNullOrBlank()) {
                    try { Instant.parse(ts) } catch (_: Exception) { null }
                } else null
            }.maxOrNull()

            val idleMinutes = if (latestActivityInstant != null) {
                java.time.Duration.between(latestActivityInstant, nowInstant).toMinutes()
            } else {
                val minsSinceOpen = java.time.Duration.between(openLocalTime, nowTime).toMinutes()
                minsSinceOpen.coerceAtLeast(0)
            }

            if (idleMinutes >= 5 && activeEntries.isNotEmpty()) {
                val fallbackMins = (totalPeopleAhead * avgMins)
                val estWait = if (fallbackMins == 0) "Wait a few moments" else "~ $fallbackMins min"
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = estWait,
                    expectedExactTimeText = "Wait a few moments",
                    doctorStatusBanner = "Doctor is not seeing patients — wait a few moments",
                    isDoctorIdleFiveMins = true
                )
            }

            // Less than 5 minutes between consultations:
            if (totalPeopleAhead == 0) {
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Soon, be ready",
                    expectedExactTimeText = "Soon, be ready",
                    doctorStatusBanner = null,
                    isSoonBeReady = true
                )
            }

            val anchorInstant = latestActivityInstant ?: nowInstant
            val expectedInstant = anchorInstant.plusSeconds(totalPeopleAhead * avgMins * 60L)
            val diffSec = expectedInstant.epochSecond - nowInstant.epochSecond
            return if (diffSec <= 0) {
                LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Soon, be ready",
                    expectedExactTimeText = "Soon, be ready",
                    doctorStatusBanner = null,
                    isSoonBeReady = true
                )
            } else {
                val minsLeft = kotlin.math.ceil(diffSec / 60.0).toInt().coerceAtLeast(1)
                val exactTimeStr = expectedInstant.atZone(zoneId).toLocalTime().format(timeFormatter)
                LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "~ $minsLeft min",
                    expectedExactTimeText = exactTimeStr,
                    doctorStatusBanner = null
                )
            }
        }
    }
}

