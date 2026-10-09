package com.dactor.patient.service

import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

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
        val notificationId = (System.currentTimeMillis() % 100000).toInt()

        NotificationHelper.showSystemNotification(
            context = applicationContext,
            id = notificationId,
            title = title,
            message = body,
            appointmentId = appointmentId
        )
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        try {
            val prefs = applicationContext.getSharedPreferences("dactor_patient_session", Context.MODE_PRIVATE)
            prefs.edit().putString("fcm_token", token).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
