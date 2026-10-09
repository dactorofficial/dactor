package com.dactor.clinic.ui.auth

import android.app.Activity
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
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
import com.dactor.clinic.data.local.RegistrationDraftManager
import com.dactor.clinic.data.local.UserSessionManager
import com.dactor.clinic.data.model.Clinic
import com.dactor.clinic.data.model.Doctor
import com.dactor.clinic.data.repository.AuthRepository
import com.dactor.clinic.data.repository.ClinicRepository
import com.dactor.clinic.data.repository.DoctorRepository
import com.dactor.clinic.ui.navigation.NavRoutes
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
fun ClinicLoginScreen(
    navController: NavController,
    authRepository: AuthRepository? = null,
    doctorRepository: DoctorRepository? = null,
    clinicRepository: ClinicRepository? = null,
    draftManager: RegistrationDraftManager? = null,
    sessionManager: UserSessionManager? = null,
    initialTab: Int = 0
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var selectedTab by remember { mutableIntStateOf(initialTab) } // 0: Clinic, 1: Doctor
    var currentView by remember { mutableStateOf("auth_choice") } // "auth_choice" or "register_form"
    var authActionIntent by remember { mutableStateOf("login") } // "login" or "register"

    var isLoading by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Google Account Details
    var googleAccount by remember { mutableStateOf<GoogleSignInAccount?>(null) }
    var verifiedEmail by remember { mutableStateOf("") }
    var verifiedDisplayName by remember { mutableStateOf("") }

    // Clinic Registration Form Fields
    var clinicName by remember { mutableStateOf("") }
    var clinicAddress by remember { mutableStateOf("") }
    var clinicLat by remember { mutableDoubleStateOf(27.7052) }
    var clinicLng by remember { mutableDoubleStateOf(85.3193) }
    var showLocationPicker by remember { mutableStateOf(false) }
    var clinicPan by remember { mutableStateOf("") } // 9 digit validation
    var clinicPhoneDigits by remember { mutableStateOf("") } // 10 digit phone (+977)
    var managerPhoneDigits by remember { mutableStateOf("") } // 10 digit phone (+977)
    var clinicRegDocUri by remember { mutableStateOf<Uri?>(null) }
    var clinicRegDocName by remember { mutableStateOf<String?>(null) }
    var clinicPictures by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var clinicType by remember { mutableStateOf("single_visit") }
    var clinicDesc by remember { mutableStateOf("") }

    // Doctor Registration Form Fields
    var doctorName by remember { mutableStateOf("") }
    var doctorGender by remember { mutableStateOf("Male") }
    var doctorAge by remember { mutableStateOf("") }
    var doctorStartingYear by remember { mutableStateOf("") }
    var doctorPictureUri by remember { mutableStateOf<Uri?>(null) }
    var doctorPictureName by remember { mutableStateOf<String?>(null) }
    var doctorSpecialty by remember { mutableStateOf("General Physician") }
    var doctorEducation by remember { mutableStateOf("") }
    var doctorNmc by remember { mutableStateOf("") }
    var doctorPersonalPhone by remember { mutableStateOf("") }
    var doctorPublicPhone by remember { mutableStateOf("") }
    var doctorDesc by remember { mutableStateOf("") }
    var doctorFee by remember { mutableStateOf("500") }

    // Pending Admin Verification State
    var pendingEntityName by remember { mutableStateOf("") }
    var pendingEmail by remember { mutableStateOf("") }
    var pendingRole by remember { mutableStateOf("clinic") } // "clinic" or "doctor"
    var pendingStatus by remember { mutableStateOf("pending") } // "pending" or "rejected"
    var pendingDetails by remember { mutableStateOf("") }
    var pendingId by remember { mutableStateOf("") }

    var isUnregisteredAccountNotice by remember { mutableStateOf(false) }

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

    LaunchedEffect(Unit) {
        // Clear active login session so returning from launcher home never resumes a stale account
        sessionManager?.clearActiveLoginSession()
        try {
            googleSignInClient.signOut()
        } catch (ignored: Exception) {}

        // Check if there was a pending registration waiting for review
        val pending = sessionManager?.getPendingVerification()
        if (pending != null) {
            coroutineScope.launch {
                try {
                    if (pending.role == "clinic") {
                        val clinic = clinicRepository?.getClinicByEmail(pending.email)
                        if (clinic != null) {
                            if (clinic.verificationStatus.equals("approved", ignoreCase = true)) {
                                sessionManager.clearPendingVerification()
                                sessionManager.saveClinicSession(clinic.id, clinic.contactEmail ?: pending.email, clinic.name)
                                navController.navigate("${NavRoutes.Dashboard}/${clinic.id}") {
                                    popUpTo(NavRoutes.ClinicLogin) { inclusive = true }
                                }
                            } else {
                                pendingEntityName = clinic.name
                                pendingEmail = clinic.contactEmail ?: pending.email
                                pendingRole = "clinic"
                                pendingStatus = clinic.verificationStatus ?: "pending"
                                pendingDetails = "${(clinic.type ?: "clinic").replace('_', ' ').replaceFirstChar { it.uppercase() }} • ${clinic.addressText ?: "Nepal"}"
                                pendingId = clinic.id
                                currentView = "pending_verification"
                            }
                        }
                    } else {
                        val doc = doctorRepository?.getDoctorByEmail(pending.email)
                        if (doc != null) {
                            if (doc.kycStatus.equals("approved", ignoreCase = true) || doc.kycStatus.equals("verified", ignoreCase = true)) {
                                sessionManager.clearPendingVerification()
                                sessionManager.saveDoctorSession(doc.id, doc.email, doc.fullName)
                                navController.navigate("${NavRoutes.DoctorDashboard}/${doc.id}") {
                                    popUpTo(NavRoutes.ClinicLogin) { inclusive = true }
                                }
                            } else {
                                pendingEntityName = doc.fullName
                                pendingEmail = doc.email
                                pendingRole = "doctor"
                                pendingStatus = doc.kycStatus ?: "pending"
                                pendingDetails = "NMC: ${doc.nmcLicenseNumber ?: "N/A"} • ${doc.specialty ?: "General"}"
                                pendingId = doc.id
                                currentView = "pending_verification"
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun handleGoogleAccountReceived(account: GoogleSignInAccount) {
        coroutineScope.launch {
            try {
                googleAccount = account
                verifiedEmail = account.email ?: ""
                verifiedDisplayName = account.displayName ?: ""

                // Firebase Auth credential link in background
                val idToken = account.idToken
                if (!idToken.isNullOrBlank()) {
                    try {
                        val credential = GoogleAuthProvider.getCredential(idToken, null)
                        FirebaseAuth.getInstance().signInWithCredential(credential).await()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                statusMessage = "Looking up your account in Supabase..."
                val trimmedEmail = verifiedEmail.trim().lowercase()

                if (selectedTab == 0) {
                    // Look up Clinic
                    val existingClinic = clinicRepository?.getClinicByEmail(trimmedEmail)
                    if (existingClinic != null) {
                        if (existingClinic.isArchived == true) {
                            val daysRemaining = com.dactor.clinic.domain.util.ArchiveDateUtils.calculateDaysRemaining(existingClinic.deletionScheduledAt)
                            if (daysRemaining <= 0) {
                                try {
                                    clinicRepository.purgeExceededArchivedClinicData(existingClinic.id)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                                isLoading = false
                                statusMessage = null
                                errorMessage = "This clinic account exceeded the 30-day archive period and was permanently deleted along with all associated patient records."
                                return@launch
                            } else {
                                statusMessage = "Opening Clinic Archive..."
                                sessionManager?.saveClinicSession(existingClinic.id, existingClinic.contactEmail ?: trimmedEmail, existingClinic.name)
                                sessionManager?.setClinicArchivedStatus(true, existingClinic.deletionScheduledAt)
                                authRepository?.syncProfile(account.id ?: "", trimmedEmail, existingClinic.name, "clinic_admin")
                                isLoading = false
                                navController.navigate("${NavRoutes.Dashboard}/${existingClinic.id}") {
                                    popUpTo(NavRoutes.ClinicLogin) { inclusive = true }
                                }
                                return@launch
                            }
                        } else {
                            sessionManager?.setClinicArchivedStatus(false, null)
                        }

                        val isApproved = existingClinic.verificationStatus.equals("approved", ignoreCase = true)
                        if (isApproved) {
                            sessionManager?.clearPendingVerification()
                            statusMessage = "Opening Clinic Portal..."
                            sessionManager?.saveClinicSession(existingClinic.id, existingClinic.contactEmail ?: trimmedEmail, existingClinic.name)
                            authRepository?.syncProfile(account.id ?: "", trimmedEmail, existingClinic.name, "clinic_admin")
                            isLoading = false
                            navController.navigate("${NavRoutes.Dashboard}/${existingClinic.id}") {
                                popUpTo(NavRoutes.ClinicLogin) { inclusive = true }
                            }
                        } else {
                            // Application pending or rejected by Admin
                            isLoading = false
                            statusMessage = null
                            pendingEntityName = existingClinic.name
                            pendingEmail = existingClinic.contactEmail ?: trimmedEmail
                            pendingRole = "clinic"
                            pendingStatus = existingClinic.verificationStatus ?: "pending"
                            pendingDetails = "${(existingClinic.type ?: "clinic").replace('_', ' ').replaceFirstChar { it.uppercase() }} • ${existingClinic.addressText ?: "Nepal"}"
                            pendingId = existingClinic.id
                            sessionManager?.savePendingVerification(
                                email = pendingEmail,
                                role = "clinic",
                                name = pendingEntityName,
                                id = pendingId,
                                details = pendingDetails,
                                status = pendingStatus
                            )
                            currentView = "pending_verification"
                        }
                    } else {
                        // No existing clinic found -> Ask for information as a new account
                        isLoading = false
                        statusMessage = null
                        clinicName = verifiedDisplayName.ifBlank { "Medical Clinic" }
                        isUnregisteredAccountNotice = (authActionIntent == "login")
                        currentView = "register_form"
                    }
                } else {
                    // Look up Doctor
                    val existingDoctor = doctorRepository?.getDoctorByEmail(trimmedEmail)
                    if (existingDoctor != null) {
                        val isApproved = existingDoctor.kycStatus.equals("approved", ignoreCase = true) ||
                                existingDoctor.kycStatus.equals("verified", ignoreCase = true)
                        if (isApproved) {
                            sessionManager?.clearPendingVerification()
                            statusMessage = "Opening Doctor Dashboard..."
                            sessionManager?.saveDoctorSession(existingDoctor.id, existingDoctor.email, existingDoctor.fullName)
                            authRepository?.syncProfile(account.id ?: "", trimmedEmail, existingDoctor.fullName, "doctor")
                            isLoading = false
                            navController.navigate("${NavRoutes.DoctorDashboard}/${existingDoctor.id}") {
                                popUpTo(NavRoutes.ClinicLogin) { inclusive = true }
                            }
                        } else {
                            // Application pending or rejected by Admin
                            isLoading = false
                            statusMessage = null
                            pendingEntityName = existingDoctor.fullName
                            pendingEmail = existingDoctor.email
                            pendingRole = "doctor"
                            pendingStatus = existingDoctor.kycStatus ?: "pending"
                            pendingDetails = "NMC: ${existingDoctor.nmcLicenseNumber ?: "N/A"} • ${existingDoctor.specialty ?: "General"}"
                            pendingId = existingDoctor.id
                            sessionManager?.savePendingVerification(
                                email = pendingEmail,
                                role = "doctor",
                                name = pendingEntityName,
                                id = pendingId,
                                details = pendingDetails,
                                status = pendingStatus
                            )
                            currentView = "pending_verification"
                        }
                    } else {
                        // No existing doctor found -> Ask for information as a new account
                        isLoading = false
                        statusMessage = null
                        doctorName = if (verifiedDisplayName.startsWith("Dr.", ignoreCase = true)) verifiedDisplayName else "Dr. $verifiedDisplayName"
                        isUnregisteredAccountNotice = (authActionIntent == "login")
                        currentView = "register_form"
                    }
                }
            } catch (e: Exception) {
                isLoading = false
                statusMessage = null
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
                    statusMessage = null
                    errorMessage = "Unable to read Google account."
                }
            } catch (e: ApiException) {
                isLoading = false
                statusMessage = null
                errorMessage = when (e.statusCode) {
                    7 -> "Network error. Please check your connection."
                    12501 -> null // User cancelled account chooser
                    else -> "Google sign-in error (${e.statusCode}): ${e.localizedMessage}"
                }
            }
        } else {
            isLoading = false
            statusMessage = null
        }
    }

    // Registration Paper Picker Launcher
    val regDocLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            clinicRegDocUri = uri
            clinicRegDocName = uri.lastPathSegment?.substringAfterLast('/') ?: "registration_doc.pdf"
        }
    }

    // Clinic Picture Picker Launcher (1-4 pictures, selected one by one)
    val clinicPictureLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null && clinicPictures.size < 4) {
            clinicPictures = clinicPictures + uri
        }
    }

    // Doctor Profile Picture Launcher
    val doctorPictureLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            doctorPictureUri = uri
            doctorPictureName = uri.lastPathSegment?.substringAfterLast('/') ?: "doctor_photo.jpg"
        }
    }

    fun launchGoogleSignIn(intentType: String) {
        if (isLoading) return
        isLoading = true
        errorMessage = null
        authActionIntent = intentType
        statusMessage = "Opening Google account chooser..."
        isUnregisteredAccountNotice = false
        try {
            // ALWAYS sign out first so Google Play Services shows the account chooser dialog
            // listing all available Gmail accounts on the device every single time
            googleSignInClient.signOut().addOnCompleteListener {
                try {
                    googleSignInLauncher.launch(googleSignInClient.signInIntent)
                } catch (e: Exception) {
                    isLoading = false
                    statusMessage = null
                    errorMessage = "Failed to open account chooser: ${e.message}"
                }
            }
        } catch (e: Exception) {
            try {
                googleSignInLauncher.launch(googleSignInClient.signInIntent)
            } catch (e2: Exception) {
                isLoading = false
                statusMessage = null
                errorMessage = "Failed to launch Google Sign-In: ${e2.message}"
            }
        }
    }

    fun switchGoogleAccount() {
        isLoading = true
        errorMessage = null
        statusMessage = "Opening Google account chooser..."
        isUnregisteredAccountNotice = false
        verifiedEmail = ""
        verifiedDisplayName = ""
        googleAccount = null
        try {
            googleSignInClient.signOut().addOnCompleteListener {
                try {
                    googleSignInLauncher.launch(googleSignInClient.signInIntent)
                } catch (e: Exception) {
                    isLoading = false
                    statusMessage = null
                    errorMessage = "Failed to open account chooser: ${e.message}"
                }
            }
        } catch (e: Exception) {
            try {
                googleSignInLauncher.launch(googleSignInClient.signInIntent)
            } catch (e2: Exception) {
                isLoading = false
                statusMessage = null
                errorMessage = "Failed to launch account picker: ${e2.message}"
            }
        }
    }

    fun resetToAuthChoice() {
        sessionManager?.clearSession()
        isLoading = false
        statusMessage = null
        errorMessage = null
        isUnregisteredAccountNotice = false
        verifiedEmail = ""
        verifiedDisplayName = ""
        googleAccount = null
        clinicName = ""
        clinicAddress = ""
        clinicPan = ""
        clinicPhoneDigits = ""
        managerPhoneDigits = ""
        clinicRegDocUri = null
        clinicRegDocName = null
        clinicPictures = emptyList()
        clinicDesc = ""
        doctorName = ""
        doctorGender = "Male"
        doctorAge = ""
        doctorStartingYear = ""
        doctorPictureUri = null
        doctorPictureName = null
        doctorSpecialty = "General Physician"
        doctorEducation = ""
        doctorNmc = ""
        doctorPersonalPhone = ""
        doctorPublicPhone = ""
        doctorDesc = ""
        currentView = "auth_choice"
        try {
            googleSignInClient.signOut()
            FirebaseAuth.getInstance().signOut()
        } catch (ignored: Exception) {}
    }

    fun submitClinicRegistration() {
        if (clinicName.isBlank()) {
            errorMessage = "Please enter the clinic / hospital name."
            return
        }
        if (clinicAddress.isBlank()) {
            errorMessage = "Please enter or pick the clinic location."
            return
        }
        val cleanPan = clinicPan.trim()
        if (cleanPan.length != 9 || !cleanPan.all { it.isDigit() }) {
            errorMessage = "PAN number must be exactly 9 digits."
            return
        }
        val cleanClinicPhone = clinicPhoneDigits.trim()
        if (cleanClinicPhone.length != 10 || !cleanClinicPhone.all { it.isDigit() }) {
            errorMessage = "Clinic contact number must be exactly 10 digits (country code +977)."
            return
        }
        val cleanManagerPhone = managerPhoneDigits.trim()
        if (cleanManagerPhone.length != 10 || !cleanManagerPhone.all { it.isDigit() }) {
            errorMessage = "Manager contact number must be exactly 10 digits (country code +977)."
            return
        }
        if (clinicPictures.isEmpty()) {
            errorMessage = "Please upload at least 1 clinic picture (1 to 4 pictures required)."
            return
        }
        if (clinicPictures.size > 4) {
            errorMessage = "Maximum 4 clinic pictures allowed."
            return
        }

        isLoading = true
        errorMessage = null
        statusMessage = "Submitting clinic registration to Supabase..."

        coroutineScope.launch {
            try {
                val newId = UUID.randomUUID().toString()
                val email = verifiedEmail.trim().lowercase()
                val newClinic = Clinic(
                    id = newId,
                    name = clinicName.trim(),
                    type = clinicType,
                    verificationStatus = "pending", // Pending admin verification
                    contactPhone = "+977$cleanClinicPhone",
                    contactEmail = email,
                    addressText = clinicAddress.trim(),
                    latitude = clinicLat,
                    longitude = clinicLng,
                    autoNotifyThreshold = 2,
                    description = clinicDesc.trim().ifBlank { null },
                    panNumber = cleanPan,
                    managerPhone = "+977$cleanManagerPhone",
                    registrationDocUrl = clinicRegDocUri?.toString(),
                    pictures = clinicPictures.map { it.toString() }
                )

                clinicRepository?.createClinic(newClinic)
                authRepository?.syncProfile(googleAccount?.id ?: "", email, newClinic.name, "clinic_admin")

                isLoading = false
                statusMessage = null

                pendingEntityName = newClinic.name
                pendingEmail = email
                pendingRole = "clinic"
                pendingStatus = "pending"
                pendingDetails = "PAN: $cleanPan • ${(newClinic.type ?: "clinic").replace('_', ' ').replaceFirstChar { it.uppercase() }} • ${newClinic.addressText ?: "Nepal"}"
                pendingId = newId
                sessionManager?.savePendingVerification(
                    email = email,
                    role = "clinic",
                    name = newClinic.name,
                    id = newId,
                    details = pendingDetails,
                    status = "pending"
                )
                currentView = "pending_verification"
            } catch (e: Exception) {
                isLoading = false
                statusMessage = null
                errorMessage = "Failed to submit clinic registration: ${e.message}"
            }
        }
    }

    fun submitDoctorRegistration() {
        if (doctorName.isBlank() || doctorSpecialty.isBlank() || doctorNmc.isBlank()) {
            errorMessage = "Please fill in doctor name, specialization, and NMC license ID."
            return
        }
        val cleanAge = doctorAge.trim().toIntOrNull()
        if (doctorAge.isNotBlank() && (cleanAge == null || cleanAge < 20 || cleanAge > 100)) {
            errorMessage = "Please enter a valid age between 20 and 100."
            return
        }
        val cleanYear = doctorStartingYear.trim().toIntOrNull()
        if (doctorStartingYear.isNotBlank() && (cleanYear == null || cleanYear < 1960 || cleanYear > 2026)) {
            errorMessage = "Please enter a valid starting practicing year (e.g. 2018)."
            return
        }
        val cleanPersonal = doctorPersonalPhone.trim()
        if (cleanPersonal.isNotBlank() && (cleanPersonal.length != 10 || !cleanPersonal.all { it.isDigit() })) {
            errorMessage = "Personal mobile number must be exactly 10 digits."
            return
        }
        val cleanPublic = doctorPublicPhone.trim()
        if (cleanPublic.isNotBlank() && (cleanPublic.length != 10 || !cleanPublic.all { it.isDigit() })) {
            errorMessage = "Public mobile number must be exactly 10 digits."
            return
        }

        isLoading = true
        errorMessage = null
        statusMessage = "Submitting doctor profile to Supabase..."

        coroutineScope.launch {
            try {
                val newId = UUID.randomUUID().toString()
                val email = verifiedEmail.trim().lowercase()
                val newDoctor = Doctor(
                    id = newId,
                    fullName = doctorName.trim(),
                    email = email,
                    gender = doctorGender,
                    age = cleanAge,
                    startingPracticingYear = cleanYear,
                    profilePictureUrl = doctorPictureUri?.toString(),
                    specialty = doctorSpecialty.trim(),
                    education = doctorEducation.trim().ifBlank { null },
                    nmcLicenseNumber = doctorNmc.trim(),
                    personalMobileNumber = if (cleanPersonal.isNotBlank()) cleanPersonal else null,
                    publicMobileNumber = if (cleanPublic.isNotBlank()) cleanPublic else null,
                    description = doctorDesc.trim().ifBlank { null },
                    kycStatus = "pending", // Pending admin verification
                    isInClinic = true,
                    consultationFee = doctorFee.toDoubleOrNull() ?: 500.0
                )

                doctorRepository?.createDoctor(newDoctor)
                authRepository?.syncProfile(googleAccount?.id ?: "", email, newDoctor.fullName, "doctor")

                isLoading = false
                statusMessage = null

                pendingEntityName = newDoctor.fullName
                pendingEmail = email
                pendingRole = "doctor"
                pendingStatus = "pending"
                pendingDetails = "NMC: ${newDoctor.nmcLicenseNumber} • ${newDoctor.specialty ?: "General"}"
                pendingId = newId
                sessionManager?.savePendingVerification(
                    email = email,
                    role = "doctor",
                    name = newDoctor.fullName,
                    id = newId,
                    details = pendingDetails,
                    status = "pending"
                )
                currentView = "pending_verification"
            } catch (e: Exception) {
                isLoading = false
                statusMessage = null
                errorMessage = "Failed to submit doctor profile: ${e.message}"
            }
        }
    }

    fun checkVerificationStatus() {
        isLoading = true
        errorMessage = null
        statusMessage = "Checking verification status with Admin..."
        val email = pendingEmail.trim().lowercase()

        coroutineScope.launch {
            try {
                if (pendingRole == "clinic") {
                    val refreshedClinic = if (pendingId.isNotBlank()) {
                        clinicRepository?.getClinicById(pendingId)
                    } else {
                        clinicRepository?.getClinicByEmail(email)
                    }

                    if (refreshedClinic != null) {
                        pendingStatus = refreshedClinic.verificationStatus ?: "pending"
                        if (refreshedClinic.verificationStatus.equals("approved", ignoreCase = true)) {
                            statusMessage = "Your clinic has been verified! Opening portal..."
                            sessionManager?.saveClinicSession(refreshedClinic.id, refreshedClinic.contactEmail ?: email, refreshedClinic.name)
                            authRepository?.syncProfile(googleAccount?.id ?: "", email, refreshedClinic.name, "clinic_admin")
                            isLoading = false
                            navController.navigate("${NavRoutes.Dashboard}/${refreshedClinic.id}") {
                                popUpTo(NavRoutes.ClinicLogin) { inclusive = true }
                            }
                        } else if (refreshedClinic.verificationStatus.equals("rejected", ignoreCase = true)) {
                            isLoading = false
                            statusMessage = null
                            errorMessage = "Your clinic registration was rejected by the admin team. Please contact support."
                        } else {
                            isLoading = false
                            statusMessage = "Your clinic application is still pending admin review. Please wait for admin approval."
                        }
                    } else {
                        isLoading = false
                        statusMessage = null
                        errorMessage = "Record not found. Please try logging in again."
                    }
                } else {
                    val refreshedDoctor = if (pendingId.isNotBlank()) {
                        doctorRepository?.getDoctorById(pendingId)
                    } else {
                        doctorRepository?.getDoctorByEmail(email)
                    }

                    if (refreshedDoctor != null) {
                        pendingStatus = refreshedDoctor.kycStatus ?: "pending"
                        if (refreshedDoctor.kycStatus.equals("approved", ignoreCase = true) ||
                            refreshedDoctor.kycStatus.equals("verified", ignoreCase = true)
                        ) {
                            statusMessage = "Your doctor profile has been verified! Opening OPD dashboard..."
                            sessionManager?.saveDoctorSession(refreshedDoctor.id, refreshedDoctor.email, refreshedDoctor.fullName)
                            authRepository?.syncProfile(googleAccount?.id ?: "", email, refreshedDoctor.fullName, "doctor")
                            isLoading = false
                            navController.navigate("${NavRoutes.DoctorDashboard}/${refreshedDoctor.id}") {
                                popUpTo(NavRoutes.ClinicLogin) { inclusive = true }
                            }
                        } else if (refreshedDoctor.kycStatus.equals("rejected", ignoreCase = true)) {
                            isLoading = false
                            statusMessage = null
                            errorMessage = "Your doctor KYC was rejected by the admin team. Please contact support."
                        } else {
                            isLoading = false
                            statusMessage = "Your doctor KYC is still pending admin verification. Please wait for admin approval."
                        }
                    } else {
                        isLoading = false
                        statusMessage = null
                        errorMessage = "Record not found. Please try logging in again."
                    }
                }
            } catch (e: Exception) {
                isLoading = false
                statusMessage = null
                errorMessage = "Failed to refresh verification status: ${e.message}"
            }
        }
    }

    fun signOutFromPending() {
        try {
            googleSignInClient.signOut()
            FirebaseAuth.getInstance().signOut()
            sessionManager?.clearSession()
        } catch (ignored: Exception) {}
        currentView = "auth_choice"
        errorMessage = null
        statusMessage = null
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (currentView) {
                            "register_form" -> if (selectedTab == 0) "Clinic Registration" else "Doctor Registration"
                            "pending_verification" -> "Admin Verification"
                            else -> "Dactor Portal"
                        },
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    if (currentView == "register_form") {
                        IconButton(onClick = { resetToAuthChoice() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    } else if (currentView == "pending_verification") {
                        IconButton(onClick = { signOutFromPending() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
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
            AnimatedVisibility(visible = statusMessage != null) {
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
                            text = statusMessage ?: "",
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            if (currentView == "auth_choice") {
                // Portal Selector Tabs
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color.Transparent,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    TabRow(
                        selectedTabIndex = selectedTab,
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = {
                                selectedTab = 0
                                errorMessage = null
                            },
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Icon(Icons.Default.LocalHospital, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Text("Clinic Staff", fontWeight = FontWeight.Bold)
                                }
                            }
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = {
                                selectedTab = 1
                                errorMessage = null
                            },
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Icon(Icons.Default.MedicalServices, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Text("Doctor / Specialist", fontWeight = FontWeight.Bold)
                                }
                            }
                        )
                    }
                }

                // Portal Avatar Icon
                Surface(
                    shape = CircleShape,
                    color = if (selectedTab == 0) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.tertiaryContainer,
                    modifier = Modifier.size(80.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (selectedTab == 0) Icons.Default.LocalHospital else Icons.Default.MedicalServices,
                            contentDescription = null,
                            tint = if (selectedTab == 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.size(44.dp)
                        )
                    }
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (selectedTab == 0) "Clinic & Reception Portal" else "Doctor & Specialist Portal",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (selectedTab == 0)
                            "Manage tokens, walk-ins, queues, and services for your clinic in Nepal."
                        else
                            "Track active patient queue, conduct consultations, and order diagnostic labs.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                }

                // Primary Actions Card
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
                        // Single Unified Google Authentication Button
                        Button(
                            onClick = { launchGoogleSignIn("login") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (selectedTab == 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.tertiary
                            ),
                            enabled = !isLoading
                        ) {
                            Icon(Icons.Default.AccountCircle, contentDescription = "Google", modifier = Modifier.size(24.dp))
                            Spacer(Modifier.width(10.dp))
                            Text(
                                "Continue with Google",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                    }
                }

                // Security Note
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Shield, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                        Text(
                            text = "Authenticated with Firebase Auth. All data and realtime queues stored securely in Supabase Cloud PostgreSQL.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 15.sp
                        )
                    }
                }
            } else if (currentView == "register_form") {
                // REGISTRATION FORM VIEW

                // Unregistered Account Notice (if mistakenly selected an unregistered account during login)
                if (isUnregisteredAccountNotice) {
                    Surface(
                        color = Color(0xFFFEF3C7),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.WarningAmber, contentDescription = null, tint = Color(0xFFB45309), modifier = Modifier.size(20.dp))
                                Text(
                                    text = "Account Not Registered",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color(0xFF92400E)
                                )
                            }
                            Text(
                                text = "No ${if (selectedTab == 0) "Clinic" else "Doctor"} profile is registered under \"$verifiedEmail\". Complete your details below to register, or tap Switch Account to use another Gmail.",
                                fontSize = 12.sp,
                                color = Color(0xFF78350F),
                                lineHeight = 16.sp
                            )
                        }
                    }
                }

                // Google Account Verification Card with quick "Switch" action
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Verified", tint = Color(0xFF2E7D32), modifier = Modifier.size(28.dp))
                            Column {
                                Text("Selected Google Account", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF2E7D32))
                                Text(verifiedEmail, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                                if (verifiedDisplayName.isNotBlank()) {
                                    Text(verifiedDisplayName, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }

                        OutlinedButton(
                            onClick = { switchGoogleAccount() },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(34.dp),
                            enabled = !isLoading
                        ) {
                            Icon(Icons.Default.SwapHoriz, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Switch", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                if (selectedTab == 0) {
                    // CLINIC FORM
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
                            Text("Clinic Details", fontWeight = FontWeight.Bold, fontSize = 17.sp)

                            // 1. Clinic Name
                            OutlinedTextField(
                                value = clinicName,
                                onValueChange = { clinicName = it },
                                label = { Text("Name of the Clinic *") },
                                placeholder = { Text("e.g. Patan Health Care Polyclinic") },
                                leadingIcon = { Icon(Icons.Default.LocalHospital, contentDescription = null) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 2. Location (With Location Picker)
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                            Text("Clinic Location *", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                        }
                                        FilledTonalButton(
                                            onClick = { showLocationPicker = true },
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                            modifier = Modifier.height(32.dp)
                                        ) {
                                            Icon(Icons.Default.Map, contentDescription = null, modifier = Modifier.size(14.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Open Location Picker", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }

                                    OutlinedTextField(
                                        value = clinicAddress,
                                        onValueChange = { clinicAddress = it },
                                        placeholder = { Text("e.g. Lagankhel, Lalitpur (or tap picker)") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(10.dp)
                                    )

                                    Text(
                                        text = "Pinned GPS: (${String.format("%.4f", clinicLat)}, ${String.format("%.4f", clinicLng)})",
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            // 3. Registration Paper (Upload)
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Registration Paper (Upload) *", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                        Text(
                                            text = clinicRegDocName ?: "No file uploaded yet (PDF or Image)",
                                            fontSize = 11.sp,
                                            color = if (clinicRegDocName != null) Color(0xFF047857) else MaterialTheme.colorScheme.onSurfaceVariant,
                                            fontWeight = if (clinicRegDocName != null) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }

                                    OutlinedButton(
                                        onClick = { regDocLauncher.launch("*/*") },
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(34.dp)
                                    ) {
                                        Icon(Icons.Default.UploadFile, contentDescription = null, modifier = Modifier.size(14.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(if (clinicRegDocName != null) "Change" else "Upload", fontSize = 12.sp)
                                    }
                                }
                            }

                            // 4. PAN Number (always 9 digit)
                            OutlinedTextField(
                                value = clinicPan,
                                onValueChange = {
                                    if (it.length <= 9 && it.all { ch -> ch.isDigit() }) {
                                        clinicPan = it
                                    }
                                },
                                label = { Text("PAN Number (9 Digits Always) *") },
                                placeholder = { Text("e.g. 601234567") },
                                leadingIcon = { Icon(Icons.Default.Badge, contentDescription = null) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                supportingText = {
                                    Text(
                                        text = "${clinicPan.length}/9 digits" + if (clinicPan.length == 9) " ✓ Valid" else " (Must be exactly 9 digits)",
                                        color = if (clinicPan.length == 9) Color(0xFF047857) else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                },
                                isError = clinicPan.isNotBlank() && clinicPan.length != 9,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 5. Clinic Contact Number (+977 and 10 digits)
                            OutlinedTextField(
                                value = clinicPhoneDigits,
                                onValueChange = {
                                    if (it.length <= 10 && it.all { ch -> ch.isDigit() }) {
                                        clinicPhoneDigits = it
                                    }
                                },
                                label = { Text("Clinic Contact Number *") },
                                placeholder = { Text("98xxxxxxxx (10 digits)") },
                                prefix = { Text("+977 ", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) },
                                leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                singleLine = true,
                                supportingText = {
                                    Text(
                                        text = "Country code +977 • ${clinicPhoneDigits.length}/10 digits" + if (clinicPhoneDigits.length == 10) " ✓" else "",
                                        color = if (clinicPhoneDigits.length == 10) Color(0xFF047857) else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                },
                                isError = clinicPhoneDigits.isNotBlank() && clinicPhoneDigits.length != 10,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 6. Manager Contact Number (+977 and 10 digits)
                            OutlinedTextField(
                                value = managerPhoneDigits,
                                onValueChange = {
                                    if (it.length <= 10 && it.all { ch -> ch.isDigit() }) {
                                        managerPhoneDigits = it
                                    }
                                },
                                label = { Text("Manager Contact Number *") },
                                placeholder = { Text("98xxxxxxxx (10 digits)") },
                                prefix = { Text("+977 ", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) },
                                leadingIcon = { Icon(Icons.Default.ContactPhone, contentDescription = null) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                singleLine = true,
                                supportingText = {
                                    Text(
                                        text = "Country code +977 • ${managerPhoneDigits.length}/10 digits" + if (managerPhoneDigits.length == 10) " ✓" else "",
                                        color = if (managerPhoneDigits.length == 10) Color(0xFF047857) else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                },
                                isError = managerPhoneDigits.isNotBlank() && managerPhoneDigits.length != 10,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 7. Pictures of Clinic (1-4, one by one)
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text("Pictures of Clinic (1-4) *", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                            Text(
                                                text = if (clinicPictures.isEmpty()) "Add photos one by one (1 to 4)" else "${clinicPictures.size}/4 photos added" + if (clinicPictures.size >= 1) " ✓" else "",
                                                fontSize = 11.sp,
                                                color = if (clinicPictures.isNotEmpty()) Color(0xFF047857) else MaterialTheme.colorScheme.onSurfaceVariant,
                                                fontWeight = if (clinicPictures.isNotEmpty()) FontWeight.Bold else FontWeight.Normal
                                            )
                                        }

                                        if (clinicPictures.size < 4) {
                                            OutlinedButton(
                                                onClick = { clinicPictureLauncher.launch("image/*") },
                                                shape = RoundedCornerShape(8.dp),
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                                modifier = Modifier.height(34.dp)
                                            ) {
                                                Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(14.dp))
                                                Spacer(Modifier.width(4.dp))
                                                Text(if (clinicPictures.isEmpty()) "+ Add Photo" else "+ Add Another", fontSize = 12.sp)
                                            }
                                        }
                                    }

                                    // Compact Previews Row
                                    if (clinicPictures.isNotEmpty()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            clinicPictures.forEachIndexed { idx, picUri ->
                                                Box(
                                                    modifier = Modifier
                                                        .size(68.dp)
                                                        .clip(RoundedCornerShape(10.dp))
                                                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(10.dp))
                                                        .background(MaterialTheme.colorScheme.surfaceVariant)
                                                ) {
                                                    AsyncImage(
                                                        model = picUri,
                                                        contentDescription = "Clinic photo ${idx + 1}",
                                                        contentScale = ContentScale.Crop,
                                                        modifier = Modifier.fillMaxSize()
                                                    )
                                                    // Remove badge on top-right
                                                    Surface(
                                                        onClick = {
                                                            clinicPictures = clinicPictures.filterIndexed { i, _ -> i != idx }
                                                        },
                                                        shape = CircleShape,
                                                        color = Color.Black.copy(alpha = 0.7f),
                                                        modifier = Modifier
                                                            .align(Alignment.TopEnd)
                                                            .padding(3.dp)
                                                            .size(20.dp)
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Default.Close,
                                                            contentDescription = "Remove photo",
                                                            tint = Color.White,
                                                            modifier = Modifier.padding(3.dp)
                                                        )
                                                    }
                                                }
                                            }

                                            // Direct "+ Add" box if less than 4
                                            if (clinicPictures.size < 4) {
                                                Surface(
                                                    onClick = { clinicPictureLauncher.launch("image/*") },
                                                    shape = RoundedCornerShape(10.dp),
                                                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
                                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)),
                                                    modifier = Modifier.size(68.dp)
                                                ) {
                                                    Column(
                                                        modifier = Modifier.fillMaxSize(),
                                                        horizontalAlignment = Alignment.CenterHorizontally,
                                                        verticalArrangement = Arrangement.Center
                                                    ) {
                                                        Icon(
                                                            Icons.Default.Add,
                                                            contentDescription = "Add picture",
                                                            tint = MaterialTheme.colorScheme.primary,
                                                            modifier = Modifier.size(20.dp)
                                                        )
                                                        Text(
                                                            text = "Add",
                                                            fontSize = 10.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = MaterialTheme.colorScheme.primary
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // 8. Description
                            OutlinedTextField(
                                value = clinicDesc,
                                onValueChange = { clinicDesc = it },
                                label = { Text("Description") },
                                placeholder = { Text("Specialties, opening hours, facilities, etc.") },
                                maxLines = 3,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // Facility Type
                            Text("Facility Type:", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = clinicType == "single_visit",
                                    onClick = { clinicType = "single_visit" },
                                    label = { Text("Single Doctor", fontSize = 11.sp) }
                                )
                                FilterChip(
                                    selected = clinicType == "multi_visit",
                                    onClick = { clinicType = "multi_visit" },
                                    label = { Text("Polyclinic", fontSize = 11.sp) }
                                )
                                FilterChip(
                                    selected = clinicType == "diagnostic_lab",
                                    onClick = { clinicType = "diagnostic_lab" },
                                    label = { Text("Diagnostic Lab", fontSize = 11.sp) }
                                )
                            }

                            Button(
                                onClick = { submitClinicRegistration() },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp),
                                shape = RoundedCornerShape(12.dp),
                                enabled = !isLoading
                            ) {
                                if (isLoading) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Submitting...")
                                } else {
                                    Icon(Icons.Default.Check, contentDescription = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Submit Clinic for Admin Verification", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                } else {
                    // DOCTOR FORM
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
                            Text("Doctor Details", fontWeight = FontWeight.Bold, fontSize = 17.sp)

                            // 1. Name
                            OutlinedTextField(
                                value = doctorName,
                                onValueChange = { doctorName = it },
                                label = { Text("Full Name with Title *") },
                                placeholder = { Text("e.g. Dr. Ram Bahadur Sharma") },
                                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 2. Gender
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Gender *", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf("Male", "Female", "Other").forEach { g ->
                                        FilterChip(
                                            selected = doctorGender == g,
                                            onClick = { doctorGender = g },
                                            label = { Text(g, fontSize = 12.sp) }
                                        )
                                    }
                                }
                            }

                            // 3. Age & Starting Practicing Year in a Row
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                OutlinedTextField(
                                    value = doctorAge,
                                    onValueChange = {
                                        if (it.length <= 3 && it.all { ch -> ch.isDigit() }) doctorAge = it
                                    },
                                    label = { Text("Age *") },
                                    placeholder = { Text("e.g. 38") },
                                    leadingIcon = { Icon(Icons.Default.Cake, contentDescription = null) },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp)
                                )

                                OutlinedTextField(
                                    value = doctorStartingYear,
                                    onValueChange = {
                                        if (it.length <= 4 && it.all { ch -> ch.isDigit() }) doctorStartingYear = it
                                    },
                                    label = { Text("Practicing Since *") },
                                    placeholder = { Text("e.g. 2014") },
                                    leadingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null) },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp)
                                )
                            }

                            // 4. Picture Upload
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
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
                                        if (doctorPictureUri != null) {
                                            Box(
                                                modifier = Modifier
                                                    .size(54.dp)
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .border(1.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(8.dp))
                                            ) {
                                                AsyncImage(
                                                    model = doctorPictureUri,
                                                    contentDescription = "Doctor photo preview",
                                                    contentScale = ContentScale.Crop,
                                                    modifier = Modifier.fillMaxSize()
                                                )
                                                Surface(
                                                    onClick = {
                                                        doctorPictureUri = null
                                                        doctorPictureName = null
                                                    },
                                                    shape = CircleShape,
                                                    color = Color.Black.copy(alpha = 0.7f),
                                                    modifier = Modifier
                                                        .align(Alignment.TopEnd)
                                                        .padding(2.dp)
                                                        .size(18.dp)
                                                ) {
                                                    Icon(
                                                        imageVector = Icons.Default.Close,
                                                        contentDescription = "Remove photo",
                                                        tint = Color.White,
                                                        modifier = Modifier.padding(2.dp)
                                                    )
                                                }
                                            }
                                        }

                                        Column {
                                            Text("Doctor Picture / Photo", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                            Text(
                                                text = doctorPictureName ?: "Select doctor profile picture",
                                                fontSize = 11.sp,
                                                color = if (doctorPictureName != null) Color(0xFF047857) else MaterialTheme.colorScheme.onSurfaceVariant,
                                                fontWeight = if (doctorPictureName != null) FontWeight.Bold else FontWeight.Normal
                                            )
                                        }
                                    }

                                    OutlinedButton(
                                        onClick = { doctorPictureLauncher.launch("image/*") },
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(34.dp)
                                    ) {
                                        Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(14.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text(if (doctorPictureName != null) "Change" else "Upload", fontSize = 12.sp)
                                    }
                                }
                            }

                            // 5. Specialization
                            OutlinedTextField(
                                value = doctorSpecialty,
                                onValueChange = { doctorSpecialty = it },
                                label = { Text("Specialization *") },
                                placeholder = { Text("e.g. Cardiologist, Pediatrics, Orthopedics") },
                                leadingIcon = { Icon(Icons.Default.MedicalServices, contentDescription = null) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 6. Education
                            OutlinedTextField(
                                value = doctorEducation,
                                onValueChange = { doctorEducation = it },
                                label = { Text("Education / Qualifications *") },
                                placeholder = { Text("e.g. MBBS, MD (Internal Medicine) T.U.") },
                                leadingIcon = { Icon(Icons.Default.School, contentDescription = null) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 7. NMC ID
                            OutlinedTextField(
                                value = doctorNmc,
                                onValueChange = { doctorNmc = it },
                                label = { Text("NMC License ID *") },
                                placeholder = { Text("e.g. NMC-14520") },
                                leadingIcon = { Icon(Icons.Default.Badge, contentDescription = null) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 8. Personal Mobile Number
                            OutlinedTextField(
                                value = doctorPersonalPhone,
                                onValueChange = {
                                    if (it.length <= 10 && it.all { ch -> ch.isDigit() }) doctorPersonalPhone = it
                                },
                                label = { Text("Personal Mobile Number *") },
                                placeholder = { Text("98xxxxxxxx (10 digits)") },
                                leadingIcon = { Icon(Icons.Default.PhoneIphone, contentDescription = null) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 9. Public Mobile Number
                            OutlinedTextField(
                                value = doctorPublicPhone,
                                onValueChange = {
                                    if (it.length <= 10 && it.all { ch -> ch.isDigit() }) doctorPublicPhone = it
                                },
                                label = { Text("Public Mobile Number (For Patients)") },
                                placeholder = { Text("98xxxxxxxx (10 digits)") },
                                leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 10. Description
                            OutlinedTextField(
                                value = doctorDesc,
                                onValueChange = { doctorDesc = it },
                                label = { Text("Doctor Description / Bio") },
                                placeholder = { Text("Years of experience, special clinical interests, etc.") },
                                maxLines = 3,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            // 11. Consultation Fee
                            OutlinedTextField(
                                value = doctorFee,
                                onValueChange = { doctorFee = it },
                                label = { Text("Consultation Fee (Rs.) *") },
                                placeholder = { Text("500") },
                                leadingIcon = { Icon(Icons.Default.Payments, contentDescription = null) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )

                            Button(
                                onClick = { submitDoctorRegistration() },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary),
                                enabled = !isLoading
                            ) {
                                if (isLoading) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onTertiary)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Submitting...")
                                } else {
                                    Icon(Icons.Default.Check, contentDescription = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Submit Doctor Profile for Admin Verification", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // Cancel & Return Option
                TextButton(
                    onClick = { resetToAuthChoice() },
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    enabled = !isLoading
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Cancel and Return to Sign In", fontSize = 13.sp)
                }
            } else if (currentView == "pending_verification") {
                // PENDING ADMIN VERIFICATION VIEW
                val isRejected = pendingStatus.equals("rejected", ignoreCase = true)
                val isApproved = pendingStatus.equals("approved", ignoreCase = true) || pendingStatus.equals("verified", ignoreCase = true)

                Surface(
                    shape = CircleShape,
                    color = when {
                        isApproved -> MaterialTheme.colorScheme.primaryContainer
                        isRejected -> MaterialTheme.colorScheme.errorContainer
                        else -> Color(0xFFFFF3CD)
                    },
                    modifier = Modifier.size(90.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = when {
                                isApproved -> Icons.Default.CheckCircle
                                isRejected -> Icons.Default.Cancel
                                else -> Icons.Default.HourglassEmpty
                            },
                            contentDescription = null,
                            tint = when {
                                isApproved -> MaterialTheme.colorScheme.primary
                                isRejected -> MaterialTheme.colorScheme.error
                                else -> Color(0xFF856404)
                            },
                            modifier = Modifier.size(50.dp)
                        )
                    }
                }

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = when {
                            isApproved -> "Account Verified!"
                            isRejected -> "Application Rejected"
                            else -> "Verification Under Review"
                        },
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = when {
                            isApproved -> "Your credentials have been verified by the Admin. You can now access all portal features."
                            isRejected -> "Your registration was not approved by the admin team. Please contact Dactor support."
                            else -> "Your application has been received and is waiting for review by the Dactor Admin Team. Once verified, all clinic and OPD management features will unlock automatically."
                        },
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp
                    )
                }

                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Application Details", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = when {
                                    isApproved -> Color(0xFFD4EDDA)
                                    isRejected -> Color(0xFFF8D7DA)
                                    else -> Color(0xFFFFF3CD)
                                }
                            ) {
                                Text(
                                    text = when {
                                        isApproved -> "APPROVED"
                                        isRejected -> "REJECTED"
                                        else -> "PENDING REVIEW"
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = when {
                                        isApproved -> Color(0xFF155724)
                                        isRejected -> Color(0xFF721C24)
                                        else -> Color(0xFF856404)
                                    },
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }

                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Name / Title", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(pendingEntityName, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Registered Email", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(pendingEmail, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Role", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(if (pendingRole == "clinic") "Clinic Administration" else "Doctor / Specialist", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }

                        if (pendingDetails.isNotBlank()) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Details", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(pendingDetails, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }

                Button(
                    onClick = { checkVerificationStatus() },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    enabled = !isLoading
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text("Checking Status...")
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (isApproved) "Proceed to Portal" else "Check Verification Status", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }

                OutlinedButton(
                    onClick = { signOutFromPending() },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Sign Out / Switch Account", fontSize = 14.sp)
                }
            }
        }
    }

    // CLINIC LOCATION PICKER DIALOG
    if (showLocationPicker) {
        val predefinedLocations = listOf(
            Triple("Kathmandu (Bagbazar / City Center)", 27.7052, 85.3193),
            Triple("Kathmandu (Thamel / Lazimpat)", 27.7172, 85.3120),
            Triple("Kathmandu (New Baneshwor)", 27.6915, 85.3420),
            Triple("Kathmandu (Maharajgunj / Teaching Hosp.)", 27.7360, 85.3305),
            Triple("Lalitpur (Lagankhel / Patan Hospital)", 27.6685, 85.3214),
            Triple("Lalitpur (Pulchowk / Jawalakhel)", 27.6766, 85.3168),
            Triple("Bhaktapur (Suryabinayak)", 27.6710, 85.4298),
            Triple("Pokhara (New Road / Lakeside)", 28.2096, 83.9856),
            Triple("Chitwan (Bharatpur Medical City)", 27.6833, 84.4333),
            Triple("Biratnagar (Main Road / Koshi)", 26.4525, 87.2718),
            Triple("Butwal (Traffic Chowk)", 27.7006, 83.4484),
            Triple("Dharan (BPKIHS Area)", 26.8124, 87.2834),
            Triple("Nepalgunj (Birendra Chowk)", 28.0500, 81.6167)
        )
        var tempAddress by remember { mutableStateOf(clinicAddress.ifBlank { "Kathmandu, Nepal" }) }
        var tempLat by remember { mutableDoubleStateOf(clinicLat) }
        var tempLng by remember { mutableDoubleStateOf(clinicLng) }

        AlertDialog(
            onDismissRequest = { showLocationPicker = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Text("Select Clinic Location", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Pick from major healthcare hubs in Nepal or enter custom coordinates:", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

                    OutlinedTextField(
                        value = tempAddress,
                        onValueChange = { tempAddress = it },
                        label = { Text("Address / Location Name") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = tempLat.toString(),
                            onValueChange = { it.toDoubleOrNull()?.let { l -> tempLat = l } },
                            label = { Text("Latitude") },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = tempLng.toString(),
                            onValueChange = { it.toDoubleOrNull()?.let { l -> tempLng = l } },
                            label = { Text("Longitude") },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            singleLine = true
                        )
                    }

                    Text("Quick Selection (Nepal Hubs):", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        predefinedLocations.forEach { (locName, lat, lng) ->
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (tempAddress == locName) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                onClick = {
                                    tempAddress = locName
                                    tempLat = lat
                                    tempLng = lng
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(locName, fontSize = 12.sp, fontWeight = if (tempAddress == locName) FontWeight.Bold else FontWeight.Normal)
                                    Text("(${String.format("%.4f", lat)}, ${String.format("%.4f", lng)})", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    clinicAddress = tempAddress
                    clinicLat = tempLat
                    clinicLng = tempLng
                    showLocationPicker = false
                }) {
                    Text("Confirm Location")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLocationPicker = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
