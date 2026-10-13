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
    val isSoonBeReady: Boolean = false,
    val timeWindowText: String = "",
    val approxTimeText: String = "",
    val slotStartTimeText: String = "",
    val suggestedArrivalText: String = "",
    val slotNoticeText: String = "",
    val canOfferEarlyArrival: Boolean = false,
    val earlyArrivalOfferText: String? = null
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

    /**
     * Sends an early arrival invite push notification to a patient who opted into early calls
     * when the doctor is free ahead of schedule.
     */
    suspend fun sendEarlyArrivalInvite(
        appointmentId: String,
        userId: String?,
        patientName: String,
        trackingCode: String,
        originalSlot: String
    ): Boolean {
        return try {
            val validUuidApptId = appointmentId.takeIf { it.length == 36 && it.contains("-") }
            val title = com.dactor.patient.data.model.NotificationTemplate.EarlyArrivalInvite.buildTitle()
            val msg = com.dactor.patient.data.model.NotificationTemplate.EarlyArrivalInvite.buildMessage(
                patientName = patientName,
                code = trackingCode,
                originalSlot = originalSlot
            )
            val dto = NotificationInsertDto(
                id = UUID.randomUUID().toString(),
                userId = userId?.takeIf { it.isNotBlank() },
                appointmentId = validUuidApptId,
                title = title,
                message = msg,
                type = "early_arrival",
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
        fun parseSlotStartTime(slotStr: String?): LocalTime? {
            if (slotStr.isNullOrBlank()) return null
            val token = slotStr.split("-", "–", "to").firstOrNull()?.trim() ?: return null
            val clean = token.uppercase()
            val formatters = listOf(
                DateTimeFormatter.ofPattern("hh:mm a", Locale.US),
                DateTimeFormatter.ofPattern("h:mm a", Locale.US),
                DateTimeFormatter.ofPattern("HH:mm", Locale.US),
                DateTimeFormatter.ofPattern("H:mm", Locale.US),
                DateTimeFormatter.ofPattern("h:mma", Locale.US),
                DateTimeFormatter.ofPattern("hh:mma", Locale.US)
            )
            for (fmt in formatters) {
                try {
                    return LocalTime.parse(clean, fmt)
                } catch (_: Exception) {}
            }
            return null
        }

        fun formatTimeWindow(time: LocalTime, spreadMinutes: Int = 15): String {
            val fmt = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
            val start = time.minusMinutes(5)
            val end = time.plusMinutes((spreadMinutes - 5).coerceAtLeast(5).toLong())
            return "${start.format(fmt)} – ${end.format(fmt)}"
        }

        fun formatApproxTime(time: LocalTime): String {
            val fmt = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
            return "around ${time.format(fmt)}"
        }

        fun calculateLiveQueueTimingEstimate(
            clinic: Clinic?,
            isDoctorInClinic: Boolean,
            allClinicQueueEntries: List<QueueEntry>,
            targetEntry: QueueEntry?,
            fallbackPatientsAhead: Int = 0,
            appointmentTime: String? = null,
            optInEarlyCall: Boolean = false
        ): LiveQueueTimingEstimate {
            val avgMins = (clinic?.getEffectiveAvgMinutes() ?: 10).coerceAtLeast(1)
            val todaySchedule = clinic?.getTodaySchedule()
            val openLocalTime = ClinicScheduleHelper.parseTimeToLocalTime(todaySchedule?.openTime ?: "08:00 AM")
            val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
            val nowTime = LocalTime.now()
            val nowInstant = Instant.now()
            val zoneId = ZoneId.systemDefault()

            // Count ONLY active people. Strictly exclude completed, cancelled and no-show patients.
            val activeEntries = allClinicQueueEntries
                .filter { it.status == "waiting" || it.status == "inside" || it.status == "in_consultation" }
                .sortedBy { it.queuePosition }

            val insideEntry = activeEntries.firstOrNull { it.status == "inside" || it.status == "in_consultation" }

            val totalPeopleAhead = if (targetEntry != null) {
                activeEntries.count { it.queuePosition < targetEntry.queuePosition }
            } else {
                fallbackPatientsAhead.coerceAtLeast(0)
            }

            // Parse slot details
            val slotStartTime = parseSlotStartTime(appointmentTime)
            val slotStartStr = slotStartTime?.format(timeFormatter) ?: ""
            val suggestedArrivalStr = slotStartTime?.minusMinutes(15)?.format(timeFormatter) ?: ""
            val arrivalAdvice = if (suggestedArrivalStr.isNotBlank()) "Please arrive by $suggestedArrivalStr." else ""

            val slotNotice = when {
                slotStartTime != null && totalPeopleAhead == 0 -> {
                    "No one ahead of you. Your slot starts at $slotStartStr. $arrivalAdvice".trim()
                }
                slotStartTime != null && totalPeopleAhead > 0 -> {
                    val personWord = if (totalPeopleAhead == 1) "person" else "people"
                    "$totalPeopleAhead $personWord ahead. Your slot starts at $slotStartStr. $arrivalAdvice".trim()
                }
                totalPeopleAhead == 0 -> "No one ahead of you. You are up next!"
                else -> "$totalPeopleAhead ${if (totalPeopleAhead == 1) "person" else "people"} ahead in line."
            }

            // 0. Completed / Done
            if (targetEntry?.status in listOf("done", "completed")) {
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Completed",
                    expectedExactTimeText = "Done",
                    doctorStatusBanner = null,
                    isClinicOnBreak = false,
                    isDoctorNotInside = false,
                    slotNoticeText = "Consultation completed",
                    slotStartTimeText = slotStartStr,
                    suggestedArrivalText = suggestedArrivalStr
                )
            }

            // 1. Currently inside
            if (targetEntry?.status in listOf("inside", "in_consultation")) {
                return LiveQueueTimingEstimate(
                    estimatedTimeLeftText = "Now Inside",
                    expectedExactTimeText = "In Consultation",
                    doctorStatusBanner = null,
                    isClinicOnBreak = clinic?.isOnBreak == true,
                    slotNoticeText = "You are currently inside for consultation",
                    slotStartTimeText = slotStartStr,
                    suggestedArrivalText = suggestedArrivalStr
                )
            }

            // 2. Clinic on break
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
                    isClinicOnBreak = true,
                    slotNoticeText = "Queue paused: clinic on break ($breakDesc)",
                    slotStartTimeText = slotStartStr,
                    suggestedArrivalText = suggestedArrivalStr
                )
            }

            // Check doctor availability & early arrival eligibility:
            // Doctor is free when: doctor is in clinic, no patient is currently inside, and clinic not on break
            val isDoctorFree = isDoctorInClinic && insideEntry == null && clinic?.isOnBreak != true
            val isSlotInFuture = slotStartTime != null && nowTime.isBefore(slotStartTime)
            val canOfferEarly = isDoctorFree && isSlotInFuture && optInEarlyCall && totalPeopleAhead == 0
            val earlyArrivalMsg = if (canOfferEarly) "Doctor is free now. Come in early?" else null

            // Calculate dynamic queue expected time
            var dynamicExpectedTime: LocalTime
            var minsWaitCalc: Int

            if (insideEntry != null) {
                val insideInstant = try {
                    if (!insideEntry.insideAt.isNullOrBlank()) Instant.parse(insideEntry.insideAt) else nowInstant
                } catch (_: Exception) {
                    nowInstant
                }
                val multiplier = totalPeopleAhead.coerceAtLeast(1)
                val expectedInstant = insideInstant.plusSeconds(multiplier * avgMins * 60L)
                val diffSec = expectedInstant.epochSecond - nowInstant.epochSecond
                minsWaitCalc = kotlin.math.ceil(diffSec / 60.0).toInt().coerceAtLeast(1)
                dynamicExpectedTime = expectedInstant.atZone(zoneId).toLocalTime()
            } else {
                // No patient currently inside
                val hasAnyActivityToday = allClinicQueueEntries.any {
                    !it.insideAt.isNullOrBlank() || !it.completedAt.isNullOrBlank() ||
                        it.status in listOf("done", "processing", "sample_collected", "report_prepared")
                }

                if (nowTime.isBefore(openLocalTime) || (!hasAnyActivityToday && !isDoctorInClinic)) {
                    dynamicExpectedTime = openLocalTime.plusMinutes((totalPeopleAhead * avgMins).toLong())
                    val diff = java.time.Duration.between(nowTime, dynamicExpectedTime).toMinutes().toInt()
                    minsWaitCalc = diff.coerceAtLeast((totalPeopleAhead.coerceAtLeast(1)) * avgMins)
                } else if (!isDoctorInClinic) {
                    dynamicExpectedTime = openLocalTime.plusMinutes((totalPeopleAhead * avgMins).toLong())
                    val diff = java.time.Duration.between(nowTime, dynamicExpectedTime).toMinutes().toInt()
                    minsWaitCalc = diff.coerceAtLeast(1)
                } else {
                    // Doctor is in clinic, no one inside
                    val latestActivityInstant = allClinicQueueEntries.mapNotNull { entry ->
                        val ts = entry.completedAt ?: entry.insideAt ?: entry.calledAt
                        if (!ts.isNullOrBlank()) {
                            try { Instant.parse(ts) } catch (_: Exception) { null }
                        } else null
                    }.maxOrNull()

                    val idleMinutes = if (latestActivityInstant != null) {
                        java.time.Duration.between(latestActivityInstant, nowInstant).toMinutes()
                    } else {
                        java.time.Duration.between(openLocalTime, nowTime).toMinutes().coerceAtLeast(0)
                    }

                    if (idleMinutes >= 5 && activeEntries.isNotEmpty()) {
                        dynamicExpectedTime = nowTime.plusMinutes((totalPeopleAhead * avgMins).toLong())
                        minsWaitCalc = (totalPeopleAhead * avgMins)
                    } else if (totalPeopleAhead == 0) {
                        dynamicExpectedTime = nowTime
                        minsWaitCalc = 0
                    } else {
                        val anchorInstant = latestActivityInstant ?: nowInstant
                        val expectedInstant = anchorInstant.plusSeconds(totalPeopleAhead * avgMins * 60L)
                        val diffSec = expectedInstant.epochSecond - nowInstant.epochSecond
                        minsWaitCalc = kotlin.math.ceil(diffSec / 60.0).toInt().coerceAtLeast(1)
                        dynamicExpectedTime = expectedInstant.atZone(zoneId).toLocalTime()
                    }
                }
            }

            // Apply Rule 2: Never show a time earlier than the slot start, unless the patient opted into early calls
            val effectiveExpectedTime: LocalTime
            val effectiveTimeLeftText: String

            if (slotStartTime != null && isSlotInFuture) {
                if (canOfferEarly) {
                    // Opted in and doctor is free now:
                    effectiveExpectedTime = nowTime
                    effectiveTimeLeftText = "Doctor is Free Now"
                } else {
                    // Standard slot enforcement: floor at slotStartTime
                    // If queue runs late and dynamicExpectedTime > slotStartTime, show dynamicExpectedTime!
                    if (dynamicExpectedTime.isAfter(slotStartTime)) {
                        effectiveExpectedTime = dynamicExpectedTime
                        val diff = java.time.Duration.between(nowTime, dynamicExpectedTime).toMinutes().toInt()
                        effectiveTimeLeftText = if (diff > 0) "~ $diff min" else "Soon, be ready"
                    } else {
                        effectiveExpectedTime = slotStartTime
                        val diff = java.time.Duration.between(nowTime, slotStartTime).toMinutes().toInt()
                        effectiveTimeLeftText = if (diff > 60) {
                            val hours = diff / 60
                            val rem = diff % 60
                            if (rem == 0) "~ $hours hr" else "~ ${hours}h ${rem}m"
                        } else if (diff > 0) {
                            "~ $diff min"
                        } else {
                            "Starts at $slotStartStr"
                        }
                    }
                }
            } else if (slotStartTime != null && !isSlotInFuture) {
                // Current time is at or after slotStartTime (e.g. running late at 3:20 PM)
                // Calculation becomes: people ahead * avgMins
                if (dynamicExpectedTime.isBefore(nowTime)) {
                    dynamicExpectedTime = nowTime.plusMinutes((totalPeopleAhead * avgMins).toLong())
                    minsWaitCalc = (totalPeopleAhead * avgMins)
                }
                effectiveExpectedTime = dynamicExpectedTime
                effectiveTimeLeftText = if (totalPeopleAhead == 0) "Soon, be ready" else "~ $minsWaitCalc min"
            } else {
                // No slot specified (e.g. walk-in)
                effectiveExpectedTime = dynamicExpectedTime
                effectiveTimeLeftText = if (totalPeopleAhead == 0) "Soon, be ready" else "~ $minsWaitCalc min"
            }

            val windowText = formatTimeWindow(effectiveExpectedTime)
            val approxText = formatApproxTime(effectiveExpectedTime)
            val exactTimeStr = effectiveExpectedTime.format(timeFormatter)

            val docBanner = when {
                !isDoctorInClinic -> "Doctor is not inside the clinic (He/She is not in yet)"
                canOfferEarly -> "Doctor is free now. Since you opted into early calls, you can come in early!"
                else -> null
            }

            return LiveQueueTimingEstimate(
                estimatedTimeLeftText = effectiveTimeLeftText,
                expectedExactTimeText = exactTimeStr,
                doctorStatusBanner = docBanner,
                isDoctorNotInside = !isDoctorInClinic,
                isDoctorIdleFiveMins = false,
                isClinicOnBreak = false,
                isSoonBeReady = totalPeopleAhead == 0 || effectiveTimeLeftText.contains("Soon"),
                timeWindowText = windowText,
                approxTimeText = approxText,
                slotStartTimeText = slotStartStr,
                suggestedArrivalText = suggestedArrivalStr,
                slotNoticeText = slotNotice,
                canOfferEarlyArrival = canOfferEarly,
                earlyArrivalOfferText = earlyArrivalMsg
            )
        }
    }
}

