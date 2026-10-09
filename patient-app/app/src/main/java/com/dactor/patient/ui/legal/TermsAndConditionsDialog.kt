package com.dactor.patient.ui.legal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun TermsAndConditionsDialog(
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(44.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.HealthAndSafety,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        },
        title = {
            Text(
                "Terms and Conditions & Privacy Policy",
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 450.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "Effective Date: October 2026 • Dactor Nepal Healthcare Platform",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )

                // Clause 1: Healthcare Service Scope
                SectionCard(
                    title = "1. Healthcare Platform & Medical Disclaimer",
                    body = "Dactor facilitates appointment scheduling, live queue tracking, digital token distribution, and clinic directory lookup across Nepal. Dactor is not a licensed healthcare provider; diagnosis, prescription, and medical decisions remain the sole professional responsibility of attending licensed physicians and clinics registered with the Nepal Medical Council (NMC)."
                )

                // Clause 2: Patient Identity & Security
                SectionCard(
                    title = "2. Confidential Records & Rate-Limited Access",
                    body = "Confidential patient records (prescriptions, clinical remarks, lab reports, and billing) are masked by default. Access requires verification through Patient Full Name or Registered Nepal Mobile Number. For security against brute-force inspection, a mandatory 5-second cooldown is enforced between unsuccessful trials, with permanent lockout after 6 attempts."
                )

                // Clause 3: Multi-Visit & Follow-Up Benefits
                SectionCard(
                    title = "3. Multi-Visit Continuity & 10-Digit Code",
                    body = "Patients receiving a 10-digit tracking code from multi-visit polyclinics or hospitals may reuse the code for continuous follow-up care and queue tracking without recurring registration fees, subject to individual clinic policies."
                )

                // Clause 4: Account Deletion & 30-Day Archive
                SectionCard(
                    title = "4. Account Deletion & 30-Day Archive Policy",
                    body = "When a patient requests account deletion, the account is placed into a 30-day archive period. The patient is logged out from the device immediately. In accordance with healthcare record retention ethics, patient medical consultation histories, invoices, and clinic records stay securely preserved in clinic systems. If the patient logs in within the 30-day window, they will see a day countdown and may cancel the deletion at any time."
                )

                // Clause 5: Payments & Refund Policy
                SectionCard(
                    title = "5. Consultation Fees & Direct Payouts",
                    body = "Consultation fees for single-visit clinics are clearly displayed in Nepalese Rupees (NPR). When clinics configure direct payment APIs, payments are handled directly by the clinic's merchant gateway. Cancellation and refund terms adhere to the attending clinic's operational rules."
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("I Understand & Agree")
            }
        }
    )
}

@Composable
private fun SectionCard(title: String, body: String) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
            Text(body, fontSize = 11.sp, lineHeight = 16.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
