package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.ClinicScheduleHelper
import com.dactor.clinic.data.model.QueueEntry
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.model.DactorNotification
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
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
    @SerialName("type") val type: String = "manual_alert",
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
    private val supabaseClient: SupabaseClient,
    private val clinicRepository: ClinicRepository
) {
    suspend fun getQueueForClinic(clinicId: String): List<QueueEntry> = withContext(Dispatchers.IO) {
        try {
            var currentEntries = supabaseClient.postgrest["queue_entries"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<QueueEntry>()

            // Auto-transfer today's booked appointments into live queue without requiring clinic verification
            try {
                val todayStr = java.time.LocalDate.now().toString()
                val todayAppts = supabaseClient.postgrest["appointments"]
                    .select {
                        filter {
                            eq("clinic_id", clinicId)
                            eq("appointment_date", todayStr)
                        }
                    }.decodeList<com.dactor.clinic.data.model.Appointment>()
                    .filter {
                        it.checkinStatus != "completed" &&
                            it.checkinStatus != "cancelled" &&
                            it.checkinStatus != "processing" &&
                            it.checkinStatus != "report_prepared"
                    }

                val enrolledIds = currentEntries.map { it.appointmentId }.toSet()
                var nextPos = (currentEntries.map { it.queuePosition }.maxOrNull() ?: 0) + 1
                var addedAny = false

                for (appt in todayAppts) {
                    if (!enrolledIds.contains(appt.id)) {
                        val newEntry = QueueEntry(
                            id = java.util.UUID.randomUUID().toString(),
                            appointmentId = appt.id,
                            clinicId = clinicId,
                            doctorId = appt.doctorId,
                            queuePosition = nextPos++,
                            status = "waiting"
                        )
                        try {
                            supabaseClient.postgrest["queue_entries"].insert(newEntry)
                            addedAny = true
                        } catch (ignored: Exception) {}
                    }
                    if (appt.checkinStatus == "not_checked_in" || appt.checkinStatus == "registered") {
                        try {
                            supabaseClient.postgrest["appointments"]
                                .update({ set("checkin_status", "checked_in") }) {
                                    filter { eq("id", appt.id) }
                                }
                        } catch (ignored: Exception) {}
                    }
                }

                if (addedAny) {
                    currentEntries = supabaseClient.postgrest["queue_entries"]
                        .select {
                            filter {
                                eq("clinic_id", clinicId)
                            }
                        }.decodeList<QueueEntry>()
                }
            } catch (ignored: Exception) {}

            currentEntries.sortedBy { it.queuePosition }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getQueueForDoctor(doctorId: String): List<QueueEntry> = withContext(Dispatchers.IO) {
        try {
            var currentEntries = supabaseClient.postgrest["queue_entries"]
                .select {
                    filter {
                        eq("doctor_id", doctorId)
                    }
                }.decodeList<QueueEntry>()

            // Auto-transfer today's booked appointments for this doctor into live queue
            try {
                val todayStr = java.time.LocalDate.now().toString()
                val todayAppts = supabaseClient.postgrest["appointments"]
                    .select {
                        filter {
                            eq("doctor_id", doctorId)
                            eq("appointment_date", todayStr)
                        }
                    }.decodeList<com.dactor.clinic.data.model.Appointment>()
                    .filter { it.checkinStatus != "completed" && it.checkinStatus != "cancelled" }

                val enrolledIds = currentEntries.map { it.appointmentId }.toSet()
                var nextPos = (currentEntries.map { it.queuePosition }.maxOrNull() ?: 0) + 1
                var addedAny = false

                for (appt in todayAppts) {
                    if (!enrolledIds.contains(appt.id)) {
                        val newEntry = QueueEntry(
                            id = java.util.UUID.randomUUID().toString(),
                            appointmentId = appt.id,
                            clinicId = appt.clinicId,
                            doctorId = doctorId,
                            queuePosition = nextPos++,
                            status = "waiting"
                        )
                        try {
                            supabaseClient.postgrest["queue_entries"].insert(newEntry)
                            addedAny = true
                        } catch (ignored: Exception) {}
                    }
                    if (appt.checkinStatus == "not_checked_in" || appt.checkinStatus == "registered") {
                        try {
                            supabaseClient.postgrest["appointments"]
                                .update({ set("checkin_status", "checked_in") }) {
                                    filter { eq("id", appt.id) }
                                }
                        } catch (ignored: Exception) {}
                    }
                }

                if (addedAny) {
                    currentEntries = supabaseClient.postgrest["queue_entries"]
                        .select {
                            filter {
                                eq("doctor_id", doctorId)
                            }
                        }.decodeList<QueueEntry>()
                }
            } catch (ignored: Exception) {}

            currentEntries.sortedBy { it.queuePosition }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun updateQueueStatus(id: String, status: String, clinicId: String? = null): Boolean = withContext(Dispatchers.IO) {
        try {
            val now = Instant.now().toString()
            val existingEntry = try {
                supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("id", id) } }
                    .decodeSingleOrNull<QueueEntry>()
            } catch (e: Exception) { null }

            val durationSeconds = if ((status == "done" || status == "processing") && existingEntry?.insideAt != null) {
                try {
                    val start = Instant.parse(existingEntry.insideAt).epochSecond
                    val end = Instant.parse(now).epochSecond
                    (end - start).coerceAtLeast(0)
                } catch (e: Exception) { null }
            } else null

            // Primary update: only guaranteed schema columns so missing optional columns never fail the status transition
            supabaseClient.postgrest["queue_entries"]
                .update({
                    set("status", status)
                    when (status) {
                        "inside" -> set("inside_at", now)
                        "done", "processing", "no_show", "sample_collected", "report_prepared" -> {
                            set("completed_at", now)
                        }
                    }
                }) {
                    filter {
                        eq("id", id)
                    }
                }

            // Optional column update: persist consultation_duration_seconds if column exists in DB
            if (durationSeconds != null) {
                try {
                    supabaseClient.postgrest["queue_entries"]
                        .update({
                            set("consultation_duration_seconds", durationSeconds)
                        }) {
                            filter {
                                eq("id", id)
                            }
                        }
                } catch (ignored: Exception) {}
            }

            if (status in listOf("done", "processing", "no_show", "sample_collected", "report_prepared")) {
                val apptId = existingEntry?.appointmentId
                if (!apptId.isNullOrBlank()) {
                    try {
                        val newCheckin = when (status) {
                            "processing" -> "processing"
                            "no_show" -> "cancelled"
                            else -> "completed"
                        }
                        supabaseClient.postgrest["appointments"]
                            .update({ set("checkin_status", newCheckin) }) {
                                filter { eq("id", apptId) }
                            }
                    } catch (ignored: Exception) {}
                }

                val effectiveCId = if (!clinicId.isNullOrBlank()) clinicId else existingEntry?.clinicId
                if (!effectiveCId.isNullOrBlank()) {
                    reindexActiveQueue(effectiveCId)
                    // Auto-recalculate clinic's average consultation time after every consultancy
                    recalculateAndUpdateClinicAverageTime(effectiveCId)
                }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun updateQueueStatusByAppointmentId(appointmentId: String, status: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val now = Instant.now().toString()
            supabaseClient.postgrest["queue_entries"]
                .update({
                    set("status", status)
                    if (status == "done" || status == "report_prepared" || status == "processing") {
                        set("completed_at", now)
                    }
                }) {
                    filter {
                        eq("appointment_id", appointmentId)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    data class ClinicAverageCalculationResult(
        val effectiveAvgMinutes: Int,
        val manualAvgMinutes: Int,
        val calculatedAvgMinutes: Int?,
        val completedVisitsCount: Int,
        val outliersOmittedCount: Int,
        val isAutoReplaced: Boolean,
        val mode: String = "auto"
    )

    suspend fun recalculateAndUpdateClinicAverageTime(clinicId: String): ClinicAverageCalculationResult = withContext(Dispatchers.IO) {
        try {
            val clinic = clinicRepository.getClinicById(clinicId)

            val manualMinutes = clinic?.manualAvgConsultationTimeMinutes ?: clinic?.avgConsultationTimeMinutes ?: 10
            val currentMode = clinic?.avgTimeMode ?: "auto"

            val doneEntries = supabaseClient.postgrest["queue_entries"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        or {
                            eq("status", "done")
                            eq("status", "processing")
                            eq("status", "sample_collected")
                            eq("status", "report_prepared")
                        }
                    }
                }.decodeList<QueueEntry>()

            val validDurations = doneEntries.mapNotNull { entry ->
                if (entry.consultationDurationSeconds != null && entry.consultationDurationSeconds > 0) {
                    entry.consultationDurationSeconds
                } else if (!entry.insideAt.isNullOrBlank() && !entry.completedAt.isNullOrBlank()) {
                    try {
                        val start = Instant.parse(entry.insideAt).epochSecond
                        val end = Instant.parse(entry.completedAt).epochSecond
                        val diff = end - start
                        if (diff > 0) diff else null
                    } catch (e: Exception) { null }
                } else null
            }

            if (validDurations.isEmpty()) {
                val result = ClinicAverageCalculationResult(
                    effectiveAvgMinutes = manualMinutes,
                    manualAvgMinutes = manualMinutes,
                    calculatedAvgMinutes = null,
                    completedVisitsCount = 0,
                    outliersOmittedCount = 0,
                    isAutoReplaced = false,
                    mode = currentMode
                )
                if (clinic != null) {
                    clinicRepository.updateClinic(
                        clinicId,
                        clinic.copy(
                            avgConsultationTimeMinutes = manualMinutes,
                            manualAvgConsultationTimeMinutes = manualMinutes
                        )
                    )
                }
                return@withContext result
            }

            // 1. Calculate preliminary calculated average
            val preliminaryAvgSec = validDurations.average()

            // 2. Outlier filtering:
            // "if any specific appointment is largely deviated from calculated average like directly 2 times or more than the calculated average not given average omit that specific data"
            val outlierLimitSec = 2.0 * preliminaryAvgSec
            val cleanDurations = validDurations.filter { it < outlierLimitSec }
            val outliersCount = validDurations.size - cleanDurations.size

            // 3. Re-calculate actual average without outliers
            val actualAvgSec = if (cleanDurations.isNotEmpty()) cleanDurations.average() else preliminaryAvgSec
            val calculatedMinutes = kotlin.math.round(actualAvgSec / 60.0).toInt().coerceAtLeast(1)

            // 4. Replacement logic:
            // "once the actual calculated time comes near like + - 5 minutes it will be replaced by actual average"
            val diff = kotlin.math.abs(calculatedMinutes - manualMinutes)
            val isWithinFiveMinutes = diff <= 5

            val effectiveMinutes = when (currentMode) {
                "manual" -> manualMinutes
                "calculated" -> calculatedMinutes
                else -> if (isWithinFiveMinutes) calculatedMinutes else manualMinutes // "auto"
            }

            if (clinic != null) {
                clinicRepository.updateClinic(
                    clinicId,
                    clinic.copy(
                        avgConsultationTimeMinutes = effectiveMinutes,
                        calculatedAvgConsultationTimeMinutes = calculatedMinutes,
                        manualAvgConsultationTimeMinutes = manualMinutes,
                        avgTimeMode = currentMode
                    )
                )
            }

            ClinicAverageCalculationResult(
                effectiveAvgMinutes = effectiveMinutes,
                manualAvgMinutes = manualMinutes,
                calculatedAvgMinutes = calculatedMinutes,
                completedVisitsCount = validDurations.size,
                outliersOmittedCount = outliersCount,
                isAutoReplaced = (currentMode == "auto" && isWithinFiveMinutes),
                mode = currentMode
            )
        } catch (e: Exception) {
            e.printStackTrace()
            ClinicAverageCalculationResult(
                effectiveAvgMinutes = 10,
                manualAvgMinutes = 10,
                calculatedAvgMinutes = null,
                completedVisitsCount = 0,
                outliersOmittedCount = 0,
                isAutoReplaced = false,
                mode = "auto"
            )
        }
    }

    suspend fun getClinicAverageTimeDetails(clinicId: String): ClinicAverageCalculationResult = withContext(Dispatchers.IO) {
        recalculateAndUpdateClinicAverageTime(clinicId)
    }

    suspend fun updateClinicAverageTimePreference(clinicId: String, manualMinutes: Int, mode: String = "auto"): Boolean = withContext(Dispatchers.IO) {
        try {
            val calcResult = recalculateAndUpdateClinicAverageTime(clinicId)
            val effective = when (mode) {
                "manual" -> manualMinutes
                "calculated" -> calcResult.calculatedAvgMinutes ?: manualMinutes
                else -> {
                    val calc = calcResult.calculatedAvgMinutes
                    if (calc != null && kotlin.math.abs(calc - manualMinutes) <= 5) calc else manualMinutes
                }
            }

            val clinic = clinicRepository.getClinicById(clinicId)
            if (clinic != null) {
                clinicRepository.updateClinic(
                    clinicId,
                    clinic.copy(
                        manualAvgConsultationTimeMinutes = manualMinutes,
                        avgConsultationTimeMinutes = effective,
                        calculatedAvgConsultationTimeMinutes = calcResult.calculatedAvgMinutes,
                        avgTimeMode = mode
                    )
                )
            } else {
                false
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getClinicAverageTimeMinutes(clinicId: String): Int = withContext(Dispatchers.IO) {
        try {
            val clinic = clinicRepository.getClinicById(clinicId)
            clinic?.getEffectiveAvgMinutes() ?: 10
        } catch (e: Exception) {
            10
        }
    }

    suspend fun updateClinicAverageTimeMinutes(clinicId: String, minutes: Int): Boolean = withContext(Dispatchers.IO) {
        updateClinicAverageTimePreference(clinicId, minutes, "manual")
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

            // Patients currently inside consultation room strictly maintain position #1
            // Remaining waiting patients are sorted chronologically by slot time and queue position
            val sortedEntries = activeEntries.sortedWith(
                compareBy<QueueEntry> { if (it.status == "inside") 0 else 1 }
                    .thenBy { entry ->
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

    private fun buildMetaTaggedMessage(
        cleanMessage: String,
        leftLabel: String = "Estimated Time Left",
        leftValue: String,
        rightLabel: String = "Your Appointment Time",
        rightValue: String,
        trackingCode: String? = null
    ): String {
        val safeLeftLabel = leftLabel.replace("|", "/").replace("]", "")
        val safeLeftVal = leftValue.replace("|", "/").replace("]", "")
        val safeRightLabel = rightLabel.replace("|", "/").replace("]", "")
        val safeRightVal = rightValue.replace("|", "/").replace("]", "")
        val codePart = if (!trackingCode.isNullOrBlank()) "|code=${trackingCode.trim()}" else ""
        return "${cleanMessage.trim()}\n[[META:leftLabel=$safeLeftLabel|leftVal=$safeLeftVal|rightLabel=$safeRightLabel|rightVal=$safeRightVal$codePart]]"
    }

    private suspend fun insertNotificationRowSafely(dto: NotificationInsertDto): Boolean {
        try {
            supabaseClient.postgrest["notifications"].insert(dto)
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            // Fallback: if user_id or appointment_id foreign key rejected the insert, retry with nullable fields cleared
            try {
                val fallbackDto = dto.copy(
                    id = UUID.randomUUID().toString(),
                    userId = null
                )
                supabaseClient.postgrest["notifications"].insert(fallbackDto)
                return true
            } catch (e2: Exception) {
                try {
                    val minimalDto = dto.copy(
                        id = UUID.randomUUID().toString(),
                        userId = null,
                        appointmentId = null
                    )
                    supabaseClient.postgrest["notifications"].insert(minimalDto)
                    return true
                } catch (e3: Exception) {
                    e3.printStackTrace()
                    return false
                }
            }
        }
    }

    suspend fun sendManualNotification(
        appointmentId: String,
        title: String,
        message: String,
        trackingCode: String? = null,
        estimatedTimeLeft: String? = null,
        expectedTime: String? = null,
        leftLabel: String = "Estimated Time Left",
        rightLabel: String = "Your Appointment Time",
        type: String = "manual_alert"
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val appt = try {
                supabaseClient.postgrest["appointments"]
                    .select { filter { eq("id", appointmentId) } }
                    .decodeSingleOrNull<com.dactor.clinic.data.model.Appointment>()
            } catch (e: Exception) { null }

            val apptUserId = appt?.userId?.takeIf { it.isNotBlank() }
            val effectiveTrackingCode = trackingCode?.takeIf { it.isNotBlank() } ?: appt?.trackingCode10Digit
            val validUuidApptId = appt?.id ?: appointmentId.takeIf { it.length == 36 && it.contains("-") }

            val leftVal = estimatedTimeLeft?.takeIf { it.isNotBlank() } ?: "Soon, be ready"
            val rightVal = expectedTime?.takeIf { it.isNotBlank() }
                ?: appt?.appointmentTime?.takeIf { it.isNotBlank() }
                ?: "Soon, be ready"

            val taggedMessage = if (message.contains("[[META:")) {
                message
            } else {
                buildMetaTaggedMessage(
                    cleanMessage = message,
                    leftLabel = leftLabel,
                    leftValue = leftVal,
                    rightLabel = rightLabel,
                    rightValue = rightVal,
                    trackingCode = effectiveTrackingCode
                )
            }

            val dto = NotificationInsertDto(
                id = UUID.randomUUID().toString(),
                userId = apptUserId,
                appointmentId = validUuidApptId,
                title = title,
                message = taggedMessage,
                type = type,
                targetAudience = "specific",
                isRead = false
            )
            insertNotificationRowSafely(dto)
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getClinicNotifications(clinicId: String): List<DactorNotification> = withContext(Dispatchers.IO) {
        try {
            val apptIds = try {
                supabaseClient.postgrest["appointments"]
                    .select { filter { eq("clinic_id", clinicId) } }
                    .decodeList<Appointment>()
                    .map { it.id }
            } catch (e: Exception) {
                emptyList()
            }
            val allNotes = try {
                supabaseClient.postgrest["notifications"]
                    .select {
                        order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                        limit(50)
                    }.decodeList<DactorNotification>()
            } catch (e: Exception) {
                emptyList()
            }
            if (apptIds.isEmpty()) {
                allNotes.take(30)
            } else {
                val apptIdSet = apptIds.toSet()
                allNotes.filter { it.appointmentId == null || apptIdSet.contains(it.appointmentId) }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun sendClinicBroadcastNotification(
        clinicId: String,
        title: String,
        cleanMessage: String,
        leftLabel: String = "Status",
        leftVal: String = "Clinic Alert",
        rightLabel: String = "Target",
        rightVal: String = "All Patients"
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val tagged = buildMetaTaggedMessage(
                cleanMessage = cleanMessage,
                leftLabel = leftLabel,
                leftValue = leftVal,
                rightLabel = rightLabel,
                rightValue = rightVal
            )
            val dto = NotificationInsertDto(
                id = UUID.randomUUID().toString(),
                userId = null,
                appointmentId = null,
                title = title,
                message = tagged,
                type = "clinic_broadcast",
                targetAudience = "clinic_$clinicId",
                isRead = false
            )
            insertNotificationRowSafely(dto)
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun sendClinicBreakNotificationsToActiveAppointments(
        clinicId: String,
        clinicName: String,
        breakWindowText: String? = null
    ): Int = withContext(Dispatchers.IO) {
        try {
            val todayStr = LocalDate.now().toString()
            val activeAppts = supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        gte("appointment_date", todayStr)
                    }
                }.decodeList<com.dactor.clinic.data.model.Appointment>()
                .filter {
                    it.checkinStatus != "completed" &&
                        it.checkinStatus != "cancelled" &&
                        it.checkinStatus != "report_prepared"
                }

            var sentCount = 0
            val breakInfo = if (!breakWindowText.isNullOrBlank()) " ($breakWindowText)" else ""
            val title = "$clinicName is Currently on Break"
            val cleanBody = "The clinic is currently on a short break$breakInfo. Queue movement is paused and will resume shortly."

            for (appt in activeAppts) {
                val tagged = buildMetaTaggedMessage(
                    cleanMessage = cleanBody,
                    leftLabel = "Estimated Time Left",
                    leftValue = "Clinic on Break",
                    rightLabel = "Your Appointment Time",
                    rightValue = breakWindowText?.takeIf { it.isNotBlank() } ?: (appt.appointmentTime ?: "Paused Briefly"),
                    trackingCode = appt.trackingCode10Digit
                )
                val dto = NotificationInsertDto(
                    id = UUID.randomUUID().toString(),
                    userId = appt.userId?.takeIf { it.isNotBlank() },
                    appointmentId = appt.id.takeIf { it.length == 36 },
                    title = title,
                    message = tagged,
                    type = "clinic_break",
                    targetAudience = "specific",
                    isRead = false
                )
                if (insertNotificationRowSafely(dto)) {
                    sentCount++
                }
            }
            sentCount
        } catch (e: Exception) {
            e.printStackTrace()
            0
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
                val ts = entry.completedAt ?: entry.insideAt
                if (!ts.isNullOrBlank()) {
                    try { Instant.parse(ts) } catch (_: Exception) { null }
                } else null
            }.maxOrNull() ?: allClinicQueueEntries.mapNotNull { entry ->
                if (!entry.createdAt.isNullOrBlank()) {
                    try { Instant.parse(entry.createdAt) } catch (_: Exception) { null }
                } else null
            }.minOrNull()

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

