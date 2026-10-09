package com.dactor.patient.ui.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import com.dactor.patient.data.model.ClinicService
import com.dactor.patient.data.model.Doctor
import com.dactor.patient.domain.util.CurrencyFormatter
import com.dactor.patient.ui.navigation.NavRoutes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClinicDetailScreen(
    navController: NavController,
    clinicId: String? = null,
    clinicRepository: com.dactor.patient.data.repository.ClinicRepository? = null,
    doctorRepository: com.dactor.patient.data.repository.DoctorRepository? = null
) {
    var clinic by remember { mutableStateOf<com.dactor.patient.data.model.Clinic?>(null) }
    var services by remember { mutableStateOf<List<com.dactor.patient.data.model.ClinicService>>(emptyList()) }
    var doctors by remember { mutableStateOf<List<com.dactor.patient.data.model.Doctor>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(clinicId) {
        if (!clinicId.isNullOrBlank() && clinicRepository != null) {
            val c = clinicRepository.getClinicById(clinicId)
            clinic = c
            services = clinicRepository.getClinicServices(clinicId)
            doctors = doctorRepository?.getDoctors(clinicId) ?: emptyList()
        }
        isLoading = false
    }

    val clinicName = clinic?.name ?: "Clinic Profile"
    val clinicType = clinic?.type?.replace("_", " ")?.capitalize() ?: "Healthcare Facility"
    val address = clinic?.addressText ?: "Nepal"
    val coordinates = "${clinic?.latitude ?: 27.7052}° N, ${clinic?.longitude ?: 85.3193}° E"
    val phone = clinic?.contactPhone ?: "N/A"
    val email = clinic?.contactEmail ?: "N/A"
    val autoNotifyThreshold = clinic?.autoNotifyThreshold ?: 2

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Clinic Profile", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
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
                        onClick = { navController.navigate(NavRoutes.Booking.createRoute(clinicId ?: clinic?.id ?: "")) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Book Appointment with Slot Lock", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            // Header Info Card
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Text(
                                clinicType,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Text(clinicName, fontWeight = FontWeight.Bold, fontSize = 20.sp)

                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
                            Text(address, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Phone, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(14.dp))
                                Text(phone, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Email, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(14.dp))
                                Text(email, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }

            // Interactive Map GPS Card
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Map, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                            Text("Map Location & GPS Coordinates", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        Text(
                            "Coordinates: $coordinates (Bagbazar Chowk)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.surface,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(90.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.NearMe, contentDescription = null, tint = Color(0xFFEF4444))
                                    Text("Open in Google Maps / Apple Maps", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
            }

            // Available Services Catalog
            item {
                Text("Services & Rates Catalog", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            items(services) { service ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(service.serviceName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            if (service.description != null) {
                                Text(service.description, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Text(
                            CurrencyFormatter.formatNPR(service.price),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // Doctors at Clinic & Presence Indicators
            item {
                Text("Doctors & Specialists", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            items(doctors) { doctor ->
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primaryContainer,
                            modifier = Modifier.size(46.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(doctor.fullName ?: "Doctor", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("${doctor.specialty ?: "General"} • ${doctor.nmcLicenseNumber ?: ""}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                "Fee: ${CurrencyFormatter.formatNPR(doctor.consultationFee ?: 500.0)}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        // Physical presence badge
                        val isInClinic = doctor.isInClinic == true
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (isInClinic) Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(if (isInClinic) Color(0xFF10B981) else Color(0xFFEF4444), CircleShape)
                                )
                                Text(
                                    text = if (isInClinic) "In Clinic" else "Away",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isInClinic) Color(0xFF047857) else Color(0xFFB91C1C)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
