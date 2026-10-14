package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.model.QueueEntry
import com.dactor.clinic.domain.util.TrackingCodeGenerator
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class AppointmentInsertDto(
    @SerialName("id") val id: String,
    @SerialName("tracking_code_10_digit") val trackingCode10Digit: String,
    @SerialName("slot_id") val slotId: String? = null,
    @SerialName("clinic_id") val clinicId: String,
    @SerialName("doctor_id") val doctorId: String? = null,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("patient_name") val patientName: String,
    @SerialName("patient_age") val patientAge: Int? = null,
    @SerialName("patient_gender") val patientGender: String? = null,
    @SerialName("patient_mobile") val patientMobile: String,
    @SerialName("patient_email") val patientEmail: String? = null,
    @SerialName("payment_status") val paymentStatus: String = "paid",
    @SerialName("checkin_status") val checkinStatus: String = "checked_in",
    @SerialName("appointment_date") val appointmentDate: String,
    @SerialName("appointment_time") val appointmentTime: String,
    @SerialName("fee_amount") val feeAmount: Double = 0.0,
    @SerialName("is_walkin") val isWalkin: Boolean = false,
    @SerialName("opt_in_early_call") val optInEarlyCall: Boolean = false
)

@Serializable
data class QueueEntryInsertDto(
    @SerialName("id") val id: String,
    @SerialName("appointment_id") val appointmentId: String,
    @SerialName("clinic_id") val clinicId: String,
    @SerialName("doctor_id") val doctorId: String? = null,
    @SerialName("queue_position") val queuePosition: Int,
    @SerialName("status") val status: String = "waiting",
    @SerialName("completed_at") val completedAt: String? = null
)

@Serializable
data class ProfileInsertDto(
    @SerialName("id") val id: String,
    @SerialName("email") val email: String,
    @SerialName("full_name") val fullName: String,
    @SerialName("role") val role: String = "patient",
    @SerialName("phone") val phone: String? = null,
    @SerialName("gender") val gender: String? = null,
    @SerialName("age") val age: Int? = null
)

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
            val detIdEmail = emailTrimmed?.let { com.dactor.clinic.domain.util.PatientIdentitySync.getDeterministicPatientIdForEmail(it) }
            val detIdPhone = mobileTrimmed?.let { com.dactor.clinic.domain.util.PatientIdentitySync.getDeterministicPatientIdForPhone(it) }

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
                            if (detIdEmail != null) eq("user_id", detIdEmail)
                            if (detIdPhone != null) eq("user_id", detIdPhone)
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
            val cleanPhone = appointment.patientMobile.filter { it.isDigit() }.takeLast(10)
            val deterministicProfileId = when {
                cleanEmail != null -> com.dactor.clinic.domain.util.PatientIdentitySync.getDeterministicPatientIdForEmail(cleanEmail)
                cleanPhone.length == 10 -> com.dactor.clinic.domain.util.PatientIdentitySync.getDeterministicPatientIdForPhone(cleanPhone)
                else -> null
            }
            var resolvedUserId = appointment.userId?.takeIf { isValidUuid(it) } ?: deterministicProfileId

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
                        try {
                            supabaseClient.postgrest["profiles"].update({
                                if (appointment.patientMobile.isNotBlank()) set("phone", appointment.patientMobile.trim())
                                if (appointment.patientName.isNotBlank()) set("full_name", appointment.patientName.trim())
                                if (!appointment.patientGender.isNullOrBlank()) set("gender", appointment.patientGender)
                                if (appointment.patientAge != null && appointment.patientAge > 0) set("age", appointment.patientAge)
                            }) {
                                filter { eq("id", existingProfile.id) }
                            }
                        } catch (ignored: Exception) {}
                    } else {
                        val targetProfileId = resolvedUserId ?: deterministicProfileId ?: UUID.randomUUID().toString()
                        val profileDto = ProfileInsertDto(
                            id = targetProfileId,
                            email = cleanEmail,
                            fullName = appointment.patientName.trim(),
                            role = "patient",
                            phone = appointment.patientMobile.trim(),
                            gender = appointment.patientGender?.takeIf { it.isNotBlank() },
                            age = appointment.patientAge?.takeIf { it > 0 }
                        )
                        try {
                            supabaseClient.postgrest["profiles"].upsert(profileDto)
                            resolvedUserId = targetProfileId
                        } catch (e: Exception) {
                            try {
                                supabaseClient.postgrest["profiles"].insert(profileDto)
                                resolvedUserId = targetProfileId
                            } catch (e2: Exception) {
                                resolvedUserId = targetProfileId
                            }
                        }
                    }
                } catch (ignored: Exception) {}
            } else if (cleanPhone.length == 10) {
                // Try matching existing profile by phone number or upsert by phone
                try {
                    val byPhone = supabaseClient.postgrest["profiles"]
                        .select { filter { eq("phone", cleanPhone) } }
                        .decodeList<com.dactor.clinic.data.model.Profile>()
                        .firstOrNull()
                    if (byPhone != null) {
                        resolvedUserId = byPhone.id
                    } else if (deterministicProfileId != null) {
                        val fallbackEmail = "patient_${cleanPhone}@dactor.internal"
                        val profileDto = ProfileInsertDto(
                            id = deterministicProfileId,
                            email = fallbackEmail,
                            fullName = appointment.patientName.trim(),
                            role = "patient",
                            phone = cleanPhone,
                            gender = appointment.patientGender?.takeIf { it.isNotBlank() },
                            age = appointment.patientAge?.takeIf { it > 0 }
                        )
                        try {
                            supabaseClient.postgrest["profiles"].upsert(profileDto)
                            resolvedUserId = deterministicProfileId
                        } catch (_: Exception) {}
                    }
                } catch (ignored: Exception) {}
            }

            // Retroactively update past appointments matching this email or phone so they sync to the same patient id
            if (!resolvedUserId.isNullOrBlank()) {
                try {
                    if (cleanEmail != null) {
                        supabaseClient.postgrest["appointments"].update({
                            set("user_id", resolvedUserId)
                        }) {
                            filter { ilike("patient_email", cleanEmail) }
                        }
                    }
                    if (cleanPhone.length == 10) {
                        supabaseClient.postgrest["appointments"].update({
                            set("user_id", resolvedUserId)
                        }) {
                            filter { eq("patient_mobile", appointment.patientMobile.trim()) }
                        }
                    }
                } catch (ignored: Exception) {}
            }

            val apptId = if (isValidUuid(appointment.id)) appointment.id else UUID.randomUUID().toString()
            val validSlotId = appointment.slotId?.takeIf { isValidUuid(it) }
            val validDoctorId = appointment.doctorId?.takeIf { isValidUuid(it) }
            val normalizedTime = normalizeTimeForPostgres(appointment.appointmentTime)

            // ==========================================
            // IDEMPOTENCY SAFETY GUARDS
            // ==========================================
            // 1. If an appointment already exists with this ID, return it immediately
            if (isValidUuid(appointment.id)) {
                try {
                    val existingById = supabaseClient.postgrest["appointments"]
                        .select { filter { eq("id", appointment.id) } }
                        .decodeList<Appointment>()
                        .firstOrNull()
                    if (existingById != null) {
                        return@withContext existingById
                    }
                } catch (ignored: Exception) {}
            }

            // 2. If an appointment already exists with this 10-digit tracking code, return it
            if (trackingCode.isNotBlank()) {
                try {
                    val existingByCode = supabaseClient.postgrest["appointments"]
                        .select { filter { eq("tracking_code_10_digit", trackingCode.trim()) } }
                        .decodeList<Appointment>()
                        .firstOrNull()
                    if (existingByCode != null) {
                        return@withContext existingByCode
                    }
                } catch (ignored: Exception) {}
            }

            // 3. Deduplication guard against rapid double-taps on reception tablet
            if (validSlotId != null && appointment.patientMobile.isNotBlank() && appointment.appointmentDate.isNotBlank()) {
                try {
                    val existingDup = supabaseClient.postgrest["appointments"]
                        .select {
                            filter {
                                eq("clinic_id", appointment.clinicId)
                                eq("slot_id", validSlotId)
                                eq("patient_mobile", appointment.patientMobile.trim())
                                eq("appointment_date", appointment.appointmentDate)
                            }
                        }
                        .decodeList<Appointment>()
                        .firstOrNull()
                    if (existingDup != null) {
                        return@withContext existingDup
                    }
                } catch (ignored: Exception) {}
            }

            val insertDto = AppointmentInsertDto(
                id = apptId,
                trackingCode10Digit = trackingCode,
                slotId = validSlotId,
                clinicId = appointment.clinicId,
                doctorId = validDoctorId,
                userId = resolvedUserId,
                patientName = appointment.patientName.trim(),
                patientAge = appointment.patientAge,
                patientGender = appointment.patientGender,
                patientMobile = appointment.patientMobile.trim(),
                patientEmail = cleanEmail ?: appointment.patientEmail?.trim()?.ifBlank { null },
                paymentStatus = appointment.paymentStatus ?: "paid",
                checkinStatus = "checked_in",
                appointmentDate = appointment.appointmentDate,
                appointmentTime = normalizedTime,
                feeAmount = appointment.feeAmount,
                isWalkin = true,
                optInEarlyCall = appointment.optInEarlyCall
            )

            // Insert appointment (with fallback if userId or slotId FK fails)
            val created = try {
                supabaseClient.postgrest["appointments"]
                    .insert(insertDto) { select() }
                    .decodeSingleOrNull<Appointment>()
            } catch (fkEx: Exception) {
                try {
                    val withoutUser = insertDto.copy(userId = null)
                    supabaseClient.postgrest["appointments"]
                        .insert(withoutUser) { select() }
                        .decodeSingleOrNull<Appointment>()
                } catch (fkEx2: Exception) {
                    val minimalDto = insertDto.copy(userId = null, slotId = null)
                    supabaseClient.postgrest["appointments"]
                        .insert(minimalDto) { select() }
                        .decodeSingleOrNull<Appointment>()
                }
            } ?: appointment.copy(
                id = apptId,
                trackingCode10Digit = trackingCode,
                slotId = validSlotId,
                doctorId = validDoctorId,
                userId = resolvedUserId,
                patientEmail = cleanEmail ?: appointment.patientEmail,
                paymentStatus = "paid",
                checkinStatus = "checked_in",
                appointmentTime = normalizedTime,
                isWalkin = true
            )

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

            // Compute slot-aware queue position:
            // Put the walkin patient in the last position of their specific time slot,
            // and shift all patients in subsequent time slots down (+1).
            try {
                val activeQueue = supabaseClient.postgrest["queue_entries"]
                    .select {
                        filter {
                            eq("clinic_id", created.clinicId)
                            or {
                                eq("status", "waiting")
                                eq("status", "inside")
                            }
                        }
                    }
                    .decodeList<QueueEntry>()
                val alreadyInQueue = activeQueue.any { it.appointmentId == created.id }
                if (!alreadyInQueue) {
                    val targetSlotMinutes = parseTimeToMinutes(created.appointmentTime)
                    val activeAppts = try {
                        supabaseClient.postgrest["appointments"]
                            .select {
                                filter {
                                    eq("clinic_id", created.clinicId)
                                }
                            }
                            .decodeList<Appointment>()
                    } catch (e: Exception) {
                        emptyList()
                    }
                    val apptMap = activeAppts.associateBy { it.id }

                    // Preceding entries: patient inside cabin OR patients in earlier or same time slot
                    val precedingEntries = activeQueue.filter { entry ->
                        if (entry.status == "inside") return@filter true
                        val appt = apptMap[entry.appointmentId]
                        val slotMins = parseTimeToMinutes(appt?.appointmentTime)
                        slotMins <= targetSlotMinutes
                    }

                    val insertPos = (precedingEntries.maxOfOrNull { it.queuePosition } ?: precedingEntries.size) + 1

                    // Shift all entries with queuePosition >= insertPos down by 1 in descending order
                    val laterEntries = activeQueue
                        .filter { it.queuePosition >= insertPos }
                        .sortedByDescending { it.queuePosition }

                    for (later in laterEntries) {
                        val shiftedPos = later.queuePosition + 1
                        try {
                            supabaseClient.postgrest["queue_entries"]
                                .update({ set("queue_position", shiftedPos) }) {
                                    filter { eq("id", later.id) }
                                }
                        } catch (shiftErr: Exception) {
                            shiftErr.printStackTrace()
                        }
                    }

                    // Insert the new walkin entry at insertPos
                    val cleanDoctorId = created.doctorId?.takeIf { isValidUuid(it) }
                    val queueEntryDto = QueueEntryInsertDto(
                        id = UUID.randomUUID().toString(),
                        appointmentId = created.id,
                        clinicId = created.clinicId,
                        doctorId = cleanDoctorId,
                        queuePosition = insertPos,
                        status = "waiting"
                    )
                    try {
                        supabaseClient.postgrest["queue_entries"].insert(queueEntryDto)
                    } catch (qErr: Exception) {
                        try {
                            // Retry without doctorId in case of FK or UUID constraint mismatch
                            val fallbackDto = queueEntryDto.copy(doctorId = null)
                            supabaseClient.postgrest["queue_entries"].insert(fallbackDto)
                        } catch (qErr2: Exception) {
                            qErr2.printStackTrace()
                        }
                    }

                    // Reindex active queue chronologically to ensure clean contiguous numbering
                    reindexActiveQueueChronologically(created.clinicId)
                }
            } catch (qEx: Exception) {
                qEx.printStackTrace()
            }

            created
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun rescheduleAppointment(id: String, newDate: String, newTime: String, newSlotId: String?): Boolean = withContext(Dispatchers.IO) {
        try {
            val normalizedTime = normalizeTimeForPostgres(newTime)
            supabaseClient.postgrest["appointments"]
                .update({
                    set("appointment_date", newDate)
                    set("appointment_time", normalizedTime)
                    if (newSlotId != null && isValidUuid(newSlotId)) set("slot_id", newSlotId)
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
                val newEntryDto = QueueEntryInsertDto(
                    id = UUID.randomUUID().toString(),
                    appointmentId = appointmentId,
                    clinicId = clinicId,
                    doctorId = doctorId,
                    queuePosition = 0,
                    status = "done",
                    completedAt = now
                )
                supabaseClient.postgrest["queue_entries"].insert(newEntryDto)
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
                                set("called_at", now)
                                if (!doctorId.isNullOrBlank()) set("doctor_id", doctorId)
                            }) {
                                filter { eq("id", nextWaiting.id) }
                            }
                        try {
                            supabaseClient.postgrest["queue_entries"]
                                .update({ set("inside_at", now) }) {
                                    filter { eq("id", nextWaiting.id) }
                                }
                        } catch (ignored: Exception) {}
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
                    val queueEntryDto = QueueEntryInsertDto(
                        id = UUID.randomUUID().toString(),
                        appointmentId = appt.id,
                        clinicId = appt.clinicId,
                        doctorId = doctorId,
                        queuePosition = 999999,
                        status = "waiting"
                    )
                    supabaseClient.postgrest["queue_entries"].insert(queueEntryDto)
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
            // 1. Patient inside consultation cabin strictly maintains position #1
            // 2. Patients in earlier time slots (e.g. 2-3 PM) precede later time slots (3-4 PM).
            // 3. Within the same time slot, preserve relative queue position.
            val sortedEntries = activeEntries.sortedWith(
                compareBy<QueueEntry> { if (it.status == "inside") 0 else 1 }
                    .thenBy { entry ->
                        val appt = apptMap[entry.appointmentId]
                        parseTimeToMinutes(appt?.appointmentTime)
                    }.thenBy { it.queuePosition }
            )

            // Safe two-pass update to eliminate duplicate key collision
            for (entry in sortedEntries) {
                try {
                    supabaseClient.postgrest["queue_entries"]
                        .update({ set("queue_position", - (entry.queuePosition + 10000)) }) {
                            filter { eq("id", entry.id) }
                        }
                } catch (ignored: Exception) {}
            }

            sortedEntries.forEachIndexed { index, entry ->
                val newPos = index + 1
                try {
                    supabaseClient.postgrest["queue_entries"]
                        .update({ set("queue_position", newPos) }) {
                            filter { eq("id", entry.id) }
                        }
                } catch (ignored: Exception) {}
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    companion object {
        fun isValidUuid(str: String?): Boolean {
            if (str.isNullOrBlank()) return false
            return try {
                UUID.fromString(str.trim())
                true
            } catch (_: Exception) {
                false
            }
        }

        fun normalizeTimeForPostgres(timeStr: String?): String {
            if (timeStr.isNullOrBlank()) return "09:30:00"
            return try {
                val clean = timeStr.trim()
                val firstPart = clean.split("-").first().trim()
                val isPm = firstPart.contains("PM", ignoreCase = true) || (!firstPart.contains("AM", ignoreCase = true) && clean.contains("PM", ignoreCase = true) && !clean.substringBefore("-").contains("AM", ignoreCase = true))
                val isAm = firstPart.contains("AM", ignoreCase = true)
                val match = Regex("(\\d{1,2})(?::(\\d{2}))?").find(firstPart)
                if (match != null) {
                    var h = match.groupValues[1].toIntOrNull() ?: 9
                    val m = match.groupValues[2].takeIf { it.isNotEmpty() }?.toIntOrNull() ?: 0
                    if (isPm && h < 12) h += 12
                    if (isAm && h == 12) h = 0
                    h = h.coerceIn(0, 23)
                    val safeM = m.coerceIn(0, 59)
                    String.format(java.util.Locale.US, "%02d:%02d:00", h, safeM)
                } else {
                    "09:30:00"
                }
            } catch (_: Exception) {
                "09:30:00"
            }
        }

        fun parseTimeToMinutes(timeStr: String?): Int {
            if (timeStr.isNullOrBlank()) return 23 * 60 + 59
            return try {
                val clean = timeStr.trim().uppercase()
                val parts = clean.split("-", "–", "TO")
                val firstPart = parts.first().trim()
                val secondPart = if (parts.size > 1) parts[1].trim() else ""

                val match = Regex("(\\d{1,2})(?::(\\d{2}))?").find(firstPart)
                if (match != null) {
                    var h = match.groupValues[1].toIntOrNull() ?: 12
                    val m = match.groupValues[2].takeIf { it.isNotEmpty() }?.toIntOrNull() ?: 0

                    val firstHasAm = firstPart.contains("AM")
                    val firstHasPm = firstPart.contains("PM")
                    val secondHasAm = secondPart.contains("AM")
                    val secondHasPm = secondPart.contains("PM")

                    val isAm = when {
                        firstHasAm -> true
                        firstHasPm -> false
                        secondHasAm -> true
                        secondHasPm && h in 7..11 -> true
                        else -> false
                    }

                    val isPm = when {
                        firstHasPm -> true
                        firstHasAm -> false
                        secondHasPm && h in 1..6 -> true
                        secondHasPm && h == 12 -> true
                        else -> false
                    }

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
