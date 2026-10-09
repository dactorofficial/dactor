package com.dactor.clinic.ui.patients

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import com.dactor.clinic.data.local.UserSessionManager
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.repository.AppointmentRepository
import com.dactor.clinic.data.repository.DoctorRepository
import com.dactor.clinic.data.repository.BillingRepository
import com.dactor.clinic.ui.navigation.NavRoutes
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientDirectoryScreen(
    navController: NavController,
    clinicId: String = "",
    appointmentRepository: AppointmentRepository? = null,
    doctorRepository: DoctorRepository? = null,
    billingRepository: BillingRepository? = null,
    sessionManager: UserSessionManager? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val effectiveSessionManager = sessionManager ?: remember { UserSessionManager(context) }
    var userRole by remember { mutableStateOf(effectiveSessionManager.getUserRole() ?: "clinic") }
    var savedDoctorId by remember { mutableStateOf(effectiveSessionManager.getSavedDoctorId() ?: "") }
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else effectiveSessionManager.getSavedClinicId() ?: ""
    }

    var selectedTab by remember { mutableStateOf(0) }
    var appointments by remember { mutableStateOf<List<Appointment>>(emptyList()) }
    var affiliatedDoctors by remember { mutableStateOf<List<Doctor>>(emptyList()) }
    var remarksMap by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var editingRemarkAppt by remember { mutableStateOf<Appointment?>(null) }
    var remarkInput by remember { mutableStateOf("") }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    var isOperating by remember { mutableStateOf(false) }

    val today = java.time.LocalDate.now().toString()
    val coroutineScope = rememberCoroutineScope()

    suspend fun loadData() {
        if (appointmentRepository != null) {
            var isDocMode = userRole == "doctor" || savedDoctorId.isNotBlank()
            var docIdToUse = savedDoctorId

            // Check if clinicId passed via nav route is a doctor
            if (clinicId.isNotBlank() && doctorRepository != null) {
                val candidateDoc = doctorRepository.getDoctorById(clinicId)
                if (candidateDoc != null) {
                    isDocMode = true
                    docIdToUse = candidateDoc.id
                    userRole = "doctor"
                    savedDoctorId = candidateDoc.id
                    effectiveSessionManager.saveDoctorSession(candidateDoc.id, candidateDoc.email, candidateDoc.fullName)
                }
            }

            val fetched = if (isDocMode && docIdToUse.isNotBlank()) {
                appointmentRepository.getAppointmentsByDoctor(docIdToUse)
            } else {
                val cId = if (effectiveClinicId.isNotBlank()) effectiveClinicId
                    else effectiveSessionManager.getSavedClinicId() ?: ""
                if (cId.isNotBlank()) {
                    if (doctorRepository != null) {
                        affiliatedDoctors = doctorRepository.getDoctorsByClinic(cId)
                    }
                    appointmentRepository.getAppointmentsByClinic(cId)
                } else emptyList()
            }
            appointments = fetched

            // Load remarks for completed appointments
            if (billingRepository != null) {
                val completedList = fetched.filter { it.checkinStatus == "completed" }
                val map = mutableMapOf<String, String>()
                completedList.forEach { appt ->
                    val r = billingRepository.getRemarkForAppointment(appt.id)
                    if (!r.isNullOrBlank()) {
                        map[appt.id] = r
                    }
                }
                remarksMap = map
            }
        }
    }

    LaunchedEffect(effectiveClinicId, savedDoctorId, userRole, clinicId) {
        while (isActive) {
            loadData()
            delay(4000L)
        }
    }

    val pendingApprovals = appointments.filter {
        it.checkinStatus != "checked_in" &&
        it.checkinStatus != "in_consultation" &&
        it.checkinStatus != "inside_opd" &&
        it.checkinStatus != "completed" &&
        it.checkinStatus != "cancelled"
    }.sortedByDescending { it.appointmentDate }

    val inConsultation = appointments.filter {
        (it.checkinStatus == "checked_in" || it.checkinStatus == "in_consultation" || it.checkinStatus == "inside_opd") &&
        it.checkinStatus != "completed" && it.checkinStatus != "cancelled"
    }

    val pastPatients = appointments.filter {
        it.checkinStatus == "completed" || it.checkinStatus == "cancelled" || (it.appointmentDate < today && it.checkinStatus != "checked_in")
    }.sortedByDescending { it.appointmentDate }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (userRole == "doctor") "Doctor OPD Patient Directory" else "Patient Records Directory",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        coroutineScope.launch { loadData() }
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
            if (actionMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(actionMessage ?: "", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }

            if (userRole == "clinic") {
                TabRow(
                    selectedTabIndex = selectedTab,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("Pending Approvals (${pendingApprovals.size})", fontWeight = FontWeight.Bold, fontSize = 11.sp) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("In OPD Queue (${inConsultation.size})", fontWeight = FontWeight.Bold, fontSize = 11.sp) }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        text = { Text("Past Visits (${pastPatients.size})", fontWeight = FontWeight.Bold, fontSize = 11.sp) }
                    )
                }
            } else {
                TabRow(
                    selectedTabIndex = selectedTab,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("OPD Queue (${inConsultation.size})", fontWeight = FontWeight.Bold) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("Past Visits (${pastPatients.size})", fontWeight = FontWeight.Bold) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            val currentList = if (userRole == "clinic") {
                when (selectedTab) {
                    0 -> pendingApprovals
                    1 -> inConsultation
                    else -> pastPatients
                }
            } else {
                when (selectedTab) {
                    0 -> inConsultation
                    else -> pastPatients
                }
            }

            if (currentList.isEmpty()) {
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
                            Icons.Default.Person,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.outline,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = if (userRole == "clinic") {
                                when (selectedTab) {
                                    0 -> "No Pending Patient Approvals"
                                    1 -> "No Patients in OPD Consultation Queue"
                                    else -> "No Past Patient Records"
                                }
                            } else {
                                if (selectedTab == 0) "No Patients in Your OPD Queue" else "No Past Consultations"
                            },
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = if (userRole == "clinic") {
                                when (selectedTab) {
                                    0 -> "Fresh patient appointments booked online will appear here on top for clinic approval."
                                    1 -> "Patients transferred to doctors awaiting or undergoing consultation appear here."
                                    else -> "Completed appointments will be archived here with options to enter clinic remarks."
                                }
                            } else {
                                if (selectedTab == 0) "Approved appointments transferred by clinic reception will appear here."
                                else "Completed patient visits appear here."
                            },
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(currentList, key = { it.id }) { appt ->
                        val assignedDoctor = affiliatedDoctors.find { it.id == appt.doctorId }
                        val isTransferredToDoctor = (appt.checkinStatus == "checked_in" || appt.checkinStatus == "in_consultation" || appt.checkinStatus == "inside_opd") && !appt.doctorId.isNullOrBlank()
                        val isCompleted = appt.checkinStatus == "completed"
                        val existingRemark = remarksMap[appt.id]

                        var selectedDoctorForAppt by remember(appt.id) {
                            mutableStateOf(assignedDoctor ?: affiliatedDoctors.firstOrNull())
                        }

                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isTransferredToDoctor) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f) else MaterialTheme.colorScheme.surface
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier
                                    .padding(16.dp)
                                    .fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Surface(
                                            shape = RoundedCornerShape(10.dp),
                                            color = if (isTransferredToDoctor) Color(0xFF10B981).copy(alpha = 0.2f) else MaterialTheme.colorScheme.primaryContainer,
                                            modifier = Modifier.size(42.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(
                                                    Icons.Default.Person,
                                                    contentDescription = null,
                                                    tint = if (isTransferredToDoctor) Color(0xFF047857) else MaterialTheme.colorScheme.onPrimaryContainer
                                                )
                                            }
                                        }

                                        Column {
                                            Text(appt.patientName, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                            Text(
                                                text = "${appt.patientAge ?: 30} yrs, ${appt.patientGender ?: "Patient"} • Tracking: ${appt.trackingCode10Digit}",
                                                fontSize = 12.sp,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }

                                    // Status Badge
                                    if (isCompleted) {
                                        Surface(color = Color(0xFFE5E7EB), shape = RoundedCornerShape(6.dp)) {
                                            Text("Completed", color = Color(0xFF374151), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                        }
                                    } else if (isTransferredToDoctor) {
                                        Surface(color = Color(0xFFD1FAE5), shape = RoundedCornerShape(6.dp)) {
                                            Text("In Doctor Queue", color = Color(0xFF065F46), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                        }
                                    } else {
                                        Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(6.dp)) {
                                            Text("Pending Approval", color = Color(0xFF92400E), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                        }
                                    }
                                }

                                HorizontalDivider()

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.CalendarToday, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
                                            Text(
                                                text = "Schedule: ${appt.appointmentDate} at ${appt.appointmentTime}",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.MedicalServices, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(14.dp))
                                            Text(
                                                text = "Doctor: ${assignedDoctor?.fullName ?: (if (userRole == "doctor") "You (Assigned Doctor)" else "Unassigned")}",
                                                fontSize = 12.sp,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }

                                // CLINIC REMARK DISPLAY (if exists)
                                if (!existingRemark.isNullOrBlank()) {
                                    Surface(
                                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(10.dp).fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text("Clinic Remark:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                                Text(existingRemark, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            }
                                            if (userRole == "clinic") {
                                                IconButton(
                                                    onClick = {
                                                        editingRemarkAppt = appt
                                                        remarkInput = existingRemark
                                                    },
                                                    modifier = Modifier.size(28.dp)
                                                ) {
                                                    Icon(Icons.Default.Edit, contentDescription = "Edit Remark", modifier = Modifier.size(16.dp))
                                                }
                                            }
                                        }
                                    }
                                }

                                // ACTION AREA
                                if (userRole == "clinic") {
                                    if (selectedTab == 0 && !isTransferredToDoctor && !isCompleted) {
                                        // PENDING APPROVAL TAB ACTIONS
                                        Column(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            if (affiliatedDoctors.size > 1) {
                                                Text("Select Doctor to Transfer:", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                Row(
                                                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    affiliatedDoctors.forEach { doc ->
                                                        FilterChip(
                                                            selected = selectedDoctorForAppt?.id == doc.id,
                                                            onClick = { selectedDoctorForAppt = doc },
                                                            label = { Text("Dr. ${doc.fullName}", fontSize = 11.sp) }
                                                        )
                                                    }
                                                }
                                            }

                                            val targetDoctor = selectedDoctorForAppt ?: assignedDoctor ?: affiliatedDoctors.firstOrNull()
                                            val targetDocName = targetDoctor?.fullName ?: "Doctor"

                                            Button(
                                                onClick = {
                                                    coroutineScope.launch {
                                                        isOperating = true
                                                        if (targetDoctor != null) {
                                                            val ok = appointmentRepository?.approveAndTransferToDoctor(appt.id, targetDoctor.id) == true
                                                            if (ok) {
                                                                actionMessage = "✓ ${appt.patientName} approved and transferred to Dr. $targetDocName's OPD queue!"
                                                                loadData()
                                                            } else {
                                                                actionMessage = "Error transferring appointment. Please try again."
                                                            }
                                                        } else {
                                                            actionMessage = "Please invite and affiliate a doctor to this clinic first."
                                                        }
                                                        isOperating = false
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                                shape = RoundedCornerShape(10.dp),
                                                modifier = Modifier.fillMaxWidth().height(44.dp),
                                                enabled = !isOperating
                                            ) {
                                                Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp), tint = Color.White)
                                                Spacer(Modifier.width(8.dp))
                                                Text("Confirm & Transfer to Dr. $targetDocName", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
                                            }
                                        }
                                    } else if (isCompleted) {
                                        // PAST VISITS TAB ACTIONS
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            OutlinedButton(
                                                onClick = {
                                                    editingRemarkAppt = appt
                                                    remarkInput = existingRemark ?: ""
                                                },
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.height(36.dp)
                                            ) {
                                                Icon(Icons.Default.RateReview, contentDescription = null, modifier = Modifier.size(16.dp))
                                                Spacer(Modifier.width(6.dp))
                                                Text(if (existingRemark.isNullOrBlank()) "Give Remark" else "Edit Remark", fontSize = 11.sp)
                                            }

                                            OutlinedButton(
                                                onClick = { navController.navigate(NavRoutes.BillingScreen) },
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.height(36.dp)
                                            ) {
                                                Text("Billing Invoice", fontSize = 11.sp)
                                            }
                                        }
                                    } else {
                                        // IN OPD QUEUE TAB ACTIONS
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF047857), modifier = Modifier.size(16.dp))
                                                Text(
                                                    text = "✓ In Dr. ${assignedDoctor?.fullName ?: "Doctor"}'s OPD Queue",
                                                    color = Color(0xFF047857),
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontSize = 12.sp
                                                )
                                            }
                                            OutlinedButton(
                                                onClick = { navController.navigate(NavRoutes.BillingScreen) },
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.height(36.dp)
                                            ) {
                                                Text("Billing Invoice", fontSize = 11.sp)
                                            }
                                        }
                                    }
                                } else {
                                    // Doctor role: View Clinical Chart
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.End,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Button(
                                            onClick = {
                                                navController.navigate("${NavRoutes.PatientDetail}/${appt.trackingCode10Digit}")
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            modifier = Modifier.height(36.dp)
                                        ) {
                                            Icon(Icons.Default.EditNote, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Open Clinical Chart", fontSize = 12.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // REMARK DIALOG FOR COMPLETED PATIENTS
            if (editingRemarkAppt != null) {
                val targetAppt = editingRemarkAppt!!
                AlertDialog(
                    onDismissRequest = { editingRemarkAppt = null },
                    title = { Text("Clinic Visit Remark", fontWeight = FontWeight.Bold) },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Patient: ${targetAppt.patientName} (${targetAppt.trackingCode10Digit})", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text("Visit: ${targetAppt.appointmentDate} at ${targetAppt.appointmentTime}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            OutlinedTextField(
                                value = remarkInput,
                                onValueChange = { remarkInput = it },
                                label = { Text("Enter remark for this completed visit") },
                                placeholder = { Text("e.g. Consultation complete. Follow-up after 1 week.") },
                                minLines = 3,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp)
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    if (billingRepository != null) {
                                        billingRepository.saveRemarkForAppointment(targetAppt.id, targetAppt.clinicId, remarkInput.trim())
                                        remarksMap = remarksMap + (targetAppt.id to remarkInput.trim())
                                    }
                                    actionMessage = "✓ Remark saved for ${targetAppt.patientName}!"
                                    editingRemarkAppt = null
                                }
                            }
                        ) {
                            Text("Save Remark")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { editingRemarkAppt = null }) {
                            Text("Cancel")
                        }
                    }
                )
            }
        }
    }
}
