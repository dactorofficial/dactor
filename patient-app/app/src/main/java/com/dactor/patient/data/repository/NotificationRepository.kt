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
            try {
                if (!userId.isNullOrBlank() || resolvedIds.isNotEmpty()) {
                    val allAppts = supabaseClient.postgrest["appointments"]
                        .select()
                        .decodeList<com.dactor.patient.data.model.Appointment>()
                    for (appt in allAppts) {
                        val matchesUser = !userId.isNullOrBlank() && appt.userId == userId
                        val matchesTracked = appt.id in resolvedIds || appt.trackingCode10Digit in resolvedIds
                        if (matchesUser || matchesTracked) {
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

                isBroadcastForPatients || isUserSpecific || isAppointmentSpecific || isTargetedAlert
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
}
