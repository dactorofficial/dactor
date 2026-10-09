package com.dactor.clinic.ui.patients

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.repository.AppointmentRepository
import com.dactor.clinic.data.repository.QueueRepository
import com.dactor.clinic.domain.util.CurrencyFormatter
import com.dactor.clinic.ui.navigation.NavRoutes
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientDetailScreen(
    navController: NavController,
    appointmentId: String = "",
    appointmentRepository: AppointmentRepository? = null,
    queueRepository: QueueRepository? = null,
    billingRepository: com.dactor.clinic.data.repository.BillingRepository? = null
) {
    var appointment by remember {
        mutableStateOf(
            Appointment(
                id = appointmentId,
                trackingCode10Digit = if (appointmentId.isNotBlank()) appointmentId else "N/A",
                slotId = null,
                clinicId = "",
                patientName = "Consultation Patient",
                patientAge = 35,
                patientGender = "Patient",
                patientMobile = "98XXXXXXXX",
                patientEmail = null,
                paymentStatus = "pending",
                checkinStatus = "in_consultation",
                appointmentDate = java.time.LocalDate.now().toString(),
                appointmentTime = "10:00 AM",
                feeAmount = 500.0,
                isWalkin = false
            )
        )
    }

    var clinicalNotes by remember { mutableStateOf("") }
    var prescriptionText by remember { mutableStateOf("") }
    var isNotesSaved by remember { mutableStateOf(false) }
    var isSavingNotes by remember { mutableStateOf(false) }

    LaunchedEffect(appointmentId) {
        if (appointmentRepository != null && appointmentId.isNotBlank()) {
            val remote = appointmentRepository.getAppointmentByTrackingCode(appointmentId)
                ?: appointmentRepository.getAppointmentById(appointmentId)
            if (remote != null) {
                appointment = remote
                val existingRemarks = billingRepository?.getRemarkForAppointment(remote.id)
                if (!existingRemarks.isNullOrBlank()) {
                    clinicalNotes = existingRemarks
                    isNotesSaved = true
                }
            }
        }
    }

    val clipboardManager = LocalClipboardManager.current
    var isCopied by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Patient Clinical Chart", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Patient Header Card
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Surface(
                                shape = CircleShape,
                                color = MaterialTheme.colorScheme.primaryContainer,
                                modifier = Modifier.size(50.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
                                }
                            }
                            Column {
                                Text(appointment.patientName, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                Text(
                                    "${appointment.patientAge ?: 35} yrs • ${appointment.patientGender ?: "Male"}",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (appointment.paymentStatus == "paid") Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = (appointment.paymentStatus ?: "UNPAID").uppercase(),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (appointment.paymentStatus == "paid") Color(0xFF047857) else Color(0xFFDC2626)
                            )
                        }
                    }

                    Divider()

                    // Contact Details
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Mobile Number", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("+977 ${appointment.patientMobile}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        }
                        Column {
                            Text("Visit Type", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(if (appointment.isWalkin) "Walk-in Desk" else "Online Pre-booked", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        }
                    }

                    // 10-Digit Code Box
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("10-Digit Tracking Code", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(
                                    appointment.trackingCode10Digit,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    fontFamily = FontFamily.Monospace,
                                    letterSpacing = 1.sp,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                            IconButton(
                                onClick = {
                                    clipboardManager.setText(AnnotatedString(appointment.trackingCode10Digit))
                                    isCopied = true
                                }
                            ) {
                                Icon(
                                    if (isCopied) Icons.Default.Check else Icons.Default.ContentCopy,
                                    contentDescription = "Copy Code",
                                    tint = if (isCopied) Color(0xFF059669) else MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Doctor Remarks / Clinical Notes
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.MedicalInformation, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Text("Clinical Notes & Symptoms", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }

                        if (isNotesSaved) {
                            Text("Saved", fontSize = 11.sp, color = Color(0xFF059669), fontWeight = FontWeight.Bold)
                        }
                    }

                    OutlinedTextField(
                        value = clinicalNotes,
                        onValueChange = {
                            clinicalNotes = it
                            isNotesSaved = false
                        },
                        label = { Text("Physician Diagnosis & Vitals") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        shape = RoundedCornerShape(12.dp)
                    )

                    OutlinedTextField(
                        value = prescriptionText,
                        onValueChange = {
                            prescriptionText = it
                            isNotesSaved = false
                        },
                        label = { Text("Rx / Prescribed Medications") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        shape = RoundedCornerShape(12.dp)
                    )

                    Button(
                        onClick = {
                            coroutineScope.launch {
                                isSavingNotes = true
                                val combinedRemarks = buildString {
                                    if (clinicalNotes.isNotBlank()) append(clinicalNotes.trim())
                                    if (prescriptionText.isNotBlank()) {
                                        if (isNotEmpty()) append("\n\nRx: ") else append("Rx: ")
                                        append(prescriptionText.trim())
                                    }
                                }
                                val ok = billingRepository?.saveRemarkForAppointment(appointment.id, appointment.clinicId, combinedRemarks) ?: false
                                if (ok) isNotesSaved = true
                                isSavingNotes = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        enabled = !isSavingNotes
                    ) {
                        if (isSavingNotes) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Saving Notes...")
                        } else {
                            Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Save Clinical Notes to File", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Quick Actions: Billing & Labs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = { navController.navigate("${NavRoutes.BillingScreen}/${appointment.id}") },
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Generate Bill", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = { navController.navigate(NavRoutes.LabWorkflow) },
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Biotech, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Order Labs", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
