import React, { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  Calendar,
  CheckCircle2,
  Stethoscope,
  FlaskConical,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ChevronRight,
  CreditCard,
  Download,
  RefreshCw,
  Building2,
  ExternalLink,
  UserCheck,
  History,
  Info,
  Check,
  Layers,
} from 'lucide-react'
import { Clinic, Doctor, ClinicService, Slot, Appointment, PaymentGatewaysConfig } from '../types'
import {
  getClinicById,
  getDoctorsByClinic,
  getClinicServices,
  getSlots,
  createAppointment,
  generate10DigitTrackingCode,
  isSlotTimeExpired,
  getClinicPaymentConfig,
  recordPaymentTransaction,
  getPatientProfileByEmail,
  getAppointmentByTrackingCode,
} from '../services/db'
import { supabase } from '../lib/supabase'

interface ClinicDetailProps {
  clinicId: string
  onBack: () => void
  onOpenLiveQueue: (trackingCode: string) => void
}

export const ClinicDetail: React.FC<ClinicDetailProps> = ({
  clinicId,
  onBack,
  onOpenLiveQueue,
}) => {
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [services, setServices] = useState<ClinicService[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewaysConfig | null>(null)
  const [loading, setLoading] = useState(true)

  // Active view tab: 'opd' or 'lab'
  const [activeTab, setActiveTab] = useState<'opd' | 'lab'>('opd')

  // Photo Carousel State (Parity with Mobile App ClinicDetailScreen)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

  // Auto-advance photo carousel every 3.5 seconds if multiple photos exist
  useEffect(() => {
    if (clinic?.pictures && clinic.pictures.length > 1) {
      const interval = setInterval(() => {
        setSelectedPhotoIndex((prev) => (prev + 1) % clinic.pictures.length)
      }, 3500)
      return () => clearInterval(interval)
    }
  }, [clinic?.pictures])

  // OPD Selection
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('')
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>(undefined)

  // Follow-Up (Multi-Visit Polyclinic)
  const [isReturningPatient, setIsReturningPatient] = useState(false)
  const [followupCodeInput, setFollowupCodeInput] = useState('')
  const [retainedAppointment, setRetainedAppointment] = useState<Appointment | null>(null)
  const [isLookingUpCode, setIsLookingUpCode] = useState(false)
  const [followupLookupError, setFollowupLookupError] = useState<string | null>(null)

  // Diagnostic Lab Selection
  const [selectedTests, setSelectedTests] = useState<{ [serviceId: string]: boolean }>({})

  // Booking Modal & Step ('details' | 'payment')
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingStep, setBookingStep] = useState<'details' | 'payment'>('details')
  const [patientName, setPatientName] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [patientGender, setPatientGender] = useState('')
  const [patientMobile, setPatientMobile] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientUserId, setPatientUserId] = useState<string | undefined>(undefined)
  const [patientNotes, setPatientNotes] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'esewa' | 'khalti' | 'fonepay' | 'bypass' | 'pay_at_clinic'
  >('esewa')
  const [paymentCountdown, setPaymentCountdown] = useState(300)
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})
  const [submitting, setSubmitting] = useState(false)

  // Saved profile option (only used if patient explicitly clicks "Use Saved Profile")
  const [savedProfile, setSavedProfile] = useState<{
    id?: string
    fullName: string
    age: number
    gender: string
    phone: string
    email: string
  } | null>(null)

  // Booking Success
  const [confirmedAppt, setConfirmedAppt] = useState<Appointment | null>(null)
  const [confirmedTxnId, setConfirmedTxnId] = useState<string>('')
  const [confirmedPayMethod, setConfirmedPayMethod] = useState<string>('')

  // Load clinic, doctors, lab services, and payment config from Supabase
  const loadClinicData = async () => {
    try {
      const [cData, dData, sData, payCfg] = await Promise.all([
        getClinicById(clinicId),
        getDoctorsByClinic(clinicId),
        getClinicServices(clinicId),
        getClinicPaymentConfig(clinicId),
      ])

      setClinic(cData)
      setDoctors(dData)
      // Strictly use real services from Supabase — NO demo tests
      setServices(sData)
      setPaymentConfig(payCfg)

      const isLab =
        cData?.type === 'diagnostic_lab' ||
        cData?.type?.toLowerCase().includes('lab') ||
        cData?.name.toLowerCase().includes('lab') ||
        (cData?.specialties?.some(
          (s) => s.toLowerCase().includes('lab') || s.toLowerCase().includes('patholog')
        ) ?? false)

      if (isLab) {
        setActiveTab('lab')
      } else {
        setActiveTab('opd')
      }

      if (dData.length > 0 && !selectedDoctor) {
        setSelectedDoctor(dData[0])
      }
    } catch (err) {
      console.error('Failed to load clinic details:', err)
    } finally {
      setLoading(false)
    }
  }

  // 3 Clinic Types Classification
  const isLabClinic = useMemo(() => {
    if (!clinic) return false
    const t = (clinic.type || '').toLowerCase()
    const n = (clinic.name || '').toLowerCase()
    return (
      t === 'diagnostic_lab' ||
      t.includes('lab') ||
      n.includes('lab') ||
      (clinic.specialties?.some(
        (s) => s.toLowerCase().includes('lab') || s.toLowerCase().includes('patholog')
      ) ?? false)
    )
  }, [clinic])

  const isSingleDoctorClinic = useMemo(() => {
    if (isLabClinic) return false
    return (
      clinic?.type === 'single_visit' ||
      clinic?.type === 'single_doctor' ||
      doctors.length === 1
    )
  }, [isLabClinic, clinic?.type, doctors.length])

  const isPolyclinic = useMemo(() => {
    return !isLabClinic && !isSingleDoctorClinic
  }, [isLabClinic, isSingleDoctorClinic])

  // Auto-bind single doctor if Single Doctor clinic
  useEffect(() => {
    if (isSingleDoctorClinic && doctors.length > 0) {
      setSelectedDoctor(doctors[0])
    }
  }, [isSingleDoctorClinic, doctors])

  // Reset returning patient if not polyclinic
  useEffect(() => {
    if (!isPolyclinic && isReturningPatient) {
      setIsReturningPatient(false)
      setFollowupCodeInput('')
      setRetainedAppointment(null)
    }
  }, [isPolyclinic, isReturningPatient])

  // Lookup 10-digit Appointment ID for Follow-up
  useEffect(() => {
    let active = true
    const clean = followupCodeInput.trim()
    if (isReturningPatient && clean.length === 10 && /^\d{10}$/.test(clean)) {
      setIsLookingUpCode(true)
      setFollowupLookupError(null)
      getAppointmentByTrackingCode(clean)
        .then((found) => {
          if (!active) return
          setIsLookingUpCode(false)
          if (found) {
            setRetainedAppointment(found)
            setPatientName(found.patientName)
            setPatientAge(String(found.patientAge || ''))
            setPatientGender(found.patientGender || '')
            setPatientMobile(found.patientMobile || '')
            if (found.patientEmail) setPatientEmail(found.patientEmail)
            setFormErrors({})
          } else {
            setRetainedAppointment(null)
            setFollowupLookupError(`No appointment record found for 10-digit code #${clean}.`)
          }
        })
        .catch(() => {
          if (!active) return
          setIsLookingUpCode(false)
          setRetainedAppointment(null)
          setFollowupLookupError('Failed to lookup appointment tracking code.')
        })
    } else {
      setRetainedAppointment(null)
      if (clean.length > 0 && clean.length !== 10) {
        setFollowupLookupError('Code must be exactly 10 digits.')
      } else {
        setFollowupLookupError(null)
      }
    }
    return () => {
      active = false
    }
  }, [isReturningPatient, followupCodeInput])

  useEffect(() => {
    setLoading(true)
    loadClinicData()

    // Check if logged-in patient has a verified profile in Supabase (to offer as a 1-tap chip, never auto-filled from Google)
    try {
      const sessionRaw = localStorage.getItem('dactor_patient_session')
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw)
        if (parsed?.email) {
          getPatientProfileByEmail(parsed.email).then((prof) => {
            if (prof && prof.fullName && prof.phone && prof.age && prof.gender) {
              setSavedProfile({
                id: prof.id,
                fullName: prof.fullName,
                age: Number(prof.age),
                gender: prof.gender,
                phone: prof.phone,
                email: prof.email,
              })
            }
          })
        }
      }
    } catch {}

    const channel = supabase
      .channel(`clinic-detail-${clinicId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinics', filter: `id=eq.${clinicId}` }, () => loadClinicData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => loadClinicData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_services', filter: `clinic_id=eq.${clinicId}` }, () => loadClinicData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clinicId])

  // Load real slots from Supabase whenever clinicId or selectedDate changes
  useEffect(() => {
    let active = true
    async function fetchSlotsForDate() {
      setSlotsLoading(true)
      try {
        const dbSlots = await getSlots(clinicId, selectedDate)
        if (!active) return
        setSlots(dbSlots)
      } catch (err) {
        console.error('Error loading slots:', err)
      } finally {
        if (active) setSlotsLoading(false)
      }
    }
    fetchSlotsForDate()
    return () => {
      active = false
    }
  }, [clinicId, selectedDate])

  // 5-minute countdown timer when on payment step
  useEffect(() => {
    if (!showBookingModal || bookingStep !== 'payment') return
    const timer = setInterval(() => {
      setPaymentCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [showBookingModal, bookingStep])

  // Parse clinic weekly schedule JSON from Supabase
  const parsedSchedule = useMemo(() => {
    if (!clinic?.weeklyScheduleJson) return []
    try {
      const parsed = JSON.parse(clinic.weeklyScheduleJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [clinic?.weeklyScheduleJson])

  const scheduleSummary = useMemo(() => {
    if (parsedSchedule.length === 0) {
      return {
        workingHours: '09:00 AM – 05:00 PM',
        workingDaysNote: 'Standard OPD & Diagnostic Hours',
        breakHours: clinic?.isOnBreak ? 'Currently on Active Break' : '01:00 PM – 02:00 PM',
        breakNote: clinic?.isOnBreak ? 'Queue temporarily paused by clinic' : 'Scheduled Lunch & Sanitization Break',
        weekendHours: `Avg ~${clinic?.avgConsultationTimeMinutes || 10} min / patient`,
        weekendNote:
          clinic?.declaredHolidays && clinic.declaredHolidays.length > 0
            ? `Declared Holidays: ${clinic.declaredHolidays.join(', ')}`
            : 'Real-time Queue & Walk-In Enabled',
      }
    }

    const openDays = parsedSchedule.filter((d: any) => d.isOpen !== false)
    const firstOpen = openDays[0] || parsedSchedule[0]
    const weekendDay = parsedSchedule.find((d: any) =>
      String(d.day || '').toLowerCase().startsWith('sun') ||
      String(d.day || '').toLowerCase().startsWith('sat')
    )

    return {
      workingHours: firstOpen
        ? `${firstOpen.openTime || '09:00 AM'} – ${firstOpen.closeTime || '05:00 PM'}`
        : '09:00 AM – 05:00 PM',
      workingDaysNote:
        openDays.length > 0
          ? `Open ${openDays.map((d: any) => String(d.day || '').slice(0, 3)).join(', ')}`
          : 'Configured by Clinic',
      breakHours:
        firstOpen?.breakStart && firstOpen?.breakEnd
          ? `${firstOpen.breakStart} – ${firstOpen.breakEnd}`
          : clinic?.isOnBreak
          ? 'Currently on Active Break'
          : 'No Fixed Break Configured',
      breakNote: clinic?.isOnBreak
        ? 'Clinic is currently on break right now'
        : 'Official Clinic Break Window',
      weekendHours:
        weekendDay
          ? weekendDay.isOpen === false
            ? `${weekendDay.day}: Closed`
            : `${weekendDay.day}: ${weekendDay.openTime || '09:00 AM'} – ${weekendDay.closeTime || '02:00 PM'}`
          : `Avg ~${clinic?.avgConsultationTimeMinutes || 10} min / patient`,
      weekendNote:
        clinic?.declaredHolidays && clinic.declaredHolidays.length > 0
          ? `Upcoming Holidays: ${clinic.declaredHolidays.slice(0, 3).join(', ')}`
          : `Avg Consultation: ~${clinic?.avgConsultationTimeMinutes || 10} mins`,
    }
  }, [parsedSchedule, clinic])

  const isSelectedDateHoliday = useMemo(() => {
    return Boolean(clinic?.declaredHolidays && clinic.declaredHolidays.includes(selectedDate))
  }, [clinic?.declaredHolidays, selectedDate])

  // Build available time slots (strictly using Supabase slots if configured, or schedule-derived slots filtered by isSlotTimeExpired)
  const displaySlots = useMemo(() => {
    if (isSelectedDateHoliday) return []

    const filteredDbSlots = slots.filter(
      (s) => !selectedDoctor || !s.doctorId || s.doctorId === selectedDoctor.id
    )

    if (filteredDbSlots.length > 0) {
      return filteredDbSlots.map((s) => {
        const label = s.endTime ? `${s.startTime.slice(0, 5)} - ${s.endTime.slice(0, 5)}` : s.startTime
        const expired = isSlotTimeExpired(selectedDate, s.endTime || s.startTime)
        const full = (s.bookedCount || 0) >= (s.maxCapacity || 10)
        return {
          id: s.id,
          timeLabel: label,
          rawStart: s.startTime,
          remaining: Math.max(0, (s.maxCapacity || 10) - (s.bookedCount || 0)),
          disabled: expired || full || s.isAvailable === false,
          reason: expired ? 'Expired' : full ? 'Full' : '',
        }
      })
    }

    // Derive from clinic's day schedule and filter out expired times via isSlotTimeExpired
    const candidateTimes = ['09:30 AM', '10:30 AM', '11:30 AM', '12:30 PM', '02:00 PM', '03:30 PM', '04:30 PM', '05:30 PM']
    return candidateTimes.map((t) => {
      const expired = isSlotTimeExpired(selectedDate, t)
      return {
        id: undefined,
        timeLabel: t,
        rawStart: t,
        remaining: 10,
        disabled: expired,
        reason: expired ? 'Passed' : '',
      }
    })
  }, [slots, selectedDoctor, selectedDate, isSelectedDateHoliday])

  // Auto-select first available non-disabled slot
  useEffect(() => {
    const firstAvailable = displaySlots.find((s) => !s.disabled)
    if (firstAvailable) {
      setSelectedSlotTime(firstAvailable.timeLabel)
      setSelectedSlotId(firstAvailable.id)
    } else {
      setSelectedSlotTime('')
      setSelectedSlotId(undefined)
    }
  }, [displaySlots])

  // Toggle selected test
  const toggleTest = (id: string) => {
    setSelectedTests((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Calculate total lab tests fee
  const selectedTestList = services.filter((s) => selectedTests[s.id])
  const calculatedLabFee = selectedTestList.reduce((acc, curr) => acc + curr.price, 0)
  const totalBookingFee = useMemo(() => {
    if (activeTab === 'lab') {
      return calculatedLabFee
    }
    if (isReturningPatient && retainedAppointment) {
      return 0
    }
    return selectedDoctor?.consultationFee || 500
  }, [activeTab, calculatedLabFee, isReturningPatient, retainedAppointment, selectedDoctor?.consultationFee])

  // Live criteria validation helpers
  const isNameValid = (val: string) => val.trim().length >= 2
  const isAgeValid = (val: string) => {
    const n = Number(val)
    return val.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 120
  }
  const isGenderValid = (val: string) => ['Male', 'Female', 'Other'].includes(val)
  const isMobileValid = (val: string) => /^9\d{9}$/.test(val.replace(/\D/g, ''))

  // Validate form and scroll/focus first missing/invalid field
  const validateDetailsForm = () => {
    const errors: { [key: string]: string } = {}
    let firstInvalidId: string | null = null

    if (!isNameValid(patientName)) {
      errors.name = 'Full name is required (minimum 2 characters).'
      if (!firstInvalidId) firstInvalidId = 'field-patient-name'
    }
    if (!isAgeValid(patientAge)) {
      errors.age = 'Enter a valid whole number age between 1 and 120.'
      if (!firstInvalidId) firstInvalidId = 'field-patient-age'
    }
    if (!isGenderValid(patientGender)) {
      errors.gender = 'Please select gender.'
      if (!firstInvalidId) firstInvalidId = 'field-patient-gender'
    }
    if (!isMobileValid(patientMobile)) {
      errors.mobile = 'Enter a valid 10-digit mobile number starting with 9 (e.g. 98XXXXXXXX).'
      if (!firstInvalidId) firstInvalidId = 'field-patient-mobile'
    }

    setFormErrors(errors)

    if (firstInvalidId) {
      const el = document.getElementById(firstInvalidId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(el as HTMLElement).focus?.()
      }
      return false
    }
    return true
  }

  const handleProceedToPaymentStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateDetailsForm()) return
    setPaymentCountdown(300)
    setBookingStep('payment')
  }

  // Handle final appointment + payment submission to Supabase
  const handleConfirmBookingAndPayment = async () => {
    if (!validateDetailsForm()) {
      setBookingStep('details')
      return
    }

    setSubmitting(true)
    try {
      const code10 = generate10DigitTrackingCode()
      const testsSelectedNames = activeTab === 'lab' ? selectedTestList.map((t) => t.serviceName) : []
      const cleanMobile = patientMobile.replace(/\D/g, '')
      const isFreeBooking = totalBookingFee === 0
      const isPaidNow = isFreeBooking || selectedPaymentMethod !== 'pay_at_clinic'
      const payStatus = isFreeBooking ? 'paid' : isPaidNow ? 'paid' : 'unpaid'

      const created = await createAppointment({
        clinicId,
        doctorId: activeTab === 'opd' ? selectedDoctor?.id : undefined,
        userId: patientUserId,
        slotId: selectedSlotId,
        trackingCode10Digit: code10,
        patientName: patientName.trim(),
        patientAge: Number(patientAge),
        patientGender,
        patientMobile: cleanMobile,
        patientEmail: patientEmail.trim() || undefined,
        appointmentDate: selectedDate,
        appointmentTime: selectedSlotTime || '10:00 AM',
        checkinStatus: 'waiting',
        paymentStatus: payStatus,
        feeAmount: totalBookingFee,
        selectedTests: testsSelectedNames,
        notes:
          activeTab === 'lab'
            ? `Lab Tests: ${testsSelectedNames.join(', ')}`
            : isReturningPatient && retainedAppointment
            ? `Follow-Up Consultation (Previous Ref: ${retainedAppointment.trackingCode10Digit})`
            : patientNotes.trim() || undefined,
      })

      if (created) {
        const txnId = `TXN-${code10}-${Date.now().toString().slice(-4)}`
        const methodLabel = isFreeBooking
          ? 'Free Follow-Up (Retained 10-Digit ID)'
          : selectedPaymentMethod === 'esewa'
          ? 'eSewa Mobile Wallet'
          : selectedPaymentMethod === 'khalti'
          ? 'Khalti Digital Wallet'
          : selectedPaymentMethod === 'fonepay'
          ? 'Fonepay QR'
          : selectedPaymentMethod === 'bypass'
          ? 'Bypass Test Gateway'
          : 'Pay at Clinic Counter'

        await recordPaymentTransaction({
          appointmentId: created.id,
          trackingCode: code10,
          clinicId,
          doctorId: selectedDoctor?.id,
          patientName: patientName.trim(),
          appointmentDate: selectedDate,
          appointmentTime: selectedSlotTime || '10:00 AM',
          amount: totalBookingFee,
          paymentMethod: methodLabel,
          paymentStatus: payStatus,
          transactionId: txnId,
          notes: testsSelectedNames.length > 0 ? `Lab Tests: ${testsSelectedNames.join(', ')}` : 'OPD Consultation',
        })

        // Save 10-digit code to localStorage so Patient Portal & Notifications track it automatically
        try {
          const existingCodes = JSON.parse(localStorage.getItem('dactor_patient_tracking_codes') || '[]')
          if (!existingCodes.includes(code10)) {
            localStorage.setItem('dactor_patient_tracking_codes', JSON.stringify([code10, ...existingCodes]))
          }
        } catch {}

        setConfirmedTxnId(txnId)
        setConfirmedPayMethod(methodLabel)
        setConfirmedAppt({ ...created, paymentStatus: payStatus })
        setShowBookingModal(false)
      } else {
        alert('Could not create appointment in Supabase. Please check your internet connection.')
      }
    } catch (err) {
      console.error('Error creating booking:', err)
      alert('An error occurred during booking.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadInvoice = () => {
    if (!confirmedAppt || !clinic) return
    const win = window.open('', '_blank', 'width=800,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dactor Invoice - ${confirmedAppt.trackingCode10Digit}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 36px; color: #0f172a; }
            .box { max-width: 680px; margin: 0 auto; border: 2px solid #0284c7; border-radius: 16px; padding: 28px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 999px; font-weight: 800; font-size: 12px; }
            .code { font-family: monospace; font-size: 28px; font-weight: 900; letter-spacing: 3px; color: #0284c7; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            th { color: #64748b; text-transform: uppercase; font-size: 11px; }
            .total { font-size: 18px; font-weight: 900; color: #0f172a; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="header">
              <div>
                <h2 style="margin:0;font-size:22px;">${clinic.name}</h2>
                <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${clinic.addressText || 'Nepal'} • ${clinic.contactPhone || ''}</p>
              </div>
              <span class="badge">${confirmedAppt.paymentStatus === 'paid' ? 'PAID RECEIPT' : 'PAY AT CLINIC'}</span>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;">10-Digit Universal Queue & Report Tracking Code</div>
              <div class="code">${confirmedAppt.trackingCode10Digit}</div>
            </div>
            <table>
              <tr><th>Patient Name</th><td><strong>${confirmedAppt.patientName}</strong> (${confirmedAppt.patientAge} yrs, ${confirmedAppt.patientGender})</td></tr>
              <tr><th>Contact Mobile</th><td>${confirmedAppt.patientMobile}</td></tr>
              <tr><th>Queue Token Number</th><td><strong>Token #${confirmedAppt.queueNumber || 1}</strong></td></tr>
              <tr><th>Date & Slot</th><td>${confirmedAppt.appointmentDate} • ${confirmedAppt.appointmentTime}</td></tr>
              <tr><th>Service / Doctor</th><td>${
                confirmedAppt.selectedTests && confirmedAppt.selectedTests.length > 0
                  ? `Diagnostic Lab: ${confirmedAppt.selectedTests.join(', ')}`
                  : selectedDoctor?.fullName || 'OPD Doctor Consultation'
              }</td></tr>
              <tr><th>Payment Method & Txn ID</th><td>${confirmedPayMethod || 'Direct'} (${confirmedTxnId || 'N/A'})</td></tr>
              <tr><th>Total Amount</th><td class="total">Rs. ${confirmedAppt.feeAmount}</td></tr>
            </table>
            <p style="margin-top:24px;font-size:11px;color:#64748b;text-align:center;">
              Generated by Dactor Healthcare Platform • Present this 10-digit code at reception or track your live queue online.
            </p>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-bold">Loading live clinic profile from Supabase...</p>
      </div>
    )
  }

  if (!clinic) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Clinic Not Found</h2>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2.5 bg-brand-600 text-white font-bold rounded-xl"
        >
          Return to Clinics
        </button>
      </div>
    )
  }

  // Confirmation Success View
  if (confirmedAppt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-brand-100 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Booking & Queue Token Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Token #{confirmedAppt.queueNumber || 1} Generated!
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Your appointment is registered in live queue at {clinic.name}.
            </p>
          </div>

          {/* 10-Digit Code Showcase Box */}
          <div className="p-6 bg-gradient-to-br from-brand-50 to-teal-50 rounded-2xl border border-brand-200 text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Your 10-Digit Live Tracking Code
            </span>
            <div className="text-3xl sm:text-4xl font-black tracking-widest text-slate-900 font-mono">
              {confirmedAppt.trackingCode10Digit}
            </div>
            <p className="text-xs text-slate-600 font-medium pt-1">
              Use this code to check your live queue position or unlock name-verified lab reports.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl text-left text-xs">
            <div>
              <span className="text-slate-400 font-medium">Patient</span>
              <p className="font-bold text-slate-800 text-sm">
                {confirmedAppt.patientName} ({confirmedAppt.patientAge}y, {confirmedAppt.patientGender})
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Date & Time</span>
              <p className="font-bold text-slate-800 text-sm">
                {confirmedAppt.appointmentDate} • {confirmedAppt.appointmentTime}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Payment Status</span>
              <p className="font-bold text-emerald-700 text-sm uppercase">
                {confirmedAppt.paymentStatus} ({confirmedPayMethod})
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Total Fee</span>
              <p className="font-bold text-brand-700 text-sm">Rs. {confirmedAppt.feeAmount}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => onOpenLiveQueue(confirmedAppt.trackingCode10Digit)}
              className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Track Live Queue Now</span>
            </button>
            <button
              onClick={handleDownloadInvoice}
              className="py-3.5 px-5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-2xl transition-colors text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Invoice</span>
            </button>
            <button
              onClick={onBack}
              className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors text-sm cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-brand-700 transition-colors py-1 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Clinics Directory</span>
      </button>

      {/* ========================================================= */}
      {/* 1. CLINIC HERO PHOTO CAROUSEL (Real Supabase Pictures)   */}
      {/* ========================================================= */}
      {(() => {
        const photos =
          clinic.pictures && clinic.pictures.length > 0
            ? clinic.pictures
            : clinic.logoUrl
            ? [clinic.logoUrl]
            : []
        const activePhoto = photos[selectedPhotoIndex] || photos[0]

        return (
          <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden bg-slate-900 border border-slate-200/80 shadow-md">
            {activePhoto ? (
              <img
                src={activePhoto}
                alt={clinic.name}
                className="w-full h-full object-cover transition-all duration-500"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-brand-700 via-brand-600 to-teal-600 flex items-center justify-center text-white">
                <div className="text-center space-y-2 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto border border-white/20">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-black">{clinic.name}</h2>
                  <p className="text-xs text-white/80 font-medium">Dactor Certified Healthcare Center • Nepal</p>
                </div>
              </div>
            )}

            {/* Gradient Overlay for Legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-black/30 pointer-events-none" />

            {/* Top Overlay Badges */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
              <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-white/90 text-brand-900 backdrop-blur-md shadow-sm">
                {clinic.type === 'diagnostic_lab' ? 'Diagnostic Pathology Lab' : clinic.type === 'single_visit' ? 'Single-Visit OPD' : 'Multi-Visit Polyclinic'}
              </span>

              <div className="flex items-center space-x-2">
                {clinic.isOnBreak && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-md">
                    Currently on Break
                  </span>
                )}
                <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-md">
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Verified Clinic
                </span>
              </div>
            </div>

            {/* Bottom Caption & Interactive Photo Navigation Dots */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pointer-events-auto">
              <div className="text-white drop-shadow-md">
                <h2 className="text-xl sm:text-2xl font-black">{clinic.name}</h2>
                <p className="text-xs text-slate-200 flex items-center space-x-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{clinic.addressText || 'Nepal'}</span>
                </p>
              </div>

              {photos.length > 1 && (
                <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 self-start sm:self-auto">
                  {photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === selectedPhotoIndex ? 'w-7 bg-brand-400' : 'w-2.5 bg-white/50 hover:bg-white'
                      }`}
                      title={`Photo ${idx + 1}`}
                    />
                  ))}
                  <span className="text-[10px] font-bold text-white/90 px-1">
                    {selectedPhotoIndex + 1}/{photos.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ========================================================= */}
      {/* 2. CLINIC IDENTITY & WORKING/BREAK HOURS (Real Supabase)  */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start space-x-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-brand-600 to-teal-500 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md shrink-0 overflow-hidden border border-slate-200">
              {clinic.logoUrl || (clinic.pictures && clinic.pictures.length > 0) ? (
                <img
                  src={clinic.logoUrl || clinic.pictures![0]}
                  alt={clinic.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none'
                  }}
                />
              ) : clinic.type === 'diagnostic_lab' ? (
                <FlaskConical className="w-10 h-10" />
              ) : (
                clinic.name.charAt(0)
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{clinic.name}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-800">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-brand-600" />
                  Verified Clinic
                </span>
                {clinic.isOnBreak && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Currently on Break
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium pt-0.5">
                <span className="flex items-center space-x-1.5 bg-slate-100 px-3 py-1 rounded-xl">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold">{clinic.addressText || 'Nepal'}</span>
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${clinic.name} ${clinic.addressText || ''}`.trim()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition text-[11px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Maps Directions</span>
                </a>
                {clinic.contactPhone && (
                  <a
                    href={`tel:${clinic.contactPhone}`}
                    className="flex items-center space-x-1 bg-slate-100 px-3 py-1 rounded-xl hover:bg-slate-200 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-brand-600" />
                    <span>{clinic.contactPhone}</span>
                  </a>
                )}
                {clinic.managerPhone && (
                  <span className="flex items-center space-x-1 bg-slate-100 px-3 py-1 rounded-xl">
                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                    <span>Desk: {clinic.managerPhone}</span>
                  </span>
                )}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
                  <Layers className="w-3 h-3 mr-1" />
                  {isLabClinic
                    ? 'Diagnostic Pathology Lab'
                    : isSingleDoctorClinic
                    ? 'Single-Visit OPD Clinic'
                    : 'Multi-Specialty Polyclinic'}
                </span>
              </div>
              {clinic.description && (
                <p className="text-xs text-slate-600 max-w-2xl pt-1">{clinic.description}</p>
              )}
            </div>
          </div>

          {/* Quick Action Pills */}
          <div className="flex items-center space-x-2">
            {!isLabClinic && (
              <button
                onClick={() => setActiveTab('opd')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'opd'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>
                  {isSingleDoctorClinic
                    ? 'Attending Doctor'
                    : `Specialists (${doctors.length})`}
                </span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('lab')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'lab'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>Diagnostic Tests ({services.length})</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* WORKING HOURS & BREAK HOURS STRIP (From Clinic Schedule)  */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Working Hours */}
          <div className="p-4 bg-brand-50/60 rounded-2xl border border-brand-200/80 flex items-start space-x-3.5">
            <div className="p-2 bg-brand-100 text-brand-700 rounded-xl shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-brand-800 uppercase tracking-wider block">
                Working Hours
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                {scheduleSummary.workingHours}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">{scheduleSummary.workingDaysNote}</p>
            </div>
          </div>

          {/* Break Hours */}
          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex items-start space-x-3.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Break Hours & Status
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                {scheduleSummary.breakHours}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">{scheduleSummary.breakNote}</p>
            </div>
          </div>

          {/* Average Consultation Time & Holidays */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start space-x-3.5">
            <div className="p-2 bg-slate-200 text-slate-700 rounded-xl shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Weekend & Queue Pace
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                {scheduleSummary.weekendHours}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">{scheduleSummary.weekendNote}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN CONTENT: OPD CONSULTATION VS DIAGNOSTIC LAB TESTS    */}
      {/* ========================================================= */}
      {activeTab === 'opd' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Doctor Selection & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. SINGLE-VISIT CLINIC BANNER & DEDICATED DOCTOR CARD */}
            {isSingleDoctorClinic ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Single-Visit Consultation Clinic
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Each booking generates a dedicated single-use OPD token with our certified attending specialist. Published slots below are dedicated to this doctor.
                    </p>
                  </div>
                </div>

                {selectedDoctor ? (
                  <div className="p-6 rounded-3xl bg-white border border-brand-300 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-2xl shrink-0">
                          {selectedDoctor.profilePictureUrl ? (
                            <img
                              src={selectedDoctor.profilePictureUrl}
                              alt={selectedDoctor.fullName}
                              className="w-full h-full object-cover rounded-2xl"
                            />
                          ) : (
                            selectedDoctor.fullName.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-black text-slate-900">{selectedDoctor.fullName}</h3>
                            {selectedDoctor.isInClinic ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-ping" />
                                In Clinic Now
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                Away
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-brand-700">
                            {selectedDoctor.specialty || 'General Practitioner'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedDoctor.education || 'MBBS'} •{' '}
                            {selectedDoctor.startingPracticingYear
                              ? `Practicing since ${selectedDoctor.startingPracticingYear}`
                              : `${selectedDoctor.experienceYears || 1}+ Years Exp`}
                            {selectedDoctor.nmcLicenseNumber ? ` • NMC: ${selectedDoctor.nmcLicenseNumber}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Consultation Fee</span>
                        <span className="text-lg font-black text-slate-900">
                          Rs. {selectedDoctor.consultationFee || 500}
                        </span>
                      </div>
                    </div>

                    {selectedDoctor.description && (
                      <p className="text-xs text-slate-600 border-t border-slate-100 pt-3">
                        {selectedDoctor.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500">
                    <Stethoscope className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-bold text-slate-800">No doctor profile available for this clinic.</p>
                  </div>
                )}
              </div>
            ) : (
              /* 2. MULTI-VISIT POLYCLINIC: VISIT TYPE + SPECIALISTS ROSTER */
              <div className="space-y-6">
                {/* Visit Type Toggle: New Consultation vs Free Follow-Up */}
                <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Visit Type (Multi-Visit Polyclinic)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Choose New Consultation or claim a 100% Free Follow-Up with your 10-digit Appointment ID.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReturningPatient(false)
                        setFollowupLookupError(null)
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        !isReturningPatient
                          ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-500/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">New Patient</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-600 text-white">
                          Rs. {selectedDoctor?.consultationFee || 500}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Standard initial consultation</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsReturningPatient(true)
                        setFollowupLookupError(null)
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        isReturningPatient
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">Follow-Up Visit</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wider">
                          FREE
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Free with 10-digit Appointment ID</p>
                    </button>
                  </div>

                  {/* Follow-Up 10-digit Input and Retained Box */}
                  {isReturningPatient && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3 animate-in fade-in duration-150">
                      <div>
                        <label className="text-xs font-bold text-emerald-900 block mb-1">
                          Enter 10-Digit Appointment ID for Follow-Up *
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={followupCodeInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                            setFollowupCodeInput(val)
                          }}
                          placeholder="e.g. 8492049182 (10 digits)"
                          className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold bg-white border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                        />
                      </div>

                      {isLookingUpCode && (
                        <div className="flex items-center space-x-2 text-xs text-emerald-700">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Looking up previous appointment details in Supabase...</span>
                        </div>
                      )}

                      {retainedAppointment && (
                        <div className="p-3 rounded-xl bg-white border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm block text-emerald-900">
                              ✓ Patient Retained: {retainedAppointment.patientName}
                            </span>
                            <span className="text-[11px] text-emerald-700 font-medium">
                              {retainedAppointment.patientAge} yrs • {retainedAppointment.patientGender} • {retainedAppointment.patientMobile}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                            Verified
                          </span>
                        </div>
                      )}

                      {followupLookupError && (
                        <p className="text-xs text-rose-600 font-bold">{followupLookupError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Specialists Roster Header */}
                <div className="flex items-center justify-between pt-2">
                  <h3 className="text-lg font-black text-slate-900">Specialist Doctors on Roster</h3>
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full">
                    {doctors.length} Doctors
                  </span>
                </div>

                {doctors.length === 0 ? (
                  <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500 space-y-2">
                    <Stethoscope className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-bold text-slate-800">No doctors registered under this polyclinic yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {doctors.map((doc) => {
                      const isSelected = selectedDoctor?.id === doc.id

                      return (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDoctor(doc)}
                          className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                            isSelected
                              ? 'bg-brand-50/50 border-brand-400 shadow-md shadow-brand-500/10 ring-2 ring-brand-400/30'
                              : 'bg-white border-slate-200/80 hover:border-brand-300'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xl shrink-0">
                              {doc.profilePictureUrl ? (
                                <img
                                  src={doc.profilePictureUrl}
                                  alt={doc.fullName}
                                  className="w-full h-full object-cover rounded-2xl"
                                />
                              ) : (
                                doc.fullName.charAt(0)
                              )}
                            </div>

                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-base font-black text-slate-900">{doc.fullName}</h3>
                                {doc.isInClinic ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-ping" />
                                    In Clinic Now
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    Away
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-brand-700">
                                {doc.specialty || 'Specialist Consultant'}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {doc.education || 'MBBS'} •{' '}
                                {doc.startingPracticingYear
                                  ? `Practicing since ${doc.startingPracticingYear}`
                                  : `${doc.experienceYears || 1}+ Years Exp`}
                                {doc.nmcLicenseNumber ? ` • NMC: ${doc.nmcLicenseNumber}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center sm:flex-col items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Consultation Fee</span>
                              <span className="text-base font-black text-slate-900">
                                Rs. {doc.consultationFee || 500}
                              </span>
                            </div>
                            <span
                              className={`mt-1 text-xs font-bold px-3 py-1 rounded-xl ${
                                isSelected
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Slot Selection & Appointment Trigger */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 sticky top-28">
              <h3 className="text-lg font-black text-slate-900">Book OPD Consultation</h3>

              {/* Date Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Select Date</label>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[0, 1, 2].map((offset) => {
                    const d = new Date()
                    d.setDate(d.getDate() + offset)
                    const iso = d.toISOString().split('T')[0]
                    const label =
                      offset === 0
                        ? 'Today'
                        : offset === 1
                        ? 'Tomorrow'
                        : d.toLocaleDateString([], { weekday: 'short' })
                    const isSelected = selectedDate === iso

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        className={`p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="block text-[10px] opacity-80 uppercase">{label}</span>
                        <span className="text-xs font-black">
                          {d.getDate()} {d.toLocaleDateString([], { month: 'short' })}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slot Time Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">Select Time Slot</label>
                  {slotsLoading && <RefreshCw className="w-3.5 h-3.5 text-brand-600 animate-spin" />}
                </div>

                {isSelectedDateHoliday ? (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                    This clinic has declared {selectedDate} as an official holiday. Please pick another date.
                  </div>
                ) : displaySlots.length === 0 ? (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No slots available for this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {displaySlots.map((slotItem) => {
                      const isSelected = selectedSlotTime === slotItem.timeLabel && !slotItem.disabled
                      return (
                        <button
                          key={slotItem.timeLabel}
                          type="button"
                          disabled={slotItem.disabled}
                          onClick={() => {
                            setSelectedSlotTime(slotItem.timeLabel)
                            setSelectedSlotId(slotItem.id)
                          }}
                          className={`p-2.5 rounded-xl border font-bold transition-all text-center ${
                            slotItem.disabled
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-brand-600 text-white border-brand-600 shadow-xs cursor-pointer'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer'
                          }`}
                        >
                          <span className="block">{slotItem.timeLabel}</span>
                          {slotItem.reason && (
                            <span className="text-[9px] uppercase font-semibold opacity-75">
                              {slotItem.reason}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Specialist:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDoctor?.fullName || 'Clinic OPD Doctor'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Slot:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDate} {selectedSlotTime ? `at ${selectedSlotTime}` : ''}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span className="text-slate-700">Total Fee:</span>
                  <span className="text-brand-700 text-sm">
                    Rs. {selectedDoctor?.consultationFee || 500}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={!selectedSlotTime || isSelectedDateHoliday}
                onClick={() => {
                  setBookingStep('details')
                  setShowBookingModal(true)
                }}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Proceed to Patient Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* TAB B: DIAGNOSTIC LAB TESTS SELECTION (Strictly Supabase) */
        /* ========================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Lab Diagnostic Notice Banner */}
            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 flex items-start space-x-3">
              <FlaskConical className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                  Diagnostic Pathology Lab Booking
                </h4>
                <p className="text-xs text-teal-800 mt-0.5">
                  Select required diagnostic tests and choose a sample collection time slot. Once tests are processed, verified digital reports will be issued online.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Select Diagnostic Tests</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Check individual tests to assemble your test profile. All prices are synced live from Supabase.
                </p>
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                {selectedTestList.length} Selected
              </span>
            </div>

            {services.length === 0 ? (
              <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
                <FlaskConical className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  No diagnostic tests published by this clinic yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When this clinic adds pathology or diagnostic test rates in the Clinic Portal, they will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {services.map((srv) => {
                  const isChecked = !!selectedTests[srv.id]

                  return (
                    <div
                      key={srv.id}
                      onClick={() => toggleTest(srv.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-teal-50/60 border-teal-400 ring-2 ring-teal-400/30 shadow-xs'
                          : 'bg-white border-slate-200/80 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 leading-tight">
                            {srv.serviceName}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {srv.category || 'Diagnostic'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-teal-700">Rs. {srv.price}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Lab Checkout Summary */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 sticky top-28">
              <h3 className="text-lg font-black text-slate-900">Lab Booking Summary</h3>

              {/* Selected Tests List */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedTestList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No tests selected yet. Please select at least one test from the left.
                  </p>
                ) : (
                  selectedTestList.map((t) => (
                    <div key={t.id} className="flex justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-700 truncate max-w-[160px]">{t.serviceName}</span>
                      <span className="font-bold text-slate-900">Rs. {t.price}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Date selection for Lab */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Sample Collection Date</label>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[0, 1, 2].map((offset) => {
                    const d = new Date()
                    d.setDate(d.getDate() + offset)
                    const iso = d.toISOString().split('T')[0]
                    const label =
                      offset === 0
                        ? 'Today'
                        : offset === 1
                        ? 'Tomorrow'
                        : d.toLocaleDateString([], { weekday: 'short' })
                    const isSelected = selectedDate === iso

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        className={`p-2 rounded-xl border font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="block text-[10px] opacity-80 uppercase">{label}</span>
                        <span className="text-xs font-black">
                          {d.getDate()} {d.toLocaleDateString([], { month: 'short' })}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sample Collection Time Slot Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    Sample Collection Slot *
                  </label>
                  {slotsLoading && <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />}
                </div>

                {isSelectedDateHoliday ? (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                    This lab has declared {selectedDate} as an official holiday. Please pick another date.
                  </div>
                ) : displaySlots.length === 0 ? (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No collection slots available for this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {displaySlots.map((slotItem) => {
                      const isSelected = selectedSlotTime === slotItem.timeLabel && !slotItem.disabled
                      return (
                        <button
                          key={slotItem.timeLabel}
                          type="button"
                          disabled={slotItem.disabled}
                          onClick={() => {
                            setSelectedSlotTime(slotItem.timeLabel)
                            setSelectedSlotId(slotItem.id)
                          }}
                          className={`p-2 rounded-xl border font-bold transition-all text-center ${
                            slotItem.disabled
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-teal-600 text-white border-teal-600 shadow-xs cursor-pointer'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer'
                          }`}
                        >
                          <span className="block">{slotItem.timeLabel}</span>
                          {slotItem.reason && (
                            <span className="text-[9px] uppercase font-semibold opacity-75">
                              {slotItem.reason}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Total Calculation */}
              <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Selected Tests ({selectedTestList.length}):</span>
                  <span>Rs. {calculatedLabFee}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Collection Slot:</span>
                  <span className="font-bold text-slate-900">{selectedSlotTime || 'Select a slot'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-teal-200/80 font-black text-sm text-teal-900">
                  <span>Total Payable:</span>
                  <span>Rs. {calculatedLabFee}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={selectedTestList.length === 0 || !selectedSlotTime || isSelectedDateHoliday}
                onClick={() => {
                  setBookingStep('details')
                  setShowBookingModal(true)
                }}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Proceed to Patient Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PATIENT BOOKING & PAYMENT MODAL (Strict Criteria Checks)  */}
      {/* ========================================================= */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            {bookingStep === 'details' ? (
              <>
                <h3 className="text-xl font-black text-slate-900 mb-1">
                  Enter Verified Patient Details
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  All fields marked with <span className="text-rose-500 font-bold">*</span> are strictly required. Red indicators clear automatically once valid criteria are met.
                </p>

                {/* Optional 1-Tap Fill from Verified Supabase Patient Profile */}
                {savedProfile && (
                  <div className="mb-4 p-3 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="font-bold text-brand-900 block">
                        Saved Profile: {savedProfile.fullName}
                      </span>
                      <span className="text-brand-700 text-[11px]">
                        {savedProfile.age} yrs • {savedProfile.gender} • {savedProfile.phone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPatientUserId(savedProfile.id)
                        setPatientName(savedProfile.fullName)
                        setPatientAge(String(savedProfile.age))
                        setPatientGender(savedProfile.gender)
                        setPatientMobile(savedProfile.phone)
                        setPatientEmail(savedProfile.email || '')
                        setFormErrors({})
                      }}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[11px] font-bold cursor-pointer"
                    >
                      Use Profile
                    </button>
                  </div>
                )}

                <form onSubmit={handleProceedToPaymentStep} className="space-y-4" noValidate>
                  {/* Patient Full Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Patient Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="field-patient-name"
                      type="text"
                      value={patientName}
                      onChange={(e) => {
                        const val = e.target.value
                        setPatientName(val)
                        if (isNameValid(val) && formErrors.name) {
                          setFormErrors((prev) => ({ ...prev, name: '' }))
                        }
                      }}
                      placeholder="Enter patient's full legal name"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                        formErrors.name && !isNameValid(patientName)
                          ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                          : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-brand-500'
                      } focus:outline-none focus:ring-2`}
                    />
                    {formErrors.name && !isNameValid(patientName) && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{formErrors.name}</span>
                      </p>
                    )}
                  </div>

                  {/* Age and Gender Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Age (1–120) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="field-patient-age"
                        type="number"
                        value={patientAge}
                        onChange={(e) => {
                          const val = e.target.value
                          setPatientAge(val)
                          if (isAgeValid(val) && formErrors.age) {
                            setFormErrors((prev) => ({ ...prev, age: '' }))
                          }
                        }}
                        placeholder="Years"
                        min="1"
                        max="120"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          formErrors.age && !isAgeValid(patientAge)
                            ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-slate-50'
                        } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                      />
                      {formErrors.age && !isAgeValid(patientAge) && (
                        <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.age}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="field-patient-gender"
                        value={patientGender}
                        onChange={(e) => {
                          const val = e.target.value
                          setPatientGender(val)
                          if (isGenderValid(val) && formErrors.gender) {
                            setFormErrors((prev) => ({ ...prev, gender: '' }))
                          }
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          formErrors.gender && !isGenderValid(patientGender)
                            ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-slate-50'
                        } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                      >
                        <option value="">Select Gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      {formErrors.gender && !isGenderValid(patientGender) && (
                        <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.gender}</p>
                      )}
                    </div>
                  </div>

                  {/* Mobile Phone (Strict 10-digit criteria) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      10-Digit Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="field-patient-mobile"
                      type="tel"
                      maxLength={10}
                      value={patientMobile}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
                        setPatientMobile(digitsOnly)
                        if (isMobileValid(digitsOnly) && formErrors.mobile) {
                          setFormErrors((prev) => ({ ...prev, mobile: '' }))
                        }
                      }}
                      placeholder="98XXXXXXXX (10 digits)"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                        formErrors.mobile && !isMobileValid(patientMobile)
                          ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                          : 'border-slate-200 bg-slate-50'
                      } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                    />
                    {formErrors.mobile && !isMobileValid(patientMobile) && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.mobile}</p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Medical Notes / Symptoms (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={patientNotes}
                      onChange={(e) => setPatientNotes(e.target.value)}
                      placeholder="Describe any symptoms or recent medical history..."
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowBookingModal(false)}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-brand-600/20 cursor-pointer"
                    >
                      Continue to Payment (Rs. {totalBookingFee})
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* STEP 2: PAYMENT GATEWAY & INVOICE CONFIRMATION */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {totalBookingFee === 0 ? 'Confirm Free Follow-Up' : 'Complete Payment'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {totalBookingFee === 0
                        ? 'Zero-cost consultation linked to verified 10-digit Appointment ID'
                        : 'Select payment gateway to issue your live queue token'}
                    </p>
                  </div>
                  {totalBookingFee > 0 && (
                    <div className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold">
                      {Math.floor(paymentCountdown / 60)}:
                      {String(paymentCountdown % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patient:</span>
                    <span className="font-bold text-slate-900">
                      {patientName} ({patientAge}y, {patientGender})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mobile:</span>
                    <span className="font-bold text-slate-900">{patientMobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date & Slot:</span>
                    <span className="font-bold text-slate-900">
                      {selectedDate} at {selectedSlotTime}
                    </span>
                  </div>
                  {activeTab === 'lab' && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Diagnostic Tests:</span>
                      <span className="font-bold text-teal-700 truncate max-w-[200px]">
                        {selectedTestList.map((t) => t.serviceName).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 text-sm font-black">
                    <span className="text-slate-800">Amount Payable:</span>
                    <span className={totalBookingFee === 0 ? 'text-emerald-700' : 'text-brand-700'}>
                      {totalBookingFee === 0 ? 'FREE (Follow-Up)' : `Rs. ${totalBookingFee}`}
                    </span>
                  </div>
                </div>

                {totalBookingFee === 0 ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5">
                      <div className="flex items-center space-x-2 text-emerald-900 font-black text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>100% Free Follow-Up Visit</span>
                      </div>
                      <p className="text-emerald-700 leading-relaxed">
                        This follow-up consultation is retained under previous Appointment ID #{retainedAppointment?.trackingCode10Digit || followupCodeInput}. No payment is charged.
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setBookingStep('details')}
                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleConfirmBookingAndPayment}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs transition-colors shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        {submitting ? 'Issuing Free Follow-Up Token...' : 'Confirm Free Follow-Up Booking'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        Choose Payment Method
                      </label>

                      {[
                        {
                          id: 'esewa',
                          title: paymentConfig?.esewa?.title || 'eSewa Mobile Wallet',
                          sub: `Merchant ID: ${paymentConfig?.esewa?.merchantCode || 'EPAYTEST'}`,
                        },
                        {
                          id: 'khalti',
                          title: paymentConfig?.khalti?.title || 'Khalti Digital Wallet',
                          sub: 'Instant Wallet / Banking Checkout',
                        },
                        {
                          id: 'fonepay',
                          title: paymentConfig?.fonepay?.title || 'Fonepay QR / Direct Banking',
                          sub: 'Nepal Interbank QR Payment',
                        },
                        {
                          id: 'bypass',
                          title: 'Instant Bypass Test Payment (Mark Paid)',
                          sub: 'Records immediate verified paid invoice in Supabase',
                        },
                        {
                          id: 'pay_at_clinic',
                          title: 'Pay at Clinic Reception Counter',
                          sub: 'Book token now and pay cash/QR at reception',
                        },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => setSelectedPaymentMethod(opt.id as any)}
                          className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                            selectedPaymentMethod === opt.id
                              ? 'bg-brand-50/70 border-brand-500 ring-2 ring-brand-500/20'
                              : 'bg-white border-slate-200 hover:border-brand-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <CreditCard className="w-4 h-4 text-brand-600 shrink-0" />
                            <div>
                              <p className="text-xs font-black text-slate-900">{opt.title}</p>
                              <p className="text-[10px] text-slate-500">{opt.sub}</p>
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              selectedPaymentMethod === opt.id
                                ? 'border-brand-600 bg-brand-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {selectedPaymentMethod === opt.id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setBookingStep('details')}
                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={submitting || paymentCountdown === 0}
                        onClick={handleConfirmBookingAndPayment}
                        className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-brand-600/20 cursor-pointer"
                      >
                        {submitting
                          ? 'Recording in Supabase...'
                          : `Confirm & Issue Token (Rs. ${totalBookingFee})`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
