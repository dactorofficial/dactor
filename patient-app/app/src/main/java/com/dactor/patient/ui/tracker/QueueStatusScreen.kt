package com.dactor.patient.ui.tracker

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.model.Appointment
import com.dactor.patient.data.model.BillingInvoice
import com.dactor.patient.data.model.LabReport
import com.dactor.patient.data.repository.AppointmentRepository
import com.dactor.patient.data.repository.ClinicRepository
import com.dactor.patient.data.repository.DoctorRepository
import com.dactor.patient.data.repository.LabReportRepository
import com.dactor.patient.data.repository.QueueRepository
import com.dactor.patient.data.repository.SlotRepository
import com.dactor.patient.domain.util.CurrencyFormatter
import com.dactor.patient.domain.util.DateTimePickers
import com.dactor.patient.domain.util.PrivacyMasker
import com.dactor.patient.ui.navigation.NavRoutes
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueStatusScreen(
    navController: NavController,
    appointmentIdOrCode: String = "",
    appointmentRepository: AppointmentRepository? = null,
    queueRepository: QueueRepository? = null,
    clinicRepository: ClinicRepository? = null,
    doctorRepository: DoctorRepository? = null,
    slotRepository: SlotRepository? = null,
    labReportRepository: LabReportRepository? = null,
    sessionManager: UserSessionManager? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var appointment by remember { mutableStateOf<Appointment?>(null) }
    var clinicName by remember { mutableStateOf("Clinic OPD Center") }
    var clinicAddress by remember { mutableStateOf("Nepal") }
    var clinicType by remember { mutableStateOf("single_visit") }
    var doctorName by remember { mutableStateOf("Attending Physician") }
    var doctorSpecialty by remember { mutableStateOf("General / Specialist OPD") }
    var isDoctorInClinic by remember { mutableStateOf(true) }

    var tokenNumber by remember { mutableIntStateOf(1) }
    var patientsAhead by remember { mutableIntStateOf(0) }
    var queueStatus by remember { mutableStateOf("waiting") } // "waiting", "inside", "done"
    var insideAt by remember { mutableStateOf<String?>(null) }
    var currentEpochSecond by remember { mutableLongStateOf(System.currentTimeMillis() / 1000) }

    // Patient info loaded dynamically
    var rawPatientName by remember { mutableStateOf("") }
    var rawPhone by remember { mutableStateOf("") }
    var rawEmail by remember { mutableStateOf("") }
    var displayTrackingCode by remember { mutableStateOf(appointmentIdOrCode) }

    var isNotFound by remember { mutableStateOf(false) }
    var isSavedToProfile by remember { mutableStateOf(false) }

    // Security & Identity Verification Locking (Name or Mobile Number)
    var isUnlocked by remember { mutableStateOf(false) }
    var verifyMethod by remember { mutableStateOf("name") } // "name" or "phone"
    var verificationInput by remember { mutableStateOf("") }
    var failedAttempts by remember { mutableIntStateOf(0) } // Max 6 attempts
    var cooldownSeconds by remember { mutableIntStateOf(0) } // 5 seconds between unsuccessful attempts
    val isLockedOut = failedAttempts >= 6
    var unlockError by remember { mutableStateOf<String?>(null) }
    var isProcessing by remember { mutableStateOf(false) } // Global processing lock for buttons

    // 5-second countdown timer after unsuccessful verification
    LaunchedEffect(cooldownSeconds) {
        if (cooldownSeconds > 0) {
            delay(1000L)
            cooldownSeconds--
        }
    }

    // Unlocked data states
    var billingInvoice by remember { mutableStateOf<BillingInvoice?>(null) }
    var clinicalRemarks by remember { mutableStateOf<String?>(null) }
    var labReports by remember { mutableStateOf<List<LabReport>>(emptyList()) }

    // Reschedule appointment states
    val today = remember { LocalDate.now().toString() }
    var rescheduleDate by remember { mutableStateOf(today) }
    var rescheduleTime by remember { mutableStateOf("10:00") }
    var rescheduleMessage by remember { mutableStateOf<String?>(null) }

    // Multi-visit Follow-up states
    val tomorrow = remember { LocalDate.now().plusDays(1).toString() }
    var followUpDate by remember { mutableStateOf(tomorrow) }
    var followUpTime by remember { mutableStateOf("10:00") }
    var followUpMessage by remember { mutableStateOf<String?>(null) }
    var newFollowUpCode by remember { mutableStateOf<String?>(null) }

    val scrollState = rememberScrollState()

    // Live 1-second ticking timer for real-time consultation duration
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(1000L)
            currentEpochSecond = System.currentTimeMillis() / 1000
        }
    }

    suspend fun loadConfidentialDetails(targetAppt: Appointment) {
        try {
            val inv = appointmentRepository?.getInvoiceForAppointment(targetAppt.id)
            billingInvoice = inv
            clinicalRemarks = inv?.remarks?.ifBlank { null } ?: appointmentRepository?.getRemarksForAppointment(targetAppt.id)
            val reports = labReportRepository?.getLabReportsForAppointment(targetAppt.id) ?: emptyList()
            labReports = reports
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun refreshData() {
        val queryCode = appointmentIdOrCode.trim()
        if (queryCode.isBlank()) return

        try {
            // 1. Fetch real appointment from Supabase
            val appt = appointmentRepository?.getAppointmentByTrackingCode(queryCode)
                ?: appointmentRepository?.getAppointmentById(queryCode)

            if (appt != null) {
                appointment = appt
                rawPatientName = appt.patientName
                rawPhone = appt.patientMobile
                rawEmail = appt.patientEmail ?: ""
                displayTrackingCode = appt.trackingCode10Digit
                rescheduleDate = appt.appointmentDate
                rescheduleTime = appt.appointmentTime
                isNotFound = false

                // If already unlocked, update confidential data
                if (isUnlocked) {
                    loadConfidentialDetails(appt)
                }

                // 2. Fetch clinic info
                if (appt.clinicId.isNotBlank()) {
                    val clinic = clinicRepository?.getClinicById(appt.clinicId)
                    if (clinic != null) {
                        clinicName = clinic.name
                        clinicAddress = clinic.addressText ?: "Nepal"
                        clinicType = clinic.type ?: "multi_visit"
                    }
                }

                // 3. Fetch doctor info & physical presence
                if (!appt.doctorId.isNullOrBlank()) {
                    val doctor = doctorRepository?.getDoctorById(appt.doctorId)
                    if (doctor != null) {
                        doctorName = doctor.fullName
                        doctorSpecialty = doctor.specialty ?: "General / Specialist OPD"
                        isDoctorInClinic = doctor.isInClinic ?: true
                    }
                }

                // 4. Fetch queue token and live status
                val qEntry = queueRepository?.getQueueStatus(appt.id)
                if (qEntry != null) {
                    tokenNumber = qEntry.queuePosition
                    queueStatus = qEntry.status
                    insideAt = qEntry.insideAt
                }

                // 5. Count patients ahead in waiting lobby
                if (appt.clinicId.isNotBlank()) {
                    val clinicEntries = queueRepository?.getQueueEntriesForClinic(appt.clinicId) ?: emptyList()
                    val myPos = qEntry?.queuePosition ?: tokenNumber
                    patientsAhead = clinicEntries.count { it.status == "waiting" && it.queuePosition < myPos }
                }
            } else {
                // Check if code was saved in local session for offline/guest booking
                val savedCodes = sessionManager?.getSavedTrackingCodes() ?: emptyList()
                val match = savedCodes.firstOrNull { it.first == queryCode }
                if (match != null) {
                    displayTrackingCode = queryCode
                    rawPatientName = sessionManager?.getSavedName() ?: "Patient"
                    rawPhone = sessionManager?.getSavedPhone() ?: ""
                    rawEmail = sessionManager?.getSavedEmail() ?: ""
                    isNotFound = false
                } else if (rawPatientName.isBlank()) {
                    isNotFound = true
                }
            }

            // Check if saved to profile
            isSavedToProfile = sessionManager?.getSavedTrackingCodes()?.any { it.first == displayTrackingCode } ?: false
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Dynamic real-time auto-refresh loop
    LaunchedEffect(appointmentIdOrCode) {
        while (isActive) {
            refreshData()
            delay(4000L) // auto-refresh queue position and doctor status every 4 seconds
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Live Queue Position", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(
                        onClick = { navController.popBackStack() },
                        enabled = !isProcessing
                    ) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            coroutineScope.launch {
                                isProcessing = true
                                refreshData()
                                delay(300)
                                isProcessing = false
                            }
                        },
                        enabled = !isProcessing
                    ) {
                        if (isProcessing) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                        }
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
            if (isProcessing) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            if (isNotFound) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(Icons.Default.SearchOff, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(48.dp))
                        Text("No Appointment Found", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.error)
                        Text(
                            "No active booking found for tracking code: $appointmentIdOrCode.\nPlease verify the 10-digit number and try again.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Button(
                            onClick = { navController.popBackStack() },
                            enabled = !isProcessing
                        ) {
                            Text("Re-enter Tracking Code")
                        }
                    }
                }
            } else {
                // ==========================================
                // 1. PUBLIC VISIBLE COMPONENTS (ANYONE CAN VIEW)
                // - Queue Status, Estimated Time, Turn Position, Token #
                // ==========================================
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = when (queueStatus) {
                            "inside" -> MaterialTheme.colorScheme.primaryContainer
                            "done" -> Color(0xFFECFDF5)
                            else -> MaterialTheme.colorScheme.surface
                        }
                    ),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            "10-DIGIT CODE: $displayTrackingCode",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MaterialTheme.colorScheme.primary
                        )

                        Surface(
                            shape = CircleShape,
                            color = when (queueStatus) {
                                "inside" -> MaterialTheme.colorScheme.primary
                                "done" -> Color(0xFF059669)
                                else -> Color(0xFF3B82F6)
                            },
                            modifier = Modifier.size(90.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("TOKEN", fontSize = 10.sp, color = Color.White.copy(alpha = 0.8f), fontWeight = FontWeight.Bold)
                                    Text("#$tokenNumber", color = Color.White, fontWeight = FontWeight.Black, fontSize = 28.sp)
                                }
                            }
                        }

                        Text(
                            text = when (queueStatus) {
                                "inside" -> "IT IS YOUR TURN! PROCEED INSIDE"
                                "done" -> "CONSULTATION COMPLETED"
                                else -> if (patientsAhead == 0) "You are next in line!" else "$patientsAhead patients ahead of you"
                            },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = when (queueStatus) {
                                "inside" -> MaterialTheme.colorScheme.primary
                                "done" -> Color(0xFF059669)
                                else -> if (patientsAhead == 0) Color(0xFFD97706) else MaterialTheme.colorScheme.onSurface
                            }
                        )

                        if (queueStatus == "inside") {
                            val elapsedSec = if (!insideAt.isNullOrBlank()) {
                                try {
                                    (currentEpochSecond - java.time.Instant.parse(insideAt).epochSecond).coerceAtLeast(0)
                                } catch (e: Exception) { 0L }
                            } else 0L
                            val mins = elapsedSec / 60
                            val secs = elapsedSec % 60
                            val formatted = String.format(java.util.Locale.US, "%02d:%02d", mins, secs)
                            Surface(
                                color = Color(0xFFDCFCE7),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Box(modifier = Modifier.size(8.dp).background(Color(0xFF16A34A), CircleShape))
                                    Text("Active Consultation Session: $formatted min", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF166534))
                                }
                            }
                        } else if (queueStatus == "waiting") {
                            val waitMins = (patientsAhead * 15).coerceAtLeast(0)
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (!appointment?.appointmentTime.isNullOrBlank()) {
                                    Text(
                                        text = "Your Slot Window: ${appointment?.appointmentTime}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                                Text(
                                    text = if (patientsAhead == 0) "Expected Call: Imminent (Next patient entering)" else "Expected Wait: ~$waitMins minutes (15m interval per patient)",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                // DOCTOR PHYSICAL PRESENCE INDICATOR
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDoctorInClinic) Color(0xFFECFDF5) else Color(0xFFFEF2F2)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(14.dp)
                                .background(
                                    if (isDoctorInClinic) Color(0xFF10B981) else Color(0xFFEF4444),
                                    CircleShape
                                )
                        )
                        Column {
                            Text(
                                text = if (isDoctorInClinic) "Doctor is Physically Inside Clinic" else "Doctor Has Not Arrived Yet / Away",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = if (isDoctorInClinic) Color(0xFF065F46) else Color(0xFF991B1B)
                            )
                            Text(
                                text = "$doctorName • $doctorSpecialty",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = if (isDoctorInClinic) "Currently attending to patients in OPD room." else "Clinic receptionist has marked physician away.",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Clinic Location Card
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.LocalHospital, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                            Text(clinicName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                            Text(clinicAddress, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                // ==========================================
                // 2. LOCKED SECTION: CONFIDENTIAL RECORDS & SERVICES
                // Password = Patient's Registered Name OR Mobile Number
                // Trial limit: Max 6 times, 5s cooldown between unsuccessful attempts
                // ==========================================
                if (!isUnlocked) {
                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Surface(
                                        shape = CircleShape,
                                        color = if (isLockedOut) MaterialTheme.colorScheme.error.copy(alpha = 0.15f) else MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                                        modifier = Modifier.size(40.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = if (isLockedOut) Icons.Default.LockClock else Icons.Default.Lock,
                                                contentDescription = "Locked",
                                                tint = if (isLockedOut) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                    Column {
                                        Text(
                                            text = if (isLockedOut) "Verification Locked Out" else "Confidential Details Locked",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = if (isLockedOut) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                                        )
                                        Text(
                                            text = if (isLockedOut) "6/6 Attempts Exhausted" else "Verify via Patient Name or Mobile",
                                            fontSize = 11.sp,
                                            color = if (isLockedOut) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }

                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = when {
                                        isLockedOut -> MaterialTheme.colorScheme.errorContainer
                                        failedAttempts >= 4 -> Color(0xFFFEF3C7)
                                        else -> MaterialTheme.colorScheme.surfaceVariant
                                    }
                                ) {
                                    Text(
                                        text = "${6 - failedAttempts}/6 attempts",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = when {
                                            isLockedOut -> MaterialTheme.colorScheme.onErrorContainer
                                            failedAttempts >= 4 -> Color(0xFF92400E)
                                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                                        }
                                    )
                                }
                            }

                            Text(
                                "To access confidential records (clinical diagnosis, remarks, billing invoice, lab reports, rescheduling, follow-up booking, and credentials), verify the patient's identity. No account login required.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            // Verification Method Toggle (Name vs Number)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = verifyMethod == "name",
                                    onClick = {
                                        if (!isLockedOut && cooldownSeconds == 0) {
                                            verifyMethod = "name"
                                            verificationInput = ""
                                            unlockError = null
                                        }
                                    },
                                    enabled = !isLockedOut && cooldownSeconds == 0,
                                    leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(16.dp)) },
                                    label = { Text("Verify via Name", fontSize = 12.sp) }
                                )

                                FilterChip(
                                    selected = verifyMethod == "phone",
                                    onClick = {
                                        if (!isLockedOut && cooldownSeconds == 0) {
                                            verifyMethod = "phone"
                                            verificationInput = ""
                                            unlockError = null
                                        }
                                    },
                                    enabled = !isLockedOut && cooldownSeconds == 0,
                                    leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(16.dp)) },
                                    label = { Text("Verify via Number", fontSize = 12.sp) }
                                )
                            }

                            // Dynamic Input Field
                            OutlinedTextField(
                                value = verificationInput,
                                onValueChange = {
                                    verificationInput = it
                                    unlockError = null
                                },
                                label = {
                                    Text(if (verifyMethod == "name") "Patient's Full Name (Password)" else "Registered Mobile Number")
                                },
                                placeholder = {
                                    Text(if (verifyMethod == "name") "e.g. Ram Bahadur Thapa" else "e.g. 9841234567 or +977...")
                                },
                                leadingIcon = {
                                    Icon(
                                        imageVector = if (verifyMethod == "name") Icons.Default.Badge else Icons.Default.PhoneIphone,
                                        contentDescription = null
                                    )
                                },
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = if (verifyMethod == "name") KeyboardType.Text else KeyboardType.Phone
                                ),
                                singleLine = true,
                                enabled = !isProcessing && cooldownSeconds == 0 && !isLockedOut,
                                isError = unlockError != null,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // Cooldown Timer Banner (5 seconds countdown after failed trial)
                            AnimatedVisibility(visible = cooldownSeconds > 0) {
                                Surface(
                                    color = Color(0xFFFEF3C7),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        CircularProgressIndicator(
                                            progress = { cooldownSeconds / 5f },
                                            modifier = Modifier.size(18.dp),
                                            strokeWidth = 2.dp,
                                            color = Color(0xFFB45309)
                                        )
                                        Text(
                                            text = "Verification cooldown active: Please wait $cooldownSeconds seconds before retrying.",
                                            fontSize = 12.sp,
                                            color = Color(0xFF92400E),
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }
                            }

                            // Lockout Notice
                            if (isLockedOut) {
                                Surface(
                                    color = MaterialTheme.colorScheme.errorContainer,
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(Icons.Default.Block, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                                        Text(
                                            text = "Maximum 6 trial attempts exceeded. Confidential medical details have been locked. Please contact the clinic reception.",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onErrorContainer,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }
                            }

                            // Error text
                            if (unlockError != null && !isLockedOut) {
                                Text(
                                    text = unlockError ?: "",
                                    color = MaterialTheme.colorScheme.error,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }

                            // Verification Button
                            Button(
                                onClick = {
                                    if (verificationInput.isBlank()) {
                                        unlockError = if (verifyMethod == "name") "Please enter the patient's name." else "Please enter the registered mobile number."
                                        return@Button
                                    }
                                    if (cooldownSeconds > 0 || isLockedOut) return@Button

                                    coroutineScope.launch {
                                        isProcessing = true
                                        unlockError = null
                                        delay(350L) // UI feedback

                                        val isMatch = if (verifyMethod == "name") {
                                            val entered = verificationInput.trim().lowercase().replace(Regex("\\s+"), " ")
                                            val expected = rawPatientName.trim().lowercase().replace(Regex("\\s+"), " ")
                                            entered.isNotBlank() && expected.isNotBlank() && (
                                                entered == expected ||
                                                (expected.length >= 3 && expected.contains(entered)) ||
                                                (entered.length >= 3 && entered.contains(expected))
                                            )
                                        } else {
                                            val cleanEntered = verificationInput.filter { it.isDigit() }
                                            val cleanExpected = rawPhone.filter { it.isDigit() }
                                            cleanEntered.isNotBlank() && cleanExpected.isNotBlank() && (
                                                cleanEntered.takeLast(10) == cleanExpected.takeLast(10) ||
                                                cleanEntered == cleanExpected
                                            )
                                        }

                                        if (isMatch) {
                                            isUnlocked = true
                                            unlockError = null
                                            appointment?.let { loadConfidentialDetails(it) }
                                        } else {
                                            failedAttempts++
                                            cooldownSeconds = 5
                                            if (failedAttempts >= 6) {
                                                unlockError = "Maximum 6 verification attempts reached. For security, confidential access has been locked."
                                            } else {
                                                val remaining = 6 - failedAttempts
                                                val methodLabel = if (verifyMethod == "name") "name" else "mobile number"
                                                unlockError = "Incorrect patient $methodLabel ($remaining attempt${if (remaining == 1) "" else "s"} remaining). Wait 5 seconds to retry."
                                            }
                                        }
                                        isProcessing = false
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !isProcessing && cooldownSeconds == 0 && !isLockedOut && verificationInput.isNotBlank()
                            ) {
                                if (isProcessing) {
                                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Verifying...", fontWeight = FontWeight.Bold)
                                } else if (cooldownSeconds > 0) {
                                    Icon(Icons.Default.HourglassEmpty, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("Wait ${cooldownSeconds}s to retry", fontWeight = FontWeight.Bold)
                                } else if (isLockedOut) {
                                    Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("Attempts Exhausted (Locked)", fontWeight = FontWeight.Bold)
                                } else {
                                    Icon(Icons.Default.LockOpen, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("Unlock Confidential Details", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                } else {
                    // ==========================================
                    // 3. UNLOCKED SECTION: CONFIDENTIAL DETAILS
                    // ==========================================
                    Surface(
                        color = Color(0xFF10B981).copy(alpha = 0.12f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.VerifiedUser, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(20.dp))
                                Column {
                                    Text("Medical Records & Services Unlocked", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF065F46))
                                    Text("Verified Patient: $rawPatientName", fontSize = 11.sp, color = Color(0xFF047857))
                                }
                            }
                            TextButton(
                                onClick = { isUnlocked = false },
                                enabled = !isProcessing
                            ) {
                                Text("Lock", fontSize = 12.sp, color = Color(0xFF065F46), fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    // A. FULL UNMASKED PATIENT CREDENTIALS
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Badge, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                Text("Patient Credentials", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            HorizontalDivider()
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Full Name:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(rawPatientName.ifBlank { "Patient" }, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Age & Gender:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("${appointment?.patientAge ?: 0} yrs • ${appointment?.patientGender ?: "N/A"}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Phone Number:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(rawPhone.ifBlank { "Not provided" }, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Email Address:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(rawEmail.ifBlank { "Not provided" }, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Visit Modality:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(if (appointment?.isWalkin == true) "Walk-In Reception Desk" else "Online Pre-Booked", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            }
                        }
                    }

                    // B. CLINIC REMARKS & DOCTOR NOTES
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.MedicalInformation, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                Text("Clinic Remarks & Prescription", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            HorizontalDivider()
                            if (!clinicalRemarks.isNullOrBlank()) {
                                Surface(
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = clinicalRemarks ?: "",
                                        modifier = Modifier.padding(12.dp),
                                        fontSize = 13.sp,
                                        lineHeight = 18.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            } else {
                                Text(
                                    "No clinical remarks or prescription recorded yet by attending doctor. Please check back during or after consultation.",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }

                    // C. BILLING & PAYMENT DETAILS
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                    Text("Bill & Payment Details", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = if (billingInvoice?.balanceDue == 0.0 || appointment?.paymentStatus == "paid") Color(0xFFD1FAE5) else Color(0xFFFEE2E2)
                                ) {
                                    Text(
                                        text = if (billingInvoice?.balanceDue == 0.0 || appointment?.paymentStatus == "paid") "PAID" else "DUE",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (billingInvoice?.balanceDue == 0.0 || appointment?.paymentStatus == "paid") Color(0xFF065F46) else Color(0xFFB91C1C)
                                    )
                                }
                            }
                            HorizontalDivider()

                            val total = billingInvoice?.totalAmount ?: appointment?.feeAmount ?: 500.0
                            val paid = billingInvoice?.paidAmount ?: total
                            val due = billingInvoice?.balanceDue ?: 0.0

                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Total Consultation / Service Bill:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(CurrencyFormatter.formatNPR(total), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Amount Paid:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(CurrencyFormatter.formatNPR(paid), fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Balance Due:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(CurrencyFormatter.formatNPR(due), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (due > 0) Color(0xFFDC2626) else Color(0xFF059669))
                            }

                            if (billingInvoice != null && billingInvoice!!.items.isNotEmpty()) {
                                Text("Itemized Breakdown:", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                billingInvoice!!.items.forEach { item ->
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("• ${item.itemName} (${item.quantity}x)", fontSize = 11.sp)
                                        Text(CurrencyFormatter.formatNPR(item.total), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                    }

                    // D. DIAGNOSTIC LAB REPORTS
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Biotech, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                Text("Diagnostic Lab Reports", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            HorizontalDivider()

                            if (labReports.isNotEmpty()) {
                                labReports.forEach { report ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(report.testName, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                            Text("Stage: ${report.stage.replace('_', ' ').uppercase()}", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                                        }
                                        Button(
                                            onClick = {
                                                navController.navigate(NavRoutes.LabReport.createRoute(report.id))
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            enabled = !isProcessing
                                        ) {
                                            Text("View Report", fontSize = 11.sp)
                                        }
                                    }
                                }
                            } else {
                                Text("No diagnostic laboratory tests attached to this appointment.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }

                    // E. RESCHEDULE / CHANGE DATE
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.EditCalendar, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                Text("Change Appointment Date & Time", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            Text("Reschedule this visit to another date and time slot:", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

                            if (rescheduleMessage != null) {
                                Text(rescheduleMessage ?: "", color = Color(0xFF059669), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = rescheduleDate,
                                    onValueChange = { rescheduleDate = it },
                                    label = { Text("New Date") },
                                    trailingIcon = {
                                        IconButton(
                                            onClick = {
                                                DateTimePickers.showDatePicker(context, rescheduleDate) { picked ->
                                                    rescheduleDate = picked
                                                }
                                            },
                                            enabled = !isProcessing
                                        ) {
                                            Icon(Icons.Default.CalendarMonth, contentDescription = "Pick Date")
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = !isProcessing
                                )

                                OutlinedTextField(
                                    value = rescheduleTime,
                                    onValueChange = { rescheduleTime = it },
                                    label = { Text("Time") },
                                    trailingIcon = {
                                        IconButton(
                                            onClick = {
                                                DateTimePickers.showClockTimePicker(context, rescheduleTime) { picked ->
                                                    rescheduleTime = picked
                                                }
                                            },
                                            enabled = !isProcessing
                                        ) {
                                            Icon(Icons.Default.Schedule, contentDescription = "Pick Time")
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = !isProcessing
                                )
                            }

                            Button(
                                onClick = {
                                    val appt = appointment ?: return@Button
                                    coroutineScope.launch {
                                        isProcessing = true
                                        val ok = appointmentRepository?.rescheduleAppointment(appt.id, rescheduleDate.trim(), rescheduleTime.trim()) ?: false
                                        if (ok) {
                                            rescheduleMessage = "✓ Successfully changed appointment date to $rescheduleDate at $rescheduleTime."
                                            refreshData()
                                        } else {
                                            rescheduleMessage = "Error rescheduling appointment. Please try again."
                                        }
                                        isProcessing = false
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                enabled = !isProcessing
                            ) {
                                if (isProcessing) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Updating Schedule...")
                                } else {
                                    Text("Confirm Date Change", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    // F. MULTI-APPOINTMENT CLINIC: ENABLE APPOINTMENT ON OTHER DATE (FOLLOW-UP)
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.EventRepeat, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                Text("Multi-Appointment: Schedule Follow-up Visit", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            Text(
                                "Clinics supporting multiple appointments allow you to schedule your next visit or follow-up on another date directly using verified patient details.",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            if (followUpMessage != null) {
                                Surface(
                                    color = Color(0xFFD1FAE5),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = followUpMessage ?: "",
                                        modifier = Modifier.padding(10.dp),
                                        color = Color(0xFF065F46),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = followUpDate,
                                    onValueChange = { followUpDate = it },
                                    label = { Text("Next Visit Date") },
                                    trailingIcon = {
                                        IconButton(
                                            onClick = {
                                                DateTimePickers.showDatePicker(context, followUpDate) { picked ->
                                                    followUpDate = picked
                                                }
                                            },
                                            enabled = !isProcessing
                                        ) {
                                            Icon(Icons.Default.CalendarMonth, contentDescription = "Pick Date")
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = !isProcessing
                                )

                                OutlinedTextField(
                                    value = followUpTime,
                                    onValueChange = { followUpTime = it },
                                    label = { Text("Slot Time") },
                                    trailingIcon = {
                                        IconButton(
                                            onClick = {
                                                DateTimePickers.showClockTimePicker(context, followUpTime) { picked ->
                                                    followUpTime = picked
                                                }
                                            },
                                            enabled = !isProcessing
                                        ) {
                                            Icon(Icons.Default.Schedule, contentDescription = "Pick Time")
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp),
                                    enabled = !isProcessing
                                )
                            }

                            Button(
                                onClick = {
                                    val appt = appointment ?: return@Button
                                    coroutineScope.launch {
                                        isProcessing = true
                                        val newCode = com.dactor.patient.domain.util.TrackingCodeGenerator.generate()
                                        val followUp = Appointment(
                                            id = java.util.UUID.randomUUID().toString(),
                                            trackingCode10Digit = newCode,
                                            slotId = null,
                                            clinicId = appt.clinicId,
                                            doctorId = appt.doctorId,
                                            userId = appt.userId,
                                            patientName = appt.patientName,
                                            patientAge = appt.patientAge,
                                            patientGender = appt.patientGender,
                                            patientMobile = appt.patientMobile,
                                            patientEmail = appt.patientEmail,
                                            paymentStatus = "paid",
                                            checkinStatus = "registered",
                                            appointmentDate = followUpDate.trim(),
                                            appointmentTime = followUpTime.trim(),
                                            feeAmount = appt.feeAmount,
                                            isWalkin = false
                                        )
                                        appointmentRepository?.createAppointment(followUp)
                                        newFollowUpCode = newCode
                                        sessionManager?.saveTrackingCode(newCode, "${appt.patientName} • $followUpDate (Follow-up)")
                                        followUpMessage = "✓ Follow-up booked for $followUpDate at $followUpTime! New 10-Digit Code: $newCode"
                                        isProcessing = false
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                enabled = !isProcessing
                            ) {
                                if (isProcessing) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Booking Follow-Up...")
                                } else {
                                    Text("Enable Appointment on Other Date", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // CROSS-ACCOUNT CLAIMING / PROFILE SAVED BANNER
                if (!isSavedToProfile) {
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Save to Profile?", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text(
                                    "Add this appointment to your phone's history to track it anytime with 1 tap.",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        isProcessing = true
                                        val label = "${rawPatientName.ifBlank { "Appointment" }} • ${appointment?.appointmentDate ?: "Today"}"
                                        sessionManager?.saveTrackingCode(displayTrackingCode, label)
                                        isSavedToProfile = true
                                        isProcessing = false
                                    }
                                },
                                shape = RoundedCornerShape(10.dp),
                                enabled = !isProcessing
                            ) {
                                Text("Save", fontSize = 12.sp)
                            }
                        }
                    }
                } else {
                    Surface(
                        color = Color(0xFF10B981).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(16.dp))
                            Text("Appointment saved to your account profile history.", fontSize = 12.sp, color = Color(0xFF065F46), fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
    }
}
