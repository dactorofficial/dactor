package com.dactor.patient.ui.booking

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.model.Appointment
import com.dactor.patient.data.model.Clinic
import com.dactor.patient.data.model.GatewayCredentialItem
import com.dactor.patient.data.model.PatientTransactionRecord
import com.dactor.patient.data.model.PaymentGatewaysConfig
import com.dactor.patient.data.repository.AppointmentRepository
import com.dactor.patient.data.repository.ClinicRepository
import com.dactor.patient.data.repository.SlotRepository
import com.dactor.patient.domain.util.CurrencyFormatter
import com.dactor.patient.ui.navigation.NavRoutes
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentScreen(
    navController: NavController,
    appointmentId: String = "",
    feeAmount: Double = 500.0,
    slotRepository: SlotRepository? = null,
    appointmentRepository: AppointmentRepository? = null,
    clinicRepository: ClinicRepository? = null,
    sessionManager: UserSessionManager? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var appointment by remember { mutableStateOf<Appointment?>(null) }
    var clinic by remember { mutableStateOf<Clinic?>(null) }
    var clinicGatewaysConfig by remember { mutableStateOf(PaymentGatewaysConfig()) }
    var effectiveFee by remember { mutableDoubleStateOf(feeAmount) }

    // Persistent 5-Minute (300 seconds) Timer Setup
    var activeSession by remember { mutableStateOf(sessionManager?.getActivePaymentSession()) }
    val initialExpiresAt = remember {
        activeSession?.expiresAtEpochMs ?: (System.currentTimeMillis() + 300_000L)
    }

    var timeLeftSeconds by remember {
        val rem = ((initialExpiresAt - System.currentTimeMillis()) / 1000L).toInt()
        mutableIntStateOf(if (rem > 0) rem else 0)
    }
    var isExpired by remember { mutableStateOf(false) }

    var selectedPaymentMethod by remember { mutableStateOf("esewa") }
    var transactionReferenceInput by remember { mutableStateOf("") }
    var isProcessing by remember { mutableStateOf(false) }
    var isCancelling by remember { mutableStateOf(false) }
    var showCancelConfirmDialog by remember { mutableStateOf(false) }

    // Load Appointment and Clinic Real Payment Credentials
    LaunchedEffect(appointmentId) {
        if (appointmentId.isNotBlank() && appointmentRepository != null) {
            val appt = appointmentRepository.getAppointmentById(appointmentId)
            if (appt != null) {
                appointment = appt
                if (appt.feeAmount > 0.0) {
                    effectiveFee = appt.feeAmount
                }
                if (clinicRepository != null) {
                    val c = clinicRepository.getClinicById(appt.clinicId)
                    if (c != null) {
                        clinic = c
                        val gwConfig = c.getPaymentGatewaysConfig()
                        clinicGatewaysConfig = gwConfig
                        selectedPaymentMethod = gwConfig.primaryGateway.ifBlank { "esewa" }
                    }
                }
            }
        }
    }

    // 5-Minute Timer Loop - Retained across app backgrounding / restart
    LaunchedEffect(initialExpiresAt) {
        while (true) {
            val rem = ((initialExpiresAt - System.currentTimeMillis()) / 1000L).toInt()
            if (rem <= 0) {
                timeLeftSeconds = 0
                isExpired = true
                break
            } else {
                timeLeftSeconds = rem
            }
            delay(1000L)
        }
    }

    // Double-Click Guarded: Cancellation & Fail Logic
    fun handleCancelOrExpireTransaction(reason: String) {
        if (isCancelling || isProcessing) return
        isCancelling = true
        coroutineScope.launch {
            try {
                if (appointmentId.isNotBlank() && appointmentRepository != null) {
                    val appt = appointment ?: appointmentRepository.getAppointmentById(appointmentId)
                    appointmentRepository.failOrCancelPaymentTransaction(
                        appointmentId = appointmentId,
                        reason = reason,
                        transactionId = transactionReferenceInput.ifBlank { "TXN-CANCELLED-${System.currentTimeMillis()}" },
                        paymentGateway = selectedPaymentMethod
                    )
                    slotRepository?.releaseSlotLock(appointmentId)
                    if (appt != null) {
                        sessionManager?.saveLocalTransactionRecord(
                            PatientTransactionRecord(
                                id = "TXN-FAIL-${System.currentTimeMillis()}",
                                appointmentId = appointmentId,
                                trackingCode = appt.trackingCode10Digit,
                                clinicName = clinic?.name ?: "Medical Clinic",
                                doctorName = "Consulting Specialist",
                                patientName = appt.patientName,
                                appointmentDate = appt.appointmentDate,
                                appointmentTime = appt.appointmentTime,
                                amount = effectiveFee,
                                paymentStatus = "failed",
                                paymentMethod = selectedPaymentMethod,
                                transactionId = "CANCELLED",
                                createdAt = Instant.now().toString()
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                sessionManager?.clearActivePaymentSession()
                sessionManager?.setShowTransactionFailedBanner(true)
                isCancelling = false
                showCancelConfirmDialog = false
                // Return to Slot Booking screen
                val targetClinicId = clinic?.id ?: appointment?.clinicId ?: ""
                val targetDocId = appointment?.doctorId
                navController.navigate(NavRoutes.Booking.createRoute(targetClinicId, targetDocId)) {
                    popUpTo(NavRoutes.Booking.route) { inclusive = true }
                }
            }
        }
    }

    // Trigger auto-cancel when the 5-minute timer expires
    LaunchedEffect(isExpired) {
        if (isExpired && !isProcessing && !isCancelling) {
            handleCancelOrExpireTransaction("5-Minute reservation window expired")
        }
    }

    // Double-Click Guarded: Bypass Payment for Testing
    fun handleBypassPayment() {
        if (isProcessing || isCancelling) return
        isProcessing = true
        coroutineScope.launch {
            try {
                val bypassTxId = "TEST-BYPASS-${System.currentTimeMillis()}"
                val ok = appointmentRepository?.confirmPaymentAndJoinQueue(
                    appointmentId = appointmentId,
                    transactionId = bypassTxId,
                    paymentGateway = "${selectedPaymentMethod}_bypass",
                    paidAmount = effectiveFee
                ) ?: false

                if (ok) {
                    val appt = appointment ?: appointmentRepository?.getAppointmentById(appointmentId)
                    if (appt != null) {
                        sessionManager?.saveTrackingCode(appt.trackingCode10Digit, "${appt.patientName} • ${appt.appointmentDate}")
                        sessionManager?.saveLocalTransactionRecord(
                            PatientTransactionRecord(
                                id = bypassTxId,
                                appointmentId = appointmentId,
                                trackingCode = appt.trackingCode10Digit,
                                clinicName = clinic?.name ?: "Medical Clinic",
                                doctorName = "Consulting Specialist",
                                patientName = appt.patientName,
                                appointmentDate = appt.appointmentDate,
                                appointmentTime = appt.appointmentTime,
                                amount = effectiveFee,
                                paymentStatus = "paid",
                                paymentMethod = "Bypass Test",
                                transactionId = bypassTxId,
                                createdAt = Instant.now().toString()
                            )
                        )
                    }
                    sessionManager?.clearActivePaymentSession()
                    Toast.makeText(context, "Payment Bypassed (Testing)! Appointment Confirmed.", Toast.LENGTH_LONG).show()
                    navController.navigate(NavRoutes.AppointmentConfirmed.createRoute(appointmentId)) {
                        popUpTo(NavRoutes.PatientMain.route) { inclusive = false }
                    }
                } else {
                    Toast.makeText(context, "Failed to confirm appointment bypass. Please try again.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isProcessing = false
            }
        }
    }

    // Double-Click Guarded: Real Payment Submission
    fun handleCompletePayment() {
        if (isProcessing || isCancelling) return
        if (transactionReferenceInput.isBlank()) {
            Toast.makeText(context, "Please enter your payment Transaction ID / Reference Code", Toast.LENGTH_SHORT).show()
            return
        }
        isProcessing = true
        coroutineScope.launch {
            try {
                val cleanTxId = transactionReferenceInput.trim()
                val ok = appointmentRepository?.confirmPaymentAndJoinQueue(
                    appointmentId = appointmentId,
                    transactionId = cleanTxId,
                    paymentGateway = selectedPaymentMethod,
                    paidAmount = effectiveFee
                ) ?: false

                if (ok) {
                    val appt = appointment ?: appointmentRepository?.getAppointmentById(appointmentId)
                    if (appt != null) {
                        sessionManager?.saveTrackingCode(appt.trackingCode10Digit, "${appt.patientName} • ${appt.appointmentDate}")
                        sessionManager?.saveLocalTransactionRecord(
                            PatientTransactionRecord(
                                id = cleanTxId,
                                appointmentId = appointmentId,
                                trackingCode = appt.trackingCode10Digit,
                                clinicName = clinic?.name ?: "Medical Clinic",
                                doctorName = "Consulting Specialist",
                                patientName = appt.patientName,
                                appointmentDate = appt.appointmentDate,
                                appointmentTime = appt.appointmentTime,
                                amount = effectiveFee,
                                paymentStatus = "paid",
                                paymentMethod = selectedPaymentMethod.uppercase(),
                                transactionId = cleanTxId,
                                createdAt = Instant.now().toString()
                            )
                        )
                    }
                    sessionManager?.clearActivePaymentSession()
                    Toast.makeText(context, "Payment Confirmed! Your appointment is reserved.", Toast.LENGTH_LONG).show()
                    navController.navigate(NavRoutes.AppointmentConfirmed.createRoute(appointmentId)) {
                        popUpTo(NavRoutes.PatientMain.route) { inclusive = false }
                    }
                } else {
                    Toast.makeText(context, "Failed to confirm payment. Please check your transaction ID.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isProcessing = false
            }
        }
    }

    // LOCK: Prevent quitting inside the app while timer is active
    BackHandler(enabled = !isExpired && !isProcessing && !isCancelling) {
        showCancelConfirmDialog = true
    }

    val minutes = timeLeftSeconds / 60
    val seconds = timeLeftSeconds % 60
    val formattedTime = "%02d:%02d".format(minutes, seconds)

    // Current selected gateway credential details from clinic
    val activeGatewayCreds = clinicGatewaysConfig.getGateway(selectedPaymentMethod)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Appointment Payment", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(
                        onClick = { showCancelConfirmDialog = true },
                        enabled = !isProcessing && !isCancelling
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    TextButton(
                        onClick = { showCancelConfirmDialog = true },
                        enabled = !isProcessing && !isCancelling
                    ) {
                        Text("Cancel", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
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
            // ── 1. 5-MINUTE PERSISTENT COUNTDOWN BANNER CARD ──────────────────────
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
                        fontSize = 38.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                        letterSpacing = 2.sp
                    )

                    LinearProgressIndicator(
                        progress = { (timeLeftSeconds / 300f).coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp),
                        color = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                        trackColor = Color.White.copy(alpha = 0.5f)
                    )

                    Text(
                        text = "Double-click protection active. Timer is retained even if you minimize the app.",
                        fontSize = 11.sp,
                        color = if (timeLeftSeconds < 60) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            // ── 2. PAYMENT SUMMARY CARD ──────────────────────────────────────────
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Payment Summary", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    if (clinic != null) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Clinic", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(clinic?.name ?: "", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    if (appointment != null) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Appointment Date", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("${appointment?.appointmentDate} (${appointment?.appointmentTime})", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Consultation Fee", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(CurrencyFormatter.formatNPR(effectiveFee), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Queue Reservation Fee", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("FREE", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF059669))
                    }
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total Amount Due", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(
                            CurrencyFormatter.formatNPR(effectiveFee),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 17.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // ── 3. REAL PAYMENT GATEWAYS SELECTION (Loaded from Clinic Supabase APIs) ──
            Text("Select Payment Gateway", fontWeight = FontWeight.Bold, fontSize = 14.sp)

            val gateways = listOf(
                Pair("esewa", "eSewa Mobile Wallet"),
                Pair("khalti", "Khalti Digital Wallet"),
                Pair("fonepay", "FonePay Dynamic QR"),
                Pair("connectips", "ConnectIPS / Direct Bank")
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                gateways.take(2).forEach { (id, label) ->
                    FilterChip(
                        selected = selectedPaymentMethod == id,
                        onClick = { selectedPaymentMethod = id },
                        label = { Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                gateways.drop(2).forEach { (id, label) ->
                    FilterChip(
                        selected = selectedPaymentMethod == id,
                        onClick = { selectedPaymentMethod = id },
                        label = { Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // ── 4. REAL GATEWAY INTERFACE DETAILS CARD ────────────────────────────
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${selectedPaymentMethod.uppercase()} Payment Details",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = if (activeGatewayCreds.environment.lowercase() == "live") Color(0xFFD1FAE5) else Color(0xFFFEF3C7)
                        ) {
                            Text(
                                text = if (activeGatewayCreds.environment.lowercase() == "live") "LIVE GATEWAY" else "TEST SANDBOX",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (activeGatewayCreds.environment.lowercase() == "live") Color(0xFF047857) else Color(0xFFB45309),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    if (activeGatewayCreds.merchantId.isNotBlank()) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Merchant ID / Code:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(activeGatewayCreds.merchantId, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                    }

                    if (activeGatewayCreds.accountNumber.isNotBlank()) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Clinic Account / Wallet:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(activeGatewayCreds.accountNumber, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        }
                    }

                    Text(
                        text = "Transfer ${CurrencyFormatter.formatNPR(effectiveFee)} to the clinic's ${selectedPaymentMethod.uppercase()} account and enter your transaction reference ID below.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 15.sp
                    )

                    OutlinedTextField(
                        value = transactionReferenceInput,
                        onValueChange = { transactionReferenceInput = it },
                        label = { Text("Transaction Reference / ID") },
                        placeholder = { Text("e.g. TXN987654321") },
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Default.Receipt, contentDescription = null) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            }

            // ── 5. TESTING BYPASS BUTTON (Requested by user) ──────────────────────
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFFFFFBEB),
                border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.Bolt, contentDescription = null, tint = Color(0xFFD97706), modifier = Modifier.size(18.dp))
                        Text(
                            "Developer Testing Mode",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = Color(0xFF92400E)
                        )
                    }
                    Text(
                        "Bypass the payment gateway for instant testing. Will immediately confirm the payment, create the appointment in Supabase, and join the live queue.",
                        fontSize = 11.sp,
                        color = Color(0xFF78350F),
                        lineHeight = 15.sp
                    )
                    Button(
                        onClick = { handleBypassPayment() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                        enabled = !isProcessing && !isCancelling
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                        }
                        Icon(Icons.Default.CheckCircleOutline, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Bypass Payment for Testing", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // ── 6. COMPLETE PAYMENT BUTTON (Anti-Double-Click Guarded) ──────────────
            Button(
                onClick = { handleCompletePayment() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                enabled = !isProcessing && !isCancelling && !isExpired
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Icon(Icons.Default.Payment, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Confirm & Complete Payment",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }

            // ── 7. CANCEL TRANSACTION BUTTON ──────────────────────────────────────
            OutlinedButton(
                onClick = { showCancelConfirmDialog = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
                enabled = !isProcessing && !isCancelling
            ) {
                if (isCancelling) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(if (isCancelling) "Cancelling Transaction..." else "Cancel Transaction", fontWeight = FontWeight.SemiBold)
            }
        }

        // CONFIRM CANCEL TRANSACTION DIALOG
        if (showCancelConfirmDialog) {
            AlertDialog(
                onDismissRequest = { if (!isCancelling) showCancelConfirmDialog = false },
                icon = { Icon(Icons.Default.WarningAmber, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(36.dp)) },
                title = { Text("Cancel This Transaction?", fontWeight = FontWeight.Bold) },
                text = {
                    Text("Cancelling will stop this transaction and release your reserved slot. You will be redirected back to slot selection.", fontSize = 13.sp)
                },
                confirmButton = {
                    Button(
                        onClick = { handleCancelOrExpireTransaction("Patient clicked Cancel") },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        enabled = !isCancelling
                    ) {
                        Text("Yes, Cancel Transaction")
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { showCancelConfirmDialog = false },
                        enabled = !isCancelling
                    ) {
                        Text("Continue Payment")
                    }
                }
            )
        }
    }
}
