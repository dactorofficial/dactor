package com.dactor.clinic.ui.invitations

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.model.ClinicInvitation
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.model.Profile
import com.dactor.clinic.data.repository.AuthRepository
import com.dactor.clinic.data.repository.DoctorRepository
import com.dactor.clinic.data.repository.InvitationRepository
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvitationManagerScreen(
    navController: NavController,
    clinicId: String = "",
    invitationRepository: InvitationRepository? = null,
    doctorRepository: DoctorRepository? = null,
    authRepository: AuthRepository? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else com.dactor.clinic.data.local.UserSessionManager(context).getSavedClinicId() ?: ""
    }

    var selectedTab by remember { mutableIntStateOf(0) } // 0: Search & Enlisted Profiles, 1: Sent Invitations Status
    var selectedRoleFilter by remember { mutableStateOf("All") } // "All", "Doctors", "Lab Technicians"
    var searchQuery by remember { mutableStateOf("") }
    var submittedSearchQuery by remember { mutableStateOf("") }

    var registeredDoctors by remember { mutableStateOf<List<Doctor>>(emptyList()) }
    var labTechProfiles by remember { mutableStateOf<List<Profile>>(emptyList()) }
    var sentInvitations by remember { mutableStateOf<List<ClinicInvitation>>(emptyList()) }

    var isLoading by remember { mutableStateOf(true) }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    var isOperating by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    suspend fun loadData() {
        isLoading = true
        if (doctorRepository != null) {
            registeredDoctors = doctorRepository.getAllDoctors()
        }
        if (invitationRepository != null) {
            labTechProfiles = invitationRepository.getLabTechnicianProfiles()
            if (effectiveClinicId.isNotBlank()) {
                sentInvitations = invitationRepository.getInvitations(effectiveClinicId)
            }
        }
        isLoading = false
    }

    LaunchedEffect(effectiveClinicId) {
        loadData()
    }

    // Filtered doctor list based on search and role filter
    val filteredDoctors = remember(registeredDoctors, submittedSearchQuery, selectedRoleFilter) {
        if (selectedRoleFilter == "Lab Technicians") {
            emptyList()
        } else {
            val q = submittedSearchQuery.trim().lowercase()
            if (q.isBlank()) {
                registeredDoctors
            } else {
                registeredDoctors.filter { doc ->
                    doc.fullName.lowercase().contains(q) ||
                    (doc.specialty ?: "").lowercase().contains(q) ||
                    doc.email.lowercase().contains(q) ||
                    (doc.nmcLicenseNumber ?: "").lowercase().contains(q)
                }
            }
        }
    }

    // Filtered lab technician list
    val filteredLabTechs = remember(labTechProfiles, submittedSearchQuery, selectedRoleFilter) {
        if (selectedRoleFilter == "Doctors") {
            emptyList()
        } else {
            val q = submittedSearchQuery.trim().lowercase()
            if (q.isBlank()) {
                labTechProfiles
            } else {
                labTechProfiles.filter { tech ->
                    (tech.fullName ?: "").lowercase().contains(q) ||
                    tech.email.lowercase().contains(q)
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Doctor & Staff Invitations", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("Search profiles and invite directly to accounts", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        coroutineScope.launch { loadData() }
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            // Action Feedback Banner
            if (actionMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        Text(actionMessage ?: "", fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                        IconButton(
                            onClick = { actionMessage = null },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Dismiss", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            // Top Tabs
            TabRow(
                selectedTabIndex = selectedTab,
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Find & Invite Staff (${registeredDoctors.size + labTechProfiles.size})", fontWeight = FontWeight.SemiBold) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Sent Invitations (${sentInvitations.size})", fontWeight = FontWeight.SemiBold) }
                )
            }

            if (selectedTab == 0) {
                // TAB 0: SEARCH & ENLISTED PROFILES
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Search Bar with Search Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = {
                                searchQuery = it
                                submittedSearchQuery = it
                            },
                            placeholder = { Text("Search doctor by name, specialty, NMC...", fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
                            trailingIcon = {
                                if (searchQuery.isNotBlank()) {
                                    IconButton(onClick = {
                                        searchQuery = ""
                                        submittedSearchQuery = ""
                                    }) {
                                        Icon(Icons.Default.Clear, contentDescription = "Clear")
                                    }
                                }
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = {
                                submittedSearchQuery = searchQuery
                                keyboardController?.hide()
                            }),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        )

                        // Dedicated Search Button
                        Button(
                            onClick = {
                                submittedSearchQuery = searchQuery
                                keyboardController?.hide()
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.height(52.dp)
                        ) {
                            Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Search", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }

                    // Role Filter Chips
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("All", "Doctors", "Lab Technicians").forEach { role ->
                            FilterChip(
                                selected = selectedRoleFilter == role,
                                onClick = { selectedRoleFilter = role },
                                label = { Text(role, fontSize = 12.sp) }
                            )
                        }
                    }

                    if (isLoading) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    } else if (filteredDoctors.isEmpty() && filteredLabTechs.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(vertical = 40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(Icons.Default.PersonSearch, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(54.dp))
                                Text(
                                    text = if (submittedSearchQuery.isNotBlank()) "No profiles matching '$submittedSearchQuery'" else "No Registered Doctor Profiles Found",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp
                                )
                                Text(
                                    text = "Doctors who register in the Doctor Portal will appear here for one-tap direct invitation.",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 24.dp)
                                )
                                if (submittedSearchQuery.isNotBlank()) {
                                    OutlinedButton(
                                        onClick = {
                                            searchQuery = ""
                                            submittedSearchQuery = ""
                                        },
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text("Reset Search")
                                    }
                                }
                            }
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(bottom = 24.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            // Enlisted Doctors
                            items(filteredDoctors, key = { it.id }) { doc ->
                                val existingInvite = sentInvitations.find { it.email.equals(doc.email, ignoreCase = true) }
                                val isAccepted = existingInvite?.status.equals("accepted", ignoreCase = true) || doc.clinicId == effectiveClinicId
                                val isPending = !isAccepted && existingInvite?.status.equals("pending", ignoreCase = true)
                                val isDeclined = !isAccepted && existingInvite?.status.equals("rejected", ignoreCase = true)

                                Card(
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isAccepted) Color(0xFFECFDF5) else MaterialTheme.colorScheme.surface
                                    ),
                                    border = BorderStroke(
                                        1.dp,
                                        if (isAccepted) Color(0xFFA7F3D0) else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
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
                                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                                            ) {
                                                Surface(
                                                    shape = CircleShape,
                                                    color = if (isAccepted) Color(0xFF059669) else MaterialTheme.colorScheme.primary,
                                                    modifier = Modifier.size(46.dp)
                                                ) {
                                                    Box(contentAlignment = Alignment.Center) {
                                                        Icon(
                                                            Icons.Default.MedicalServices,
                                                            contentDescription = null,
                                                            tint = Color.White,
                                                            modifier = Modifier.size(24.dp)
                                                        )
                                                    }
                                                }

                                                Column {
                                                    Text(doc.fullName, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                                    Text(
                                                        text = "${doc.specialty ?: "General Practice"} • NMC: ${doc.nmcLicenseNumber ?: "N/A"}",
                                                        fontSize = 12.sp,
                                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                                    )
                                                    Text(
                                                        text = "Account: ${doc.email}",
                                                        fontSize = 11.sp,
                                                        color = MaterialTheme.colorScheme.outline
                                                    )
                                                }
                                            }

                                            // Status Badge
                                            if (isAccepted) {
                                                Surface(color = Color(0xFFD1FAE5), shape = RoundedCornerShape(6.dp)) {
                                                    Text("✓ Accepted", color = Color(0xFF065F46), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                                }
                                            } else if (isPending) {
                                                Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(6.dp)) {
                                                    Text("Invited (Pending)", color = Color(0xFF92400E), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                                }
                                            } else if (isDeclined) {
                                                Surface(color = Color(0xFFFEE2E2), shape = RoundedCornerShape(6.dp)) {
                                                    Text("Declined", color = Color(0xFF991B1B), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                                }
                                            }
                                        }

                                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "Fee: Rs. ${(doc.consultationFee ?: 500.0).toInt()}",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = MaterialTheme.colorScheme.primary
                                            )

                                            // Action Buttons / Accepted Notice
                                            if (isAccepted) {
                                                Surface(
                                                    color = Color(0xFFD1FAE5),
                                                    shape = RoundedCornerShape(8.dp)
                                                ) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                                    ) {
                                                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(16.dp))
                                                        Text("Accepted • Active on Clinic Roster", color = Color(0xFF065F46), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                                    }
                                                }
                                            } else if (isPending) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                                ) {
                                                    Surface(
                                                        color = Color(0xFFFEF3C7),
                                                        shape = RoundedCornerShape(8.dp)
                                                    ) {
                                                        Row(
                                                            verticalAlignment = Alignment.CenterVertically,
                                                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                                                        ) {
                                                            Icon(Icons.Default.HourglassTop, contentDescription = null, tint = Color(0xFFD97706), modifier = Modifier.size(14.dp))
                                                            Text("Invited • Awaiting Doctor", color = Color(0xFF92400E), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                                                        }
                                                    }
                                                    OutlinedButton(
                                                        onClick = {
                                                            if (existingInvite != null && invitationRepository != null) {
                                                                coroutineScope.launch {
                                                                    isOperating = true
                                                                    val ok = invitationRepository.cancelInvitation(existingInvite.id)
                                                                    if (ok) {
                                                                        actionMessage = "Invitation cancelled."
                                                                        loadData()
                                                                    }
                                                                    isOperating = false
                                                                }
                                                            }
                                                        },
                                                        shape = RoundedCornerShape(8.dp),
                                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                                        modifier = Modifier.height(34.dp),
                                                        enabled = !isOperating
                                                    ) {
                                                        Text("Cancel", fontSize = 11.sp)
                                                    }
                                                }
                                            } else {
                                                // Send Invitation directly to Doctor's Account
                                                Button(
                                                    onClick = {
                                                        coroutineScope.launch {
                                                            isOperating = true
                                                            if (invitationRepository != null && effectiveClinicId.isNotBlank()) {
                                                                val created = invitationRepository.sendInvitation(effectiveClinicId, doc.email, "doctor")
                                                                if (created != null) {
                                                                    actionMessage = "✓ Invitation sent directly to ${doc.fullName}'s account!"
                                                                    loadData()
                                                                } else {
                                                                    actionMessage = "Failed to send invitation. Please try again."
                                                                }
                                                            }
                                                            isOperating = false
                                                        }
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                                                    shape = RoundedCornerShape(10.dp),
                                                    modifier = Modifier.height(38.dp),
                                                    enabled = !isOperating
                                                ) {
                                                    Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color.White)
                                                    Spacer(Modifier.width(6.dp))
                                                    Text(
                                                        text = if (isDeclined) "Re-Invite to Clinic" else "Invite to Clinic",
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 12.sp,
                                                        color = Color.White
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Enlisted Lab Technicians
                            items(filteredLabTechs, key = { it.id }) { tech ->
                                val existingInvite = sentInvitations.find { it.email.equals(tech.email, ignoreCase = true) }
                                val isPending = existingInvite?.status == "pending"
                                val isAccepted = existingInvite?.status == "accepted"

                                Card(
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .padding(16.dp)
                                            .fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            Surface(
                                                shape = CircleShape,
                                                color = Color(0xFF6366F1),
                                                modifier = Modifier.size(44.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Icon(Icons.Default.Biotech, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
                                                }
                                            }

                                            Column {
                                                Text(tech.fullName ?: "Lab Technician", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                                Text("Role: Diagnostic Lab Technician", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                Text("Account: ${tech.email}", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
                                            }
                                        }

                                        if (isAccepted) {
                                            Surface(color = Color(0xFFD1FAE5), shape = RoundedCornerShape(6.dp)) {
                                                Text("Affiliated", color = Color(0xFF065F46), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                            }
                                        } else if (isPending) {
                                            Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(6.dp)) {
                                                Text("Pending", color = Color(0xFF92400E), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                            }
                                        } else {
                                            Button(
                                                onClick = {
                                                    coroutineScope.launch {
                                                        isOperating = true
                                                        if (invitationRepository != null && effectiveClinicId.isNotBlank()) {
                                                            val created = invitationRepository.sendInvitation(effectiveClinicId, tech.email, "lab_technician")
                                                            if (created != null) {
                                                                actionMessage = "✓ Invitation sent to ${tech.fullName ?: tech.email}'s account!"
                                                                loadData()
                                                            }
                                                        }
                                                        isOperating = false
                                                    }
                                                },
                                                shape = RoundedCornerShape(10.dp),
                                                modifier = Modifier.height(36.dp),
                                                enabled = !isOperating
                                            ) {
                                                Text("Invite", fontSize = 12.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // TAB 1: SENT INVITATIONS & LIVE STATUS
                if (sentInvitations.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = 60.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.MarkEmailRead, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(48.dp))
                            Text("No Invitations Dispatched Yet", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Text("Switch to 'Find & Invite Staff' tab above to search doctor profiles.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(bottom = 24.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(sentInvitations, key = { it.id }) { invite ->
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .padding(16.dp)
                                        .fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = invite.email,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        )
                                        Text(
                                            text = "Role: ${if (invite.role == "doctor") "Doctor (Physician)" else "Lab Technician"}",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
                                        Text(
                                            text = if (invite.status == "accepted")
                                                "✓ Affiliated to Clinic (Can publish slots)"
                                            else if (invite.status == "rejected")
                                                "✕ Declined by Doctor"
                                            else
                                                "⏳ Awaiting Doctor Acceptance in Doctor Portal",
                                            fontSize = 11.sp,
                                            color = if (invite.status == "accepted") Color(0xFF047857) else if (invite.status == "rejected") Color.Red else Color(0xFFD97706),
                                            fontWeight = FontWeight.Medium,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
                                    }

                                    if (invite.status == "rejected") {
                                        OutlinedButton(
                                            onClick = {
                                                coroutineScope.launch {
                                                    if (invitationRepository != null) {
                                                        invitationRepository.sendInvitation(effectiveClinicId, invite.email, invite.role)
                                                        actionMessage = "✓ Invitation re-sent to ${invite.email}!"
                                                        loadData()
                                                    }
                                                }
                                            },
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                            modifier = Modifier.height(34.dp)
                                        ) {
                                            Text("Re-Invite", fontSize = 11.sp)
                                        }
                                    } else {
                                        Surface(
                                            color = if (invite.status == "accepted") Color(0xFFD1FAE5) else Color(0xFFFEF3C7),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = if (invite.status == "accepted") "Affiliated" else "Pending",
                                                color = if (invite.status == "accepted") Color(0xFF065F46) else Color(0xFF92400E),
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
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
}
