package com.dactor.patient.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

data class CompressedFileResult(
    val bytes: ByteArray,
    val fileName: String,
    val originalSizeBytes: Int,
    val compressedSizeBytes: Int,
    val wasCompressed: Boolean
) {
    val formattedSummary: String
        get() = if (wasCompressed && compressedSizeBytes < originalSizeBytes) {
            "${FileCompressor.formatSize(originalSizeBytes)} → ${FileCompressor.formatSize(compressedSizeBytes)} (≤ 500 KB)"
        } else {
            "${FileCompressor.formatSize(compressedSizeBytes)} (≤ 500 KB)"
        }
}

/**
 * Compresses images and document files before uploading to Supabase Storage
 * to save cloud storage bandwidth and space.
 * Guarantees images are compressed to <= 500 KB (targeting ~150-380 KB when possible).
 */
object FileCompressor {

    const val MAX_FILE_SIZE_BYTES = 500 * 1024 // 500 KB strict ceiling
    private const val PREFERRED_TARGET_BYTES = 350 * 1024 // 350 KB preferred target ("if its less its even better")
    private const val MAX_INITIAL_DIMENSION = 1440

    fun formatSize(bytes: Int): String {
        return when {
            bytes >= 1024 * 1024 -> String.format(Locale.US, "%.2f MB", bytes / (1024f * 1024f))
            bytes >= 1024 -> "${(bytes / 1024.0).roundToInt().coerceAtLeast(1)} KB"
            else -> "$bytes B"
        }
    }

    suspend fun compressUri(
        context: Context,
        uri: Uri,
        fallbackFileName: String = "upload_${System.currentTimeMillis()}.jpg",
        maxBytes: Int = MAX_FILE_SIZE_BYTES
    ): CompressedFileResult? = withContext(Dispatchers.IO) {
        try {
            val resolvedName = queryDisplayName(context, uri)
                ?: uri.lastPathSegment?.substringAfterLast('/')
                ?: fallbackFileName
            val rawBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: return@withContext null
            compressBytes(rawBytes, resolvedName, maxBytes)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun compressBytes(
        rawBytes: ByteArray,
        fileName: String = "file.jpg",
        maxBytes: Int = MAX_FILE_SIZE_BYTES
    ): CompressedFileResult {
        val originalSize = rawBytes.size
        if (originalSize == 0) {
            return CompressedFileResult(rawBytes, fileName, 0, 0, false)
        }

        val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size, boundsOpts)
        val isImage = boundsOpts.outWidth > 0 && boundsOpts.outHeight > 0

        if (isImage) {
            val compressedImage = compressImageBytes(
                rawBytes = rawBytes,
                outWidth = boundsOpts.outWidth,
                outHeight = boundsOpts.outHeight,
                maxBytes = maxBytes
            )
            if (compressedImage != null) {
                val useCompressed = compressedImage.size < rawBytes.size || rawBytes.size > maxBytes
                val chosenBytes = if (useCompressed) compressedImage else rawBytes
                val normalizedName = if (useCompressed) ensureJpgExtension(fileName) else fileName
                return CompressedFileResult(
                    bytes = chosenBytes,
                    fileName = normalizedName,
                    originalSizeBytes = originalSize,
                    compressedSizeBytes = chosenBytes.size,
                    wasCompressed = chosenBytes.size < originalSize
                )
            }
        }

        val isPdf = fileName.endsWith(".pdf", ignoreCase = true) || isPdfHeader(rawBytes)
        if (isPdf && rawBytes.size > maxBytes) {
            val compressedPdf = compressPdfBytes(rawBytes, maxBytes)
            if (compressedPdf != null && compressedPdf.size < rawBytes.size) {
                return CompressedFileResult(
                    bytes = compressedPdf,
                    fileName = fileName,
                    originalSizeBytes = originalSize,
                    compressedSizeBytes = compressedPdf.size,
                    wasCompressed = true
                )
            }
        }

        return CompressedFileResult(
            bytes = rawBytes,
            fileName = fileName,
            originalSizeBytes = originalSize,
            compressedSizeBytes = rawBytes.size,
            wasCompressed = false
        )
    }

    private fun compressImageBytes(
        rawBytes: ByteArray,
        outWidth: Int,
        outHeight: Int,
        maxBytes: Int
    ): ByteArray? {
        return try {
            val sampleSize = calculateInSampleSize(outWidth, outHeight, MAX_INITIAL_DIMENSION)
            val decodeOpts = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
            var bitmap = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size, decodeOpts) ?: return null

            val maxSide = max(bitmap.width, bitmap.height)
            if (maxSide > MAX_INITIAL_DIMENSION) {
                val ratio = MAX_INITIAL_DIMENSION.toFloat() / maxSide.toFloat()
                val targetW = (bitmap.width * ratio).roundToInt().coerceAtLeast(1)
                val targetH = (bitmap.height * ratio).roundToInt().coerceAtLeast(1)
                val scaled = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
                if (scaled !== bitmap) {
                    bitmap.recycle()
                    bitmap = scaled
                }
            }

            val opaqueBitmap = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.RGB_565)
            val canvas = Canvas(opaqueBitmap)
            canvas.drawColor(Color.WHITE)
            canvas.drawBitmap(bitmap, 0f, 0f, null)
            if (opaqueBitmap !== bitmap) {
                bitmap.recycle()
                bitmap = opaqueBitmap
            }

            val softTarget = PREFERRED_TARGET_BYTES.coerceAtMost(maxBytes)
            var currentBitmap = bitmap
            var bestBytes: ByteArray? = null

            for (scalePass in 0 until 5) {
                val qualities = intArrayOf(80, 70, 60, 50, 40, 30, 22, 15)
                for (q in qualities) {
                    val baos = ByteArrayOutputStream()
                    currentBitmap.compress(Bitmap.CompressFormat.JPEG, q, baos)
                    val candidate = baos.toByteArray()
                    bestBytes = candidate

                    if (candidate.size <= softTarget || (candidate.size <= maxBytes && q <= 60)) {
                        currentBitmap.recycle()
                        return candidate
                    }
                }

                if (bestBytes != null && bestBytes.size <= maxBytes) {
                    currentBitmap.recycle()
                    return bestBytes
                }

                val nextW = (currentBitmap.width * 0.72f).roundToInt().coerceAtLeast(200)
                val nextH = (currentBitmap.height * 0.72f).roundToInt().coerceAtLeast(200)
                if (nextW == currentBitmap.width && nextH == currentBitmap.height) break
                val smaller = Bitmap.createScaledBitmap(currentBitmap, nextW, nextH, true)
                if (smaller !== currentBitmap) {
                    currentBitmap.recycle()
                    currentBitmap = smaller
                }
            }

            currentBitmap.recycle()
            bestBytes
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun compressPdfBytes(rawBytes: ByteArray, maxBytes: Int): ByteArray? {
        var tempFile: File? = null
        var pfd: ParcelFileDescriptor? = null
        var renderer: PdfRenderer? = null
        return try {
            tempFile = File.createTempFile("dactor_pdf_src_", ".pdf")
            tempFile.writeBytes(rawBytes)
            pfd = ParcelFileDescriptor.open(tempFile, ParcelFileDescriptor.MODE_READ_ONLY)
            renderer = PdfRenderer(pfd)
            val pageCount = renderer.pageCount.coerceIn(1, 8)

            for (scale in floatArrayOf(1.1f, 0.85f, 0.65f)) {
                val outPdf = PdfDocument()
                try {
                    for (i in 0 until pageCount) {
                        val page = renderer.openPage(i)
                        val renderW = (page.width * scale).roundToInt().coerceIn(300, 1100)
                        val renderH = (page.height * scale).roundToInt().coerceIn(400, 1500)
                        val bmp = Bitmap.createBitmap(renderW, renderH, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(bmp)
                        canvas.drawColor(Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                        page.close()

                        val jpegBaos = ByteArrayOutputStream()
                        bmp.compress(Bitmap.CompressFormat.JPEG, 55, jpegBaos)
                        bmp.recycle()
                        val compactBytes = jpegBaos.toByteArray()
                        val compactBmp = BitmapFactory.decodeByteArray(compactBytes, 0, compactBytes.size)

                        if (compactBmp != null) {
                            val pageInfo = PdfDocument.PageInfo.Builder(renderW, renderH, i + 1).create()
                            val destPage = outPdf.startPage(pageInfo)
                            destPage.canvas.drawBitmap(compactBmp, 0f, 0f, null)
                            outPdf.finishPage(destPage)
                            compactBmp.recycle()
                        }
                    }
                    val pdfOut = ByteArrayOutputStream()
                    outPdf.writeTo(pdfOut)
                    val candidate = pdfOut.toByteArray()
                    if (candidate.size <= maxBytes || scale == 0.65f) {
                        return candidate
                    }
                } finally {
                    outPdf.close()
                }
            }
            null
        } catch (e: Exception) {
            e.printStackTrace()
            null
        } finally {
            try { renderer?.close() } catch (_: Exception) {}
            try { pfd?.close() } catch (_: Exception) {}
            try { tempFile?.delete() } catch (_: Exception) {}
        }
    }

    private fun calculateInSampleSize(width: Int, height: Int, maxDim: Int): Int {
        var inSampleSize = 1
        val largest = max(width, height)
        if (largest > maxDim) {
            while ((largest / (inSampleSize * 2)) >= maxDim) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }

    private fun ensureJpgExtension(fileName: String): String {
        val clean = fileName.trim().ifBlank { "image.jpg" }
        val dotIndex = clean.lastIndexOf('.')
        return if (dotIndex > 0) {
            val ext = clean.substring(dotIndex + 1).lowercase(Locale.US)
            if (ext in listOf("jpg", "jpeg")) clean else "${clean.substring(0, dotIndex)}.jpg"
        } else {
            "$clean.jpg"
        }
    }

    private fun isPdfHeader(bytes: ByteArray): Boolean {
        return bytes.size >= 4 &&
            bytes[0] == '%'.code.toByte() &&
            bytes[1] == 'P'.code.toByte() &&
            bytes[2] == 'D'.code.toByte() &&
            bytes[3] == 'F'.code.toByte()
    }

    private fun queryDisplayName(context: Context, uri: Uri): String? {
        return try {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
            }
        } catch (_: Exception) {
            null
        }
    }
}
