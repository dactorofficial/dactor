package com.dactor.clinic.ui.walkin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import com.dactor.clinic.domain.util.DateTimePickers
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.repository.AppointmentRepository
import com.dactor.clinic.domain.util.TrackingCodeGenerator
import kotlinx.coroutines.launch
import java.time.LocalDate

import androidx.compose.foundation.horizontalScroll
import com.dactor.clinic.data.model.Doctor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalkinBookingScreen(
    navController: NavController,
    clinicId: String = "",
    appointmentRepository: AppointmentRepository? = null,
    doctorRepository: com.dactor.clinic.data.repository.DoctorRepository? = null,
    slotRepository: com.dactor.clinic.data.repository.SlotRepository? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else com.dactor.clinic.data.local.UserSessionManager(context).getSavedClinicId() ?: ""
    }
    var patientName by remember { mutableStateOf("") }
    var mobileNumber by remember { mutableStateOf("") }
    var age by remember { mutableStateOf("") }
    var selectedGender by remember { mutableStateOf("Male") }
    var email by remember { mutableStateOf("") }
    var appointmentDate by remember { mutableStateOf(LocalDate.now().toString()) }

    val defaultTime = remember {
        try {
            java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
        } catch (e: Exception) {
            "10:00"
        }
    }
    var appointmentTime by remember { mutableStateOf(defaultTime) }
    var feeAmount by remember { mutableStateOf("500") }
    var isOverbookingConfirmed by remember { mutableStateOf(false) }

    var affiliatedDoctors by remember { mutableStateOf<List<Doctor>>(emptyList()) }
    var selectedDoctor by remember { mutableStateOf<Doctor?>(null) }
    var publishedSlots by remember { mutableStateOf<List<com.dactor.clinic.data.model.Slot>>(emptyList()) }
    var selectedSlot by remember { mutableStateOf<com.dactor.clinic.data.model.Slot?>(null) }

    LaunchedEffect(effectiveClinicId) {
        if (doctorRepository != null && effectiveClinicId.isNotBlank()) {
            val docs = doctorRepository.getDoctorsByClinic(effectiveClinicId)
            affiliatedDoctors = docs
            selectedDoctor = docs.firstOrNull()
        }
    }

    LaunchedEffect(effectiveClinicId, appointmentDate, selectedDoctor) {
        if (slotRepository != null && effectiveClinicId.isNotBlank() && selectedDoctor != null) {
            val allSlots = slotRepository.getSlots(effectiveClinicId, appointmentDate)
            publishedSlots = allSlots.filter { it.doctorId == selectedDoctor?.id }
        } else {
            publishedSlots = emptyList()
        }
    }

    var isSubmitting by remember { mutableStateOf(false) }
    var confirmedCode by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reception Desk Walk-In Booking", fontWeight = FontWeight.Bold) },
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
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Book an offline in-person consultation on the spot. If the patient registers on Dactor with this phone or email in the future, all records sync automatically.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (errorMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorMessage ?: "",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(12.dp),
                        fontSize = 13.sp
                    )
                }
            }

            OutlinedTextField(
                value = patientName,
                onValueChange = { patientName = it },
                label = { Text("Patient Full Name") },
                placeholder = { Text("Full Legal Name") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = mobileNumber,
                onValueChange = { mobileNumber = it },
                label = { Text("Mobile Number (+977)") },
                placeholder = { Text("9841203841") },
                leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = age,
                    onValueChange = { age = it },
                    label = { Text("Age") },
                    placeholder = { Text("35") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )

                Column(modifier = Modifier.weight(2f)) {
                    Text("Gender", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("Male", "Female", "Other").forEach { gender ->
                            FilterChip(
                                selected = selectedGender == gender,
                                onClick = { selectedGender = gender },
                                label = { Text(gender, fontSize = 12.sp) }
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email (Optional for Future Sync)") },
                placeholder = { Text("patient@example.com") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            if (affiliatedDoctors.isNotEmpty()) {
                Text("Select Attending Doctor", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Row(
                    modifier = Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    for (doc in affiliatedDoctors) {
                        FilterChip(
                            selected = selectedDoctor?.id == doc.id,
                            onClick = { selectedDoctor = doc },
                            label = { Text("Dr. ${doc.fullName} (${doc.specialty})", fontSize = 12.sp) }
                        )
                    }
                }
            }

            if (publishedSlots.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Select Published Slot (Overbooking Permitted)", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Row(
                        modifier = Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        for (slot in publishedSlots) {
                            val isFull = slot.bookedCount >= slot.maxCapacity
                            val isSelected = selectedSlot?.id == slot.id
                            FilterChip(
                                selected = isSelected,
                                onClick = {
                                    if (isSelected) {
                                        selectedSlot = null
                                    } else {
                                        selectedSlot = slot
                                        appointmentTime = "${slot.startTime} - ${slot.endTime}"
                                    }
                                },
                                label = {
                                    Text(
                                        text = if (isFull) "${slot.startTime} - ${slot.endTime} (${slot.bookedCount}/${slot.maxCapacity} Full - Overbook)"
                                        else "${slot.startTime} - ${slot.endTime} (${slot.bookedCount}/${slot.maxCapacity})",
                                        fontSize = 11.sp,
                                        fontWeight = if (isFull) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isFull) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            )
                        }
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = appointmentDate,
                    onValueChange = { appointmentDate = it },
                    label = { Text("Appointment Date") },
                    placeholder = { Text("YYYY-MM-DD") },
                    trailingIcon = {
                        IconButton(onClick = {
                            DateTimePickers.showDatePicker(context, appointmentDate) { picked ->
                                appointmentDate = picked
                            }
                        }) {
                            Icon(Icons.Default.CalendarMonth, contentDescription = "Pick Date", tint = MaterialTheme.colorScheme.primary)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
                OutlinedTextField(
                    value = appointmentTime,
                    onValueChange = { appointmentTime = it },
                    label = { Text("Time Window") },
                    placeholder = { Text("HH:mm") },
                    trailingIcon = {
                        IconButton(onClick = {
                            DateTimePickers.showClockTimePicker(context, appointmentTime) { picked ->
                                appointmentTime = picked
                            }
                        }) {
                            Icon(Icons.Default.Schedule, contentDescription = "Pick Clock Time", tint = MaterialTheme.colorScheme.primary)
                        }
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            // Overbooking Capacity Override Notice
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.4f)
                ),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                    Column {
                        Text("Reception Desk Overbooking Enabled", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(
                            "You can register this walk-in even if the current slot is 100% full. The patient will be added to today's queue.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Button(
                onClick = {
                    if (patientName.isBlank() || mobileNumber.isBlank() || age.isBlank()) {
                        errorMessage = "Please enter patient name, mobile number, and age."
                        return@Button
                    }

                    isSubmitting = true
                    errorMessage = null

                    coroutineScope.launch {
                        val generatedCode = TrackingCodeGenerator.generate()
                        val walkin = Appointment(
                            id = java.util.UUID.randomUUID().toString(),
                            trackingCode10Digit = generatedCode,
                            slotId = selectedSlot?.id,
                            clinicId = effectiveClinicId,
                            doctorId = selectedDoctor?.id,
                            patientName = patientName.trim(),
                            patientMobile = mobileNumber.trim(),
                            patientAge = age.toIntOrNull() ?: 30,
                            patientGender = selectedGender,
                            patientEmail = email.trim().ifBlank { null },
                            appointmentDate = appointmentDate,
                            appointmentTime = appointmentTime,
                            paymentStatus = "paid",
                            checkinStatus = "checked_in",
                            feeAmount = feeAmount.toDoubleOrNull() ?: 500.0,
                            isWalkin = true
                        )

                        appointmentRepository?.createWalkinAppointment(walkin, allowOverbooking = true)
                        isSubmitting = false
                        confirmedCode = generatedCode
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                enabled = !isSubmitting
            ) {
                Text(if (isSubmitting) "Booking Walk-In..." else "Confirm Walk-In & Generate 10-Digit Code", fontWeight = FontWeight.Bold)
            }
        }

        // Confirmation Dialog with 10-digit code
        if (confirmedCode != null) {
            AlertDialog(
                onDismissRequest = {
                    confirmedCode = null
                    navController.popBackStack()
                },
                icon = { Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(36.dp)) },
                title = { Text("Walk-In Appointment Confirmed!", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Patient is enqueued. Provide this 10-digit tracking code to the patient:", fontSize = 13.sp)
                        Surface(
                            color = MaterialTheme.colorScheme.primaryContainer,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = confirmedCode ?: "",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                letterSpacing = 2.sp,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)
                            )
                        }
                        Text(
                            "The patient can track their live queue position at anytime using this code without logging in.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        confirmedCode = null
                        navController.popBackStack()
                    }) {
                        Text("Done")
                    }
                }
            )
        }
    }
}
