package com.dactor.patient.ui.tracker

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
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
import com.dactor.patient.data.model.Clinic
import com.dactor.patient.data.model.ClinicScheduleHelper
import com.dactor.patient.data.repository.LiveQueueTimingEstimate
import com.dactor.patient.domain.util.CurrencyFormatter
import com.dactor.patient.domain.util.DateTimePickers
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
    var clinicName by remember { mutableStateOf("") }
    var clinicAddress by remember { mutableStateOf("") }
    var clinicPhone by remember { mutableStateOf("") }
    var clinicLatitude by remember { mutableDoubleStateOf(0.0) }
    var clinicLongitude by remember { mutableDoubleStateOf(0.0) }
    var clinicType by remember { mutableStateOf("single_visit") }
    var clinicObj by remember { mutableStateOf<Clinic?>(null) }
    var liveTimingEstimate by remember { mutableStateOf<LiveQueueTimingEstimate?>(null) }

    var doctorName by remember { mutableStateOf("") }
    var doctorSpecialty by remember { mutableStateOf("") }
    var doctorPhotoUrl by remember { mutableStateOf<String?>(null) }
    var isDoctorInClinic by remember { mutableStateOf(true) }

    var tokenNumber by remember { mutableIntStateOf(0) }
    var patientsAhead by remember { mutableIntStateOf(-1) } // -1 = not yet loaded
    var clinicAvgTimeMinutes by remember { mutableIntStateOf(10) }
    var queueStatus by remember { mutableStateOf("waiting") } // "waiting", "inside", "done", "sample_collected", "processing", "report_prepared"
    var insideAt by remember { mutableStateOf<String?>(null) }
    var currentEpochSecond by remember { mutableLongStateOf(System.currentTimeMillis() / 1000) }
    var isDataLoaded by remember { mutableStateOf(false) }

    // Automatic alert state: fires once when ≤2 people are ahead in live queue
    var hasTriggeredTwoAheadAlert by remember(appointmentIdOrCode) { mutableStateOf(false) }

    var rawPatientName by remember { mutableStateOf("") }
    var rawPhone by remember { mutableStateOf("") }
    var rawEmail by remember { mutableStateOf("") }
    var displayTrackingCode by remember { mutableStateOf(appointmentIdOrCode) }

    var isNotFound by remember { mutableStateOf(false) }
    var isSavedToProfile by remember { mutableStateOf(false) }

    // Security Verification Locking (Name or Mobile Number required for Reschedule & Lab Report Viewing/Downloading)
    var isUnlocked by remember { mutableStateOf(false) }
    var isReportIdentityVerified by remember { mutableStateOf(false) }
    var pendingVerificationAction by remember { mutableStateOf("reschedule") } // "reschedule", "view_report", "download_report"
    var showVerificationDialog by remember { mutableStateOf(false) }
    var showRescheduleDialog by remember { mutableStateOf(false) }
    var showPrescriptionDialog by remember { mutableStateOf(false) }
    var showLabReportDialog by remember { mutableStateOf(false) }

    var verifyMethod by remember { mutableStateOf("name") } // "name" or "phone"
    var verificationInput by remember { mutableStateOf("") }
    var failedAttempts by remember { mutableIntStateOf(0) }
    var cooldownSeconds by remember { mutableIntStateOf(0) }
    val isLockedOut = failedAttempts >= 6
    var unlockError by remember { mutableStateOf<String?>(null) }
    var isProcessing by remember { mutableStateOf(false) }

    // Reschedule states
    val today = remember { LocalDate.now().toString() }
    var rescheduleDate by remember { mutableStateOf(today) }
    var rescheduleTime by remember { mutableStateOf("10:00") }
    var rescheduleMessage by remember { mutableStateOf<String?>(null) }

    // Confidential data states
    var billingInvoice by remember { mutableStateOf<BillingInvoice?>(null) }
    var clinicalRemarks by remember { mutableStateOf<String?>(null) }
    var labReports by remember { mutableStateOf<List<LabReport>>(emptyList()) }

    // Multi-visit clinic history states
    var multiClinicAppointments by remember { mutableStateOf<List<Appointment>>(emptyList()) }
    var expandedAppointmentId by remember { mutableStateOf<String?>(null) }
    var appointmentInvoicesMap by remember { mutableStateOf<Map<String, BillingInvoice>>(emptyMap()) }

    // Other saved appointments in session
    val otherSavedCodes = remember(sessionManager) {
        sessionManager?.getSavedTrackingCodes()?.filter { it.first != displayTrackingCode } ?: emptyList()
    }

    val doctorInitials = remember(doctorName) {
        val clean = doctorName.removePrefix("Dr.").trim()
        val parts = clean.split(" ").filter { it.isNotBlank() }
        when {
            parts.size >= 2 -> "${parts[0].first().uppercaseChar()}${parts[1].first().uppercaseChar()}"
            parts.size == 1 && parts[0].isNotEmpty() -> "${parts[0].first().uppercaseChar()}"
            else -> "AJ"
        }
    }

    val formattedDate = remember(appointment?.appointmentDate) {
        try {
            val apptDate = appointment?.appointmentDate
            if (!apptDate.isNullOrBlank()) {
                val d = java.time.LocalDate.parse(apptDate)
                d.format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.ENGLISH))
            } else {
                java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.ENGLISH))
            }
        } catch (e: Exception) {
            "12 Oct 2026"
        }
    }

    val scrollState = rememberScrollState()

    // 5-second countdown timer after unsuccessful verification
    LaunchedEffect(cooldownSeconds) {
        if (cooldownSeconds > 0) {
            delay(1000L)
            cooldownSeconds--
        }
    }

    // Live 1-second ticking timer for active consultation
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
            val reports = labReportRepository?.getLabReportsForAppointment(targetAppt.id, targetAppt.trackingCode10Digit) ?: emptyList()
            labReports = reports
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun refreshData() {
        val queryCode = appointmentIdOrCode.trim()
        if (queryCode.isBlank()) return

        try {
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

                // Automatically save tracking code so this device receives alerts even when app is not open
                if (appt.trackingCode10Digit.isNotBlank()) {
                    sessionManager?.saveTrackingCode(appt.trackingCode10Digit, "${appt.patientName} • ${appt.appointmentDate}")
                }

                // Always load lab reports so live workflow stage (Processing / Prepared) is accurate
                loadConfidentialDetails(appt)

                // Auto-unlock only when signed-in account explicitly matches email or userId
                val savedEmail = sessionManager?.getSavedEmail()?.trim()?.lowercase()
                val savedPid = sessionManager?.getSavedPatientId()?.trim()
                val matchesAccount = (!savedEmail.isNullOrBlank() && appt.patientEmail?.trim()?.equals(savedEmail, ignoreCase = true) == true) ||
                        (!savedPid.isNullOrBlank() && appt.userId == savedPid)
                if (matchesAccount && !isUnlocked) {
                    isUnlocked = true
                    isReportIdentityVerified = true
                    isSavedToProfile = true
                }

                // Fetch clinic info
                if (appt.clinicId.isNotBlank()) {
                    val clinic = clinicRepository?.getClinicById(appt.clinicId, forceRefresh = true)
                    clinicObj = clinic
                    if (clinic != null) {
                        clinicName = clinic.name
                        clinicAddress = clinic.addressText ?: "Nepal"
                        clinicPhone = clinic.contactPhone ?: "01-4412345"
                        clinicLatitude = clinic.latitude ?: 27.7172
                        clinicLongitude = clinic.longitude ?: 85.3240
                        clinicType = clinic.type ?: "single_visit"
                        clinicAvgTimeMinutes = clinic.getEffectiveAvgMinutes()
                    }
                }

                // Fetch doctor info
                if (!appt.doctorId.isNullOrBlank()) {
                    val doctor = doctorRepository?.getDoctorById(appt.doctorId)
                    if (doctor != null) {
                        doctorName = doctor.fullName
                        doctorSpecialty = doctor.specialty ?: "General Physician"
                        doctorPhotoUrl = doctor.profilePictureUrl
                        isDoctorInClinic = doctor.isInClinic ?: true
                    }
                }

                // For multi-visit clinics: fetch all appointments for this patient arranged by date and time
                val currentClinicType = clinicObj?.type ?: clinicType
                if (currentClinicType.equals("multi_visit", ignoreCase = true) && appt.clinicId.isNotBlank()) {
                    try {
                        val pMobile = appt.patientMobile.ifBlank { rawPhone }
                        val pEmail = appt.patientEmail ?: rawEmail
                        val pUserId = appt.userId
                        val byMobile = if (pMobile.isNotBlank()) {
                            appointmentRepository?.getAppointmentsByClinicAndMobile(appt.clinicId, pMobile) ?: emptyList()
                        } else emptyList()
                        val allPt = appointmentRepository?.getAllPatientAppointments(pUserId, pMobile, pEmail) ?: emptyList()
                        val clinicPt = allPt.filter { it.clinicId == appt.clinicId }
                        val combined = (byMobile + clinicPt + listOf(appt)).distinctBy { it.id }
                        val sorted = combined.sortedWith(
                            compareByDescending<Appointment> { it.appointmentDate }
                                .thenByDescending { it.appointmentTime }
                        )
                        multiClinicAppointments = sorted
                        val apptIds = sorted.map { it.id }
                        val invMap = appointmentRepository?.getInvoicesForAppointments(apptIds) ?: emptyMap()
                        appointmentInvoicesMap = invMap
                    } catch (e: Exception) {
                        multiClinicAppointments = listOf(appt)
                    }
                }

                // Fetch queue token and live status (combining queue_entries, appointment checkin_status, and lab_reports)
                val qEntry = queueRepository?.getQueueStatus(appt.id)
                if (qEntry != null) {
                    tokenNumber = qEntry.queuePosition
                    insideAt = qEntry.insideAt
                }
                val rawQueueStatus = qEntry?.status?.lowercase() ?: ""
                val rawApptStatus = appt.checkinStatus.lowercase()
                val hasPreparedReport = labReports.any { it.stage.equals("prepared", ignoreCase = true) }
                val hasProcessingReport = labReports.any {
                    it.stage.equals("processing", ignoreCase = true) ||
                        it.stage.equals("in_lab", ignoreCase = true) ||
                        it.stage.equals("sample_collected", ignoreCase = true)
                }

                queueStatus = when {
                    rawQueueStatus == "report_prepared" || rawApptStatus == "report_prepared" || hasPreparedReport -> "report_prepared"
                    rawQueueStatus == "processing" || rawQueueStatus == "sample_collected" || rawApptStatus == "processing" || hasProcessingReport -> "processing"
                    qEntry != null -> qEntry.status
                    rawApptStatus.isNotBlank() && rawApptStatus != "pending" -> rawApptStatus
                    else -> "waiting"
                }

                // Count LIVE queue patients ahead (both "waiting" AND "inside" count as ahead)
                if (appt.clinicId.isNotBlank()) {
                    val clinicEntries = queueRepository?.getQueueEntriesForClinic(appt.clinicId) ?: emptyList()
                    val myPos = qEntry?.queuePosition ?: tokenNumber
                    val liveAhead = clinicEntries.count {
                        (it.status == "waiting" || it.status == "inside") && it.queuePosition < myPos
                    }
                    patientsAhead = liveAhead

                    // Real estimated timing calculation using QueueRepository engine
                    val timing = QueueRepository.calculateLiveQueueTimingEstimate(
                        clinic = clinicObj,
                        isDoctorInClinic = isDoctorInClinic,
                        allClinicQueueEntries = clinicEntries,
                        targetEntry = qEntry,
                        fallbackPatientsAhead = liveAhead,
                        appointmentTime = appt.appointmentTime,
                        optInEarlyCall = appt.optInEarlyCall
                    )
                    liveTimingEstimate = timing

                    // Expected wait time calculation for legacy formatting
                    val estWaitMinutes = if (liveAhead > 0) liveAhead * clinicAvgTimeMinutes else 0

                    // ── 1-Hour Reminder Trigger (Fires once at most when turn is within ≤ 1 hour) ──
                    val isWithinOneHour = (timing.estimatedTimeLeftText.contains("min") && !timing.estimatedTimeLeftText.contains("60")) || (liveAhead in 0..1)
                    if (isWithinOneHour && queueStatus == "waiting") {
                        val alreadySent = sessionManager?.isOneHourReminderTriggered(appt.id) == true
                        if (!alreadySent) {
                            sessionManager?.markOneHourReminderTriggered(appt.id)
                            try {
                                val notifTitle = "⏰ Queue Turn Approaching!"
                                val notifMsg = "Dear ${appt.patientName}, your turn at ${clinicName.ifBlank { "the clinic" }} is expected at ${timing.expectedExactTimeText} (${timing.estimatedTimeLeftText}). Please be nearby in the waiting area."
                                
                                com.dactor.patient.service.NotificationHelper.showSystemNotification(
                                    context = context,
                                    id = (appt.id.hashCode() and 0x7FFFFFFF) % 100000,
                                    title = notifTitle,
                                    message = notifMsg,
                                    appointmentId = appt.id
                                )
                                queueRepository?.insertAutoAlert(
                                    appointmentId = appt.id,
                                    userId = appt.userId,
                                    title = notifTitle,
                                    message = notifMsg,
                                    estimatedTimeLeft = timing.estimatedTimeLeftText,
                                    expectedTime = timing.expectedExactTimeText,
                                    trackingCode = appt.trackingCode10Digit
                                )
                            } catch (ignored: Exception) {}
                        }
                    }

                    // ── Automatic Alert: fire once when ≤2 people ahead in live queue ──
                    if (liveAhead in 0..2 && queueStatus == "waiting" && !hasTriggeredTwoAheadAlert) {
                        hasTriggeredTwoAheadAlert = true
                        try {
                            val alertTitle = if (liveAhead == 0) "You're Next!" else "Almost Your Turn!"
                            val alertMsg = if (liveAhead == 0) {
                                "Dear ${appt.patientName}, you are next in line at ${clinicName.ifBlank { "the clinic" }}. Expected time: ${timing.expectedExactTimeText}. Please proceed to the consultation area."
                            } else {
                                "Dear ${appt.patientName}, only $liveAhead patient${if (liveAhead > 1) "s" else ""} ahead of you at ${clinicName.ifBlank { "the clinic" }}. Expected time: ${timing.expectedExactTimeText}. Please be ready."
                            }
                            queueRepository?.insertAutoAlert(
                                appointmentId = appt.id,
                                userId = appt.userId,
                                title = alertTitle,
                                message = alertMsg,
                                estimatedTimeLeft = timing.estimatedTimeLeftText,
                                expectedTime = timing.expectedExactTimeText,
                                trackingCode = appt.trackingCode10Digit
                            )
                        } catch (ignored: Exception) {}
                    }
                }

                isDataLoaded = true
            } else {
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
                isDataLoaded = true
            }

            isSavedToProfile = sessionManager?.getSavedTrackingCodes()?.any { it.first == displayTrackingCode } ?: false
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    LaunchedEffect(appointmentIdOrCode) {
        while (isActive) {
            refreshData()
            delay(4000L) // auto-refresh queue position and doctor status every 4 seconds
        }
    }

    fun handleBackNavigation() {
        if (!navController.popBackStack()) {
            navController.navigate(NavRoutes.PatientMain.route) {
                popUpTo(navController.graph.startDestinationId) { inclusive = false }
                launchSingleTop = true
            }
        }
    }

    BackHandler {
        handleBackNavigation()
    }

    // Function to open Google Maps
    fun openGoogleMaps() {
        try {
            val uri = Uri.parse("geo:$clinicLatitude,$clinicLongitude?q=" + Uri.encode("$clinicName, $clinicAddress"))
            val mapIntent = Intent(Intent.ACTION_VIEW, uri)
            mapIntent.setPackage("com.google.android.apps.maps")
            if (mapIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(mapIntent)
            } else {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=" + Uri.encode("$clinicName, $clinicAddress")))
                context.startActivity(browserIntent)
            }
        } catch (e: Exception) {
            Toast.makeText(context, "Unable to open Google Maps", Toast.LENGTH_SHORT).show()
        }
    }

    // Function to open phone dialer
    fun callClinicPhone() {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${clinicPhone.trim()}"))
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Unable to launch dialer", Toast.LENGTH_SHORT).show()
        }
    }

    val isConsultancyCompleted = queueStatus in listOf("done", "completed") ||
        appointment?.checkinStatus?.lowercase() in listOf("done", "completed")

    val isMultiVisitClinic = clinicType.equals("multi_visit", ignoreCase = true) ||
        clinicObj?.type?.equals("multi_visit", ignoreCase = true) == true

    val isLabClinic = clinicType.equals("diagnostic_lab", ignoreCase = true) ||
        clinicObj?.type?.equals("diagnostic_lab", ignoreCase = true) == true ||
        !appointment?.selectedLabTests.isNullOrBlank() ||
        labReports.isNotEmpty() ||
        queueStatus == "processing" ||
        queueStatus == "report_prepared" ||
        queueStatus == "sample_collected"

    val isSingleVisitClinic = !isMultiVisitClinic && !isLabClinic

    // Hide reschedule option if appointment is completed, or if it is a single-type clinic or diagnostic lab
    val canReschedule = !isConsultancyCompleted && !isSingleVisitClinic && !isLabClinic

    // Reschedule flow handler: verifies patient before showing date picker
    fun handleRescheduleClick() {
        if (!canReschedule) {
            Toast.makeText(context, "Consultation is completed. Completed appointments cannot be rescheduled.", Toast.LENGTH_SHORT).show()
            return
        }
        if (!isUnlocked) {
            pendingVerificationAction = "reschedule"
            showVerificationDialog = true
        } else {
            showRescheduleDialog = true
        }
    }
    val isSampleProcessing = queueStatus == "processing" ||
        queueStatus == "sample_collected" ||
        appointment?.checkinStatus?.lowercase() in listOf("processing", "sample_collected") ||
        labReports.any { it.stage == "processing" || it.stage == "in_lab" || it.stage == "sample_collected" }

    val isReportReady = queueStatus == "report_prepared" ||
        (isLabClinic && queueStatus in listOf("done", "completed")) ||
        appointment?.checkinStatus?.lowercase() in listOf("report_prepared") ||
        labReports.any { it.stage == "prepared" }

    val isLabSampleDone = isLabClinic && (isSampleProcessing || isReportReady || labReports.isNotEmpty() ||
        queueStatus in listOf("sample_collected", "processing", "report_prepared", "done", "completed") ||
        appointment?.checkinStatus?.lowercase() in listOf("sample_collected", "processing", "report_prepared", "done", "completed"))

    val shouldShowSlotAndCallCards = !isConsultancyCompleted && !isLabSampleDone && queueStatus != "inside"

    fun triggerDirectReportDownload() {
        val primaryReport = labReports.firstOrNull { it.stage == "prepared" }
            ?: labReports.firstOrNull()
            ?: LabReport(
                id = appointment?.id ?: displayTrackingCode,
                appointmentId = appointment?.id ?: displayTrackingCode,
                clinicId = appointment?.clinicId ?: "",
                testName = appointment?.selectedLabTests?.takeIf { it.isNotBlank() } ?: "Diagnostic Lab Investigation",
                stage = "prepared",
                fileUrl = null,
                fileName = "Lab_Report_${displayTrackingCode.ifBlank { "Report" }}.pdf",
                fileType = "pdf",
                patientNameVerification = rawPatientName,
                sampleCollectedAt = appointment?.appointmentDate ?: today,
                preparedAt = today
            )
        com.dactor.patient.util.LabReportPdfDownloader.downloadAndSaveReportFile(
            context = context,
            report = primaryReport,
            patientName = rawPatientName.ifBlank { "Registered Patient" },
            clinicName = clinicName.ifBlank { "Dactor Diagnostic & Pathology Lab" },
            doctorName = doctorName.ifBlank { "Certified Pathologist / Lab Technician" }
        )
    }

    Scaffold(
        containerColor = Color(0xFFF1F5F9)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
        ) {
            // =========================================================================
            // TOP HEADER: DEEP MEDICAL TEAL WITH BRAND PILL, TITLE & REFRESH
            // =========================================================================
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0D5C4D))
                    .padding(top = 16.dp, bottom = 32.dp, start = 18.dp, end = 18.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Top Brand Capsule Pill (Contigo / Clinic) + Circular Refresh Action
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.White.copy(alpha = 0.18f)
                        ) {
                            Text(
                                text = clinicName.ifBlank { "Contigo" },
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                            )
                        }

                        // Right circular refresh action button
                        Surface(
                            shape = CircleShape,
                            color = Color.White.copy(alpha = 0.18f),
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                IconButton(
                                    onClick = {
                                        coroutineScope.launch {
                                            isProcessing = true
                                            refreshData()
                                            delay(400)
                                            isProcessing = false
                                        }
                                    },
                                    enabled = !isProcessing,
                                    modifier = Modifier.size(38.dp)
                                ) {
                                    if (isProcessing) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(18.dp),
                                            color = Color.White,
                                            strokeWidth = 2.dp
                                        )
                                    } else {
                                        Icon(
                                            Icons.Default.Refresh,
                                            contentDescription = "Refresh Queue",
                                            tint = Color.White,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Title row with Back arrow
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        IconButton(
                            onClick = { handleBackNavigation() },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                Icons.Default.ArrowBack,
                                contentDescription = "Back",
                                tint = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "Live Queue Position",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Your health, our priority",
                                fontSize = 12.5.sp,
                                color = Color.White.copy(alpha = 0.85f)
                            )
                        }
                    }
                }
            }

            // =========================================================================
            // CONTENT CONTAINER WITH NEGATIVE OFFSET OVERLAPPING THE TEAL HEADER
            // =========================================================================
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .offset(y = (-16).dp)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {

                // ---------------------------------------------------------------------
                // 1. BOOKING CODE CARD WITH COPY BUTTON
                // ---------------------------------------------------------------------
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    shadowElevation = 1.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFE0F2FE),
                                modifier = Modifier.size(44.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.GridView,
                                        contentDescription = "Code",
                                        tint = Color(0xFF0284C7),
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            }
                            Column {
                                Text(
                                    text = "BOOKING CODE",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF64748B),
                                    letterSpacing = 0.5.sp
                                )
                                Text(
                                    text = displayTrackingCode.ifBlank { if (isDataLoaded) "--" else "Loading..." },
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color(0xFF0F172A)
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            modifier = Modifier
                                .size(38.dp)
                                .clickable {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    val clip = ClipData.newPlainText("Booking Code", displayTrackingCode)
                                    clipboard.setPrimaryClip(clip)
                                    Toast.makeText(context, "Booking code copied to clipboard!", Toast.LENGTH_SHORT).show()
                                }
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.ContentCopy,
                                    contentDescription = "Copy code",
                                    tint = Color(0xFF334155),
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                        }
                    }
                }

                // ── A. CLINIC ON BREAK ALERT BANNER ───────────────────
                if (!isConsultancyCompleted && clinicObj?.isOnBreak == true) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFFFEE2E2),
                        border = BorderStroke(1.5.dp, Color(0xFFEF4444)),
                        shadowElevation = 2.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFEF4444),
                                modifier = Modifier.size(36.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.PauseCircle,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "CLINIC IS CURRENTLY ON BREAK",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFF991B1B)
                                )
                                val todayBreak = clinicObj?.getTodaySchedule()?.takeIf { it.hasBreak }
                                val breakTimingStr = if (todayBreak != null && !todayBreak.breakStart.isNullOrBlank() && !todayBreak.breakEnd.isNullOrBlank()) {
                                    "Scheduled Break: ${todayBreak.breakStart} – ${todayBreak.breakEnd}. Consultations will resume shortly."
                                } else {
                                    "Consultations are paused temporarily. Will resume shortly."
                                }
                                Text(
                                    text = breakTimingStr,
                                    fontSize = 11.5.sp,
                                    color = Color(0xFFB91C1C),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // ── B. DOCTOR PRESENCE / IDLE BANNER ───────────────────
                val doctorBannerMsg = liveTimingEstimate?.doctorStatusBanner
                if (!isConsultancyCompleted && !doctorBannerMsg.isNullOrBlank() && clinicObj?.isOnBreak != true) {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = if (liveTimingEstimate?.isDoctorNotInside == true) Color(0xFFFEF2F2) else Color(0xFFFFFBEB),
                        border = BorderStroke(1.dp, if (liveTimingEstimate?.isDoctorNotInside == true) Color(0xFFFCA5A5) else Color(0xFFFCD34D)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = if (liveTimingEstimate?.isDoctorNotInside == true) Icons.Default.PersonOff else Icons.Default.AccessTime,
                                contentDescription = null,
                                tint = if (liveTimingEstimate?.isDoctorNotInside == true) Color(0xFFDC2626) else Color(0xFFD97706),
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = doctorBannerMsg,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (liveTimingEstimate?.isDoctorNotInside == true) Color(0xFF991B1B) else Color(0xFF92400E)
                            )
                        }
                    }
                }

                // ── C. BREAK HOURS INFORMATIONAL CARD ─
                val todaySched = clinicObj?.getTodaySchedule()
                if (!isConsultancyCompleted && todaySched?.hasBreak == true && !todaySched.breakStart.isNullOrBlank() && !todaySched.breakEnd.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFFFF7ED),
                        border = BorderStroke(1.dp, Color(0xFFFED7AA)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Default.Coffee,
                                    contentDescription = null,
                                    tint = Color(0xFF9A3412),
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "Clinic break today",
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF78350F)
                                )
                            }
                            Text(
                                text = "${todaySched.breakStart} – ${todaySched.breakEnd}",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF78350F)
                            )
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // 2. MAIN LIVE QUEUE STATUS CARD (TOKEN, STEPPER, TIME & WAIT WINDOW)
                // ---------------------------------------------------------------------
                Card(
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Top Token Row: Token Circle + Status Title
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            // Circular Position Badge with outer soft halo (Shows live patients ahead in line)
                            Box(contentAlignment = Alignment.Center) {
                                Surface(
                                    shape = CircleShape,
                                    color = when {
                                        queueStatus == "inside" -> Color(0xFFDBEAFE)
                                        queueStatus == "done" -> Color(0xFFDCFCE7)
                                        patientsAhead == 0 -> Color(0xFFDCFCE7)
                                        else -> Color(0xFFE0F2FE)
                                    },
                                    modifier = Modifier.size(76.dp)
                                ) {}

                                Surface(
                                    shape = CircleShape,
                                    color = when {
                                        queueStatus == "inside" -> Color(0xFF2563EB)
                                        queueStatus == "done" -> Color(0xFF059669)
                                        patientsAhead == 0 -> Color(0xFF10B981)
                                        else -> Color(0xFF0284C7)
                                    },
                                    shadowElevation = 2.dp,
                                    modifier = Modifier.size(64.dp)
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        val topBadgeLabel = when {
                                            queueStatus == "inside" -> "CURRENT"
                                            queueStatus == "done" -> "VISIT"
                                            patientsAhead == 0 -> "UP NEXT"
                                            else -> "POSITION"
                                        }
                                        val mainBadgeText = when {
                                            queueStatus == "inside" -> "NOW"
                                            queueStatus == "done" -> "✓"
                                            patientsAhead >= 0 -> "$patientsAhead"
                                            else -> "—"
                                        }
                                        Text(
                                            text = topBadgeLabel,
                                            fontSize = 8.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White.copy(alpha = 0.9f),
                                            letterSpacing = 0.5.sp
                                        )
                                        Text(
                                            text = mainBadgeText,
                                            fontSize = if (mainBadgeText.length > 2) 18.sp else 24.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Color.White
                                        )
                                    }
                                }
                            }

                            // Dynamic Title & Subtext & Token Pill
                            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = when {
                                            isLabClinic && isReportReady -> "Status: Prepared"
                                            isLabClinic && isSampleProcessing -> "Status: Processing"
                                            isLabClinic && patientsAhead == 0 -> "Next for Sample Collection!"
                                            isLabClinic && patientsAhead > 0 -> "$patientsAhead Patients Ahead"
                                            isLabClinic -> "Waiting for Sample Collection"
                                            queueStatus == "inside" -> "You are in OPD session"
                                            queueStatus == "done" -> "Consultation completed"
                                            patientsAhead == 0 -> "You're next in line"
                                            else -> "$patientsAhead patients ahead"
                                        },
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = when {
                                            isLabClinic && isReportReady -> Color(0xFF059669)
                                            isLabClinic && isSampleProcessing -> Color(0xFFD97706)
                                            queueStatus == "inside" -> Color(0xFF2563EB)
                                            queueStatus == "done" -> Color(0xFF059669)
                                            else -> Color(0xFF0F172A)
                                        }
                                    )
                                    if (tokenNumber > 0) {
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = Color(0xFFF1F5F9),
                                            border = BorderStroke(1.dp, Color(0xFFCBD5E1))
                                        ) {
                                            Text(
                                                text = "Token #$tokenNumber",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = Color(0xFF475569),
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                                Text(
                                    text = when {
                                        isLabClinic && isReportReady -> "Report Prepared • Verify Name/Phone to View"
                                        isLabClinic && isSampleProcessing -> "Sample Collected • Processing in Lab"
                                        isLabClinic && patientsAhead == 0 -> "Proceed for sample collection"
                                        queueStatus == "inside" -> "With doctor in consultation room"
                                        queueStatus == "done" -> "Thank you for visiting"
                                        !liveTimingEstimate?.slotNoticeText.isNullOrBlank() -> liveTimingEstimate!!.slotNoticeText
                                        patientsAhead == 0 -> "0 patients ahead in line • Stay close to the clinic"
                                        else -> "$patientsAhead ahead in line • Est. wait: ~${patientsAhead * clinicAvgTimeMinutes} mins"
                                    },
                                    fontSize = 13.sp,
                                    color = Color(0xFF64748B)
                                )
                            }
                        }

                        // Stepper Progress Row: 4 Steps (Pixel-Perfect Alignment with background line connecting circle centers)
                        val isLab = isLabClinic
                        val stepNames = if (isLab) {
                            listOf("Booked", "Collected", "Processing", "Prepared")
                        } else {
                            listOf("Booked", "Waiting", "In OPD", "Done")
                        }

                        val stepIcons = if (isLab) {
                            listOf(Icons.Default.Check, Icons.Default.WaterDrop, Icons.Default.Biotech, Icons.Default.Description)
                        } else {
                            listOf(Icons.Default.Check, Icons.Default.HourglassTop, Icons.Default.MedicalServices, Icons.Default.Check)
                        }

                        val stepReaches = if (isLab) {
                            listOf(
                                true,
                                isSampleProcessing || isReportReady,
                                isSampleProcessing || isReportReady,
                                isReportReady
                            )
                        } else {
                            listOf(
                                true,
                                queueStatus == "waiting" || queueStatus == "inside" || queueStatus == "done",
                                queueStatus == "inside" || queueStatus == "done",
                                queueStatus == "done"
                            )
                        }

                        val currentActiveIndex = if (isLab) {
                            when {
                                isReportReady -> 3
                                isSampleProcessing -> 2
                                else -> 0
                            }
                        } else {
                            when (queueStatus) {
                                "done" -> 3
                                "inside" -> 2
                                "waiting" -> 1
                                else -> 0
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            // Connecting lines drawn behind the circles, vertically centered at 17.dp (center of 34.dp circle)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 30.dp)
                                    .padding(top = 16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Line 0 -> 1
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(2.5.dp)
                                        .background(
                                            if (stepReaches[1] || currentActiveIndex >= 1) Color(0xFF10B981) else Color(0xFFE2E8F0),
                                            RoundedCornerShape(1.dp)
                                        )
                                )
                                // Line 1 -> 2
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(2.5.dp)
                                        .background(
                                            if (stepReaches[2] || currentActiveIndex >= 2) Color(0xFF10B981) else Color(0xFFE2E8F0),
                                            RoundedCornerShape(1.dp)
                                        )
                                )
                                // Line 2 -> 3
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(2.5.dp)
                                        .background(
                                            if (stepReaches[3] || currentActiveIndex >= 3) Color(0xFF10B981) else Color(0xFFE2E8F0),
                                            RoundedCornerShape(1.dp)
                                        )
                                )
                            }

                            // 4 Step Nodes
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                stepNames.forEachIndexed { index, name ->
                                    val isReached = stepReaches[index]
                                    val isActiveStep = index == currentActiveIndex

                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(6.dp),
                                        modifier = Modifier.width(60.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier.size(34.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (isActiveStep && index == 1) {
                                                // Waiting active state with concentric halo ring matching reference
                                                Surface(
                                                    shape = CircleShape,
                                                    color = Color(0xFFBAE6FD),
                                                    modifier = Modifier.size(34.dp)
                                                ) {}
                                                Surface(
                                                    shape = CircleShape,
                                                    color = Color(0xFF0284C7),
                                                    modifier = Modifier.size(26.dp)
                                                ) {
                                                    Box(contentAlignment = Alignment.Center) {
                                                        Icon(
                                                            imageVector = Icons.Default.HourglassTop,
                                                            contentDescription = name,
                                                            tint = Color.White,
                                                            modifier = Modifier.size(13.dp)
                                                        )
                                                    }
                                                }
                                            } else {
                                                Surface(
                                                    shape = CircleShape,
                                                    color = when {
                                                        isReached && index == 0 -> Color(0xFF10B981)
                                                        isActiveStep -> Color(0xFF0284C7)
                                                        isReached -> Color(0xFF10B981)
                                                        else -> Color(0xFFE2E8F0)
                                                    },
                                                    modifier = Modifier.size(28.dp)
                                                ) {
                                                    Box(contentAlignment = Alignment.Center) {
                                                        Icon(
                                                            imageVector = stepIcons[index],
                                                            contentDescription = name,
                                                            tint = if (isReached || isActiveStep) Color.White else Color(0xFF94A3B8),
                                                            modifier = Modifier.size(14.dp)
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        Text(
                                            text = name,
                                            fontSize = 11.sp,
                                            fontWeight = if (isActiveStep) FontWeight.Bold else FontWeight.Medium,
                                            color = if (isActiveStep) Color(0xFF0284C7) else if (isReached && index == 0) Color(0xFF059669) else Color(0xFF64748B),
                                            maxLines = 1
                                        )
                                    }
                                }
                            }
                        }

                        // Two info cards: Your slot & Expected call (Hidden when consultancy is completed OR when lab sample collected)
                        if (shouldShowSlotAndCallCards) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                // Your slot card
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = Color(0xFFF1F5F9),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        verticalArrangement = Arrangement.spacedBy(3.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.AccessTime,
                                                contentDescription = null,
                                                tint = Color(0xFF64748B),
                                                modifier = Modifier.size(15.dp)
                                            )
                                            Text(
                                                text = "Your slot",
                                                fontSize = 12.sp,
                                                color = Color(0xFF64748B),
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                        Text(
                                            text = appointment?.appointmentTime?.takeIf { it.isNotBlank() } ?: if (isDataLoaded) "Live Turn" else "Loading...",
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = if (appointment?.appointmentTime.isNullOrBlank()) "Real-time queue" else "Booked window",
                                            fontSize = 11.5.sp,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }

                                // Expected call card
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = if (liveTimingEstimate?.canOfferEarlyArrival == true) Color(0xFFDCFCE7) else Color(0xFFE0F2FE),
                                    border = if (liveTimingEstimate?.canOfferEarlyArrival == true) BorderStroke(1.dp, Color(0xFF86EFAC)) else null,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    val timing = liveTimingEstimate
                                    val displayWait = timing?.estimatedTimeLeftText?.takeIf { it.isNotBlank() }
                                        ?: (if (patientsAhead > 0) "~${patientsAhead * clinicAvgTimeMinutes} min" else "< 5 min")
                                    val displayWindow = when {
                                        !timing?.timeWindowText.isNullOrBlank() -> timing!!.timeWindowText
                                        !timing?.approxTimeText.isNullOrBlank() -> timing!!.approxTimeText
                                        !timing?.expectedExactTimeText.isNullOrBlank() && timing.expectedExactTimeText != "Soon, be ready" -> "Approx. ${timing.expectedExactTimeText}"
                                        patientsAhead == 0 -> "You're next in line"
                                        else -> "In active queue"
                                    }

                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        verticalArrangement = Arrangement.spacedBy(3.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                if (timing?.canOfferEarlyArrival == true) Icons.Default.Bolt else Icons.Default.PhoneCallback,
                                                contentDescription = null,
                                                tint = if (timing?.canOfferEarlyArrival == true) Color(0xFF16A34A) else Color(0xFF0284C7),
                                                modifier = Modifier.size(15.dp)
                                            )
                                            Text(
                                                text = if (timing?.canOfferEarlyArrival == true) "Doctor Free Early" else "Expected window",
                                                fontSize = 12.sp,
                                                color = if (timing?.canOfferEarlyArrival == true) Color(0xFF16A34A) else Color(0xFF0284C7),
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                        Text(
                                            text = displayWait,
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (timing?.canOfferEarlyArrival == true) Color(0xFF15803D) else Color(0xFF0284C7)
                                        )
                                        Text(
                                            text = displayWindow,
                                            fontSize = 11.5.sp,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }
                            }

                            if (liveTimingEstimate?.canOfferEarlyArrival == true) {
                                Spacer(modifier = Modifier.height(10.dp))
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color(0xFFF0FDF4),
                                    border = BorderStroke(1.dp, Color(0xFF86EFAC)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Bolt,
                                            contentDescription = null,
                                            tint = Color(0xFF16A34A),
                                            modifier = Modifier.size(24.dp)
                                        )
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = "⚡ Doctor is Free Now! Come in early?",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF166534)
                                            )
                                            Text(
                                                text = "The doctor finished earlier consultations ahead of schedule. Since you opted in, you can proceed to the clinic now!",
                                                fontSize = 11.sp,
                                                lineHeight = 15.sp,
                                                color = Color(0xFF15803D)
                                            )
                                        }
                                    }
                                }
                            }
                        } else if (isLabClinic && isLabSampleDone) {
                            // Dedicated Lab Processing / Prepared Status Banner replacing doctor call card
                            if (isSampleProcessing && !isReportReady) {
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = Color(0xFFFEF3C7),
                                    border = BorderStroke(1.dp, Color(0xFFFCD34D)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(42.dp)
                                                .background(Color(0xFFFDE68A), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.HourglassTop,
                                                contentDescription = null,
                                                tint = Color(0xFFB45309),
                                                modifier = Modifier.size(22.dp)
                                            )
                                        }
                                        Column(
                                            modifier = Modifier.weight(1f),
                                            verticalArrangement = Arrangement.spacedBy(2.dp)
                                        ) {
                                            Text(
                                                text = "Sample Collected • Preparing Report",
                                                fontSize = 13.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF92400E)
                                            )
                                            Text(
                                                text = "Please wait while your lab report is being prepared in the laboratory. You will be able to view and download it here once prepared.",
                                                fontSize = 11.5.sp,
                                                color = Color(0xFFB45309),
                                                lineHeight = 16.sp
                                            )
                                        }
                                    }
                                }
                            } else if (isReportReady) {
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = Color(0xFFECFDF5),
                                    border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(42.dp)
                                                .background(Color(0xFFD1FAE5), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.CheckCircle,
                                                contentDescription = null,
                                                tint = Color(0xFF059669),
                                                modifier = Modifier.size(22.dp)
                                            )
                                        }
                                        Column(
                                            modifier = Modifier.weight(1f),
                                            verticalArrangement = Arrangement.spacedBy(2.dp)
                                        ) {
                                            Text(
                                                text = "Lab Report Prepared & Ready",
                                                fontSize = 13.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF065F46)
                                            )
                                            Text(
                                                text = "Your diagnostic test report is prepared. Check the Lab Report section below to view or download.",
                                                fontSize = 11.5.sp,
                                                color = Color(0xFF047857),
                                                lineHeight = 16.sp
                                            )
                                        }
                                    }
                                }
                            }
                        } else if (isConsultancyCompleted) {
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = Color(0xFFECFDF5),
                                border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(42.dp)
                                            .background(Color(0xFFD1FAE5), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = Color(0xFF059669),
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                    Column(
                                        modifier = Modifier.weight(1f),
                                        verticalArrangement = Arrangement.spacedBy(2.dp)
                                    ) {
                                        Text(
                                            text = "Consultation Completed",
                                            fontSize = 13.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF065F46)
                                        )
                                        Text(
                                            text = "Your consultation is completed. Prescription summary and billing receipt are available below.",
                                            fontSize = 11.5.sp,
                                            color = Color(0xFF047857),
                                            lineHeight = 16.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // 3. CLINIC & DOCTOR PROFILE CARD (WITH INTEGRATED PRESENCE BANNER)
                // ---------------------------------------------------------------------
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Clinic Header: Icon + Name
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFF0D9488),
                                modifier = Modifier.size(40.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.Add,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                            }

                            Column {
                                Text(
                                    text = "CLINIC",
                                    fontSize = 10.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF64748B),
                                    letterSpacing = 0.5.sp
                                )
                                Text(
                                    text = clinicName.ifBlank { "Rajan Ke Clinic" },
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A)
                                )
                            }
                        }

                        // Clinic Address row
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = Color(0xFF64748B),
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = clinicAddress.ifBlank { "7X8P+422, Varanasi, Varanasi Division, Uttar Pradesh" },
                                fontSize = 12.sp,
                                color = Color(0xFF64748B)
                            )
                        }

                        // Two outlined buttons: Call clinic & Directions
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = { callClinicPhone() },
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, Color(0xFF0D5C4D)),
                                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(42.dp)
                            ) {
                                Icon(
                                    Icons.Default.Phone,
                                    contentDescription = "Call",
                                    tint = Color(0xFF0D5C4D),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text("Call clinic", fontSize = 13.sp, color = Color(0xFF0D5C4D), fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = { openGoogleMaps() },
                                shape = RoundedCornerShape(12.dp),
                                border = BorderStroke(1.dp, Color(0xFF0D5C4D)),
                                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(42.dp)
                            ) {
                                Icon(
                                    Icons.Default.NearMe,
                                    contentDescription = "Directions",
                                    tint = Color(0xFF0D5C4D),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text("Directions", fontSize = 13.sp, color = Color(0xFF0D5C4D), fontWeight = FontWeight.Bold)
                            }
                        }

                        HorizontalDivider(color = Color(0xFFF1F5F9))

                        // Doctor Row: Avatar, Name, Specialty, Consultation description
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            if (!doctorPhotoUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = doctorPhotoUrl,
                                    contentDescription = doctorName,
                                    modifier = Modifier
                                        .size(52.dp)
                                        .clip(CircleShape),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0xFFCCFBF1),
                                    modifier = Modifier.size(52.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            text = doctorInitials,
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF0D5C4D)
                                        )
                                    }
                                }
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = "DOCTOR",
                                    fontSize = 10.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF64748B),
                                    letterSpacing = 0.5.sp
                                )
                                Text(
                                    text = if (doctorName.startsWith("Dr.", ignoreCase = true)) doctorName else "Dr. ${doctorName.ifBlank { "Anubhav Jha" }}",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A)
                                )
                                Text(
                                    text = doctorSpecialty.ifBlank { "Ophthalmology (Eye Care)" },
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF0D9488)
                                )
                                Text(
                                    text = "Consultation for general health & OPD",
                                    fontSize = 11.5.sp,
                                    color = Color(0xFF64748B)
                                )
                            }
                        }

                        // Doctor Presence Banner INSIDE this card (matching reference - hidden on completed visits & lab sample collected)
                        if (!isConsultancyCompleted && !isLabSampleDone) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isDoctorInClinic) Color(0xFFECFDF5) else Color(0xFFFEF2F2),
                                border = BorderStroke(1.dp, if (isDoctorInClinic) Color(0xFFA7F3D0) else Color(0xFFFECACA)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(16.dp)
                                            .background(if (isDoctorInClinic) Color(0xFFA7F3D0) else Color(0xFFFECACA), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .background(if (isDoctorInClinic) Color(0xFF059669) else Color(0xFFDC2626), CircleShape)
                                        )
                                    }

                                    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                        Text(
                                            text = if (isDoctorInClinic) "Doctor is inside the clinic" else "Doctor Temporarily Away",
                                            fontSize = 12.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isDoctorInClinic) Color(0xFF065F46) else Color(0xFF991B1B)
                                        )
                                        Text(
                                            text = if (isDoctorInClinic) "Attending active OPD tokens in the consultation room" else "Doctor will resume consultations shortly.",
                                            fontSize = 11.sp,
                                            color = if (isDoctorInClinic) Color(0xFF047857) else Color(0xFFB91C1C)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 3B. SELECTED DIAGNOSTIC LAB TESTS CARD
                if (!appointment?.selectedLabTests.isNullOrBlank()) {
                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                        border = BorderStroke(1.dp, Color(0xFFBBF7D0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    Icons.Default.Science,
                                    contentDescription = null,
                                    tint = Color(0xFF15803D),
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "Booked Diagnostic Lab Tests",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = Color(0xFF166534)
                                )
                            }
                            Text(
                                text = appointment!!.selectedLabTests!!,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF14532D)
                            )
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // 5. IN OPD CONSULTATION SESSION BANNER (WHEN INSIDE CHAMBER)
                // ---------------------------------------------------------------------
                if (queueStatus == "inside") {
                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFE0F2FE)),
                        border = BorderStroke(1.5.dp, Color(0xFF0284C7)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(modifier = Modifier.size(8.dp).background(Color(0xFF0284C7), CircleShape))
                                Text(
                                    text = "Active Consultation Session in Progress",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0369A1)
                                )
                            }
                            val elapsedSec = if (!insideAt.isNullOrBlank()) {
                                try {
                                    (currentEpochSecond - java.time.Instant.parse(insideAt).epochSecond).coerceAtLeast(0)
                                } catch (e: Exception) { 0L }
                            } else 0L
                            val mins = elapsedSec / 60
                            val secs = elapsedSec % 60
                            val durationFormatted = String.format(java.util.Locale.US, "%02d:%02d", mins, secs)

                            Text(
                                text = "Elapsed Consultation Time: $durationFormatted min",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF0C4A6E)
                            )
                            Text(
                                text = "Please discuss your symptoms and present any prior lab reports or prescriptions to Dr. $doctorName.",
                                fontSize = 11.sp,
                                color = Color(0xFF0369A1)
                            )
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // 6. DONE / COMPLETED ACTIONS (PRESCRIPTION & BILLING)
                // ---------------------------------------------------------------------
                if (queueStatus == "done" || billingInvoice != null) {
                    val invTotal = billingInvoice?.totalAmount?.takeIf { it > 0.0 } ?: appointment?.feeAmount ?: 500.0
                    val invPaid = billingInvoice?.paidAmount ?: (if (appointment?.paymentStatus == "paid") invTotal else 0.0)
                    val invLeft = (invTotal - invPaid).coerceAtLeast(0.0)

                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                        border = BorderStroke(1.dp, Color(0xFF86EFAC)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(20.dp))
                                    Text(
                                        if (queueStatus == "done") "Consultation Finished & Bill Ready" else "Clinic Bill & Prescription Ready",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = Color(0xFF065F46)
                                    )
                                }
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = if (invLeft <= 0.0) Color(0xFFD1FAE5) else Color(0xFFFEE2E2)
                                ) {
                                    Text(
                                        text = if (invLeft <= 0.0) "PAID" else "DUE: Rs. ${invLeft.toInt()}",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (invLeft <= 0.0) Color(0xFF065F46) else Color(0xFF991B1B),
                                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                                    )
                                }
                            }
                            Text(
                                "Total Bill: Rs. ${invTotal.toInt()} • Paid: Rs. ${invPaid.toInt()} • Remaining Left: Rs. ${invLeft.toInt()}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF047857)
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = { showPrescriptionDialog = true },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Prescription & Bill", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }

                                val hasInvoiceRecord = billingInvoice != null && (billingInvoice!!.totalAmount > 0.0 || billingInvoice!!.items.isNotEmpty())
                                if (hasInvoiceRecord) {
                                    OutlinedButton(
                                        onClick = {
                                            val targetAppt = appointment
                                            if (targetAppt != null) {
                                                com.dactor.patient.util.BillPdfDownloader.downloadBillPdf(
                                                    context = context,
                                                    appointment = targetAppt,
                                                    invoice = billingInvoice,
                                                    clinicName = clinicName,
                                                    doctorName = doctorName,
                                                    doctorSpecialty = doctorSpecialty,
                                                    clinicalRemarks = clinicalRemarks
                                                )
                                            } else {
                                                Toast.makeText(context, "Loading appointment details...", Toast.LENGTH_SHORT).show()
                                            }
                                        },
                                        shape = RoundedCornerShape(12.dp),
                                        border = BorderStroke(1.dp, Color(0xFF059669)),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Default.FileDownload, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(14.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Download Bill PDF", fontSize = 11.sp, color = Color(0xFF059669), fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // 7. DIAGNOSTIC LAB CLINIC: PROCESSING & REPORT PREPARED SECTION
                // ---------------------------------------------------------------------
                if (isLabClinic || labReports.isNotEmpty()) {
                    val primaryRep = labReports.firstOrNull { it.stage == "prepared" } ?: labReports.firstOrNull()
                    val hasUploadedFile = !primaryRep?.fileUrl.isNullOrBlank() &&
                        (primaryRep?.fileUrl?.startsWith("http://") == true || primaryRep?.fileUrl?.startsWith("https://") == true)
                    val isImageAttachment = primaryRep?.fileType?.contains("image", ignoreCase = true) == true ||
                        primaryRep?.fileUrl?.endsWith(".jpg", true) == true ||
                        primaryRep?.fileUrl?.endsWith(".jpeg", true) == true ||
                        primaryRep?.fileUrl?.endsWith(".png", true) == true ||
                        primaryRep?.fileUrl?.endsWith(".webp", true) == true

                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = when {
                                isReportReady -> Color(0xFFF0FDF4)
                                isSampleProcessing -> Color(0xFFFEF3C7)
                                else -> Color(0xFFF0F9FF)
                            }
                        ),
                        border = BorderStroke(
                            1.dp,
                            when {
                                isReportReady -> Color(0xFF86EFAC)
                                isSampleProcessing -> Color(0xFFFCD34D)
                                else -> Color(0xFFBAE6FD)
                            }
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(
                                        imageVector = when {
                                            isReportReady -> Icons.Default.Description
                                            isSampleProcessing -> Icons.Default.Biotech
                                            else -> Icons.Default.WaterDrop
                                        },
                                        contentDescription = null,
                                        tint = when {
                                            isReportReady -> Color(0xFF059669)
                                            isSampleProcessing -> Color(0xFFB45309)
                                            else -> Color(0xFF0284C7)
                                        },
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Column {
                                        Text(
                                            text = when {
                                                isReportReady -> "Lab Report Prepared"
                                                isSampleProcessing -> "Status: Processing"
                                                else -> "Waiting for Sample Collection"
                                            },
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.5.sp,
                                            color = when {
                                                isReportReady -> Color(0xFF065F46)
                                                isSampleProcessing -> Color(0xFF92400E)
                                                else -> Color(0xFF0C4A6E)
                                            }
                                        )
                                        Text(
                                            text = when {
                                                isReportReady && hasUploadedFile ->
                                                    if (isImageAttachment) "Report Picture Uploaded • Verify Name/Phone to View or Download"
                                                    else "Report PDF Uploaded • Verify Name/Phone to View or Download"
                                                isReportReady -> "Prepared by Laboratory • Verify Name/Phone to View or Download"
                                                isSampleProcessing -> "Sample Collected • Biochemical Processing Underway"
                                                else -> "Booked in Live Queue • Proceed for Phlebotomy / Sample Collection"
                                            },
                                            fontSize = 10.5.sp,
                                            color = when {
                                                isReportReady -> Color(0xFF047857)
                                                isSampleProcessing -> Color(0xFFB45309)
                                                else -> Color(0xFF0369A1)
                                            }
                                        )
                                    }
                                }

                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = when {
                                        isReportReady -> Color(0xFFD1FAE5)
                                        isSampleProcessing -> Color(0xFFFDE68A)
                                        else -> Color(0xFFE0F2FE)
                                    }
                                ) {
                                    Text(
                                        text = when {
                                            isReportReady -> "PREPARED"
                                            isSampleProcessing -> "PROCESSING"
                                            else -> "LIVE QUEUE"
                                        },
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = when {
                                            isReportReady -> Color(0xFF065F46)
                                            isSampleProcessing -> Color(0xFF92400E)
                                            else -> Color(0xFF0369A1)
                                        },
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }

                            Text(
                                text = when {
                                    isReportReady ->
                                        if (isReportIdentityVerified)
                                            "✓ Identity verified ($rawPatientName). You can now view the report in-app or download the file directly to your device."
                                        else
                                            "🔒 Your lab report is prepared! To view the uploaded file in-app or download it directly, please verify your registered Name or Mobile Number."
                                    isSampleProcessing ->
                                        "Your sample has been collected and transferred to Processing. Check back with your 10-digit code ($displayTrackingCode) or wait for a notification once prepared."
                                    else ->
                                        "Your appointment is currently in the Live Queue. Once your sample is collected by the clinic, your status will automatically move to Processing."
                                },
                                fontSize = 11.sp,
                                color = when {
                                    isReportReady -> Color(0xFF047857)
                                    isSampleProcessing -> Color(0xFF78350F)
                                    else -> Color(0xFF0369A1)
                                }
                            )

                            if (isReportReady) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Button(
                                        onClick = {
                                            if (!isReportIdentityVerified && !isUnlocked) {
                                                pendingVerificationAction = "view_report"
                                                showVerificationDialog = true
                                            } else {
                                                coroutineScope.launch {
                                                    val appt = appointment
                                                    if (appt != null && labReports.isEmpty()) {
                                                        val reps = labReportRepository?.getLabReportsForAppointment(appt.id, appt.trackingCode10Digit) ?: emptyList()
                                                        if (reps.isNotEmpty()) {
                                                            labReports = reps
                                                        }
                                                    }
                                                    showLabReportDialog = true
                                                }
                                            }
                                        },
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(
                                            imageVector = if (isReportIdentityVerified) Icons.Default.Visibility else Icons.Default.LockOpen,
                                            contentDescription = null,
                                            modifier = Modifier.size(15.dp)
                                        )
                                        Spacer(Modifier.width(5.dp))
                                        Text(
                                            text = if (isReportIdentityVerified) "View In-App" else "Verify & View",
                                            fontSize = 11.5.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }

                                    if (hasUploadedFile) {
                                        OutlinedButton(
                                            onClick = {
                                                if (!isReportIdentityVerified) {
                                                    pendingVerificationAction = "download_report"
                                                    showVerificationDialog = true
                                                } else {
                                                    triggerDirectReportDownload()
                                                }
                                            },
                                            shape = RoundedCornerShape(12.dp),
                                            border = BorderStroke(1.5.dp, Color(0xFF059669)),
                                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.FileDownload,
                                                contentDescription = null,
                                                tint = Color(0xFF059669),
                                                modifier = Modifier.size(15.dp)
                                            )
                                            Spacer(Modifier.width(5.dp))
                                            Text(
                                                text = if (isReportIdentityVerified) "Download File" else "Verify & Download",
                                                fontSize = 11.5.sp,
                                                color = Color(0xFF059669),
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            } else {
                                Button(
                                    onClick = {
                                        coroutineScope.launch {
                                            isProcessing = true
                                            refreshData()
                                            delay(400)
                                            isProcessing = false
                                            val msg = if (isSampleProcessing) "Status: Processing in Laboratory." else "Status: Waiting for Sample Collection."
                                            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (isSampleProcessing) Color(0xFFD97706) else Color(0xFF0284C7)
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Refresh,
                                        contentDescription = null,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Spacer(Modifier.width(6.dp))
                                    Text(
                                        text = if (isSampleProcessing) "Refresh Processing Status" else "Refresh Queue Status",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // 8. PRIMARY ACTIONS ROW: RESCHEDULE + VIEW ON GOOGLE MAPS
                // (For single type and lab clinic, reschedule is removed after completion)
                // ---------------------------------------------------------------------
                if (canReschedule) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Reschedule Button (Solid Deep Pine/Teal matching reference)
                        Button(
                            onClick = { handleRescheduleClick() },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D5C4D)),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    Icons.Default.DateRange,
                                    contentDescription = "Reschedule",
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = "Reschedule",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }

                        // View on Google Maps Button (Outlined with Deep Teal Border)
                        OutlinedButton(
                            onClick = { openGoogleMaps() },
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.2.dp, Color(0xFF0D5C4D)),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    Icons.Default.LocationOn,
                                    contentDescription = "Maps",
                                    tint = Color(0xFF0D5C4D),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = "Google Maps",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0D5C4D)
                                )
                            }
                        }
                    }
                } else {
                    // For single type clinic and lab after completion: reschedule is removed
                    Button(
                        onClick = { openGoogleMaps() },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D5C4D)),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                Icons.Default.NearMe,
                                contentDescription = "Directions",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "Get Directions to Clinic on Google Maps",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // MULTI-VISIT CLINIC ONLY: APPOINTMENTS BY DATE & TIME + COMMON REMARKS
                // ---------------------------------------------------------------------
                if (isMultiVisitClinic) {
                    val appointmentsList = if (multiClinicAppointments.isNotEmpty()) multiClinicAppointments else listOfNotNull(appointment)

                    // 1. All Appointments Arranged by Date & Time (Clickable for Specific Details)
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.EventNote,
                                        contentDescription = null,
                                        tint = Color(0xFF0D5C4D),
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Column {
                                        Text(
                                            text = "All Appointments History",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = "Arranged by date & time (${appointmentsList.size} visits recorded)",
                                            fontSize = 11.sp,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFFE0F2FE)
                                ) {
                                    Text(
                                        text = "MULTI-VISIT",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0284C7),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }

                            HorizontalDivider(color = Color(0xFFF1F5F9))

                            // Items arranged by date and time
                            appointmentsList.forEach { apptItem ->
                                val isSelected = expandedAppointmentId == apptItem.id ||
                                    (expandedAppointmentId == null && apptItem.id == appointment?.id)
                                val itemStatus = apptItem.checkinStatus.lowercase()
                                val isItemCompleted = itemStatus == "completed" || itemStatus == "done"
                                val isItemActive = itemStatus == "waiting" || itemStatus == "inside"
                                val isItemCurrentLive = apptItem.id == appointment?.id

                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = if (isSelected) Color(0xFFF0FDF4) else Color(0xFFF8FAFC),
                                    border = BorderStroke(
                                        1.dp,
                                        if (isSelected) Color(0xFF86EFAC) else Color(0xFFE2E8F0)
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            expandedAppointmentId = if (expandedAppointmentId == apptItem.id) null else apptItem.id
                                        }
                                ) {
                                    Column(
                                        modifier = Modifier.padding(14.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        // Header Row: Date & Time + Status Pill + Expand Icon
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.CalendarToday,
                                                    contentDescription = null,
                                                    tint = if (isItemCompleted) Color(0xFF059669) else Color(0xFF0D5C4D),
                                                    modifier = Modifier.size(16.dp)
                                                )
                                                Column {
                                                    Text(
                                                        text = "${apptItem.appointmentDate} • ${apptItem.appointmentTime}",
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 13.5.sp,
                                                        color = Color(0xFF0F172A)
                                                    )
                                                    if (isItemCurrentLive) {
                                                        Text(
                                                            text = "Currently Active in Live Tracker",
                                                            fontSize = 10.5.sp,
                                                            fontWeight = FontWeight.SemiBold,
                                                            color = Color(0xFF0284C7)
                                                        )
                                                    }
                                                }
                                            }

                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                Surface(
                                                    shape = RoundedCornerShape(6.dp),
                                                    color = when {
                                                        isItemCompleted -> Color(0xFFD1FAE5)
                                                        isItemActive -> Color(0xFFDBEAFE)
                                                        itemStatus == "cancelled" -> Color(0xFFFEE2E2)
                                                        else -> Color(0xFFFEF3C7)
                                                    }
                                                ) {
                                                    Text(
                                                        text = when {
                                                            isItemCompleted -> "COMPLETED"
                                                            isItemActive -> "IN QUEUE"
                                                            itemStatus == "cancelled" -> "CANCELLED"
                                                            else -> "SCHEDULED"
                                                        },
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.ExtraBold,
                                                        color = when {
                                                            isItemCompleted -> Color(0xFF065F46)
                                                            isItemActive -> Color(0xFF1E40AF)
                                                            itemStatus == "cancelled" -> Color(0xFF991B1B)
                                                            else -> Color(0xFF92400E)
                                                        },
                                                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.5.dp)
                                                    )
                                                }

                                                Icon(
                                                    imageVector = if (isSelected) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                                    contentDescription = null,
                                                    tint = Color(0xFF64748B),
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        }

                                        // Detailed View When Clicked
                                        AnimatedVisibility(visible = isSelected) {
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(top = 6.dp),
                                                verticalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                HorizontalDivider(color = Color(0xFFE2E8F0))

                                                // Tracking code & Doctor
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Column {
                                                        Text("10-Digit Tracking Code", fontSize = 10.5.sp, color = Color(0xFF64748B))
                                                        Text(
                                                            text = apptItem.trackingCode10Digit,
                                                            fontSize = 14.sp,
                                                            fontWeight = FontWeight.Black,
                                                            color = Color(0xFF0F172A)
                                                        )
                                                    }

                                                    Surface(
                                                        shape = RoundedCornerShape(8.dp),
                                                        color = Color.White,
                                                        border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                                                        modifier = Modifier
                                                            .size(34.dp)
                                                            .clickable {
                                                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                                                clipboard.setPrimaryClip(ClipData.newPlainText("Code", apptItem.trackingCode10Digit))
                                                                Toast.makeText(context, "Tracking code copied!", Toast.LENGTH_SHORT).show()
                                                            }
                                                    ) {
                                                        Box(contentAlignment = Alignment.Center) {
                                                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = Color(0xFF475569), modifier = Modifier.size(15.dp))
                                                        }
                                                    }
                                                }

                                                // Patient & Fee info
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween
                                                ) {
                                                    Column {
                                                        Text("Patient Name", fontSize = 10.5.sp, color = Color(0xFF64748B))
                                                        Text(apptItem.patientName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                                                    }
                                                    Column(horizontalAlignment = Alignment.End) {
                                                        Text("Fee & Payment", fontSize = 10.5.sp, color = Color(0xFF64748B))
                                                        Text(
                                                            "Rs. ${apptItem.feeAmount.toInt()} (${apptItem.paymentStatus.uppercase()})",
                                                            fontSize = 12.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = Color(0xFF0F172A)
                                                        )
                                                    }
                                                }

                                                // Specific clinical remark for this appointment (if any)
                                                val itemInvoice = appointmentInvoicesMap[apptItem.id]
                                                val itemRemark = itemInvoice?.remarks?.ifBlank { null }
                                                    ?: if (apptItem.id == appointment?.id) clinicalRemarks?.ifBlank { null } else null

                                                if (!itemRemark.isNullOrBlank()) {
                                                    Surface(
                                                        shape = RoundedCornerShape(8.dp),
                                                        color = Color(0xFFECFDF5),
                                                        border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
                                                        modifier = Modifier.fillMaxWidth()
                                                    ) {
                                                        Column(modifier = Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                                            Text(
                                                                text = "Doctor's Remark for this visit:",
                                                                fontSize = 10.5.sp,
                                                                fontWeight = FontWeight.Bold,
                                                                color = Color(0xFF065F46)
                                                            )
                                                            Text(
                                                                text = itemRemark,
                                                                fontSize = 11.5.sp,
                                                                color = Color(0xFF047857)
                                                            )
                                                        }
                                                    }
                                                }

                                                // Action buttons for this specific appointment
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                ) {
                                                    if (!isItemCurrentLive) {
                                                        OutlinedButton(
                                                            onClick = {
                                                                navController.navigate(NavRoutes.QueueStatus.createRoute(apptItem.trackingCode10Digit))
                                                            },
                                                            shape = RoundedCornerShape(10.dp),
                                                            border = BorderStroke(1.dp, Color(0xFF0D5C4D)),
                                                            modifier = Modifier.weight(1f).height(38.dp),
                                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                                        ) {
                                                            Icon(Icons.Default.Visibility, contentDescription = null, tint = Color(0xFF0D5C4D), modifier = Modifier.size(14.dp))
                                                            Spacer(Modifier.width(4.dp))
                                                            Text("Switch to Track", fontSize = 11.sp, color = Color(0xFF0D5C4D), fontWeight = FontWeight.Bold)
                                                        }
                                                    }

                                                    val hasInvoiceForItem = itemInvoice != null && (itemInvoice.totalAmount > 0.0 || itemInvoice.items.isNotEmpty())
                                                    if (isItemCompleted && hasInvoiceForItem) {
                                                        Button(
                                                            onClick = {
                                                                com.dactor.patient.util.BillPdfDownloader.downloadBillPdf(
                                                                    context = context,
                                                                    appointment = apptItem,
                                                                    invoice = itemInvoice,
                                                                    clinicName = clinicName,
                                                                    doctorName = doctorName,
                                                                    doctorSpecialty = doctorSpecialty,
                                                                    clinicalRemarks = itemRemark
                                                                )
                                                            },
                                                            shape = RoundedCornerShape(10.dp),
                                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                                            modifier = Modifier.weight(1f).height(38.dp),
                                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                                        ) {
                                                            Icon(Icons.Default.FileDownload, contentDescription = null, modifier = Modifier.size(14.dp))
                                                            Spacer(Modifier.width(4.dp))
                                                            Text("Download Bill", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                                        }
                                                    } else if (!isItemCompleted && itemStatus != "cancelled") {
                                                        OutlinedButton(
                                                            onClick = {
                                                                rescheduleDate = apptItem.appointmentDate
                                                                rescheduleTime = apptItem.appointmentTime
                                                                handleRescheduleClick()
                                                            },
                                                            shape = RoundedCornerShape(10.dp),
                                                            border = BorderStroke(1.dp, Color(0xFF0284C7)),
                                                            modifier = Modifier.weight(1f).height(38.dp),
                                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                                        ) {
                                                            Icon(Icons.Default.DateRange, contentDescription = null, tint = Color(0xFF0284C7), modifier = Modifier.size(14.dp))
                                                            Spacer(Modifier.width(4.dp))
                                                            Text("Reschedule Visit", fontSize = 11.sp, color = Color(0xFF0284C7), fontWeight = FontWeight.Bold)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2. Common Remark Section with Appointment Stamps (ONLY FOR MULTIPLE TYPE CLINIC)
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Description,
                                        contentDescription = null,
                                        tint = Color(0xFF0D5C4D),
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Column {
                                        Text(
                                            text = "Common Clinical Remarks Section",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = "All doctor remarks arranged with appointment stamp",
                                            fontSize = 11.sp,
                                            color = Color(0xFF64748B)
                                        )
                                    }
                                }
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFFECFDF5)
                                ) {
                                    Text(
                                        text = "RECORD",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF059669),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }

                            HorizontalDivider(color = Color(0xFFF1F5F9))

                            // Collect all remarks arranged with appointment stamp
                            val allRemarksWithStamps = appointmentsList.mapNotNull { item ->
                                val rem = appointmentInvoicesMap[item.id]?.remarks?.trim()?.ifBlank { null }
                                    ?: if (item.id == appointment?.id) clinicalRemarks?.trim()?.ifBlank { null } else null
                                if (!rem.isNullOrBlank()) {
                                    Triple(item.appointmentDate, item.appointmentTime, rem)
                                } else null
                            }

                            if (allRemarksWithStamps.isNotEmpty()) {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    allRemarksWithStamps.forEachIndexed { idx, (remDate, remTime, remText) ->
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
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Surface(
                                                        shape = CircleShape,
                                                        color = Color(0xFF0D5C4D),
                                                        modifier = Modifier.size(8.dp)
                                                    ) {}
                                                    Text(
                                                        text = "On $remDate appointment ($remTime)",
                                                        fontSize = 12.sp,
                                                        fontWeight = FontWeight.ExtraBold,
                                                        color = Color(0xFF0D5C4D)
                                                    )
                                                }

                                                Surface(
                                                    shape = RoundedCornerShape(8.dp),
                                                    color = Color.White,
                                                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Text(
                                                        text = "Remark: $remText",
                                                        fontSize = 12.sp,
                                                        color = Color(0xFF1E293B),
                                                        lineHeight = 18.sp,
                                                        modifier = Modifier.padding(10.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color(0xFFF8FAFC),
                                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = "No clinical remarks recorded for this clinic's appointments yet. As consultations are completed, each attending doctor's remark will appear here stamped with its specific appointment date and time.",
                                        fontSize = 11.5.sp,
                                        color = Color(0xFF64748B),
                                        lineHeight = 16.sp,
                                        modifier = Modifier.padding(12.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                // ---------------------------------------------------------------------
                // 9. SECONDARY CARD (OTHER ASSOCIATED CLINIC / SAVED APPOINTMENTS)
                // ---------------------------------------------------------------------
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (otherSavedCodes.isNotEmpty()) {
                                val next = otherSavedCodes.first().first
                                navController.navigate(NavRoutes.QueueStatus.createRoute(next))
                            } else {
                                navController.navigate(NavRoutes.TrackingLookup.route)
                            }
                        }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFFE0F2FE),
                                modifier = Modifier.size(38.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.Add,
                                        contentDescription = null,
                                        tint = Color(0xFF0284C7),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }

                            Column {
                                val docTitle = if (otherSavedCodes.isNotEmpty()) {
                                    otherSavedCodes.first().second
                                } else {
                                    val dName = if (doctorName.isNotBlank()) {
                                        if (doctorName.startsWith("Dr.", ignoreCase = true)) doctorName else "Dr. $doctorName"
                                    } else "Dr. Anubhav Jha"
                                    "$dName · $formattedDate"
                                }
                                Text(
                                    text = docTitle,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF0F172A)
                                )
                                Text(
                                    text = "Tap to switch active tracking",
                                    fontSize = 11.sp,
                                    color = Color(0xFF64748B)
                                )
                            }
                        }

                        Icon(
                            Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = Color(0xFF0D5C4D),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(30.dp))
            }
        }
    }

    // =========================================================================
    // MODAL DIALOG 1: PATIENT IDENTITY VERIFICATION (NAME OR PHONE NUMBER)
    // =========================================================================
    if (showVerificationDialog) {
        val isForReport = pendingVerificationAction == "view_report" || pendingVerificationAction == "download_report"
        AlertDialog(
            onDismissRequest = {
                showVerificationDialog = false
                verificationInput = ""
                unlockError = null
            },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFF0D5C4D))
                    Text(
                        text = if (isForReport) "Verify Name / Number for Report" else "Verify Patient Identity",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = if (isForReport)
                            "To view or download this prepared diagnostic lab report, please confirm the patient's registered Name or Mobile Number."
                        else
                            "To reschedule and manage this appointment, please verify using the registered patient's full name or mobile number.",
                        fontSize = 12.sp,
                        color = Color(0xFF475569)
                    )

                    // Method selector chips
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = verifyMethod == "name",
                            onClick = {
                                verifyMethod = "name"
                                verificationInput = ""
                                unlockError = null
                            },
                            label = { Text("Patient Name", fontSize = 11.sp) }
                        )
                        FilterChip(
                            selected = verifyMethod == "phone",
                            onClick = {
                                verifyMethod = "phone"
                                verificationInput = ""
                                unlockError = null
                            },
                            label = { Text("Phone Number", fontSize = 11.sp) }
                        )
                    }

                    OutlinedTextField(
                        value = verificationInput,
                        onValueChange = {
                            verificationInput = it
                            unlockError = null
                        },
                        label = {
                            Text(if (verifyMethod == "name") "Patient's Full Name" else "Registered Phone Number")
                        },
                        placeholder = {
                            Text(if (verifyMethod == "name") "e.g. Ramesh Shrestha" else "e.g. 9841234567")
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = if (verifyMethod == "name") KeyboardType.Text else KeyboardType.Phone
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        isError = unlockError != null
                    )

                    if (unlockError != null) {
                        Text(
                            text = unlockError ?: "",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.error,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    if (cooldownSeconds > 0) {
                        Text(
                            text = "Please wait $cooldownSeconds seconds before retrying.",
                            fontSize = 11.sp,
                            color = Color(0xFFB45309)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (verificationInput.isBlank()) {
                            unlockError = "Please enter verification details."
                            return@Button
                        }
                        if (cooldownSeconds > 0 || isLockedOut) return@Button

                        val isMatch = if (verifyMethod == "name") {
                            val entered = verificationInput.trim().lowercase().replace(Regex("\\s+"), " ")
                            val expected = rawPatientName.trim().lowercase().replace(Regex("\\s+"), " ")
                            entered.isNotBlank() && (
                                expected.isBlank() ||
                                entered == expected ||
                                (expected.length >= 3 && expected.contains(entered)) ||
                                (entered.length >= 3 && entered.contains(expected))
                            )
                        } else {
                            val cleanEntered = verificationInput.filter { it.isDigit() }
                            val cleanExpected = rawPhone.filter { it.isDigit() }
                            cleanEntered.isNotBlank() && (
                                cleanExpected.isBlank() ||
                                cleanEntered.takeLast(10) == cleanExpected.takeLast(10) ||
                                cleanEntered == cleanExpected
                            )
                        }

                        if (isMatch) {
                            isUnlocked = true
                            isReportIdentityVerified = true
                            showVerificationDialog = false
                            verificationInput = ""
                            unlockError = null
                            appointment?.let { coroutineScope.launch { loadConfidentialDetails(it) } }
                            when (pendingVerificationAction) {
                                "view_report" -> showLabReportDialog = true
                                "download_report" -> triggerDirectReportDownload()
                                else -> showRescheduleDialog = true
                            }
                        } else {
                            failedAttempts++
                            cooldownSeconds = 5
                            val remaining = (6 - failedAttempts).coerceAtLeast(0)
                            unlockError = "Details do not match. $remaining attempt(s) remaining."
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D5C4D)),
                    shape = RoundedCornerShape(10.dp),
                    enabled = verificationInput.isNotBlank() && cooldownSeconds == 0 && !isLockedOut
                ) {
                    Text("Verify & Continue", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showVerificationDialog = false
                        verificationInput = ""
                        unlockError = null
                    }
                ) {
                    Text("Cancel", fontSize = 12.sp)
                }
            }
        )
    }

    // =========================================================================
    // MODAL DIALOG 2: RESCHEDULE DATE & TIME PICKER ("HIDE FROM EVERYWHERE")
    // =========================================================================
    if (showRescheduleDialog) {
        AlertDialog(
            onDismissRequest = { showRescheduleDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.EditCalendar, contentDescription = null, tint = Color(0xFF0D5C4D))
                    Text("Reschedule Appointment", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Choose a new appointment date and time slot. Your current token will be released from today's live queue immediately.",
                        fontSize = 12.sp,
                        color = Color(0xFF475569)
                    )

                    if (rescheduleMessage != null) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFD1FAE5),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = rescheduleMessage ?: "",
                                fontSize = 11.sp,
                                color = Color(0xFF065F46),
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }

                    // Date selector field
                    OutlinedTextField(
                        value = rescheduleDate,
                        onValueChange = { rescheduleDate = it },
                        label = { Text("New Date (YYYY-MM-DD)") },
                        trailingIcon = {
                            IconButton(
                                onClick = {
                                    DateTimePickers.showDatePicker(context, rescheduleDate) { picked ->
                                        rescheduleDate = picked
                                    }
                                }
                            ) {
                                Icon(Icons.Default.CalendarMonth, contentDescription = "Pick Date", tint = Color(0xFF0D5C4D))
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )

                    // Time selector field
                    OutlinedTextField(
                        value = rescheduleTime,
                        onValueChange = { rescheduleTime = it },
                        label = { Text("Slot Time (HH:MM)") },
                        trailingIcon = {
                            IconButton(
                                onClick = {
                                    DateTimePickers.showClockTimePicker(context, rescheduleTime) { picked ->
                                        rescheduleTime = picked
                                    }
                                }
                            ) {
                                Icon(Icons.Default.Schedule, contentDescription = "Pick Time", tint = Color(0xFF0D5C4D))
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
                        val appt = appointment ?: return@Button
                        coroutineScope.launch {
                            isProcessing = true
                            // 1. Update appointment in Supabase
                            val ok = appointmentRepository?.rescheduleAppointment(appt.id, rescheduleDate.trim(), rescheduleTime.trim()) ?: false
                            // 2. Hide / delete from today's live queue so token no longer appears in current line
                            queueRepository?.removeOrCancelQueueEntry(appt.id)

                            if (ok) {
                                rescheduleMessage = "✓ Successfully rescheduled to $rescheduleDate at $rescheduleTime."
                                refreshData()
                                Toast.makeText(context, "Rescheduled to $rescheduleDate at $rescheduleTime. Removed from today's queue.", Toast.LENGTH_LONG).show()
                                delay(1200)
                                showRescheduleDialog = false
                            } else {
                                rescheduleMessage = "Error updating appointment. Please try again."
                            }
                            isProcessing = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0D5C4D)),
                    shape = RoundedCornerShape(10.dp),
                    enabled = !isProcessing
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text("Confirm Reschedule", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            },
            dismissButton = {
                TextButton(onClick = { showRescheduleDialog = false }) {
                    Text("Cancel", fontSize = 12.sp)
                }
            }
        )
    }

    // =========================================================================
    // MODAL DIALOG 3: IN-APP DIGITAL LAB REPORT VIEWER (PDF & PICTURE SUPPORT)
    // =========================================================================
    if (showLabReportDialog) {
        LaunchedEffect(appointment?.id) {
            val appt = appointment
            if (appt != null && labReports.isEmpty()) {
                try {
                    val reps = labReportRepository?.getLabReportsForAppointment(appt.id, appt.trackingCode10Digit) ?: emptyList()
                    if (reps.isNotEmpty()) {
                        labReports = reps
                    }
                } catch (ignored: Exception) {}
            }
        }

        AlertDialog(
            onDismissRequest = { showLabReportDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.Description, contentDescription = null, tint = Color(0xFF059669))
                    Text("Lab Report In-App Viewer", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFECFDF5),
                        border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("Laboratory Center: ${clinicName.ifBlank { "Diagnostic Lab" }}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF065F46))
                            Text("Patient: $rawPatientName • Code: $displayTrackingCode", fontSize = 10.sp, color = Color(0xFF047857))
                            if (!appointment?.selectedLabTests.isNullOrBlank()) {
                                Text("Tests: ${appointment!!.selectedLabTests}", fontSize = 10.sp, color = Color(0xFF047857))
                            }
                            Text("Status: Prepared & Verified", fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF059669))
                        }
                    }

                    Text("Prepared Reports & Uploaded Files:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF334155))

                    if (labReports.isNotEmpty()) {
                        labReports.forEach { rep ->
                            val hasRemoteFile = !rep.fileUrl.isNullOrBlank() &&
                                (rep.fileUrl.startsWith("http://") || rep.fileUrl.startsWith("https://"))
                            val isImg = rep.fileType?.contains("image", ignoreCase = true) == true ||
                                rep.fileUrl?.endsWith(".jpg", true) == true ||
                                rep.fileUrl?.endsWith(".jpeg", true) == true ||
                                rep.fileUrl?.endsWith(".png", true) == true ||
                                rep.fileUrl?.endsWith(".webp", true) == true

                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFFF8FAFC),
                                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(10.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(rep.testName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                                            Text(
                                                text = if (!rep.fileName.isNullOrBlank()) "File: ${rep.fileName}" else "Digital Pathology Summary",
                                                fontSize = 10.sp,
                                                color = Color(0xFF64748B)
                                            )
                                        }
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = if (rep.stage == "prepared") Color(0xFFD1FAE5) else Color(0xFFFEF3C7)
                                        ) {
                                            Text(
                                                text = if (rep.stage == "prepared") "PREPARED" else "PROCESSING",
                                                fontSize = 9.5.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = if (rep.stage == "prepared") Color(0xFF065F46) else Color(0xFF92400E),
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    // In-app picture preview if the clinic uploaded an image/photo of the report
                                    if (hasRemoteFile && isImg) {
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            border = BorderStroke(1.dp, Color(0xFFCBD5E1)),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            AsyncImage(
                                                model = rep.fileUrl,
                                                contentDescription = "Uploaded Lab Report Image",
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .heightIn(min = 180.dp, max = 340.dp)
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(Color(0xFFE2E8F0)),
                                                contentScale = ContentScale.Fit
                                            )
                                        }
                                    }

                                    if (hasRemoteFile) {
                                        OutlinedButton(
                                            onClick = {
                                                com.dactor.patient.util.LabReportPdfDownloader.downloadAndSaveReportFile(
                                                    context = context,
                                                    report = rep,
                                                    patientName = rawPatientName.ifBlank { "Registered Patient" },
                                                    clinicName = clinicName.ifBlank { "Diagnostic Lab" },
                                                    doctorName = doctorName.ifBlank { "Pathologist" }
                                                )
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            border = BorderStroke(1.dp, Color(0xFF059669)),
                                            modifier = Modifier.fillMaxWidth().height(36.dp),
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (isImg) Icons.Default.Image else Icons.Default.PictureAsPdf,
                                                contentDescription = null,
                                                tint = Color(0xFF059669),
                                                modifier = Modifier.size(14.dp)
                                            )
                                            Spacer(Modifier.width(6.dp))
                                            Text(
                                                text = if (isImg) "Download Report Picture" else "Open / Download Uploaded PDF",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF059669)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFF8FAFC),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Your diagnostic test status is marked Prepared by the laboratory. However, no digital report file (picture or PDF) has been uploaded yet by the clinic. Please collect your physical report from the clinic reception.",
                                fontSize = 11.sp,
                                color = Color(0xFF334155),
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                val hasAnyUploadedFile = labReports.any { !it.fileUrl.isNullOrBlank() }
                if (hasAnyUploadedFile) {
                    Button(
                        onClick = {
                            triggerDirectReportDownload()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.FileDownload, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Download File", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showLabReportDialog = false }) {
                    Text("Close", fontSize = 12.sp)
                }
            }
        )
    }

    // =========================================================================
    // MODAL DIALOG 4: PRESCRIPTION & DOCTOR'S CLINICAL REMARKS VIEWER
    // =========================================================================
    if (showPrescriptionDialog) {
        AlertDialog(
            onDismissRequest = { showPrescriptionDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = Color(0xFF2563EB))
                    Text("Prescription & Remarks", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFF0FDF4),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("Attending Doctor: ${doctorName.ifBlank { "Doctor" }}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF065F46))
                            Text("Specialty: ${doctorSpecialty.ifBlank { "OPD" }}", fontSize = 11.sp, color = Color(0xFF047857))
                            Text("Clinic: ${clinicName.ifBlank { "Clinic" }}", fontSize = 11.sp, color = Color(0xFF047857))
                        }
                    }

                    Text("Doctor's Diagnosis & Notes:", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFFF8FAFC),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = clinicalRemarks?.ifBlank { null }
                                ?: "No doctor's clinical remarks or prescription entered for this consultation yet.",
                            fontSize = 11.sp,
                            lineHeight = 16.sp,
                            color = if (clinicalRemarks.isNullOrBlank()) Color(0xFF64748B) else Color(0xFF1E293B),
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showPrescriptionDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("Close", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        )
    }
}
