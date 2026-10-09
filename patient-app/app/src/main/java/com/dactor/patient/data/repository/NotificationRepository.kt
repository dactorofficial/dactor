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
            val list = supabaseClient.postgrest["notifications"]
                .select()
                .decodeList<DactorNotification>()
                .sortedByDescending { it.createdAt }

            if (userId != null || appointmentIds.isNotEmpty()) {
                list.filter { notif ->
                    notif.userId == null ||
                    (userId != null && notif.userId == userId) ||
                    (notif.appointmentId != null && appointmentIds.contains(notif.appointmentId)) ||
                    notif.type == "manual_alert" ||
                    notif.type == "queue_alert"
                }
            } else {
                list
            }
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
