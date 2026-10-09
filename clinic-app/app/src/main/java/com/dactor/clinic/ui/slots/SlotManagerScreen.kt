package com.dactor.clinic.ui.slots

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.dactor.clinic.domain.util.DateTimePickers
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.ui.navigation.NavRoutes
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.model.Slot
import com.dactor.clinic.data.repository.DoctorRepository
import com.dactor.clinic.data.repository.SlotRepository
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SlotManagerScreen(
    navController: NavController,
    clinicId: String = "",
    slotRepository: SlotRepository? = null,
    doctorRepository: DoctorRepository? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else com.dactor.clinic.data.local.UserSessionManager(context).getSavedClinicId() ?: ""
    }

    val today = LocalDate.now().toString()
    var selectedDate by remember { mutableStateOf(today) }

    var doctors by remember { mutableStateOf<List<Doctor>>(emptyList()) }
    var selectedDoctor by remember { mutableStateOf<Doctor?>(null) }
    var startTime by remember { mutableStateOf("09:00") }
    var endTime by remember { mutableStateOf("09:15") }
    var capacity by remember { mutableStateOf("5") }

    var slots by remember { mutableStateOf<List<Slot>>(emptyList()) }
    var showAddDialog by remember { mutableStateOf(false) }
    var slotToDelete by remember { mutableStateOf<Slot?>(null) }
    var slotToEditCapacity by remember { mutableStateOf<Slot?>(null) }
    var newCapacityInput by remember { mutableStateOf("") }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(effectiveClinicId, selectedDate) {
        if (doctorRepository != null) {
            val remoteDocs = doctorRepository.getDoctorsByClinic(effectiveClinicId)
            doctors = remoteDocs
            if (selectedDoctor == null || !remoteDocs.contains(selectedDoctor)) {
                selectedDoctor = remoteDocs.firstOrNull()
            }
        }
        if (slotRepository != null && effectiveClinicId.isNotBlank()) {
            val remoteSlots = slotRepository.getSlots(effectiveClinicId, selectedDate)
            slots = remoteSlots
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Slot Publishing & Schedule", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = {
                    if (doctors.isEmpty()) {
                        navController.navigate(NavRoutes.InvitationManager)
                    } else {
                        showAddDialog = true
                    }
                },
                icon = { Icon(if (doctors.isEmpty()) Icons.Default.GroupAdd else Icons.Default.Add, contentDescription = null) },
                text = { Text(if (doctors.isEmpty()) "Invite Doctor to Add Slots" else "Publish Slot") },
                shape = RoundedCornerShape(16.dp),
                containerColor = if (doctors.isEmpty()) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.primaryContainer
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
                text = "Create timed availability windows for doctors. Once published, slots become immediately available for patient booking in the Patient App.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 10.dp)
            )

            // ACTION FEEDBACK BANNER
            if (actionMessage != null) {
                Card(
                    shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFD1FAE5)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                            .fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(16.dp))
                            Text(actionMessage ?: "", fontSize = 12.sp, color = Color(0xFF065F46), fontWeight = FontWeight.SemiBold)
                        }
                        IconButton(onClick = { actionMessage = null }, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = Color(0xFF065F46), modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }
            if (doctors.isEmpty()) {
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                    border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFFD97706))
                            Text("No Affiliated Doctors Yet", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF92400E))
                        }
                        Text(
                            text = "You can only publish timed appointment slots for doctors who have accepted your clinic invitation. Send an invitation to a registered doctor and wait for them to accept before publishing slots.",
                            fontSize = 12.sp,
                            color = Color(0xFF78350F)
                        )
                        Button(
                            onClick = { navController.navigate(NavRoutes.InvitationManager) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.GroupAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Send Doctor Invitation", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Date Navigator Tabs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedDate == today,
                    onClick = { selectedDate = today },
                    label = { Text("Today ($today)") }
                )
                val tomorrow = LocalDate.now().plusDays(1).toString()
                FilterChip(
                    selected = selectedDate == tomorrow,
                    onClick = { selectedDate = tomorrow },
                    label = { Text("Tomorrow ($tomorrow)") }
                )
                FilterChip(
                    selected = selectedDate != today && selectedDate != tomorrow,
                    onClick = {
                        DateTimePickers.showDatePicker(context, selectedDate) { picked ->
                            selectedDate = picked
                        }
                    },
                    leadingIcon = { Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(14.dp)) },
                    label = { Text(if (selectedDate != today && selectedDate != tomorrow) selectedDate else "Pick Date") }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Slots List
            val currentSlots = slots.filter { it.slotDate == selectedDate }
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 80.dp)
            ) {
                if (currentSlots.isEmpty()) {
                    item {
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 16.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .padding(24.dp)
                                    .fillMaxWidth(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(Icons.Default.EventBusy, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(46.dp))
                                Text("No Slots Published for $selectedDate", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text(
                                    "There are no scheduled consultation slots for this date yet. Tap '+ Publish Slot' to open booking time windows for patients.",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                                Button(
                                    onClick = {
                                        if (doctors.isEmpty()) {
                                            navController.navigate(NavRoutes.InvitationManager)
                                        } else {
                                            showAddDialog = true
                                        }
                                    },
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Icon(if (doctors.isEmpty()) Icons.Default.GroupAdd else Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(if (doctors.isEmpty()) "Invite Doctor First" else "Publish Slot for this Date", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                } else {
                    items(currentSlots, key = { it.id }) { slot ->
                        val doctor = doctors.find { it.id == slot.doctorId }
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
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
                                            shape = RoundedCornerShape(8.dp),
                                            color = MaterialTheme.colorScheme.primaryContainer,
                                            modifier = Modifier.size(38.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(Icons.Default.Schedule, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                                            }
                                        }
                                        Column {
                                            Text(
                                                text = "${slot.startTime} - ${slot.endTime}",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 16.sp,
                                                color = MaterialTheme.colorScheme.onSurface
                                            )
                                            Text(
                                                text = doctor?.fullName ?: "Doctor ${slot.doctorId}",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = Color(0xFFD1FAE5)
                                    ) {
                                        Text(
                                            text = "Published",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF065F46),
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }

                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    val remaining = (slot.maxCapacity - slot.bookedCount).coerceAtLeast(0)
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "Registered: ${slot.bookedCount} / ${slot.maxCapacity} patients",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = "$remaining seats remaining",
                                            fontSize = 11.sp,
                                            color = if (slot.bookedCount >= slot.maxCapacity) MaterialTheme.colorScheme.error else Color(0xFF059669),
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }

                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedButton(
                                            onClick = {
                                                slotToEditCapacity = slot
                                                newCapacityInput = slot.maxCapacity.toString()
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                            modifier = Modifier.height(34.dp)
                                        ) {
                                            Icon(Icons.Default.PeopleAlt, contentDescription = "Edit Capacity", modifier = Modifier.size(14.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Edit Capacity", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }

                                        OutlinedButton(
                                            onClick = { slotToDelete = slot },
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                            modifier = Modifier.height(34.dp)
                                        ) {
                                            Icon(Icons.Default.Delete, contentDescription = "Remove Slot", modifier = Modifier.size(14.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Remove", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Publish Slot Dialog
        if (showAddDialog) {
            if (doctors.isEmpty()) {
                AlertDialog(
                    onDismissRequest = { showAddDialog = false },
                    title = { Text("Slot Publishing Locked", fontWeight = FontWeight.Bold) },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                "Cannot publish slots: No doctor has accepted an invitation to your clinic yet.",
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                "Slots can only be scheduled for doctors officially affiliated with your clinic roster. Please invite doctors and ensure they accept the invitation from their Doctor Portal.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                showAddDialog = false
                                navController.navigate(NavRoutes.InvitationManager)
                            }
                        ) {
                            Icon(Icons.Default.GroupAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Go to Staff Invites")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showAddDialog = false }) {
                            Text("Cancel")
                        }
                    }
                )
            } else {
                AlertDialog(
                    onDismissRequest = { showAddDialog = false },
                    title = { Text("Publish New Timed Slot", fontWeight = FontWeight.Bold) },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Select Doctor", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                doctors.forEach { doc ->
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        RadioButton(
                                            selected = selectedDoctor?.id == doc.id,
                                            onClick = { selectedDoctor = doc }
                                        )
                                        Text("${doc.fullName} (${doc.specialty ?: "General"})", fontSize = 13.sp)
                                    }
                                }
                            }

                            // Clock Time Pickers
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                OutlinedTextField(
                                    value = startTime,
                                    onValueChange = { startTime = it },
                                    label = { Text("Start Time") },
                                    trailingIcon = {
                                        IconButton(onClick = {
                                            DateTimePickers.showClockTimePicker(context, startTime) { picked ->
                                                startTime = picked
                                                endTime = DateTimePickers.addMinutesToTime(picked, 15)
                                            }
                                        }) {
                                            Icon(Icons.Default.Schedule, contentDescription = "Pick Clock Time", tint = MaterialTheme.colorScheme.primary)
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp)
                                )
                                OutlinedTextField(
                                    value = endTime,
                                    onValueChange = { endTime = it },
                                    label = { Text("End Time") },
                                    trailingIcon = {
                                        IconButton(onClick = {
                                            DateTimePickers.showClockTimePicker(context, endTime) { picked ->
                                                endTime = picked
                                            }
                                        }) {
                                            Icon(Icons.Default.Schedule, contentDescription = "Pick Clock Time", tint = MaterialTheme.colorScheme.primary)
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(10.dp)
                                )
                            }

                            // Quick Time Interval Selector
                            Text("Slot Duration Interval:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                listOf(10, 15, 20, 30).forEach { mins ->
                                    FilterChip(
                                        selected = false,
                                        onClick = {
                                            endTime = DateTimePickers.addMinutesToTime(startTime, mins)
                                        },
                                        label = { Text("+$mins min", fontSize = 11.sp) }
                                    )
                                }
                            }

                            OutlinedTextField(
                                value = capacity,
                                onValueChange = { capacity = it },
                                label = { Text("Patient Capacity for Slot") },
                                placeholder = { Text("5") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp)
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                val capVal = capacity.toIntOrNull() ?: 5
                                val doc = selectedDoctor ?: doctors.firstOrNull()
                                if (doc != null && startTime.isNotBlank() && endTime.isNotBlank()) {
                                    val newSlot = Slot(
                                        id = UUID.randomUUID().toString(),
                                        clinicId = effectiveClinicId,
                                        doctorId = doc.id,
                                        slotDate = selectedDate,
                                        startTime = startTime.trim(),
                                        endTime = endTime.trim(),
                                        maxCapacity = capVal,
                                        bookedCount = 0,
                                        isPublished = true
                                    )

                                    coroutineScope.launch {
                                        slotRepository?.createSlot(newSlot)
                                        slots = slots + newSlot
                                        showAddDialog = false
                                    }
                                }
                            }
                        ) {
                            Text("Publish Slot")
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showAddDialog = false }) {
                            Text("Cancel")
                        }
                    }
                )
            }
        }

        // Remove Slot Confirmation Dialog
        if (slotToDelete != null) {
            val target = slotToDelete!!
            val docName = doctors.find { it.id == target.doctorId }?.fullName ?: "Doctor"
            AlertDialog(
                onDismissRequest = { slotToDelete = null },
                icon = { Icon(Icons.Default.DeleteForever, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(32.dp)) },
                title = { Text("Remove Slot?", fontWeight = FontWeight.Bold) },
                text = {
                    Text(
                        "Are you sure you want to remove the slot for $docName (${target.startTime} - ${target.endTime}) on ${target.slotDate}?\n\nOnce removed, patients will no longer be able to book this time slot.",
                        fontSize = 13.sp
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val toRemove = target
                            slotToDelete = null
                            coroutineScope.launch {
                                val ok = slotRepository?.deleteSlot(toRemove.id) ?: false
                                if (ok) {
                                    slots = slots.filter { it.id != toRemove.id }
                                    actionMessage = "✓ Slot ${toRemove.startTime} - ${toRemove.endTime} removed successfully."
                                } else {
                                    actionMessage = "Failed to remove slot. Please try again."
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Yes, Remove Slot", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { slotToDelete = null }) {
                        Text("Cancel")
                    }
                }
            )
        }

        // Edit Capacity Dialog
        if (slotToEditCapacity != null) {
            val target = slotToEditCapacity!!
            AlertDialog(
                onDismissRequest = { slotToEditCapacity = null },
                icon = { Icon(Icons.Default.PeopleAlt, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp)) },
                title = { Text("Edit Slot Patient Capacity", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "Update maximum patient bookings for this slot (${target.startTime} - ${target.endTime}) on ${target.slotDate}:",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                "Current Status: ${target.bookedCount} booked / ${target.maxCapacity} max capacity",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                        OutlinedTextField(
                            value = newCapacityInput,
                            onValueChange = { newCapacityInput = it },
                            label = { Text("New Maximum Patient Capacity") },
                            placeholder = { Text("e.g. 10") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        )
                        Text(
                            "Note: You can edit capacity even after publishing. Walk-in bookings are always permitted even if capacity is reached.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val capVal = newCapacityInput.trim().toIntOrNull()
                            if (capVal != null && capVal > 0) {
                                val toUpdate = target
                                slotToEditCapacity = null
                                coroutineScope.launch {
                                    val ok = slotRepository?.updateSlotCapacity(toUpdate.id, capVal) ?: false
                                    if (ok) {
                                        slots = slots.map { if (it.id == toUpdate.id) it.copy(maxCapacity = capVal) else it }
                                        actionMessage = "✓ Slot (${toUpdate.startTime} - ${toUpdate.endTime}) capacity updated to $capVal patients."
                                    } else {
                                        actionMessage = "Failed to update slot capacity. Please try again."
                                    }
                                }
                            }
                        }
                    ) {
                        Text("Save Capacity", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { slotToEditCapacity = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
