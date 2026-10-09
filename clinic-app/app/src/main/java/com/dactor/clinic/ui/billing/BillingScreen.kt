package com.dactor.clinic.ui.billing

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
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
import com.dactor.clinic.data.model.BillingInvoice
import com.dactor.clinic.data.model.InvoiceItem
import com.dactor.clinic.data.repository.BillingRepository
import com.dactor.clinic.domain.util.CurrencyFormatter
import kotlinx.coroutines.launch
import java.util.UUID

data class InvoiceLineItem(
    val name: String,
    val unitPrice: Double,
    var quantity: Int = 1
) {
    val total: Double get() = unitPrice * quantity
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillingScreen(
    navController: NavController,
    clinicId: String = "",
    appointmentId: String = "",
    patientName: String = "Patient Consultation",
    trackingCode: String = "",
    billingRepository: BillingRepository? = null,
    appointmentRepository: com.dactor.clinic.data.repository.AppointmentRepository? = null
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else com.dactor.clinic.data.local.UserSessionManager(context).getSavedClinicId() ?: ""
    }
    var realPatientName by remember { mutableStateOf(patientName) }
    var realTrackingCode by remember { mutableStateOf(trackingCode) }

    var lineItems by remember {
        mutableStateOf(
            listOf(
                InvoiceLineItem(name = "General OPD Specialist Consultation", unitPrice = 500.0, quantity = 1),
                InvoiceLineItem(name = "12-Lead ECG Test", unitPrice = 750.0, quantity = 1)
            )
        )
    }

    var manualItemName by remember { mutableStateOf("") }
    var manualItemPrice by remember { mutableStateOf("") }
    var paidAmountInput by remember { mutableStateOf("1250") }
    var clinicalRemarks by remember { mutableStateOf("Patient presented with mild chest discomfort and fatigue. ECG normal. Prescribed Tab Metoprolol 25mg OD.") }

    var isSaving by remember { mutableStateOf(false) }
    var showSuccessDialog by remember { mutableStateOf(false) }

    LaunchedEffect(appointmentId) {
        if (appointmentId.isNotBlank()) {
            if (appointmentRepository != null) {
                val appt = appointmentRepository.getAppointmentById(appointmentId)
                    ?: appointmentRepository.getAppointmentByTrackingCode(appointmentId)
                if (appt != null) {
                    realPatientName = appt.patientName
                    realTrackingCode = appt.trackingCode10Digit
                }
            }
            if (billingRepository != null) {
                val existingInv = billingRepository.getInvoiceByAppointment(appointmentId)
                if (existingInv != null) {
                    if (existingInv.items.isNotEmpty()) {
                        lineItems = existingInv.items.map {
                            InvoiceLineItem(name = it.itemName, unitPrice = it.price, quantity = it.quantity)
                        }
                    }
                    paidAmountInput = existingInv.paidAmount.toInt().toString()
                    if (!existingInv.remarks.isNullOrBlank()) {
                        clinicalRemarks = existingInv.remarks
                    }
                }
            }
        }
    }

    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    val totalAmount = lineItems.sumOf { it.total }
    val paidAmount = paidAmountInput.toDoubleOrNull() ?: 0.0
    val balanceDue = (totalAmount - paidAmount).coerceAtLeast(0.0)

    val quickCatalogItems = listOf(
        Pair("OPD Consult", 500.0),
        Pair("ECG Test", 750.0),
        Pair("Blood CBC", 650.0),
        Pair("Wound Care", 350.0),
        Pair("Lipid Profile", 1200.0)
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Fast Billing & Clinical Remarks", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
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
            // Patient Header Card
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .padding(14.dp)
                        .fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(realPatientName, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("10-Digit Code: ${realTrackingCode.ifBlank { trackingCode.ifBlank { appointmentId.take(8) } }}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    SuggestionChip(
                        onClick = { },
                        label = { Text("Appt ID: $appointmentId", fontSize = 11.sp) }
                    )
                }
            }

            // Quick Catalog Add Bar
            Text("1-Click Catalog Quick Add", fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                quickCatalogItems.forEach { (name, price) ->
                    AssistChip(
                        onClick = {
                            lineItems = lineItems + InvoiceLineItem(name = name, unitPrice = price, quantity = 1)
                        },
                        label = { Text("+ $name (Rs. ${price.toInt()})", fontSize = 11.sp) }
                    )
                }
            }

            // Manual Line Item Inputs
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Add Custom Line Item", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = manualItemName,
                            onValueChange = { manualItemName = it },
                            placeholder = { Text("Custom item / drug name") },
                            modifier = Modifier.weight(2f),
                            shape = RoundedCornerShape(10.dp)
                        )
                        OutlinedTextField(
                            value = manualItemPrice,
                            onValueChange = { manualItemPrice = it },
                            placeholder = { Text("Price (Rs.)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp)
                        )
                        IconButton(
                            onClick = {
                                val price = manualItemPrice.toDoubleOrNull() ?: 0.0
                                if (manualItemName.isNotBlank() && price > 0) {
                                    lineItems = lineItems + InvoiceLineItem(name = manualItemName.trim(), unitPrice = price, quantity = 1)
                                    manualItemName = ""
                                    manualItemPrice = ""
                                }
                            },
                            modifier = Modifier.align(Alignment.CenterVertically)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add Item", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }

            // Current Line Items List
            Text("Invoice Items (${lineItems.size})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                lineItems.forEachIndexed { index, item ->
                    Card(
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(12.dp)
                                .fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(item.name, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text("Rs. ${item.unitPrice.toInt()} × ${item.quantity}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }

                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    CurrencyFormatter.formatNPR(item.total),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                IconButton(
                                    onClick = {
                                        lineItems = lineItems.filterIndexed { i, _ -> i != index }
                                    },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }

            // Totals Summary Card
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total Bill Amount:", fontSize = 13.sp)
                        Text(CurrencyFormatter.formatNPR(totalAmount), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Amount Paid by Patient (Rs.):", fontSize = 13.sp)
                        OutlinedTextField(
                            value = paidAmountInput,
                            onValueChange = { paidAmountInput = it },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.width(130.dp),
                            shape = RoundedCornerShape(8.dp)
                        )
                    }

                    Divider(modifier = Modifier.padding(vertical = 4.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Balance Due:", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Text(
                            CurrencyFormatter.formatNPR(balanceDue),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 15.sp,
                            color = if (balanceDue > 0) MaterialTheme.colorScheme.error else Color(0xFF059669)
                        )
                    }
                }
            }

            // Doctor Clinical Remarks / Prescription Notes
            Text("Clinical Remarks & Advice", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            OutlinedTextField(
                value = clinicalRemarks,
                onValueChange = { clinicalRemarks = it },
                label = { Text("Clinical Notes / Prescriptions") },
                placeholder = { Text("Doctor's findings, prescriptions, and follow-up advice...") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                shape = RoundedCornerShape(12.dp)
            )

            // Submit Button
            Button(
                onClick = {
                    isSaving = true
                    coroutineScope.launch {
                        val invoice = BillingInvoice(
                            id = UUID.randomUUID().toString(),
                            appointmentId = if (appointmentId.isNotBlank()) appointmentId else UUID.randomUUID().toString(),
                            clinicId = effectiveClinicId,
                            items = lineItems.map { InvoiceItem(itemName = it.name, quantity = it.quantity, price = it.unitPrice, total = it.total) },
                            totalAmount = totalAmount,
                            paidAmount = paidAmount,
                            balanceDue = balanceDue,
                            paymentStatus = if (balanceDue <= 0) "paid" else "pending",
                            paidAt = java.time.Instant.now().toString(),
                            remarks = clinicalRemarks.trim().ifBlank { null }
                        )

                        billingRepository?.saveInvoice(invoice)
                        isSaving = false
                        showSuccessDialog = true
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                enabled = !isSaving
            ) {
                Text(if (isSaving) "Saving Invoice..." else "Finalize & Save Invoice (Rs. ${totalAmount.toInt()})", fontWeight = FontWeight.Bold)
            }
        }

        if (showSuccessDialog) {
            AlertDialog(
                onDismissRequest = {
                    showSuccessDialog = false
                    navController.popBackStack()
                },
                icon = { Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(36.dp)) },
                title = { Text("Invoice & Remarks Saved", fontWeight = FontWeight.Bold) },
                text = {
                    Text(
                        "Billing for $patientName has been finalized for ${CurrencyFormatter.formatNPR(totalAmount)}. Clinical remarks have been attached to the appointment.",
                        fontSize = 13.sp
                    )
                },
                confirmButton = {
                    Button(onClick = {
                        showSuccessDialog = false
                        navController.popBackStack()
                    }) {
                        Text("Back to Queue")
                    }
                }
            )
        }
    }
}
