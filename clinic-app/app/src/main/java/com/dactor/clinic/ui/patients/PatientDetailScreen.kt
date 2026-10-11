package com.dactor.clinic.ui.patients

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.repository.*
import com.dactor.clinic.domain.util.TrackingCodeGenerator
import com.dactor.clinic.ui.navigation.NavRoutes
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientDetailScreen(
    navController: NavController,
    appointmentId: String = "",
    appointmentRepository: AppointmentRepository? = null,
    queueRepository: QueueRepository? = null,
    billingRepository: BillingRepository? = null,
    clinicRepository: ClinicRepository? = null,
    doctorRepository: DoctorRepository? = null,
    slotRepository: SlotRepository? = null,
    labReportRepository: LabReportRepository? = null
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val coroutineScope = rememberCoroutineScope()

    var appointment by remember {
        mutableStateOf(
            Appointment(
                id = appointmentId,
                trackingCode10Digit = if (appointmentId.isNotBlank()) appointmentId else "N/A",
                slotId = null,
                clinicId = "",
                patientName = "Consultation Patient",
                patientAge = 35,
                patientGender = "Male",
                patientMobile = "98XXXXXXXX",
                patientEmail = null,
                paymentStatus = "pending",
                checkinStatus = "in_consultation",
                appointmentDate = LocalDate.now().toString(),
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

    var pastVisitsForPatient by remember { mutableStateOf<List<Appointment>>(emptyList()) }
    var pastRemarksMap by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var clinicsMap by remember { mutableStateOf<Map<String, Clinic>>(emptyMap()) }
    var doctorsList by remember { mutableStateOf<List<Doctor>>(emptyList()) }

    var actionMessage by remember { mutableStateOf<String?>(null) }

    // Editing Past Visit Remark Dialog
    var editingPastApptRemark by remember { mutableStateOf<Appointment?>(null) }
    var pastRemarkInput by remember { mutableStateOf("") }

    // Editing Past Visit Date Dialog
    var editingPastApptDate by remember { mutableStateOf<Appointment?>(null) }
    var pastDateInput by remember { mutableStateOf("") }
    var pastTimeInput by remember { mutableStateOf("") }

    // Schedule Follow-Up Visit Dialog
    var showScheduleFollowUpDialog by remember { mutableStateOf(false) }
    var followUpDate by remember { mutableStateOf(LocalDate.now().plusDays(7).toString()) }
    var followUpTime by remember { mutableStateOf("10:30 AM") }
    var followUpDoctorId by remember { mutableStateOf("") }
    var followUpNotes by remember { mutableStateOf("") }

    suspend fun loadChartData() {
        if (clinicRepository != null) {
            try {
                val allClinics = clinicRepository.getClinics()
                clinicsMap = allClinics.associateBy { it.id }
            } catch (ignored: Exception) {}
        }

        if (appointmentRepository != null && appointmentId.isNotBlank()) {
            val remote = appointmentRepository.getAppointmentByTrackingCode(appointmentId)
                ?: appointmentRepository.getAppointmentById(appointmentId)
            if (remote != null) {
                appointment = remote
                followUpDoctorId = remote.doctorId ?: ""
                if (doctorRepository != null && remote.clinicId.isNotBlank()) {
                    doctorsList = doctorRepository.getDoctorsByClinic(remote.clinicId)
                }

                val existingRemarks = billingRepository?.getRemarkForAppointment(remote.id)
                if (!existingRemarks.isNullOrBlank()) {
                    clinicalNotes = existingRemarks
                    isNotesSaved = true
                }

                val allPatientVisits = appointmentRepository.getAppointmentsForPatient(
                    patientMobile = remote.patientMobile,
                    userId = remote.userId,
                    trackingCode = remote.trackingCode10Digit
                )
                pastVisitsForPatient = allPatientVisits.filter { it.id != remote.id }
                if (billingRepository != null && allPatientVisits.isNotEmpty()) {
                    pastRemarksMap = billingRepository.getRemarksForAppointments(allPatientVisits.map { it.id })
                }
            }
        }
    }

    LaunchedEffect(appointmentId) {
        loadChartData()
    }

    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Patient Clinical Chart & History", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Color(0xFFF8FAFC))
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (actionMessage != null) {
                Surface(
                    color = Color(0xFFDCFCE7),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, Color(0xFF86EFAC)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF15803D), modifier = Modifier.size(18.dp))
                        Text(actionMessage ?: "", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = Color(0xFF166534), modifier = Modifier.weight(1f))
                        IconButton(onClick = { actionMessage = null }, modifier = Modifier.size(20.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = Color(0xFF166534), modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            // Patient Header Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
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
                                color = Color(0xFFD0EEFB),
                                modifier = Modifier.size(52.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF00838F), modifier = Modifier.size(28.dp))
                                }
                            }
                            Column {
                                Text(appointment.patientName, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF0F172A))
                                Text(
                                    "${appointment.patientAge ?: 35} yrs | ${appointment.patientGender ?: "Male"}",
                                    fontSize = 13.sp,
                                    color = Color(0xFF64748B)
                                )
                            }
                        }

                        // Call Patient Button
                        if (appointment.patientMobile.isNotBlank()) {
                            Button(
                                onClick = {
                                    try {
                                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${appointment.patientMobile}"))
                                        context.startActivity(intent)
                                    } catch (ignored: Exception) {}
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                modifier = Modifier.height(36.dp)
                            ) {
                                Icon(Icons.Default.Call, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Call", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }

                    HorizontalDivider(color = Color(0xFFE2E8F0))

                    // Contact Details & Clinic Visited
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Mobile Number", fontSize = 11.sp, color = Color(0xFF64748B))
                            Text(appointment.patientMobile, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color(0xFF0F172A))
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Clinic Visited", fontSize = 11.sp, color = Color(0xFF64748B))
                            Text(
                                clinicsMap[appointment.clinicId]?.name ?: "Primary Clinic",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = Color(0xFF0284C7)
                            )
                        }
                    }

                    // 10-Digit Tracking Code Box (Tap to Copy)
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFF0F9FF),
                        border = BorderStroke(1.dp, Color(0xFFBAE6FD)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                clipboardManager.setText(AnnotatedString(appointment.trackingCode10Digit))
                                actionMessage = "✓ Copied Appointment ID: ${appointment.trackingCode10Digit} to clipboard!"
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("10-Digit Appointment / Tracking ID (Tap to Copy)", fontSize = 10.sp, color = Color(0xFF0284C7))
                                Text(
                                    appointment.trackingCode10Digit,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    fontFamily = FontFamily.Monospace,
                                    letterSpacing = 1.sp,
                                    color = Color(0xFF0369A1)
                                )
                            }
                            Icon(
                                Icons.Default.ContentCopy,
                                contentDescription = "Copy Code",
                                tint = Color(0xFF0284C7),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    // Schedule Follow-Up Button
                    OutlinedButton(
                        onClick = { showScheduleFollowUpDialog = true },
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, Color(0xFF0097A7)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = Color(0xFF0097A7), modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Schedule Follow-Up / Next Appointment", color = Color(0xFF0097A7), fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                    }
                }
            }

            // Current Visit Remarks / Clinical Notes (Editable & Saved to Server)
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
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
                            Icon(Icons.Default.MedicalInformation, contentDescription = null, tint = Color(0xFF0097A7))
                            Text("Visit Remarks & Clinical Notes (${appointment.appointmentDate})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        if (isNotesSaved) {
                            Text("✓ Saved", fontSize = 11.sp, color = Color(0xFF059669), fontWeight = FontWeight.Bold)
                        }
                    }

                    OutlinedTextField(
                        value = clinicalNotes,
                        onValueChange = {
                            clinicalNotes = it
                            isNotesSaved = false
                        },
                        label = { Text("Diagnosis, Symptoms & Clinic Remarks") },
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
                        minLines = 2,
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
                                if (ok) {
                                    isNotesSaved = true
                                    actionMessage = "✓ Clinical remarks saved to server!"
                                }
                                isSavingNotes = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0097A7)),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        enabled = !isSavingNotes
                    ) {
                        if (isSavingNotes) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Saving to Server...", color = Color.White)
                        } else {
                            Icon(Icons.Default.Save, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Save Remarks to Server", fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                }
            }

            // All Past Appointments Section (Showing Clinic Visited, Date, and Editable Remarks)
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.History, contentDescription = null, tint = Color(0xFF0097A7))
                        Text("Past Consultation History (${pastVisitsForPatient.size})", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF0F172A))
                    }

                    if (pastVisitsForPatient.isEmpty()) {
                        Text(
                            "No other past consultations recorded for this patient yet.",
                            fontSize = 12.sp,
                            color = Color(0xFF64748B)
                        )
                    } else {
                        pastVisitsForPatient.forEach { prev ->
                            val visitedClinicName = clinicsMap[prev.clinicId]?.name ?: "Visited Clinic"
                            val prevRemark = pastRemarksMap[prev.id] ?: ""

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFF8FAFC),
                                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Text("${prev.appointmentDate} | ${prev.appointmentTime}", fontWeight = FontWeight.Bold, fontSize = 12.5.sp, color = Color(0xFF0F172A))
                                            IconButton(
                                                onClick = {
                                                    editingPastApptDate = prev
                                                    pastDateInput = prev.appointmentDate
                                                    pastTimeInput = prev.appointmentTime
                                                },
                                                modifier = Modifier.size(22.dp)
                                            ) {
                                                Icon(Icons.Default.EditCalendar, contentDescription = "Edit Date", tint = Color(0xFF0284C7), modifier = Modifier.size(14.dp))
                                            }
                                        }

                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = Color(0xFFE0F2FE)
                                        ) {
                                            Text(
                                                "Clinic: $visitedClinicName",
                                                fontSize = 10.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF0284C7),
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "Appt ID: ${prev.trackingCode10Digit} | Status: ${(prev.checkinStatus ?: "visited").uppercase()}",
                                            fontSize = 11.sp,
                                            color = Color(0xFF64748B),
                                            modifier = Modifier.clickable {
                                                clipboardManager.setText(AnnotatedString(prev.trackingCode10Digit))
                                                actionMessage = "✓ Copied Appointment ID: ${prev.trackingCode10Digit}"
                                            }
                                        )
                                        TextButton(
                                            onClick = {
                                                editingPastApptRemark = prev
                                                pastRemarkInput = prevRemark
                                            },
                                            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp),
                                            modifier = Modifier.height(24.dp)
                                        ) {
                                            Text(if (prevRemark.isBlank()) "+ Add Remark" else "Edit Remark", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0097A7))
                                        }
                                    }

                                    if (prevRemark.isNotBlank()) {
                                        Surface(
                                            color = Color.White,
                                            shape = RoundedCornerShape(6.dp),
                                            border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text("Remark: $prevRemark", fontSize = 11.5.sp, color = Color(0xFF334155), modifier = Modifier.padding(8.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            val currentClinic = clinicsMap[appointment.clinicId]
            val isLabClinic = currentClinic?.type?.equals("diagnostic_lab", ignoreCase = true) == true ||
                    currentClinic?.type?.contains("lab", ignoreCase = true) == true

            // Quick Actions: Billing & (Only for Lab Type Clinics) Lab Process Workflow
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = { navController.navigate("${NavRoutes.BillingScreen}/${appointment.id}") },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0097A7)),
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color.White)
                    Spacer(Modifier.width(6.dp))
                    Text("Generate Bill", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }

                if (isLabClinic) {
                    Button(
                        onClick = { navController.navigate(NavRoutes.LabWorkflow) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Science, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color.White)
                        Spacer(Modifier.width(6.dp))
                        Text("Lab Workflow", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }

            if (isLabClinic) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
                    border = BorderStroke(1.dp, Color(0xFFFECACA)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Biotech, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(18.dp))
                            Text("Lab Process Workflow (Code: #${appointment.trackingCode10Digit})", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF991B1B))
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    coroutineScope.launch {
                                        labReportRepository?.upsertLabReportForAppointment(
                                            appointmentId = appointment.id,
                                            clinicId = appointment.clinicId,
                                            patientName = appointment.patientName,
                                            testName = clinicalNotes.ifBlank { "Complete Diagnostic Panel" },
                                            stage = "sample_collected"
                                        )
                                        actionMessage = "✓ Stage 1: Sample Collected recorded for ${appointment.patientName}!"
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp)
                            ) {
                                Text("1. Collect Sample", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
                            }
                            OutlinedButton(
                                onClick = {
                                    coroutineScope.launch {
                                        labReportRepository?.upsertLabReportForAppointment(
                                            appointmentId = appointment.id,
                                            clinicId = appointment.clinicId,
                                            patientName = appointment.patientName,
                                            testName = clinicalNotes.ifBlank { "Complete Diagnostic Panel" },
                                            stage = "in_lab"
                                        )
                                        actionMessage = "✓ Stage 2: Sample is now Processing in Lab!"
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp)
                            ) {
                                Text("2. Process in Lab", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD97706))
                            }
                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        labReportRepository?.upsertLabReportForAppointment(
                                            appointmentId = appointment.id,
                                            clinicId = appointment.clinicId,
                                            patientName = appointment.patientName,
                                            testName = clinicalNotes.ifBlank { "Complete Diagnostic Panel" },
                                            stage = "prepared",
                                            fileName = "Dactor_Lab_Report_${appointment.trackingCode10Digit}.pdf"
                                        )
                                        actionMessage = "✓ Stage 3: Lab Report Published & Patient Notified!"
                                        navController.navigate(NavRoutes.LabWorkflow)
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp)
                            ) {
                                Text("3. Publish Report", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }
            }
        }
    }

    // Edit Past Remark Dialog
    editingPastApptRemark?.let { pastAppt ->
        AlertDialog(
            onDismissRequest = { editingPastApptRemark = null },
            title = { Text("Edit Past Visit Remark (${pastAppt.appointmentDate})", fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                OutlinedTextField(
                    value = pastRemarkInput,
                    onValueChange = { pastRemarkInput = it },
                    label = { Text("Clinical Remark") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            val ok = billingRepository?.saveRemarkForAppointment(pastAppt.id, pastAppt.clinicId, pastRemarkInput.trim()) ?: false
                            if (ok) {
                                pastRemarksMap = pastRemarksMap + (pastAppt.id to pastRemarkInput.trim())
                                actionMessage = "✓ Past visit remark saved to server!"
                            }
                            editingPastApptRemark = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0097A7))
                ) {
                    Text("Save to Server", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { editingPastApptRemark = null }) { Text("Cancel") }
            }
        )
    }

    // Edit Past Date Dialog
    editingPastApptDate?.let { pastAppt ->
        AlertDialog(
            onDismissRequest = { editingPastApptDate = null },
            title = { Text("Edit Visit Date & Time", fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = pastDateInput,
                        onValueChange = { pastDateInput = it },
                        label = { Text("Date (YYYY-MM-DD)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = pastTimeInput,
                        onValueChange = { pastTimeInput = it },
                        label = { Text("Time (e.g. 10:00 AM)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            val ok = appointmentRepository?.rescheduleAppointment(pastAppt.id, pastDateInput.trim(), pastTimeInput.trim(), null) ?: false
                            if (ok) {
                                actionMessage = "✓ Visit date updated on server!"
                                loadChartData()
                            }
                            editingPastApptDate = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0097A7))
                ) {
                    Text("Save Changes", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { editingPastApptDate = null }) { Text("Cancel") }
            }
        )
    }

    // Schedule Follow-Up Dialog
    if (showScheduleFollowUpDialog) {
        AlertDialog(
            onDismissRequest = { showScheduleFollowUpDialog = false },
            title = { Text("Schedule Follow-Up Visit", fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = followUpDate,
                        onValueChange = { followUpDate = it },
                        label = { Text("Date (YYYY-MM-DD)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = followUpTime,
                        onValueChange = { followUpTime = it },
                        label = { Text("Time (e.g. 10:30 AM)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = followUpNotes,
                        onValueChange = { followUpNotes = it },
                        label = { Text("Follow-Up Remarks") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            val newAppt = Appointment(
                                id = UUID.randomUUID().toString(),
                                trackingCode10Digit = TrackingCodeGenerator.generate(),
                                clinicId = appointment.clinicId,
                                doctorId = followUpDoctorId.ifBlank { appointment.doctorId },
                                userId = appointment.userId,
                                patientName = appointment.patientName,
                                patientAge = appointment.patientAge,
                                patientGender = appointment.patientGender,
                                patientMobile = appointment.patientMobile,
                                patientEmail = appointment.patientEmail,
                                paymentStatus = "pending",
                                checkinStatus = "waiting",
                                appointmentDate = followUpDate.trim(),
                                appointmentTime = followUpTime.trim(),
                                feeAmount = appointment.feeAmount,
                                isWalkin = true
                            )
                            val created = appointmentRepository?.createWalkinAppointment(newAppt)
                            if (created != null) {
                                if (followUpNotes.isNotBlank()) {
                                    billingRepository?.saveRemarkForAppointment(created.id, appointment.clinicId, followUpNotes.trim())
                                }
                                actionMessage = "✓ Follow-up scheduled for $followUpDate!"
                                loadChartData()
                            }
                            showScheduleFollowUpDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0097A7))
                ) {
                    Text("Confirm & Schedule", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showScheduleFollowUpDialog = false }) { Text("Cancel") }
            }
        )
    }
}
