package com.dactor.patient.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dactor.patient.R

@Composable
fun GuestAccountView(
    onSignInClicked: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // App Logo
        Image(
            painter = painterResource(id = R.drawable.app_logo),
            contentDescription = "Dactor Logo",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(18.dp))
                .shadow(6.dp, RoundedCornerShape(18.dp))
        )

        Spacer(Modifier.height(16.dp))

        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFFCCFBF1)
        ) {
            Text(
                text = "GUEST ACCOUNT",
                color = Color(0xFF0F766E),
                fontWeight = FontWeight.ExtraBold,
                fontSize = 11.sp,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                letterSpacing = 0.8.sp
            )
        }

        Spacer(Modifier.height(14.dp))

        Text(
            text = "Welcome to Dactor Nepal",
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            color = Color(0xFF0F172A),
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "You are currently browsing as a Guest. Sign in or sign up with your Google account to book appointments and unlock your health records.",
            fontSize = 13.5.sp,
            color = Color(0xFF64748B),
            textAlign = TextAlign.Center,
            lineHeight = 19.sp,
            modifier = Modifier.padding(horizontal = 10.dp)
        )

        Spacer(Modifier.height(24.dp))

        // Main Login Card
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Large Prominent Button: Login / Sign Up with Google
                Button(
                    onClick = onSignInClicked,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00796B))
                ) {
                    Icon(
                        Icons.Default.AccountCircle,
                        contentDescription = "Google",
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "Login / Sign Up with Google",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }

                // Features unlocked with login
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFF8FAFC),
                    border = BorderStroke(1.dp, Color(0xFFF1F5F9)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Unlocked with Google Sign-In:",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.5.sp,
                            color = Color(0xFF0F172A)
                        )

                        BenefitRow(
                            icon = Icons.Default.EventAvailable,
                            text = "Book guaranteed doctor & clinic appointments"
                        )
                        BenefitRow(
                            icon = Icons.Default.NotificationsActive,
                            text = "Live queue callouts & sound alert notifications"
                        )
                        BenefitRow(
                            icon = Icons.Default.ReceiptLong,
                            text = "Official digital medical bills & payment ledgers"
                        )
                        BenefitRow(
                            icon = Icons.Default.Devices,
                            text = "Sync appointments & records across all devices"
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BenefitRow(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Surface(
            shape = CircleShape,
            color = Color(0xFFCCFBF1),
            modifier = Modifier.size(24.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = Color(0xFF0F766E),
                    modifier = Modifier.size(14.dp)
                )
            }
        }
        Text(
            text = text,
            fontSize = 12.sp,
            color = Color(0xFF334155),
            fontWeight = FontWeight.Medium
        )
    }
}
