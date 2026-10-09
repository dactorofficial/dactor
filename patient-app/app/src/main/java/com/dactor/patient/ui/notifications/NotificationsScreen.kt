package com.dactor.patient.ui.notifications

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.model.DactorNotification
import com.dactor.patient.data.repository.AppointmentRepository
import com.dactor.patient.data.repository.AuthRepository
import com.dactor.patient.data.repository.NotificationRepository
import com.dactor.patient.ui.navigation.NavRoutes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    navController: NavController,
    notificationRepository: NotificationRepository? = null,
    sessionManager: UserSessionManager? = null,
    authRepository: AuthRepository? = null,
    appointmentRepository: AppointmentRepository? = null
) {
    var selectedFilter by remember { mutableStateOf("All") }
    var notifications by remember { mutableStateOf<List<DactorNotification>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }

    suspend fun loadNotifications() {
        if (notificationRepository == null) return
        isLoading = true
        try {
            val userId = authRepository?.getCurrentUser() ?: sessionManager?.getSavedPatientId()
            val savedCodes = sessionManager?.getSavedTrackingCodes()?.map { it.first } ?: emptyList()
            val fetched = notificationRepository.getNotifications(userId = userId, appointmentIds = savedCodes)
            notifications = fetched
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        loadNotifications()
    }

    val filters = listOf("All", "Doctor Alerts", "Queue", "Lab", "Announcements")

    val filteredList = remember(selectedFilter, notifications) {
        when (selectedFilter) {
            "Doctor Alerts" -> notifications.filter { it.type == "manual_alert" || it.type == "queue_alert" }
            "Queue" -> notifications.filter { it.type == "queue_alert" || it.type == "doctor_arrival" || it.type == "manual_alert" }
            "Lab" -> notifications.filter { it.type == "lab_report" }
            "Announcements" -> notifications.filter { it.type == "announcement" }
            else -> notifications
        }
    }

    val unreadCount = remember(notifications) {
        notifications.count { !it.isRead }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Notifications", fontWeight = FontWeight.Bold)
                        if (unreadCount > 0) {
                            Surface(
                                shape = CircleShape,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(22.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        "$unreadCount",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        kotlinx.coroutines.runBlocking {
                            loadNotifications()
                        }
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    if (unreadCount > 0) {
                        TextButton(onClick = {
                            notifications = notifications.map { it.copy(isRead = true) }
                        }) {
                            Text("Mark all read", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Category Filter Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                filters.forEach { filter ->
                    FilterChip(
                        selected = selectedFilter == filter,
                        onClick = { selectedFilter = filter },
                        label = { Text(filter, fontSize = 12.sp) },
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            }

            if (filteredList.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.size(72.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.NotificationsNone,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(36.dp)
                                )
                            }
                        }
                        Text("No notifications yet", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(
                            "Doctor alerts, queue turn calls, and diagnostic lab reports will appear here in real time.",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredList, key = { it.id }) { item ->
                        val isDoctorAlert = item.type == "manual_alert" || item.type == "queue_alert"
                        val icon = when (item.type) {
                            "manual_alert" -> Icons.Default.Campaign
                            "queue_alert" -> Icons.Default.NotificationsActive
                            "lab_report" -> Icons.Default.Biotech
                            "doctor_arrival" -> Icons.Default.Person
                            else -> Icons.Default.Info
                        }

                        val iconColor = when (item.type) {
                            "manual_alert" -> Color(0xFFDC2626)
                            "queue_alert" -> Color(0xFF2563EB)
                            "lab_report" -> Color(0xFF059669)
                            "doctor_arrival" -> Color(0xFF7C3AED)
                            else -> Color(0xFFD97706)
                        }

                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isDoctorAlert && !item.isRead) {
                                    Color(0xFFFEF2F2)
                                } else if (!item.isRead) {
                                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f)
                                } else {
                                    MaterialTheme.colorScheme.surface
                                }
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = if (!item.isRead) 2.dp else 1.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    // Mark read
                                    notifications = notifications.map {
                                        if (it.id == item.id) it.copy(isRead = true) else it
                                    }
                                    // Navigate
                                    when (item.type) {
                                        "queue_alert", "manual_alert" -> {
                                            val apptId = item.appointmentId
                                            if (!apptId.isNullOrBlank()) {
                                                navController.navigate(NavRoutes.QueueStatus.createRoute(apptId))
                                            }
                                        }
                                        "lab_report" -> {
                                            val apptId = item.appointmentId ?: "all"
                                            navController.navigate(NavRoutes.LabReport.createRoute(apptId))
                                        }
                                        else -> {}
                                    }
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = iconColor.copy(alpha = 0.15f),
                                    modifier = Modifier.size(44.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
                                    }
                                }

                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Text(
                                                item.title,
                                                fontWeight = if (!item.isRead) FontWeight.Bold else FontWeight.SemiBold,
                                                fontSize = 14.sp,
                                                color = if (isDoctorAlert) Color(0xFF991B1B) else MaterialTheme.colorScheme.onSurface
                                            )
                                        }
                                        if (!item.isRead) {
                                            Box(
                                                modifier = Modifier
                                                    .size(8.dp)
                                                    .background(if (isDoctorAlert) Color(0xFFDC2626) else MaterialTheme.colorScheme.primary, CircleShape)
                                            )
                                        }
                                    }

                                    Text(
                                        item.message,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        lineHeight = 17.sp
                                    )

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            item.createdAt.take(19).replace("T", " "),
                                            fontSize = 10.sp,
                                            color = MaterialTheme.colorScheme.outline
                                        )

                                        if (item.type == "queue_alert" || item.type == "manual_alert" || item.type == "lab_report") {
                                            Text(
                                                "Tap to view →",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isDoctorAlert) Color(0xFFDC2626) else MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
