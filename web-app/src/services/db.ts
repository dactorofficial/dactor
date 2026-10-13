import { supabase } from '../lib/supabase'
import {
  Clinic,
  ClinicInvitation,
  Doctor,
  Appointment,
  Slot,
  ClinicService,
  LabReport,
  DactorNotification,
  MedicalSpecialty,
  MedicalQualification,
  BillingInvoice,
  QueueEntry,
  PatientProfile,
  PatientTransactionRecord,
  PaymentGatewaysConfig,
  SupportTicket,
} from '../types'

// ==========================================
// CLINICS API
// ==========================================
export async function getClinics(): Promise<Clinic[]> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return (data || [])
      .map(mapClinic)
      .filter((c) => {
        const isVerified = c.verificationStatus === 'approved' || c.verificationStatus === 'verified'
        return isVerified && !c.isArchived
      })
  } catch (err) {
    console.error('Error fetching clinics:', err)
    return []
  }
}

export async function getClinicById(id: string): Promise<Clinic | null> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    const mapped = mapClinic(data)
    const isVerified = mapped.verificationStatus === 'approved' || mapped.verificationStatus === 'verified'
    if (!isVerified || mapped.isArchived) return null
    return mapped
  } catch {
    return null
  }
}

export async function getClinicForPortalById(id: string): Promise<Clinic | null> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return mapClinic(data)
  } catch {
    return null
  }
}

export async function getClinicByEmail(email: string): Promise<Clinic | null> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .ilike('contact_email', email.trim().toLowerCase())
      .single()

    if (error) return null
    return data ? mapClinic(data) : null
  } catch {
    return null
  }
}

export async function createClinic(clinic: Partial<Clinic>): Promise<Clinic | null> {
  try {
    const validType =
      clinic.type === 'diagnostic_lab'
        ? 'diagnostic_lab'
        : clinic.type === 'single_visit'
        ? 'single_visit'
        : 'multi_visit'

    const dbPayload = {
      id: clinic.id || crypto.randomUUID(),
      name: clinic.name || 'New Healthcare Center',
      type: validType,
      verification_status: clinic.verificationStatus || 'approved',
      contact_phone: clinic.contactPhone || '+9779800000000',
      contact_email: (clinic.contactEmail || `clinic.${Date.now()}@dactor.health`).toLowerCase(),
      address_text: clinic.addressText || 'Kathmandu, Nepal',
      latitude: clinic.latitude || 27.7172,
      longitude: clinic.longitude || 85.324,
      auto_notify_threshold: clinic.autoNotifyThreshold || 2,
      description: clinic.description || '',
      pan_number: clinic.panNumber || '',
      manager_phone: clinic.managerPhone || clinic.contactPhone || '',
      registration_doc_url: clinic.registrationDocUrl || null,
      pictures: clinic.pictures || [],
      specialties: clinic.specialties || [],
    }

    const { data, error } = await supabase
      .from('clinics')
      .insert(dbPayload)
      .select()
      .single()

    if (error) throw error
    return data ? mapClinic(data) : null
  } catch (err) {
    console.error('Error creating clinic:', err)
    return null
  }
}

// ==========================================
// DOCTORS API
// ==========================================
export async function getDoctors(): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('full_name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapDoctor)
  } catch (err) {
    console.error('Error fetching doctors:', err)
    return []
  }
}

export async function getDoctorsByClinic(clinicId: string): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .or(`clinic_id.eq.${clinicId},active_clinic_id.eq.${clinicId},primary_clinic_id.eq.${clinicId}`)
      .order('full_name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapDoctor)
  } catch (err) {
    console.error('Error fetching clinic doctors:', err)
    return []
  }
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data ? mapDoctor(data) : null
  } catch {
    return null
  }
}

export async function getDoctorByEmail(email: string): Promise<Doctor | null> {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .ilike('email', email.trim().toLowerCase())
      .single()

    if (error) return null
    return data ? mapDoctor(data) : null
  } catch {
    return null
  }
}

export async function createDoctor(doctor: Partial<Doctor>): Promise<Doctor | null> {
  try {
    const role = doctor.practitionerRole || (doctor.isLabTechnician ? 'lab_technician' : 'doctor')
    const certMeta = JSON.stringify({
      gender: doctor.gender || 'Male',
      age: doctor.age || 35,
      starting_practicing_year: doctor.startingPracticingYear || 2018,
      education: doctor.education || 'MBBS, MD',
      personal_mobile_number: doctor.personalMobileNumber || '',
      public_mobile_number: doctor.publicMobileNumber || doctor.personalMobileNumber || '',
      description: doctor.description || '',
      practitioner_role: role,
    })

    const dbPayload = {
      id: doctor.id || crypto.randomUUID(),
      full_name: doctor.fullName || 'Dr. Specialist',
      email: (doctor.email || `dr.${Date.now()}@dactor.health`).toLowerCase(),
      specialty: doctor.specialty || 'General Physician',
      specialties: doctor.specialties || [doctor.specialty || 'General Physician'],
      education: doctor.education || 'MBBS',
      nmc_license_number: doctor.nmcLicenseNumber || `NMC-${Math.floor(10000 + Math.random() * 90000)}`,
      starting_practicing_year: doctor.startingPracticingYear || 2018,
      gender: doctor.gender || 'Male',
      age: doctor.age || 35,
      personal_mobile_number: doctor.personalMobileNumber || '',
      public_mobile_number: doctor.publicMobileNumber || doctor.personalMobileNumber || '',
      consultation_fee: doctor.consultationFee || 500,
      is_in_clinic: doctor.isInClinic ?? true,
      clinic_id: doctor.clinicId || null,
      active_clinic_id: doctor.activeClinicId || doctor.clinicId || null,
      kyc_status: 'approved',
      profile_picture_url: doctor.profilePictureUrl || null,
      description: doctor.description || null,
      certificates_doc_url: certMeta,
    }

    const { data, error } = await supabase
      .from('doctors')
      .insert(dbPayload)
      .select()
      .single()

    if (error) throw error
    return data ? mapDoctor(data) : null
  } catch (err) {
    console.error('Error creating doctor:', err)
    return null
  }
}

// ==========================================
// APPOINTMENTS & LIVE QUEUE API
// ==========================================
function formatTimeForPostgres(timeStr?: string): string {
  if (!timeStr) return '10:00:00'
  const clean = timeStr.trim().toUpperCase()
  const isPM = clean.includes('PM')
  const isAM = clean.includes('AM')
  const timeOnly = clean.replace(/[^0-9:]/g, '')
  const parts = timeOnly.split(':')
  let hours = parseInt(parts[0] || '10', 10)
  const mins = parseInt(parts[1] || '0', 10)
  if (isNaN(hours)) hours = 10
  if (isPM && hours < 12) hours += 12
  if (isAM && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${String(isNaN(mins) ? 0 : mins).padStart(2, '0')}:00`
}

function normalizePaymentStatus(status?: string): 'pending' | 'paid' | 'refunded' | 'not_required' {
  if (status === 'paid') return 'paid'
  if (status === 'refunded') return 'refunded'
  if (status === 'not_required') return 'not_required'
  return 'pending'
}

export async function getAppointmentByTrackingCode(code: string): Promise<Appointment | null> {
  try {
    const cleanCode = code.trim()
    const { data, error } = await supabase
      .from('appointments')
      .select('*, clinic:clinics(*), doctor:doctors(*), queue_entries(*)')
      .eq('tracking_code_10_digit', cleanCode)
      .single()

    if (error) return null
    return data ? mapAppointment(data) : null
  } catch {
    return null
  }
}

export async function getAppointmentsByClinic(clinicId: string, date?: string): Promise<Appointment[]> {
  try {
    let query = supabase
      .from('appointments')
      .select('*, doctor:doctors(*), clinic:clinics(*), queue_entries(*)')
      .eq('clinic_id', clinicId)

    if (date) {
      query = query.eq('appointment_date', date)
    }

    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(mapAppointment)
  } catch (err) {
    console.error('Error fetching appointments by clinic:', err)
    return []
  }
}

export async function getAppointmentsByDoctor(doctorId: string, date?: string): Promise<Appointment[]> {
  try {
    let query = supabase
      .from('appointments')
      .select('*, clinic:clinics(*), doctor:doctors(*), queue_entries(*)')
      .eq('doctor_id', doctorId)

    if (date) {
      query = query.eq('appointment_date', date)
    }

    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(mapAppointment)
  } catch (err) {
    console.error('Error fetching appointments by doctor:', err)
    return []
  }
}

export async function createAppointment(appt: Partial<Appointment> & { slotId?: string }): Promise<Appointment | null> {
  try {
    const code10 = appt.trackingCode10Digit || generate10DigitTrackingCode()
    const apptId = appt.id || crypto.randomUUID()
    const isWalkin = appt.isWalkin ?? (appt.notes?.toLowerCase().includes('walk-in') || false)
    const apptDate = appt.appointmentDate || new Date().toISOString().split('T')[0]
    const apptTime = formatTimeForPostgres(appt.appointmentTime)

    // 1. Resolve or register patient in profiles directory
    let resolvedUserId = appt.userId && appt.userId.length === 36 ? appt.userId : null
    const cleanEmail = appt.patientEmail?.trim().toLowerCase() || null
    const cleanMobile = appt.patientMobile?.trim().replace(/\D/g, '') || ''
    const patientNameClean = appt.patientName?.trim() || 'Patient'

    try {
      let existingProf: any = null
      if (cleanEmail) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle()
        if (data) existingProf = data
      }
      if (!existingProf && cleanMobile) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', cleanMobile)
          .maybeSingle()
        if (data) existingProf = data
      }

      if (existingProf) {
        resolvedUserId = existingProf.id
        const updatePayload: any = {}
        if (!existingProf.full_name && patientNameClean) updatePayload.full_name = patientNameClean
        if (!existingProf.phone && cleanMobile) updatePayload.phone = cleanMobile
        if (!existingProf.age && appt.patientAge) updatePayload.age = Number(appt.patientAge)
        if (!existingProf.gender && appt.patientGender) updatePayload.gender = appt.patientGender
        if (Object.keys(updatePayload).length > 0) {
          updatePayload.updated_at = new Date().toISOString()
          await supabase.from('profiles').update(updatePayload).eq('id', existingProf.id)
        }
      } else {
        const newProfId = resolvedUserId || crypto.randomUUID()
        const newProfile: any = {
          id: newProfId,
          full_name: patientNameClean,
          email: cleanEmail,
          phone: cleanMobile,
          age: Number(appt.patientAge) || null,
          gender: appt.patientGender || null,
          role: 'patient',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        const { data: createdProf, error: profErr } = await supabase.from('profiles').insert(newProfile).select().single()
        if (!profErr && createdProf) {
          resolvedUserId = createdProf.id
        }
      }
    } catch (profErr) {
      console.warn('Patient directory profile link note:', profErr)
    }

    const dbPayload: any = {
      id: apptId,
      tracking_code_10_digit: code10,
      user_id: resolvedUserId,
      clinic_id: appt.clinicId,
      doctor_id: appt.doctorId || null,
      patient_name: patientNameClean,
      patient_age: Number(appt.patientAge) || 1,
      patient_gender: appt.patientGender || 'Other',
      patient_mobile: cleanMobile,
      patient_email: cleanEmail,
      appointment_date: apptDate,
      appointment_time: apptTime,
      checkin_status: 'checked_in',
      payment_status: normalizePaymentStatus(appt.paymentStatus),
      fee_amount: Number(appt.feeAmount) || 0,
      is_walkin: isWalkin,
      opt_in_early_call: Boolean(appt.optInEarlyCall),
    }

    if (appt.selectedTests && appt.selectedTests.length > 0) {
      dbPayload.selected_lab_tests = JSON.stringify(appt.selectedTests)
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert(dbPayload)
      .select('*, clinic:clinics(*), doctor:doctors(*)')
      .single()

    if (error) throw error

    // Enroll into live queue_entries with slot-aware ordering:
    // Place walk-in / appointment at the LAST position of their time slot, and shift later appointments (+1)
    let nextPos = 1
    try {
      const targetSlotTime = appt.appointmentTime || apptTime
      const targetSlotMinutes = parseTimeToMinutes(targetSlotTime)

      const { data: activeEntries } = await supabase
        .from('queue_entries')
        .select('id, appointment_id, queue_position, status')
        .eq('clinic_id', appt.clinicId)
        .in('status', ['waiting', 'inside'])
        .order('queue_position', { ascending: true })

      if (!activeEntries || activeEntries.length === 0) {
        nextPos = 1
      } else {
        const apptIds = activeEntries.map((e) => e.appointment_id).filter(Boolean)
        const { data: activeAppts } = await supabase
          .from('appointments')
          .select('id, appointment_time, appointment_date')
          .in('id', apptIds)

        const apptMap = new Map<string, any>((activeAppts || []).map((a) => [a.id, a]))

        // Preceding entries: patient inside cabin OR patients in earlier or same time slot
        const preceding = activeEntries.filter((entry) => {
          if (entry.status === 'inside') return true
          const a = apptMap.get(entry.appointment_id)
          const slotMins = parseTimeToMinutes(a?.appointment_time)
          return slotMins <= targetSlotMinutes
        })

        // Target insertion position is right after the last preceding patient in this slot
        nextPos = (preceding.length > 0 ? Math.max(...preceding.map((p) => p.queue_position || 0)) : 0) + 1

        // Shift all active entries with queue_position >= nextPos down (+1) in descending order to avoid key collision
        const laterEntries = activeEntries
          .filter((entry) => (entry.queue_position || 0) >= nextPos)
          .sort((a, b) => (b.queue_position || 0) - (a.queue_position || 0))

        for (const entry of laterEntries) {
          const shifted = (entry.queue_position || 0) + 1
          await supabase
            .from('queue_entries')
            .update({ queue_position: shifted, updated_at: new Date().toISOString() })
            .eq('id', entry.id)
        }
      }

      await supabase.from('queue_entries').insert({
        id: crypto.randomUUID(),
        appointment_id: apptId,
        clinic_id: appt.clinicId,
        doctor_id: appt.doctorId || null,
        queue_position: nextPos,
        status: 'waiting',
      })
    } catch (qErr) {
      console.warn('Queue entry slot-aware auto-enroll warning:', qErr)
    }

    // Increment slot booked_count if applicable
    try {
      if (appt.slotId) {
        const { data: slotRow } = await supabase.from('slots').select('booked_count').eq('id', appt.slotId).maybeSingle()
        if (slotRow) {
          await supabase.from('slots').update({ booked_count: (Number(slotRow.booked_count) || 0) + 1 }).eq('id', appt.slotId)
        }
      } else if (appt.clinicId) {
        const { data: slotRow } = await supabase
          .from('slots')
          .select('id, booked_count')
          .eq('clinic_id', appt.clinicId)
          .eq('slot_date', apptDate)
          .eq('start_time', apptTime)
          .maybeSingle()
        if (slotRow) {
          await supabase.from('slots').update({ booked_count: (Number(slotRow.booked_count) || 0) + 1 }).eq('id', slotRow.id)
        }
      }
    } catch {}

    // Create automatic appointment confirmation notification in Supabase
    try {
      const clinicName = data?.clinic?.name || 'Clinic'
      await supabase.from('notifications').insert({
        id: crypto.randomUUID(),
        appointment_id: apptId,
        user_id: appt.userId && appt.userId.length === 36 ? appt.userId : null,
        title: `Appointment Confirmed • Token #${nextPos}`,
        message: `Your appointment at ${clinicName} on ${apptDate} (${appt.appointmentTime || apptTime}) is confirmed. 10-Digit Tracking Code: ${code10}`,
        type: 'queue_alert',
        target_audience: 'specific',
        is_read: false,
        created_at: new Date().toISOString(),
      })
    } catch {}

    return data ? mapAppointment({ ...data, queue_entries: [{ status: 'waiting', queue_position: nextPos }] }) : null
  } catch (err) {
    console.error('Error creating appointment:', err)
    return null
  }
}

export async function updateAppointmentStatus(id: string, status: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString()

    // Map UI status to valid queue_status_enum
    let qStatus = 'waiting'
    if (status === 'in_consultation' || status === 'inside') qStatus = 'inside'
    else if (status === 'completed' || status === 'done') qStatus = 'done'
    else if (status === 'cancelled' || status === 'no_show') qStatus = 'no_show'
    else if (status === 'sample_collected') qStatus = 'sample_collected'
    else if (status === 'processing') qStatus = 'processing'
    else if (status === 'report_prepared') qStatus = 'report_prepared'
    else qStatus = 'waiting'

    // Ensure appointment checkin_status is checked_in
    await supabase
      .from('appointments')
      .update({ checkin_status: 'checked_in', updated_at: nowIso })
      .eq('id', id)

    // Update or create queue_entries row
    const { data: existingQ } = await supabase
      .from('queue_entries')
      .select('id')
      .eq('appointment_id', id)
      .maybeSingle()

    const qUpdate: any = { status: qStatus, updated_at: nowIso }
    if (qStatus === 'inside') {
      qUpdate.inside_at = nowIso
    } else if (['done', 'no_show', 'sample_collected', 'processing', 'report_prepared'].includes(qStatus)) {
      qUpdate.completed_at = nowIso
    }

    if (existingQ?.id) {
      const { error: qErr } = await supabase
        .from('queue_entries')
        .update(qUpdate)
        .eq('id', existingQ.id)
      return !qErr
    } else {
      // Fetch appointment to get clinic_id & doctor_id
      const { data: appt } = await supabase
        .from('appointments')
        .select('clinic_id, doctor_id')
        .eq('id', id)
        .maybeSingle()

      if (appt?.clinic_id) {
        const { error: insErr } = await supabase.from('queue_entries').insert({
          id: crypto.randomUUID(),
          appointment_id: id,
          clinic_id: appt.clinic_id,
          doctor_id: appt.doctor_id || null,
          queue_position: 1,
          ...qUpdate,
        })
        return !insErr
      }
    }

    return true
  } catch (err) {
    console.error('Error updating appointment status:', err)
    return false
  }
}

// ==========================================
// SLOTS & SCHEDULE API
// ==========================================
export async function getSlots(clinicId: string, date: string): Promise<Slot[]> {
  try {
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('slot_date', date)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data || []).map(mapSlot)
  } catch (err) {
    console.error('Error fetching slots:', err)
    return []
  }
}

export async function createSlot(slot: Partial<Slot>): Promise<Slot | null> {
  try {
    const dbPayload = {
      id: slot.id || crypto.randomUUID(),
      clinic_id: slot.clinicId,
      doctor_id: slot.doctorId,
      slot_date: slot.slotDate,
      start_time: formatTimeForPostgres(slot.startTime),
      end_time: formatTimeForPostgres(slot.endTime),
      max_capacity: slot.maxCapacity || 10,
      booked_count: slot.bookedCount || 0,
    }

    const { data, error } = await supabase
      .from('slots')
      .insert(dbPayload)
      .select()
      .single()

    if (error) throw error
    return data ? mapSlot(data) : null
  } catch {
    return null
  }
}

export async function getSlotsByDoctorAndDate(doctorId: string, date: string): Promise<Slot[]> {
  try {
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('slot_date', date)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data || []).map(mapSlot)
  } catch (err) {
    console.error('Error fetching slots by doctor and date:', err)
    return []
  }
}

export async function deleteSlot(slotId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('slots').delete().eq('id', slotId)
    return !error
  } catch (err) {
    console.error('Error deleting slot:', err)
    return false
  }
}

export async function reorderQueuePosition(
  clinicId: string,
  appointmentId: string,
  direction: 'up' | 'down'
): Promise<{ success: boolean; message?: string }> {
  try {
    // 1. Fetch all waiting queue entries for this clinic ordered by position
    const { data: entries, error } = await supabase
      .from('queue_entries')
      .select('id, appointment_id, queue_position, status')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('queue_position', { ascending: true })

    if (error || !entries || entries.length <= 1) {
      return { success: false, message: 'Not enough waiting queue entries to slide.' }
    }

    const currentIndex = entries.findIndex((e) => e.appointment_id === appointmentId)
    if (currentIndex === -1) {
      return { success: false, message: 'Patient not currently in waiting queue.' }
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= entries.length) {
      return {
        success: false,
        message: direction === 'up' ? 'Already at the top of the waiting queue.' : 'Already at the end of the waiting queue.',
      }
    }

    const currentEntry = entries[currentIndex]
    const targetEntry = entries[targetIndex]

    // Swap their queue positions safely
    const posA = currentEntry.queue_position
    const posB = targetEntry.queue_position

    // Temporarily set negative position to prevent duplicate index violation if unique constraint exists
    await supabase
      .from('queue_entries')
      .update({ queue_position: -999999, updated_at: new Date().toISOString() })
      .eq('id', currentEntry.id)

    await supabase
      .from('queue_entries')
      .update({ queue_position: posA, updated_at: new Date().toISOString() })
      .eq('id', targetEntry.id)

    await supabase
      .from('queue_entries')
      .update({ queue_position: posB, updated_at: new Date().toISOString() })
      .eq('id', currentEntry.id)

    return { success: true }
  } catch (err: any) {
    console.error('Error reordering queue position:', err)
    return { success: false, message: err?.message || 'Failed to reorder queue position' }
  }
}

export async function shiftAppointmentDate(
  appointmentId: string,
  newDate: string,
  newTime?: string,
  reason?: string
): Promise<boolean> {
  try {
    const updatePayload: any = {
      appointment_date: newDate,
      updated_at: new Date().toISOString(),
    }
    if (newTime) {
      updatePayload.appointment_time = newTime
    }

    const { data: updatedAppt, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .select('*, clinic:clinics(*)')
      .single()

    if (error) throw error

    // Create reschedule alert notification for the patient
    try {
      const clinicName = updatedAppt?.clinic?.name || 'Clinic'
      await supabase.from('notifications').insert({
        id: crypto.randomUUID(),
        appointment_id: appointmentId,
        user_id: updatedAppt?.user_id && updatedAppt.user_id.length === 36 ? updatedAppt.user_id : null,
        title: `Appointment Rescheduled • ${newDate}`,
        message: `Your appointment at ${clinicName} has been shifted to ${newDate} (${newTime || updatedAppt?.appointment_time || 'Scheduled'}). Reason: ${reason || 'Schedule adjustment by clinic.'}`,
        type: 'queue_alert',
        target_audience: 'specific',
        is_read: false,
        created_at: new Date().toISOString(),
      })
    } catch {}

    return true
  } catch (err) {
    console.error('Error shifting appointment date:', err)
    return false
  }
}

export async function checkAndNotifyApproachingPatients(
  clinicId: string,
  threshold = 3
): Promise<void> {
  try {
    const { data: waitingEntries } = await supabase
      .from('queue_entries')
      .select('id, appointment_id, queue_position, appointments(patient_name, user_id, clinic_id, clinics(name))')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('queue_position', { ascending: true })

    if (!waitingEntries) return

    for (const entry of waitingEntries) {
      const pos = Number(entry.queue_position)
      if (pos > 0 && pos <= threshold) {
        const appt: any = entry.appointments
        const clinicName = appt?.clinics?.name || 'Clinic'
        const patientsAhead = Math.max(0, pos - 1)
        const msg = patientsAhead === 0
          ? `You are next in line at ${clinicName}! Please prepare to enter the doctor's cabin.`
          : `Your turn is approaching! Only ${patientsAhead} ${patientsAhead === 1 ? 'patient' : 'patients'} ahead of you at ${clinicName}. Please proceed to the clinic waiting area.`

        await supabase.from('notifications').insert({
          id: crypto.randomUUID(),
          appointment_id: entry.appointment_id,
          user_id: appt?.user_id && appt.user_id.length === 36 ? appt.user_id : null,
          title: `Your Turn is Approaching! Token #${pos}`,
          message: msg,
          type: 'queue_alert',
          target_audience: 'specific',
          is_read: false,
          created_at: new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    console.warn('Error checking approaching patients notification:', err)
  }
}

// ==========================================
// DIAGNOSTIC LAB SERVICES & RATES
// ==========================================
export async function getClinicServices(clinicId: string): Promise<ClinicService[]> {
  try {
    const { data, error } = await supabase
      .from('clinic_services')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('service_name', { ascending: true })

    if (error) throw error
    return (data || []).map(mapService)
  } catch (err) {
    console.error('Error fetching clinic services:', err)
    return []
  }
}

export async function createClinicService(service: Partial<ClinicService>): Promise<ClinicService | null> {
  try {
    const dbPayload = {
      id: service.id || crypto.randomUUID(),
      clinic_id: service.clinicId,
      service_name: service.serviceName,
      price: Number(service.price) || 0,
      description: service.category || service.description || 'Diagnostic Test',
    }

    const { data, error } = await supabase
      .from('clinic_services')
      .insert(dbPayload)
      .select()
      .single()

    if (error) throw error
    return data ? mapService(data) : null
  } catch (err) {
    console.error('Error creating clinic service:', err)
    return null
  }
}

export async function deleteClinicService(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('clinic_services').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

// ==========================================
// LAB REPORTS API
// ==========================================
export async function getLabReportsByTrackingCode(code: string): Promise<LabReport[]> {
  try {
    const cleanCode = code.trim()
    // Find appointment by 10-digit code first
    const appt = await getAppointmentByTrackingCode(cleanCode)
    if (!appt) return []

    const { data, error } = await supabase
      .from('lab_reports')
      .select('*, appointment:appointments(*)')
      .eq('appointment_id', appt.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map((r) => mapLabReport({ ...r, tracking_code_10_digit: cleanCode }))
  } catch (err) {
    console.error('Error fetching lab reports by code:', err)
    return []
  }
}

export async function getLabReportsByClinic(clinicId: string): Promise<LabReport[]> {
  try {
    const { data, error } = await supabase
      .from('lab_reports')
      .select('*, appointment:appointments(*)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(mapLabReport)
  } catch (err) {
    console.error('Error fetching lab reports by clinic:', err)
    return []
  }
}

export async function saveLabReport(report: Partial<LabReport>): Promise<LabReport | null> {
  try {
    const rStatus = (report.status as string) || 'processing'
    let stage: 'sample_collected' | 'processing' | 'prepared' = 'processing'
    if (rStatus === 'sample_collected') stage = 'sample_collected'
    else if (rStatus === 'ready' || rStatus === 'prepared' || rStatus === 'delivered') stage = 'prepared'

    const dbPayload: any = {
      id: report.id || crypto.randomUUID(),
      appointment_id: report.appointmentId,
      clinic_id: report.clinicId,
      test_name: report.testName || 'Diagnostic Pathology Report',
      stage,
      file_url: report.reportFileUrl || null,
      file_name: report.technicianNotes || 'lab_report.pdf',
      file_type: report.reportFileType || 'pdf',
      patient_name_verification: report.patientName || 'Patient',
      sample_collected_at: report.sampleCollectedAt || new Date().toISOString(),
      prepared_at: stage === 'prepared' ? (report.preparedAt || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('lab_reports')
      .upsert(dbPayload, { onConflict: 'appointment_id' })
      .select('*, appointment:appointments(*)')
      .single()

    if (error) throw error
    return data ? mapLabReport(data) : null
  } catch (err) {
    console.error('Error saving lab report:', err)
    return null
  }
}

export async function uploadReportFile(fileName: string, fileBlob: Blob): Promise<string | null> {
  try {
    const buckets = ['clinic_photos', 'doctor_photos', 'clinic_files']
    const cleanName = fileName.replace(/\s+/g, '_')
    const path = `lab_reports_${Date.now()}_${cleanName}`

    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(path, fileBlob, {
        upsert: true,
        contentType: fileBlob.type || 'application/pdf',
      })
      if (!error) {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
        return publicData.publicUrl
      }
    }
    return null
  } catch (err) {
    console.error('Error uploading report file:', err)
    return null
  }
}

export async function uploadClinicDocument(fileName: string, fileBlob: Blob, folder = 'registration_docs'): Promise<string | null> {
  try {
    const cleanName = fileName.replace(/\s+/g, '_')
    const path = `${folder}_${Date.now()}_${cleanName}`

    // Prioritize bucket based on target folder or filename
    let primaryBucket = 'clinic_photos'
    if (folder === 'doctor_photos' || fileName.includes('doc_photo') || folder.includes('doctor')) {
      primaryBucket = 'doctor_photos'
    } else if (folder === 'doctor_kyc_docs' || fileName.includes('nmc_') || folder.includes('kyc')) {
      primaryBucket = 'doctor-kyc'
    } else {
      primaryBucket = 'clinic_photos'
    }

    const candidateBuckets = [primaryBucket, 'clinic_photos', 'doctor_photos', 'doctor-kyc']
    const uniqueBuckets = Array.from(new Set(candidateBuckets))

    for (const bucket of uniqueBuckets) {
      const { error } = await supabase.storage.from(bucket).upload(path, fileBlob, {
        upsert: true,
        contentType: fileBlob.type || 'image/jpeg',
      })
      if (!error) {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
        if (publicData?.publicUrl) {
          return publicData.publicUrl
        }
      }
    }
    return null
  } catch (err) {
    console.error('Error uploading document:', err)
    return null
  }
}

export async function uploadClinicPhoto(clinicId: string, fileBlob: Blob, originalName = 'clinic_facility.jpg'): Promise<string | null> {
  const cleanName = originalName.replace(/\s+/g, '_')
  const fileName = `clinic_${clinicId}_${Date.now()}_${cleanName}`
  return await uploadClinicDocument(fileName, fileBlob, 'clinic_photos')
}

export async function uploadDoctorPhoto(doctorId: string, fileBlob: Blob, originalName = 'doctor_avatar.jpg'): Promise<string | null> {
  const cleanName = originalName.replace(/\s+/g, '_')
  const fileName = `doc_${doctorId}_${Date.now()}_${cleanName}`
  return await uploadClinicDocument(fileName, fileBlob, 'doctor_photos')
}

// ==========================================
// NOTIFICATIONS API
// ==========================================
export async function getClinicNotifications(_clinicId: string): Promise<DactorNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return (data || []).map(mapNotification)
  } catch (err) {
    console.error('Error fetching notifications:', err)
    return []
  }
}

export async function getPatientNotifications(criteria?: {
  userId?: string
  appointmentIds?: string[]
  trackingCodes?: string[]
}): Promise<DactorNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    const rows = data || []
    const userId = criteria?.userId?.trim()
    const apptSet = new Set((criteria?.appointmentIds || []).filter(Boolean))
    const codeSet = new Set((criteria?.trackingCodes || []).map((c) => c.trim()).filter(Boolean))
    const hasPersonalFilter = Boolean(userId || apptSet.size > 0 || codeSet.size > 0)

    const filtered = rows.filter((n: any) => {
      if (n.target_audience === 'all_users' || n.type === 'clinic_broadcast') {
        return true
      }
      if (!hasPersonalFilter) {
        return true
      }
      if (userId && n.user_id === userId) return true
      if (n.appointment_id && apptSet.has(n.appointment_id)) return true
      const text = `${n.title || ''} ${n.message || ''} ${n.meta_json || ''}`
      for (const code of codeSet) {
        if (code && text.includes(code)) return true
      }
      return false
    })

    return filtered.map(mapNotification)
  } catch (err) {
    console.error('Error fetching patient notifications:', err)
    return []
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
    return !error
  } catch {
    return false
  }
}

export async function markAllNotificationsAsRead(notificationIds: string[]): Promise<boolean> {
  try {
    if (!notificationIds || notificationIds.length === 0) return true
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', notificationIds)
    return !error
  } catch {
    return false
  }
}

export async function sendBroadcastNotification(_clinicId: string, title: string, message: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      id: crypto.randomUUID(),
      title: title.trim(),
      message: message.trim(),
      type: 'clinic_broadcast',
      target_audience: 'all_users',
      is_read: false,
      created_at: new Date().toISOString(),
    })

    return !error
  } catch {
    return false
  }
}

// ==========================================
// BILLING & CLINIC OPERATIONS API
// ==========================================
export async function getBillingInvoicesByClinic(clinicId: string): Promise<BillingInvoice[]> {
  try {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(mapBillingInvoice)
  } catch (err) {
    console.error('Error fetching clinic billing invoices:', err)
    return []
  }
}

export async function getInvoiceForAppointment(appointmentId: string): Promise<BillingInvoice | null> {
  try {
    const { data, error } = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    if (error || !data) return null
    return mapBillingInvoice(data)
  } catch {
    return null
  }
}

export async function saveOrUpdateInvoicePayment(params: {
  appointmentId: string
  clinicId: string
  totalAmount: number
  paidAmount: number
  remarks?: string
  receiptUrl?: string
}): Promise<BillingInvoice | null> {
  try {
    const { appointmentId, clinicId, totalAmount, paidAmount, remarks, receiptUrl } = params
    const balanceDue = Math.max(0, totalAmount - paidAmount)
    const dbPaymentStatus = paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : 'pending'
    const nowIso = new Date().toISOString()

    // Check if invoice already exists
    const { data: existing } = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    const combinedRemarks = [
      remarks?.trim(),
      receiptUrl ? `Receipt: ${receiptUrl}` : undefined,
    ]
      .filter(Boolean)
      .join(' | ')

    const invoicePayload: any = {
      id: existing?.id || crypto.randomUUID(),
      appointment_id: appointmentId,
      clinic_id: clinicId,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      payment_status: dbPaymentStatus,
      paid_at: paidAmount > 0 ? (existing?.paid_at || nowIso) : null,
      remarks: combinedRemarks || existing?.remarks || null,
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso,
    }

    const { data, error } = await supabase
      .from('billing_invoices')
      .upsert(invoicePayload, { onConflict: 'appointment_id' })
      .select()
      .single()

    if (error) throw error

    // Also update the appointment fee_amount and payment_status
    await supabase
      .from('appointments')
      .update({
        fee_amount: totalAmount,
        payment_status: dbPaymentStatus,
        updated_at: nowIso,
      })
      .eq('id', appointmentId)

    return data ? mapBillingInvoice(data) : null
  } catch (err) {
    console.error('Error saving billing invoice:', err)
    return null
  }
}

export async function uploadReceiptFile(fileName: string, fileBlob: Blob): Promise<string | null> {
  try {
    const bucket = 'clinic_files'
    const path = `receipts/${Date.now()}_${fileName.replace(/\s+/g, '_')}`
    const { error } = await supabase.storage.from(bucket).upload(path, fileBlob, {
      upsert: true,
      contentType: fileBlob.type || 'image/jpeg',
    })
    if (error) throw error
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicData.publicUrl
  } catch (err) {
    console.error('Error uploading receipt file:', err)
    return null
  }
}

export async function updateDoctorPresence(doctorId: string, isInClinic: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('doctors')
      .update({ is_in_clinic: isInClinic })
      .eq('id', doctorId)
    return !error
  } catch {
    return false
  }
}

export async function updateClinicBreak(clinicId: string, isOnBreak: boolean): Promise<boolean> {
  const ok = await updateClinic(clinicId, {
    isOnBreak,
    breakUpdatedAt: new Date().toISOString(),
  })
  if (ok && isOnBreak) {
    await sendBroadcastNotification(
      clinicId,
      'Clinic is Currently on a Break',
      'The clinic is temporarily on break. Queue consultations are paused and will resume shortly.'
    )
  }
  return ok
}

export async function updateClinic(id: string, updates: Partial<Clinic>): Promise<boolean> {
  try {
    const { data: current } = await supabase.from('clinics').select('*').eq('id', id).single()
    let currentMeta: any = {}
    if (current?.description && typeof current.description === 'string' && current.description.trim().startsWith('{')) {
      try { currentMeta = JSON.parse(current.description) } catch {}
    }

    const newMeta = {
      ...currentMeta,
      desc: updates.description !== undefined ? updates.description : (currentMeta.desc ?? current?.description),
      pan_number: updates.panNumber !== undefined ? updates.panNumber : (currentMeta.pan_number ?? current?.pan_number),
      manager_phone: updates.managerPhone !== undefined ? updates.managerPhone : (currentMeta.manager_phone ?? current?.manager_phone),
      registration_doc_url: updates.registrationDocUrl !== undefined ? updates.registrationDocUrl : (currentMeta.registration_doc_url ?? current?.registration_doc_url),
      specialties: updates.specialties !== undefined ? updates.specialties : (currentMeta.specialties ?? current?.specialties),
      is_on_break: updates.isOnBreak !== undefined ? updates.isOnBreak : (currentMeta.is_on_break ?? current?.is_on_break),
      break_updated_at: updates.breakUpdatedAt !== undefined ? updates.breakUpdatedAt : (currentMeta.break_updated_at ?? current?.break_updated_at),
      weekly_schedule_json: updates.weeklyScheduleJson !== undefined ? updates.weeklyScheduleJson : (currentMeta.weekly_schedule_json ?? current?.weekly_schedule_json),
      declared_holidays: updates.declaredHolidays !== undefined ? updates.declaredHolidays : (currentMeta.declared_holidays ?? current?.declared_holidays),
      manual_avg_consultation_time_minutes: updates.manualAvgConsultationTimeMinutes !== undefined ? updates.manualAvgConsultationTimeMinutes : (currentMeta.manual_avg_consultation_time_minutes ?? current?.manual_avg_consultation_time_minutes),
      avg_time_mode: updates.avgTimeMode !== undefined ? updates.avgTimeMode : (currentMeta.avg_time_mode ?? current?.avg_time_mode),
      pictures: updates.pictures !== undefined ? updates.pictures : (currentMeta.pictures ?? current?.pictures),
      logo_url: updates.logoUrl !== undefined ? updates.logoUrl : (currentMeta.logo_url ?? current?.logo_url),
      is_activated: updates.isActivated !== undefined ? updates.isActivated : (currentMeta.is_activated ?? current?.is_activated ?? true),
      activation_expires_at: updates.activationExpiresAt !== undefined ? updates.activationExpiresAt : (currentMeta.activation_expires_at ?? current?.activation_expires_at),
      activation_plan: updates.activationPlan !== undefined ? updates.activationPlan : (currentMeta.activation_plan ?? current?.activation_plan),
      activation_paid_amount: updates.activationPaidAmount !== undefined ? updates.activationPaidAmount : (currentMeta.activation_paid_amount ?? current?.activation_paid_amount),
      activation_notes: updates.activationNotes !== undefined ? updates.activationNotes : (currentMeta.activation_notes ?? current?.activation_notes),
      is_archived: updates.isArchived !== undefined ? updates.isArchived : (currentMeta.is_archived ?? current?.is_archived ?? false),
      archived_at: updates.archivedAt !== undefined ? updates.archivedAt : (currentMeta.archived_at ?? current?.archived_at),
      deletion_scheduled_at: updates.deletionScheduledAt !== undefined ? updates.deletionScheduledAt : (currentMeta.deletion_scheduled_at ?? current?.deletion_scheduled_at),
      payment_gateway_provider: updates.paymentGatewayProvider !== undefined ? updates.paymentGatewayProvider : (currentMeta.payment_gateway_provider ?? current?.payment_gateway_provider),
      payment_api_key: updates.paymentApiKey !== undefined ? updates.paymentApiKey : (currentMeta.payment_api_key ?? current?.payment_api_key),
      payment_secret_key: updates.paymentSecretKey !== undefined ? updates.paymentSecretKey : (currentMeta.payment_secret_key ?? current?.payment_secret_key),
      merchant_id: updates.merchantId !== undefined ? updates.merchantId : (currentMeta.merchant_id ?? current?.merchant_id),
      is_direct_payment_enabled: updates.isDirectPaymentEnabled !== undefined ? updates.isDirectPaymentEnabled : (currentMeta.is_direct_payment_enabled ?? current?.is_direct_payment_enabled),
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
      description: JSON.stringify(newMeta),
    }

    if (updates.name) payload.name = updates.name
    if (updates.type) payload.type = updates.type
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone
    if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail
    if (updates.addressText !== undefined) payload.address_text = updates.addressText
    if (updates.latitude !== undefined) payload.latitude = updates.latitude
    if (updates.longitude !== undefined) payload.longitude = updates.longitude
    if (updates.autoNotifyThreshold !== undefined) payload.auto_notify_threshold = updates.autoNotifyThreshold
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl
    if (updates.pictures !== undefined) payload.pictures = updates.pictures
    if (updates.specialties !== undefined) payload.specialties = updates.specialties
    if (updates.registrationDocUrl !== undefined) payload.registration_doc_url = updates.registrationDocUrl
    if (updates.panNumber !== undefined) payload.pan_number = updates.panNumber
    if (updates.managerPhone !== undefined) payload.manager_phone = updates.managerPhone
    if (updates.isOnBreak !== undefined) payload.is_on_break = updates.isOnBreak
    if (updates.weeklyScheduleJson !== undefined) payload.weekly_schedule_json = updates.weeklyScheduleJson
    if (updates.declaredHolidays !== undefined) payload.declared_holidays = updates.declaredHolidays
    if (updates.manualAvgConsultationTimeMinutes !== undefined) payload.manual_avg_consultation_time_minutes = updates.manualAvgConsultationTimeMinutes
    if (updates.avgTimeMode !== undefined) payload.avg_time_mode = updates.avgTimeMode
    if (updates.isActivated !== undefined) payload.is_activated = updates.isActivated
    if (updates.activationExpiresAt !== undefined) payload.activation_expires_at = updates.activationExpiresAt
    if (updates.activationPlan !== undefined) payload.activation_plan = updates.activationPlan
    if (updates.activationPaidAmount !== undefined) payload.activation_paid_amount = updates.activationPaidAmount
    if (updates.activationNotes !== undefined) payload.activation_notes = updates.activationNotes
    if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived
    if (updates.archivedAt !== undefined) payload.archived_at = updates.archivedAt
    if (updates.deletionScheduledAt !== undefined) payload.deletion_scheduled_at = updates.deletionScheduledAt
    if (updates.paymentGatewayProvider !== undefined) payload.payment_gateway_provider = updates.paymentGatewayProvider
    if (updates.paymentApiKey !== undefined) payload.payment_api_key = updates.paymentApiKey
    if (updates.paymentSecretKey !== undefined) payload.payment_secret_key = updates.paymentSecretKey
    if (updates.merchantId !== undefined) payload.merchant_id = updates.merchantId
    if (updates.isDirectPaymentEnabled !== undefined) payload.is_direct_payment_enabled = updates.isDirectPaymentEnabled

    const { error } = await supabase.from('clinics').update(payload).eq('id', id)
    if (error) {
      await supabase.from('clinics').update({ description: JSON.stringify(newMeta), updated_at: new Date().toISOString() }).eq('id', id)
    }
    return true
  } catch (err) {
    console.error('Error updating clinic:', err)
    return false
  }
}

export async function toggleClinicHoliday(clinicId: string, dateStr: string, isHoliday: boolean): Promise<boolean> {
  const clinic = await getClinicForPortalById(clinicId)
  if (!clinic) return false

  let holidays = clinic.declaredHolidays || []
  if (isHoliday) {
    if (!holidays.includes(dateStr)) holidays = [...holidays, dateStr]
  } else {
    holidays = holidays.filter((d) => d !== dateStr)
  }

  return await updateClinic(clinicId, { declaredHolidays: holidays })
}

export async function saveWeeklySchedule(clinicId: string, schedule: any[]): Promise<boolean> {
  return await updateClinic(clinicId, {
    weeklyScheduleJson: JSON.stringify(schedule),
  })
}

export async function updateDoctor(doctorId: string, updates: Partial<Doctor>): Promise<boolean> {
  try {
    const payload: any = {}
    if (updates.fullName !== undefined) payload.full_name = updates.fullName
    if (updates.specialty !== undefined) {
      payload.specialty = updates.specialty
      payload.specialties = [updates.specialty]
    }
    if (updates.education !== undefined) payload.education = updates.education
    if (updates.nmcLicenseNumber !== undefined) payload.nmc_license_number = updates.nmcLicenseNumber
    if (updates.startingPracticingYear !== undefined) {
      payload.starting_practicing_year = updates.startingPracticingYear
    }
    if (updates.consultationFee !== undefined) payload.consultation_fee = updates.consultationFee
    if (updates.isInClinic !== undefined) payload.is_in_clinic = updates.isInClinic
    if (updates.personalMobileNumber !== undefined) payload.personal_mobile_number = updates.personalMobileNumber
    if (updates.publicMobileNumber !== undefined) payload.public_mobile_number = updates.publicMobileNumber
    if (updates.profilePictureUrl !== undefined) payload.profile_picture_url = updates.profilePictureUrl

    const { error } = await supabase.from('doctors').update(payload).eq('id', doctorId)
    return !error
  } catch {
    return false
  }
}

export async function sendManualNotification(
  appointmentId: string,
  title: string,
  message: string,
  _estimatedTimeLeft?: string,
  _expectedTime?: string,
  _trackingCode?: string,
  userId?: string,
  _clinicId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      id: crypto.randomUUID(),
      appointment_id: appointmentId && appointmentId.length === 36 ? appointmentId : null,
      user_id: userId && userId.length === 36 ? userId : null,
      title: title.trim(),
      message: message.trim(),
      type: 'queue_alert',
      target_audience: 'specific',
      is_read: false,
      created_at: new Date().toISOString(),
    })
    return !error
  } catch {
    return false
  }
}

export async function sendEarlyArrivalInviteNotification(
  appointmentId: string,
  patientName: string,
  trackingCode: string,
  originalSlot?: string,
  userId?: string
): Promise<boolean> {
  return sendEarlyArrivalInvite({
    appointmentId,
    patientName,
    trackingCode,
    originalSlot,
    userId,
  })
}

export async function sendEarlyArrivalInvite(params: {
  appointmentId: string
  patientName: string
  trackingCode: string
  originalSlot?: string
  userId?: string
}): Promise<boolean> {
  try {
    const title = '⚡ Doctor is Free Now! Come in early?'
    const slotText = params.originalSlot ? ` (Booked slot: ${params.originalSlot})` : ''
    const message = `Dear ${params.patientName}, the doctor has finished consultations earlier than scheduled. Since you opted in for early calls, you are welcome to come in early now!${slotText}`
    const { error } = await supabase.from('notifications').insert({
      id: crypto.randomUUID(),
      appointment_id: params.appointmentId && params.appointmentId.length === 36 ? params.appointmentId : null,
      user_id: params.userId && params.userId.length === 36 ? params.userId : null,
      title,
      message,
      type: 'early_arrival',
      target_audience: 'specific',
      is_read: false,
      created_at: new Date().toISOString(),
    })
    return !error
  } catch (err) {
    console.error('Error sending early arrival invite:', err)
    return false
  }
}


export async function searchPatientRecords(clinicId: string, searchQuery: string): Promise<Appointment[]> {
  try {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []

    const { data, error } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(*), clinic:clinics(*), queue_entries(*)')
      .eq('clinic_id', clinicId)
      .or(`tracking_code_10_digit.ilike.%${q}%,patient_mobile.ilike.%${q}%,patient_name.ilike.%${q}%`)
      .order('appointment_date', { ascending: false })

    if (error) throw error
    return (data || []).map(mapAppointment)
  } catch (err) {
    console.error('Error searching patient records:', err)
    return []
  }
}

// ==========================================
// TAXONOMY API
// ==========================================
export async function getMedicalSpecialties(): Promise<MedicalSpecialty[]> {
  try {
    const { data, error } = await supabase
      .from('medical_specialties')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch {
    return [
      { id: '1', name: 'General Physician', description: 'Primary Care, Fever, Infection, Blood Pressure' },
      { id: '2', name: 'Cardiology (Heart Care)', description: 'Heart, ECG, Hypertension, Chest Pain' },
      { id: '3', name: 'Pathology & Diagnostic Lab', description: 'Blood tests, Biochemistry, Histopathology' },
      { id: '4', name: 'Pediatrics & Child Health', description: 'Infant, Child Care, Growth, Vaccines' },
      { id: '5', name: 'Orthopedics & Joint Care', description: 'Bones, Fractures, Arthritis, Spine' },
      { id: '6', name: 'Dermatology & Skin Care', description: 'Skin, Allergies, Hair, Cosmetic Health' },
      { id: '7', name: 'Gynecology & Women Health', description: 'Maternity, Antenatal, Reproductive Care' },
      { id: '8', name: 'Dental Care & Dentistry', description: 'Teeth, Root Canal, Orthodontics' },
      { id: '9', name: 'ENT (Ear, Nose, Throat)', description: 'Sinus, Hearing, Throat Infection' },
    ]
  }
}

export async function getMedicalQualifications(): Promise<MedicalQualification[]> {
  try {
    const { data, error } = await supabase
      .from('medical_qualifications')
      .select('*')
      .order('degree_name', { ascending: true })

    if (error) throw error
    return data || []
  } catch {
    return [
      { id: '1', degreeName: 'MBBS', fullTitle: 'Bachelor of Medicine, Bachelor of Surgery' },
      { id: '2', degreeName: 'MD - Internal Medicine', fullTitle: 'Doctor of Medicine' },
      { id: '3', degreeName: 'MS - General Surgery', fullTitle: 'Master of Surgery' },
      { id: '4', degreeName: 'BDS', fullTitle: 'Bachelor of Dental Surgery' },
      { id: '5', degreeName: 'DM - Cardiology', fullTitle: 'Doctorate in Medicine' },
      { id: '6', degreeName: 'BMLT / B.Sc. MLT', fullTitle: 'Bachelor in Medical Lab Technology' },
      { id: '7', degreeName: 'CMLT / DMLT', fullTitle: 'Diploma in Medical Lab Technology' },
      { id: '8', degreeName: 'M.Sc. MLT / Biochemistry', fullTitle: 'Master in Medical Lab Technology' },
    ]
  }
}

// ==========================================
// HELPER MAPPERS
// ==========================================
function mapClinic(c: any): Clinic {
  let meta: any = {}
  let cleanDesc = c.description
  if (c.description && typeof c.description === 'string' && c.description.trim().startsWith('{')) {
    try {
      meta = JSON.parse(c.description)
      cleanDesc = meta.desc || ''
    } catch {}
  }

  // Parse pictures robustly
  let pics: string[] = []
  const rawPics = c.pictures || meta.pictures
  if (Array.isArray(rawPics)) {
    pics = rawPics.filter((p: any) => typeof p === 'string' && p.trim().length > 0)
  } else if (typeof rawPics === 'string' && rawPics.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawPics)
      if (Array.isArray(parsed)) pics = parsed.filter(Boolean)
    } catch {
      pics = rawPics.replace(/[{}]/g, '').split(',').map((s: string) => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
    }
  }

  const defaultExpiry = new Date(Date.now() + 30 * 86400000).toISOString()

  return {
    id: c.id,
    name: c.name,
    type: c.type,
    verificationStatus: c.verification_status,
    contactPhone: c.contact_phone,
    contactEmail: c.contact_email,
    addressText: c.address_text,
    latitude: c.latitude,
    longitude: c.longitude,
    autoNotifyThreshold: c.auto_notify_threshold ?? 2,
    description: cleanDesc,
    panNumber: c.pan_number || meta.pan_number,
    managerPhone: c.manager_phone || meta.manager_phone,
    registrationDocUrl: c.registration_doc_url || meta.registration_doc_url,
    pictures: pics,
    specialties: c.specialties || meta.specialties || [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    isArchived: c.is_archived ?? meta.is_archived ?? false,
    archivedAt: c.archived_at || meta.archived_at,
    deletionScheduledAt: c.deletion_scheduled_at || meta.deletion_scheduled_at,
    logoUrl: c.logo_url || meta.logo_url || (pics.length > 0 ? pics[0] : null),
    isOnBreak: c.is_on_break ?? meta.is_on_break ?? false,
    breakUpdatedAt: c.break_updated_at || meta.break_updated_at,
    weeklyScheduleJson: c.weekly_schedule_json || meta.weekly_schedule_json,
    declaredHolidays: c.declared_holidays || meta.declared_holidays || [],
    avgConsultationTimeMinutes: c.avg_consultation_time_minutes ?? meta.avg_consultation_time_minutes ?? 10,
    manualAvgConsultationTimeMinutes: c.manual_avg_consultation_time_minutes ?? meta.manual_avg_consultation_time_minutes ?? 10,
    calculatedAvgConsultationTimeMinutes: c.calculated_avg_consultation_time_minutes ?? meta.calculated_avg_consultation_time_minutes,
    avgTimeMode: c.avg_time_mode || meta.avg_time_mode || 'auto',
    isActivated: c.is_activated ?? meta.is_activated ?? true,
    activationExpiresAt: c.activation_expires_at || meta.activation_expires_at || defaultExpiry,
    activationPlan: c.activation_plan || meta.activation_plan || '1_month',
    activationPaidAmount: Number(c.activation_paid_amount ?? meta.activation_paid_amount ?? 1500),
    activationNotes: c.activation_notes || meta.activation_notes,
    activationPaymentProofUrl: c.activation_payment_proof_url || meta.activation_payment_proof_url,
    paymentGatewayProvider: c.payment_gateway_provider || meta.payment_gateway_provider || 'esewa',
    paymentApiKey: c.payment_api_key || meta.payment_api_key || '',
    paymentSecretKey: c.payment_secret_key || meta.payment_secret_key || '',
    merchantId: c.merchant_id || meta.merchant_id || '',
    isDirectPaymentEnabled: c.is_direct_payment_enabled ?? meta.is_direct_payment_enabled ?? false,
  }
}

function mapDoctor(d: any): Doctor {
  let certMeta: any = {}
  if (d.certificates_doc_url && typeof d.certificates_doc_url === 'string' && d.certificates_doc_url.trim().startsWith('{')) {
    try {
      certMeta = JSON.parse(d.certificates_doc_url)
    } catch {}
  }

  const startYear = d.starting_practicing_year || certMeta.starting_practicing_year || 2018
  const role = d.practitioner_role || certMeta.practitioner_role || 'doctor'

  return {
    id: d.id,
    fullName: d.full_name,
    email: d.email,
    specialty: d.specialty,
    specialties: d.specialties && d.specialties.length > 0 ? d.specialties : (d.specialty ? [d.specialty] : []),
    education: d.education || certMeta.education || 'MBBS',
    nmcLicenseNumber: d.nmc_license_number,
    experienceYears: d.experience_years || Math.max(1, 2026 - startYear),
    startingPracticingYear: startYear,
    gender: d.gender || certMeta.gender || 'Male',
    age: d.age || certMeta.age || 35,
    personalMobileNumber: d.personal_mobile_number || certMeta.personal_mobile_number,
    publicMobileNumber: d.public_mobile_number || certMeta.public_mobile_number,
    consultationFee: Number(d.consultation_fee || 500),
    isInClinic: d.is_in_clinic ?? true,
    clinicId: d.clinic_id,
    activeClinicId: d.active_clinic_id || d.clinic_id,
    kycStatus: d.kyc_status,
    profilePictureUrl: d.profile_picture_url || certMeta.profile_picture_url,
    description: d.description || certMeta.description,
    practitionerRole: role,
    isLabTechnician: role === 'lab_technician' || (d.specialty && d.specialty.toLowerCase().includes('lab')),
  }
}

function mapAppointment(a: any): Appointment {
  const qe = Array.isArray(a.queue_entries) ? a.queue_entries[0] : a.queue_entries
  let derivedStatus = 'waiting'

  if (qe?.status) {
    if (qe.status === 'inside') derivedStatus = 'in_consultation'
    else if (qe.status === 'done') derivedStatus = 'completed'
    else if (qe.status === 'no_show') derivedStatus = 'cancelled'
    else if (qe.status === 'sample_collected') derivedStatus = 'sample_collected'
    else if (qe.status === 'processing') derivedStatus = 'processing'
    else if (qe.status === 'report_prepared') derivedStatus = 'report_prepared'
    else derivedStatus = 'waiting'
  } else if (a.checkin_status && !['checked_in', 'not_checked_in'].includes(a.checkin_status)) {
    derivedStatus = a.checkin_status
  }

  let parsedTests: string[] = []
  if (Array.isArray(a.selected_tests)) {
    parsedTests = a.selected_tests
  } else if (typeof a.selected_lab_tests === 'string' && a.selected_lab_tests.trim().startsWith('[')) {
    try {
      parsedTests = JSON.parse(a.selected_lab_tests)
    } catch {}
  }

  return {
    id: a.id,
    trackingCode10Digit: a.tracking_code_10_digit,
    userId: a.user_id,
    clinicId: a.clinic_id,
    doctorId: a.doctor_id,
    patientName: a.patient_name,
    patientAge: a.patient_age,
    patientGender: a.patient_gender,
    patientMobile: a.patient_mobile,
    patientEmail: a.patient_email,
    appointmentDate: a.appointment_date,
    appointmentTime: a.appointment_time,
    checkinStatus: derivedStatus as any,
    paymentStatus: a.payment_status === 'pending' ? 'unpaid' : (a.payment_status || 'unpaid'),
    feeAmount: Number(a.fee_amount || 0),
    queueNumber: qe?.queue_position || a.queue_number || 1,
    notes: a.notes || (a.is_walkin ? 'Walk-In Reception Registration' : ''),
    optInEarlyCall: Boolean(a.opt_in_early_call),
    createdAt: a.created_at,
    updatedAt: qe?.updated_at || a.updated_at,
    selectedTests: parsedTests,
    clinic: a.clinic ? mapClinic(a.clinic) : undefined,
    doctor: a.doctor ? mapDoctor(a.doctor) : undefined,
  }
}

function mapSlot(s: any): Slot {
  return {
    id: s.id,
    clinicId: s.clinic_id,
    doctorId: s.doctor_id,
    slotDate: s.slot_date,
    startTime: s.start_time,
    endTime: s.end_time,
    maxCapacity: s.max_capacity,
    bookedCount: s.booked_count,
    isAvailable: s.is_available ?? true,
  }
}

function mapService(s: any): ClinicService {
  return {
    id: s.id,
    clinicId: s.clinic_id,
    serviceName: s.service_name,
    price: Number(s.price || 0),
    category: s.category || s.description || 'Diagnostic Test',
    description: s.description,
    isAvailable: s.is_available ?? true,
  }
}

function mapLabReport(r: any): LabReport {
  let mappedStatus: any = r.status || r.stage || 'processing'
  if (mappedStatus === 'prepared') mappedStatus = 'ready'

  return {
    id: r.id,
    appointmentId: r.appointment_id,
    trackingCode10Digit:
      r.tracking_code_10_digit ||
      r.appointment?.tracking_code_10_digit ||
      '',
    patientName:
      r.patient_name ||
      r.patient_name_verification ||
      r.appointment?.patient_name ||
      'Patient',
    clinicId: r.clinic_id,
    testName: r.test_name,
    reportFileUrl: r.report_file_url || r.file_url,
    reportFileType: r.report_file_type || r.file_type || 'pdf',
    status: mappedStatus,
    uploadedAt: r.uploaded_at || r.created_at,
    sampleCollectedAt: r.sample_collected_at,
    preparedAt: r.prepared_at,
    technicianNotes: r.technician_notes || r.file_name,
  }
}

function mapNotification(n: any): DactorNotification {
  let leftLabel, leftValue, rightLabel, rightValue, trackingCode
  if (n.meta_json) {
    try {
      const parsed = JSON.parse(n.meta_json)
      leftLabel = parsed.left_label
      leftValue = parsed.left_value
      rightLabel = parsed.right_label
      rightValue = parsed.right_value
      trackingCode = parsed.tracking_code
    } catch {}
  }

  return {
    id: n.id,
    userId: n.user_id,
    clinicId: n.clinic_id,
    title: n.title,
    message: n.message,
    type: n.type,
    metaJson: n.meta_json,
    isRead: n.is_read ?? false,
    createdAt: n.created_at,
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
    trackingCode,
  }
}

function mapBillingInvoice(b: any): BillingInvoice {
  return {
    id: b.id,
    appointmentId: b.appointment_id,
    clinicId: b.clinic_id,
    totalAmount: Number(b.total_amount || 0),
    paidAmount: Number(b.paid_amount || 0),
    balanceDue: Number(b.balance_due || 0),
    paymentStatus: b.payment_status === 'pending' ? 'unpaid' : (b.payment_status || 'unpaid'),
    paidAt: b.paid_at,
    remarks: b.remarks,
    receiptUrl: b.receipt_url,
    createdAt: b.created_at,
  }
}

function mapQueueEntry(q: any): QueueEntry {
  return {
    id: q.id,
    appointmentId: q.appointment_id,
    clinicId: q.clinic_id,
    doctorId: q.doctor_id,
    queuePosition: Number(q.queue_position || 1),
    status: q.status || 'waiting',
    calledAt: q.called_at,
    insideAt: q.inside_at,
    completedAt: q.completed_at,
  }
}

export function generate10DigitTrackingCode(): string {
  // Generate a clean 10-digit numeric tracking code
  const first = Math.floor(Math.random() * 9) + 1 // 1-9
  const rest = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
  return `${first}${rest}`
}

// ==========================================
// PATIENT PORTAL API & WORKFLOW HELPERS
// ==========================================

export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 23 * 60 + 59
  try {
    const clean = timeStr.trim().toUpperCase()
    const parts = clean.split(/[-–]|TO/)
    const firstPart = parts[0]?.trim() || clean
    const secondPart = parts[1]?.trim() || ''

    const m = firstPart.match(/^(\d{1,2})(?::(\d{2}))?/)
    if (!m) return 12 * 60
    let hours = parseInt(m[1], 10)
    const minutes = parseInt(m[2] || '0', 10)

    const firstHasAm = firstPart.includes('AM')
    const firstHasPm = firstPart.includes('PM')
    const secondHasAm = secondPart.includes('AM')
    const secondHasPm = secondPart.includes('PM')

    const isAm = firstHasAm
      ? true
      : firstHasPm
      ? false
      : secondHasAm
      ? true
      : secondHasPm && hours >= 7 && hours <= 11
      ? true
      : false

    const isPm = firstHasPm
      ? true
      : firstHasAm
      ? false
      : secondHasPm && hours >= 1 && hours <= 6
      ? true
      : secondHasPm && hours === 12
      ? true
      : false

    if (isPm && hours < 12) hours += 12
    if (isAm && hours === 12) hours = 0
    if (!isPm && !isAm && hours >= 1 && hours <= 6) hours += 12

    return hours * 60 + minutes
  } catch {
    return 12 * 60
  }
}

export function isSlotTimeExpired(slotDate: string, endTimeStr: string): boolean {
  if (!slotDate || !endTimeStr) return false
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Compare dates: YYYY-MM-DD
  if (slotDate < todayStr) return true
  if (slotDate > todayStr) return false

  // If slot is today, check if slot end time has passed
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const endMinutes = parseTimeToMinutes(endTimeStr)

  return currentMinutes >= endMinutes
}

export async function getPatientProfileByEmail(email: string): Promise<PatientProfile | null> {
  try {
    const cleanEmail = email.trim().toLowerCase()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', cleanEmail)
      .limit(1)

    if (error || !data || data.length === 0) return null
    const p = data[0]
    return {
      id: p.id,
      authUid: p.auth_uid,
      email: p.email,
      fullName: p.full_name,
      role: p.role || 'patient',
      phone: p.phone,
      gender: p.gender,
      age: p.age,
      isArchived: p.is_archived ?? false,
      archivedAt: p.archived_at,
      deletionScheduledAt: p.deletion_scheduled_at,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }
  } catch (err) {
    console.error('Error fetching patient profile:', err)
    return null
  }
}

export async function getPatientProfileById(id: string): Promise<PatientProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`id.eq.${id},auth_uid.eq.${id}`)
      .limit(1)

    if (error || !data || data.length === 0) return null
    const p = data[0]
    return {
      id: p.id,
      authUid: p.auth_uid,
      email: p.email,
      fullName: p.full_name,
      role: p.role || 'patient',
      phone: p.phone,
      gender: p.gender,
      age: p.age,
      isArchived: p.is_archived ?? false,
      archivedAt: p.archived_at,
      deletionScheduledAt: p.deletion_scheduled_at,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }
  } catch {
    return null
  }
}

export interface EmailPortalAssociation {
  portal: 'clinic' | 'doctor' | 'patient'
  portalLabel: 'Clinic Portal' | 'Doctor / Specialist Portal' | 'Patient Portal'
  entityName: string
  email: string
}

export async function checkEmailPortalAssociation(
  email: string
): Promise<EmailPortalAssociation | null> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) return null

  try {
    // 1. Check clinics table (contact_email)
    const existingClinic = await getClinicByEmail(cleanEmail)
    if (existingClinic) {
      return {
        portal: 'clinic',
        portalLabel: 'Clinic Portal',
        entityName: existingClinic.name || '',
        email: cleanEmail,
      }
    }

    // 2. Check doctors table (email)
    const existingDoctor = await getDoctorByEmail(cleanEmail)
    if (existingDoctor) {
      return {
        portal: 'doctor',
        portalLabel: 'Doctor / Specialist Portal',
        entityName: existingDoctor.fullName || '',
        email: cleanEmail,
      }
    }

    // 3. Check profiles table (email)
    const existingProfile = await getPatientProfileByEmail(cleanEmail)
    if (existingProfile) {
      const role = (existingProfile.role || '').trim().toLowerCase()
      if (role === 'clinic_admin' || role === 'clinic') {
        return {
          portal: 'clinic',
          portalLabel: 'Clinic Portal',
          entityName: existingProfile.fullName || '',
          email: cleanEmail,
        }
      }
      if (role === 'doctor' || role === 'lab_technician') {
        return {
          portal: 'doctor',
          portalLabel: 'Doctor / Specialist Portal',
          entityName: existingProfile.fullName || '',
          email: cleanEmail,
        }
      }
      if (role === 'patient') {
        return {
          portal: 'patient',
          portalLabel: 'Patient Portal',
          entityName: existingProfile.fullName || '',
          email: cleanEmail,
        }
      }
    }

    // 4. Check appointments table (patient_email)
    const { data: patientAppts } = await supabase
      .from('appointments')
      .select('patient_name')
      .ilike('patient_email', cleanEmail)
      .limit(1)

    if (patientAppts && patientAppts.length > 0) {
      return {
        portal: 'patient',
        portalLabel: 'Patient Portal',
        entityName: patientAppts[0].patient_name || 'Patient',
        email: cleanEmail,
      }
    }
  } catch (err) {
    console.warn('checkEmailPortalAssociation error:', err)
  }

  return null
}

export async function savePatientProfile(profile: Partial<PatientProfile>): Promise<PatientProfile | null> {
  try {
    const email = profile.email?.trim().toLowerCase()
    if (!email) return null

    const payload: any = {
      email,
      updated_at: new Date().toISOString(),
    }
    if (profile.fullName !== undefined) payload.full_name = profile.fullName.trim()
    if (profile.phone !== undefined) payload.phone = profile.phone.trim()
    if (profile.gender !== undefined) payload.gender = profile.gender
    if (profile.age !== undefined) payload.age = profile.age
    if (profile.role !== undefined) payload.role = profile.role
    if (profile.authUid !== undefined) payload.auth_uid = profile.authUid

    // Check if exists
    const existing = await getPatientProfileByEmail(email)
    let resData: any

    if (existing) {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      resData = data
    } else {
      payload.id = profile.id || crypto.randomUUID()
      payload.created_at = new Date().toISOString()
      const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      resData = data
    }

    return {
      id: resData.id,
      authUid: resData.auth_uid,
      email: resData.email,
      fullName: resData.full_name,
      role: resData.role,
      phone: resData.phone,
      gender: resData.gender,
      age: resData.age,
      isArchived: resData.is_archived,
      createdAt: resData.created_at,
      updatedAt: resData.updated_at,
    }
  } catch (err) {
    console.error('Error saving patient profile:', err)
    return null
  }
}

export async function schedulePatientArchive(profileId: string): Promise<boolean> {
  try {
    const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('profiles')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        deletion_scheduled_at: scheduledAt,
      })
      .eq('id', profileId)
    return !error
  } catch {
    return false
  }
}

export async function cancelPatientArchive(profileId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_archived: false,
        archived_at: null,
        deletion_scheduled_at: null,
      })
      .eq('id', profileId)
    return !error
  } catch {
    return false
  }
}

export async function getAppointmentsByPatient(criteria: {
  email?: string
  phone?: string
  userId?: string
  trackingCodes?: string[]
}): Promise<Appointment[]> {
  try {
    const filters: string[] = []

    if (criteria.userId) {
      filters.push(`user_id.eq.${criteria.userId}`)
    }
    if (criteria.email) {
      filters.push(`patient_email.ilike.${criteria.email.trim().toLowerCase()}`)
    }
    if (criteria.phone) {
      const cleanPhone = criteria.phone.trim()
      if (cleanPhone.length >= 6) {
        filters.push(`patient_mobile.eq.${cleanPhone}`)
      }
    }
    if (criteria.trackingCodes && criteria.trackingCodes.length > 0) {
      const codes = criteria.trackingCodes.map((c) => c.trim()).filter(Boolean)
      if (codes.length > 0) {
        filters.push(`tracking_code_10_digit.in.(${codes.join(',')})`)
      }
    }

    if (filters.length === 0) return []

    const { data, error } = await supabase
      .from('appointments')
      .select('*, clinic:clinics(*), doctor:doctors(*), queue_entries(*)')
      .or(filters.join(','))
      .order('appointment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(mapAppointment)
  } catch (err) {
    console.error('Error fetching patient appointments:', err)
    return []
  }
}

export async function cancelAppointment(appointmentId: string, _reason?: string): Promise<boolean> {
  return await updateAppointmentStatus(appointmentId, 'cancelled')
}

export async function getClinicPaymentConfig(clinicId: string): Promise<PaymentGatewaysConfig | null> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('payment_gateway_provider, merchant_id, is_direct_payment_enabled')
      .eq('id', clinicId)
      .single()

    if (error || !data) return null

    return {
      esewa: {
        id: 'esewa',
        title: 'eSewa Mobile Wallet',
        accountIdentifier: data.merchant_id || 'EPAYTEST',
        merchantCode: data.merchant_id || 'EPAYTEST',
        testBypassEnabled: true,
        isEnabled: true,
      },
      khalti: {
        id: 'khalti',
        title: 'Khalti Digital Wallet',
        accountIdentifier: 'test_public_key',
        merchantCode: 'test_public_key',
        testBypassEnabled: true,
        isEnabled: true,
      },
      fonepay: {
        id: 'fonepay',
        title: 'Fonepay QR / Direct Banking',
        accountIdentifier: data.merchant_id || 'FONEPAYTEST',
        merchantCode: data.merchant_id,
        testBypassEnabled: true,
        isEnabled: true,
      },
      testBypassAllowed: true,
    }
  } catch {
    return null
  }
}

export async function recordPaymentTransaction(record: {
  appointmentId: string
  trackingCode: string
  clinicId: string
  doctorId?: string
  patientName: string
  appointmentDate: string
  appointmentTime: string
  amount: number
  paymentMethod: string
  paymentStatus: string
  transactionId?: string
  notes?: string
}): Promise<boolean> {
  try {
    const txnId = record.transactionId || `TXN-${record.trackingCode}-${Date.now().toString().slice(-4)}`
    const nowIso = new Date().toISOString()
    const dbPayStatus = normalizePaymentStatus(record.paymentStatus)

    // 1. Update appointment payment status
    await supabase
      .from('appointments')
      .update({
        payment_status: dbPayStatus,
        updated_at: nowIso,
      })
      .eq('id', record.appointmentId)

    // 2. Create or update billing invoice in Supabase
    const invoicePayload = {
      id: crypto.randomUUID(),
      appointment_id: record.appointmentId,
      clinic_id: record.clinicId,
      total_amount: record.amount,
      paid_amount: dbPayStatus === 'paid' ? record.amount : 0,
      balance_due: dbPayStatus === 'paid' ? 0 : record.amount,
      payment_status: dbPayStatus,
      paid_at: dbPayStatus === 'paid' ? nowIso : null,
      remarks: `Method: ${record.paymentMethod} (Txn: ${txnId}) • ${record.notes || ''}`.trim(),
    }

    const { error: invError } = await supabase
      .from('billing_invoices')
      .upsert(invoicePayload, { onConflict: 'appointment_id' })

    return !invError
  } catch (err) {
    console.error('Error recording payment transaction:', err)
    return false
  }
}

export async function getPatientTransactions(criteria: {
  email?: string
  phone?: string
  userId?: string
  trackingCodes?: string[]
}): Promise<PatientTransactionRecord[]> {
  try {
    const appts = await getAppointmentsByPatient(criteria)
    if (appts.length === 0) return []

    // Fetch invoices for these appointments
    const apptIds = appts.map((a) => a.id)
    const { data: invData } = await supabase
      .from('billing_invoices')
      .select('*')
      .in('appointment_id', apptIds)

    const invoicesMap = new Map<string, any>()
    ;(invData || []).forEach((inv: any) => {
      invoicesMap.set(inv.appointment_id, inv)
    })

    return appts.map((appt) => {
      const inv = invoicesMap.get(appt.id)
      const amt = (inv?.paid_amount && inv.paid_amount > 0)
        ? inv.paid_amount
        : (inv?.total_amount && inv.total_amount > 0)
          ? inv.total_amount
          : appt.feeAmount || 0

      let status = appt.paymentStatus || 'unpaid'
      if (inv?.payment_status) status = inv.payment_status

      let method = 'eSewa'
      if (inv?.remarks) {
        const rem = inv.remarks.toLowerCase()
        if (rem.includes('bypass')) method = 'Bypass Test'
        else if (rem.includes('khalti')) method = 'Khalti'
        else if (rem.includes('fonepay')) method = 'Fonepay'
        else if (rem.includes('connectips')) method = 'ConnectIPS'
        else if (rem.includes('cash')) method = 'Cash'
      }

      let txnId = `TXN-${appt.trackingCode10Digit}`
      if (inv?.remarks && inv.remarks.includes('Txn:')) {
        txnId = inv.remarks.split('Txn:')[1].split(')')[0].trim()
      }

      return {
        id: inv?.id || appt.id,
        appointmentId: appt.id,
        trackingCode: appt.trackingCode10Digit,
        clinicName: appt.clinic?.name || 'Clinic & OPD Center',
        doctorName: appt.doctor?.fullName || 'Consulting Doctor',
        patientName: appt.patientName,
        appointmentDate: appt.appointmentDate,
        appointmentTime: appt.appointmentTime,
        amount: amt,
        paymentStatus: status,
        paymentMethod: method,
        transactionId: txnId,
        createdAt: appt.createdAt || new Date().toISOString(),
      }
    })
  } catch (err) {
    console.error('Error fetching patient transactions:', err)
    return []
  }
}
// ==========================================
// DOCTOR AFFILIATED CLINICS & DIRECTORY HELPERS
// ==========================================
export async function getAffiliatedClinicsForDoctor(
  doctorId: string,
  doctorEmail?: string
): Promise<Clinic[]> {
  try {
    const clinicIdSet = new Set<string>()

    // Check doctor record directly
    if (doctorId) {
      const doc = await getDoctorById(doctorId)
      if (doc?.clinicId) clinicIdSet.add(doc.clinicId)
      if (doc?.activeClinicId) clinicIdSet.add(doc.activeClinicId)
    }

    // Check clinic invitations for this doctor email or doctorId
    if (doctorEmail) {
      const { data: invites } = await supabase
        .from('clinic_invitations')
        .select('clinic_id, status')
        .or(`doctor_email.ilike.${doctorEmail.trim().toLowerCase()},doctor_id.eq.${doctorId}`)
        .eq('status', 'accepted')

      if (invites) {
        invites.forEach((inv) => {
          if (inv.clinic_id) clinicIdSet.add(inv.clinic_id)
        })
      }
    }

    if (clinicIdSet.size === 0) {
      // Fallback: return all approved clinics
      return await getClinics()
    }

    const clinicIds = Array.from(clinicIdSet)
    const { data: clinicsData, error } = await supabase
      .from('clinics')
      .select('*')
      .in('id', clinicIds)

    if (error || !clinicsData || clinicsData.length === 0) {
      return await getClinics()
    }

    return clinicsData.map(mapClinic)
  } catch (err) {
    console.error('Error fetching affiliated clinics for doctor:', err)
    return await getClinics()
  }
}

export async function getDoctorAppointments(
  doctorId: string,
  date?: string
): Promise<Appointment[]> {
  try {
    let query = supabase
      .from('appointments')
      .select('*, doctor:doctors(*), clinic:clinics(*), queue_entries(*)')
      .eq('doctor_id', doctorId)

    if (date) {
      query = query.eq('appointment_date', date)
    }

    const { data, error } = await query.order('appointment_time', { ascending: true })
    if (error) throw error
    return (data || []).map(mapAppointment)
  } catch (err) {
    console.error('Error fetching doctor appointments:', err)
    return []
  }
}

export async function getClinicPatientDirectory(clinicId: string): Promise<{
  id: string
  fullName: string
  phone: string
  gender: string
  age: number
  email?: string
  lastVisitDate?: string
  visitCount: number
  trackingCodes: string[]
}[]> {
  try {
    // 1. Get all appointments for this clinic
    const { data: appts } = await supabase
      .from('appointments')
      .select('id, user_id, patient_name, patient_mobile, patient_gender, patient_age, patient_email, appointment_date, tracking_code_10_digit')
      .eq('clinic_id', clinicId)
      .order('appointment_date', { ascending: false })

    const patientMap = new Map<string, {
      id: string
      fullName: string
      phone: string
      gender: string
      age: number
      email?: string
      lastVisitDate?: string
      visitCount: number
      trackingCodes: string[]
    }>()

    if (appts) {
      for (const a of appts) {
        const key = a.patient_mobile ? a.patient_mobile.trim() : (a.user_id || a.patient_name.toLowerCase())
        if (!patientMap.has(key)) {
          patientMap.set(key, {
            id: a.user_id || a.id,
            fullName: a.patient_name,
            phone: a.patient_mobile || 'N/A',
            gender: a.patient_gender || 'Other',
            age: Number(a.patient_age) || 0,
            email: a.patient_email || undefined,
            lastVisitDate: a.appointment_date,
            visitCount: 1,
            trackingCodes: a.tracking_code_10_digit ? [a.tracking_code_10_digit] : [],
          })
        } else {
          const item = patientMap.get(key)!
          item.visitCount += 1
          if (a.tracking_code_10_digit && !item.trackingCodes.includes(a.tracking_code_10_digit)) {
            item.trackingCodes.push(a.tracking_code_10_digit)
          }
        }
      }
    }

    return Array.from(patientMap.values())
  } catch (err) {
    console.error('Error fetching clinic patient directory:', err)
    return []
  }
}

// ==========================================
// CLINIC SUBSCRIPTION, ARCHIVE, SLOTS & INVITATIONS API
// ==========================================
export async function requestClinicActivationRenewal(
  clinicId: string,
  plan: '1_month' | '12_months',
  amountPaid: number,
  notes: string
): Promise<boolean> {
  return await updateClinic(clinicId, {
    activationPlan: plan,
    activationPaidAmount: amountPaid,
    activationNotes: `RENEWAL_REQUEST: ${notes} (${new Date().toISOString()})`,
  })
}

export async function completeClinicSubscriptionPayment(
  clinicId: string,
  plan: '1_month' | '12_months',
  amountPaid: number,
  txnRef: string
): Promise<boolean> {
  const days = plan === '12_months' ? 365 : 30
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString()
  return await updateClinic(clinicId, {
    isActivated: true,
    activationExpiresAt: expiresAt,
    activationPlan: plan,
    activationPaidAmount: amountPaid,
    activationNotes: `INSTANT_ACTIVATED (${txnRef}) on ${new Date().toISOString()}`,
  })
}

export async function scheduleClinicDeletion(clinicId: string): Promise<boolean> {
  const now = new Date()
  const purgeDate = new Date(now.getTime() + 30 * 86400000)
  return await updateClinic(clinicId, {
    isArchived: true,
    archivedAt: now.toISOString(),
    deletionScheduledAt: purgeDate.toISOString(),
  })
}

export async function cancelClinicDeletion(clinicId: string): Promise<boolean> {
  return await updateClinic(clinicId, {
    isArchived: false,
    archivedAt: '',
    deletionScheduledAt: '',
  })
}

/**
 * Super Admin & Admin Portal Permission: Permanently Delete / Purge Clinic
 * Cascades across queue entries, lab reports, billing invoices, appointments, slots, services, and clinic.
 */
export async function deleteClinicPermanently(clinicId: string): Promise<boolean> {
  try {
    // 1. Dependent clinical entities
    await supabase.from('queue_entries').delete().eq('clinic_id', clinicId)
    await supabase.from('lab_reports').delete().eq('clinic_id', clinicId)
    await supabase.from('billing_invoices').delete().eq('clinic_id', clinicId)
    await supabase.from('appointments').delete().eq('clinic_id', clinicId)
    await supabase.from('slots').delete().eq('clinic_id', clinicId)
    await supabase.from('clinic_services').delete().eq('clinic_id', clinicId)
    await supabase.from('clinic_catalog').delete().eq('clinic_id', clinicId)
    await supabase.from('clinic_invitations').delete().eq('clinic_id', clinicId)
    
    // 2. Clinic entity
    const { error } = await supabase.from('clinics').delete().eq('id', clinicId)
    return !error
  } catch (err) {
    console.error('Error permanently deleting clinic:', err)
    return false
  }
}

/**
 * Super Admin & Admin Portal Permission: Delete Doctor
 */
export async function deleteDoctorPermanently(doctorId: string): Promise<boolean> {
  try {
    await supabase.from('queue_entries').delete().eq('doctor_id', doctorId)
    await supabase.from('clinic_invitations').delete().eq('doctor_id', doctorId)
    const { error } = await supabase.from('doctors').delete().eq('id', doctorId)
    return !error
  } catch (err) {
    console.error('Error deleting doctor:', err)
    return false
  }
}

/**
 * Super Admin & Admin Portal Permission: Delete Patient Profile
 */
export async function deletePatientProfilePermanently(patientId: string): Promise<boolean> {
  try {
    await supabase.from('notifications').delete().eq('user_id', patientId)
    await supabase.from('fcm_tokens').delete().eq('user_id', patientId)
    const { error } = await supabase.from('profiles').delete().eq('id', patientId)
    return !error
  } catch (err) {
    console.error('Error deleting patient profile:', err)
    return false
  }
}

/**
 * Super Admin & Admin Portal Permission: Purge Expired Archived Clinic Data
 */
export async function purgeExpiredClinicData(clinicId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('purge_expired_archived_clinic_data', { p_clinic_id: clinicId })
    if (error) {
      // Fallback to manual cascade
      return await deleteClinicPermanently(clinicId)
    }
    return true
  } catch {
    return await deleteClinicPermanently(clinicId)
  }
}

export async function updateAppointmentNotes(appointmentId: string, notes: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('appointments')
      .update({
        notes: notes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
    return !error
  } catch {
    return false
  }
}

export async function updateSlot(
  slotId: string,
  updates: { startTime?: string; endTime?: string; maxCapacity?: number }
): Promise<boolean> {
  try {
    const payload: any = {}
    if (updates.startTime !== undefined) payload.start_time = updates.startTime
    if (updates.endTime !== undefined) payload.end_time = updates.endTime
    if (updates.maxCapacity !== undefined) payload.max_capacity = updates.maxCapacity
    const { error } = await supabase.from('slots').update(payload).eq('id', slotId)
    return !error
  } catch {
    return false
  }
}

export async function getClinicInvitations(clinicId: string): Promise<ClinicInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('clinic_invitations')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: row.id,
        clinicId: row.clinic_id,
        clinicName: row.clinic_name,
        doctorId: row.doctor_id,
        invitedEmail: row.doctor_email || row.invited_email || '',
        invitedName: row.doctor_name || row.invited_name || 'Medical Staff',
        role: row.role === 'lab_technician' ? 'lab_technician' : 'doctor',
        specialty: row.specialty || 'General Physician',
        status: row.status || 'pending',
        createdAt: row.created_at || new Date().toISOString(),
      }))
    }
  } catch {}

  try {
    const raw = localStorage.getItem(`dactor_clinic_invitations_${clinicId}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export async function sendClinicInvitation(params: {
  clinicId: string
  clinicName: string
  doctorId?: string
  invitedEmail: string
  invitedName: string
  role: 'doctor' | 'lab_technician'
  specialty?: string
}): Promise<ClinicInvitation | null> {
  const newInv: ClinicInvitation = {
    id: crypto.randomUUID(),
    clinicId: params.clinicId,
    clinicName: params.clinicName,
    doctorId: params.doctorId,
    invitedEmail: params.invitedEmail.trim().toLowerCase(),
    invitedName: params.invitedName.trim(),
    role: params.role,
    specialty: params.specialty || (params.role === 'lab_technician' ? 'Diagnostic Lab' : 'General Physician'),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  try {
    await supabase.from('clinic_invitations').insert({
      id: newInv.id,
      clinic_id: newInv.clinicId,
      clinic_name: newInv.clinicName,
      doctor_id: newInv.doctorId || null,
      doctor_email: newInv.invitedEmail,
      doctor_name: newInv.invitedName,
      role: newInv.role,
      specialty: newInv.specialty,
      status: 'pending',
      created_at: newInv.createdAt,
    })
  } catch {}

  // Also link doctor to clinic roster if doctorId is provided so they appear on clinic roster immediately when accepted/affiliated
  if (params.doctorId) {
    try {
      await supabase
        .from('doctors')
        .update({ clinic_id: params.clinicId, active_clinic_id: params.clinicId })
        .eq('id', params.doctorId)
    } catch {}
  }

  try {
    const existing = await getClinicInvitations(params.clinicId)
    const filtered = existing.filter((i) => i.invitedEmail.toLowerCase() !== newInv.invitedEmail)
    localStorage.setItem(`dactor_clinic_invitations_${params.clinicId}`, JSON.stringify([newInv, ...filtered]))
  } catch {}

  return newInv
}

export async function cancelClinicInvitation(invitationId: string, clinicId: string): Promise<boolean> {
  try {
    await supabase.from('clinic_invitations').delete().eq('id', invitationId)
  } catch {}
  try {
    const existing = await getClinicInvitations(clinicId)
    const updated = existing.map((i) => (i.id === invitationId ? { ...i, status: 'cancelled' as const } : i))
    localStorage.setItem(`dactor_clinic_invitations_${clinicId}`, JSON.stringify(updated))
  } catch {}
  return true
}

// ==========================================
// SYSTEM SETTINGS & SUPPORT HELPDESK API
// ==========================================
export async function getSupportUrl(): Promise<string> {
  const DEFAULT_SUPPORT_URL = 'https://rajanpurbe.github.io/Dactor/support'
  try {
    // 1. Try system_settings table
    const { data: setRes, error: setErr } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'support_url')
      .single()

    if (!setErr && setRes?.value) {
      localStorage.setItem('dactor_support_url', setRes.value)
      return setRes.value
    }
  } catch {}

  try {
    // 2. Query medical_specialties where name = 'system_config:support_url'
    const { data: specRes, error: specErr } = await supabase
      .from('medical_specialties')
      .select('search_keywords')
      .eq('name', 'system_config:support_url')
      .single()

    if (!specErr && specRes?.search_keywords) {
      localStorage.setItem('dactor_support_url', specRes.search_keywords)
      return specRes.search_keywords
    }
  } catch {}

  // 3. Fallback to localStorage or default URL
  try {
    const cached = localStorage.getItem('dactor_support_url')
    if (cached) return cached
  } catch {}

  return DEFAULT_SUPPORT_URL
}

const LOCAL_STORAGE_TICKETS_KEY = 'dactor_support_tickets_v1'

export async function createSupportTicket(ticket: {
  name?: string
  email: string
  phone: string
  role?: 'clinic' | 'doctor' | 'patient' | 'other'
  category: string
  customReason?: string
  message?: string
}): Promise<SupportTicket> {
  const ticketId = crypto.randomUUID()
  const randomSuffix = Math.floor(100000 + Math.random() * 900000)
  const ticketCode = `DAC-TKT-${randomSuffix}`
  const nowIso = new Date().toISOString()

  const newTicket: SupportTicket = {
    id: ticketId,
    ticketCode,
    name: ticket.name?.trim() || 'Valued User',
    email: ticket.email.trim(),
    phone: ticket.phone.trim(),
    role: ticket.role || 'patient',
    category: ticket.category || 'General Support',
    customReason: ticket.customReason?.trim() || undefined,
    message: ticket.message?.trim() || `Inquiry regarding ${ticket.category}`,
    status: 'open',
    createdAt: nowIso,
  }

  // 1. Save to Supabase notifications table (type: 'support_ticket')
  try {
    const formattedTitle = `[Support Ticket #${ticketCode}] ${newTicket.category}`
    const payload = {
      id: ticketId,
      title: formattedTitle,
      message: JSON.stringify(newTicket),
      type: 'support_ticket',
      target_audience: 'specific',
      is_read: false,
    }
    const { error } = await supabase.from('notifications').insert(payload)
    if (error) {
      console.warn('Supabase notifications insert warning for support ticket:', error)
    }
  } catch (err) {
    console.warn('Network error saving ticket to Supabase:', err)
  }

  // 2. Also cache in localStorage for instant offline access & Admin Portal sync
  try {
    const cachedRaw = localStorage.getItem(LOCAL_STORAGE_TICKETS_KEY)
    const cached: SupportTicket[] = cachedRaw ? JSON.parse(cachedRaw) : []
    const updated = [newTicket, ...cached.filter((t) => t.ticketCode !== ticketCode)]
    localStorage.setItem(LOCAL_STORAGE_TICKETS_KEY, JSON.stringify(updated.slice(0, 100)))
  } catch {}

  return newTicket
}

export async function getSupportTickets(): Promise<SupportTicket[]> {
  const ticketMap = new Map<string, SupportTicket>()

  // 1. Load from Supabase notifications table
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or('type.eq.support_ticket,title.ilike.%[Support%')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        try {
          if (row.message && row.message.trim().startsWith('{')) {
            const parsed = JSON.parse(row.message)
            if (parsed.ticketCode) {
              ticketMap.set(parsed.ticketCode, {
                ...parsed,
                id: row.id || parsed.id,
                status: row.is_read ? (parsed.status === 'open' ? 'resolved' : parsed.status) : parsed.status,
                createdAt: row.created_at || parsed.createdAt,
              })
              return
            }
          }

          // Fallback parsing for legacy raw text notifications
          const title = row.title || ''
          const matchCode = title.match(/#([A-Z0-9-]+)/)
          const tCode = matchCode ? matchCode[1] : `TKT-${(row.id || '').substring(0, 6)}`
          const matchCategory = title.replace(/^\[Support Inquiry\]\s*/i, '').split('-')[0]?.trim() || 'General'

          const msg = row.message || ''
          const emailMatch = msg.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)?.[0] || 'Unknown'
          const phoneMatch = msg.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b98\d{8}\b/)?.[0] || '–'

          ticketMap.set(tCode, {
            id: row.id,
            ticketCode: tCode,
            name: title.split('-')?.[1]?.split('(')?.[0]?.trim() || 'Valued User',
            email: emailMatch,
            phone: phoneMatch,
            role: 'patient',
            category: matchCategory,
            message: msg,
            status: row.is_read ? 'resolved' : 'open',
            createdAt: row.created_at || new Date().toISOString(),
          })
        } catch {}
      })
    }
  } catch (err) {
    console.warn('Error fetching support tickets from Supabase:', err)
  }

  // 2. Merge with localStorage cache
  try {
    const cachedRaw = localStorage.getItem(LOCAL_STORAGE_TICKETS_KEY)
    if (cachedRaw) {
      const cached: SupportTicket[] = JSON.parse(cachedRaw)
      cached.forEach((t) => {
        if (!ticketMap.has(t.ticketCode)) {
          ticketMap.set(t.ticketCode, t)
        }
      })
    }
  } catch {}

  // 3. Return sorted by createdAt descending
  return Array.from(ticketMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function updateSupportTicketStatus(
  ticketCode: string,
  newStatus: 'open' | 'in_progress' | 'resolved' | 'closed',
  adminNotes?: string
): Promise<boolean> {
  const isResolved = newStatus === 'resolved' || newStatus === 'closed'

  // Update in localStorage
  try {
    const cachedRaw = localStorage.getItem(LOCAL_STORAGE_TICKETS_KEY)
    if (cachedRaw) {
      const cached: SupportTicket[] = JSON.parse(cachedRaw)
      const updated = cached.map((t) =>
        t.ticketCode === ticketCode
          ? {
              ...t,
              status: newStatus,
              resolvedAt: isResolved ? new Date().toISOString() : undefined,
              adminNotes: adminNotes ?? t.adminNotes,
            }
          : t
      )
      localStorage.setItem(LOCAL_STORAGE_TICKETS_KEY, JSON.stringify(updated))
    }
  } catch {}

  // Update in Supabase notifications
  try {
    const { data: rows } = await supabase
      .from('notifications')
      .select('*')
      .ilike('title', `%${ticketCode}%`)

    if (Array.isArray(rows) && rows.length > 0) {
      for (const row of rows) {
        let updatedMessage = row.message
        if (row.message && row.message.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(row.message)
            parsed.status = newStatus
            if (isResolved) parsed.resolvedAt = new Date().toISOString()
            if (adminNotes) parsed.adminNotes = adminNotes
            updatedMessage = JSON.stringify(parsed)
          } catch {}
        }

        await supabase
          .from('notifications')
          .update({
            is_read: isResolved,
            message: updatedMessage,
          })
          .eq('id', row.id)
      }
    }
  } catch (err) {
    console.warn('Error updating ticket in Supabase:', err)
  }

  return true
}

