package com.dactor.patient.data.repository

import com.dactor.patient.data.model.DactorNotification
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NotificationRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getNotifications(userId: String? = null, appointmentIds: List<String> = emptyList()): List<DactorNotification> = withContext(Dispatchers.IO) {
        try {
            val resolvedIds = appointmentIds.map { it.trim() }.filter { it.isNotBlank() }.toMutableSet()
            val patientAppts = mutableListOf<com.dactor.patient.data.model.Appointment>()
            try {
                if (!userId.isNullOrBlank() || resolvedIds.isNotEmpty()) {
                    val allAppts = supabaseClient.postgrest["appointments"]
                        .select()
                        .decodeList<com.dactor.patient.data.model.Appointment>()
                    for (appt in allAppts) {
                        val matchesUser = !userId.isNullOrBlank() && appt.userId == userId
                        val matchesTracked = appt.id in resolvedIds || appt.trackingCode10Digit in resolvedIds
                        if (matchesUser || matchesTracked) {
                            patientAppts.add(appt)
                            if (appt.id.isNotBlank()) resolvedIds.add(appt.id)
                            if (appt.trackingCode10Digit.isNotBlank()) resolvedIds.add(appt.trackingCode10Digit)
                        }
                    }
                }
            } catch (ignored: Exception) {}

            val list = supabaseClient.postgrest["notifications"]
                .select()
                .decodeList<DactorNotification>()
                .sortedByDescending { it.createdAt }

            val filtered = list.filter { notif ->
                val audience = notif.targetAudience?.lowercase()
                val isTargetedType = notif.type in listOf("manual_alert", "queue_alert", "lab_report", "clinic_break")
                val isBroadcastForPatients = (audience == "all_users" || audience == "patients" || audience == null || notif.type == "broadcast") &&
                    !isTargetedType
                val isUserSpecific = (!userId.isNullOrBlank() && notif.userId == userId)
                val metaCode = notif.toTemplateData().trackingCode
                val isAppointmentSpecific = (notif.appointmentId != null && resolvedIds.contains(notif.appointmentId)) ||
                    (!metaCode.isNullOrBlank() && resolvedIds.contains(metaCode)) ||
                    resolvedIds.any { code -> code.length == 10 && notif.message.contains(code) }
                val isTargetedAlert = isTargetedType && (isUserSpecific || isAppointmentSpecific)

                if (!isBroadcastForPatients && !isUserSpecific && !isAppointmentSpecific && !isTargetedAlert) {
                    return@filter false
                }

                // Doctor notifications: do not surface to completed appointments or patients with no active queue appointment
                val isDoctorNotif = notif.type in listOf("doctor_arrival", "doctor_presence", "clinic_break", "doctor_status") ||
                    notif.title.contains("doctor", ignoreCase = true) ||
                    notif.title.contains("break", ignoreCase = true) ||
                    notif.message.contains("doctor is", ignoreCase = true) ||
                    notif.message.contains("doctor has", ignoreCase = true) ||
                    notif.message.contains("clinic is currently on break", ignoreCase = true)

                if (isDoctorNotif && patientAppts.isNotEmpty()) {
                    val matchedAppt = patientAppts.find { appt ->
                        (notif.appointmentId != null && (appt.id == notif.appointmentId || appt.trackingCode10Digit == notif.appointmentId)) ||
                        (!metaCode.isNullOrBlank() && (appt.id == metaCode || appt.trackingCode10Digit == metaCode))
                    }
                    val isMatchedCompleted = matchedAppt != null && matchedAppt.checkinStatus.lowercase() in listOf("done", "completed", "cancelled")
                    val hasActiveQueueAppt = patientAppts.any {
                        it.checkinStatus.lowercase() in listOf("waiting", "checked_in", "booked", "inside", "pending")
                    }
                    if (isMatchedCompleted || !hasActiveQueueAppt) {
                        return@filter false
                    }
                }

                true
            }.toMutableList()

            // Also surface any prepared lab reports for this patient's appointments/tracking codes
            if (resolvedIds.isNotEmpty()) {
                try {
                    val labReports = supabaseClient.postgrest["lab_reports"]
                        .select()
                        .decodeList<com.dactor.patient.data.model.LabReport>()
                        .filter { it.appointmentId in resolvedIds && it.stage == "prepared" }

                    for (rep in labReports) {
                        val alreadyNotified = filtered.any {
                            it.type == "lab_report" && (it.appointmentId == rep.appointmentId || it.id.contains(rep.id))
                        }
                        if (!alreadyNotified) {
                            filtered.add(
                                0,
                                DactorNotification(
                                    id = "lab_notif_${rep.id}",
                                    userId = userId,
                                    appointmentId = rep.appointmentId,
                                    title = "Lab Report Prepared: ${rep.testName}",
                                    message = "Your diagnostic lab report for '${rep.testName}' is now Prepared. Verify your Name or Mobile Number to view in-app or download the file directly.",
                                    type = "lab_report",
                                    targetAudience = "patients",
                                    isRead = false,
                                    createdAt = rep.preparedAt ?: rep.sampleCollectedAt
                                )
                            )
                        }
                    }
                } catch (ignored: Exception) {}
            }

            filtered.sortedByDescending { it.createdAt ?: "" }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun markAsRead(id: String): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["notifications"]
                .update({
                    set("is_read", true)
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

    suspend fun markAllAsRead(ids: List<String>): Boolean = withContext(Dispatchers.IO) {
        try {
            val validIds = ids.filter { it.isNotBlank() }
            if (validIds.isEmpty()) return@withContext true
            for (chunk in validIds.chunked(30)) {
                supabaseClient.postgrest["notifications"]
                    .update({
                        set("is_read", true)
                    }) {
                        filter {
                            isIn("id", chunk)
                        }
                    }
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
