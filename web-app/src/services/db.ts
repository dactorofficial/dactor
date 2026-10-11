import { supabase } from '../lib/supabase'
import {
  Clinic,
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
    return (data || []).map(mapClinic)
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

    if (error) return null
    return data ? mapClinic(data) : null
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
    const dbPayload = {
      id: clinic.id || crypto.randomUUID(),
      name: clinic.name,
      type: clinic.type || 'opd_clinic',
      verification_status: clinic.verificationStatus || 'approved',
      contact_phone: clinic.contactPhone,
      contact_email: clinic.contactEmail?.toLowerCase(),
      address_text: clinic.addressText,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      auto_notify_threshold: clinic.autoNotifyThreshold || 2,
      description: clinic.description,
      pan_number: clinic.panNumber,
      manager_phone: clinic.managerPhone,
      registration_doc_url: clinic.registrationDocUrl,
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
      .or(`clinic_id.eq.${clinicId},active_clinic_id.eq.${clinicId}`)
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
    const dbPayload = {
      id: doctor.id || crypto.randomUUID(),
      full_name: doctor.fullName,
      email: doctor.email?.toLowerCase(),
      specialty: doctor.specialty || 'General Physician',
      specialties: doctor.specialties || [doctor.specialty || 'General Physician'],
      education: doctor.education,
      nmc_license_number: doctor.nmcLicenseNumber,
      experience_years: doctor.experienceYears || (doctor.startingPracticingYear ? 2026 - doctor.startingPracticingYear : 5),
      starting_practicing_year: doctor.startingPracticingYear,
      gender: doctor.gender,
      age: doctor.age,
      personal_mobile_number: doctor.personalMobileNumber,
      public_mobile_number: doctor.publicMobileNumber,
      consultation_fee: doctor.consultationFee || 500,
      is_in_clinic: doctor.isInClinic ?? true,
      clinic_id: doctor.clinicId,
      active_clinic_id: doctor.activeClinicId || doctor.clinicId,
      kyc_status: doctor.kycStatus || 'approved',
      profile_picture_url: doctor.profilePictureUrl,
      description: doctor.description,
      practitioner_role: doctor.practitionerRole || (doctor.isLabTechnician ? 'lab_technician' : 'doctor'),
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
export async function getAppointmentByTrackingCode(code: string): Promise<Appointment | null> {
  try {
    const cleanCode = code.trim()
    const { data, error } = await supabase
      .from('appointments')
      .select('*, clinic:clinics(*), doctor:doctors(*)')
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
      .select('*, doctor:doctors(*)')
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
      .select('*, clinic:clinics(*)')
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

export async function createAppointment(appt: Partial<Appointment>): Promise<Appointment | null> {
  try {
    const code10 = appt.trackingCode10Digit || generate10DigitTrackingCode()
    const dbPayload = {
      id: appt.id || crypto.randomUUID(),
      tracking_code_10_digit: code10,
      user_id: appt.userId,
      clinic_id: appt.clinicId,
      doctor_id: appt.doctorId,
      patient_name: appt.patientName,
      patient_age: appt.patientAge,
      patient_gender: appt.patientGender,
      patient_mobile: appt.patientMobile,
      patient_email: appt.patientEmail,
      appointment_date: appt.appointmentDate || new Date().toISOString().split('T')[0],
      appointment_time: appt.appointmentTime || '10:00 AM',
      checkin_status: appt.checkinStatus || 'waiting',
      payment_status: appt.paymentStatus || 'unpaid',
      fee_amount: appt.feeAmount || 0,
      notes: appt.notes,
      selected_tests: appt.selectedTests || [],
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert(dbPayload)
      .select('*, clinic:clinics(*), doctor:doctors(*)')
      .single()

    if (error) throw error
    return data ? mapAppointment(data) : null
  } catch (err) {
    console.error('Error creating appointment:', err)
    return null
  }
}

export async function updateAppointmentStatus(id: string, status: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('appointments')
      .update({ checkin_status: status, updated_at: nowIso })
      .eq('id', id)

    // Sync live_queue table so patient queue display & doctor board stay in perfect sync
    try {
      const qStatus = status === 'in_consultation' ? 'inside' : status
      const qUpdate: any = { status: qStatus }
      if (status === 'in_consultation' || status === 'inside') {
        qUpdate.inside_at = nowIso
      } else if (status === 'completed') {
        qUpdate.completed_at = nowIso
      }
      await supabase
        .from('live_queue')
        .update(qUpdate)
        .eq('appointment_id', id)
    } catch (qErr) {
      console.warn('Could not update live_queue table:', qErr)
    }

    return !error
  } catch {
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
      start_time: slot.startTime,
      end_time: slot.endTime,
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
      price: service.price || 0,
      category: service.category || 'Diagnostic Test',
      description: service.description,
      is_available: service.isAvailable ?? true,
    }

    const { data, error } = await supabase
      .from('clinic_services')
      .insert(dbPayload)
      .select()
      .single()

    if (error) throw error
    return data ? mapService(data) : null
  } catch {
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
    const { data, error } = await supabase
      .from('lab_reports')
      .select('*')
      .eq('tracking_code_10_digit', code.trim())
      .order('uploaded_at', { ascending: false })

    if (error) throw error
    return (data || []).map(mapLabReport)
  } catch (err) {
    console.error('Error fetching lab reports by code:', err)
    return []
  }
}

export async function getLabReportsByClinic(clinicId: string): Promise<LabReport[]> {
  try {
    const { data, error } = await supabase
      .from('lab_reports')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('uploaded_at', { ascending: false })

    if (error) throw error
    return (data || []).map(mapLabReport)
  } catch (err) {
    console.error('Error fetching lab reports by clinic:', err)
    return []
  }
}

export async function saveLabReport(report: Partial<LabReport>): Promise<LabReport | null> {
  try {
    const dbPayload = {
      id: report.id || crypto.randomUUID(),
      appointment_id: report.appointmentId,
      tracking_code_10_digit: report.trackingCode10Digit,
      patient_name: report.patientName,
      clinic_id: report.clinicId,
      test_name: report.testName,
      report_file_url: report.reportFileUrl,
      report_file_type: report.reportFileType || 'pdf',
      status: report.status || 'processing',
      uploaded_at: report.uploadedAt || new Date().toISOString(),
      sample_collected_at: report.sampleCollectedAt,
      prepared_at: report.preparedAt,
      technician_notes: report.technicianNotes,
    }

    const { data, error } = await supabase
      .from('lab_reports')
      .upsert(dbPayload)
      .select()
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
    const bucket = 'clinic_files'
    const path = `lab_reports/${Date.now()}_${fileName.replace(/\s+/g, '_')}`
    const { error } = await supabase.storage.from(bucket).upload(path, fileBlob, {
      upsert: true,
      contentType: fileBlob.type || 'application/pdf',
    })

    if (error) throw error
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicData.publicUrl
  } catch (err) {
    console.error('Error uploading report file:', err)
    return null
  }
}

// ==========================================
// NOTIFICATIONS API
// ==========================================
export async function getClinicNotifications(clinicId: string): Promise<DactorNotification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`clinic_id.eq.${clinicId},user_id.eq.${clinicId}`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return (data || []).map(mapNotification)
  } catch (err) {
    console.error('Error fetching notifications:', err)
    return []
  }
}

export async function sendBroadcastNotification(clinicId: string, title: string, message: string): Promise<boolean> {
  try {
    const metaObj = {
      meta_version: 1,
      audience: 'All Patients & Queue',
      category: 'clinic_broadcast',
      left_label: 'Sender',
      left_value: 'Clinic Administration',
      right_label: 'Priority',
      right_value: 'Important Update',
    }

    const { error } = await supabase.from('notifications').insert({
      id: crypto.randomUUID(),
      clinic_id: clinicId,
      title: title.trim(),
      message: message.trim(),
      type: 'clinic_broadcast',
      meta_json: JSON.stringify(metaObj),
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
    const paymentStatus =
      paidAmount >= totalAmount && totalAmount > 0
        ? 'paid'
        : paidAmount > 0
        ? 'partial'
        : 'unpaid'
    const nowIso = new Date().toISOString()

    // Check if invoice already exists
    const { data: existing } = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    const invoicePayload: any = {
      id: existing?.id || crypto.randomUUID(),
      appointment_id: appointmentId,
      clinic_id: clinicId,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_due: balanceDue,
      payment_status: paymentStatus,
      paid_at: paidAmount > 0 ? (existing?.paid_at || nowIso) : null,
      remarks: remarks?.trim() || null,
      receipt_url: receiptUrl || existing?.receipt_url || null,
      created_at: existing?.created_at || nowIso,
    }

    const { data, error } = await supabase
      .from('billing_invoices')
      .upsert(invoicePayload)
      .select()
      .single()

    if (error) throw error

    // Also update the appointment fee_amount and payment_status
    await supabase
      .from('appointments')
      .update({
        fee_amount: totalAmount,
        payment_status: paymentStatus,
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
      is_on_break: updates.isOnBreak !== undefined ? updates.isOnBreak : (currentMeta.is_on_break ?? current?.is_on_break),
      break_updated_at: updates.breakUpdatedAt !== undefined ? updates.breakUpdatedAt : (currentMeta.break_updated_at ?? current?.break_updated_at),
      weekly_schedule_json: updates.weeklyScheduleJson !== undefined ? updates.weeklyScheduleJson : (currentMeta.weekly_schedule_json ?? current?.weekly_schedule_json),
      declared_holidays: updates.declaredHolidays !== undefined ? updates.declaredHolidays : (currentMeta.declared_holidays ?? current?.declared_holidays),
      manual_avg_consultation_time_minutes: updates.manualAvgConsultationTimeMinutes !== undefined ? updates.manualAvgConsultationTimeMinutes : (currentMeta.manual_avg_consultation_time_minutes ?? current?.manual_avg_consultation_time_minutes),
      avg_time_mode: updates.avgTimeMode !== undefined ? updates.avgTimeMode : (currentMeta.avg_time_mode ?? current?.avg_time_mode),
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
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl
    if (updates.panNumber !== undefined) payload.pan_number = updates.panNumber
    if (updates.managerPhone !== undefined) payload.manager_phone = updates.managerPhone
    if (updates.isOnBreak !== undefined) payload.is_on_break = updates.isOnBreak
    if (updates.weeklyScheduleJson !== undefined) payload.weekly_schedule_json = updates.weeklyScheduleJson
    if (updates.declaredHolidays !== undefined) payload.declared_holidays = updates.declaredHolidays
    if (updates.manualAvgConsultationTimeMinutes !== undefined) payload.manual_avg_consultation_time_minutes = updates.manualAvgConsultationTimeMinutes
    if (updates.avgTimeMode !== undefined) payload.avg_time_mode = updates.avgTimeMode

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
  const clinic = await getClinicById(clinicId)
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
      payload.experience_years = 2026 - updates.startingPracticingYear
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
  estimatedTimeLeft?: string,
  expectedTime?: string,
  trackingCode?: string,
  userId?: string,
  clinicId?: string
): Promise<boolean> {
  try {
    const metaObj = {
      meta_version: 1,
      audience: 'specific',
      category: 'queue_alert',
      left_label: 'Estimated Time Left',
      left_value: estimatedTimeLeft || 'Soon, be ready',
      right_label: 'Your Appointment Time',
      right_value: expectedTime || 'Soon, be ready',
      tracking_code: trackingCode || '',
    }

    const { error } = await supabase.from('notifications').insert({
      id: crypto.randomUUID(),
      appointment_id: appointmentId.length === 36 ? appointmentId : null,
      user_id: userId || null,
      clinic_id: clinicId || null,
      title: title.trim(),
      message: message.trim(),
      type: 'queue_alert',
      meta_json: JSON.stringify(metaObj),
      is_read: false,
      created_at: new Date().toISOString(),
    })
    return !error
  } catch {
    return false
  }
}

export async function searchPatientRecords(clinicId: string, searchQuery: string): Promise<Appointment[]> {
  try {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []

    const { data, error } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(*)')
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
    autoNotifyThreshold: c.auto_notify_threshold,
    description: cleanDesc,
    panNumber: c.pan_number || meta.pan_number,
    managerPhone: c.manager_phone || meta.manager_phone,
    registrationDocUrl: c.registration_doc_url || meta.registration_doc_url,
    pictures: c.pictures || meta.pictures || [],
    specialties: c.specialties || meta.specialties || [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    isArchived: c.is_archived ?? meta.is_archived,
    deletionScheduledAt: c.deletion_scheduled_at || meta.deletion_scheduled_at,
    logoUrl: c.logo_url,
    isOnBreak: c.is_on_break ?? meta.is_on_break ?? false,
    breakUpdatedAt: c.break_updated_at || meta.break_updated_at,
    weeklyScheduleJson: c.weekly_schedule_json || meta.weekly_schedule_json,
    declaredHolidays: c.declared_holidays || meta.declared_holidays || [],
    avgConsultationTimeMinutes: c.avg_consultation_time_minutes ?? meta.avg_consultation_time_minutes ?? 10,
    manualAvgConsultationTimeMinutes: c.manual_avg_consultation_time_minutes ?? meta.manual_avg_consultation_time_minutes ?? 10,
    calculatedAvgConsultationTimeMinutes: c.calculated_avg_consultation_time_minutes ?? meta.calculated_avg_consultation_time_minutes,
    avgTimeMode: c.avg_time_mode || meta.avg_time_mode || 'auto',
  }
}

function mapDoctor(d: any): Doctor {
  return {
    id: d.id,
    fullName: d.full_name,
    email: d.email,
    specialty: d.specialty,
    specialties: d.specialties || (d.specialty ? [d.specialty] : []),
    education: d.education,
    nmcLicenseNumber: d.nmc_license_number,
    experienceYears: d.experience_years,
    startingPracticingYear: d.starting_practicing_year,
    gender: d.gender,
    age: d.age,
    personalMobileNumber: d.personal_mobile_number,
    publicMobileNumber: d.public_mobile_number,
    consultationFee: d.consultation_fee,
    isInClinic: d.is_in_clinic,
    clinicId: d.clinic_id,
    activeClinicId: d.active_clinic_id,
    kycStatus: d.kyc_status,
    profilePictureUrl: d.profile_picture_url,
    description: d.description,
    practitionerRole: d.practitioner_role,
    isLabTechnician: d.practitioner_role === 'lab_technician' || (d.specialty && d.specialty.toLowerCase().includes('lab')),
  }
}

function mapAppointment(a: any): Appointment {
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
    checkinStatus: a.checkin_status,
    paymentStatus: a.payment_status,
    feeAmount: Number(a.fee_amount || 0),
    queueNumber: a.queue_number,
    notes: a.notes,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    selectedTests: a.selected_tests || [],
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
    category: s.category,
    description: s.description,
    isAvailable: s.is_available ?? true,
  }
}

function mapLabReport(r: any): LabReport {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    trackingCode10Digit: r.tracking_code_10_digit,
    patientName: r.patient_name,
    clinicId: r.clinic_id,
    testName: r.test_name,
    reportFileUrl: r.report_file_url,
    reportFileType: r.report_file_type,
    status: r.status,
    uploadedAt: r.uploaded_at,
    sampleCollectedAt: r.sample_collected_at,
    preparedAt: r.prepared_at,
    technicianNotes: r.technician_notes,
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
    paymentStatus: b.payment_status || 'unpaid',
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

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const clean = timeStr.trim().toUpperCase()
  const isPM = clean.includes('PM')
  const isAM = clean.includes('AM')
  const timeOnly = clean.replace(/AM|PM/g, '').trim()
  const parts = timeOnly.split(':')
  let hours = parseInt(parts[0] || '0', 10)
  const minutes = parseInt(parts[1] || '0', 10)

  if (isPM && hours < 12) hours += 12
  if (isAM && hours === 12) hours = 0

  return hours * 60 + minutes
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
      .select('*, clinic:clinics(*), doctor:doctors(*)')
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

export async function cancelAppointment(appointmentId: string, reason?: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('appointments')
      .update({
        checkinStatus: 'cancelled',
        notes: reason ? `Cancelled by patient: ${reason}` : 'Cancelled by patient',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)

    return !error
  } catch {
    return false
  }
}

export async function getClinicPaymentConfig(clinicId: string): Promise<PaymentGatewaysConfig | null> {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('payment_gateways_config, esewa_merchant_code, khalti_public_key, fonepay_merchant_id')
      .eq('id', clinicId)
      .single()

    if (error || !data) return null

    if (data.payment_gateways_config) {
      try {
        const parsed = typeof data.payment_gateways_config === 'string'
          ? JSON.parse(data.payment_gateways_config)
          : data.payment_gateways_config
        return parsed
      } catch {}
    }

    // Fallback: build config from legacy fields
    return {
      esewa: {
        id: 'esewa',
        title: 'eSewa Mobile Wallet',
        accountIdentifier: data.esewa_merchant_code || 'EPAYTEST',
        merchantCode: data.esewa_merchant_code || 'EPAYTEST',
        testBypassEnabled: true,
        isEnabled: true,
      },
      khalti: {
        id: 'khalti',
        title: 'Khalti Digital Wallet',
        accountIdentifier: data.khalti_public_key || 'test_public_key',
        merchantCode: data.khalti_public_key,
        testBypassEnabled: true,
        isEnabled: true,
      },
      fonepay: {
        id: 'fonepay',
        title: 'Fonepay QR / Direct Banking',
        accountIdentifier: data.fonepay_merchant_id || 'FONEPAYTEST',
        merchantCode: data.fonepay_merchant_id,
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

    // 1. Update appointment payment status
    await supabase
      .from('appointments')
      .update({
        payment_status: record.paymentStatus,
        updated_at: nowIso,
      })
      .eq('id', record.appointmentId)

    // 2. Create or update billing invoice in Supabase
    const invoicePayload = {
      id: crypto.randomUUID(),
      appointment_id: record.appointmentId,
      clinic_id: record.clinicId,
      total_amount: record.amount,
      paid_amount: record.paymentStatus === 'paid' ? record.amount : 0,
      balance_due: record.paymentStatus === 'paid' ? 0 : record.amount,
      payment_status: record.paymentStatus,
      paid_at: record.paymentStatus === 'paid' ? nowIso : null,
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

