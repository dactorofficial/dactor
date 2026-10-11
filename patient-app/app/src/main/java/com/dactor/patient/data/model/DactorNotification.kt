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
    val trackingCode: String? = null
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
                return NotificationTemplateData(
                    title = title.ifBlank { "Your Turn is Coming Soon!" },
                    cleanMessage = cleanMsg,
                    leftLabel = map["leftLabel"]?.takeIf { it.isNotBlank() } ?: "Estimated Time Left",
                    leftValue = map["leftVal"]?.takeIf { it.isNotBlank() } ?: "Soon, be ready",
                    rightLabel = map["rightLabel"]?.takeIf { it.isNotBlank() } ?: "Your Appointment Time",
                    rightValue = map["rightVal"]?.takeIf { it.isNotBlank() } ?: "Active Queue",
                    trackingCode = map["code"]
                )
            }

            // Fallback extraction if no explicit [[META:...]] tag is present
            val waitMatch = Regex("""(~?\s*\d+\s*(?:min|mins|minute|minutes)|Soon,?\s*be\s*ready!?|Now\s*Inside)""", RegexOption.IGNORE_CASE).find(cleanMsg)
            val timeMatch = Regex("""(\d{1,2}:\d{2}\s*(?:AM|PM))""", RegexOption.IGNORE_CASE).find(cleanMsg)

            return when {
                type == "lab_report" || title.contains("Report", ignoreCase = true) -> NotificationTemplateData(
                    title = title.ifBlank { "Lab Report Prepared" },
                    cleanMessage = cleanMsg,
                    leftLabel = "Report Status",
                    leftValue = "Prepared",
                    rightLabel = "Availability",
                    rightValue = "Ready to View"
                )
                type == "clinic_break" || title.contains("Break", ignoreCase = true) -> NotificationTemplateData(
                    title = title.ifBlank { "Clinic is on Break" },
                    cleanMessage = cleanMsg,
                    leftLabel = "Estimated Time Left",
                    leftValue = "Clinic on Break",
                    rightLabel = "Your Appointment Time",
                    rightValue = timeMatch?.groupValues?.get(1) ?: "Paused Briefly"
                )
                else -> NotificationTemplateData(
                    title = title.ifBlank { "Your Turn is Coming Soon!" },
                    cleanMessage = cleanMsg,
                    leftLabel = "Estimated Time Left",
                    leftValue = waitMatch?.groupValues?.get(1)?.trim() ?: "Soon, be ready",
                    rightLabel = "Your Appointment Time",
                    rightValue = timeMatch?.groupValues?.get(1)?.trim() ?: "Soon, be ready"
                )
            }
        }
    }
}

