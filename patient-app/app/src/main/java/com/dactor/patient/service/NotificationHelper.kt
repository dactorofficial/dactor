package com.dactor.patient.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.dactor.patient.MainActivity
import com.dactor.patient.R
import com.dactor.patient.data.model.NotificationTemplateData

object NotificationHelper {
    const val CHANNEL_ID = "dactor_medical_alerts"
    const val CHANNEL_NAME = "Dactor Doctor & Queue Alerts"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = "Urgent alerts for patient queue turns, doctor calls, clinic breaks, and lab reports."
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 200, 300)
                enableLights(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                setSound(
                    soundUri,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)

            // Remove annoying foreground watchdog sync channel and dismiss ongoing watchdog notification
            try {
                notificationManager.deleteNotificationChannel("dactor_background_sync")
                notificationManager.cancel(99101)
            } catch (_: Exception) {}
        }
    }

    fun showSystemNotification(
        context: Context,
        id: Int,
        title: String,
        message: String,
        appointmentId: String? = null,
        type: String = "queue_alert",
        estimatedTimeLeft: String? = null,
        expectedTime: String? = null
    ) {
        createNotificationChannel(context)

        val parsed = NotificationTemplateData.fromNotification(title, message, type)
        val displayTitle = parsed.title
        val displayBody = parsed.cleanMessage
        val leftLabel = parsed.leftLabel
        val leftVal = estimatedTimeLeft?.takeIf { it.isNotBlank() } ?: parsed.leftValue
        val rightLabel = parsed.rightLabel
        val rightVal = expectedTime?.takeIf { it.isNotBlank() } ?: parsed.rightValue

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("appointment_id", appointmentId ?: parsed.trackingCode)
            putExtra("navigate_to", "notifications")
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val collapsedView = RemoteViews(context.packageName, R.layout.notification_dactor_collapsed).apply {
            setImageViewResource(R.id.notif_app_logo, R.drawable.app_logo)
            setTextViewText(R.id.notif_header_text, "Dactor • Now")
            setTextViewText(R.id.notif_title, displayTitle)
            setTextViewText(R.id.notif_body, displayBody)
        }

        val expandedView = RemoteViews(context.packageName, R.layout.notification_dactor_expanded).apply {
            setImageViewResource(R.id.notif_app_logo, R.drawable.app_logo)
            setTextViewText(R.id.notif_header_text, "Dactor • Now")
            setTextViewText(R.id.notif_title, displayTitle)
            setTextViewText(R.id.notif_body, displayBody)

            // Only show 2-column queue metrics container for queue status reminder notifications!
            if (parsed.isQueueReminder) {
                setViewVisibility(R.id.notif_metrics_container, android.view.View.VISIBLE)
                setTextViewText(R.id.notif_left_label, leftLabel)
                setTextViewText(R.id.notif_left_value, leftVal)
                setTextViewText(R.id.notif_right_label, rightLabel)
                setTextViewText(R.id.notif_right_value, rightVal)
            } else {
                setViewVisibility(R.id.notif_metrics_container, android.view.View.GONE)
            }
        }

        val logoBitmap = try {
            BitmapFactory.decodeResource(context.resources, R.drawable.app_logo)
        } catch (_: Exception) {
            null
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.app_logo)
            .setLargeIcon(logoBitmap)
            .setColor(android.graphics.Color.WHITE)
            .setContentTitle(displayTitle)
            .setContentText(displayBody)
            .setCustomContentView(collapsedView)
            .setCustomBigContentView(expandedView)
            .setCustomHeadsUpContentView(expandedView)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 300, 200, 300))
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        try {
            NotificationManagerCompat.from(context).notify(id, builder.build())
        } catch (e: SecurityException) {
            e.printStackTrace()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun requestIgnoreBatteryOptimizations(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                if (!powerManager.isIgnoringBatteryOptimizations(context.packageName)) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${context.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}

