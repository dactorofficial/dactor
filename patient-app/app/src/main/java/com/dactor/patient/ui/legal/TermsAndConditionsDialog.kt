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
    onAccept: (() -> Unit)? = null,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(48.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.HealthAndSafety,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(26.dp)
                    )
                }
            }
        },
        title = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "Terms & Conditions & Privacy Policy",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp
                )
                Text(
                    "Compliant with Nepal Healthcare Laws & Google Play Health Policies",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    "Effective Date: October 2026 • Dactor Nepal Healthcare Platform",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )

                // Clause 1: Medical Disclaimer & Emergency Notice
                SectionCard(
                    title = "1. Medical Disclaimer & Emergency Protocol (Call 102)",
                    body = "IMPORTANT: Dactor is an outpatient (OPD) queue tracking, slot scheduling, and clinic discovery platform in Nepal. Dactor does NOT provide emergency medical services or automated diagnostic advice. In any acute medical emergency, severe chest pain, trauma, or life-threatening situation, call Nepal Ambulance (102) or go immediately to the nearest hospital emergency room."
                )

                // Clause 2: Nepal Medical Council & Licensed Practitioners
                SectionCard(
                    title = "2. Nepal Medical Council (NMC) & Professional Care",
                    body = "All clinical consultations, physical exams, prescriptions, and lab interpretations are provided by independent medical practitioners registered with the Nepal Medical Council (NMC) under the Nepal Medical Council Act 2020. Dactor does not practice medicine and is not liable for medical outcomes."
                )

                // Clause 3: Nepal Privacy Act 2075 & Health Data Protection
                SectionCard(
                    title = "3. Nepal Individual Privacy Act 2075 & Data Security",
                    body = "In accordance with Nepal's Individual Privacy Act 2075 (2018) and Privacy Rules 2077, your personal information (Name, Nepal Mobile Number, Email, and Booked Tokens) is encrypted and protected. Your medical data will never be sold, rented, or shared with third-party advertisers."
                )

                // Clause 4: Google Play Store Health Apps Policy Compliance
                SectionCard(
                    title = "4. Google Play Store Health & User Data Policy Compliance",
                    body = "Dactor adheres to Google Play Health Apps Policies. Health data transmitted between the app and our secure cloud infrastructure is protected using modern TLS 1.3 encryption. Location access is strictly used to display nearby verified clinics on OpenStreetMap and is not tracked in the background."
                )

                // Clause 5: Google Play Account Deletion & 30-Day Archive
                SectionCard(
                    title = "5. Right to Erasure & 30-Day Account Deletion Policy",
                    body = "Under Google Play Account Deletion Requirements, patients retain the right to delete their account at any time via Profile Settings. Deletion places your account into a 30-day archive freeze. If you change your mind, you may log in within 30 days and cancel the deletion with one click; otherwise, account records are permanently purged."
                )

                // Clause 6: Fee Transparency & Nepal Consumer Protection
                SectionCard(
                    title = "6. Consultation Fees & Consumer Protection Act 2075",
                    body = "All consultation fees and clinic token prices are transparently displayed in Nepalese Rupees (NPR). When paying through eSewa, Khalti, or clinic reception, payments adhere to Nepal Rastra Bank (NRB) digital payment bylaws and the attending clinic's published cancellation policy."
                )

                // Clause 7: Electronic Transactions Act 2063
                SectionCard(
                    title = "7. Digital Tokens & Electronic Transactions Act 2063",
                    body = "Digital OPD tokens, booking confirmations, and tracking codes generated on Dactor carry electronic validity under Nepal's Electronic Transactions Act 2063 (2008)."
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onAccept?.invoke()
                    onDismiss()
                },
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(if (onAccept != null) "Accept & Agree" else "I Understand & Agree")
            }
        },
        dismissButton = {
            if (onAccept != null) {
                TextButton(onClick = onDismiss) {
                    Text("Decline")
                }
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
