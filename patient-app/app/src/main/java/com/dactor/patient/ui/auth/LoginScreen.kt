package com.dactor.patient.ui.auth

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.patient.data.local.RegistrationDraftManager
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.repository.AuthRepository
import com.dactor.patient.ui.navigation.NavRoutes
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    navController: NavController,
    authRepository: AuthRepository? = null,
    draftManager: RegistrationDraftManager? = null,
    sessionManager: UserSessionManager? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var currentView by remember { mutableStateOf("auth_choice") } // "auth_choice" or "register_form"
    var authActionIntent by remember { mutableStateOf("login") } // "login" or "register"

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var statusInfo by remember { mutableStateOf<String?>(null) }

    // Google Account Details
    var googleAccount by remember { mutableStateOf<GoogleSignInAccount?>(null) }
    var verifiedEmail by remember { mutableStateOf("") }
    var verifiedDisplayName by remember { mutableStateOf("") }

    // Patient Registration Form Inputs
    var patientName by remember { mutableStateOf("") }
    var patientPhone by remember { mutableStateOf("") }
    var patientAge by remember { mutableStateOf("") }
    var patientGender by remember { mutableStateOf("Male") }
    var patientCity by remember { mutableStateOf("") }

    val googleSignInClient = remember {
        val defaultWebClientId = try {
            val resId = context.resources.getIdentifier("default_web_client_id", "string", context.packageName)
            if (resId != 0) context.getString(resId) else null
        } catch (e: Exception) { null }

        val gsoBuilder = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()

        if (!defaultWebClientId.isNullOrBlank()) {
            gsoBuilder.requestIdToken(defaultWebClientId)
        }
        GoogleSignIn.getClient(context, gsoBuilder.build())
    }

    fun handleGoogleAccountReceived(account: GoogleSignInAccount) {
        coroutineScope.launch {
            try {
                googleAccount = account
                verifiedEmail = account.email ?: ""
                verifiedDisplayName = account.displayName ?: ""

                // Firebase Auth credential link
                val idToken = account.idToken
                if (!idToken.isNullOrBlank()) {
                    try {
                        val credential = GoogleAuthProvider.getCredential(idToken, null)
                        FirebaseAuth.getInstance().signInWithCredential(credential).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                if (authActionIntent == "register") {
                    // Open dedicated Registration Form directly
                    isLoading = false
                    statusInfo = null
                    patientName = verifiedDisplayName.ifBlank { "Patient" }
                    currentView = "register_form"
                    return@launch
                }

                // Default: SIGN IN FLOW -> Look up existing record
                statusInfo = "Looking up patient record in Supabase..."
                val trimmedEmail = verifiedEmail.trim().lowercase()

                val existingProfile = authRepository?.getProfileByEmail(trimmedEmail)
                if (existingProfile != null) {
                    val isArchived = existingProfile.isArchived == true
                    sessionManager?.savePatientSession(
                        patientId = existingProfile.id,
                        email = trimmedEmail,
                        name = existingProfile.fullName ?: verifiedDisplayName,
                        phone = existingProfile.phone ?: "",
                        gender = existingProfile.gender,
                        age = existingProfile.age,
                        isArchived = isArchived,
                        deletionScheduledAt = existingProfile.deletionScheduledAt
                    )
                    isLoading = false
                    if (isArchived) {
                        // Account in 30-day archive -> Open locked Profile with countdown, deletion date, and cancel option
                        navController.navigate(NavRoutes.Profile.route) {
                            popUpTo(NavRoutes.Login.route) { inclusive = true }
                        }
                    } else {
                        statusInfo = "Opening Dactor Patient Portal..."
                        navController.navigate(NavRoutes.Discovery.route) {
                            popUpTo(NavRoutes.Login.route) { inclusive = true }
                        }
                    }
                } else {
                    // No existing patient profile found
                    isLoading = false
                    statusInfo = null
                    patientName = verifiedDisplayName.ifBlank { "Patient" }
                    errorMessage = "No registered patient account found for $trimmedEmail. Please complete your registration below."
                    currentView = "register_form"
                }
            } catch (e: Exception) {
                isLoading = false
                statusInfo = null
                errorMessage = "Google login error: ${e.message ?: "Please try again."}"
            }
        }
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)
                if (account != null) {
                    handleGoogleAccountReceived(account)
                } else {
                    isLoading = false
                    errorMessage = "Unable to retrieve Google account details."
                }
            } catch (e: ApiException) {
                isLoading = false
                errorMessage = when (e.statusCode) {
                    7 -> "Network error. Please check your internet connection."
                    12501 -> "Sign-in cancelled."
                    else -> "Google sign-in error (${e.statusCode}): ${e.localizedMessage}"
                }
            }
        } else {
            isLoading = false
        }
    }

    fun submitPatientRegistration() {
        if (patientName.isBlank() || patientPhone.isBlank()) {
            errorMessage = "Please enter your full name and mobile phone number."
            return
        }
        isLoading = true
        errorMessage = null
        statusInfo = "Creating patient profile in Supabase..."

        coroutineScope.launch {
            try {
                val newProfileId = UUID.randomUUID().toString()
                val email = verifiedEmail.trim().lowercase()

                authRepository?.syncPatientProfile(
                    userId = newProfileId,
                    email = email,
                    fullName = patientName.trim(),
                    phone = patientPhone.trim()
                )

                sessionManager?.savePatientSession(
                    patientId = newProfileId,
                    email = email,
                    name = patientName.trim(),
                    phone = patientPhone.trim(),
                    gender = patientGender,
                    age = patientAge.toIntOrNull(),
                    isArchived = false,
                    deletionScheduledAt = null
                )

                isLoading = false
                statusInfo = null
                navController.navigate(NavRoutes.Discovery.route) {
                    popUpTo(NavRoutes.Login.route) { inclusive = true }
                }
            } catch (e: Exception) {
                isLoading = false
                statusInfo = null
                errorMessage = "Registration failed: ${e.message}"
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (currentView == "register_form") "Patient Registration" else "Patient Sign In",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    if (currentView == "register_form") {
                        IconButton(onClick = {
                            currentView = "auth_choice"
                            errorMessage = null
                        }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    } else {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Error Banner
            AnimatedVisibility(visible = errorMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Text(
                            text = errorMessage ?: "",
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Status Banner
            AnimatedVisibility(visible = statusInfo != null) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Text(
                            text = statusInfo ?: "",
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            if (currentView == "auth_choice") {
                Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.size(80.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.LocalHospital,
                            contentDescription = "Dactor Patient",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(44.dp)
                        )
                    }
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Welcome to Dactor Nepal",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Connect securely with your Google account. All your medical appointments, live token queues, and diagnostic lab reports will be linked.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                }

                Card(
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(22.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Unified Google Authentication Button
                        Button(
                            onClick = {
                                if (!isLoading) {
                                    isLoading = true
                                    errorMessage = null
                                    authActionIntent = "login"
                                    statusInfo = "Opening Google Sign-In..."
                                    googleSignInLauncher.launch(googleSignInClient.signInIntent)
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                            enabled = !isLoading
                        ) {
                            Icon(Icons.Default.AccountCircle, contentDescription = "Google", modifier = Modifier.size(24.dp))
                            Spacer(Modifier.width(10.dp))
                            Text("Continue with Google", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }
                }

                OutlinedButton(
                    onClick = {
                        navController.navigate(NavRoutes.Discovery.route) {
                            popUpTo(NavRoutes.Login.route) { inclusive = true }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Continue as Guest (No Login Required)", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
            } else {
                // REGISTRATION FORM VIEW
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = "Verified", tint = Color(0xFF2E7D32), modifier = Modifier.size(28.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Google Account Verified", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF2E7D32))
                            Text(verifiedEmail, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                            if (verifiedDisplayName.isNotBlank()) {
                                Text(verifiedDisplayName, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text("Patient Profile Details", fontWeight = FontWeight.Bold, fontSize = 17.sp)

                        OutlinedTextField(
                            value = patientName,
                            onValueChange = { patientName = it },
                            label = { Text("Full Name *") },
                            placeholder = { Text("e.g. Ram Bahadur Thapa") },
                            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )

                        OutlinedTextField(
                            value = patientPhone,
                            onValueChange = { patientPhone = it },
                            label = { Text("Mobile Phone Number *") },
                            placeholder = { Text("e.g. 9841234567") },
                            leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedTextField(
                                value = patientAge,
                                onValueChange = { patientAge = it },
                                label = { Text("Age") },
                                placeholder = { Text("28") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            )

                            OutlinedTextField(
                                value = patientCity,
                                onValueChange = { patientCity = it },
                                label = { Text("City / Town") },
                                placeholder = { Text("Kathmandu") },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            )
                        }

                        Text("Gender:", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("Male", "Female", "Other").forEach { g ->
                                FilterChip(
                                    selected = patientGender == g,
                                    onClick = { patientGender = g },
                                    label = { Text(g, fontSize = 11.sp) }
                                )
                            }
                        }

                        Button(
                            onClick = { submitPatientRegistration() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(12.dp),
                            enabled = !isLoading
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                                Spacer(Modifier.width(8.dp))
                                Text("Creating Profile...")
                            } else {
                                Icon(Icons.Default.Check, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Complete Registration & Enter Dactor", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
