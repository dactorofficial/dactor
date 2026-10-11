package com.dactor.clinic.ui.appointments

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
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.local.UserSessionManager
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.repository.AppointmentRepository
import com.dactor.clinic.data.repository.DoctorRepository
import com.dactor.clinic.data.repository.QueueRepository
import com.dactor.clinic.ui.navigation.NavRoutes
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoShowManagerScreen(
    navController: NavController,
    clinicId: String = "",
    appointmentRepository: AppointmentRepository? = null,
    doctorRepository: DoctorRepository? = null,
    queueRepository: QueueRepository? = null
) {
    val context = LocalContext.current
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else UserSessionManager(context).getSavedClinicId() ?: ""
    }

    val coroutineScope = rememberCoroutineScope()
    val today = remember { LocalDate.now() }
    val todayStr = remember(today) { today.toString() }

    var selectedDate by remember { mutableStateOf(today.minusDays(1).toString()) }
    var displayedMonth by remember { mutableStateOf(YearMonth.from(today)) }
    var allAppointments by remember(effectiveClinicId) { mutableStateOf<List<Appointment>>(emptyList()) }
    var doctors by remember(effectiveClinicId) { mutableStateOf<List<Doctor>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var actionBanner by remember { mutableStateOf<String?>(null) }

    // Reschedule dialog state
    var selectedApptForReschedule by remember { mutableStateOf<Appointment?>(null) }
    var newDateInput by remember { mutableStateOf(today.plusDays(1).toString()) }
    var newTimeInput by remember { mutableStateOf("10:00") }
    var isRescheduling by remember { mutableStateOf(false) }

    suspend fun loadData() {
        if (effectiveClinicId.isNotBlank()) {
            isLoading = true
            val appts = appointmentRepository?.getAppointmentsByClinic(effectiveClinicId) ?: emptyList()

            // Automatically check and transfer any past-day uncompleted appointments to 'no_show'
            appts.forEach { appt ->
                val isPastDate = appt.appointmentDate < todayStr
                val isUnfinished = appt.checkinStatus != "completed" && appt.checkinStatus != "cancelled"
                if (isPastDate && isUnfinished) {
                    try {
                        queueRepository?.updateQueueStatus(appt.id, "no_show", effectiveClinicId)
                    } catch (ignored: Exception) {}
                }
            }

            // Reload fresh after retroactive sync
            val freshAppts = appointmentRepository?.getAppointmentsByClinic(effectiveClinicId) ?: appts
            allAppointments = freshAppts

            if (doctorRepository != null) {
                doctors = doctorRepository.getDoctorsByClinic(effectiveClinicId)
            }
            isLoading = false
        }
    }

    LaunchedEffect(effectiveClinicId) {
        loadData()
    }

    // Days in current calendar strip
    val daysInMonth = remember(displayedMonth) {
        val numDays = displayedMonth.lengthOfMonth()
        (1..numDays).map { day -> displayedMonth.atDay(day) }
    }

    val monthFormatter = remember { DateTimeFormatter.ofPattern("MMMM yyyy") }
    val dayNameFormatter = remember { DateTimeFormatter.ofPattern("EEE") }

    // Filter appointments for selected date that are marked as no-show or expired past day
    val noShowPatientsForDate = remember(allAppointments, selectedDate, searchQuery) {
        allAppointments.filter { appt ->
            val matchesDate = appt.appointmentDate == selectedDate
            val isNoShowOrPastUnfinished = (appt.checkinStatus == "cancelled" || appt.checkinStatus == "no_show") ||
                    (appt.appointmentDate < todayStr && appt.checkinStatus != "completed")
            val matchesQuery = searchQuery.isBlank() ||
                    appt.patientName.contains(searchQuery, ignoreCase = true) ||
                    appt.patientMobile.contains(searchQuery) ||
                    appt.trackingCode10Digit.contains(searchQuery)
            matchesDate && isNoShowOrPastUnfinished && matchesQuery
        }
    }

    // Total no-show count across all dates for stats
    val totalNoShowCount = remember(allAppointments) {
        allAppointments.count {
            it.checkinStatus == "cancelled" || it.checkinStatus == "no_show" ||
                    (it.appointmentDate < todayStr && it.checkinStatus != "completed")
        }
    }

    Scaffold(
        containerColor = Color(0xFFF8FAFC),
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFFDC2626),
                                modifier = Modifier.size(30.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        Icons.Default.EventBusy,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                            Text(
                                "No-Show Patients Manager",
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp,
                                color = Color(0xFF0F172A)
                            )
                        }
                        Text(
                            "Audit past-day missed appointments & arrange new dates",
                            fontSize = 11.sp,
                            color = Color(0xFF64748B)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color(0xFF0F172A))
                    }
                },
                actions = {
                    IconButton(onClick = { coroutineScope.launch { loadData() } }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Color(0xFF0F172A))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            // Action / Success Banner
            if (actionBanner != null) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFDCFCE7),
                    border = BorderStroke(1.dp, Color(0xFF86EFAC)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF16A34A), modifier = Modifier.size(18.dp))
                            Text(actionBanner ?: "", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF166534))
                        }
                        IconButton(onClick = { actionBanner = null }, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFF166534), modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }

            // Summary Stat Cards
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Card 1: Selected Date Missed
                Surface(
                    color = Color(0xFFFEF2F2),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFFFECACA)),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "${noShowPatientsForDate.size}",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 24.sp,
                            color = Color(0xFFDC2626)
                        )
                        Text(
                            text = "Missed on $selectedDate",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF991B1B)
                        )
                    }
                }

                // Card 2: Total Recorded No-Shows
                Surface(
                    color = Color(0xFFFFFBEB),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "$totalNoShowCount",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 24.sp,
                            color = Color(0xFFD97706)
                        )
                        Text(
                            text = "Total Missed Visits",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF92400E)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Calendar Month Navigation & Date Strip
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    // Month selector row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { displayedMonth = displayedMonth.minusMonths(1) }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Prev Month", tint = Color(0xFF475569))
                        }
                        Text(
                            text = displayedMonth.format(monthFormatter),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF0F172A)
                        )
                        IconButton(onClick = { displayedMonth = displayedMonth.plusMonths(1) }) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "Next Month", tint = Color(0xFF475569))
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    // Horizontal Days Strip
                    val dayListState = rememberLazyListState()
                    LazyRow(
                        state = dayListState,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(daysInMonth) { dayDate ->
                            val dateStr = dayDate.toString()
                            val isSelected = selectedDate == dateStr
                            val isPast = dayDate.isBefore(today)
                            val isToday = dayDate.isEqual(today)

                            val noShowCountForDay = allAppointments.count {
                                it.appointmentDate == dateStr &&
                                        (it.checkinStatus == "cancelled" || it.checkinStatus == "no_show" ||
                                                (dateStr < todayStr && it.checkinStatus != "completed"))
                            }

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = when {
                                    isSelected -> Color(0xFFDC2626)
                                    isToday -> Color(0xFFEFF6FF)
                                    else -> Color(0xFFF8FAFC)
                                },
                                border = BorderStroke(
                                    1.dp,
                                    when {
                                        isSelected -> Color(0xFFDC2626)
                                        isToday -> Color(0xFF93C5FD)
                                        else -> Color(0xFFE2E8F0)
                                    }
                                ),
                                modifier = Modifier
                                    .width(54.dp)
                                    .clickable { selectedDate = dateStr }
                            ) {
                                Column(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(2.dp)
                                ) {
                                    Text(
                                        text = dayDate.format(dayNameFormatter).uppercase(),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (isSelected) Color.White.copy(alpha = 0.8f) else Color(0xFF64748B)
                                    )
                                    Text(
                                        text = "${dayDate.dayOfMonth}",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (isSelected) Color.White else Color(0xFF0F172A)
                                    )
                                    if (noShowCountForDay > 0) {
                                        Surface(
                                            shape = CircleShape,
                                            color = if (isSelected) Color.White else Color(0xFFFCA5A5),
                                            modifier = Modifier.size(16.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Text(
                                                    text = "$noShowCountForDay",
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isSelected) Color(0xFFDC2626) else Color(0xFF991B1B)
                                                )
                                            }
                                        }
                                    } else {
                                        Spacer(Modifier.height(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Search patient name, mobile, or code") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF64748B)) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Patients List
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFFDC2626))
                }
            } else if (noShowPatientsForDate.isEmpty()) {
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
                            Icons.Default.CheckCircleOutline,
                            contentDescription = null,
                            tint = Color(0xFF16A34A),
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "No Missed Patients on $selectedDate",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            text = "All scheduled patients either attended consultation or no missed bookings occurred on this day.",
                            fontSize = 12.sp,
                            color = Color(0xFF64748B),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 24.dp)
                        )
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 32.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(noShowPatientsForDate, key = { it.id }) { appt ->
                        val assignedDoctor = doctors.find { it.id == appt.doctorId }
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
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
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Surface(
                                            shape = CircleShape,
                                            color = Color(0xFFFEE2E2),
                                            modifier = Modifier.size(44.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(
                                                    Icons.Default.PersonOff,
                                                    contentDescription = null,
                                                    tint = Color(0xFFDC2626),
                                                    modifier = Modifier.size(24.dp)
                                                )
                                            }
                                        }

                                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                            Text(
                                                text = appt.patientName,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 15.sp,
                                                color = Color(0xFF0F172A)
                                            )
                                            val demoList = buildList {
                                                if ((appt.patientAge ?: 0) > 0) add("${appt.patientAge} yrs")
                                                if (!appt.patientGender.isNullOrBlank()) add(appt.patientGender)
                                                if (appt.patientMobile.isNotBlank()) add(appt.patientMobile)
                                            }
                                            if (demoList.isNotEmpty()) {
                                                Text(
                                                    text = demoList.joinToString(" • "),
                                                    fontSize = 11.5.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = Color(0xFF0284C7)
                                                )
                                            }
                                            Text(
                                                text = "Code: ${appt.trackingCode10Digit} • Slot: ${appt.appointmentTime}",
                                                fontSize = 11.sp,
                                                color = Color(0xFF64748B)
                                            )
                                        }
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color(0xFFFEF2F2),
                                        border = BorderStroke(1.dp, Color(0xFFFECACA))
                                    ) {
                                        Text(
                                            text = "No Show",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 11.5.sp,
                                            color = Color(0xFFDC2626),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                }

                                if (assignedDoctor != null) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color(0xFFF8FAFC),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = "Doctor: Dr. ${assignedDoctor.fullName.removePrefix("Dr. ").removePrefix("Dr.")} (${assignedDoctor.specialty ?: "General"})",
                                            fontSize = 11.sp,
                                            color = Color(0xFF475569),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                        )
                                    }
                                }

                                // Reschedule / Arrange New Date Button
                                Button(
                                    onClick = {
                                        selectedApptForReschedule = appt
                                        newDateInput = today.plusDays(1).toString()
                                        newTimeInput = appt.appointmentTime.ifBlank { "10:00" }
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0097A7)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.EditCalendar, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color.White)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        "Arrange New Date & Time",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = Color.White
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Arrange New Date Modal Dialog
    if (selectedApptForReschedule != null) {
        val appt = selectedApptForReschedule!!
        AlertDialog(
            onDismissRequest = { if (!isRescheduling) selectedApptForReschedule = null },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.EventRepeat, contentDescription = null, tint = Color(0xFF0097A7))
                    Text("Arrange New Appointment Date", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Rescheduling missed visit for patient \"${appt.patientName}\" (${appt.trackingCode10Digit}). This will transfer the patient to the new appointment date.",
                        fontSize = 12.sp,
                        color = Color(0xFF475569)
                    )

                    OutlinedTextField(
                        value = newDateInput,
                        onValueChange = { newDateInput = it },
                        label = { Text("New Appointment Date (YYYY-MM-DD)") },
                        placeholder = { Text("e.g. ${today.plusDays(1)}") },
                        leadingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null) },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = newTimeInput,
                        onValueChange = { newTimeInput = it },
                        label = { Text("New Appointment Time (HH:mm)") },
                        placeholder = { Text("e.g. 10:30") },
                        leadingIcon = { Icon(Icons.Default.AccessTime, contentDescription = null) },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Quick Date Chips (Tomorrow, In 2 Days, Next Monday)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        SuggestionChip(
                            onClick = { newDateInput = today.plusDays(1).toString() },
                            label = { Text("Tomorrow", fontSize = 11.sp) }
                        )
                        SuggestionChip(
                            onClick = { newDateInput = today.plusDays(2).toString() },
                            label = { Text("+2 Days", fontSize = 11.sp) }
                        )
                        SuggestionChip(
                            onClick = { newDateInput = today.plusDays(7).toString() },
                            label = { Text("+1 Week", fontSize = 11.sp) }
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val cleanDate = newDateInput.trim()
                        val cleanTime = newTimeInput.trim()
                        if (cleanDate.length == 10 && cleanTime.isNotBlank()) {
                            isRescheduling = true
                            coroutineScope.launch {
                                // Reschedule appointment to new date & reset checkinStatus to confirmed
                                appointmentRepository?.rescheduleAppointment(
                                    id = appt.id,
                                    newDate = cleanDate,
                                    newTime = cleanTime,
                                    newSlotId = null
                                )
                                appointmentRepository?.updateCheckinStatus(appt.id, "confirmed")

                                isRescheduling = false
                                actionBanner = "✓ New date arranged for ${appt.patientName} on $cleanDate at $cleanTime!"
                                selectedApptForReschedule = null
                                loadData()
                            }
                        }
                    },
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0097A7)),
                    enabled = !isRescheduling && newDateInput.isNotBlank() && newTimeInput.isNotBlank()
                ) {
                    if (isRescheduling) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Confirm New Date", fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedApptForReschedule = null }, enabled = !isRescheduling) {
                    Text("Cancel")
                }
            }
        )
    }
}
