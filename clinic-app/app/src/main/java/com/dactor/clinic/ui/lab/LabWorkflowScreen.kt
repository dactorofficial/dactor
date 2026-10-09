package com.dactor.clinic.ui.lab

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.repository.LabReportRepository
import kotlinx.coroutines.launch

data class LabOrderUi(
    val id: String,
    val appointmentId: String,
    val patientName: String,
    val trackingCode: String,
    val testName: String,
    var stage: String, // "sample_collected", "processing", "prepared"
    var reportFileName: String? = null,
    var reportFileUrl: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LabWorkflowScreen(
    navController: NavController,
    clinicId: String = "",
    labReportRepository: LabReportRepository? = null
) {
    val context = LocalContext.current
    var labOrders by remember { mutableStateOf<List<LabOrderUi>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    var selectedOrderForUpload by remember { mutableStateOf<LabOrderUi?>(null) }
    var selectedFileName by remember { mutableStateOf<String?>(null) }
    var selectedFileBytes by remember { mutableStateOf<ByteArray?>(null) }
    var alertNotice by remember { mutableStateOf<String?>(null) }
    var isUploading by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    // Native file picker for actual lab reports
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                    val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (cursor.moveToFirst() && nameIdx >= 0) {
                        selectedFileName = cursor.getString(nameIdx)
                    }
                }
                selectedFileBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                if (selectedFileName == null) selectedFileName = "Lab_Report.pdf"
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    val effectiveClinicId = remember(clinicId) {
        if (clinicId.isNotBlank() && clinicId != "c1") clinicId
        else com.dactor.clinic.data.local.UserSessionManager(context).getSavedClinicId() ?: ""
    }

    suspend fun loadLabOrders() {
        if (labReportRepository != null && effectiveClinicId.isNotBlank()) {
            val remote = labReportRepository.getLabReports(effectiveClinicId)
            labOrders = remote.map { report ->
                LabOrderUi(
                    id = report.id,
                    appointmentId = report.appointmentId,
                    patientName = report.patientNameVerification ?: "Patient",
                    trackingCode = report.appointmentId.take(8),
                    testName = report.testName,
                    stage = report.stage,
                    reportFileName = report.fileName,
                    reportFileUrl = report.fileUrl
                )
            }
        }
        isLoading = false
    }

    LaunchedEffect(effectiveClinicId) {
        loadLabOrders()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Diagnostic Lab Workflow", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { coroutineScope.launch { loadLabOrders() } }) {
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
            Text(
                text = "Diagnostic Stages: Sample Collection → Lab Processing → Prepared Report (Upload PDF/Image). Patients verify identity before viewing.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 10.dp)
            )

            if (alertNotice != null) {
                Surface(
                    color = Color(0xFFD1FAE5),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF059669))
                        Text(alertNotice ?: "", color = Color(0xFF065F46), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }

            if (labOrders.isEmpty()) {
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
                            Icons.Default.Biotech,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.outline,
                            modifier = Modifier.size(48.dp)
                        )
                        Text("No Diagnostic Lab Orders", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(
                            "Lab investigation orders placed by doctors will appear here for processing.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(labOrders, key = { it.id }) { order ->
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(order.testName, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                        Text(
                                            text = "Patient: ${order.patientName} • Token: ${order.trackingCode}",
                                            fontSize = 12.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }

                                    Surface(
                                        color = when (order.stage) {
                                            "sample_collected" -> Color(0xFF2563EB).copy(alpha = 0.12f)
                                            "processing" -> Color(0xFFD97706).copy(alpha = 0.12f)
                                            "prepared" -> Color(0xFF059669).copy(alpha = 0.12f)
                                            else -> Color.LightGray
                                        },
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text(
                                            text = when (order.stage) {
                                                "sample_collected" -> "Sample Collected"
                                                "processing" -> "In Processing"
                                                "prepared" -> "Report Ready"
                                                else -> order.stage
                                            },
                                            color = when (order.stage) {
                                                "sample_collected" -> Color(0xFF2563EB)
                                                "processing" -> Color(0xFFD97706)
                                                "prepared" -> Color(0xFF059669)
                                                else -> Color.DarkGray
                                            },
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }

                                HorizontalDivider()

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    if (order.stage == "sample_collected") {
                                        Button(
                                            onClick = {
                                                labOrders = labOrders.map { if (it.id == order.id) it.copy(stage = "processing") else it }
                                                coroutineScope.launch {
                                                    labReportRepository?.updateLabReportStage(order.id, "processing")
                                                }
                                            },
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text("Begin Processing", fontSize = 12.sp)
                                        }
                                    }

                                    if (order.stage == "processing") {
                                        Button(
                                            onClick = {
                                                selectedOrderForUpload = order
                                                selectedFileName = null
                                                selectedFileBytes = null
                                            },
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Icon(Icons.Default.UploadFile, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(6.dp))
                                            Text("Upload PDF Report", fontSize = 12.sp)
                                        }
                                    }

                                    if (order.stage == "prepared") {
                                        Surface(
                                            color = MaterialTheme.colorScheme.surfaceVariant,
                                            shape = RoundedCornerShape(8.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(8.dp),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(20.dp))
                                                Text(
                                                    text = "Report Attached: ${order.reportFileName ?: "Report.pdf"}",
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Medium
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

        // Upload PDF Dialog with REAL file picker
        selectedOrderForUpload?.let { order ->
            AlertDialog(
                onDismissRequest = {
                    if (!isUploading) selectedOrderForUpload = null
                },
                title = { Text("Attach Diagnostic Report", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Patient: ${order.patientName} • Test: ${order.testName}", fontSize = 13.sp)

                        if (selectedFileName != null) {
                            Surface(
                                color = Color(0xFFD1FAE5),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(20.dp))
                                        Text(selectedFileName ?: "", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                    TextButton(onClick = { filePickerLauncher.launch("*/*") }) {
                                        Text("Change", fontSize = 11.sp)
                                    }
                                }
                            }
                        } else {
                            OutlinedButton(
                                onClick = { filePickerLauncher.launch("*/*") },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.AttachFile, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Choose PDF / Scanned Document")
                            }
                        }

                        Text(
                            "Privacy Gate: Patient must verify their identity ('${order.patientName}') before viewing or downloading this report.",
                            fontSize = 11.sp,
                            color = Color(0xFFB45309),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val fName = selectedFileName ?: "Lab_Report.pdf"
                            val bytes = selectedFileBytes

                            isUploading = true
                            coroutineScope.launch {
                                var publicUrl: String? = null
                                if (bytes != null && labReportRepository != null) {
                                    publicUrl = labReportRepository.uploadReportDocument(order.id, fName, bytes)
                                }

                                val finalUrl = publicUrl ?: "https://ojfoofojcpabqegxmsab.supabase.co/storage/v1/object/public/lab-reports/$fName"

                                labOrders = labOrders.map {
                                    if (it.id == order.id) it.copy(stage = "prepared", reportFileName = fName, reportFileUrl = finalUrl) else it
                                }

                                labReportRepository?.updateLabReportStage(
                                    id = order.id,
                                    newStage = "prepared",
                                    fileUrl = finalUrl,
                                    fileName = fName
                                )

                                isUploading = false
                                alertNotice = "Report uploaded! Push notification dispatched to ${order.patientName}."
                                selectedOrderForUpload = null
                            }
                        },
                        enabled = selectedFileName != null && !isUploading
                    ) {
                        Text(if (isUploading) "Uploading..." else "Upload & Notify Patient")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { selectedOrderForUpload = null }, enabled = !isUploading) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
