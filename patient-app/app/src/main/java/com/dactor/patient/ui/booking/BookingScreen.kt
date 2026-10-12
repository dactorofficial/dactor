package com.dactor.patient.ui.booking

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.dactor.patient.data.model.Clinic
import com.dactor.patient.data.model.Doctor
import com.dactor.patient.data.model.Slot
import com.dactor.patient.data.repository.AuthRepository
import com.dactor.patient.data.repository.ClinicRepository
import com.dactor.patient.data.repository.DoctorRepository
import com.dactor.patient.data.repository.SlotRepository
import com.dactor.patient.domain.util.CurrencyFormatter
import com.dactor.patient.ui.navigation.NavRoutes
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingScreen(
    navController: NavController,
    clinicId: String = "",
    initialDoctorId: String? = null,
    initialDate: String? = null,
    slotRepository: SlotRepository? = null,
    doctorRepository: DoctorRepository? = null,
    clinicRepository: ClinicRepository? = null,
    authRepository: AuthRepository? = null,
    sessionManager: com.dactor.patient.data.local.UserSessionManager? = null
) {
    val context = LocalContext.current
    val todayDate = remember { LocalDate.now() }
    val today = remember { todayDate.toString() }

    val pendingRedirect = remember(clinicId) {
        sessionManager?.getPendingBookingRedirect()?.takeIf { it.clinicId == clinicId }
    }

    val resolvedInitialDateStr = remember(pendingRedirect, initialDate, today) {
        (pendingRedirect?.selectedDate ?: initialDate?.takeIf { it.isNotBlank() } ?: today)
    }

    var viewedYearMonth by remember {
        val initDate = try { LocalDate.parse(resolvedInitialDateStr) } catch (e: Exception) { null } ?: todayDate
        mutableStateOf(YearMonth.from(initDate))
    }
    var selectedDate by remember {
        mutableStateOf(resolvedInitialDateStr)
    }

    val listState = rememberLazyListState()
    val dateListState = rememberLazyListState()

    val daysInMonth = remember(viewedYearMonth, todayDate) {
        val startDay = if (viewedYearMonth == YearMonth.from(todayDate)) todayDate.dayOfMonth else 1
        val totalDays = viewedYearMonth.lengthOfMonth()
        (startDay..totalDays).map { day -> viewedYearMonth.atDay(day) }
    }

    var clinic by remember { mutableStateOf<Clinic?>(null) }
    var doctors by remember { mutableStateOf<List<Doctor>>(emptyList()) }
    var selectedDoctor by remember { mutableStateOf<Doctor?>(null) }
    var slots by remember { mutableStateOf<List<Slot>>(emptyList()) }
    var selectedSlotId by remember { mutableStateOf<String?>(pendingRedirect?.selectedSlotId) }
    var isLoading by remember { mutableStateOf(true) }

    var showTransactionFailedBanner by remember {
        mutableStateOf(sessionManager?.consumeTransactionFailedBanner() == true)
    }
    var isNavigatingToForm by remember { mutableStateOf(false) }

    LaunchedEffect(showTransactionFailedBanner) {
        if (showTransactionFailedBanner) {
            kotlinx.coroutines.delay(2000L)
            showTransactionFailedBanner = false
        }
    }

    val isUserLoggedIn = sessionManager?.isLoggedIn() == true || (authRepository?.isLoggedIn() == true)

    LaunchedEffect(clinicId, initialDoctorId) {
        if (clinicId.isNotBlank()) {
            if (clinicRepository != null) {
                clinic = clinicRepository.getClinicById(clinicId, forceRefresh = true)
            }
            val targetDocId = pendingRedirect?.doctorId ?: initialDoctorId
            if (doctorRepository != null) {
                val docs = doctorRepository.getDoctors(clinicId).toMutableList()
                if (!targetDocId.isNullOrBlank() && docs.none { it.id == targetDocId }) {
                    val initDoc = doctorRepository.getDoctorById(targetDocId)
                    if (initDoc != null) {
                        docs.add(0, initDoc)
                    }
                }
                doctors = docs
                selectedDoctor = if (!targetDocId.isNullOrBlank()) {
                    docs.firstOrNull { it.id == targetDocId } ?: docs.firstOrNull()
                } else {
                    docs.firstOrNull()
                }
            }
            if (slotRepository != null) {
                val available = slotRepository.getAvailableSlots(clinicId, selectedDate)
                    .filter { it.isPublished && !SlotRepository.isSlotEndTimeOver(it.endTime, selectedDate, it.startTime) }
                slots = available
            }
        }
        isLoading = false

        // Restore exact scroll position if returning from login redirect
        if (pendingRedirect != null) {
            try {
                listState.scrollToItem(pendingRedirect.scrollIndex, pendingRedirect.scrollOffset)
            } catch (ignored: Exception) {}
            sessionManager?.clearPendingBookingRedirect()
        }
    }

    LaunchedEffect(selectedDate, selectedDoctor) {
        if (clinicRepository != null && clinicId.isNotBlank()) {
            clinic = clinicRepository.getClinicById(clinicId, forceRefresh = true) ?: clinic
        }
        if (slotRepository != null && clinicId.isNotBlank()) {
            val isClosedHoliday = clinic?.isHolidayOnDate(selectedDate) == true
            if (isClosedHoliday) {
                slots = emptyList()
                selectedSlotId = null
            } else {
                val available = slotRepository.getAvailableSlots(clinicId, selectedDate)
                    .filter { it.isPublished && !SlotRepository.isSlotEndTimeOver(it.endTime, selectedDate, it.startTime) }
                val filtered = if (selectedDoctor != null) {
                    val docMatches = available.filter { it.doctorId == selectedDoctor?.id }
                    docMatches.ifEmpty { available }
                } else {
                    available
                }
                slots = filtered

                // Preserve previously restored slotId if valid, else select first available published slot
                val currentMatch = filtered.firstOrNull { it.id == selectedSlotId && (it.maxCapacity - it.bookedCount) > 0 }
                val firstOpen = filtered.firstOrNull { (it.maxCapacity - it.bookedCount) > 0 }
                selectedSlotId = (currentMatch ?: firstOpen)?.id
            }
        }
    }

    val isLabClinic = remember(clinic) {
        val t = clinic?.type?.lowercase() ?: ""
        val n = clinic?.name?.lowercase() ?: ""
        t == "diagnostic_lab" || t.contains("lab") || n.contains("lab") ||
            (clinic?.specialties?.any { it.lowercase().contains("lab") || it.lowercase().contains("patholog") } == true)
    }

    val isDeclaredHolidayOnSelectedDate = remember(clinic, selectedDate) {
        clinic?.isHolidayOnDate(selectedDate) == true
    }
    val selectedDateSchedule = remember(clinic, selectedDate) {
        clinic?.getScheduleForDate(selectedDate) ?: com.dactor.patient.data.model.DayScheduleInfo(
            dayOfWeek = "TODAY",
            displayName = "Today",
            isOpen = true,
            openTime = "08:00 AM",
            closeTime = "05:00 PM",
            hasBreak = true,
            breakStart = "01:00 PM",
            breakEnd = "02:00 PM"
        )
    }
    val isClinicClosedOnSelectedDate = isDeclaredHolidayOnSelectedDate || !selectedDateSchedule.isOpen

    val activeDoctor = selectedDoctor ?: doctors.firstOrNull()
    val consultationFee = activeDoctor?.consultationFee ?: 500.0
    val selectedSlot = slots.firstOrNull { it.id == selectedSlotId }
    val canBookSelectedSlot = !isClinicClosedOnSelectedDate && (selectedSlot != null &&
        selectedSlot.isPublished &&
        (selectedSlot.maxCapacity - selectedSlot.bookedCount) > 0 &&
        !SlotRepository.isSlotEndTimeOver(selectedSlot.endTime, selectedDate, selectedSlot.startTime))

    fun redirectToLoginSavingPosition(slotIdToSave: String?) {
        val currentRoute = NavRoutes.Booking.createRoute(clinicId, activeDoctor?.id)
        sessionManager?.savePendingBookingRedirect(
            route = currentRoute,
            clinicId = clinicId,
            doctorId = activeDoctor?.id,
            selectedDate = selectedDate,
            selectedSlotId = slotIdToSave,
            scrollIndex = listState.firstVisibleItemIndex,
            scrollOffset = listState.firstVisibleItemScrollOffset
        )
        Toast.makeText(
            context,
            "Please sign in to book an appointment slot",
            Toast.LENGTH_SHORT
        ).show()
        navController.navigate(NavRoutes.Login.route)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(if (isLabClinic) "Book Lab Test Appointment" else "Book Appointment", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(
                            if (isLabClinic) "Select a time slot & choose diagnostic tests on next step"
                            else "Choose a doctor and select a published clinic slot",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 8.dp,
                shadowElevation = 8.dp,
                color = Color.White,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(modifier = Modifier.padding(16.dp)) {
                    Button(
                        onClick = {
                            if (isNavigatingToForm) return@Button
                            val chosenSlotId = selectedSlot?.id ?: if (isLabClinic) "synth__lab_$selectedDate" else null
                            val isUserLoggedIn = sessionManager?.isLoggedIn() == true || (authRepository?.isLoggedIn() == true)
                            if (!isUserLoggedIn) {
                                redirectToLoginSavingPosition(chosenSlotId)
                                return@Button
                            }
                            if (chosenSlotId == null) return@Button
                            isNavigatingToForm = true
                            navController.navigate(NavRoutes.BookingForm.createRoute(chosenSlotId, clinicId))
                        },
                        enabled = canBookSelectedSlot && !isNavigatingToForm,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF00796B),
                            disabledContainerColor = Color(0xFFCBD5E1),
                            disabledContentColor = Color(0xFF64748B)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                    ) {
                        Text(
                            text = if (!canBookSelectedSlot) {
                                "Select a Published Slot to Book"
                            } else if (isLabClinic) {
                                "Select Lab Tests & Book"
                            } else {
                                "Book Appointment"
                            },
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Spacer(Modifier.width(6.dp))
                        Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Color(0xFFF8FAFC)),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ── 0. TRANSACTION FAILED BANNER (Auto-dismisses in 2 seconds) ────
            if (showTransactionFailedBanner) {
                item {
                    androidx.compose.animation.AnimatedVisibility(visible = showTransactionFailedBanner) {
                        Surface(
                            color = Color(0xFFDC2626),
                            shape = RoundedCornerShape(12.dp),
                            shadowElevation = 3.dp,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                                Column {
                                    Text("Transaction Failed", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                                    Text("Payment was cancelled or expired. Please select a slot to try again.", color = Color.White.copy(alpha = 0.9f), fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
            // ── 1. DOCTOR SELECTOR ROW (If multiple doctors) ─────────────────
            if (doctors.size > 1) {
                item {
                    Text(
                        "Select Doctor from Clinic",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        color = Color(0xFF64748B)
                    )
                    Spacer(Modifier.height(6.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(doctors) { doc ->
                            val isCur = selectedDoctor?.id == doc.id
                            val cleanShortName = doc.fullName
                                .removePrefix("Dr.")
                                .removePrefix("dr.")
                                .trim()
                            FilterChip(
                                selected = isCur,
                                onClick = { selectedDoctor = doc },
                                label = { Text("Dr. $cleanShortName", fontSize = 12.sp) },
                                leadingIcon = if (isCur) {
                                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp)) }
                                } else null,
                                shape = RoundedCornerShape(16.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFF00796B),
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }
                }
            }

            // ── 2. DOCTOR CARD (Matches template with NO rating) ───────
            item {
                val cleanDocName = (activeDoctor?.fullName ?: "Attending Physician")
                    .removePrefix("Dr.")
                    .removePrefix("dr.")
                    .trim()
                    .ifBlank { "Attending Physician" }

                Card(
                    shape = RoundedCornerShape(18.dp),
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
                            verticalAlignment = Alignment.Top
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Doctor Avatar
                                if (!activeDoctor?.resolvedProfilePictureUrl.isNullOrBlank()) {
                                    AsyncImage(
                                        model = activeDoctor!!.resolvedProfilePictureUrl,
                                        contentDescription = cleanDocName,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier
                                            .size(62.dp)
                                            .clip(CircleShape)
                                    )
                                } else {
                                    Surface(
                                        shape = CircleShape,
                                        color = Color(0xFFE6F4F1),
                                        modifier = Modifier.size(62.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                Icons.Default.Person,
                                                contentDescription = null,
                                                tint = Color(0xFF00796B),
                                                modifier = Modifier.size(34.dp)
                                            )
                                        }
                                    }
                                }

                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(
                                        text = "Dr. $cleanDocName",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 17.sp,
                                        color = Color(0xFF0F172A)
                                    )
                                    Text(
                                        text = activeDoctor?.specialty ?: "General Physician",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color(0xFF00796B)
                                    )
                                    Text(
                                        text = activeDoctor?.education ?: "MBBS",
                                        fontSize = 11.sp,
                                        color = Color(0xFF64748B)
                                    )
                                }
                            }

                            // Selected Badge on top right
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0xFF00796B)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(13.dp))
                                    Text("Selected", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }

                        // Experience & Hospital affiliation
                        val expText = remember(activeDoctor?.startingPracticingYear) {
                            val startYear = activeDoctor?.startingPracticingYear
                            if (startYear != null && startYear in 1950..2026) {
                                val yrs = (java.time.Year.now().value - startYear).coerceAtLeast(1)
                                "$yrs+ yrs (Since $startYear)"
                            } else {
                                "Verified Specialist"
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.WorkOutline, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(16.dp))
                                Column {
                                    Text(expText, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF0F172A))
                                    Text("Experience", fontSize = 10.sp, color = Color(0xFF64748B))
                                }
                            }

                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Apartment, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(16.dp))
                                Column {
                                    Text(
                                        clinic?.name ?: "Partner Clinic",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = Color(0xFF0F172A),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        clinic?.addressText ?: "Nepal",
                                        fontSize = 10.sp,
                                        color = Color(0xFF64748B),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }

                        // Clinic Working Hours for Selected Date (Informational — Break hours only shown in queue/appt status)
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (isClinicClosedOnSelectedDate) Color(0xFFFEF2F2) else Color(0xFFF0FDF4),
                            border = BorderStroke(1.dp, if (isClinicClosedOnSelectedDate) Color(0xFFFCA5A5) else Color(0xFFBBF7D0)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            if (isClinicClosedOnSelectedDate) Icons.Default.EventBusy else Icons.Default.Schedule,
                                            contentDescription = null,
                                            tint = if (isClinicClosedOnSelectedDate) Color(0xFFDC2626) else Color(0xFF15803D),
                                            modifier = Modifier.size(15.dp)
                                        )
                                        Text(
                                            text = "Working Hours (${selectedDateSchedule.displayName}):",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = if (isClinicClosedOnSelectedDate) Color(0xFF991B1B) else Color(0xFF166534)
                                        )
                                    }
                                    Text(
                                        text = when {
                                            isDeclaredHolidayOnSelectedDate -> "Closed (Declared Holiday)"
                                            !selectedDateSchedule.isOpen -> "Closed (Weekly Off)"
                                            else -> "${selectedDateSchedule.openTime} – ${selectedDateSchedule.closeTime}"
                                        },
                                        fontSize = 11.5.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (isClinicClosedOnSelectedDate) Color(0xFFDC2626) else Color(0xFF15803D)
                                    )
                                }
                            }
                        }

                        HorizontalDivider(color = Color(0xFFF1F5F9))

                        // Consultation Fee (or Lab Test Pricing notice for Lab Clinics)
                        if (isLabClinic) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Diagnostic Test Charges", fontSize = 13.sp, color = Color(0xFF64748B), fontWeight = FontWeight.Medium)
                                Text(
                                    text = "Decided by Selected Reports",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    color = Color(0xFF00796B)
                                )
                            }
                        } else {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Consultation Fee", fontSize = 13.sp, color = Color(0xFF64748B), fontWeight = FontWeight.Medium)
                                Text(
                                    text = CurrencyFormatter.formatNPR(consultationFee),
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 17.sp,
                                    color = Color(0xFF00796B)
                                )
                            }
                        }
                    }
                }
            }

            // ── 3. SELECT DATE SECTION (Fixed height so month "Oct" is never clipped) ──
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.CalendarToday, contentDescription = null, tint = Color(0xFF00796B), modifier = Modifier.size(18.dp))
                    Text("Select Date", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF0F172A))
                }
                Spacer(Modifier.height(10.dp))

                LazyRow(
                    state = dateListState,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(daysInMonth, key = { it.toString() }) { date ->
                        val dateStr = date.toString()
                        val isSelected = (selectedDate == dateStr)
                        val isDayHoliday = clinic?.isHolidayOnDate(dateStr) == true
                        val dayOfWeekStr = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                        val monthName = date.month.getDisplayName(TextStyle.SHORT, Locale.ENGLISH)

                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = when {
                                isSelected && isDayHoliday -> Color(0xFFDC2626)
                                isSelected -> Color(0xFF00796B)
                                isDayHoliday -> Color(0xFFFEF2F2)
                                else -> Color.White
                            },
                            border = BorderStroke(
                                1.dp,
                                when {
                                    isSelected && isDayHoliday -> Color(0xFFDC2626)
                                    isSelected -> Color(0xFF00796B)
                                    isDayHoliday -> Color(0xFFFCA5A5)
                                    else -> Color(0xFFE2E8F0)
                                }
                            ),
                            shadowElevation = if (isSelected) 3.dp else 0.dp,
                            modifier = Modifier
                                .width(66.dp)
                                .defaultMinSize(minHeight = 96.dp)
                                .clickable { selectedDate = dateStr }
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = dayOfWeekStr,
                                    fontSize = 12.sp,
                                    lineHeight = 14.sp,
                                    fontWeight = if (isSelected || isDayHoliday) FontWeight.Bold else FontWeight.Medium,
                                    color = when {
                                        isSelected -> Color.White.copy(alpha = 0.92f)
                                        isDayHoliday -> Color(0xFFDC2626)
                                        else -> Color(0xFF64748B)
                                    }
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = "${date.dayOfMonth}",
                                    fontSize = 20.sp,
                                    lineHeight = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = when {
                                        isSelected -> Color.White
                                        isDayHoliday -> Color(0xFFB91C1C)
                                        else -> Color(0xFF0F172A)
                                    }
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = if (isDayHoliday) "Closed" else monthName,
                                    fontSize = 10.sp,
                                    lineHeight = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = when {
                                        isSelected -> Color.White.copy(alpha = 0.9f)
                                        isDayHoliday -> Color(0xFFDC2626)
                                        else -> Color(0xFF64748B)
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // ── 4. SELECT PUBLISHED TIME SLOT SECTION (Only clinic-published slots!) ──
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.AccessTime, contentDescription = null, tint = Color(0xFF00796B), modifier = Modifier.size(18.dp))
                    Text("Select Published Time Slot", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF0F172A))
                }
                Spacer(Modifier.height(10.dp))

                if (isClinicClosedOnSelectedDate) {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
                        border = BorderStroke(1.dp, Color(0xFFFCA5A5)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFFEE2E2),
                                modifier = Modifier.size(52.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.EventBusy,
                                        contentDescription = null,
                                        tint = Color(0xFFDC2626),
                                        modifier = Modifier.size(26.dp)
                                    )
                                }
                            }
                            Text(
                                text = if (isDeclaredHolidayOnSelectedDate) "Clinic is Closed on $selectedDate (Holiday)" else "Clinic is Closed on $selectedDate",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = Color(0xFF991B1B),
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = "The clinic is declared closed on this day. Appointments cannot be booked for this date. Please select another open date above.",
                                fontSize = 12.sp,
                                color = Color(0xFFB91C1C),
                                textAlign = TextAlign.Center,
                                lineHeight = 17.sp
                            )
                        }
                    }
                } else if (slots.isEmpty()) {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFE6F4F1),
                                modifier = Modifier.size(48.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.EventBusy,
                                        contentDescription = null,
                                        tint = Color(0xFF00796B),
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }
                            Text(
                                text = "No Published Slots for $selectedDate",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = "Appointments can only be booked into time slots published by the clinic. Please select another date above or check back once the clinic publishes slots.",
                                fontSize = 12.sp,
                                color = Color(0xFF64748B),
                                textAlign = TextAlign.Center,
                                lineHeight = 17.sp
                            )
                        }
                    }
                } else {
                    // Grid layout of strictly clinic-published slots (2 columns for clear time + capacity display)
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        slots.chunked(2).forEach { rowSlots ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                rowSlots.forEach { slot ->
                                    val isChosen = selectedSlotId == slot.id
                                    val spotsLeft = (slot.maxCapacity - slot.bookedCount).coerceAtLeast(0)
                                    val isFull = spotsLeft <= 0
                                    val timeLabel = if (slot.endTime.isNotBlank() && slot.endTime != slot.startTime) {
                                        "${slot.startTime} - ${slot.endTime}"
                                    } else {
                                        slot.startTime
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = when {
                                            isFull -> Color(0xFFF1F5F9)
                                            isChosen -> Color(0xFF00796B)
                                            else -> Color.White
                                        },
                                        border = BorderStroke(
                                            1.dp,
                                            when {
                                                isFull -> Color(0xFFCBD5E1)
                                                isChosen -> Color(0xFF00796B)
                                                else -> Color(0xFFE2E8F0)
                                            }
                                        ),
                                        modifier = Modifier
                                            .weight(1f)
                                            .defaultMinSize(minHeight = 60.dp)
                                            .clickable(enabled = !isFull) {
                                                if (!isUserLoggedIn) {
                                                    redirectToLoginSavingPosition(slot.id)
                                                } else {
                                                    selectedSlotId = slot.id
                                                }
                                            }
                                    ) {
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.Center,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp)
                                        ) {
                                            Text(
                                                text = timeLabel,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp,
                                                color = when {
                                                    isFull -> Color(0xFF94A3B8)
                                                    isChosen -> Color.White
                                                    else -> Color(0xFF0F172A)
                                                },
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Spacer(Modifier.height(2.dp))
                                            Text(
                                                text = if (isFull) "Slot Full" else "$spotsLeft spots available",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = when {
                                                    isFull -> Color(0xFFEF4444)
                                                    isChosen -> Color(0xFFCCFBF1)
                                                    else -> Color(0xFF00796B)
                                                }
                                            )
                                        }
                                    }
                                }
                                repeat(2 - rowSlots.size) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
