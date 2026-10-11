package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Appointment
import com.dactor.patient.data.model.BillingInvoice
import com.dactor.patient.data.model.InvoiceItem
import com.dactor.patient.data.model.Profile
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

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
        val retainedUserId = existing.userId?.takeIf { it.isNotBlank() }
            ?: fallbackUserId?.takeIf { it.isNotBlank() }

        try {
            supabaseClient.postgrest["appointments"].update({
                set("slot_id", slotId)
                set("clinic_id", clinicId)
                if (!doctorId.isNullOrBlank()) set("doctor_id", doctorId)
                if (!retainedUserId.isNullOrBlank()) set("user_id", retainedUserId)
                if (!retainedEmail.isNullOrBlank()) set("patient_email", retainedEmail)
                set("appointment_date", appointmentDate)
                set("appointment_time", appointmentTime)
                set("payment_status", "not_required")
                set("checkin_status", "checked_in")
                set("fee_amount", 0.0)
            }) {
                filter { eq("id", existing.id) }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (!slotId.isNullOrBlank()) {
            try {
                val apptsForSlot = supabaseClient.postgrest["appointments"]
                    .select { filter { eq("slot_id", slotId) } }
                    .decodeList<Appointment>()
                val realCount = apptsForSlot.count { it.checkinStatus != "cancelled" }
                supabaseClient.postgrest["slots"].update({
                    set("booked_count", realCount)
                }) {
                    filter { eq("id", slotId) }
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
            val nextPos = (existingEntries.map { it.queuePosition }.maxOrNull() ?: 0) + 1
            val queueEntry = com.dactor.patient.data.model.QueueEntry(
                id = UUID.randomUUID().toString(),
                appointmentId = existing.id,
                clinicId = clinicId,
                doctorId = doctorId ?: existing.doctorId,
                queuePosition = nextPos,
                status = "waiting"
            )
            supabaseClient.postgrest["queue_entries"].insert(queueEntry)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        existing.copy(
            slotId = slotId,
            clinicId = clinicId,
            doctorId = doctorId ?: existing.doctorId,
            userId = retainedUserId,
            patientEmail = retainedEmail,
            appointmentDate = appointmentDate,
            appointmentTime = appointmentTime,
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
                        supabaseClient.postgrest["appointments"].update(
                            mapOf("user_id" to targetUserId)
                        ) {
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
        var resolvedUserId = appointment.userId?.takeIf { it.isNotBlank() }

        // If an email is given in the appointment:
        // 1. If that email was already used to sign in before, link to that account's profile ID.
        // 2. If that email has never been signed in ever, pre-create a patient profile for that email
        //    so it saves up for future connection when the user later signs in with that email.
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
                    // Backfill missing demographic details on the profile if needed
                    try {
                        if (existingProfile.phone.isNullOrBlank() && appointment.patientMobile.isNotBlank()) {
                            supabaseClient.postgrest["profiles"].update({
                                set("phone", appointment.patientMobile.trim())
                                if (existingProfile.fullName.isNullOrBlank() && appointment.patientName.isNotBlank()) {
                                    set("full_name", appointment.patientName.trim())
                                }
                                if (existingProfile.gender.isNullOrBlank() && !appointment.patientGender.isNullOrBlank()) {
                                    set("gender", appointment.patientGender)
                                }
                                if (existingProfile.age == null && appointment.patientAge != null) {
                                    set("age", appointment.patientAge)
                                }
                            }) {
                                filter { eq("id", existingProfile.id) }
                            }
                        }
                    } catch (ignored: Exception) {}
                } else {
                    val newProfileId = resolvedUserId ?: java.util.UUID.randomUUID().toString()
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

        val normalizedAppt = appointment.copy(
            userId = resolvedUserId,
            patientEmail = cleanEmail
        )

        val created = try {
            supabaseClient.postgrest["appointments"]
                .insert(normalizedAppt) { select() }
                .decodeSingle<Appointment>()
        } catch (e: Exception) {
            e.printStackTrace()
            if (normalizedAppt.userId != null) {
                try {
                    val safeAppt = normalizedAppt.copy(userId = null)
                    supabaseClient.postgrest["appointments"]
                        .insert(safeAppt) { select() }
                        .decodeSingle<Appointment>()
                } catch (retryEx: Exception) {
                    retryEx.printStackTrace()
                    normalizedAppt
                }
            } else {
                normalizedAppt
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
                    val nextPos = (existingEntries.map { it.queuePosition }.maxOrNull() ?: 0) + 1
                    val queueEntry = com.dactor.patient.data.model.QueueEntry(
                        id = java.util.UUID.randomUUID().toString(),
                        appointmentId = created.id,
                        clinicId = created.clinicId,
                        doctorId = created.doctorId,
                        queuePosition = nextPos,
                        status = "waiting"
                    )
                    supabaseClient.postgrest["queue_entries"].insert(queueEntry)
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
            supabaseClient.postgrest["appointments"]
                .update({
                    set("appointment_date", newDate)
                    set("appointment_time", newTime)
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
                val existingQ = supabaseClient.postgrest["queue_entries"]
                    .select { filter { eq("appointment_id", appointmentId) } }
                    .decodeList<com.dactor.patient.data.model.QueueEntry>()
                    .firstOrNull()
                if (existingQ == null) {
                    val existingEntries = supabaseClient.postgrest["queue_entries"]
                        .select { filter { eq("clinic_id", appt.clinicId) } }
                        .decodeList<com.dactor.patient.data.model.QueueEntry>()
                    val nextPos = (existingEntries.map { it.queuePosition }.maxOrNull() ?: 0) + 1
                    val queueEntry = com.dactor.patient.data.model.QueueEntry(
                        id = java.util.UUID.randomUUID().toString(),
                        appointmentId = appt.id,
                        clinicId = appt.clinicId,
                        doctorId = appt.doctorId,
                        queuePosition = nextPos,
                        status = "waiting"
                    )
                    supabaseClient.postgrest["queue_entries"].insert(queueEntry)
                }

                // Record paid billing invoice in billing_invoices
                try {
                    val invId = java.util.UUID.randomUUID().toString()
                    val invoiceMap = mutableMapOf<String, Any>(
                        "id" to invId,
                        "appointment_id" to appointmentId,
                        "clinic_id" to appt.clinicId,
                        "patient_id" to (appt.userId ?: appt.id),
                        "total_amount" to effectiveAmount,
                        "paid_amount" to effectiveAmount,
                        "balance_due" to 0.0,
                        "status" to "paid",
                        "payment_status" to "paid",
                        "remarks" to "Paid NPR ${effectiveAmount.toInt()} via ${paymentGateway.uppercase()} (Txn: $transactionId)",
                        "created_at" to Instant.now().toString()
                    )
                    supabaseClient.postgrest["billing_invoices"].insert(invoiceMap)
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
            try {
                val invoiceId = java.util.UUID.randomUUID().toString()
                val failMap = mutableMapOf<String, Any>(
                    "id" to invoiceId,
                    "appointment_id" to appointmentId,
                    "clinic_id" to (appt?.clinicId ?: ""),
                    "patient_id" to (appt?.userId ?: appt?.id ?: ""),
                    "total_amount" to (appt?.feeAmount ?: 0.0),
                    "paid_amount" to 0.0,
                    "status" to "failed",
                    "payment_status" to "failed",
                    "remarks" to "Transaction failed / cancelled: $reason",
                    "created_at" to Instant.now().toString()
                )
                supabaseClient.postgrest["billing_invoices"].insert(failMap)
            } catch (ignored: Exception) {}

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
}
