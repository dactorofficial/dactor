package com.dactor.clinic.ui.dashboard

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.clinic.data.local.UserSessionManager
import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.repository.ClinicRepository
import com.dactor.clinic.data.repository.DoctorRepository
import com.dactor.clinic.domain.util.ArchiveDateUtils
import com.dactor.clinic.ui.navigation.NavRoutes
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    navController: NavController,
    clinicId: String? = null,
    clinicRepository: ClinicRepository? = null,
    doctorRepository: DoctorRepository? = null,
    authRepository: com.dactor.clinic.data.repository.AuthRepository? = null
) {
    val context = LocalContext.current
    val sessionManager = remember { UserSessionManager(context) }
    var clinic by remember { mutableStateOf<Clinic?>(null) }
    var doctors by remember { mutableStateOf<List<Doctor>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isRestoringAccount by remember { mutableStateOf(false) }

    // Activation & License Subscription state
    var showRenewalDialog by remember { mutableStateOf(false) }
    var selectedPlan by remember { mutableStateOf("1_month") } // "1_month" or "12_month"
    var paymentTransactionNote by remember { mutableStateOf("") }
    var isSubmittingPayment by remember { mutableStateOf(false) }
    var renewalSubmittedMessage by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    fun loadClinic() {
        coroutineScope.launch {
            if (clinicRepository != null) {
                val currentEmail = authRepository?.getCurrentUserEmail()
                val sessionClinicId = sessionManager.getSavedClinicId()
                val fetchedClinic = if (!clinicId.isNullOrBlank() && clinicId != "c1") {
                    clinicRepository.getClinicById(clinicId)
                } else if (!sessionClinicId.isNullOrBlank()) {
                    clinicRepository.getClinicById(sessionClinicId)
                } else if (!currentEmail.isNullOrBlank()) {
                    clinicRepository.getClinicByEmail(currentEmail)
                } else {
                    null
                }
                clinic = fetchedClinic

                if (fetchedClinic != null) {
                    sessionManager.saveClinicSession(
                        fetchedClinic.id,
                        fetchedClinic.contactEmail ?: currentEmail ?: "",
                        fetchedClinic.name
                    )
                    sessionManager.setClinicArchivedStatus(
                        fetchedClinic.isArchived ?: false,
                        fetchedClinic.deletionScheduledAt
                    )

                    // If archived and passed 30 days -> Purge patient data
                    if (fetchedClinic.isArchived == true) {
                        val days = ArchiveDateUtils.calculateDaysRemaining(fetchedClinic.deletionScheduledAt)
                        if (days <= 0) {
                            try {
                                clinicRepository.purgeExceededArchivedClinicData(fetchedClinic.id)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                }

                if (fetchedClinic != null && doctorRepository != null) {
                    doctors = doctorRepository.getDoctorsByClinic(fetchedClinic.id)
                }
            }
            isLoading = false
        }
    }

    LaunchedEffect(clinicId) {
        loadClinic()
    }

    val isClinicArchived = clinic?.isArchived == true || sessionManager.isClinicArchived()
    val deletionScheduledAt = clinic?.deletionScheduledAt ?: sessionManager.getClinicDeletionScheduledAt()
    val daysRemaining = ArchiveDateUtils.calculateDaysRemaining(deletionScheduledAt)
    val formattedDeletionDate = ArchiveDateUtils.formatScheduledDeletionDate(deletionScheduledAt)

    val isClinicActivated = clinic == null || ArchiveDateUtils.isClinicActivationValid(clinic?.isActivated, clinic?.activationExpiresAt)
    val activationDaysLeft = ArchiveDateUtils.calculateActivationDaysLeft(clinic?.activationExpiresAt)
    val formattedActivationExpiry = ArchiveDateUtils.formatActivationExpiryDate(clinic?.activationExpiresAt)

    val displayClinicTitle = if (isClinicArchived) "Clinic Deletion Archive" else if (!isClinicActivated) "Clinic Portal Locked" else (clinic?.name ?: "Clinic Administration Portal")
    val displayClinicSubtitle = if (isClinicArchived) "Operations Suspended • 30-Day Archive" else if (!isClinicActivated) "License Subscription Required" else (clinic?.addressText ?: "Nepal Healthcare Operations & Queue Management")

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(displayClinicTitle, fontWeight = FontWeight.Bold, fontSize = 17.sp, maxLines = 1)
                        Text(displayClinicSubtitle, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                    }
                },
                actions = {
                    if (!isClinicArchived && isClinicActivated) {
                        IconButton(onClick = { navController.navigate(NavRoutes.ClinicSettings) }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings")
                        }
                    }
                    IconButton(
                        onClick = {
                            sessionManager.clearSession()
                            try {
                                com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(
                                    context,
                                    com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN
                                ).signOut()
                                com.google.firebase.auth.FirebaseAuth.getInstance().signOut()
                            } catch (ignored: Exception) {}
                            navController.navigate(NavRoutes.ClinicLogin) {
                                popUpTo(0) { inclusive = true }
                            }
                        }
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "Sign Out", tint = MaterialTheme.colorScheme.error)
                    }
                }
            )
        }
    ) { padding ->

        if (isClinicArchived) {
            // =========================================================================
            // 30-DAY ARCHIVE VIEW: LOCKED OUT FROM PORTAL & CANNOT VIEW DATA
            // =========================================================================
            if (daysRemaining <= 0) {
                // Purged Exceeded Screen
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color(0xFFFEE2E2),
                        modifier = Modifier.size(80.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.DeleteForever, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(42.dp))
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    Text("Clinic Account Purged", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color(0xFF991B1B))
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "This clinic account has exceeded the 30-day archive holding period. All patient records, consultations, diagnostic lab tests, and queue tokens have been permanently wiped from the database.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp
                    )

                    Spacer(Modifier.height(24.dp))

                    Button(
                        onClick = {
                            sessionManager.clearSession()
                            navController.navigate(NavRoutes.ClinicLogin) {
                                popUpTo(0) { inclusive = true }
                            }
                        },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Exit to Login")
                    }
                }
            } else {
                // Active Archive Holding Screen
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color(0xFFFEE2E2),
                        modifier = Modifier.size(88.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.HourglassTop, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(46.dp))
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    Text("Clinic Scheduled for Deletion", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF991B1B))
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Your clinic is currently in the 30-day archive holding period. Normal clinic operations and OPD queues are locked.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )

                    Spacer(Modifier.height(20.dp))

                    // Countdown Card
                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
                        border = BorderStroke(1.dp, Color(0xFFFECACA)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("ARCHIVE COUNTDOWN", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFB91C1C), letterSpacing = 1.sp)
                            Text("$daysRemaining Days Left", fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFDC2626))
                            Text("Scheduled purge: $formattedDeletionDate", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = Color(0xFF7F1D1D))
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    // Patient Purge Notice
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFFFFBEB),
                        border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFD97706), modifier = Modifier.size(20.dp))
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Patient Data Purge Notice", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF92400E))
                                Text(
                                    "If not cancelled before $formattedDeletionDate, all patient appointment records, consultation files, diagnostic reports, and tokens will be permanently deleted.",
                                    fontSize = 11.sp,
                                    color = Color(0xFF78350F),
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(26.dp))

                    // Cancel Deletion & Restore Button
                    Button(
                        onClick = {
                            val effClinicId = clinic?.id ?: sessionManager.getSavedClinicId() ?: ""
                            if (effClinicId.isNotBlank() && clinicRepository != null) {
                                isRestoringAccount = true
                                coroutineScope.launch {
                                    val res = clinicRepository.cancelClinicDeletion(effClinicId)
                                    if (res.isSuccess) {
                                        sessionManager.setClinicArchivedStatus(false, null)
                                        loadClinic()
                                    }
                                    isRestoringAccount = false
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        enabled = !isRestoringAccount
                    ) {
                        if (isRestoringAccount) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                        } else {
                            Icon(Icons.Default.Restore, contentDescription = null, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Cancel Deletion & Restore Clinic Account", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }

                    Spacer(Modifier.height(12.dp))

                    OutlinedButton(
                        onClick = {
                            sessionManager.clearSession()
                            try {
                                com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(
                                    context,
                                    com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN
                                ).signOut()
                                com.google.firebase.auth.FirebaseAuth.getInstance().signOut()
                            } catch (ignored: Exception) {}
                            navController.navigate(NavRoutes.ClinicLogin) {
                                popUpTo(0) { inclusive = true }
                            }
                        },
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(50.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Log Out from Clinic Account", fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else if (clinic != null && !isClinicActivated) {
            // =========================================================================
            // ACTIVATION LOCK VIEW: CLINIC CANNOT USE ANY FUNCTION UNTIL ACTIVATED
            // =========================================================================
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color(0xFFFEF3C7),
                    modifier = Modifier.size(80.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = null,
                            tint = Color(0xFFD97706),
                            modifier = Modifier.size(42.dp)
                        )
                    }
                }

                Text(
                    text = "Clinic Portal Locked",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF92400E)
                )

                Text(
                    text = "Your clinic activation license has expired or is inactive. Inactive clinics cannot manage live queues, publish doctor slots, or accept patient bookings.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )

                // Current Expiry Details Card
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB)),
                    border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFFD97706), modifier = Modifier.size(18.dp))
                            Text("License Status", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF92400E))
                        }
                        Text(
                            text = "Last Expiry: $formattedActivationExpiry",
                            fontSize = 12.sp,
                            color = Color(0xFF78350F)
                        )
                        Text(
                            text = "Choose an activation package below to renew your portal access and resume clinic operations.",
                            fontSize = 11.sp,
                            color = Color(0xFF92400E)
                        )
                    }
                }

                // Plan Selection
                Text(
                    text = "Select Activation Period",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    modifier = Modifier.align(Alignment.Start)
                )

                // 1 Month Plan Card
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (selectedPlan == "1_month") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
                    ),
                    border = BorderStroke(
                        if (selectedPlan == "1_month") 2.dp else 1.dp,
                        if (selectedPlan == "1_month") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { selectedPlan = "1_month" }
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("1 Month Access", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                                ) {
                                    Text("30 Days", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                }
                            }
                            Text("Full OPD Queue & Doctor Slot Management", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text("Rs. 1,500", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }

                // 12 Months Plan Card
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (selectedPlan == "12_month") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
                    ),
                    border = BorderStroke(
                        if (selectedPlan == "12_month") 2.dp else 1.dp,
                        if (selectedPlan == "12_month") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { selectedPlan = "12_month" }
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("12 Months (1 Year)", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color(0xFF059669).copy(alpha = 0.15f)
                                ) {
                                    Text("Save Rs. 3,000", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF059669), modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                }
                            }
                            Text("365 Days • Uninterrupted clinic & patient portal", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text("Rs. 15,000", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }

                // Payment Instructions Card
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("App Owner Payment Details", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("Transfer the subscription fee via eSewa, Khalti, or Direct Bank:", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFF3F4F6),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("• eSewa / Khalti ID: 9841000000 (Dactor Admin)", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                Text("• Bank: Nabil Bank | A/C: 01234567890123", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                Text("• Account Holder: Dactor Health Nepal Pvt Ltd", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }

                // Reference / Transaction Note Field
                OutlinedTextField(
                    value = paymentTransactionNote,
                    onValueChange = { paymentTransactionNote = it },
                    label = { Text("Transaction ID / Payment Reference Note") },
                    placeholder = { Text("e.g. eSewa TxID 9841-ABC or Depositor Name") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                if (renewalSubmittedMessage != null) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFD1FAE5),
                        border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = renewalSubmittedMessage ?: "",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF065F46),
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                // Submit Payment Button
                Button(
                    onClick = {
                        val effClinicId = clinic?.id ?: sessionManager.getSavedClinicId() ?: ""
                        if (effClinicId.isNotBlank() && clinicRepository != null) {
                            isSubmittingPayment = true
                            coroutineScope.launch {
                                val amount = if (selectedPlan == "12_month") 15000.0 else 1500.0
                                val notes = paymentTransactionNote.trim().ifBlank {
                                    "Activation payment for $selectedPlan submitted from clinic app"
                                }
                                val res = clinicRepository.requestActivationRenewal(
                                    clinicId = effClinicId,
                                    plan = selectedPlan,
                                    amount = amount,
                                    notes = notes
                                )
                                isSubmittingPayment = false
                                if (res.isSuccess) {
                                    renewalSubmittedMessage = "Payment details submitted! Admin will verify and activate your portal shortly."
                                    paymentTransactionNote = ""
                                    loadClinic()
                                } else {
                                    renewalSubmittedMessage = "Failed to submit request: ${res.exceptionOrNull()?.message}"
                                }
                            }
                        }
                    },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = !isSubmittingPayment
                ) {
                    if (isSubmittingPayment) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    } else {
                        Icon(Icons.Default.Payment, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(
                        text = if (selectedPlan == "12_month") "Submit 12-Month Activation (Rs. 15,000)" else "Submit 1-Month Activation (Rs. 1,500)",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }

                OutlinedButton(
                    onClick = {
                        sessionManager.clearSession()
                        try {
                            com.google.android.gms.auth.api.signin.GoogleSignIn.getClient(
                                context,
                                com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN
                            ).signOut()
                            com.google.firebase.auth.FirebaseAuth.getInstance().signOut()
                        } catch (ignored: Exception) {}
                        navController.navigate(NavRoutes.ClinicLogin) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Log Out from Clinic Account", fontWeight = FontWeight.Bold)
                }
            }
        } else {
            // =========================================================================
            // ACTIVE DASHBOARD VIEW: NORMAL CLINIC OPERATIONS
            // =========================================================================
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(scrollState)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (clinic == null && !isLoading) {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f))
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.AddBusiness, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Text("No Registered Clinic Loaded", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            Text(
                                "You are currently signed in as administrator. Register your clinic or hospital branch to configure services, OPD slots, and onboard physicians.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Button(
                                onClick = { navController.navigate(NavRoutes.ClinicRegister) },
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("Register Clinic Now")
                            }
                        }
                    }
                }

                // CLINIC SUBSCRIPTION & ACTIVATION STATUS BANNER
                if (clinic != null) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (activationDaysLeft <= 7) Color(0xFFFEF3C7) else Color(0xFFECFDF5)
                        ),
                        border = BorderStroke(1.dp, if (activationDaysLeft <= 7) Color(0xFFFDE68A) else Color(0xFFA7F3D0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    if (activationDaysLeft <= 7) Icons.Default.Warning else Icons.Default.Verified,
                                    contentDescription = null,
                                    tint = if (activationDaysLeft <= 7) Color(0xFFD97706) else Color(0xFF059669),
                                    modifier = Modifier.size(20.dp)
                                )
                                Column {
                                    Text(
                                        text = if (activationDaysLeft <= 7) "Subscription Expiring Soon ($activationDaysLeft days left)" else "Active Portal Subscription ($activationDaysLeft days left)",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = if (activationDaysLeft <= 7) Color(0xFF92400E) else Color(0xFF065F46)
                                    )
                                    Text(
                                        text = "Expires on $formattedActivationExpiry",
                                        fontSize = 11.sp,
                                        color = if (activationDaysLeft <= 7) Color(0xFFB45309) else Color(0xFF047857)
                                    )
                                }
                            }
                            TextButton(
                                onClick = { showRenewalDialog = true }
                            ) {
                                Text("Renew / Extend", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (activationDaysLeft <= 7) Color(0xFFB45309) else Color(0xFF059669))
                            }
                        }
                    }
                }

                // CLINIC VERIFICATION STATUS BANNER
                if (clinic?.verificationStatus?.equals("pending", ignoreCase = true) == true) {
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.HourglassTop, contentDescription = null, tint = Color(0xFFD97706))
                            Column {
                                Text("Waiting for Admin Confirmation", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF92400E))
                                Text("Your clinic registration is under review by the Super Admin. Full public patient discovery and booking will be enabled upon approval.", fontSize = 11.sp, color = Color(0xFF78350F))
                            }
                        }
                    }
                } else if (clinic != null) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFD1FAE5)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF047857), modifier = Modifier.size(16.dp))
                            Text("Clinic Verified & Active on Dactor Nepal", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF065F46))
                        }
                    }
                }

                // Section 1: Quick Action Cards
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                        modifier = Modifier
                            .weight(1f)
                            .clickable { navController.navigate(NavRoutes.QueueBoard) }
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Icon(Icons.Default.People, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
                            Spacer(Modifier.height(8.dp))
                            Text("Live Queue", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("Call next patient & manage turns", fontSize = 11.sp, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
                        }
                    }

                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                        modifier = Modifier
                            .weight(1f)
                            .clickable { navController.navigate(NavRoutes.WalkinBooking) }
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Icon(Icons.Default.PersonAdd, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(28.dp))
                            Spacer(Modifier.height(8.dp))
                            Text("Walk-in Token", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("Issue new 10-digit OPD token", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f))
                        }
                    }
                }

                // Section 2: Enlisted Doctors List with Clinic Presence Toggle
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
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
                            Text("Enlisted Doctors & Presence", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            TextButton(onClick = { navController.navigate(NavRoutes.InvitationManager) }) {
                                Text("+ Invite Doctor", fontSize = 12.sp)
                            }
                        }

                        if (doctors.isEmpty()) {
                            Text(
                                "No doctors enlisted yet. Invite medical specialists using their email.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        } else {
                            doctors.forEach { doctor ->
                                var isInClinic by remember(doctor.id, doctor.isInClinic) { mutableStateOf(doctor.isInClinic) }

                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Surface(
                                                shape = CircleShape,
                                                color = if (isInClinic) Color(0xFFD1FAE5) else Color(0xFFF3F4F6),
                                                modifier = Modifier.size(40.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Icon(
                                                        Icons.Default.MedicalServices,
                                                        contentDescription = null,
                                                        tint = if (isInClinic) Color(0xFF047857) else Color.Gray,
                                                        modifier = Modifier.size(20.dp)
                                                    )
                                                }
                                            }

                                            Column {
                                                Text(doctor.fullName, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                                Text(
                                                    "${doctor.specialty} • ${if (isInClinic) "Present in Clinic" else "Away / Off-Duty"}",
                                                    fontSize = 11.sp,
                                                    color = if (isInClinic) Color(0xFF047857) else MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                        }

                                        // Presence Toggle Control
                                        Switch(
                                            checked = isInClinic,
                                            onCheckedChange = { checked ->
                                                isInClinic = checked
                                                coroutineScope.launch {
                                                    doctorRepository?.toggleDoctorPresence(doctor.id, checked)
                                                }
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Section 3: Operational Modules Grid
                Text("Operational Management", fontWeight = FontWeight.Bold, fontSize = 16.sp)

                val modules = listOf(
                    ModuleItem(
                        title = "Slot Publishing",
                        desc = "Doctor schedules & capacity",
                        icon = Icons.Default.CalendarMonth,
                        route = NavRoutes.SlotManager,
                        color = Color(0xFF2563EB)
                    ),
                    ModuleItem(
                        title = "Patient Directory",
                        desc = "Past visits & history",
                        icon = Icons.Default.FolderShared,
                        route = NavRoutes.PatientDirectory,
                        color = Color(0xFF059669)
                    ),
                    ModuleItem(
                        title = "Future OPD",
                        desc = "Upcoming scheduled patients",
                        icon = Icons.Default.Event,
                        route = NavRoutes.FutureAppointments,
                        color = Color(0xFFD97706)
                    ),
                    ModuleItem(
                        title = "Catalog & Rates",
                        desc = "Consultation fees & procedures",
                        icon = Icons.Default.ReceiptLong,
                        route = NavRoutes.CatalogManager,
                        color = Color(0xFF7C3AED)
                    ),
                    ModuleItem(
                        title = "Diagnostic Lab",
                        desc = "Pathology sample workflow",
                        icon = Icons.Default.Science,
                        route = NavRoutes.LabWorkflow,
                        color = Color(0xFFDC2626)
                    ),
                    ModuleItem(
                        title = "Doctor Invites",
                        desc = "Enlist & manage specialists",
                        icon = Icons.Default.PersonAddAlt1,
                        route = NavRoutes.InvitationManager,
                        color = Color(0xFF0891B2)
                    ),
                    ModuleItem(
                        title = "Clinic Settings",
                        desc = "Type, APIs & profile",
                        icon = Icons.Default.Tune,
                        route = NavRoutes.ClinicSettings,
                        color = Color(0xFF4B5563)
                    )
                )

                modules.chunked(2).forEach { rowModules ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        rowModules.forEach { module ->
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(140.dp)
                                    .clickable { navController.navigate(module.route) }
                            ) {
                                Column(
                                    modifier = Modifier
                                        .padding(14.dp)
                                        .fillMaxSize(),
                                    verticalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .background(module.color.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(module.icon, contentDescription = null, tint = module.color, modifier = Modifier.size(20.dp))
                                    }

                                    Column {
                                        Text(module.title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        Text(module.desc, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, lineHeight = 13.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // EARLY RENEWAL DIALOG
    if (showRenewalDialog && clinic != null) {
        AlertDialog(
            onDismissRequest = { if (!isSubmittingPayment) showRenewalDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.CreditCard, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Text("Renew Portal Subscription", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Extend your clinic portal activation period. Active clinics can manage live queues and receive patient bookings.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

                    // 1 Month option
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (selectedPlan == "1_month") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        border = BorderStroke(if (selectedPlan == "1_month") 2.dp else 1.dp, if (selectedPlan == "1_month") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
                        onClick = { selectedPlan = "1_month" },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("1 Month Access (30 Days)", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("Standard monthly portal access", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text("Rs. 1,500", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                        }
                    }

                    // 12 Months option
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (selectedPlan == "12_month") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        border = BorderStroke(if (selectedPlan == "12_month") 2.dp else 1.dp, if (selectedPlan == "12_month") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
                        onClick = { selectedPlan = "12_month" },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("12 Months (1 Year)", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Surface(shape = RoundedCornerShape(4.dp), color = Color(0xFF059669).copy(alpha = 0.15f)) {
                                        Text("Save Rs 3,000", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF059669), modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                                    }
                                }
                                Text("365 Days annual license", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text("Rs. 15,000", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                        }
                    }

                    // Payment details
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFFF3F4F6),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("App Owner Payment Accounts:", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text("• eSewa / Khalti: 9841000000 (Dactor Admin)", fontSize = 11.sp)
                            Text("• Nabil Bank A/C: 01234567890123", fontSize = 11.sp)
                        }
                    }

                    OutlinedTextField(
                        value = paymentTransactionNote,
                        onValueChange = { paymentTransactionNote = it },
                        label = { Text("Payment Ref / TxID", fontSize = 12.sp) },
                        placeholder = { Text("e.g. eSewa TxID or Depositor Name", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val effClinicId = clinic?.id ?: sessionManager.getSavedClinicId() ?: ""
                        if (effClinicId.isNotBlank() && clinicRepository != null) {
                            isSubmittingPayment = true
                            coroutineScope.launch {
                                val amount = if (selectedPlan == "12_month") 15000.0 else 1500.0
                                val notes = paymentTransactionNote.trim().ifBlank {
                                    "Early renewal for $selectedPlan submitted from clinic app"
                                }
                                val res = clinicRepository.requestActivationRenewal(
                                    clinicId = effClinicId,
                                    plan = selectedPlan,
                                    amount = amount,
                                    notes = notes
                                )
                                isSubmittingPayment = false
                                if (res.isSuccess) {
                                    Toast.makeText(context, "Renewal request submitted to Admin!", Toast.LENGTH_LONG).show()
                                    paymentTransactionNote = ""
                                    showRenewalDialog = false
                                    loadClinic()
                                } else {
                                    Toast.makeText(context, "Failed: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    },
                    enabled = !isSubmittingPayment
                ) {
                    if (isSubmittingPayment) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text("Submit Renewal Request")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showRenewalDialog = false },
                    enabled = !isSubmittingPayment
                ) {
                    Text("Cancel")
                }
            }
        )
    }
}

data class ModuleItem(
    val title: String,
    val desc: String,
    val icon: ImageVector,
    val route: String,
    val color: Color
)
