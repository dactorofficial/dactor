package com.dactor.patient.ui.booking

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.patient.data.model.Doctor
import com.dactor.patient.data.model.Slot
import com.dactor.patient.data.repository.AuthRepository
import com.dactor.patient.data.repository.SlotRepository
import com.dactor.patient.ui.navigation.NavRoutes
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingScreen(
    navController: NavController,
    clinicId: String = "",
    slotRepository: SlotRepository? = null,
    doctorRepository: com.dactor.patient.data.repository.DoctorRepository? = null,
    authRepository: AuthRepository? = null,
    sessionManager: com.dactor.patient.data.local.UserSessionManager? = null
) {
    val today = LocalDate.now().toString()
    val tomorrow = LocalDate.now().plusDays(1).toString()
    var selectedDate by remember { mutableStateOf(today) }

    var doctors by remember { mutableStateOf<List<Doctor>>(emptyList()) }
    var selectedDoctor by remember { mutableStateOf<Doctor?>(null) }
    var slots by remember { mutableStateOf<List<Slot>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(clinicId) {
        if (doctorRepository != null && clinicId.isNotBlank()) {
            val docs = doctorRepository.getDoctors(clinicId)
            doctors = docs
            selectedDoctor = docs.firstOrNull()
        }
        if (slotRepository != null && clinicId.isNotBlank()) {
            slots = slotRepository.getAvailableSlots(clinicId, selectedDate)
        }
        isLoading = false
    }

    LaunchedEffect(selectedDate, selectedDoctor) {
        if (slotRepository != null && clinicId.isNotBlank()) {
            slots = slotRepository.getAvailableSlots(clinicId, selectedDate)
        }
    }

    var showAuthModal by remember { mutableStateOf(false) }
    var pendingSlotId by remember { mutableStateOf<String?>(null) }

    val filteredSlots = if (selectedDoctor != null) {
        slots.filter { it.doctorId == selectedDoctor?.id }
    } else {
        slots
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Select Appointment Slot", fontWeight = FontWeight.Bold) },
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
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "Select your physician and available appointment window. Appointments are booked for offline, in-person consultation at the clinic.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Select Doctor
            if (doctors.isNotEmpty()) {
                Text("Choose Doctor", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    for (doc in doctors) {
                        FilterChip(
                            selected = selectedDoctor?.id == doc.id,
                            onClick = { selectedDoctor = doc },
                            label = { Text("${doc.fullName} (${doc.specialty})", fontSize = 12.sp) }
                        )
                    }
                }
            }

            // Select Date
            Text("Select Date", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = selectedDate == today,
                    onClick = { selectedDate = today },
                    label = { Text("Today ($today)") }
                )
                FilterChip(
                    selected = selectedDate == tomorrow,
                    onClick = { selectedDate = tomorrow },
                    label = { Text("Tomorrow ($tomorrow)") }
                )
            }

            Text("Available Timed Slots (${filteredSlots.size})", fontWeight = FontWeight.Bold, fontSize = 14.sp)

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(filteredSlots, key = { it.id }) { slot ->
                    val isFull = slot.bookedCount >= slot.maxCapacity
                    val isUserLoggedIn = sessionManager?.isLoggedIn() == true ||
                            (authRepository?.isLoggedIn() ?: false) ||
                            (try { com.google.firebase.auth.FirebaseAuth.getInstance().currentUser != null } catch (e: Exception) { false })

                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isFull) Color(0xFFF3F4F6) else MaterialTheme.colorScheme.surface
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !isFull) {
                                if (isUserLoggedIn) {
                                    navController.navigate(NavRoutes.BookingForm.createRoute(slot.id, clinicId))
                                } else {
                                    pendingSlotId = slot.id
                                    showAuthModal = true
                                }
                            }
                    ) {
                            Row(
                                modifier = Modifier
                                    .padding(16.dp)
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (isFull) Color.LightGray else MaterialTheme.colorScheme.primaryContainer,
                                        modifier = Modifier.size(42.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(Icons.Default.Schedule, contentDescription = null, tint = if (isFull) Color.DarkGray else MaterialTheme.colorScheme.onPrimaryContainer)
                                        }
                                    }

                                    Column {
                                        val remainingSeats = (slot.maxCapacity - slot.bookedCount).coerceAtLeast(0)
                                        Text("${slot.startTime} - ${slot.endTime}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                        Text(
                                            text = if (isFull) "Slot Full (0 seats left of ${slot.maxCapacity})" else "$remainingSeats seats left of ${slot.maxCapacity} (${slot.bookedCount} registered)",
                                            fontSize = 12.sp,
                                            color = if (isFull) MaterialTheme.colorScheme.error else Color(0xFF059669),
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }

                                Button(
                                    onClick = {
                                        if (isUserLoggedIn) {
                                            navController.navigate(NavRoutes.BookingForm.createRoute(slot.id, clinicId))
                                        } else {
                                            pendingSlotId = slot.id
                                            showAuthModal = true
                                        }
                                    },
                                    enabled = !isFull,
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text(if (isFull) "Full" else "Book")
                                }
                            }
                        }
                    }
                }
            }

            // Booking Interceptor Authentication Prompt Modal (Shown ONLY to Guests / Non-Signed-In users)
            if (showAuthModal) {
                AlertDialog(
                    onDismissRequest = { showAuthModal = false },
                    title = { Text("Sign In or Continue as Guest", fontWeight = FontWeight.Bold) },
                    text = {
                        Text(
                            "You are currently booking as a guest. You can sign in to link this appointment to your patient history, or continue directly as a guest.",
                            fontSize = 13.sp
                        )
                    },
                    confirmButton = {
                        Button(onClick = {
                            showAuthModal = false
                            navController.navigate(NavRoutes.Login.route)
                        }) {
                            Text("Sign In / Register")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = {
                            // Continue directly as guest
                            showAuthModal = false
                            navController.navigate(NavRoutes.BookingForm.createRoute(pendingSlotId ?: "slot_1", clinicId))
                        }) {
                            Text("Continue as Guest")
                        }
                    }
                )
            }
    }
}
