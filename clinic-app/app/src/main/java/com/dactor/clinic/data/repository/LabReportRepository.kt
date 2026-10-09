package com.dactor.clinic.data.repository

import com.dactor.clinic.data.model.LabReport
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LabReportRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getLabReports(clinicId: String): List<LabReport> = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["lab_reports"]
                .select {
                    filter {
                        eq("clinic_id", clinicId)
                    }
                }.decodeList<LabReport>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun createLabReport(report: LabReport): LabReport? = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["lab_reports"]
                .insert(report) {
                    select()
                }.decodeSingleOrNull<LabReport>() ?: report
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun updateLabReportStage(id: String, newStage: String, fileUrl: String? = null, fileName: String? = null): Boolean = withContext(Dispatchers.IO) {
        try {
            supabaseClient.postgrest["lab_reports"]
                .update({
                    set("stage", newStage)
                    if (newStage == "prepared") {
                        set("prepared_at", Instant.now().toString())
                    }
                    if (fileUrl != null) set("file_url", fileUrl)
                    if (fileName != null) set("file_name", fileName)
                }) {
                    filter {
                        eq("id", id)
                    }
                }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun uploadReportDocument(reportId: String, fileName: String, bytes: ByteArray): String? = withContext(Dispatchers.IO) {
        try {
            val bucket = supabaseClient.storage["lab-reports"]
            val path = "reports/${reportId}_$fileName"
            bucket.upload(path, bytes, upsert = true)
            bucket.publicUrl(path)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
