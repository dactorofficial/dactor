package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Clinic
import com.dactor.patient.data.model.ClinicService
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import java.time.Instant
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ClinicRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    fun isClinicActivated(clinic: Clinic): Boolean {
        if (clinic.isArchived == true) return false
        if (clinic.isActivated == false) return false
        val exp = clinic.activationExpiresAt
        if (!exp.isNullOrBlank()) {
            try {
                val expInstant = Instant.parse(exp)
                if (expInstant.isBefore(Instant.now())) return false
            } catch (e: Exception) {
                try {
                    val expDate = LocalDate.parse(exp.take(10))
                    if (expDate.isBefore(LocalDate.now())) return false
                } catch (ignored: Exception) {}
            }
        }
        return true
    }

    suspend fun getClinics(): List<Clinic> {
        return try {
            val list = supabaseClient.postgrest["clinics"]
                .select()
                .decodeList<Clinic>()
            list.filter { isClinicActivated(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getClinicById(id: String): Clinic? {
        return try {
            val clinic = supabaseClient.postgrest["clinics"]
                .select { filter { eq("id", id) } }
                .decodeSingleOrNull<Clinic>()
            if (clinic != null && isClinicActivated(clinic)) clinic else null
        } catch (e: Exception) {
            null
        }
    }

    suspend fun searchClinics(query: String): List<Clinic> {
        return try {
            val list = supabaseClient.postgrest["clinics"]
                .select { filter { ilike("name", "%$query%") } }
                .decodeList<Clinic>()
            list.filter { isClinicActivated(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getClinicServices(clinicId: String): List<ClinicService> {
        return try {
            supabaseClient.postgrest["clinic_services"]
                .select { filter { eq("clinic_id", clinicId) } }
                .decodeList<ClinicService>()
        } catch (e: Exception) {
            emptyList()
        }
    }
}
