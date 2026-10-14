package com.dactor.patient.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DactorNotification(
    val id: String = "",
    @SerialName("user_id") val userId: String? = null,
    @SerialName("appointment_id") val appointmentId: String? = null,
    val title: String = "",
    val message: String = "",
    val type: String = "broadcast",
    @SerialName("target_audience") val targetAudience: String? = null,
    @SerialName("is_read") val isRead: Boolean = false,
    @SerialName("created_at") val createdAt: String = ""
) {
    fun toTemplateData(): NotificationTemplateData = NotificationTemplateData.fromNotification(title, message, type)
}

data class NotificationTemplateData(
    val title: String,
    val cleanMessage: String,
    val leftLabel: String,
    val leftValue: String,
    val rightLabel: String,
    val rightValue: String,
    val trackingCode: String? = null,
    val isQueueReminder: Boolean = false
) {
    companion object {
        private val META_REGEX = Regex("""\[\[META:(.*?)]]""", RegexOption.DOT_MATCHES_ALL)

        fun buildMessageWithMeta(
            cleanMessage: String,
            leftLabel: String = "Estimated Time Left",
            leftValue: String,
            rightLabel: String = "Your Appointment Time",
            rightValue: String,
            trackingCode: String? = null
        ): String {
            val safeLeftLabel = leftLabel.replace("|", "/").replace("]", "")
            val safeLeftVal = leftValue.replace("|", "/").replace("]", "")
            val safeRightLabel = rightLabel.replace("|", "/").replace("]", "")
            val safeRightVal = rightValue.replace("|", "/").replace("]", "")
            val codePart = if (!trackingCode.isNullOrBlank()) "|code=${trackingCode.trim()}" else ""
            return "${cleanMessage.trim()}\n[[META:leftLabel=$safeLeftLabel|leftVal=$safeLeftVal|rightLabel=$safeRightLabel|rightVal=$safeRightVal$codePart]]"
        }

        fun fromNotification(title: String, rawMessage: String, type: String = "queue_alert"): NotificationTemplateData {
            val match = META_REGEX.find(rawMessage)
            val cleanMsg = rawMessage.replace(META_REGEX, "").trim()

            val notifType = NotificationType.from(type)
            val isQueueReminderType = notifType in listOf(NotificationType.QUEUE_ALERT, NotificationType.DOCTOR_ARRIVAL, NotificationType.MANUAL_ALERT) ||
                title.contains("Queue", ignoreCase = true) ||
                title.contains("Turn", ignoreCase = true) ||
                cleanMsg.contains("queue", ignoreCase = true) ||
                cleanMsg.contains("your turn", ignoreCase = true) ||
                cleanMsg.contains("token #", ignoreCase = true)

            val isFirstPosition = cleanMsg.contains("position 1", ignoreCase = true) ||
                cleanMsg.contains("next in line", ignoreCase = true) ||
                cleanMsg.contains("called inside", ignoreCase = true) ||
                cleanMsg.contains("arrive fast", ignoreCase = true) ||
                title.contains("You're Next", ignoreCase = true)

            if (match != null) {
                val content = match.groupValues[1]
                val map = mutableMapOf<String, String>()
                content.split("|").forEach { pair ->
                    val idx = pair.indexOf('=')
                    if (idx > 0) {
                        val k = pair.substring(0, idx).trim()
                        val v = pair.substring(idx + 1).trim()
                        map[k] = v
                    }
                }
                val rawRightVal = map["rightVal"]?.takeIf { it.isNotBlank() } ?: "Active Queue"
                val rawLeftVal = map["leftVal"]?.takeIf { it.isNotBlank() } ?: "Soon, be ready"

                val effectiveRightVal = if (isFirstPosition) {
                    "Your turn, arrive fast"
                } else {
                    rawRightVal
                }

                val effectiveLeftVal = if (isFirstPosition) {
                    "Arrive Fast"
                } else {
                    rawLeftVal
                }

                return NotificationTemplateData(
                    title = title.ifBlank { "Your Turn is Coming Soon!" },
                    cleanMessage = cleanMsg,
                    leftLabel = map["leftLabel"]?.takeIf { it.isNotBlank() }?.let { if (it.length > 15) "Estimated Time" else it } ?: "Estimated Time",
                    leftValue = effectiveLeftVal,
                    rightLabel = if (effectiveRightVal.contains("arrive fast", ignoreCase = true)) "Turn Status" else (map["rightLabel"]?.takeIf { it.isNotBlank() }?.let { if (it.length > 15) "Your Appointment" else it } ?: "Your Appointment"),
                    rightValue = effectiveRightVal,
                    trackingCode = map["code"],
                    isQueueReminder = isQueueReminderType || notifType == NotificationType.MANUAL_ALERT
                )
            }

            // Fallback extraction if no explicit [[META:...]] tag is present
            val waitMatch = Regex("""(~?\s*\d+\s*(?:min|mins|minute|minutes)|Soon,?\s*be\s*ready!?|Now\s*Inside|Arrive\s*Fast)""", RegexOption.IGNORE_CASE).find(cleanMsg)
            val timeMatch = Regex("""(\d{1,2}:\d{2}\s*(?:AM|PM))""", RegexOption.IGNORE_CASE).find(cleanMsg)

            return when {
                notifType in listOf(NotificationType.LAB_REPORT, NotificationType.LAB_PROCESSING) || title.contains("Report", ignoreCase = true) -> NotificationTemplateData(
                    title = title.ifBlank { "Lab Report Prepared" },
                    cleanMessage = cleanMsg,
                    leftLabel = "Report Status",
                    leftValue = "Prepared",
                    rightLabel = "Availability",
                    rightValue = "Ready to View",
                    isQueueReminder = false
                )
                notifType == NotificationType.CLINIC_BREAK || title.contains("Break", ignoreCase = true) -> NotificationTemplateData(
                    title = title.ifBlank { "Clinic is on Break" },
                    cleanMessage = cleanMsg,
                    leftLabel = "Estimated Time",
                    leftValue = "Clinic on Break",
                    rightLabel = "Your Appointment",
                    rightValue = timeMatch?.groupValues?.get(1) ?: "Paused Briefly",
                    isQueueReminder = false
                )
                notifType in listOf(NotificationType.BROADCAST, NotificationType.ANNOUNCEMENT) -> NotificationTemplateData(
                    title = title.ifBlank { "Dactor Announcement" },
                    cleanMessage = cleanMsg,
                    leftLabel = "",
                    leftValue = "",
                    rightLabel = "",
                    rightValue = "",
                    isQueueReminder = false
                )
                else -> {
                    val fallbackRightVal = if (isFirstPosition) "Your turn, arrive fast" else (timeMatch?.groupValues?.get(1)?.trim() ?: "Soon, be ready")
                    val fallbackLeftVal = if (isFirstPosition) "Arrive Fast" else (waitMatch?.groupValues?.get(1)?.trim() ?: "Soon, be ready")
                    NotificationTemplateData(
                        title = title.ifBlank { "Your Turn is Coming Soon!" },
                        cleanMessage = cleanMsg,
                        leftLabel = "Estimated Time",
                        leftValue = fallbackLeftVal,
                        rightLabel = if (fallbackRightVal.contains("arrive fast", ignoreCase = true)) "Turn Status" else "Your Appointment",
                        rightValue = fallbackRightVal,
                        isQueueReminder = isQueueReminderType
                    )
                }
            }
        }
    }
}

