package com.dactor.clinic.ui.legal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ClinicTermsAndConditionsDialog(
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
                        Icons.Default.Business,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        },
        title = {
            Text(
                "Clinic Terms of Service & Regulatory Policy",
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 460.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "Effective Date: October 2026 • Dactor Healthcare Provider Network (Nepal)",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )

                // Clause 1: Licensing & Verification
                ClinicSectionCard(
                    title = "1. Facility Accreditation & NMC Compliance",
                    body = "Participating clinics, polyclinics, and diagnostic facilities must maintain active registration with the relevant Nepal health regulatory bodies and local municipalities. All doctors enlisted must possess verifiable Nepal Medical Council (NMC) registration. Accurate 9-digit PAN and registration papers must be kept current."
                )

                // Clause 2: Direct Payment Gateway & API Integration
                ClinicSectionCard(
                    title = "2. Direct Payment APIs & Merchant Settlement",
                    body = "Clinics that configure direct payment APIs (eSewa, Khalti, Fonepay, ConnectIPS, or banking gateway credentials) acknowledge that patient appointment fees route directly into the clinic's merchant bank account. The clinic agrees to adhere to Nepal Rastra Bank (NRB) digital payment bylaws and handles refunds directly with patients when applicable."
                )

                // Clause 3: Queue Management & Duty of Care
                ClinicSectionCard(
                    title = "3. OPD Queue Integrity & Doctor Availability",
                    body = "The clinic is responsible for keeping doctor presence toggles accurate, adhering to published slot capacities, and maintaining timely queue call operations. Remarks, billing invoices, and lab reports entered are official clinical records."
                )

                // Clause 4: Account Deletion & Permanent Patient Data Purge
                ClinicSectionCard(
                    title = "4. Clinic Deletion, 30-Day Archive & Patient Data Purge Policy",
                    body = "CRITICAL POLICY: When a clinic requests account deletion, the account enters a mandatory 30-day archive period, during which clinic portal operations are frozen. If the clinic account deletion is not cancelled within 30 days and the archive period expires, ALL patient consultation details, queue histories, appointment tokens, lab records, and invoices associated with this clinic will be permanently purged and irreversibly deleted from the platform."
                )

                // Clause 5: Grace Period Restoration
                ClinicSectionCard(
                    title = "5. Grace Period & Account Restoration",
                    body = "At any point during the 30-day archive window, the clinic administrator may log in to view the remaining day countdown and cancel the scheduled deletion with one click to fully restore clinic operations."
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Accept & Close")
            }
        }
    )
}

@Composable
private fun ClinicSectionCard(title: String, body: String) {
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
