package com.dactor.clinic.ui.services

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.model.ClinicService
import com.dactor.clinic.data.repository.ClinicRepository
import com.dactor.clinic.domain.util.CurrencyFormatter
import kotlinx.coroutines.launch
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServicesScreen(
    navController: NavController,
    clinicId: String = "",
    clinicRepository: ClinicRepository? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else com.dactor.clinic.data.local.UserSessionManager(context).getSavedClinicId() ?: ""
    }

    var services by remember { mutableStateOf<List<ClinicService>>(emptyList()) }

    var showAddDialog by remember { mutableStateOf(false) }
    var newServiceName by remember { mutableStateOf("") }
    var newServiceDesc by remember { mutableStateOf("") }
    var newServicePrice by remember { mutableStateOf("") }
    var isAdding by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(effectiveClinicId) {
        if (clinicRepository != null && effectiveClinicId.isNotBlank()) {
            val remote = clinicRepository.getClinicServices(effectiveClinicId)
            services = remote
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Clinic Services & Pricing", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddDialog = true },
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Add Service") },
                shape = RoundedCornerShape(16.dp)
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
                text = "Services configured here are publicly searchable by patients in the Dactor Patient App and can be added directly to patient bills.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 12.dp)
            )

            if (services.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No services configured yet. Tap 'Add Service' to add your first one.", color = Color.Gray)
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(services, key = { it.id }) { service ->
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            ),
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
                                        text = service.serviceName,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    if (!service.description.isNullOrBlank()) {
                                        Text(
                                            text = service.description ?: "",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
                                    }
                                }

                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text(
                                        text = CurrencyFormatter.formatNPR(service.price),
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 15.sp,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    IconButton(
                                        onClick = {
                                            coroutineScope.launch {
                                                clinicRepository?.deleteService(service.id)
                                                services = services.filter { it.id != service.id }
                                            }
                                        }
                                    ) {
                                        Icon(
                                            Icons.Default.Delete,
                                            contentDescription = "Delete",
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add Service Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Add Clinic Service", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = newServiceName,
                            onValueChange = { newServiceName = it },
                            label = { Text("Service / Test Name") },
                            placeholder = { Text("e.g. ECG, Dental X-Ray") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        )
                        OutlinedTextField(
                            value = newServiceDesc,
                            onValueChange = { newServiceDesc = it },
                            label = { Text("Description (Optional)") },
                            placeholder = { Text("Short description") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        )
                        OutlinedTextField(
                            value = newServicePrice,
                            onValueChange = { newServicePrice = it },
                            label = { Text("Price (in Rs.)") },
                            placeholder = { Text("500") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val priceVal = newServicePrice.toDoubleOrNull() ?: 0.0
                            if (newServiceName.isNotBlank() && priceVal > 0) {
                                isAdding = true
                                val newSrv = ClinicService(
                                    id = UUID.randomUUID().toString(),
                                    clinicId = effectiveClinicId,
                                    serviceName = newServiceName.trim(),
                                    description = newServiceDesc.trim().ifBlank { null },
                                    price = priceVal
                                )
                                coroutineScope.launch {
                                    clinicRepository?.addService(newSrv)
                                    services = services + newSrv
                                    newServiceName = ""
                                    newServiceDesc = ""
                                    newServicePrice = ""
                                    isAdding = false
                                    showAddDialog = false
                                }
                            }
                        },
                        enabled = !isAdding && newServiceName.isNotBlank() && newServicePrice.isNotBlank()
                    ) {
                        Text("Add Service")
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
}
