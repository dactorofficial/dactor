package com.dactor.patient.ui.onboarding

import android.app.Activity
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.dactor.patient.R
import com.dactor.patient.data.local.UserSessionManager
import com.dactor.patient.data.repository.AppointmentRepository
import com.dactor.patient.data.repository.AuthRepository
import com.dactor.patient.ui.navigation.NavRoutes
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.launch

data class OnboardingSlideData(
    val badgeText: String,
    val badgeColor: Color,
    val badgeTextColor: Color,
    val icon: ImageVector,
    val iconColor: Color,
    val iconBgColor: Color,
    val title: String,
    val description: String,
    val pill1Text: String,
    val pill1Icon: ImageVector,
    val pill2Text: String,
    val pill2Icon: ImageVector
)

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    navController: NavController,
    authRepository: AuthRepository? = null,
    sessionManager: UserSessionManager? = null,
    appointmentRepository: AppointmentRepository? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val pagerState = rememberPagerState(pageCount = { 5 })

    var isGoogleLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val slides = listOf(
        // 0. APPOINTMENTS
        OnboardingSlideData(
            badgeText = "SMART CLINIC VISITS",
            badgeColor = Color(0xFFCCFBF1),
            badgeTextColor = Color(0xFF0F766E),
            icon = Icons.Default.CalendarMonth,
            iconColor = Color(0xFF00796B),
            iconBgColor = Color(0xFFE0F2F1),
            title = "Instant Clinic Appointments",
            description = "Skip the long waiting lines. Browse verified specialist doctors and clinics across Nepal, compare fees, and reserve your guaranteed OPD slot in seconds.",
            pill1Text = "Guaranteed OPD Slot Confirmation",
            pill1Icon = Icons.Default.CheckCircle,
            pill2Text = "Verified Clinics & Doctors Across Nepal",
            pill2Icon = Icons.Default.Verified
        ),
        // 1. QUEUE TRACKING
        OnboardingSlideData(
            badgeText = "LIVE TOKEN MONITOR",
            badgeColor = Color(0xFFE0F2FE),
            badgeTextColor = Color(0xFF0369A1),
            icon = Icons.Default.HourglassTop,
            iconColor = Color(0xFF0284C7),
            iconBgColor = Color(0xFFBAE6FD),
            title = "Real-Time Queue Tracking",
            description = "Track your token number live from home or on the road. Know the exact number of patients ahead of you so you only reach the clinic when it's your turn.",
            pill1Text = "Live Token Count & Minutes Remaining",
            pill1Icon = Icons.Default.Timer,
            pill2Text = "Never Wait in Crowded Lobbies",
            pill2Icon = Icons.Default.DirectionsWalk
        ),
        // 2. DIRECT NOTIFICATION
        OnboardingSlideData(
            badgeText = "INSTANT ALERTS & SOUNDS",
            badgeColor = Color(0xFFFEF3C7),
            badgeTextColor = Color(0xFFB45309),
            icon = Icons.Default.NotificationsActive,
            iconColor = Color(0xFFD97706),
            iconBgColor = Color(0xFFFDE68A),
            title = "Direct Notification & Alerts",
            description = "Never miss your turn! Get instant audible sound alerts and popup notifications when your token is called into the doctor's cabin or when lab reports are ready.",
            pill1Text = "Loud Ringtone for Token Callouts",
            pill1Icon = Icons.Default.VolumeUp,
            pill2Text = "Instant Doctor & Lab Status Updates",
            pill2Icon = Icons.Default.Bolt
        ),
        // 3. DOCTOR PRESENCE
        OnboardingSlideData(
            badgeText = "LIVE CLINIC PRESENCE",
            badgeColor = Color(0xFFDCFCE7),
            badgeTextColor = Color(0xFF15803D),
            icon = Icons.Default.MedicalServices,
            iconColor = Color(0xFF16A34A),
            iconBgColor = Color(0xFFBBF7D0),
            title = "Live Doctor Availability",
            description = "Know before you leave home! See if your doctor has physically checked into the clinic, their active consulting hours, and real-time OPD schedule updates.",
            pill1Text = "Doctor In-Clinic Real-Time Status",
            pill1Icon = Icons.Default.CheckCircle,
            pill2Text = "Active OPD Schedule & Break Timers",
            pill2Icon = Icons.Default.AccessTime
        ),
        // 4. GET STARTED (handled separately for Sign-In / Guest)
        OnboardingSlideData(
            badgeText = "WELCOME TO DACTOR",
            badgeColor = Color(0xFFE0F2F1),
            badgeTextColor = Color(0xFF00796B),
            icon = Icons.Default.HealthAndSafety,
            iconColor = Color(0xFF00796B),
            iconBgColor = Color(0xFFCCFBF1),
            title = "Healthcare at Your Fingertips",
            description = "Search clinics, explore doctors, track live queues with code, and receive real-time notifications. Sign in with Google anytime to book slots.",
            pill1Text = "Search Clinics & Doctors Freely",
            pill1Icon = Icons.Default.Search,
            pill2Text = "Track Live Queues with 10-Digit Code",
            pill2Icon = Icons.Default.QrCode2
        )
    )

    // Google Sign-In setup for direct login on the final slide
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

    fun proceedToMainAsGuest() {
        sessionManager?.setHasSeenOnboarding(true)
        sessionManager?.setGuestMode(true)
        navController.navigate(NavRoutes.PatientMain.route) {
            popUpTo(0) { inclusive = true }
            launchSingleTop = true
        }
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)
                val email = account.email?.trim()?.lowercase()
                if (!email.isNullOrBlank()) {
                    isGoogleLoading = true
                    errorMessage = null
                    coroutineScope.launch {
                        try {
                            sessionManager?.setHasSeenOnboarding(true)
                            val existingProfile = try {
                                authRepository?.getProfileByEmail(email)
                            } catch (_: Exception) { null }

                            if (existingProfile != null && !existingProfile.fullName.isNullOrBlank()) {
                                sessionManager?.savePatientSession(
                                    patientId = existingProfile.id,
                                    email = email,
                                    name = existingProfile.fullName.orEmpty(),
                                    phone = existingProfile.phone.orEmpty(),
                                    gender = existingProfile.gender,
                                    age = existingProfile.age,
                                    isArchived = existingProfile.isArchived == true,
                                    deletionScheduledAt = existingProfile.deletionScheduledAt
                                )
                                sessionManager?.setGuestMode(false)
                                isGoogleLoading = false
                                navController.navigate(NavRoutes.PatientMain.route) {
                                    popUpTo(0) { inclusive = true }
                                    launchSingleTop = true
                                }
                            } else {
                                isGoogleLoading = false
                                // Profile registration needed: forward to LoginScreen with verified email
                                navController.navigate(NavRoutes.Login.route) {
                                    popUpTo(NavRoutes.Onboarding.route) { inclusive = true }
                                    launchSingleTop = true
                                }
                            }
                        } catch (e: Exception) {
                            isGoogleLoading = false
                            errorMessage = "Sign-in error: ${e.message}"
                        }
                    }
                } else {
                    errorMessage = "Unable to retrieve Google email."
                }
            } catch (e: ApiException) {
                errorMessage = "Google Sign-In was cancelled or failed (${e.statusCode})."
            }
        }
    }

    Scaffold(
        containerColor = Color(0xFFF8FAFC)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Top Bar with Skip Button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFF00796B),
                        modifier = Modifier.size(30.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.LocalHospital, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                    Text("Dactor Nepal", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = Color(0xFF0F172A))
                }

                if (pagerState.currentPage < 4) {
                    TextButton(
                        onClick = {
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(4)
                            }
                        },
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Skip",
                            color = Color(0xFF00796B),
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.size(40.dp))
                }
            }

            // Error banner if any
            AnimatedVisibility(visible = errorMessage != null) {
                Surface(
                    color = Color(0xFFFEE2E2),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(16.dp))
                        Text(errorMessage ?: "", color = Color(0xFF991B1B), fontSize = 12.sp)
                    }
                }
            }

            // Pager for slides
            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) { page ->
                val slide = slides[page]
                val scrollState = rememberScrollState()

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(horizontal = 24.dp, vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    if (page < 4) {
                        // Category Badge
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = slide.badgeColor,
                            modifier = Modifier.padding(bottom = 20.dp)
                        ) {
                            Text(
                                text = slide.badgeText,
                                color = slide.badgeTextColor,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                letterSpacing = 0.8.sp
                            )
                        }

                        // Hero Illustration Card
                        Surface(
                            shape = CircleShape,
                            color = slide.iconBgColor.copy(alpha = 0.45f),
                            modifier = Modifier
                                .size(180.dp)
                                .shadow(8.dp, CircleShape, spotColor = slide.iconColor.copy(alpha = 0.25f))
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Surface(
                                    shape = CircleShape,
                                    color = slide.iconBgColor,
                                    modifier = Modifier.size(130.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = slide.icon,
                                            contentDescription = null,
                                            tint = slide.iconColor,
                                            modifier = Modifier.size(68.dp)
                                        )
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(28.dp))

                        // Title
                        Text(
                            text = slide.title,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF0F172A),
                            textAlign = TextAlign.Center,
                            lineHeight = 30.sp
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Description
                        Text(
                            text = slide.description,
                            fontSize = 14.sp,
                            color = Color(0xFF64748B),
                            textAlign = TextAlign.Center,
                            lineHeight = 21.sp,
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        // Feature Pills
                        Column(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            FeaturePill(text = slide.pill1Text, icon = slide.pill1Icon, iconTint = slide.iconColor)
                            FeaturePill(text = slide.pill2Text, icon = slide.pill2Icon, iconTint = slide.iconColor)
                        }
                    } else {
                        // FINAL SLIDE: GET STARTED & DIRECT SIGN IN / GUEST BUTTON
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Dactor Nepal",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .size(96.dp)
                                .clip(RoundedCornerShape(22.dp))
                                .shadow(8.dp, RoundedCornerShape(22.dp))
                        )

                        Spacer(modifier = Modifier.height(18.dp))

                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = Color(0xFFCCFBF1)
                        ) {
                            Text(
                                text = "GET STARTED",
                                color = Color(0xFF0F766E),
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                letterSpacing = 0.8.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = "Welcome to Dactor Nepal",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF0F172A),
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Connect with top verified medical clinics and specialist doctors. Track live queues and receive instant health alerts.",
                            fontSize = 13.5.sp,
                            color = Color(0xFF64748B),
                            textAlign = TextAlign.Center,
                            lineHeight = 20.sp,
                            modifier = Modifier.padding(horizontal = 6.dp)
                        )

                        Spacer(modifier = Modifier.height(28.dp))

                        // Action Buttons Card
                        Card(
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(18.dp),
                                verticalArrangement = Arrangement.spacedBy(14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                // 1. Direct Sign In with Google
                                Button(
                                    onClick = {
                                        if (!isGoogleLoading) {
                                            try {
                                                googleSignInClient.signOut()
                                            } catch (_: Exception) {}
                                            val signInIntent = googleSignInClient.signInIntent
                                            googleSignInLauncher.launch(signInIntent)
                                        }
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(52.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00796B)),
                                    enabled = !isGoogleLoading
                                ) {
                                    if (isGoogleLoading) {
                                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                        Spacer(Modifier.width(8.dp))
                                        Text("Signing In...", fontWeight = FontWeight.Bold)
                                    } else {
                                        Icon(Icons.Default.AccountCircle, contentDescription = "Google", modifier = Modifier.size(22.dp))
                                        Spacer(Modifier.width(10.dp))
                                        Text("Sign in with Google", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    }
                                }

                                // 2. Continue as Guest Button (Underneath)
                                OutlinedButton(
                                    onClick = { proceedToMainAsGuest() },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(50.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    border = BorderStroke(1.5.dp, Color(0xFF00796B))
                                ) {
                                    Text(
                                        "Continue as Guest",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = Color(0xFF00796B)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Color(0xFF00796B), modifier = Modifier.size(16.dp))
                                }

                                // Informative Guest Explanation
                                Surface(
                                    color = Color(0xFFF1F5F9),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = "In Guest Mode, you can search clinics, explore doctors, track live queues with code, and receive real-time notifications. Sign-in is only required to book an appointment.",
                                        fontSize = 11.sp,
                                        color = Color(0xFF475569),
                                        textAlign = TextAlign.Center,
                                        lineHeight = 16.sp,
                                        modifier = Modifier.padding(10.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Bottom Navigation Footer (Dots Indicator + Next Button)
            if (pagerState.currentPage < 4) {
                Surface(
                    color = Color.White,
                    shadowElevation = 8.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp, vertical = 18.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Slide Dots Indicator
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            repeat(5) { index ->
                                val isSelected = pagerState.currentPage == index
                                val width by animateDpAsState(
                                    targetValue = if (isSelected) 24.dp else 8.dp,
                                    animationSpec = tween(durationMillis = 250),
                                    label = "dot_width"
                                )
                                Box(
                                    modifier = Modifier
                                        .height(8.dp)
                                        .width(width)
                                        .clip(CircleShape)
                                        .background(
                                            if (isSelected) Color(0xFF00796B) else Color(0xFFCBD5E1)
                                        )
                                        .clickable {
                                            coroutineScope.launch {
                                                pagerState.animateScrollToPage(index)
                                            }
                                        }
                                )
                            }
                        }

                        // Next Button
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    val next = pagerState.currentPage + 1
                                    if (next < 5) {
                                        pagerState.animateScrollToPage(next)
                                    }
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00796B)),
                            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp)
                        ) {
                            Text("Next", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Spacer(Modifier.width(6.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FeaturePill(text: String, icon: ImageVector, iconTint: Color) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Surface(
                shape = CircleShape,
                color = iconTint.copy(alpha = 0.12f),
                modifier = Modifier.size(28.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(16.dp))
                }
            }
            Text(
                text = text,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF1E293B)
            )
        }
    }
}
