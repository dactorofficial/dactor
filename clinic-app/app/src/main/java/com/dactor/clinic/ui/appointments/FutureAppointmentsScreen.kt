package com.dactor.clinic.ui.appointments

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import com.dactor.clinic.domain.util.DateTimePickers
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.repository.AppointmentRepository
import kotlinx.coroutines.launch
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FutureAppointmentsScreen(
    navController: NavController,
    clinicId: String = "",
    appointmentRepository: AppointmentRepository? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val sessionManager = remember { com.dactor.clinic.data.local.UserSessionManager(context) }
    val userRole = sessionManager.getUserRole() ?: "clinic"
    val doctorId = sessionManager.getSavedDoctorId() ?: ""
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else sessionManager.getSavedClinicId() ?: ""
    }

    val today = LocalDate.now().toString()
    val tomorrow = LocalDate.now().plusDays(1).toString()
    val nextWeek = LocalDate.now().plusDays(7).toString()

    var selectedDate by remember { mutableStateOf(tomorrow) }
    var appointments by remember { mutableStateOf<List<Appointment>>(emptyList()) }

    var showRescheduleDialog by remember { mutableStateOf(false) }
    var selectedApptForReschedule by remember { mutableStateOf<Appointment?>(null) }
    var newDateInput by remember { mutableStateOf("") }
    var newTimeInput by remember { mutableStateOf("") }

    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(effectiveClinicId, doctorId, userRole) {
        if (appointmentRepository != null) {
            if (userRole == "doctor" && doctorId.isNotBlank()) {
                val remote = appointmentRepository.getAppointmentsByDoctor(doctorId)
                appointments = remote
            } else if (effectiveClinicId.isNotBlank()) {
                val remote = appointmentRepository.getAppointmentsByClinic(effectiveClinicId)
                appointments = remote
            }
        }
    }

    val currentAppointments = appointments.filter { it.appointmentDate == selectedDate }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Future Appointments Calendar", fontWeight = FontWeight.Bold) },
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
                .padding(horizontal = 16.dp)
        ) {
            Text(
                text = "Select any date to inspect booked appointments, alter scheduled queue order, or shift dates/slots.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 10.dp)
            )

            // Date Selection Pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedDate == tomorrow,
                    onClick = { selectedDate = tomorrow },
                    label = { Text("Tomorrow ($tomorrow)") }
                )
                FilterChip(
                    selected = selectedDate == nextWeek,
                    onClick = { selectedDate = nextWeek },
                    label = { Text("Next Week ($nextWeek)") }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (currentAppointments.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No appointments scheduled for $selectedDate.")
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    itemsIndexed(currentAppointments, key = { _, it -> it.id }) { index, appt ->
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .padding(14.dp)
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    // Order Badge
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = MaterialTheme.colorScheme.primaryContainer,
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("#${index + 1}", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                        }
                                    }

                                    Column {
                                        Text(appt.patientName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        Text("Time: ${appt.appointmentTime} • Code: ${appt.trackingCode10Digit}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text("Phone: ${appt.patientMobile}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }

                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    // Queue order shifting
                                    if (index > 0) {
                                        IconButton(
                                            onClick = {
                                                val mutable = appointments.toMutableList()
                                                val i1 = mutable.indexOf(appt)
                                                val i2 = mutable.indexOf(currentAppointments[index - 1])
                                                if (i1 != -1 && i2 != -1) {
                                                    val temp = mutable[i1]
                                                    mutable[i1] = mutable[i2]
                                                    mutable[i2] = temp
                                                    appointments = mutable
                                                }
                                            },
                                            modifier = Modifier.size(28.dp)
                                        ) {
                                            Icon(Icons.Default.ArrowUpward, contentDescription = "Move Up", modifier = Modifier.size(16.dp))
                                        }
                                    }

                                    if (index < currentAppointments.size - 1) {
                                        IconButton(
                                            onClick = {
                                                val mutable = appointments.toMutableList()
                                                val i1 = mutable.indexOf(appt)
                                                val i2 = mutable.indexOf(currentAppointments[index + 1])
                                                if (i1 != -1 && i2 != -1) {
                                                    val temp = mutable[i1]
                                                    mutable[i1] = mutable[i2]
                                                    mutable[i2] = temp
                                                    appointments = mutable
                                                }
                                            },
                                            modifier = Modifier.size(28.dp)
                                        ) {
                                            Icon(Icons.Default.ArrowDownward, contentDescription = "Move Down", modifier = Modifier.size(16.dp))
                                        }
                                    }

                                    IconButton(
                                        onClick = {
                                            selectedApptForReschedule = appt
                                            newDateInput = appt.appointmentDate
                                            newTimeInput = appt.appointmentTime
                                            showRescheduleDialog = true
                                        }
                                    ) {
                                        Icon(Icons.Default.EditCalendar, contentDescription = "Shift Date", tint = MaterialTheme.colorScheme.primary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Reschedule Dialog
        if (showRescheduleDialog && selectedApptForReschedule != null) {
            val appt = selectedApptForReschedule!!
            AlertDialog(
                onDismissRequest = { showRescheduleDialog = false },
                title = { Text("Shift Appointment Date / Time", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Patient: ${appt.patientName} (${appt.trackingCode10Digit})", fontSize = 13.sp)
                        OutlinedTextField(
                            value = newDateInput,
                            onValueChange = { newDateInput = it },
                            label = { Text("New Date (YYYY-MM-DD)") },
                            trailingIcon = {
                                IconButton(onClick = {
                                    DateTimePickers.showDatePicker(context, newDateInput) { picked ->
                                        newDateInput = picked
                                    }
                                }) {
                                    Icon(Icons.Default.EditCalendar, contentDescription = "Pick Date", tint = MaterialTheme.colorScheme.primary)
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        )
                        OutlinedTextField(
                            value = newTimeInput,
                            onValueChange = { newTimeInput = it },
                            label = { Text("New Time (HH:mm)") },
                            trailingIcon = {
                                IconButton(onClick = {
                                    DateTimePickers.showClockTimePicker(context, newTimeInput) { picked ->
                                        newTimeInput = picked
                                    }
                                }) {
                                    Icon(Icons.Default.Schedule, contentDescription = "Pick Clock Time", tint = MaterialTheme.colorScheme.primary)
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            coroutineScope.launch {
                                appointmentRepository?.rescheduleAppointment(
                                    id = appt.id,
                                    newDate = newDateInput.trim(),
                                    newTime = newTimeInput.trim(),
                                    newSlotId = null
                                )
                                appointments = appointments.map {
                                    if (it.id == appt.id) it.copy(appointmentDate = newDateInput.trim(), appointmentTime = newTimeInput.trim()) else it
                                }
                                showRescheduleDialog = false
                            }
                        }
                    ) {
                        Text("Confirm Shift")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showRescheduleDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
