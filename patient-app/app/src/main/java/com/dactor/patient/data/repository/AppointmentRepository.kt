package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Appointment
import com.dactor.patient.data.model.BillingInvoice
import com.dactor.patient.data.model.InvoiceItem
import com.dactor.patient.data.model.Profile
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
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
    @SerialName("payment_status") val paymentStatus: String = "pending",
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

@Serializable
data class BillingInvoiceInsertDto(
    @SerialName("id") val id: String,
    @SerialName("appointment_id") val appointmentId: String,
    @SerialName("clinic_id") val clinicId: String,
    @SerialName("total_amount") val totalAmount: Double = 0.0,
    @SerialName("paid_amount") val paidAmount: Double = 0.0,
    @SerialName("balance_due") val balanceDue: Double = 0.0,
    @SerialName("payment_status") val paymentStatus: String = "paid",
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("remarks") val remarks: String? = null
)

@Singleton
class AppointmentRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getAppointmentByTrackingCode(code: String): Appointment? = withContext(Dispatchers.IO) {
        try {
            val appts = supabaseClient.postgrest["appointments"]
                .select { filter { eq("tracking_code_10_digit", code.trim()) } }
                .decodeList<Appointment>()
            val appt = appts.maxByOrNull { it.appointmentDate } ?: appts.lastOrNull()
            if (appt != null) {
                val qList = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", appt.id) } }
                    .decodeList<com.dactor.patient.data.model.QueueEntry>()
                val activeOrLatest = qList.firstOrNull { it.status == "waiting" || it.status == "inside" } ?: qList.lastOrNull()
                if (activeOrLatest != null && activeOrLatest.status == "done" && qList.none { it.status == "waiting" || it.status == "inside" }) {
                    return@withContext appt.copy(checkinStatus = "completed")
                }
            }
            appt
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Books a Follow-Up appointment for a multi-visit clinic by retaining all patient details
     * from the existing 10-digit Appointment ID and placing the retained appointment into the live queue.
     */
    suspend fun bookFollowUpAppointment(
        trackingCode: String,
        slotId: String?,
        clinicId: String,
        doctorId: String?,
        appointmentDate: String,
        appointmentTime: String,
        fallbackUserId: String? = null,
        fallbackEmail: String? = null
    ): Appointment? = withContext(Dispatchers.IO) {
        val cleanCode = trackingCode.trim()
        val existing = getAppointmentByTrackingCode(cleanCode) ?: return@withContext null

        val retainedEmail = existing.patientEmail?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
            ?: fallbackEmail?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        val retainedUserId = existing.userId?.takeIf { isValidUuid(it) }
            ?: fallbackUserId?.takeIf { isValidUuid(it) }
        val validSlotId = slotId?.takeIf { isValidUuid(it) }
        val validDoctorId = doctorId?.takeIf { isValidUuid(it) } ?: existing.doctorId?.takeIf { isValidUuid(it) }
        val normalizedTime = normalizeTimeForPostgres(appointmentTime)

        try {
            supabaseClient.postgrest["appointments"].update({
                set("slot_id", validSlotId)
                set("clinic_id", clinicId)
                if (!validDoctorId.isNullOrBlank()) set("doctor_id", validDoctorId)
                if (!retainedUserId.isNullOrBlank()) set("user_id", retainedUserId)
                if (!retainedEmail.isNullOrBlank()) set("patient_email", retainedEmail)
                set("appointment_date", appointmentDate)
                set("appointment_time", normalizedTime)
                set("payment_status", "not_required")
                set("checkin_status", "checked_in")
                set("fee_amount", 0.0)
            }) {
                filter { eq("id", existing.id) }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (!validSlotId.isNullOrBlank()) {
            try {
                val apptsForSlot = supabaseClient.postgrest["appointments"]
                    .select { filter { eq("slot_id", validSlotId) } }
                    .decodeList<Appointment>()
                val realCount = apptsForSlot.count { it.checkinStatus != "cancelled" }
                supabaseClient.postgrest["slots"].update({
                    set("booked_count", realCount)
                }) {
                    filter { eq("id", validSlotId) }
                }
            } catch (ignored: Exception) {}
        }

        // Remove any completed/old queue entries for this appointment and insert fresh waiting queue entry
        try {
            supabaseClient.postgrest["queue_entries"].delete {
                filter { eq("appointment_id", existing.id) }
            }
        } catch (ignored: Exception) {}

        try {
            val existingEntries = supabaseClient.postgrest["queue_entries"]
                .select { filter { eq("clinic_id", clinicId) } }
                .decodeList<com.dactor.patient.data.model.QueueEntry>()
            val nextPos = (existingEntries
                .filter { it.status == "waiting" || it.status == "inside" }
                .maxOfOrNull { it.queuePosition } ?: 0) + 1
            val queueEntryDto = QueueEntryInsertDto(
                id = UUID.randomUUID().toString(),
                appointmentId = existing.id,
                clinicId = clinicId,
                doctorId = validDoctorId,
                queuePosition = nextPos,
                status = "waiting"
            )
            supabaseClient.postgrest["queue_entries"].insert(queueEntryDto)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        existing.copy(
            slotId = validSlotId,
            clinicId = clinicId,
            doctorId = validDoctorId,
            userId = retainedUserId,
            patientEmail = retainedEmail,
            appointmentDate = appointmentDate,
            appointmentTime = normalizedTime,
            paymentStatus = "not_required",
            checkinStatus = "checked_in",
            feeAmount = 0.0
        )
    }

    suspend fun getAppointmentById(id: String): Appointment? = withContext(Dispatchers.IO) {
        try {
            val appts = supabaseClient.postgrest["appointments"]
                .select { filter { eq("id", id) } }
                .decodeList<Appointment>()
            val appt = appts.firstOrNull()
            if (appt != null) {
                val qList = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", appt.id) } }
                    .decodeList<com.dactor.patient.data.model.QueueEntry>()
                if (qList.any { it.status == "done" }) {
                    return@withContext appt.copy(checkinStatus = "completed")
                }
            }
            appt
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getUserAppointments(userId: String): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val appts = supabaseClient.postgrest["appointments"]
                .select { filter { eq("user_id", userId) } }
                .decodeList<Appointment>()
            if (appts.isEmpty()) return@withContext emptyList()
            val queueEntries = supabaseClient.postgrest["queue_entries"]
                .select()
                .decodeList<com.dactor.patient.data.model.QueueEntry>()
            val doneIds = queueEntries.filter { it.status == "done" }.map { it.appointmentId }.toSet()
            appts.map {
                if (doneIds.contains(it.id)) it.copy(checkinStatus = "completed") else it
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    /**
     * Comprehensive lookup that finds all appointments belonging to a patient across:
     * - user_id (direct or resolved via profiles table by email)
     * - patient_email
     * - patient_mobile
     * - saved 10-digit tracking codes
     */
    suspend fun getAllPatientAppointments(
        userId: String?,
        email: String?,
        phone: String?,
        trackingCodes: List<String> = emptyList()
    ): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val collected = mutableListOf<Appointment>()
            var resolvedProfileId: String? = null

            // 1. Direct userId lookup (if valid UUID)
            if (!userId.isNullOrBlank()) {
                try {
                    java.util.UUID.fromString(userId)
                    resolvedProfileId = userId
                } catch (ignored: Exception) {}
                try {
                    val byUid = supabaseClient.postgrest["appointments"]
                        .select { filter { eq("user_id", userId) } }
                        .decodeList<Appointment>()
                    collected.addAll(byUid)
                } catch (ignored: Exception) {}
            }

            // 2. Resolve profile.id by email (case-insensitive) + match patient_email
            val cleanEmail = email?.trim()?.lowercase()
            if (!cleanEmail.isNullOrBlank()) {
                try {
                    val profiles = try {
                        supabaseClient.postgrest["profiles"]
                            .select { filter { ilike("email", cleanEmail) } }
                            .decodeList<Profile>()
                    } catch (e: Exception) {
                        supabaseClient.postgrest["profiles"]
                            .select { filter { eq("email", cleanEmail) } }
                            .decodeList<Profile>()
                    }
                    val profileId = profiles.firstOrNull()?.id
                    if (!profileId.isNullOrBlank()) {
                        resolvedProfileId = profileId
                        if (profileId != userId) {
                            val byProfileId = supabaseClient.postgrest["appointments"]
                                .select { filter { eq("user_id", profileId) } }
                                .decodeList<Appointment>()
                            collected.addAll(byProfileId)
                        }
                    }
                    val profilePhone = profiles.firstOrNull()?.phone?.trim()
                    if (!profilePhone.isNullOrBlank()) {
                        val byProfilePhone = supabaseClient.postgrest["appointments"]
                            .select { filter { eq("patient_mobile", profilePhone) } }
                            .decodeList<Appointment>()
                        collected.addAll(byProfilePhone)
                    }
                } catch (ignored: Exception) {}

                try {
                    val byEmail = try {
                        supabaseClient.postgrest["appointments"]
                            .select { filter { ilike("patient_email", cleanEmail) } }
                            .decodeList<Appointment>()
                    } catch (e: Exception) {
                        supabaseClient.postgrest["appointments"]
                            .select { filter { eq("patient_email", cleanEmail) } }
                            .decodeList<Appointment>()
                    }
                    collected.addAll(byEmail)
                } catch (ignored: Exception) {}
            }

            // 3. Match by phone number
            val cleanPhone = phone?.trim()
            if (!cleanPhone.isNullOrBlank()) {
                try {
                    val byPhone = supabaseClient.postgrest["appointments"]
                        .select { filter { eq("patient_mobile", cleanPhone) } }
                        .decodeList<Appointment>()
                    collected.addAll(byPhone)
                } catch (ignored: Exception) {}
            }

            // 4. Match by saved 10-digit tracking codes
            val cleanCodes = trackingCodes.map { it.trim() }.filter { it.isNotBlank() }.distinct()
            if (cleanCodes.isNotEmpty()) {
                try {
                    val byCodes = supabaseClient.postgrest["appointments"]
                        .select { filter { isIn("tracking_code_10_digit", cleanCodes) } }
                        .decodeList<Appointment>()
                    collected.addAll(byCodes)
                } catch (ignored: Exception) {
                    for (code in cleanCodes) {
                        try {
                            val single = supabaseClient.postgrest["appointments"]
                                .select { filter { eq("tracking_code_10_digit", code) } }
                                .decodeList<Appointment>()
                            collected.addAll(single)
                        } catch (ignoredInner: Exception) {}
                    }
                }
            }

            val distinctAppts = collected.distinctBy { it.id }
            if (distinctAppts.isEmpty()) return@withContext emptyList()

            // Retroactively link any unlinked appointments that matched by email or phone to resolvedProfileId
            val targetUserId = resolvedProfileId
            if (!targetUserId.isNullOrBlank()) {
                val unlinkedIds = distinctAppts
                    .filter { appt ->
                        appt.userId.isNullOrBlank() &&
                        ((!cleanEmail.isNullOrBlank() && appt.patientEmail?.trim()?.equals(cleanEmail, ignoreCase = true) == true) ||
                         (!cleanPhone.isNullOrBlank() && appt.patientMobile.trim() == cleanPhone))
                    }
                    .map { it.id }
                if (unlinkedIds.isNotEmpty()) {
                    try {
                        supabaseClient.postgrest["appointments"].update({
                            set("user_id", targetUserId)
                        }) {
                            filter { isIn("id", unlinkedIds) }
                        }
                    } catch (ignored: Exception) {}
                }
            }

            // Check queue_entries for "done" status
            val doneIds = try {
                val apptIds = distinctAppts.map { it.id }
                supabaseClient.postgrest["queue_entries"]
                    .select { filter { isIn("appointment_id", apptIds) } }
                    .decodeList<com.dactor.patient.data.model.QueueEntry>()
                    .filter { it.status == "done" }
                    .map { it.appointmentId }
                    .toSet()
            } catch (e: Exception) {
                emptySet()
            }

            distinctAppts.map { appt ->
                if (doneIds.contains(appt.id)) appt.copy(checkinStatus = "completed") else appt
            }.sortedByDescending { it.appointmentDate }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun createAppointment(appointment: Appointment): Appointment = withContext(Dispatchers.IO) {
        val cleanEmail = appointment.patientEmail?.trim()?.lowercase()?.takeIf { it.isNotBlank() }
        var resolvedUserId = appointment.userId?.takeIf { isValidUuid(it) }

        if (cleanEmail != null) {
            try {
                val existingProfile = try {
                    supabaseClient.postgrest["profiles"]
                        .select { filter { ilike("email", cleanEmail) } }
                        .decodeList<Profile>()
                        .firstOrNull()
                } catch (e: Exception) {
                    supabaseClient.postgrest["profiles"]
                        .select { filter { eq("email", cleanEmail) } }
                        .decodeList<Profile>()
                        .firstOrNull()
                }

                if (existingProfile != null) {
                    resolvedUserId = existingProfile.id
                    try {
                        if (existingProfile.phone.isNullOrBlank() && appointment.patientMobile.isNotBlank()) {
                            supabaseClient.postgrest["profiles"].update({
                                set("phone", appointment.patientMobile.trim())
                                if (existingProfile.fullName.isNullOrBlank() && appointment.patientName.isNotBlank()) {
                                    set("full_name", appointment.patientName.trim())
                                }
                                if (existingProfile.gender.isNullOrBlank() && appointment.patientGender.isNotBlank()) {
                                    set("gender", appointment.patientGender)
                                }
                                if (existingProfile.age == null && appointment.patientAge > 0) {
                                    set("age", appointment.patientAge)
                                }
                            }) {
                                filter { eq("id", existingProfile.id) }
                            }
                        }
                    } catch (ignored: Exception) {}
                } else {
                    val newProfileId = resolvedUserId ?: java.util.UUID.randomUUID().toString()
                    try {
                        val profileDto = ProfileInsertDto(
                            id = newProfileId,
                            email = cleanEmail,
                            fullName = appointment.patientName.trim(),
                            role = "patient",
                            phone = appointment.patientMobile.trim(),
                            gender = appointment.patientGender.takeIf { it.isNotBlank() },
                            age = appointment.patientAge.takeIf { it > 0 }
                        )
                        supabaseClient.postgrest["profiles"].insert(profileDto)
                        resolvedUserId = newProfileId
                    } catch (e: Exception) {
                        resolvedUserId = null
                    }
                }
            } catch (ignored: Exception) {}
        } else if (appointment.patientMobile.isNotBlank()) {
            try {
                val byPhone = supabaseClient.postgrest["profiles"]
                    .select { filter { eq("phone", appointment.patientMobile.trim()) } }
                    .decodeList<Profile>()
                    .firstOrNull()
                if (byPhone != null) {
                    resolvedUserId = byPhone.id
                }
            } catch (ignored: Exception) {}
        }

        val apptId = if (isValidUuid(appointment.id)) appointment.id else UUID.randomUUID().toString()
        val validSlotId = appointment.slotId?.takeIf { isValidUuid(it) }
        val validDoctorId = appointment.doctorId?.takeIf { isValidUuid(it) }
        val normalizedTime = normalizeTimeForPostgres(appointment.appointmentTime)

        val insertDto = AppointmentInsertDto(
            id = apptId,
            trackingCode10Digit = appointment.trackingCode10Digit,
            slotId = validSlotId,
            clinicId = appointment.clinicId,
            doctorId = validDoctorId,
            userId = resolvedUserId,
            patientName = appointment.patientName.trim(),
            patientAge = appointment.patientAge.takeIf { it > 0 },
            patientGender = appointment.patientGender.takeIf { it.isNotBlank() },
            patientMobile = appointment.patientMobile.trim(),
            patientEmail = cleanEmail,
            paymentStatus = appointment.paymentStatus.ifBlank { "pending" },
            checkinStatus = appointment.checkinStatus.ifBlank { "checked_in" },
            appointmentDate = appointment.appointmentDate,
            appointmentTime = normalizedTime,
            feeAmount = appointment.feeAmount,
            isWalkin = appointment.isWalkin,
            optInEarlyCall = appointment.optInEarlyCall
        )

        val normalizedAppt = appointment.copy(
            id = apptId,
            slotId = validSlotId,
            doctorId = validDoctorId,
            userId = resolvedUserId,
            patientEmail = cleanEmail,
            appointmentTime = normalizedTime
        )

        val created = try {
            supabaseClient.postgrest["appointments"]
                .insert(insertDto) { select() }
                .decodeSingle<Appointment>()
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                val withoutUser = insertDto.copy(userId = null)
                supabaseClient.postgrest["appointments"]
                    .insert(withoutUser) { select() }
                    .decodeSingle<Appointment>()
            } catch (retryEx: Exception) {
                try {
                    val minimalDto = insertDto.copy(userId = null, slotId = null)
                    supabaseClient.postgrest["appointments"]
                        .insert(minimalDto) { select() }
                        .decodeSingle<Appointment>()
                } catch (finalEx: Exception) {
                    finalEx.printStackTrace()
                    normalizedAppt
                }
            }
        }

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

        // Direct Queue Placement: Automatically place appointment into live queue_entries ONLY if payment is already confirmed or free
        if (created.paymentStatus != "pending") {
            try {
                val existingQ = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", created.id) } }
                    .decodeList<com.dactor.patient.data.model.QueueEntry>()
                    .firstOrNull()
                if (existingQ == null) {
                    val existingEntries = supabaseClient.postgrest["queue_entries"]
                        .select { filter { eq("clinic_id", created.clinicId) } }
                        .decodeList<com.dactor.patient.data.model.QueueEntry>()
                    val nextPos = (existingEntries
                        .filter { it.status == "waiting" || it.status == "inside" }
                        .maxOfOrNull { it.queuePosition } ?: 0) + 1
                    val queueEntryDto = QueueEntryInsertDto(
                        id = java.util.UUID.randomUUID().toString(),
                        appointmentId = created.id,
                        clinicId = created.clinicId,
                        doctorId = created.doctorId,
                        queuePosition = nextPos,
                        status = "waiting"
                    )
                    supabaseClient.postgrest["queue_entries"].insert(queueEntryDto)
                    supabaseClient.postgrest["appointments"]
                        .update({ set("checkin_status", "checked_in") }) {
                            filter { eq("id", created.id) }
                        }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            created.copy(checkinStatus = "checked_in")
        } else {
            created
        }
    }

    suspend fun rescheduleAppointment(id: String, newDate: String, newTime: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val normalizedTime = normalizeTimeForPostgres(newTime)
            supabaseClient.postgrest["appointments"]
                .update({
                    set("appointment_date", newDate)
                    set("appointment_time", normalizedTime)
                    set("checkin_status", "checked_in")
                }) {
                    filter { eq("id", id) }
                }
            if (newDate != java.time.LocalDate.now().toString()) {
                try {
                    supabaseClient.postgrest["queue_entries"].delete {
                        filter { eq("appointment_id", id) }
                    }
                } catch (ignored: Exception) {}
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun cancelAppointment(id: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["appointments"]
                .update({
                    set("checkin_status", "cancelled")
                }) {
                    filter { eq("id", id) }
                }
            try {
                supabaseClient.postgrest["queue_entries"].delete {
                    filter { eq("appointment_id", id) }
                }
            } catch (ignored: Exception) {}
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun claimAppointment(appointmentId: String, userId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["appointments"]
                .update({
                    set("user_id", userId)
                }) {
                    filter { eq("id", appointmentId) }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun confirmPaymentAndJoinQueue(
        appointmentId: String,
        transactionId: String = "",
        paymentGateway: String = "esewa",
        paidAmount: Double? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val appt = supabaseClient.postgrest["appointments"]
                .select { filter { eq("id", appointmentId) } }
                .decodeList<Appointment>()
                .firstOrNull()

            val effectiveAmount = paidAmount ?: appt?.feeAmount ?: 0.0

            supabaseClient.postgrest["appointments"]
                .update({
                    set("payment_status", "paid")
                    set("checkin_status", "checked_in")
                    set("fee_amount", effectiveAmount)
                }) {
                    filter { eq("id", appointmentId) }
                }

            if (appt != null) {
                // Ensure slot booked count is correct
                if (appt.slotId != null) {
                    try {
                        val apptsForSlot = supabaseClient.postgrest["appointments"]
                            .select { filter { eq("slot_id", appt.slotId) } }
                            .decodeList<Appointment>()
                        val realCount = apptsForSlot.count { it.checkinStatus != "cancelled" && it.paymentStatus != "failed" }
                        supabaseClient.postgrest["slots"].update({
                            set("booked_count", realCount)
                        }) {
                            filter { eq("id", appt.slotId) }
                        }
                    } catch (ignored: Exception) {}
                }

                // Place into queue_entries
                try {
                    val existingQ = supabaseClient.postgrest["queue_entries"]
                        .select { filter { eq("appointment_id", appointmentId) } }
                        .decodeList<com.dactor.patient.data.model.QueueEntry>()
                        .firstOrNull()
                    if (existingQ == null) {
                        val existingEntries = supabaseClient.postgrest["queue_entries"]
                            .select { filter { eq("clinic_id", appt.clinicId) } }
                            .decodeList<com.dactor.patient.data.model.QueueEntry>()
                        val nextPos = (existingEntries
                            .filter { it.status == "waiting" || it.status == "inside" }
                            .maxOfOrNull { it.queuePosition } ?: 0) + 1
                        val queueEntryDto = QueueEntryInsertDto(
                            id = java.util.UUID.randomUUID().toString(),
                            appointmentId = appt.id,
                            clinicId = appt.clinicId,
                            doctorId = appt.doctorId,
                            queuePosition = nextPos,
                            status = "waiting"
                        )
                        supabaseClient.postgrest["queue_entries"].insert(queueEntryDto)
                    }
                } catch (qEx: Exception) {
                    qEx.printStackTrace()
                }

                // Record paid billing invoice in billing_invoices
                try {
                    val invId = java.util.UUID.randomUUID().toString()
                    val invoiceDto = BillingInvoiceInsertDto(
                        id = invId,
                        appointmentId = appointmentId,
                        clinicId = appt.clinicId,
                        totalAmount = effectiveAmount,
                        paidAmount = effectiveAmount,
                        balanceDue = 0.0,
                        paymentStatus = "paid",
                        paidAt = Instant.now().toString(),
                        remarks = "Paid NPR ${effectiveAmount.toInt()} via ${paymentGateway.uppercase()} (Txn: $transactionId)"
                    )
                    supabaseClient.postgrest["billing_invoices"].insert(invoiceDto)
                } catch (ignored: Exception) {}
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun failOrCancelPaymentTransaction(
        appointmentId: String,
        reason: String = "Transaction cancelled by patient",
        transactionId: String? = null,
        paymentGateway: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val appt = supabaseClient.postgrest["appointments"]
                .select { filter { eq("id", appointmentId) } }
                .decodeList<Appointment>()
                .firstOrNull()

            supabaseClient.postgrest["appointments"]
                .update({
                    set("payment_status", "failed")
                    set("checkin_status", "cancelled")
                }) {
                    filter { eq("id", appointmentId) }
                }

            // Remove from queue entries if any was inserted
            try {
                supabaseClient.postgrest["queue_entries"].delete {
                    filter { eq("appointment_id", appointmentId) }
                }
            } catch (ignored: Exception) {}

            // Decrement / fix slot booked count
            if (appt?.slotId != null) {
                try {
                    val apptsForSlot = supabaseClient.postgrest["appointments"]
                        .select { filter { eq("slot_id", appt.slotId) } }
                        .decodeList<Appointment>()
                    val realCount = apptsForSlot.count { it.checkinStatus != "cancelled" && it.paymentStatus != "failed" }
                    supabaseClient.postgrest["slots"].update({
                        set("booked_count", realCount)
                    }) {
                        filter { eq("id", appt.slotId) }
                    }
                } catch (ignored: Exception) {}
            }

            // Record failed invoice in billing_invoices
            if (appt != null) {
                try {
                    val invoiceId = java.util.UUID.randomUUID().toString()
                    val failDto = BillingInvoiceInsertDto(
                        id = invoiceId,
                        appointmentId = appointmentId,
                        clinicId = appt.clinicId,
                        totalAmount = appt.feeAmount,
                        paidAmount = 0.0,
                        balanceDue = appt.feeAmount,
                        paymentStatus = "failed",
                        remarks = "Transaction failed / cancelled: $reason"
                    )
                    supabaseClient.postgrest["billing_invoices"].insert(failDto)
                } catch (ignored: Exception) {}
            }

            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun getAllPatientTransactions(
        userId: String? = null,
        email: String? = null,
        phone: String? = null,
        trackingCodes: List<String> = emptyList()
    ): List<com.dactor.patient.data.model.PatientTransactionRecord> = withContext(Dispatchers.IO) {
        try {
            val appts = getAllPatientAppointments(userId, email, phone, trackingCodes)
            if (appts.isEmpty()) return@withContext emptyList()

            val apptIds = appts.map { it.id }
            val invoices = getInvoicesForAppointments(apptIds)

            // Resolve clinic names cache
            val clinicIds = appts.map { it.clinicId }.distinct()
            val clinicNames = mutableMapOf<String, String>()
            for (cid in clinicIds) {
                try {
                    val clinicRows = supabaseClient.postgrest["clinics"]
                        .select { filter { eq("id", cid) } }
                        .decodeList<com.dactor.patient.data.model.Clinic>()
                    val cName = clinicRows.firstOrNull()?.name
                    if (!cName.isNullOrBlank()) clinicNames[cid] = cName
                } catch (ignored: Exception) {}
            }

            // Resolve doctor names cache
            val doctorIds = appts.mapNotNull { it.doctorId }.distinct()
            val doctorNames = mutableMapOf<String, String>()
            for (did in doctorIds) {
                try {
                    val docRows = supabaseClient.postgrest["doctors"]
                        .select { filter { eq("id", did) } }
                        .decodeList<com.dactor.patient.data.model.Doctor>()
                    val dName = docRows.firstOrNull()?.fullName
                    if (!dName.isNullOrBlank()) doctorNames[did] = dName
                } catch (ignored: Exception) {}
            }

            appts.map { appt ->
                val inv = invoices[appt.id]
                val amt = inv?.paidAmount?.takeIf { it > 0 }
                    ?: inv?.totalAmount?.takeIf { it > 0 }
                    ?: appt.feeAmount.takeIf { it > 0 }
                    ?: 0.0

                val status = when {
                    appt.paymentStatus == "failed" || inv?.paymentStatus == "failed" -> "failed"
                    appt.paymentStatus == "not_required" -> "free"
                    appt.paymentStatus == "paid" || inv?.paymentStatus == "paid" -> "paid"
                    else -> appt.paymentStatus
                }

                val method = when {
                    inv?.remarks?.contains("bypass", ignoreCase = true) == true -> "Bypass Test"
                    inv?.remarks?.contains("khalti", ignoreCase = true) == true -> "Khalti"
                    inv?.remarks?.contains("fonepay", ignoreCase = true) == true -> "Fonepay"
                    inv?.remarks?.contains("connectips", ignoreCase = true) == true -> "ConnectIPS"
                    inv?.remarks?.contains("esewa", ignoreCase = true) == true -> "eSewa"
                    else -> "eSewa / Digital"
                }

                val txnId = if (inv?.remarks != null && inv.remarks!!.contains("Txn:")) {
                    inv.remarks!!.substringAfter("Txn:").substringBefore(")").trim()
                } else {
                    "TXN-${appt.trackingCode10Digit}"
                }

                com.dactor.patient.data.model.PatientTransactionRecord(
                    id = inv?.id ?: appt.id,
                    appointmentId = appt.id,
                    trackingCode = appt.trackingCode10Digit,
                    clinicName = clinicNames[appt.clinicId] ?: "Medical Clinic",
                    doctorName = doctorNames[appt.doctorId] ?: "Consulting Specialist",
                    patientName = appt.patientName,
                    appointmentDate = appt.appointmentDate,
                    appointmentTime = appt.appointmentTime,
                    amount = amt,
                    paymentStatus = status,
                    paymentMethod = method,
                    transactionId = txnId,
                    createdAt = inv?.paidAt ?: appt.appointmentDate
                )
            }.sortedByDescending { it.appointmentDate }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    /**
     * Safely fetches the billing invoice for an appointment even if multiple rows exist
     * (e.g. one from clinical remarks and one from clinic billing), merging remarks and bill items.
     */
    suspend fun getInvoiceForAppointment(appointmentId: String): BillingInvoice? = withContext(Dispatchers.IO) {
        if (appointmentId.isBlank()) return@withContext null
        try {
            val rows = supabaseClient.postgrest["billing_invoices"]
                .select {
                    filter {
                        eq("appointment_id", appointmentId)
                    }
                }.decodeList<BillingInvoice>()
            if (rows.isEmpty()) return@withContext null
            mergeInvoicesForSameAppointment(rows)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun getInvoicesForAppointments(appointmentIds: List<String>): Map<String, BillingInvoice> = withContext(Dispatchers.IO) {
        val cleanIds = appointmentIds.filter { it.isNotBlank() }.distinct()
        if (cleanIds.isEmpty()) return@withContext emptyMap()
        try {
            val rows = supabaseClient.postgrest["billing_invoices"]
                .select {
                    filter {
                        isIn("appointment_id", cleanIds)
                    }
                }.decodeList<BillingInvoice>()
            rows.groupBy { it.appointmentId }
                .mapNotNull { (apptId, list) ->
                    val merged = mergeInvoicesForSameAppointment(list)
                    if (merged != null) apptId to merged else null
                }
                .toMap()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyMap()
        }
    }

    private fun mergeInvoicesForSameAppointment(rows: List<BillingInvoice>): BillingInvoice? {
        if (rows.isEmpty()) return null
        // Prefer the row that has actual bill amount or line items
        val primary = rows.lastOrNull { it.totalAmount > 0.0 || it.items.isNotEmpty() } ?: rows.last()
        val combinedRemarks = rows.mapNotNull { it.remarks?.trim()?.takeIf { r -> r.isNotBlank() } }
            .distinct()
            .joinToString("\n")
            .ifBlank { null }
        val bestItems = rows.lastOrNull { it.items.isNotEmpty() }?.items ?: primary.items
        return primary.copy(
            items = bestItems,
            remarks = combinedRemarks ?: primary.remarks
        )
    }

    suspend fun getRemarksForAppointment(appointmentId: String): String? = withContext(Dispatchers.IO) {
        try {
            val invoice = getInvoiceForAppointment(appointmentId)
            invoice?.remarks?.ifBlank { null }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Updates or creates a billing invoice record with how much the patient paid and how much is left.
     */
    suspend fun saveOrUpdateInvoicePayment(
        appointment: Appointment,
        existingInvoice: BillingInvoice?,
        totalAmount: Double,
        paidAmount: Double,
        remarks: String? = null
    ): BillingInvoice? = withContext(Dispatchers.IO) {
        try {
            val safeTotal = totalAmount.coerceAtLeast(0.0)
            val safePaid = paidAmount.coerceAtLeast(0.0)
            val balanceLeft = (safeTotal - safePaid).coerceAtLeast(0.0)
            val status = when {
                balanceLeft <= 0.0 && safeTotal > 0.0 -> "paid"
                safePaid > 0.0 -> "partial"
                else -> "pending"
            }
            val nowIso = Instant.now().toString()

            val current = existingInvoice ?: getInvoiceForAppointment(appointment.id)
            if (current != null) {
                val updatedItems = if (current.items.isNotEmpty()) {
                    current.items
                } else {
                    listOf(
                        InvoiceItem(
                            itemName = "Payment Received (${appointment.appointmentDate})",
                            quantity = 1,
                            price = safeTotal,
                            total = safeTotal
                        )
                    )
                }
                val updated = current.copy(
                    items = updatedItems,
                    totalAmount = safeTotal,
                    paidAmount = safePaid,
                    balanceDue = balanceLeft,
                    paymentStatus = status,
                    paidAt = nowIso,
                    remarks = remarks?.ifBlank { current.remarks } ?: current.remarks
                )
                supabaseClient.postgrest["billing_invoices"]
                    .update({
                        set("total_amount", safeTotal)
                        set("paid_amount", safePaid)
                        set("balance_due", balanceLeft)
                        set("payment_status", status)
                        set("paid_at", nowIso)
                        if (!remarks.isNullOrBlank()) {
                            set("remarks", remarks)
                        }
                    }) {
                        filter { eq("appointment_id", appointment.id) }
                    }
                // Sync appointments table fee_amount and payment_status
                try {
                    supabaseClient.postgrest["appointments"].update({
                        set("fee_amount", safeTotal)
                        set("payment_status", status)
                    }) {
                        filter { eq("id", appointment.id) }
                    }
                } catch (ignored: Exception) {}
                updated
            } else {
                val newInvoice = BillingInvoice(
                    id = UUID.randomUUID().toString(),
                    appointmentId = appointment.id,
                    clinicId = appointment.clinicId,
                    items = listOf(
                        InvoiceItem(
                            itemName = "Payment Received (${appointment.appointmentDate})",
                            quantity = 1,
                            price = safeTotal,
                            total = safeTotal
                        )
                    ),
                    totalAmount = safeTotal,
                    paidAmount = safePaid,
                    balanceDue = balanceLeft,
                    paymentStatus = status,
                    paidAt = nowIso,
                    remarks = remarks
                )
                supabaseClient.postgrest["billing_invoices"].insert(newInvoice)
                // Sync appointments table fee_amount and payment_status
                try {
                    supabaseClient.postgrest["appointments"].update({
                        set("fee_amount", safeTotal)
                        set("payment_status", status)
                    }) {
                        filter { eq("id", appointment.id) }
                    }
                } catch (ignored: Exception) {}
                newInvoice
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Used by single-visit duplicate guard: returns all non-cancelled appointments
     * for a given clinic + patient mobile combination.
     */
    suspend fun getAppointmentsByClinicAndMobile(clinicId: String, mobile: String): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["appointments"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                        eq("patient_mobile", mobile)
                    }
                }
                .decodeList<Appointment>()
                .filter { it.checkinStatus != "cancelled" }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
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
    }
}
