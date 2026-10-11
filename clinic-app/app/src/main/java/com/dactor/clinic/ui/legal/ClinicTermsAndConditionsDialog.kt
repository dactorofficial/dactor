package com.dactor.clinic.ui.legal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ClinicTermsAndConditionsDialog(
    initialTab: Int = 0, // 0: Clinic Facility, 1: Doctor / NMC, 2: Nepal & Google Play Laws
    onAccept: (() -> Unit)? = null,
    onDismiss: () -> Unit
) {
    var selectedSection by remember { mutableIntStateOf(initialTab) }

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
                        when (selectedSection) {
                            0 -> Icons.Default.LocalHospital
                            1 -> Icons.Default.MedicalServices
                            else -> Icons.Default.Gavel
                        },
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
                    "Terms & Conditions & Regulatory Policy",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp
                )
                Text(
                    "Compliant with Nepal Healthcare Laws & Google Play Developer Policies",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Section Tabs
                ScrollableTabRow(
                    selectedTabIndex = selectedSection,
                    edgePadding = 0.dp,
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Tab(
                        selected = selectedSection == 0,
                        onClick = { selectedSection = 0 },
                        text = { Text("Clinic Facility", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                    )
                    Tab(
                        selected = selectedSection == 1,
                        onClick = { selectedSection = 1 },
                        text = { Text("Doctor & NMC", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                    )
                    Tab(
                        selected = selectedSection == 2,
                        onClick = { selectedSection = 2 },
                        text = { Text("Nepal & Play Policy", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                    )
                }

                // Scrollable Content
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Effective Date: October 2026 • Dactor Healthcare Provider Network (Nepal)",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    when (selectedSection) {
                        0 -> {
                            // CLINIC FACILITY CLAUSES
                            ClinicSectionCard(
                                title = "1. Facility Licensing & Health Ministry Compliance",
                                body = "Clinics, polyclinics, and diagnostic centers registered on Dactor must hold an active operating license under the Health Institution Operation Standards Guideline 2077 (MoHP Nepal) and respective local municipality approval. Uploaded registration certificates and valid 9-digit PAN issued by the Inland Revenue Department (IRD) are mandatory."
                            )
                            ClinicSectionCard(
                                title = "2. OpenStreetMap & GPS Location Accuracy",
                                body = "The clinic administrator agrees to pin the exact, truthful GPS coordinates of the healthcare center on OpenStreetMap. Misrepresenting facility location or misleading patient navigation violates Nepal Consumer Protection Act 2075."
                            )
                            ClinicSectionCard(
                                title = "3. NRB Digital Payment Directives & Merchant Settlements",
                                body = "Clinics configuring direct payment credentials (eSewa, Khalti, Fonepay, ConnectIPS) acknowledge that booking and token fees settle directly into the clinic's merchant bank account. The clinic agrees to adhere to Nepal Rastra Bank (NRB) digital payment bylaws and issues legally valid VAT/PAN receipts."
                            )
                            ClinicSectionCard(
                                title = "4. OPD Queue Operations & Patient Non-Discrimination",
                                body = "The clinic is responsible for maintaining live queue turn integrity, managing emergency triage appropriately, and honoring published slot intervals. Patients must be treated with equal dignity without discrimination based on caste, gender, religion, or origin."
                            )
                            ClinicSectionCard(
                                title = "5. Account Deletion, 30-Day Archive & Permanent Purge",
                                body = "In compliance with Google Play Store Account Deletion Requirements and Nepal Privacy Act 2075, clinics may request account deletion at any time. When deletion is initiated, a mandatory 30-day archive freeze begins. If not cancelled within 30 days, ALL clinic records, patient consultation histories, and queue entries are permanently and irreversibly purged from our servers."
                            )
                        }
                        1 -> {
                            // DOCTOR & NMC CLAUSES
                            ClinicSectionCard(
                                title = "1. Nepal Medical Council (NMC) License Mandate",
                                body = "Every doctor practicing or consulting through Dactor must hold an authentic, verifiable registration with the Nepal Medical Council (NMC) under the Nepal Medical Council Act 2020. The NMC License ID entered must match official council records."
                            )
                            ClinicSectionCard(
                                title = "2. Professional Clinical Autonomy & Responsibility",
                                body = "Doctors retain sole clinical independence and diagnostic responsibility for patient consultations, examinations, prescriptions, and laboratory orders. Dactor serves strictly as a administrative facilitation and appointment platform and does not interfere in medical judgment."
                            )
                            ClinicSectionCard(
                                title = "3. Doctor-Patient Confidentiality & Nepal Privacy Act 2075",
                                body = "In accordance with the NMC Code of Medical Ethics and the Individual Privacy Act 2075, patient clinical remarks, diagnosis, and medical histories are privileged and strictly confidential. Unauthorized export or disclosure outside official consultation is strictly prohibited."
                            )
                            ClinicSectionCard(
                                title = "4. Fee Transparency & Anti-Exploitation",
                                body = "Consultation fees displayed must be transparent in Nepalese Rupees (NPR). Charging undocumented surcharges or engaging in fee-splitting commissions violates NMC ethical regulations."
                            )
                            ClinicSectionCard(
                                title = "5. Emergency Medical Care Protocol (Call 102)",
                                body = "Doctors and clinical staff acknowledge that Dactor is for scheduled outpatient (OPD) care. Patients exhibiting emergency, acute trauma, or life-threatening symptoms must be immediately directed to hospital emergency triage and Nepal emergency ambulance services (102)."
                            )
                        }
                        2 -> {
                            // NEPAL LAW & GOOGLE PLAY STORE LAWS
                            ClinicSectionCard(
                                title = "1. Nepal Electronic Transactions Act 2063 (ETA)",
                                body = "Digital registrations, slot publications, online token generation, and electronic consent provided within this application hold full legal validity under the Electronic Transactions Act 2063 (2008) of Nepal."
                            )
                            ClinicSectionCard(
                                title = "2. Nepal Individual Privacy Act 2075 & Privacy Rules 2077",
                                body = "All personal identifying information (PII), phone numbers, tax identification, and health data collected are processed strictly under lawful consent. Users retain the legal right to data access, correction, and permanent deletion."
                            )
                            ClinicSectionCard(
                                title = "3. Google Play Store Health Apps Policy Compliance",
                                body = "Dactor complies with Google Play Health Apps Policies. This platform is an administrative practice management and appointment scheduling service. It does NOT provide automated medical diagnosis, does not act as a software medical device, and makes no false or misleading claims."
                            )
                            ClinicSectionCard(
                                title = "4. Data Encryption & Protected Health Information (PHI)",
                                body = "All medical appointment tokens, doctor availability data, and clinic communications are secured with end-to-end TLS 1.3 encryption in transit and encrypted storage at rest in compliance with Google Play Store Security Standards."
                            )
                            ClinicSectionCard(
                                title = "5. Right to Erasure & User Account Deletion",
                                body = "Both healthcare providers and patients have access to an in-app Account Deletion mechanism as required by Google Play Policies. Users can schedule deletion or cancel within the 30-day grace period."
                            )
                        }
                    }
                }
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
                Text(if (onAccept != null) "Accept & Agree" else "Close")
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
