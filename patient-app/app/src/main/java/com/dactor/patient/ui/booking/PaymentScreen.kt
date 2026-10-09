package com.dactor.patient.ui.booking

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import com.dactor.patient.data.repository.SlotRepository
import com.dactor.patient.domain.util.CurrencyFormatter
import com.dactor.patient.ui.navigation.NavRoutes
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentScreen(
    navController: NavController,
    appointmentId: String = "",
    feeAmount: Double = 500.0,
    slotRepository: SlotRepository? = null,
    appointmentRepository: com.dactor.patient.data.repository.AppointmentRepository? = null,
    sessionManager: com.dactor.patient.data.local.UserSessionManager? = null
) {
    // 5-Minute Countdown Timer (300 seconds)
    var timeLeftSeconds by remember { mutableIntStateOf(300) }
    var isExpired by remember { mutableStateOf(false) }
    var selectedPaymentMethod by remember { mutableStateOf("esewa") }
    var isProcessing by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    LaunchedEffect(Unit) {
        while (timeLeftSeconds > 0) {
            delay(1000L)
            timeLeftSeconds--
        }
        isExpired = true
    }

    fun confirmAndProceed() {
        if (isProcessing) return
        isProcessing = true
        coroutineScope.launch {
            try {
                if (appointmentId.isNotBlank() && appointmentRepository != null) {
                    appointmentRepository.confirmPaymentAndJoinQueue(appointmentId)
                    val appt = appointmentRepository.getAppointmentById(appointmentId)
                    if (appt != null) {
                        sessionManager?.saveTrackingCode(appt.trackingCode10Digit, "${appt.patientName} • ${appt.appointmentDate}")
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            isProcessing = false
            navController.navigate(NavRoutes.AppointmentConfirmed.createRoute(appointmentId))
        }
    }

    val minutes = timeLeftSeconds / 60
    val seconds = timeLeftSeconds % 60
    val formattedTime = "%02d:%02d".format(minutes, seconds)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Checkout & Confirmation", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = {
                        coroutineScope.launch {
                            slotRepository?.releaseSlotLock(appointmentId)
                        }
                        navController.popBackStack()
                    }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 8.dp,
                shadowElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(modifier = Modifier.padding(16.dp)) {
                    Button(
                        onClick = { confirmAndProceed() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                        enabled = !isProcessing
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(22.dp))
                                Text("Confirm Appointment Booking (Free)", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            }
                        }
                    }
                }
            }
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
            // 5-Minute Atomic Lock Banner Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primaryContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = null,
                            tint = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            "Slot Exclusively Reserved For You",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }

                    Text(
                        text = formattedTime,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                        letterSpacing = 2.sp
                    )

                    LinearProgressIndicator(
                        progress = { timeLeftSeconds / 300f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp),
                        color = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                        trackColor = Color.White.copy(alpha = 0.5f)
                    )

                    Text(
                        text = "Double-booking protection is active. Complete payment before the timer expires.",
                        fontSize = 11.sp,
                        color = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            // Fee Summary
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Payment Summary", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Doctor Consultation Fee", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(CurrencyFormatter.formatNPR(feeAmount), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Queue Reservation & Tracking Fee", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("FREE", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF059669))
                    }
                    Divider(modifier = Modifier.padding(vertical = 4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total Amount Due", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(CurrencyFormatter.formatNPR(feeAmount), fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }

            // Payment Methods
            Text("Select Payment Gateway", fontWeight = FontWeight.Bold, fontSize = 14.sp)

            val gateways = listOf(
                Pair("esewa", "eSewa Mobile Wallet"),
                Pair("khalti", "Khalti Digital Wallet"),
                Pair("connectips", "ConnectIPS / Bank Transfer"),
                Pair("fonepay", "FonePay QR Payment")
            )

            gateways.forEach { (id, label) ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (selectedPaymentMethod == id) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f) else MaterialTheme.colorScheme.surface
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { selectedPaymentMethod = id }
                        .border(
                            width = if (selectedPaymentMethod == id) 1.5.dp else 1.dp,
                            color = if (selectedPaymentMethod == id) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                            shape = RoundedCornerShape(12.dp)
                        )
                ) {
                    Row(
                        modifier = Modifier
                            .padding(14.dp)
                            .fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        RadioButton(
                            selected = selectedPaymentMethod == id,
                            onClick = { selectedPaymentMethod = id }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action Buttons
            // 1. CONTINUE BUTTON (Bypasses payment system & immediately fixes appointment into DB and live queue)
            Button(
                onClick = { confirmAndProceed() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                enabled = !isProcessing
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                } else {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null)
                        Text(
                            text = "Confirm & Get 10-Digit Code",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                }
            }

            // 2. Gateway Payment Option
            OutlinedButton(
                onClick = { confirmAndProceed() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(14.dp),
                enabled = !isExpired && !isProcessing
            ) {
                Text("Simulate Gateway Payment (${selectedPaymentMethod.uppercase()})", fontSize = 13.sp)
            }

            // 3. Cancel Option
            TextButton(
                onClick = {
                    coroutineScope.launch {
                        slotRepository?.releaseSlotLock(appointmentId)
                    }
                    navController.popBackStack()
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Cancel & Release Slot", color = MaterialTheme.colorScheme.error)
            }
        }

        // Expired Alert Dialog
        if (isExpired) {
            AlertDialog(
                onDismissRequest = { navController.popBackStack() },
                icon = { Icon(Icons.Default.HourglassDisabled, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(36.dp)) },
                title = { Text("Slot Reservation Expired", fontWeight = FontWeight.Bold) },
                text = {
                    Text("The 5-minute reservation window has ended. To give equal opportunity to all patients, this slot has been released back to the general pool.", fontSize = 13.sp)
                },
                confirmButton = {
                    Button(onClick = { navController.popBackStack() }) {
                        Text("Select Another Slot")
                    }
                }
            )
        }
    }
}
