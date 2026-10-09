package com.dactor.clinic.ui.queue

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import com.dactor.clinic.data.model.QueueEntry
import com.dactor.clinic.data.repository.AppointmentRepository
import com.dactor.clinic.data.repository.QueueRepository
import com.dactor.clinic.ui.navigation.NavRoutes
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class QueueItemUi(
    val id: String,
    val appointmentId: String,
    val patientName: String,
    val patientAge: Int,
    val patientGender: String,
    val patientMobile: String,
    val trackingCode: String,
    var queuePosition: Int,
    var status: String, // "waiting", "inside", "done", "no_show"
    val appointmentTime: String = "",
    val insideAt: String? = null,
    val calledAt: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueBoardScreen(
    navController: NavController,
    clinicId: String = "",
    queueRepository: QueueRepository? = null,
    appointmentRepository: AppointmentRepository? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else com.dactor.clinic.data.local.UserSessionManager(context).getSavedClinicId() ?: ""
    }

    var queueItems by remember { mutableStateOf<List<QueueItemUi>>(emptyList()) }
    var selectedQueueTab by remember { mutableStateOf(0) } // 0: Live Queue, 1: Past Queue
    var expandedItemId by remember { mutableStateOf<String?>(null) }
    var notificationSentMessage by remember { mutableStateOf<String?>(null) }
    var currentEpochSecond by remember { mutableLongStateOf(System.currentTimeMillis() / 1000) }
    val coroutineScope = rememberCoroutineScope()

    // Live ticking timer for consultation duration
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(1000L)
            currentEpochSecond = System.currentTimeMillis() / 1000
        }
    }

    suspend fun loadQueue() {
        if (queueRepository != null && effectiveClinicId.isNotBlank()) {
            val entries = queueRepository.getQueueForClinic(effectiveClinicId)
            val appts = appointmentRepository?.getAppointmentsByClinic(effectiveClinicId) ?: emptyList()
            val apptMap = appts.associateBy { it.id }

            // Strict FIFO system: sorted strictly according to patient booking and token position
            queueItems = entries
                .sortedBy { it.queuePosition }
                .map { entry ->
                    val appt = apptMap[entry.appointmentId]
                    QueueItemUi(
                        id = entry.id,
                        appointmentId = entry.appointmentId,
                        patientName = appt?.patientName ?: "Patient #${entry.queuePosition}",
                        patientAge = appt?.patientAge ?: 0,
                        patientGender = appt?.patientGender ?: "Registered",
                        patientMobile = appt?.patientMobile ?: "",
                        trackingCode = appt?.trackingCode10Digit ?: entry.appointmentId.take(8),
                        queuePosition = entry.queuePosition,
                        status = entry.status,
                        appointmentTime = appt?.appointmentTime ?: "",
                        insideAt = entry.insideAt,
                        calledAt = entry.calledAt
                    )
                }
        }
    }

    LaunchedEffect(effectiveClinicId) {
        while (isActive) {
            loadQueue()
            delay(4000L)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Live Patient Queue Board", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        coroutineScope.launch { loadQueue() }
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            // Live Stats Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val insideCount = queueItems.count { it.status == "inside" }
                val waitingCount = queueItems.count { it.status == "waiting" }
                val doneCount = queueItems.count { it.status == "done" }

                Surface(
                    color = Color(0xFF3B82F6).copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$insideCount", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color(0xFF1D4ED8))
                        Text("In Consultation", fontSize = 10.sp, color = Color(0xFF1E40AF))
                    }
                }

                Surface(
                    color = Color(0xFFF59E0B).copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$waitingCount", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color(0xFFB45309))
                        Text("Waiting in Lobby", fontSize = 10.sp, color = Color(0xFF92400E))
                    }
                }

                Surface(
                    color = Color(0xFF10B981).copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$doneCount", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color(0xFF047857))
                        Text("Completed Today", fontSize = 10.sp, color = Color(0xFF065F46))
                    }
                }
            }

            if (notificationSentMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(notificationSentMessage ?: "", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }

            val liveQueue = queueItems.filter { it.status == "waiting" || it.status == "inside" }
            val pastQueue = queueItems.filter { it.status == "done" || it.status == "no_show" }

            TabRow(
                selectedTabIndex = selectedQueueTab,
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
            ) {
                Tab(
                    selected = selectedQueueTab == 0,
                    onClick = { selectedQueueTab = 0 },
                    text = { Text("Live Queue (${liveQueue.size})", fontWeight = FontWeight.Bold) }
                )
                Tab(
                    selected = selectedQueueTab == 1,
                    onClick = { selectedQueueTab = 1 },
                    text = { Text("Past Queue (${pastQueue.size})", fontWeight = FontWeight.Bold) }
                )
            }

            Text(
                text = if (selectedQueueTab == 0)
                    "Live OPD Queue operates on a strict FIFO system. When consultation completes, the patient moves to Past Queue and the next patient becomes #1."
                else
                    "Past Queue archive of completed consultations and no-show patients for today.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            val currentQueueList = if (selectedQueueTab == 0) liveQueue else pastQueue

            if (currentQueueList.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            if (selectedQueueTab == 0) Icons.Default.Schedule else Icons.Default.DoneAll,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.outline,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = if (selectedQueueTab == 0) "No Active Patients in Live Queue" else "No Past Queue Records",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = if (selectedQueueTab == 0)
                                "Patients will appear here when appointments are checked in or walk-ins are registered."
                            else
                                "Completed patient consultations will be archived here.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                // Queue List
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                itemsIndexed(currentQueueList, key = { _, item -> item.id }) { index, item ->
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = when (item.status) {
                                "inside" -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
                                "done" -> Color(0xFFF3F4F6)
                                "no_show" -> Color(0xFFFEE2E2)
                                else -> MaterialTheme.colorScheme.surface
                            }
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                expandedItemId = if (expandedItemId == item.id) null else item.id
                            }
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    // Rank Number Badge (Strict FIFO Token Number)
                                    Surface(
                                        shape = CircleShape,
                                        color = when (item.status) {
                                            "inside" -> MaterialTheme.colorScheme.primary
                                            "done" -> Color(0xFF059669)
                                            "no_show" -> Color(0xFFDC2626)
                                            else -> Color(0xFF3B82F6)
                                        },
                                        modifier = Modifier.size(34.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = "#${index + 1}",
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            )
                                        }
                                    }

                                    Column {
                                        Text(item.patientName, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                        Text(
                                            text = "Code: ${item.trackingCode} • ${item.patientMobile}",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }

                                // Status Badge
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    SuggestionChip(
                                        onClick = { },
                                        label = {
                                            Text(
                                                text = when (item.status) {
                                                    "inside" -> "Inside Consultation"
                                                    "done" -> "Completed"
                                                    "no_show" -> "No Show"
                                                    else -> "Waiting"
                                                },
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = when (item.status) {
                                                    "inside" -> MaterialTheme.colorScheme.primary
                                                    "done" -> Color(0xFF047857)
                                                    "no_show" -> Color(0xFFB91C1C)
                                                    else -> Color(0xFFB45309)
                                                }
                                            )
                                        }
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Working Time Interval & Live Phase Display
                            if (item.status == "inside") {
                                val elapsedSec = if (!item.insideAt.isNullOrBlank()) {
                                    try {
                                        (currentEpochSecond - java.time.Instant.parse(item.insideAt).epochSecond).coerceAtLeast(0)
                                    } catch (e: Exception) { 0L }
                                } else 0L
                                val mins = elapsedSec / 60
                                val secs = elapsedSec % 60
                                val formattedElapsed = String.format(java.util.Locale.US, "%02d:%02d", mins, secs)

                                Surface(
                                    color = Color(0xFFDCFCE7),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Box(modifier = Modifier.size(8.dp).background(Color(0xFF16A34A), CircleShape))
                                            Text("Active OPD Phase: Consultation Ongoing", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF15803D))
                                        }
                                        Text("⏱ $formattedElapsed min", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF166534))
                                    }
                                }
                            } else if (item.status == "waiting") {
                                val estWaitMins = (index * 15).coerceAtLeast(0)
                                Surface(
                                    color = Color(0xFFF1F5F9),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = if (item.appointmentTime.isNotBlank()) "Slot Window: ${item.appointmentTime}" else "Queue Turn: #${index + 1}",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF475569)
                                        )
                                        Text(
                                            text = if (index == 0) "⏱ Next to enter" else "⏱ Est. Turn: in ~${estWaitMins}m (15m interval)",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Color(0xFF0284C7)
                                        )
                                    }
                                }
                            }

                            // Expanded Patient Details & Actions
                            AnimatedVisibility(visible = expandedItemId == item.id) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 12.dp)
                                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                                        .padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Age: ${item.patientAge} years", fontSize = 12.sp)
                                        Text("Gender: ${item.patientGender}", fontSize = 12.sp)
                                        Text("Phone: ${item.patientMobile}", fontSize = 12.sp)
                                    }

                                    // Action Buttons Row
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        if (item.status != "inside" && item.status != "done" && item.status != "no_show") {
                                            Button(
                                                onClick = {
                                                    coroutineScope.launch {
                                                        queueRepository?.updateQueueStatus(item.id, "inside", effectiveClinicId)
                                                        loadQueue()
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                                modifier = Modifier.weight(1f),
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Icon(Icons.Default.MeetingRoom, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Call Inside", fontSize = 12.sp)
                                            }
                                        }

                                        if (item.status == "inside") {
                                            Button(
                                                onClick = {
                                                    coroutineScope.launch {
                                                        queueRepository?.updateQueueStatus(item.id, "done", effectiveClinicId)
                                                        loadQueue()
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                                modifier = Modifier.weight(1f),
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Mark Done", fontSize = 12.sp)
                                            }
                                        }

                                        // Chart / Remarks / Billing Shortcut
                                        OutlinedButton(
                                            onClick = {
                                                navController.navigate("${NavRoutes.PatientDetail}/${item.appointmentId}")
                                            },
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Icon(Icons.Default.MedicalInformation, contentDescription = null, modifier = Modifier.size(15.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Chart/Bill", fontSize = 12.sp)
                                        }

                                        // Manual Push Notification Button
                                        if (item.status != "done") {
                                            OutlinedButton(
                                                onClick = {
                                                    coroutineScope.launch {
                                                        queueRepository?.sendManualNotification(
                                                            appointmentId = item.appointmentId,
                                                            title = "Your Turn is Approaching at Dactor!",
                                                            message = "Dear ${item.patientName}, please proceed to the clinic waiting area. Your consultation is next."
                                                        )
                                                        notificationSentMessage = "Push notification sent to ${item.patientName}."
                                                    }
                                                },
                                                modifier = Modifier.weight(1f),
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Icon(Icons.Default.Notifications, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Send Alert", fontSize = 12.sp)
                                            }
                                        }

                                        if (item.status == "waiting") {
                                            OutlinedButton(
                                                onClick = {
                                                    coroutineScope.launch {
                                                        queueRepository?.updateQueueStatus(item.id, "no_show", effectiveClinicId)
                                                        loadQueue()
                                                    }
                                                },
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Text("No Show", fontSize = 12.sp)
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
}
}
