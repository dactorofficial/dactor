package com.dactor.patient.ui.booking

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.patient.data.model.Appointment
import com.dactor.patient.data.repository.AppointmentRepository
import com.dactor.patient.domain.util.TrackingCodeGenerator
import com.dactor.patient.ui.navigation.NavRoutes
import com.dactor.patient.data.model.Doctor
import com.dactor.patient.data.model.Slot
import kotlinx.coroutines.launch
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingFormScreen(
    navController: NavController,
    slotId: String = "slot_1",
    clinicId: String = "",
    clinicType: String = "multi_visit", // "single_visit", "multi_visit", "diagnostic_lab"
    appointmentRepository: AppointmentRepository? = null,
    slotRepository: com.dactor.patient.data.repository.SlotRepository? = null,
    clinicRepository: com.dactor.patient.data.repository.ClinicRepository? = null,
    authRepository: com.dactor.patient.data.repository.AuthRepository? = null,
    sessionManager: com.dactor.patient.data.local.UserSessionManager? = null,
    doctorRepository: com.dactor.patient.data.repository.DoctorRepository? = null
) {
    val isUserLoggedIn = sessionManager?.isLoggedIn() == true ||
            (authRepository?.isLoggedIn() ?: false) ||
            (try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser != null } catch (e: Exception) { false })

    val savedName = if (isUserLoggedIn) (sessionManager?.getSavedName()?.ifBlank { null }
        ?: try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.displayName } catch (e: Exception) { null }) else null
    val savedEmail = if (isUserLoggedIn) (sessionManager?.getSavedEmail()?.ifBlank { null }
        ?: try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email } catch (e: Exception) { null }) else null
    val savedPhone = if (isUserLoggedIn) sessionManager?.getSavedPhone()?.ifBlank { null } else null
    val savedPatientId = if (isUserLoggedIn) (sessionManager?.getSavedPatientId()?.ifBlank { null }
        ?: try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid } catch (e: Exception) { null }) else null

    var isReturningPatient by remember { mutableStateOf(false) }
    var selectedReturningCode by remember { mutableStateOf("") }
    var manualCodeInput by remember { mutableStateOf("") }

    var fullName by remember { mutableStateOf(savedName ?: "") }
    var age by remember { mutableStateOf("") }
    var selectedGender by remember { mutableStateOf("Male") }
    var mobile by remember { mutableStateOf(savedPhone ?: "") }
    var email by remember { mutableStateOf(savedEmail ?: "") }

    val savedCodes = remember { mutableStateListOf<Pair<String, String>>() }

    var errorMessage by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var loadedSlot by remember { mutableStateOf<Slot?>(null) }
    var slotDoctorName by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(slotId) {
        if (slotId.isNotBlank() && slotId != "slot_1" && slotRepository != null) {
            try {
                val s = slotRepository.getSlotById(slotId)
                if (s != null) {
                    loadedSlot = s
                    if (doctorRepository != null && s.doctorId.isNotBlank()) {
                        val doc = doctorRepository.getDoctorById(s.doctorId)
                        slotDoctorName = doc?.fullName
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    LaunchedEffect(Unit) {
        if (sessionManager != null) {
            val localCodes = sessionManager.getSavedTrackingCodes()
            savedCodes.clear()
            if (appointmentRepository != null) {
                for (codePair in localCodes) {
                    try {
                        val valid = appointmentRepository.getAppointmentByTrackingCode(codePair.first)
                        if (valid != null) {
                            savedCodes.add(codePair)
                        } else {
                            sessionManager.removeTrackingCode(codePair.first)
                        }
                    } catch (e: Exception) {
                        savedCodes.add(codePair)
                    }
                }
            } else {
                savedCodes.addAll(localCodes)
            }
        }

        if (isUserLoggedIn) {
            if (fullName.isBlank() && !savedName.isNullOrBlank()) {
                fullName = savedName
            }
            if (email.isBlank() && !savedEmail.isNullOrBlank()) {
                email = savedEmail
            }
            if (mobile.isBlank() && !savedPhone.isNullOrBlank()) {
                mobile = savedPhone
            }

            val queryEmail = savedEmail ?: authRepository?.getCurrentUserEmail()
            if (!queryEmail.isNullOrBlank() && authRepository != null) {
                try {
                    val profile = authRepository.getProfileByEmail(queryEmail)
                    if (profile != null) {
                        if (fullName.isBlank() && !profile.fullName.isNullOrBlank()) {
                            fullName = profile.fullName
                        }
                        if (mobile.isBlank() && !profile.phone.isNullOrBlank()) {
                            mobile = profile.phone
                        }
                    }
                } catch (ignored: Exception) {}
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Patient Information", fontWeight = FontWeight.Bold) },
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
            // SELECTED APPOINTMENT SCHEDULE CARD
            if (loadedSlot != null) {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(40.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Schedule, contentDescription = null, tint = Color.White)
                            }
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Slot: ${loadedSlot?.slotDate} at ${loadedSlot?.startTime} - ${loadedSlot?.endTime}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "Doctor: ${slotDoctorName ?: "OPD Attending Physician"}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // USER ACCOUNT STATUS / GUEST BANNER
            if (isUserLoggedIn) {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.AccountCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                            }
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Signed In: ${fullName.ifBlank { savedName ?: "Patient" }}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(
                                text = "Information prefilled from your account. Appointment will be linked to your patient profile.",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            } else {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.PersonOutline, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(26.dp))
                            Column {
                                Text("Booking as Guest", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text("Sign in to auto-fill details and track in your profile", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        TextButton(onClick = { navController.navigate(NavRoutes.Login.route) }) {
                            Text("Sign In", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                }
            }

            // MULTI-VISIT PATIENT STATUS SWITCHER
            if (clinicType == "multi_visit") {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Patient Status (Multi-Visit Clinic)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(
                            "For multi-visit follow-up clinics, returning patients with an existing 10-digit code can book without paying any consultation fee.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = !isReturningPatient,
                                onClick = { isReturningPatient = false },
                                label = { Text("New Patient (Payment Compulsory)", fontSize = 12.sp) }
                            )
                            FilterChip(
                                selected = isReturningPatient,
                                onClick = { isReturningPatient = true },
                                label = { Text("Returning Patient (Free)", fontSize = 12.sp) }
                            )
                        }

                        // Returning patient 10-digit code auto-suggest / input
                        if (isReturningPatient) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text("Select from your saved 10-digit codes:", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                savedCodes.forEach { (code, label) ->
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (selectedReturningCode == code) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                selectedReturningCode = code
                                                manualCodeInput = code
                                                coroutineScope.launch {
                                                    val pastAppt = appointmentRepository?.getAppointmentByTrackingCode(code)
                                                    if (pastAppt != null) {
                                                        fullName = pastAppt.patientName
                                                        age = pastAppt.patientAge.toString()
                                                        mobile = pastAppt.patientMobile
                                                        selectedGender = pastAppt.patientGender
                                                    }
                                                }
                                            }
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(code, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                                Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            }
                                            if (selectedReturningCode == code) {
                                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                            }
                                        }
                                    }
                                }

                                OutlinedTextField(
                                    value = manualCodeInput,
                                    onValueChange = {
                                        if (it.length <= 10 && it.all { char -> char.isDigit() }) {
                                            manualCodeInput = it
                                            selectedReturningCode = it
                                        }
                                    },
                                    label = { Text("Or Type 10-Digit Code Manually") },
                                    placeholder = { Text("9841203841") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp)
                                )
                            }
                        }
                    }
                }
            }

            Text("Patient Details for this Appointment", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(
                "Personal details are collected per-appointment so one account can easily book for family members and friends.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (errorMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(errorMessage ?: "", color = MaterialTheme.colorScheme.onErrorContainer, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                }
            }

            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text("Patient Full Name") },
                placeholder = { Text("Full Legal Name") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = mobile,
                onValueChange = { mobile = it },
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
                        listOf("Male", "Female", "Other").forEach { g ->
                            FilterChip(
                                selected = selectedGender == g,
                                onClick = { selectedGender = g },
                                label = { Text(g, fontSize = 12.sp) }
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email (Optional for Report & Push Alerts)") },
                placeholder = { Text("patient@dactor.com.np") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            // Submit Button
            Button(
                onClick = {
                    if (fullName.isBlank() || mobile.isBlank() || age.isBlank()) {
                        errorMessage = "Please enter patient name, mobile number, and age."
                        return@Button
                    }

                    if (isReturningPatient && manualCodeInput.length != 10) {
                        errorMessage = "Please enter or select a valid 10-digit code for returning patient."
                        return@Button
                    }

                    val generatedCode = if (isReturningPatient && manualCodeInput.length == 10) manualCodeInput else TrackingCodeGenerator.generate()
                    val apptId = UUID.randomUUID().toString()

                    coroutineScope.launch {
                        try {
                            var resolvedClinicId = clinicId.ifBlank { null }
                            var resolvedDoctorId: String? = null
                            var resolvedDate = java.time.LocalDate.now().toString()
                            var resolvedTime = "09:30"

                            // 1. Resolve from slot
                            val s = loadedSlot ?: (if (slotId.isNotBlank() && slotId != "slot_1" && slotRepository != null) slotRepository.getSlotById(slotId) else null)
                            if (s != null) {
                                if (resolvedClinicId == null) {
                                    resolvedClinicId = s.clinicId
                                }
                                resolvedDoctorId = s.doctorId
                                resolvedDate = s.slotDate
                                resolvedTime = s.startTime
                            }

                            // 2. Fallback clinic lookup
                            if (resolvedClinicId == null && clinicRepository != null) {
                                resolvedClinicId = clinicRepository.getClinics().firstOrNull()?.id
                            }

                            val finalClinicId = resolvedClinicId ?: "b5d931aa-15d2-4eee-b2f1-7729d2f28d64"

                            // 3. Fallback doctor lookup: if doctorId is not set, look up affiliated doctors for this clinic
                            if (resolvedDoctorId.isNullOrBlank() && doctorRepository != null) {
                                try {
                                    val docs = doctorRepository.getDoctors(finalClinicId)
                                    resolvedDoctorId = docs.firstOrNull()?.id
                                } catch (ignored: Exception) {}
                            }

                            // 4. Fallback slot lookup if slot was not explicitly loaded
                            if (s == null && slotRepository != null && finalClinicId.isNotBlank()) {
                                try {
                                    val availableSlots = slotRepository.getAvailableSlots(finalClinicId, resolvedDate)
                                    val candidate = if (!resolvedDoctorId.isNullOrBlank()) {
                                        availableSlots.firstOrNull { it.doctorId == resolvedDoctorId } ?: availableSlots.firstOrNull()
                                    } else {
                                        availableSlots.firstOrNull()
                                    }
                                    if (candidate != null) {
                                        resolvedTime = candidate.startTime
                                        resolvedDate = candidate.slotDate
                                        if (resolvedDoctorId.isNullOrBlank()) {
                                            resolvedDoctorId = candidate.doctorId
                                        }
                                    }
                                } catch (ignored: Exception) {}
                            }

                            // Safe UUID resolution for userId referencing profiles(id)
                            var resolvedUserId: String? = null
                            if (isUserLoggedIn) {
                                val userEmail = (email.ifBlank { savedEmail ?: "" }).trim().lowercase()
                                if (userEmail.isNotBlank() && authRepository != null) {
                                    try {
                                        val p = authRepository.getProfileByEmail(userEmail)
                                        if (p != null) {
                                            resolvedUserId = p.id
                                        }
                                    } catch (ignored: Exception) {}
                                }
                                if (resolvedUserId == null && !savedPatientId.isNullOrBlank()) {
                                    try {
                                        java.util.UUID.fromString(savedPatientId)
                                        resolvedUserId = savedPatientId
                                    } catch (ignored: Exception) {
                                        resolvedUserId = null
                                    }
                                }
                            }

                            val appt = Appointment(
                                id = apptId,
                                trackingCode10Digit = generatedCode,
                                slotId = if (slotId.isNotBlank() && slotId != "slot_1") slotId else null,
                                clinicId = finalClinicId,
                                doctorId = resolvedDoctorId,
                                userId = resolvedUserId,
                                patientName = fullName.trim(),
                                patientMobile = mobile.trim(),
                                patientAge = age.toIntOrNull() ?: 30,
                                patientGender = selectedGender,
                                patientEmail = email.trim().ifBlank { null },
                                appointmentDate = resolvedDate,
                                appointmentTime = resolvedTime,
                                paymentStatus = if (isReturningPatient) "not_required" else "pending",
                                checkinStatus = "not_checked_in",
                                feeAmount = if (isReturningPatient) 0.0 else 500.0,
                                isWalkin = false
                            )

                            appointmentRepository?.createAppointment(appt)
                            sessionManager?.saveTrackingCode(generatedCode, "${fullName.trim()} • $resolvedDate")

                            if (isReturningPatient) {
                                appointmentRepository?.confirmPaymentAndJoinQueue(apptId)
                                navController.navigate(NavRoutes.AppointmentConfirmed.createRoute(apptId))
                            } else {
                                navController.navigate(NavRoutes.Payment.createRoute(apptId))
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            errorMessage = "Booking error: ${e.message ?: "Please try again."}"
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text(
                    text = if (isReturningPatient) "Confirm Follow-Up (Free of Charge)" else "Proceed to Payment (Rs. 500)",
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
