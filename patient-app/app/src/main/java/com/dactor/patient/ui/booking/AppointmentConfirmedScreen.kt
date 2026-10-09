package com.dactor.patient.ui.booking

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.dactor.patient.ui.navigation.NavRoutes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentConfirmedScreen(
    navController: NavController,
    appointmentId: String = "",
    generatedTrackingCode: String = "9841203841",
    clinicName: String = "Medical OPD Center",
    doctorName: String = "Attending Physician",
    appointmentRepository: com.dactor.patient.data.repository.AppointmentRepository? = null,
    sessionManager: com.dactor.patient.data.local.UserSessionManager? = null
) {
    var appt by remember { mutableStateOf<com.dactor.patient.data.model.Appointment?>(null) }
    val scrollState = rememberScrollState()

    LaunchedEffect(appointmentId) {
        if (appointmentId.isNotBlank() && appointmentRepository != null) {
            val remote = appointmentRepository.getAppointmentById(appointmentId)
                ?: appointmentRepository.getAppointmentByTrackingCode(appointmentId)
            if (remote != null) {
                appt = remote
                sessionManager?.saveTrackingCode(remote.trackingCode10Digit, "${remote.patientName} • ${remote.appointmentDate}")
            }
        }
    }

    val displayCode = appt?.trackingCode10Digit ?: if (appointmentId.length == 10) appointmentId else generatedTrackingCode

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Booking Successful", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Spacer(modifier = Modifier.height(10.dp))

            Surface(
                shape = CircleShape,
                color = Color(0xFF10B981).copy(alpha = 0.15f),
                modifier = Modifier.size(80.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Color(0xFF059669),
                        modifier = Modifier.size(52.dp)
                    )
                }
            }

            Text(
                text = "Appointment Confirmed!",
                fontWeight = FontWeight.ExtraBold,
                fontSize = 22.sp,
                color = MaterialTheme.colorScheme.onSurface
            )

            Text(
                text = "Your offline in-person consultation is booked. Keep this 10-digit code to track your queue position at any time without logging in.",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 18.sp
            )

            // Prominent 10-Digit Code Card
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        "YOUR 10-DIGIT TRACKING CODE",
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                        letterSpacing = 1.sp
                    )

                    Text(
                        text = displayCode,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        letterSpacing = 3.sp
                    )

                    Text(
                        "Saved to your patient profile history automatically",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }

            // Appointment Info Card
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.LocalHospital, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        Text(clinicName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        Text(doctorName, fontSize = 13.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.AccessTime, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        val scheduleTime = appt?.appointmentTime?.ifBlank { null } ?: "09:30"
                        val scheduleDate = appt?.appointmentDate?.ifBlank { null }
                        Text(
                            text = if (scheduleDate != null) "Scheduled: $scheduleDate at $scheduleTime" else "Time Window: $scheduleTime",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Action Buttons
            Button(
                onClick = {
                    navController.navigate(NavRoutes.QueueStatus.createRoute(displayCode))
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(Icons.Default.TrackChanges, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Track Live Queue Position Now", fontWeight = FontWeight.Bold)
            }

            OutlinedButton(
                onClick = {
                    navController.navigate(NavRoutes.Landing.route) {
                        popUpTo(NavRoutes.Landing.route) { inclusive = true }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text("Return to Home")
            }
        }
    }
}
