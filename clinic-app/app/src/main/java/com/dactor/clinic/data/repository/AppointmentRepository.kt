package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.model.QueueEntry
import com.dactor.clinic.domain.util.TrackingCodeGenerator
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppointmentRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    private suspend fun attachQueueStatus(
        appointments: List<Appointment>,
        clinicId: String? = null,
        doctorId: String? = null
    ): List<Appointment> {
        if (appointments.isEmpty()) return appointments
        return try {
            val apptIds = appointments.map { it.id }
            val queueEntries = try {
                supabaseClient.postgrest["queue_entries"]
                    .select {
                        filter {
                            isIn("appointment_id", apptIds)
                        }
                    }.decodeList<QueueEntry>()
            } catch (e: Exception) {
                when {
                    !clinicId.isNullOrBlank() -> {
                        supabaseClient.postgrest["queue_entries"]
                            .select { filter { eq("clinic_id", clinicId) } }
                            .decodeList<QueueEntry>()
                    }
                    !doctorId.isNullOrBlank() -> {
                        supabaseClient.postgrest["queue_entries"]
                            .select { filter { eq("doctor_id", doctorId) } }
                            .decodeList<QueueEntry>()
                    }
                    else -> emptyList()
                }
            }
            val queueMap = queueEntries.associateBy { it.appointmentId }

            appointments.map { appt ->
                val q = queueMap[appt.id]
                when {
                    q?.status in listOf("done", "sample_collected", "report_prepared") -> appt.copy(checkinStatus = "completed")
                    q?.status == "processing" -> appt.copy(checkinStatus = if (appt.checkinStatus == "completed") "completed" else "processing")
                    q?.status == "inside" -> appt.copy(checkinStatus = "inside_opd")
                    q?.status == "no_show" -> appt.copy(checkinStatus = "cancelled")
                    else -> appt
                }
            }.sortedWith(
                compareBy<Appointment> { appt ->
                    val q = queueMap[appt.id]
                    when {
                        q?.status == "inside" -> 0
                        q?.status == "waiting" -> 1
                        else -> 2
                    }
                }.thenBy { appt ->
                    val q = queueMap[appt.id]
                    q?.queuePosition ?: 9999
                }.thenBy { appt ->
                    parseTimeToMinutes(appt.appointmentTime)
                }
            )
        } catch (e: Exception) {
            e.printStackTrace()
            appointments
        }
    }

    suspend fun getAppointmentsByClinic(clinicId: String): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val appts = supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<Appointment>()
            attachQueueStatus(appts, clinicId = clinicId)
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getAppointmentsByDate(clinicId: String, date: String): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val appts = supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        eq("appointment_date", date)
                    }
                }.decodeList<Appointment>()
            attachQueueStatus(appts, clinicId = clinicId)
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getAppointmentsForPatient(
        patientMobile: String? = null,
        userId: String? = null,
        trackingCode: String? = null,
        patientEmail: String? = null
    ): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val mobileTrimmed = patientMobile?.trim()?.takeIf { it.isNotBlank() }
            val userIdTrimmed = userId?.trim()?.takeIf { it.isNotBlank() }
            val trackingTrimmed = trackingCode?.trim()?.takeIf { it.isNotBlank() }
            val emailTrimmed = patientEmail?.trim()?.lowercase()?.takeIf { it.isNotBlank() && !it.endsWith("@dactor.internal") }

            if (mobileTrimmed == null && userIdTrimmed == null && trackingTrimmed == null && emailTrimmed == null) {
                return@withContext emptyList()
            }

            val appts = supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        or {
                            if (mobileTrimmed != null) eq("patient_mobile", mobileTrimmed)
                            if (userIdTrimmed != null) eq("user_id", userIdTrimmed)
                            if (trackingTrimmed != null) eq("tracking_code_10_digit", trackingTrimmed)
                            if (emailTrimmed != null) ilike("patient_email", emailTrimmed)
                        }
                    }
                }.decodeList<Appointment>()
            attachQueueStatus(appts)
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getAppointmentByTrackingCode(code: String): Appointment? = withContext(Dispatchers.IO) {
        try {
            val appt = supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        eq("tracking_code_10_digit", code.trim())
                    }
                }.decodeSingleOrNull<Appointment>()
            if (appt != null) {
                val q = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", appt.id) } }
                    .decodeSingleOrNull<QueueEntry>()
                if (q?.status in listOf("done", "sample_collected", "report_prepared")) {
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
                .select {
                    filter {
                        eq("id", id)
                    }
                }.decodeSingleOrNull<Appointment>()
            if (appt != null) {
                val q = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", appt.id) } }
                    .decodeSingleOrNull<QueueEntry>()
                if (q?.status in listOf("done", "sample_collected", "report_prepared")) {
                    return@withContext appt.copy(checkinStatus = "completed")
                }
            }
            appt
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun createWalkinAppointment(
        appointment: Appointment,
        allowOverbooking: Boolean = true
    ): Appointment? = withContext(Dispatchers.IO) {
        try {
            val trackingCode = if (appointment.trackingCode10Digit.isBlank()) {
                TrackingCodeGenerator.generate()
            } else {
                appointment.trackingCode10Digit
            }

            val cleanEmail = appointment.patientEmail?.trim()?.lowercase()
                ?.takeIf { it.isNotBlank() && !it.endsWith("@dactor.internal") }
            var resolvedUserId = appointment.userId?.takeIf { it.isNotBlank() && !it.startsWith("appt_patient_") }

            if (cleanEmail != null) {
                try {
                    val existingProfile = try {
                        supabaseClient.postgrest["profiles"]
                            .select { filter { ilike("email", cleanEmail) } }
                            .decodeList<com.dactor.clinic.data.model.Profile>()
                            .firstOrNull()
                    } catch (e: Exception) {
                        supabaseClient.postgrest["profiles"]
                            .select { filter { eq("email", cleanEmail) } }
                            .decodeList<com.dactor.clinic.data.model.Profile>()
                            .firstOrNull()
                    }

                    if (existingProfile != null) {
                        resolvedUserId = existingProfile.id
                    } else {
                        val newProfileId = resolvedUserId ?: UUID.randomUUID().toString()
                        resolvedUserId = newProfileId
                        try {
                            val insertMap = mutableMapOf<String, Any>(
                                "id" to newProfileId,
                                "email" to cleanEmail,
                                "full_name" to appointment.patientName.trim(),
                                "role" to "patient",
                                "phone" to appointment.patientMobile.trim()
                            )
                            if (!appointment.patientGender.isNullOrBlank()) {
                                insertMap["gender"] = appointment.patientGender
                            }
                            if (appointment.patientAge != null && appointment.patientAge > 0) {
                                insertMap["age"] = appointment.patientAge
                            }
                            supabaseClient.postgrest["profiles"].insert(insertMap)
                        } catch (e: Exception) {
                            try {
                                supabaseClient.postgrest["profiles"].insert(
                                    mapOf(
                                        "id" to newProfileId,
                                        "email" to cleanEmail,
                                        "full_name" to appointment.patientName.trim(),
                                        "role" to "patient",
                                        "phone" to appointment.patientMobile.trim()
                                    )
                                )
                            } catch (ignored: Exception) {}
                        }
                    }
                } catch (ignored: Exception) {}
            }

            val readyAppointment = appointment.copy(
                id = UUID.randomUUID().toString(),
                trackingCode10Digit = trackingCode,
                userId = resolvedUserId,
                patientEmail = cleanEmail ?: appointment.patientEmail,
                isWalkin = true
            )

            // Insert appointment (with fallback if userId FK fails)
            val created = try {
                supabaseClient.postgrest["appointments"]
                    .insert(readyAppointment) {
                        select()
                    }.decodeSingleOrNull<Appointment>() ?: readyAppointment
            } catch (fkEx: Exception) {
                val withoutUserId = readyAppointment.copy(userId = null)
                supabaseClient.postgrest["appointments"]
                    .insert(withoutUserId) {
                        select()
                    }.decodeSingleOrNull<Appointment>() ?: withoutUserId
            }

            // Update slot booked count if slotId is assigned
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

            // Insert initial queue entry with temporary position
            val queueEntry = QueueEntry(
                id = UUID.randomUUID().toString(),
                appointmentId = created.id,
                clinicId = created.clinicId,
                doctorId = created.doctorId,
                queuePosition = 999999,
                status = "waiting"
            )

            supabaseClient.postgrest["queue_entries"].insert(queueEntry)

            // Chronologically sort queue by time slot so earlier time slots precede later time slots
            reindexActiveQueueChronologically(created.clinicId)

            created
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun rescheduleAppointment(id: String, newDate: String, newTime: String, newSlotId: String?): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["appointments"]
                .update({
                    set("appointment_date", newDate)
                    set("appointment_time", newTime)
                    if (newSlotId != null) set("slot_id", newSlotId)
                }) {
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

    suspend fun getAppointmentsByDoctor(doctorId: String, date: String? = null): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val appts = if (date != null) {
                supabaseClient.postgrest["appointments"]
                    .select {
                        filter {
                            eq("doctor_id", doctorId)
                            eq("appointment_date", date)
                        }
                    }.decodeList<Appointment>()
            } else {
                supabaseClient.postgrest["appointments"]
                    .select {
                        filter {
                            eq("doctor_id", doctorId)
                        }
                    }.decodeList<Appointment>()
            }
            attachQueueStatus(appts, doctorId = doctorId)
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun completeConsultation(appointmentId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val now = java.time.Instant.now().toString()

            // 1. Fetch appointment to identify clinic and doctor
            val appt = supabaseClient.postgrest["appointments"]
                .select {
                    filter { eq("id", appointmentId) }
                }.decodeSingleOrNull<Appointment>()

            val clinicId = appt?.clinicId
            val doctorId = appt?.doctorId

            // 2. Mark queue entry status as done, or create one if it did not exist
            val existingQueue = supabaseClient.postgrest["queue_entries"]
                .select { filter { eq("appointment_id", appointmentId) } }
                .decodeSingleOrNull<QueueEntry>()

            if (existingQueue != null) {
                supabaseClient.postgrest["queue_entries"]
                    .update({
                        set("status", "done")
                        set("completed_at", now)
                        if (!doctorId.isNullOrBlank()) set("doctor_id", doctorId)
                    }) {
                        filter { eq("appointment_id", appointmentId) }
                    }
            } else if (!clinicId.isNullOrBlank()) {
                val newEntry = QueueEntry(
                    id = UUID.randomUUID().toString(),
                    appointmentId = appointmentId,
                    clinicId = clinicId,
                    doctorId = doctorId,
                    queuePosition = 0,
                    status = "done",
                    completedAt = now
                )
                supabaseClient.postgrest["queue_entries"].insert(newEntry)
            }

            // 3. Attempt to update checkin_status on appointments (safely handled if DB enum doesn't include 'completed')
            try {
                supabaseClient.postgrest["appointments"]
                    .update({
                        set("checkin_status", "completed")
                    }) {
                        filter { eq("id", appointmentId) }
                    }
            } catch (enumEx: Exception) {
                android.util.Log.w("AppointmentRepo", "Could not set checkin_status='completed' on appointments table: ${enumEx.message}")
            }

            // 4. Update live queue: advance the next waiting patient to "inside" and re-index active positions
            if (!clinicId.isNullOrBlank()) {
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
                    .filter { it.appointmentId != appointmentId } // Exclude the completed entry
                    .sortedWith(
                        compareBy<QueueEntry> { if (it.status == "inside") 0 else 1 }
                            .thenBy { it.queuePosition }
                    )

                val hasInside = activeEntries.any { it.status == "inside" }
                val nextWaiting = activeEntries.firstOrNull { it.status == "waiting" }

                // Automatically advance next waiting patient to inside consultation room
                if (!hasInside && nextWaiting != null) {
                    try {
                        supabaseClient.postgrest["queue_entries"]
                            .update({
                                set("status", "inside")
                                set("inside_at", now)
                                if (!doctorId.isNullOrBlank()) set("doctor_id", doctorId)
                            }) {
                                filter { eq("id", nextWaiting.id) }
                            }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                // 5. Re-index remaining active queue entries strictly 1, 2, 3...
                val refreshedActive = supabaseClient.postgrest["queue_entries"]
                    .select {
                        filter {
                            eq("clinic_id", clinicId)
                            or {
                                eq("status", "waiting")
                                eq("status", "inside")
                            }
                        }
                    }.decodeList<QueueEntry>()
                    .sortedWith(
                        compareBy<QueueEntry> { if (it.status == "inside") 0 else 1 }
                            .thenBy { it.queuePosition }
                    )

                refreshedActive.forEachIndexed { index, entry ->
                    val newPosition = index + 1
                    if (entry.queuePosition != newPosition) {
                        try {
                            supabaseClient.postgrest["queue_entries"]
                                .update({
                                    set("queue_position", newPosition)
                                }) {
                                    filter { eq("id", entry.id) }
                                }
                        } catch (reindexEx: Exception) {
                            reindexEx.printStackTrace()
                        }
                    }
                }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun updateCheckinStatus(id: String, status: String): Boolean = withContext(Dispatchers.IO) {
        if (status == "completed") {
            completeConsultation(id)
        } else {
            try {
                supabaseClient.postgrest["appointments"]
                    .update({
                        set("checkin_status", status)
                    }) {
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
    }

    suspend fun approveAndTransferToDoctor(appointmentId: String, doctorId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            android.util.Log.d("AppointmentRepo", "approveAndTransferToDoctor starting: appointmentId=$appointmentId, doctorId=$doctorId")
            supabaseClient.postgrest["appointments"]
                .update({
                    set("checkin_status", "checked_in")
                    set("doctor_id", doctorId)
                }) {
                    filter {
                        eq("id", appointmentId)
                    }
                }

            val appt = supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        eq("id", appointmentId)
                    }
                }.decodeSingleOrNull<Appointment>()

            if (appt != null) {
                val existingQueue = supabaseClient.postgrest["queue_entries"]
                    .select {
                        filter {
                            eq("appointment_id", appointmentId)
                        }
                    }.decodeSingleOrNull<QueueEntry>()

                if (existingQueue == null) {
                    val queueEntry = QueueEntry(
                        id = UUID.randomUUID().toString(),
                        appointmentId = appt.id,
                        clinicId = appt.clinicId,
                        doctorId = doctorId,
                        queuePosition = 999999,
                        status = "waiting"
                    )
                    supabaseClient.postgrest["queue_entries"].insert(queueEntry)
                } else {
                    supabaseClient.postgrest["queue_entries"]
                        .update({
                            set("doctor_id", doctorId)
                            set("status", "waiting")
                        }) {
                            filter {
                                eq("id", existingQueue.id)
                            }
                        }
                }
                reindexActiveQueueChronologically(appt.clinicId)
            }
            android.util.Log.d("AppointmentRepo", "approveAndTransferToDoctor successfully completed")
            true
        } catch (e: Exception) {
            android.util.Log.e("AppointmentRepo", "Error in approveAndTransferToDoctor", e)
            e.printStackTrace()
            false
        }
    }

    private suspend fun reindexActiveQueueChronologically(clinicId: String) {
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
            if (activeEntries.isEmpty()) return

            val appointments = try {
                supabaseClient.postgrest["appointments"]
                    .select { filter { eq("clinic_id", clinicId) } }
                    .decodeList<Appointment>()
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
                    parseTimeToMinutes(appt?.appointmentTime)
                }.thenBy { it.queuePosition }
            )

            sortedEntries.forEachIndexed { index, entry ->
                val newPos = index + 1
                if (entry.queuePosition != newPos) {
                    try {
                        supabaseClient.postgrest["queue_entries"]
                            .update({ set("queue_position", newPos) }) {
                                filter { eq("id", entry.id) }
                            }
                    } catch (ignored: Exception) {}
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    companion object {
        fun parseTimeToMinutes(timeStr: String?): Int {
            if (timeStr.isNullOrBlank()) return 23 * 60 + 59
            return try {
                val clean = timeStr.trim()
                val firstPart = clean.split("-").first().trim()
                val isPm = clean.contains("PM", ignoreCase = true)
                val isAm = clean.contains("AM", ignoreCase = true)
                val match = Regex("(\\d{1,2})(?::(\\d{2}))?").find(firstPart)
                if (match != null) {
                    var h = match.groupValues[1].toIntOrNull() ?: 12
                    val m = match.groupValues[2].takeIf { it.isNotEmpty() }?.toIntOrNull() ?: 0
                    if (isPm && h < 12) h += 12
                    if (isAm && h == 12) h = 0
                    if (!isPm && !isAm && h in 1..6) h += 12
                    h * 60 + m
                } else {
                    12 * 60
                }
            } catch (e: Exception) {
                12 * 60
            }
        }
    }
}
