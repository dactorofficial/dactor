package com.dactor.patient.ui.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.dactor.patient.data.model.Clinic
import com.dactor.patient.data.model.ClinicService
import com.dactor.patient.data.model.Doctor
import com.dactor.patient.data.repository.ClinicRepository
import com.dactor.patient.data.repository.DoctorRepository
import com.dactor.patient.domain.util.CurrencyFormatter
import com.dactor.patient.ui.navigation.NavRoutes

data class ClinicDiscoveryItem(
    val clinic: Clinic,
    val services: List<ClinicService>,
    val doctors: List<Doctor>,
    val distanceText: String = "1.2 km away"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiscoveryScreen(
    navController: NavController,
    clinicRepository: ClinicRepository? = null,
    doctorRepository: DoctorRepository? = null
) {
    var searchQuery by remember { mutableStateOf("") }
    var searchCategory by remember { mutableStateOf("all") } // "all", "service", "clinic", "doctor"

    var discoveryList by remember { mutableStateOf<List<ClinicDiscoveryItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        if (clinicRepository != null) {
            try {
                val remoteClinics = clinicRepository.getClinics()
                val remoteItems = remoteClinics.map { clinic ->
                    val services = clinicRepository.getClinicServices(clinic.id)
                    val doctors = doctorRepository?.getDoctors(clinic.id) ?: emptyList()
                    ClinicDiscoveryItem(
                        clinic = clinic,
                        services = services,
                        doctors = doctors,
                        distanceText = clinic.addressText ?: "Nepal"
                    )
                }
                discoveryList = remoteItems
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        } else {
            isLoading = false
        }
    }

    val filteredList = discoveryList.filter { item ->
        val q = searchQuery.trim().lowercase()
        if (q.isBlank()) return@filter true

        when (searchCategory) {
            "service" -> item.services.any { it.serviceName.lowercase().contains(q) }
            "clinic" -> item.clinic.name.lowercase().contains(q) || (item.clinic.addressText ?: "").lowercase().contains(q)
            "doctor" -> item.doctors.any { it.fullName.lowercase().contains(q) || (it.specialty ?: "").lowercase().contains(q) }
            else -> item.clinic.name.lowercase().contains(q) ||
                    item.services.any { it.serviceName.lowercase().contains(q) } ||
                    item.doctors.any { it.fullName.lowercase().contains(q) || (it.specialty ?: "").lowercase().contains(q) }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Find Clinics & Doctors", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate(NavRoutes.Profile.route) }) {
                        Icon(Icons.Default.AccountCircle, contentDescription = "Profile & Settings")
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
            // Search Input Field
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                label = { Text("Search by service, clinic or doctor") },
                placeholder = { Text("e.g. Cardiology, Ultrasound, or Doctor name") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear")
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                shape = RoundedCornerShape(14.dp),
                singleLine = true
            )

            // Triple Search Dimension Filter Pills
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = searchCategory == "all",
                    onClick = { searchCategory = "all" },
                    label = { Text("All Results", fontSize = 12.sp) }
                )
                FilterChip(
                    selected = searchCategory == "service",
                    onClick = { searchCategory = "service" },
                    label = { Text("By Service", fontSize = 12.sp) }
                )
                FilterChip(
                    selected = searchCategory == "clinic",
                    onClick = { searchCategory = "clinic" },
                    label = { Text("By Clinic", fontSize = 12.sp) }
                )
                FilterChip(
                    selected = searchCategory == "doctor",
                    onClick = { searchCategory = "doctor" },
                    label = { Text("By Doctor", fontSize = 12.sp) }
                )
            }

            // Results List
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                if (filteredList.isEmpty() && !isLoading) {
                    item {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                            modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(24.dp).fillMaxWidth(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.LocalHospital, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(40.dp))
                                Text("No Verified Clinics Found", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text(
                                    "Clinics registered by medical centers and approved by the Super Admin will appear here in real time.",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        }
                    }
                }

                items(filteredList, key = { it.clinic.id }) { item ->
                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                navController.navigate(NavRoutes.Booking.createRoute(item.clinic.id))
                            }
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = item.clinic.name,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                        modifier = Modifier.padding(top = 2.dp)
                                    ) {
                                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
                                        Text(
                                            text = item.clinic.addressText ?: "Nepal",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }

                                SuggestionChip(
                                    onClick = { },
                                    label = {
                                        Text(
                                            text = when (item.clinic.type) {
                                                "single_visit" -> "Single Visit"
                                                "multi_visit" -> "Multi Visit"
                                                else -> "Diagnostic Lab"
                                            },
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                )
                            }

                            // Pinned Location Badge
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant,
                                    modifier = Modifier.padding(vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "📍 GPS: ${item.clinic.latitude?.let { "%.4f".format(it) }}, ${item.clinic.longitude?.let { "%.4f".format(it) }}",
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                                Text("• ${item.distanceText}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }

                            // Doctors Available & Physical Presence
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Available Physicians:", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                item.doctors.forEach { doc ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("• ${doc.fullName ?: "Doctor"} (${doc.specialty ?: "General"})", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                        val isInClinic = doc.isInClinic == true
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Box(
                                                modifier = Modifier
                                                    .size(8.dp)
                                                    .background(
                                                        if (isInClinic) Color(0xFF10B981) else Color(0xFFEF4444),
                                                        RoundedCornerShape(4.dp)
                                                    )
                                            )
                                            Text(
                                                text = if (isInClinic) "In Clinic" else "Away",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (isInClinic) Color(0xFF047857) else Color(0xFFDC2626)
                                            )
                                        }
                                    }
                                }
                            }

                            // Services & Pricing Preview
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Services & Rates:", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    item.services.take(3).forEach { srv ->
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
                                        ) {
                                            Text(
                                                text = "${srv.serviceName}: ${CurrencyFormatter.formatNPR(srv.price)}",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                                color = MaterialTheme.colorScheme.onPrimaryContainer
                                            )
                                        }
                                    }
                                }
                            }

                            // Book Appointment Button
                            Button(
                                onClick = {
                                    navController.navigate(NavRoutes.Booking.createRoute(item.clinic.id))
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Book Appointment & View Slots", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
