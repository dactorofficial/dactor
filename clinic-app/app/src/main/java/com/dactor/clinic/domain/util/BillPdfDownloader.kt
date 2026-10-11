package com.dactor.clinic.domain.util

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import com.dactor.clinic.data.model.Appointment
import com.dactor.clinic.data.model.BillingInvoice
import com.dactor.clinic.data.model.InvoiceItem
import java.io.File
import java.io.FileOutputStream

/**
 * Generates an official PDF medical bill / receipt ONLY when explicitly requested by a user.
 */
object BillPdfDownloader {

    fun downloadBillPdf(
        context: Context,
        appointment: Appointment,
        invoice: BillingInvoice?,
        clinicName: String = "Dactor Partner Clinic",
        clinicAddress: String = "Kathmandu, Nepal",
        doctorName: String = "Attending Physician",
        clinicalRemarks: String? = null
    ) {
        try {
            val pdfDocument = PdfDocument()
            val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create() // A4 Portrait
            val page = pdfDocument.startPage(pageInfo)
            val canvas: Canvas = page.canvas

            val headerPaint = Paint().apply {
                color = Color.rgb(0, 121, 107)
                style = Paint.Style.FILL
            }
            val titlePaint = Paint().apply {
                color = Color.WHITE
                textSize = 20f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            val subHeaderPaint = Paint().apply {
                color = Color.rgb(224, 242, 241)
                textSize = 11f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                isAntiAlias = true
            }
            val sectionPaint = Paint().apply {
                color = Color.rgb(0, 121, 107)
                textSize = 13f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            val labelPaint = Paint().apply {
                color = Color.rgb(100, 116, 139)
                textSize = 11f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                isAntiAlias = true
            }
            val valuePaint = Paint().apply {
                color = Color.rgb(15, 23, 42)
                textSize = 11.5f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            val regularPaint = Paint().apply {
                color = Color.rgb(51, 65, 85)
                textSize = 11f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
                isAntiAlias = true
            }
            val linePaint = Paint().apply {
                color = Color.rgb(226, 232, 240)
                strokeWidth = 1f
            }

            // 1. Top Banner
            canvas.drawRect(0f, 0f, 595f, 92f, headerPaint)
            canvas.drawText(clinicName.ifBlank { "Dactor Medical Clinic" }, 36f, 38f, titlePaint)
            canvas.drawText(clinicAddress.ifBlank { "Nepal" }, 36f, 56f, subHeaderPaint)
            canvas.drawText(
                "OFFICIAL MEDICAL BILL & PAYMENT LEDGER • CODE #${appointment.trackingCode10Digit}",
                36f,
                74f,
                subHeaderPaint
            )

            var y = 122f

            // 2. Patient & Consultation Details
            canvas.drawText("PATIENT & VISIT DETAILS", 36f, y, sectionPaint)
            y += 18f
            canvas.drawLine(36f, y - 10f, 559f, y - 10f, linePaint)

            canvas.drawText("Patient Name:", 36f, y, labelPaint)
            canvas.drawText(appointment.patientName, 130f, y, valuePaint)
            canvas.drawText("10-Digit Code:", 340f, y, labelPaint)
            canvas.drawText("#${appointment.trackingCode10Digit}", 430f, y, valuePaint)
            y += 18f

            val ageGender = listOfNotNull(
                appointment.patientAge?.let { "$it Yrs" },
                appointment.patientGender?.takeIf { it.isNotBlank() }
            ).joinToString(" / ").ifBlank { "N/A" }

            canvas.drawText("Age / Gender:", 36f, y, labelPaint)
            canvas.drawText(ageGender, 130f, y, valuePaint)
            canvas.drawText("Visit Date:", 340f, y, labelPaint)
            canvas.drawText("${appointment.appointmentDate} (${appointment.appointmentTime})", 430f, y, valuePaint)
            y += 18f

            canvas.drawText("Mobile:", 36f, y, labelPaint)
            canvas.drawText(appointment.patientMobile.ifBlank { "N/A" }, 130f, y, valuePaint)
            canvas.drawText("Doctor:", 340f, y, labelPaint)
            canvas.drawText(doctorName, 430f, y, valuePaint)
            y += 28f

            // 3. Date-Wise Bill & Payment Entries Table
            canvas.drawText("DATE-WISE BILL & PAYMENT ENTRIES", 36f, y, sectionPaint)
            y += 14f

            val tableHeaderBg = Paint().apply {
                color = Color.rgb(241, 245, 249)
                style = Paint.Style.FILL
            }
            canvas.drawRect(36f, y, 559f, y + 24f, tableHeaderBg)
            canvas.drawText("Description / Date Entry", 46f, y + 16f, valuePaint)
            canvas.drawText("Qty", 360f, y + 16f, valuePaint)
            canvas.drawText("Rate (NPR)", 415f, y + 16f, valuePaint)
            canvas.drawText("Amount (NPR)", 490f, y + 16f, valuePaint)
            y += 38f

            val effectivePaid = when {
                invoice != null && (invoice.paidAmount != null || invoice.totalAmount > 0.0) -> invoice.effectivePaidAmount
                appointment.paymentStatus.equals("paid", ignoreCase = true) -> (appointment.feeAmount ?: 0.0)
                else -> 0.0
            }
            val effectiveTotal = when {
                invoice != null && invoice.totalAmount > 0.0 -> invoice.totalAmount
                effectivePaid > 0.0 -> effectivePaid
                (appointment.feeAmount ?: 0.0) > 0.0 -> appointment.feeAmount ?: 0.0
                else -> 0.0
            }
            val balanceLeft = (effectiveTotal - effectivePaid).coerceAtLeast(0.0)

            val items: List<InvoiceItem> = if (invoice != null && invoice.items.isNotEmpty()) {
                invoice.items
            } else {
                listOf(
                    InvoiceItem(
                        itemName = "Payment Received (${appointment.appointmentDate})",
                        quantity = 1,
                        price = effectiveTotal,
                        total = effectiveTotal
                    )
                )
            }

            for (item in items) {
                canvas.drawText(item.itemName.take(48), 46f, y, regularPaint)
                canvas.drawText(item.quantity.toString(), 365f, y, regularPaint)
                canvas.drawText("Rs. ${item.price.toInt()}", 415f, y, regularPaint)
                canvas.drawText("Rs. ${item.total.toInt()}", 490f, y, valuePaint)
                y += 18f
                canvas.drawLine(36f, y - 10f, 559f, y - 10f, linePaint)
            }

            y += 10f

            // 4. Financial Summary Box (Total Bill, Paid, Remaining Balance)
            val summaryBoxPaint = Paint().apply {
                color = Color.rgb(240, 253, 250)
                style = Paint.Style.FILL
            }
            canvas.drawRect(310f, y, 559f, y + 76f, summaryBoxPaint)

            canvas.drawText("Total Bill Amount:", 324f, y + 20f, labelPaint)
            canvas.drawText("Rs. ${effectiveTotal.toInt()}", 475f, y + 20f, valuePaint)

            val paidPaint = Paint(valuePaint).apply { color = Color.rgb(21, 128, 61) }
            canvas.drawText("Total Paid by Patient:", 324f, y + 42f, labelPaint)
            canvas.drawText("Rs. ${effectivePaid.toInt()}", 475f, y + 42f, paidPaint)

            val leftPaint = Paint(valuePaint).apply {
                color = if (balanceLeft > 0.0) Color.rgb(185, 28, 28) else Color.rgb(21, 128, 61)
            }
            canvas.drawText("Remaining Balance:", 324f, y + 64f, labelPaint)
            canvas.drawText("Rs. ${balanceLeft.toInt()}", 475f, y + 64f, leftPaint)

            y += 96f

            // 5. Clinical Remarks (if any)
            val remarksToPrint = clinicalRemarks?.takeIf { it.isNotBlank() }
                ?: invoice?.remarks?.takeIf { it.isNotBlank() }

            if (!remarksToPrint.isNullOrBlank()) {
                canvas.drawText("CLINICAL REMARKS & NOTES", 36f, y, sectionPaint)
                y += 16f
                val words = remarksToPrint.split(" ")
                var currentLine = ""
                for (w in words) {
                    val testLine = if (currentLine.isEmpty()) w else "$currentLine $w"
                    if (regularPaint.measureText(testLine) > 495f) {
                        canvas.drawText(currentLine, 44f, y, regularPaint)
                        y += 15f
                        currentLine = w
                    } else {
                        currentLine = testLine
                    }
                }
                if (currentLine.isNotEmpty()) {
                    canvas.drawText(currentLine, 44f, y, regularPaint)
                }
            }

            // Footer
            canvas.drawLine(36f, 790f, 559f, 790f, linePaint)
            canvas.drawText(
                "Generated on request via Dactor Nepal • Computer Generated Official Receipt",
                36f,
                810f,
                labelPaint
            )

            pdfDocument.finishPage(page)

            val fileName = "Dactor_Bill_${appointment.trackingCode10Digit}_${System.currentTimeMillis()}.pdf"
            var savedUri: Uri? = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { out ->
                        pdfDocument.writeTo(out)
                    }
                    savedUri = uri
                }
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val outFile = File(downloadsDir, fileName)
                FileOutputStream(outFile).use { out ->
                    pdfDocument.writeTo(out)
                }
            }

            pdfDocument.close()

            Toast.makeText(
                context,
                "Generated Bill PDF saved to Downloads: $fileName",
                Toast.LENGTH_LONG
            ).show()

            if (savedUri != null) {
                try {
                    val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(savedUri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(viewIntent)
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Unable to generate PDF bill: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
}
