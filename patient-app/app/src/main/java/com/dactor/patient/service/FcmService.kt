package com.dactor.patient.service

import android.content.Context
import android.os.Build
import com.dactor.patient.di.AppModule
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class FcmDeviceTokenPayload(
    @SerialName("token") val token: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("tracking_code") val trackingCode: String? = null,
    @SerialName("patient_mobile") val patientMobile: String? = null,
    @SerialName("device_info") val deviceInfo: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

class FcmService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title
            ?: message.data["title"]
            ?: "Dactor Doctor Alert"

        val body = message.notification?.body
            ?: message.data["message"]
            ?: message.data["body"]
            ?: "Your queue status has been updated by the clinic."

        val appointmentId = message.data["appointment_id"]
        val type = message.data["type"] ?: "queue_alert"
        val notificationId = (System.currentTimeMillis() % 100000).toInt()

        NotificationHelper.showSystemNotification(
            context = applicationContext,
            id = notificationId,
            title = title,
            message = body,
            appointmentId = appointmentId,
            type = type
        )
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        try {
            val prefs = applicationContext.getSharedPreferences("dactor_patient_session", Context.MODE_PRIVATE)
            prefs.edit().putString("fcm_token", token).apply()

            val userId = prefs.getString("patient_id", null)
            val phone = prefs.getString("user_phone", null)
            val rawCodes = prefs.getString("saved_tracking_codes", null) ?: ""
            val trackingCodes = rawCodes.split(";;").mapNotNull { entry ->
                val parts = entry.split("|")
                if (parts.size >= 2 && parts[0].isNotBlank()) parts[0] else null
            }

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val client = AppModule.provideSupabaseClient()
                    val deviceInfo = "Android ${Build.VERSION.RELEASE} (${Build.MANUFACTURER} ${Build.MODEL})"
                    val now = java.time.Instant.now().toString()

                    if (trackingCodes.isEmpty()) {
                        client.postgrest["fcm_tokens"].upsert(
                            FcmDeviceTokenPayload(
                                token = token,
                                userId = userId?.takeIf { it.isNotBlank() },
                                trackingCode = null,
                                patientMobile = phone?.takeIf { it.isNotBlank() },
                                deviceInfo = deviceInfo,
                                updatedAt = now
                            )
                        )
                    } else {
                        for (code in trackingCodes) {
                            client.postgrest["fcm_tokens"].upsert(
                                FcmDeviceTokenPayload(
                                    token = token,
                                    userId = userId?.takeIf { it.isNotBlank() },
                                    trackingCode = code,
                                    patientMobile = phone?.takeIf { it.isNotBlank() },
                                    deviceInfo = deviceInfo,
                                    updatedAt = now
                                )
                            )
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
