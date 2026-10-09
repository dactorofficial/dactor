package com.dactor.patient.data.repository

import com.dactor.patient.data.model.Doctor
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DoctorRepository @Inject constructor(
    private val supabaseClient: SupabaseClient
) {
    suspend fun getDoctors(clinicId: String?): List<Doctor> {
        return if (!clinicId.isNullOrBlank()) {
            try {
                // 1. Direct doctors assigned to this clinic
                val directDocs = try {
                    supabaseClient.postgrest["doctors"]
                        .select { filter { eq("clinic_id", clinicId) } }
                        .decodeList<Doctor>()
                } catch (e: Exception) {
                    emptyList()
                }

                // 2. Doctors affiliated via accepted clinic invitations
                val acceptedInvites = try {
                    supabaseClient.postgrest["clinic_invitations"]
                        .select {
                            filter {
                                eq("clinic_id", clinicId)
                                eq("status", "accepted")
                            }
                        }.decodeList<com.dactor.patient.data.model.ClinicInvitation>()
                } catch (e: Exception) {
                    emptyList()
                }

                val invitedEmails = acceptedInvites.map { it.email.trim().lowercase() }.toSet()
                val invitedDocs = if (invitedEmails.isNotEmpty()) {
                    try {
                        val allDocs = supabaseClient.postgrest["doctors"].select().decodeList<Doctor>()
                        allDocs.filter { it.email?.trim()?.lowercase() in invitedEmails }
                    } catch (e: Exception) {
                        emptyList()
                    }
                } else emptyList()

                val allRoster = (directDocs + invitedDocs).distinctBy { it.id }

                // Doctor is only physically "In Clinic" if their active clinic_id matches this clinic
                allRoster.map { doc ->
                    val isPresentHere = doc.clinicId == clinicId && (doc.isInClinic == true)
                    doc.copy(isInClinic = isPresentHere)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                emptyList()
            }
        } else {
            try {
                supabaseClient.postgrest["doctors"].select().decodeList<Doctor>()
            } catch (e: Exception) {
                emptyList()
            }
        }
    }

    suspend fun searchDoctors(query: String): List<Doctor> {
        return supabaseClient.postgrest["doctors"]
            .select { filter { ilike("full_name", "%$query%") } }
            .decodeList<Doctor>()
    }

    suspend fun getDoctorById(id: String): Doctor? {
        if (id.isBlank()) return null
        return try {
            supabaseClient.postgrest["doctors"]
                .select { filter { eq("id", id) } }
                .decodeSingleOrNull<Doctor>()
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
