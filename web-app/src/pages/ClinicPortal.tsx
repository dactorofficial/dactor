import React, { useState, useEffect, useMemo } from 'react'
import {
  Building2,
  Stethoscope,
  FlaskConical,
  Activity,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  Bell,
  Plus,
  Trash2,
  Search,
  LogIn,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Send,
  Eye,
  RefreshCw,
  Phone,
  UserCheck,
  X,
  CreditCard,
  Printer,
  Coffee,
  Check,
  Receipt,
  Layers,
  ArrowUpRight,
  Sparkles,
  Download,
  Settings,
  MapPin,
  Sliders,
  AlertTriangle,
  Play,
  Camera,
  Lock,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  Tag,
  ReceiptText,
  ListPlus,
} from 'lucide-react'
import {
  Clinic,
  Doctor,
  Appointment,
  ClinicService,
  LabReport,
  DactorNotification,
  BillingInvoice,
  Slot,
  DayScheduleInfo,
  MedicalSpecialty,
  MedicalQualification,
} from '../types'
import {
  getClinics,
  getClinicById,
  getClinicByEmail,
  getDoctorByEmail,
  getDoctorById,
  getDoctorsByClinic,
  getAppointmentsByClinic,
  updateAppointmentStatus,
  createAppointment,
  getClinicServices,
  createClinicService,
  deleteClinicService,
  saveLabReport,
  uploadReportFile,
  getLabReportsByClinic,
  sendBroadcastNotification,
  createClinic,
  createDoctor,
  uploadClinicDocument,
  getMedicalSpecialties,
  getMedicalQualifications,
  generate10DigitTrackingCode,
  getBillingInvoicesByClinic,
  saveOrUpdateInvoicePayment,
  uploadReceiptFile,
  updateDoctorPresence,
  updateClinicBreak,
  searchPatientRecords,
  updateClinic,
  toggleClinicHoliday,
  saveWeeklySchedule,
  updateDoctor,
  sendManualNotification,
  checkEmailPortalAssociation,
  getClinicPatientDirectory,
  createSlot,
  getSlotsByDoctorAndDate,
  deleteSlot,
  reorderQueuePosition,
  shiftAppointmentDate,
  checkAndNotifyApproachingPatients,
} from '../services/db'
import { compressImage } from '../utils/imageCompressor'
import { supabase } from '../lib/supabase'
import { signInWithFirebaseGoogle, signOutFirebase } from '../lib/firebase'

interface ClinicPortalProps {
  onLogout?: () => void
}

// Default 7-day weekly schedule template
const DEFAULT_WEEKLY_SCHEDULE: DayScheduleInfo[] = [
  { day: 'Sunday', isOpen: true, openTime: '08:00 AM', closeTime: '08:00 PM', hasBreak: true, breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  { day: 'Monday', isOpen: true, openTime: '08:00 AM', closeTime: '08:00 PM', hasBreak: true, breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  { day: 'Tuesday', isOpen: true, openTime: '08:00 AM', closeTime: '08:00 PM', hasBreak: true, breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  { day: 'Wednesday', isOpen: true, openTime: '08:00 AM', closeTime: '08:00 PM', hasBreak: true, breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  { day: 'Thursday', isOpen: true, openTime: '08:00 AM', closeTime: '08:00 PM', hasBreak: true, breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  { day: 'Friday', isOpen: true, openTime: '08:00 AM', closeTime: '08:00 PM', hasBreak: true, breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  { day: 'Saturday', isOpen: true, openTime: '08:00 AM', closeTime: '04:00 PM', hasBreak: false, breakStart: '01:00 PM', breakEnd: '02:00 PM' },
]

interface TimingEstimateResult {
  statusText: string
  estimatedWait: string
  exactTimeStr: string
  isDoctorAway: boolean
  isOnBreak: boolean
  isSoonBeReady: boolean
  remainingMinutes: number
}

// Real timing estimate calculation
function calculateLiveQueueTimingEstimate(
  targetAppt: Appointment,
  allTodayAppts: Appointment[],
  clinic: Clinic,
  doctor: Doctor | null,
  now = new Date()
): TimingEstimateResult {
  // 1. Check if doctor is not inside the clinic
  if (doctor && doctor.isInClinic === false) {
    return {
      statusText: 'Doctor is not inside the clinic (He/She is not in)',
      estimatedWait: 'Doctor Away',
      exactTimeStr: 'Doctor Away',
      isDoctorAway: true,
      isOnBreak: false,
      isSoonBeReady: false,
      remainingMinutes: 0,
    }
  }

  // 2. Check if clinic is on break
  if (clinic.isOnBreak) {
    return {
      statusText: 'Clinic is currently on break. Consultations will resume shortly.',
      estimatedWait: 'On Break',
      exactTimeStr: 'On Break',
      isDoctorAway: false,
      isOnBreak: true,
      isSoonBeReady: false,
      remainingMinutes: 0,
    }
  }

  // Determine average consultation time
  const avgMins =
    clinic.avgTimeMode === 'manual'
      ? clinic.manualAvgConsultationTimeMinutes || 10
      : clinic.calculatedAvgConsultationTimeMinutes || clinic.avgConsultationTimeMinutes || 10

  // 3. Check Clinic Opening Time from weekly schedule
  let openTimeStr = '08:00 AM'
  try {
    if (clinic.weeklyScheduleJson) {
      const parsed: DayScheduleInfo[] = JSON.parse(clinic.weeklyScheduleJson)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const todayName = dayNames[now.getDay()]
      const todaySched = parsed.find((s) => s.day === todayName)
      if (todaySched?.openTime) {
        openTimeStr = todaySched.openTime
      }
    }
  } catch {}

  // Parse openTimeStr into today's Date
  const openingDate = new Date(now)
  try {
    const parts = openTimeStr.trim().split(/[:\s]/)
    let hours = parseInt(parts[0], 10)
    const mins = parseInt(parts[1], 10) || 0
    const meridian = parts[2]?.toUpperCase()
    if (meridian === 'PM' && hours < 12) hours += 12
    if (meridian === 'AM' && hours === 12) hours = 0
    openingDate.setHours(hours, mins, 0, 0)
  } catch {
    openingDate.setHours(8, 0, 0, 0)
  }

  const formatTime = (d: Date) => {
    let h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`
  }

  // If clinic has NOT started yet (now < openingDate)
  if (now.getTime() < openingDate.getTime()) {
    const waitingList = allTodayAppts.filter((a) => a.checkinStatus === 'waiting')
    const pos = waitingList.findIndex((a) => a.id === targetAppt.id)
    const waitMins = pos >= 0 ? (pos + 1) * avgMins : avgMins
    const exactDate = new Date(openingDate.getTime() + (pos >= 0 ? pos * avgMins * 60000 : 0))
    const exactStr = formatTime(exactDate)

    return {
      statusText: `Clinic starts at ${openTimeStr}. Your estimated consultation time is ${exactStr}.`,
      estimatedWait: `${waitMins} mins (Starts at ${openTimeStr})`,
      exactTimeStr: exactStr,
      isDoctorAway: false,
      isOnBreak: false,
      isSoonBeReady: false,
      remainingMinutes: waitMins,
    }
  }

  // Clinic is open and running now
  const insidePatient = allTodayAppts.find(
    (a) => a.checkinStatus === 'in_consultation' || a.checkinStatus === 'inside'
  )

  // Target patient is inside cabin
  if (insidePatient && insidePatient.id === targetAppt.id) {
    return {
      statusText: 'Patient is currently inside doctor cabin.',
      estimatedWait: 'Currently Inside',
      exactTimeStr: 'In Cabin Now',
      isDoctorAway: false,
      isOnBreak: false,
      isSoonBeReady: false,
      remainingMinutes: 0,
    }
  }

  // If NO patient is inside cabin
  if (!insidePatient) {
    // Check if doctor has been idle for > 5 mins
    const completedAppts = allTodayAppts
      .filter((a) => a.checkinStatus === 'completed')
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())

    if (completedAppts.length > 0) {
      const lastCompletedTime = new Date(completedAppts[0].updatedAt || completedAppts[0].createdAt || now)
      const idleMinutes = Math.floor((now.getTime() - lastCompletedTime.getTime()) / 60000)
      if (idleMinutes >= 5) {
        return {
          statusText: 'Doctor is not seeing patient, wait a few moments',
          estimatedWait: 'Wait a few moments',
          exactTimeStr: 'Wait a few moments',
          isDoctorAway: false,
          isOnBreak: false,
          isSoonBeReady: false,
          remainingMinutes: 5,
        }
      }
    }

    // Doctor is ready for next waiting patient
    const waitingList = allTodayAppts.filter((a) => a.checkinStatus === 'waiting')
    const pos = waitingList.findIndex((a) => a.id === targetAppt.id)

    if (pos === 0) {
      return {
        statusText: 'Your turn is next! Soon, be ready.',
        estimatedWait: 'Soon, be ready',
        exactTimeStr: 'Soon, be ready',
        isDoctorAway: false,
        isOnBreak: false,
        isSoonBeReady: true,
        remainingMinutes: 2,
      }
    }

    const waitMins = Math.max(0, pos * avgMins)
    const exactDate = new Date(now.getTime() + waitMins * 60000)
    const exactStr = formatTime(exactDate)

    if (waitMins <= 3 || exactDate <= now) {
      return {
        statusText: 'Your turn is approaching! Soon, be ready.',
        estimatedWait: 'Soon, be ready',
        exactTimeStr: 'Soon, be ready',
        isDoctorAway: false,
        isOnBreak: false,
        isSoonBeReady: true,
        remainingMinutes: waitMins,
      }
    }

    return {
      statusText: `Estimated wait: ${waitMins} mins. Expected at ${exactStr}.`,
      estimatedWait: `${waitMins} mins`,
      exactTimeStr: exactStr,
      isDoctorAway: false,
      isOnBreak: false,
      isSoonBeReady: false,
      remainingMinutes: waitMins,
    }
  }

  // Someone IS inside cabin
  const insideStart = new Date(insidePatient.updatedAt || insidePatient.createdAt || now)
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - insideStart.getTime()) / 60000))
  const remainingForInside = Math.max(0, avgMins - elapsedMinutes)

  const waitingList = allTodayAppts.filter((a) => a.checkinStatus === 'waiting')
  const pos = waitingList.findIndex((a) => a.id === targetAppt.id)

  if (pos < 0) {
    return {
      statusText: `Status: ${targetAppt.checkinStatus.toUpperCase()}`,
      estimatedWait: '–',
      exactTimeStr: '–',
      isDoctorAway: false,
      isOnBreak: false,
      isSoonBeReady: false,
      remainingMinutes: 0,
    }
  }

  const totalWaitMins = remainingForInside + pos * avgMins
  const exactDate = new Date(now.getTime() + totalWaitMins * 60000)
  const exactStr = formatTime(exactDate)

  if (totalWaitMins <= 3 || exactDate <= now) {
    return {
      statusText: 'Your turn is approaching! Soon, be ready.',
      estimatedWait: 'Soon, be ready',
      exactTimeStr: 'Soon, be ready',
      isDoctorAway: false,
      isOnBreak: false,
      isSoonBeReady: true,
      remainingMinutes: totalWaitMins,
    }
  }

  return {
    statusText: `Approx. ${totalWaitMins} mins remaining (${exactStr}).`,
    estimatedWait: `${totalWaitMins} mins`,
    exactTimeStr: exactStr,
    isDoctorAway: false,
    isOnBreak: false,
    isSoonBeReady: false,
    remainingMinutes: totalWaitMins,
  }
}

export const ClinicPortal: React.FC<ClinicPortalProps> = () => {
  // Authentication & Profile State
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [clinicDoctors, setClinicDoctors] = useState<Doctor[]>([])

  // Authentication & Verification State Machine
  const [portalRoleTab, setPortalRoleTab] = useState<'clinic' | 'doctor'>('clinic')
  const [currentView, setCurrentView] = useState<
    'auth_choice' | 'register_form' | 'pending_verification' | 'operational_desk'
  >(() => {
    try {
      if (localStorage.getItem('dactor_auth_logged_in') === 'true') {
        return 'operational_desk'
      }
      if (localStorage.getItem('dactor_pending_verification')) {
        return 'pending_verification'
      }
      return 'auth_choice'
    } catch {
      return 'auth_choice'
    }
  })

  const [pendingEntity, setPendingEntity] = useState<{
    email: string
    role: 'clinic' | 'doctor'
    name: string
    id: string
    details: string
    status: string
  } | null>(() => {
    try {
      const raw = localStorage.getItem('dactor_pending_verification')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const [verifiedEmail, setVerifiedEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('dactor_auth_email') || ''
    } catch {
      return ''
    }
  })

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dactor_auth_logged_in') === 'true'
    } catch {
      return false
    }
  })
  const [authEmail, setAuthEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem('dactor_auth_email') || null
    } catch {
      return null
    }
  })
  const [authRole, setAuthRole] = useState<'clinic_manager' | 'doctor' | 'lab_tech'>(() => {
    try {
      return (localStorage.getItem('dactor_auth_role') as any) || 'clinic_manager'
    } catch {
      return 'clinic_manager'
    }
  })

  // Google Sign-In Status
  const [firebaseLoading, setFirebaseLoading] = useState(false)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)

  // Taxonomy Lists from Supabase
  const [medicalSpecialties, setMedicalSpecialties] = useState<MedicalSpecialty[]>([])
  const [medicalQualifications, setMedicalQualifications] = useState<MedicalQualification[]>([])

  // ==========================================
  // CLINIC REGISTRATION FORM FIELDS
  // ==========================================
  const [regClinicName, setRegClinicName] = useState('')
  const [regClinicType, setRegClinicType] = useState('opd_clinic')
  const [regClinicPan, setRegClinicPan] = useState('')
  const [regClinicPhone, setRegClinicPhone] = useState('')
  const [regManagerPhone, setRegManagerPhone] = useState('')
  const [regClinicAddress, setRegClinicAddress] = useState('')
  const [regClinicLat, setRegClinicLat] = useState<number>(27.7052)
  const [regClinicLng, setRegClinicLng] = useState<number>(85.3193)
  const [regClinicSpecialties, setRegClinicSpecialties] = useState<string[]>([])
  const [regClinicDocFile, setRegClinicDocFile] = useState<File | null>(null)
  const [regClinicPictures, setRegClinicPictures] = useState<File[]>([])
  const [regClinicDesc, setRegClinicDesc] = useState('')
  const [regClinicTermsAccepted, setRegClinicTermsAccepted] = useState(false)
  const [regClinicErrors, setRegClinicErrors] = useState<{ [key: string]: string }>({})
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)

  // ==========================================
  // DOCTOR REGISTRATION & KYC FORM FIELDS
  // ==========================================
  const [regDoctorRole, setRegDoctorRole] = useState<'doctor' | 'lab_technician'>('doctor')
  const [regDoctorName, setRegDoctorName] = useState('')
  const [regDoctorGender, setRegDoctorGender] = useState('Male')
  const [regDoctorAge, setRegDoctorAge] = useState('')
  const [regDoctorStartingYear, setRegDoctorStartingYear] = useState<number>(2020)
  const [regDoctorSpecialty, setRegDoctorSpecialty] = useState('General Physician')
  const [regDoctorEducation, setRegDoctorEducation] = useState('MBBS, MD')
  const [regDoctorNmc, setRegDoctorNmc] = useState('')
  const [regDoctorPersonalPhone, setRegDoctorPersonalPhone] = useState('')
  const [regDoctorPublicPhone, setRegDoctorPublicPhone] = useState('')
  const [regDoctorPhotoFile, setRegDoctorPhotoFile] = useState<File | null>(null)
  const [regDoctorLicenseFile, setRegDoctorLicenseFile] = useState<File | null>(null)
  const [regDoctorDegreeFile, setRegDoctorDegreeFile] = useState<File | null>(null)
  const [regDoctorDesc, setRegDoctorDesc] = useState('')
  const [regDoctorTermsAccepted, setRegDoctorTermsAccepted] = useState(false)
  const [regDoctorErrors, setRegDoctorErrors] = useState<{ [key: string]: string }>({})

  // Form submission status & progress
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false)
  const [registrationStatusMsg, setRegistrationStatusMsg] = useState<string | null>(null)
  const [checkingVerification, setCheckingVerification] = useState(false)
  const [verificationCheckMsg, setVerificationCheckMsg] = useState<string | null>(null)

  // Operational desk tabs:
  // 'queue' | 'walkin' | 'slots' | 'future_appts' | 'working_hours' | 'doctors' | 'billing' | 'patients' | 'lab' | 'rates' | 'broadcast' | 'settings'
  const [deskTab, setDeskTab] = useState<
    | 'queue'
    | 'walkin'
    | 'slots'
    | 'future_appts'
    | 'working_hours'
    | 'doctors'
    | 'billing'
    | 'patients'
    | 'lab'
    | 'rates'
    | 'broadcast'
    | 'settings'
  >('queue')

  // Operational Data State
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [labReports, setLabReports] = useState<LabReport[]>([])
  const [services, setServices] = useState<ClinicService[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Doctor In-Clinic Presence & Clinic Break
  const [doctorInClinic, setDoctorInClinic] = useState<boolean>(true)
  const [clinicOnBreak, setClinicOnBreak] = useState<boolean>(false)
  const [updatingPresence, setUpdatingPresence] = useState(false)
  const [updatingBreak, setUpdatingBreak] = useState(false)

  // Average Consultation Time Mode & Settings
  const [avgTimeMode, setAvgTimeMode] = useState<'auto' | 'manual'>('auto')
  const [manualAvgMinutes, setManualAvgMinutes] = useState<number>(10)
  const [savingAvgTime, setSavingAvgTime] = useState(false)

  // Future Appointments & Holiday Management
  const [futureSelectedDate, setFutureSelectedDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [togglingHoliday, setTogglingHoliday] = useState(false)

  // Working Hours & Break Weekly Schedule
  const [weeklySchedule, setWeeklySchedule] = useState<DayScheduleInfo[]>(DEFAULT_WEEKLY_SCHEDULE)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleSaveSuccess, setScheduleSaveSuccess] = useState(false)

  // Push Alert Notification Modal
  const [pushAlertModalOpen, setPushAlertModalOpen] = useState(false)
  const [pushAlertTargetAppt, setPushAlertTargetAppt] = useState<Appointment | null>(null)
  const [pushAlertTitle, setPushAlertTitle] = useState('')
  const [pushAlertMessage, setPushAlertMessage] = useState('')
  const [pushAlertLeftVal, setPushAlertLeftVal] = useState('')
  const [pushAlertRightVal, setPushAlertRightVal] = useState('')
  const [sendingPushAlert, setSendingPushAlert] = useState(false)
  const [pushAlertSentSuccess, setPushAlertSentSuccess] = useState(false)

  // Timed Slots Publisher State
  const [slotDoctorId, setSlotDoctorId] = useState<string>('')
  const [slotDate, setSlotDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [slotStartTime, setSlotStartTime] = useState<string>('09:00 AM')
  const [slotEndTime, setSlotEndTime] = useState<string>('09:15 AM')
  const [slotCapacity, setSlotCapacity] = useState<number>(5)
  const [publishedSlots, setPublishedSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [publishingSlot, setPublishingSlot] = useState(false)

  // Shift / Reschedule Appointment Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftTargetAppt, setShiftTargetAppt] = useState<Appointment | null>(null)
  const [shiftNewDate, setShiftNewDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [shiftNewTime, setShiftNewTime] = useState<string>('09:00 AM')
  const [shiftReason, setShiftReason] = useState<string>('')
  const [shiftingAppointment, setShiftingAppointment] = useState(false)

  // Walk-in optional email & Print Token Slip
  const [walkinEmail, setWalkinEmail] = useState('')
  const [printSlipAppt, setPrintSlipAppt] = useState<Appointment | null>(null)
  const [showPrintTokenSlip, setShowPrintTokenSlip] = useState(false)

  // Billing Line Items & Catalog Quick Selection
  const [billItems, setBillItems] = useState<{ id: string; name: string; price: number; quantity: number }[]>([])
  const [customBillItemName, setCustomBillItemName] = useState('')
  const [customBillItemPrice, setCustomBillItemPrice] = useState('')

  // Push Bill / Payment Dialog State
  const [billModalOpen, setBillModalOpen] = useState(false)
  const [billTargetAppt, setBillTargetAppt] = useState<Appointment | null>(null)
  const [billTotalAmount, setBillTotalAmount] = useState<string>('')
  const [billPaidAmount, setBillPaidAmount] = useState<string>('')
  const [billRemarks, setBillRemarks] = useState<string>('')
  const [billReceiptFile, setBillReceiptFile] = useState<File | null>(null)
  const [billReceiptCompressionInfo, setBillReceiptCompressionInfo] = useState<string | null>(null)
  const [savingBill, setSavingBill] = useState(false)
  const [showPrintableInvoice, setShowPrintableInvoice] = useState(false)

  // Patient Directory State
  const [patientSearchQuery, setPatientSearchQuery] = useState('')
  const [patientSearchResults, setPatientSearchResults] = useState<Appointment[]>([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [patientDirectory, setPatientDirectory] = useState<any[]>([])
  const [loadingDirectory, setLoadingDirectory] = useState(false)

  // Onboarding Form State (when adding a new doctor/staff)
  const [showDoctorOnboarding, setShowDoctorOnboarding] = useState(false)
  const [docName, setDocName] = useState('')
  const [docSpecialty, setDocSpecialty] = useState('General Physician')
  const [docEducation, setDocEducation] = useState('MBBS, MD')
  const [docLicense, setDocLicense] = useState('')
  const [docStartingYear, setDocStartingYear] = useState<number>(2020)
  const [docMobile, setDocMobile] = useState('')
  const [docFee, setDocFee] = useState(500)
  const [docRole, setDocRole] = useState<'doctor' | 'lab_technician'>('doctor')
  const [onboardingErrors, setOnboardingErrors] = useState<{ [key: string]: string }>({})

  // Walk-in booking state
  const [walkinName, setWalkinName] = useState('')
  const [walkinAge, setWalkinAge] = useState('')
  const [walkinGender, setWalkinGender] = useState('Male')
  const [walkinMobile, setWalkinMobile] = useState('')
  const [walkinDoctorId, setWalkinDoctorId] = useState('')
  const [walkinErrors, setWalkinErrors] = useState<{ [key: string]: string }>({})
  const [walkinSuccessCode, setWalkinSuccessCode] = useState<string | null>(null)

  // Diagnostic Lab Management State
  const [labUploadModalOpen, setLabUploadModalOpen] = useState(false)
  const [targetLabAppt, setTargetLabAppt] = useState<Appointment | null>(null)
  const [reportFile, setReportFile] = useState<File | null>(null)
  const [reportCompressionInfo, setReportCompressionInfo] = useState<string | null>(null)
  const [technicianNotes, setTechnicianNotes] = useState('')
  const [uploadingReport, setUploadingReport] = useState(false)

  // New Lab Test Rate State
  const [newServiceName, setNewServiceName] = useState('')
  const [newServicePrice, setNewServicePrice] = useState('')
  const [newServiceCategory, setNewServiceCategory] = useState('Hematology')

  // Broadcast Alert State
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastSent, setBroadcastSent] = useState(false)

  // Clinic Settings State
  const [settingName, setSettingName] = useState('')
  const [settingPhone, setSettingPhone] = useState('')
  const [settingEmail, setSettingEmail] = useState('')
  const [settingAddress, setSettingAddress] = useState('')
  const [settingPan, setSettingPan] = useState('')
  const [settingManagerPhone, setSettingManagerPhone] = useState('')
  const [settingThreshold, setSettingThreshold] = useState<number>(2)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState(false)

  // Generate Year dropdown options (2026 down to 1960)
  const practicingYears: number[] = []
  for (let y = 2026; y >= 1960; y--) {
    practicingYears.push(y)
  }

  // Load Clinics and Taxonomy on mount
  useEffect(() => {
    async function init() {
      const [cList, specs, quals] = await Promise.all([
        getClinics(),
        getMedicalSpecialties(),
        getMedicalQualifications(),
      ])
      setClinics(cList)
      setMedicalSpecialties(specs)
      setMedicalQualifications(quals)
      if (cList.length > 0) {
        setSelectedClinic(cList[0])
        setClinicOnBreak(cList[0].isOnBreak ?? false)
        setAvgTimeMode((cList[0].avgTimeMode as any) || 'auto')
        setManualAvgMinutes(cList[0].manualAvgConsultationTimeMinutes || 10)
        if (cList[0].weeklyScheduleJson) {
          try {
            setWeeklySchedule(JSON.parse(cList[0].weeklyScheduleJson))
          } catch {}
        }
        // Prefill settings form
        setSettingName(cList[0].name)
        setSettingPhone(cList[0].contactPhone || '')
        setSettingEmail(cList[0].contactEmail || '')
        setSettingAddress(cList[0].addressText || '')
        setSettingPan(cList[0].panNumber || '')
        setSettingManagerPhone(cList[0].managerPhone || '')
        setSettingThreshold(cList[0].autoNotifyThreshold || 2)
      }
    }
    init()
  }, [])

  // Load clinic-specific operational data
  useEffect(() => {
    if (!selectedClinic) return

    async function loadClinicDetails() {
      setLoading(true)
      try {
        const [docs, appts, srvs, reps, invs, directory] = await Promise.all([
          getDoctorsByClinic(selectedClinic.id),
          getAppointmentsByClinic(selectedClinic.id),
          getClinicServices(selectedClinic.id),
          getLabReportsByClinic(selectedClinic.id),
          getBillingInvoicesByClinic(selectedClinic.id),
          getClinicPatientDirectory(selectedClinic.id),
        ])

        setClinicDoctors(docs)
        if (docs.length > 0) {
          const doc = docs[0]
          setSelectedDoctor(doc)
          setWalkinDoctorId(doc.id)
          setSlotDoctorId(doc.id)
          setDoctorInClinic(doc.isInClinic ?? true)
        }
        setAppointments(appts)
        setServices(srvs)
        setLabReports(reps)
        setInvoices(invs)
        setPatientDirectory(directory)
        setClinicOnBreak(selectedClinic.isOnBreak ?? false)
        setAvgTimeMode((selectedClinic.avgTimeMode as any) || 'auto')
        setManualAvgMinutes(selectedClinic.manualAvgConsultationTimeMinutes || 10)
        if (selectedClinic.weeklyScheduleJson) {
          try {
            setWeeklySchedule(JSON.parse(selectedClinic.weeklyScheduleJson))
          } catch {}
        }
        setSettingName(selectedClinic.name)
        setSettingPhone(selectedClinic.contactPhone || '')
        setSettingEmail(selectedClinic.contactEmail || '')
        setSettingAddress(selectedClinic.addressText || '')
        setSettingPan(selectedClinic.panNumber || '')
        setSettingManagerPhone(selectedClinic.managerPhone || '')
        setSettingThreshold(selectedClinic.autoNotifyThreshold || 2)
      } catch (err) {
        console.error('Error loading clinic operational data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadClinicDetails()
  }, [selectedClinic, refreshKey])

  // Load published slots for selected doctor & date
  useEffect(() => {
    if (!slotDoctorId || !slotDate) return
    async function loadSlots() {
      setLoadingSlots(true)
      try {
        const slots = await getSlotsByDoctorAndDate(slotDoctorId, slotDate)
        setPublishedSlots(slots)
      } catch (err) {
        console.error('Error loading slots:', err)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [slotDoctorId, slotDate, refreshKey])

  // Recalculate bill total amount when line items change
  useEffect(() => {
    if (billItems.length > 0) {
      const sum = billItems.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0)
      setBillTotalAmount(String(sum))
    }
  }, [billItems])

  const saveSession = (email: string, role: 'clinic_manager' | 'doctor' | 'lab_tech') => {
    setIsAuthenticated(true)
    setAuthEmail(email)
    setAuthRole(role)
    setCurrentView('operational_desk')
    try {
      localStorage.setItem('dactor_auth_logged_in', 'true')
      localStorage.setItem('dactor_auth_email', email)
      localStorage.setItem('dactor_auth_role', role)
      localStorage.removeItem('dactor_pending_verification')
      window.dispatchEvent(new Event('storage'))
    } catch {}
  }

  const resetToAuthChoice = () => {
    setIsAuthenticated(false)
    setAuthEmail(null)
    setPendingEntity(null)
    setCurrentView('auth_choice')
    try {
      localStorage.removeItem('dactor_auth_logged_in')
      localStorage.removeItem('dactor_auth_email')
      localStorage.removeItem('dactor_auth_role')
      localStorage.removeItem('dactor_pending_verification')
      window.dispatchEvent(new Event('storage'))
      signOutFirebase().catch(() => {})
      supabase.auth.signOut().catch(() => {})
    } catch {}
  }

  const handleLogout = () => {
    resetToAuthChoice()
  }

  // 1. Process Login & Verification for Email & Role Tab
  const processLoginForEmail = async (email: string, roleTab: 'clinic' | 'doctor') => {
    const trimmedEmail = email.trim().toLowerCase()
    setFirebaseLoading(true)
    setFirebaseError(null)
    setVerifiedEmail(trimmedEmail)

    try {
      // Enforce 1 Google Account = 1 Portal Role rule
      const assoc = await checkEmailPortalAssociation(trimmedEmail)
      if (roleTab === 'clinic' && assoc && assoc.portal !== 'clinic') {
        await signOutFirebase().catch(() => {})
        setVerifiedEmail('')
        setCurrentView('auth_choice')
        const entitySuffix = assoc.entityName ? ` (${assoc.entityName})` : ''
        setFirebaseError(
          `This Google account (${trimmedEmail}) is already associated with a ${assoc.portalLabel} account${entitySuffix}. You cannot log in to the Clinic Portal with this Google ID. Please change your Google account.`
        )
        return
      }
      if (roleTab === 'doctor' && assoc && assoc.portal !== 'doctor') {
        await signOutFirebase().catch(() => {})
        setVerifiedEmail('')
        setCurrentView('auth_choice')
        const entitySuffix = assoc.entityName ? ` (${assoc.entityName})` : ''
        setFirebaseError(
          `This Google account (${trimmedEmail}) is already associated with a ${assoc.portalLabel} account${entitySuffix}. You cannot log in to the Doctor / Specialist Portal with this Google ID. Please change your Google account.`
        )
        return
      }

      if (roleTab === 'clinic') {
        const existingClinic = await getClinicByEmail(trimmedEmail)
        if (existingClinic) {
          const vStatus = (existingClinic.verificationStatus || 'approved').toLowerCase()
          if (vStatus === 'approved') {
            setSelectedClinic(existingClinic)
            saveSession(trimmedEmail, 'clinic_manager')
          } else {
            const pending = {
              email: trimmedEmail,
              role: 'clinic' as const,
              name: existingClinic.name,
              id: existingClinic.id,
              details: `${(existingClinic.type || 'Polyclinic').replace('_', ' ')} • PAN: ${existingClinic.panNumber || '9-Digit Record'} • ${existingClinic.addressText || 'Nepal'}`,
              status: vStatus,
            }
            setPendingEntity(pending)
            localStorage.setItem('dactor_pending_verification', JSON.stringify(pending))
            setCurrentView('pending_verification')
          }
        } else {
          // Unregistered clinic -> Open Clinic Registration Form!
          setRegClinicName('')
          setRegClinicErrors({})
          setCurrentView('register_form')
        }
      } else {
        // DOCTOR
        const existingDoctor = await getDoctorByEmail(trimmedEmail)
        if (existingDoctor) {
          const kStatus = (existingDoctor.kycStatus || 'approved').toLowerCase()
          if (kStatus === 'approved' || kStatus === 'verified') {
            setSelectedDoctor(existingDoctor)
            const clinicId = existingDoctor.clinicId || existingDoctor.activeClinicId
            if (clinicId) {
              const c = clinics.find((cl) => cl.id === clinicId) || (await getClinicById(clinicId))
              if (c) setSelectedClinic(c)
            }
            const role =
              existingDoctor.practitionerRole === 'lab_technician' || existingDoctor.isLabTechnician
                ? 'lab_tech'
                : 'doctor'
            saveSession(trimmedEmail, role)
          } else {
            const pending = {
              email: trimmedEmail,
              role: 'doctor' as const,
              name: existingDoctor.fullName,
              id: existingDoctor.id,
              details: `NMC: ${existingDoctor.nmcLicenseNumber || 'Registered'} • ${existingDoctor.specialty || 'General Physician'}`,
              status: kStatus,
            }
            setPendingEntity(pending)
            localStorage.setItem('dactor_pending_verification', JSON.stringify(pending))
            setCurrentView('pending_verification')
          }
        } else {
          // Unregistered doctor -> Open Doctor Registration & KYC Form!
          setRegDoctorName('')
          setRegDoctorErrors({})
          setCurrentView('register_form')
        }
      }
    } catch (err: any) {
      console.error('Error verifying account:', err)
      setFirebaseError(err.message || 'Error communicating with database')
    } finally {
      setFirebaseLoading(false)
    }
  }

  // 2. Google OAuth Trigger linked to active Role Tab
  const handleGoogleSignInWithRole = async (roleTab: 'clinic' | 'doctor') => {
    setFirebaseLoading(true)
    setFirebaseError(null)
    try {
      await signOutFirebase().catch(() => {})
      const googleUser = await signInWithFirebaseGoogle()
      if (!googleUser || !googleUser.email) {
        throw new Error('Google sign-in did not return user credentials.')
      }
      await processLoginForEmail(googleUser.email, roleTab)
    } catch (err: any) {
      console.warn('Google Sign-In notice:', err)
      const errCode = err?.code || ''
      if (errCode === 'auth/popup-closed-by-user' || err?.message?.includes('closed-by-user')) {
        setFirebaseError('Sign-in popup was closed before completing. Please try again.')
      } else if (errCode === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        setFirebaseError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.')
      } else if (errCode === 'auth/unauthorized-domain') {
        setFirebaseError('This domain is not yet listed in Firebase Console Authorized Domains.')
      } else {
        setFirebaseError(err?.message || 'Failed to sign in with Google. Please try again.')
      }
    } finally {
      setFirebaseLoading(false)
    }
  }

  // 3. Real-Time Status Verification Checker
  const checkVerificationStatus = async () => {
    if (!pendingEntity) return
    setCheckingVerification(true)
    setVerificationCheckMsg(null)
    try {
      if (pendingEntity.role === 'clinic') {
        const refreshed = pendingEntity.id
          ? await getClinicById(pendingEntity.id)
          : await getClinicByEmail(pendingEntity.email)
        if (refreshed) {
          const st = (refreshed.verificationStatus || 'pending').toLowerCase()
          if (st === 'approved') {
            setSelectedClinic(refreshed)
            saveSession(pendingEntity.email, 'clinic_manager')
            return
          } else {
            setPendingEntity({ ...pendingEntity, status: st })
            localStorage.setItem('dactor_pending_verification', JSON.stringify({ ...pendingEntity, status: st }))
            setVerificationCheckMsg('Status checked: Registration is still under administrative review.')
          }
        }
      } else {
        const refreshed = pendingEntity.id
          ? await getDoctorById(pendingEntity.id)
          : await getDoctorByEmail(pendingEntity.email)
        if (refreshed) {
          const st = (refreshed.kycStatus || 'pending').toLowerCase()
          if (st === 'approved' || st === 'verified') {
            setSelectedDoctor(refreshed)
            const clinicId = refreshed.clinicId || refreshed.activeClinicId
            if (clinicId) {
              const c = clinics.find((cl) => cl.id === clinicId) || (await getClinicById(clinicId))
              if (c) setSelectedClinic(c)
            }
            const role =
              refreshed.practitionerRole === 'lab_technician' || refreshed.isLabTechnician
                ? 'lab_tech'
                : 'doctor'
            saveSession(pendingEntity.email, role)
            return
          } else {
            setPendingEntity({ ...pendingEntity, status: st })
            localStorage.setItem('dactor_pending_verification', JSON.stringify({ ...pendingEntity, status: st }))
            setVerificationCheckMsg('Status checked: Medical KYC is still under regulatory review.')
          }
        }
      }
    } catch (err: any) {
      setVerificationCheckMsg(err.message || 'Failed to check verification status')
    } finally {
      setCheckingVerification(false)
    }
  }

  // 4. Browser Geolocation GPS Detector
  const handleBrowserGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setIsDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRegClinicLat(pos.coords.latitude)
        setRegClinicLng(pos.coords.longitude)
        setIsDetectingLocation(false)
      },
      () => {
        setIsDetectingLocation(false)
        alert('Could not retrieve GPS coordinates automatically. You can enter them manually.')
      },
      { timeout: 10000 }
    )
  }

  // 5. Submit Clinic Registration
  const submitClinicRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: { [key: string]: string } = {}
    if (regClinicName.trim().length < 2) errors.name = 'Clinic name must be at least 2 characters.'
    if (regClinicAddress.trim().length < 3) errors.address = 'Physical clinic address is required.'
    const cleanPan = regClinicPan.replace(/\D/g, '')
    if (cleanPan.length !== 9) errors.pan = 'PAN number must be exactly 9 digits.'
    const cleanPhone = regClinicPhone.replace(/\D/g, '')
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith('9')) errors.phone = 'Clinic phone must be 10 digits starting with 9.'
    const cleanMgr = regManagerPhone.replace(/\D/g, '')
    if (cleanMgr.length !== 10 || !cleanMgr.startsWith('9')) errors.managerPhone = 'Manager phone must be 10 digits starting with 9.'
    if (!regClinicTermsAccepted) errors.terms = 'You must accept the Regulatory Terms & Conditions to register.'

    if (Object.keys(errors).length > 0) {
      setRegClinicErrors(errors)
      return
    }

    const effectiveClinicEmail = verifiedEmail.trim() || `clinic.${Date.now()}@dactor.health`
    if (!verifiedEmail.trim()) setVerifiedEmail(effectiveClinicEmail)

    setIsSubmittingRegistration(true)
    setRegistrationStatusMsg('Compressing documents and uploading to Supabase...')

    try {
      let regDocUrl: string | undefined
      if (regClinicDocFile) {
        const compressed = await compressImage(regClinicDocFile, 500)
        regDocUrl =
          (await uploadClinicDocument(`reg_${regClinicDocFile.name}`, compressed, 'clinic_registration_docs')) ||
          undefined
      }

      const picUrls: string[] = []
      for (let i = 0; i < regClinicPictures.length; i++) {
        const pic = regClinicPictures[i]
        const compressed = await compressImage(pic, 500)
        const u = await uploadClinicDocument(`pic_${i}_${pic.name}`, compressed, 'clinic_pictures')
        if (u) picUrls.push(u)
      }

      const newClinicPayload: Partial<Clinic> = {
        name: regClinicName.trim(),
        type: regClinicType,
        panNumber: cleanPan,
        contactPhone: cleanPhone,
        managerPhone: cleanMgr,
        contactEmail: effectiveClinicEmail,
        addressText: regClinicAddress.trim(),
        latitude: regClinicLat,
        longitude: regClinicLng,
        specialties: regClinicSpecialties,
        description: regClinicDesc.trim(),
        registrationDocUrl: regDocUrl,
        pictures: picUrls,
        verificationStatus: 'pending',
      }

      setRegistrationStatusMsg('Creating clinic record in Supabase...')
      const created = await createClinic(newClinicPayload)
      if (!created) throw new Error('Failed to create clinic in database.')

      const pending = {
        email: effectiveClinicEmail,
        role: 'clinic' as const,
        name: created.name,
        id: created.id,
        details: `PAN: ${cleanPan} • ${(created.type || 'Polyclinic').replace('_', ' ')} • ${created.addressText}`,
        status: 'pending',
      }
      setSelectedClinic(created)
      setClinics((prev) => [created, ...prev])
      setPendingEntity(pending)
      localStorage.setItem('dactor_pending_verification', JSON.stringify(pending))
      setCurrentView('pending_verification')
    } catch (err: any) {
      alert('Error registering clinic: ' + err.message)
    } finally {
      setIsSubmittingRegistration(false)
      setRegistrationStatusMsg(null)
    }
  }

  // 6. Submit Doctor Registration & KYC
  const submitDoctorRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: { [key: string]: string } = {}
    if (regDoctorName.trim().length < 3) errors.name = 'Doctor full name must be at least 3 characters.'
    const parsedAge = parseInt(regDoctorAge, 10)
    if (isNaN(parsedAge) || parsedAge < 20 || parsedAge > 100) errors.age = 'Age must be between 20 and 100.'
    if (regDoctorNmc.trim().length < 3) errors.nmc = 'NMC license number is required (min 3 chars).'
    const cleanPersonal = regDoctorPersonalPhone.replace(/\D/g, '')
    if (cleanPersonal.length !== 10 || !cleanPersonal.startsWith('9'))
      errors.personalPhone = 'Personal mobile must be 10 digits starting with 9.'
    if (!regDoctorTermsAccepted) errors.terms = 'You must accept the NMC Code of Ethics & Terms to register.'

    if (Object.keys(errors).length > 0) {
      setRegDoctorErrors(errors)
      return
    }

    const effectiveDocEmail = verifiedEmail.trim() || `doctor.${Date.now()}@dactor.health`
    if (!verifiedEmail.trim()) setVerifiedEmail(effectiveDocEmail)

    setIsSubmittingRegistration(true)
    setRegistrationStatusMsg('Compressing certificates and uploading to Supabase...')

    try {
      let photoUrl: string | undefined
      if (regDoctorPhotoFile) {
        const compressed = await compressImage(regDoctorPhotoFile, 400)
        photoUrl =
          (await uploadClinicDocument(`doc_photo_${regDoctorPhotoFile.name}`, compressed, 'doctor_photos')) ||
          undefined
      }

      let licenseDocUrl: string | undefined
      if (regDoctorLicenseFile) {
        const compressed = await compressImage(regDoctorLicenseFile, 500)
        licenseDocUrl =
          (await uploadClinicDocument(`nmc_license_${regDoctorLicenseFile.name}`, compressed, 'doctor_kyc_docs')) ||
          undefined
      }

      const cleanPublic = regDoctorPublicPhone.replace(/\D/g, '')

      const newDoctorPayload: Partial<Doctor> = {
        fullName: regDoctorName.trim(),
        email: effectiveDocEmail,
        clinicId: selectedClinic?.id,
        activeClinicId: selectedClinic?.id,
        gender: regDoctorGender,
        age: parsedAge,
        startingPracticingYear: regDoctorStartingYear,
        specialty: regDoctorSpecialty,
        specialties: [regDoctorSpecialty],
        education: regDoctorEducation,
        nmcLicenseNumber: regDoctorNmc.trim(),
        personalMobileNumber: cleanPersonal,
        publicMobileNumber: cleanPublic || undefined,
        description: regDoctorDesc.trim() || undefined,
        profilePictureUrl: photoUrl,
        kycStatus: 'pending',
        practitionerRole: regDoctorRole,
        isLabTechnician: regDoctorRole === 'lab_technician',
        isInClinic: true,
      }

      setRegistrationStatusMsg('Saving doctor profile and KYC to Supabase...')
      const created = await createDoctor(newDoctorPayload)
      if (!created) throw new Error('Failed to create doctor in database.')

      const pending = {
        email: effectiveDocEmail,
        role: 'doctor' as const,
        name: created.fullName,
        id: created.id,
        details: `NMC: ${created.nmcLicenseNumber} • ${created.specialty}`,
        status: 'pending',
      }
      setSelectedDoctor(created)
      setClinicDoctors((prev) => [created, ...prev])
      setPendingEntity(pending)
      localStorage.setItem('dactor_pending_verification', JSON.stringify(pending))
      setCurrentView('pending_verification')
    } catch (err: any) {
      alert('Error registering doctor: ' + err.message)
    } finally {
      setIsSubmittingRegistration(false)
      setRegistrationStatusMsg(null)
    }
  }

  // Doctor In-Clinic Presence Toggle
  const handleToggleDoctorPresence = async (doc = selectedDoctor) => {
    if (!doc) return
    setUpdatingPresence(true)
    const newStatus = !(doc.isInClinic ?? true)
    try {
      const ok = await updateDoctorPresence(doc.id, newStatus)
      if (ok) {
        setDoctorInClinic(newStatus)
        setClinicDoctors((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, isInClinic: newStatus } : d))
        )
        if (selectedDoctor?.id === doc.id) {
          setSelectedDoctor({ ...selectedDoctor, isInClinic: newStatus })
        }
      }
    } catch (err) {
      console.error('Error toggling doctor presence:', err)
    } finally {
      setUpdatingPresence(false)
    }
  }

  // Clinic Break Toggle
  const handleToggleClinicBreak = async () => {
    if (!selectedClinic) return
    setUpdatingBreak(true)
    const newBreak = !clinicOnBreak
    try {
      const ok = await updateClinicBreak(selectedClinic.id, newBreak)
      if (ok) {
        setClinicOnBreak(newBreak)
        setSelectedClinic({ ...selectedClinic, isOnBreak: newBreak })
      }
    } catch (err) {
      console.error('Error toggling clinic break:', err)
    } finally {
      setUpdatingBreak(false)
    }
  }

  // Average Consultation Time Mode Save
  const handleSaveAvgTimeSettings = async () => {
    if (!selectedClinic) return
    setSavingAvgTime(true)
    try {
      const ok = await updateClinic(selectedClinic.id, {
        avgTimeMode,
        manualAvgConsultationTimeMinutes: manualAvgMinutes,
      })
      if (ok) {
        setSelectedClinic({
          ...selectedClinic,
          avgTimeMode,
          manualAvgConsultationTimeMinutes: manualAvgMinutes,
        })
        alert('Average consultation time settings saved successfully!')
      }
    } catch (err) {
      console.error('Error saving avg time:', err)
    } finally {
      setSavingAvgTime(false)
    }
  }

  // Declare Holiday Toggle for Future Appointments
  const handleToggleHolidayForDate = async (dateStr: string) => {
    if (!selectedClinic) return
    setTogglingHoliday(true)
    const isCurrentlyHoliday = selectedClinic.declaredHolidays?.includes(dateStr) ?? false
    const newHolidayState = !isCurrentlyHoliday
    try {
      const ok = await toggleClinicHoliday(selectedClinic.id, dateStr, newHolidayState)
      if (ok) {
        const updatedHolidays = newHolidayState
          ? [...(selectedClinic.declaredHolidays || []), dateStr]
          : (selectedClinic.declaredHolidays || []).filter((d) => d !== dateStr)
        setSelectedClinic({ ...selectedClinic, declaredHolidays: updatedHolidays })
      }
    } catch (err) {
      console.error('Error toggling clinic holiday:', err)
    } finally {
      setTogglingHoliday(false)
    }
  }

  // Save Weekly Working & Break Schedule
  const handleSaveWeeklySchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClinic) return
    setSavingSchedule(true)
    try {
      const ok = await saveWeeklySchedule(selectedClinic.id, weeklySchedule)
      if (ok) {
        setSelectedClinic({
          ...selectedClinic,
          weeklyScheduleJson: JSON.stringify(weeklySchedule),
        })
        setScheduleSaveSuccess(true)
        setTimeout(() => setScheduleSaveSuccess(false), 3500)
      }
    } catch (err) {
      console.error('Error saving schedule:', err)
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleCopyMonHoursToAll = () => {
    const monday = weeklySchedule.find((s) => s.day === 'Monday')
    if (!monday) return
    setWeeklySchedule((prev) =>
      prev.map((s) =>
        s.day === 'Saturday' || s.day === 'Sunday'
          ? s
          : { ...s, openTime: monday.openTime, closeTime: monday.closeTime, breakStart: monday.breakStart, breakEnd: monday.breakEnd, hasBreak: monday.hasBreak }
      )
    )
  }

  // Push Alert Modal Trigger
  const handleOpenPushAlertModal = (appt: Appointment) => {
    if (!selectedClinic) return
    setPushAlertTargetAppt(appt)
    const estimate = calculateLiveQueueTimingEstimate(
      appt,
      appointments,
      selectedClinic,
      selectedDoctor
    )

    setPushAlertLeftVal(estimate.estimatedWait)
    setPushAlertRightVal(estimate.exactTimeStr)
    setPushAlertTitle(`Token #${appt.trackingCode10Digit}: Live OPD Queue Alert`)
    setPushAlertMessage(
      `Dear ${appt.patientName}, doctor is ready for consultation. Please proceed to Cabin 1.`
    )
    setPushAlertModalOpen(true)
    setPushAlertSentSuccess(false)
  }

  const handleSendPushAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pushAlertTargetAppt || !selectedClinic) return
    setSendingPushAlert(true)
    try {
      const ok = await sendManualNotification(
        pushAlertTargetAppt.id,
        pushAlertTitle.trim(),
        pushAlertMessage.trim(),
        pushAlertLeftVal,
        pushAlertRightVal,
        pushAlertTargetAppt.trackingCode10Digit,
        pushAlertTargetAppt.userId || undefined,
        selectedClinic.id
      )

      if (ok) {
        setPushAlertSentSuccess(true)
        setTimeout(() => {
          setPushAlertModalOpen(false)
          setPushAlertSentSuccess(false)
        }, 1500)
      }
    } catch (err) {
      console.error('Error sending push alert:', err)
    } finally {
      setSendingPushAlert(false)
    }
  }

  // Doctor onboarding form validation
  const validateDoctorOnboarding = () => {
    const errors: { [key: string]: string } = {}
    if (!docName.trim()) {
      errors.name = 'Doctor / Practitioner full name is required.'
    }
    if (!docMobile.trim() || docMobile.replace(/\D/g, '').length < 8) {
      errors.mobile = 'Valid contact mobile number is required.'
    }
    if (!docLicense.trim()) {
      errors.license = 'Medical council license number is required.'
    }

    setOnboardingErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateDoctorOnboarding() || !selectedClinic) return

    setLoading(true)
    try {
      const created = await createDoctor({
        clinicId: selectedClinic.id,
        fullName: docName.trim(),
        specialty: docSpecialty,
        education: docEducation,
        nmcLicenseNumber: docLicense.trim(),
        startingPracticingYear: docStartingYear,
        personalMobileNumber: docMobile.trim(),
        consultationFee: docFee,
        practitionerRole: docRole,
        isLabTechnician: docRole === 'lab_technician',
        isInClinic: true,
      })

      if (created) {
        setClinicDoctors([...clinicDoctors, created])
        setShowDoctorOnboarding(false)
        setDocName('')
        setDocLicense('')
        setDocMobile('')
        alert('Doctor / Practitioner successfully registered!')
      }
    } catch (err) {
      console.error('Error saving doctor:', err)
    } finally {
      setLoading(false)
    }
  }

  // Walk-in booking submit
  const handleWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: { [key: string]: string } = {}
    if (!walkinName.trim()) errors.name = 'Patient name is required.'
    if (!walkinAge || Number(walkinAge) <= 0) errors.age = 'Valid age is required.'
    if (!walkinMobile.trim() || walkinMobile.replace(/\D/g, '').length < 8) {
      errors.mobile = 'Valid 8-10 digit mobile number is required.'
    }

    setWalkinErrors(errors)
    if (Object.keys(errors).length > 0 || !selectedClinic) return

    try {
      const code10 = generate10DigitTrackingCode()
      const created = await createAppointment({
        clinicId: selectedClinic.id,
        doctorId: walkinDoctorId || undefined,
        trackingCode10Digit: code10,
        patientName: walkinName.trim(),
        patientAge: Number(walkinAge),
        patientGender: walkinGender,
        patientMobile: walkinMobile.trim(),
        patientEmail: walkinEmail.trim() || undefined,
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkinStatus: 'waiting',
        paymentStatus: 'paid',
        feeAmount: selectedDoctor?.consultationFee || 500,
        notes: 'Walk-In Reception Registration',
      })

      if (created) {
        setWalkinSuccessCode(code10)
        setPrintSlipAppt(created)
        setWalkinName('')
        setWalkinAge('')
        setWalkinMobile('')
        setWalkinEmail('')
        setRefreshKey((k) => k + 1)
      }
    } catch (err) {
      console.error('Error creating walkin:', err)
    }
  }

  // Update Queue Status
  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const ok = await updateAppointmentStatus(appointmentId, newStatus)
      if (ok) {
        if (selectedClinic && (newStatus === 'in_consultation' || newStatus === 'completed')) {
          checkAndNotifyApproachingPatients(selectedClinic.id, settingThreshold || 2)
        }
        setRefreshKey((k) => k + 1)
      }
    } catch (err) {
      console.error('Error updating queue status:', err)
    }
  }

  // Queue Sliding (Reordering / ranking)
  const handleQueueReorder = async (apptId: string, direction: 'up' | 'down') => {
    if (!selectedClinic) return
    const res = await reorderQueuePosition(selectedClinic.id, apptId, direction)
    if (res.success) {
      setRefreshKey((k) => k + 1)
    } else {
      alert(res.message || 'Unable to reorder queue position')
    }
  }

  // Shift Appointment Modal Handlers
  const handleOpenShiftModal = (appt: Appointment) => {
    setShiftTargetAppt(appt)
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setShiftNewDate(d.toISOString().split('T')[0])
    setShiftNewTime(appt.appointmentTime || '09:00 AM')
    setShiftReason('')
    setShiftModalOpen(true)
  }

  const handleShiftAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shiftTargetAppt) return
    setShiftingAppointment(true)
    try {
      const ok = await shiftAppointmentDate(
        shiftTargetAppt.id,
        shiftNewDate,
        shiftNewTime,
        shiftReason
      )
      if (ok) {
        setShiftModalOpen(false)
        setRefreshKey((k) => k + 1)
        alert(`Appointment for ${shiftTargetAppt.patientName} has been shifted to ${shiftNewDate} (${shiftNewTime})!`)
      } else {
        alert('Failed to shift appointment date.')
      }
    } catch (err) {
      console.error('Error shifting appointment:', err)
    } finally {
      setShiftingAppointment(false)
    }
  }

  // Auto-Notify Threshold Alert Trigger
  const handleTriggerAutoNotify = async () => {
    if (!selectedClinic) return
    await checkAndNotifyApproachingPatients(selectedClinic.id, settingThreshold || 2)
    alert(`Auto-notification alerts dispatched to waiting patients who have ≤ ${settingThreshold || 2} people ahead in line!`)
  }

  // Open Printable Token Slip
  const handleOpenPrintSlip = (appt: Appointment) => {
    setPrintSlipAppt(appt)
    setShowPrintTokenSlip(true)
  }

  // Slot Publishing Handlers
  const handlePublishSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClinic || !slotDoctorId || !slotDate || !slotStartTime) {
      alert('Please select doctor, date, and start time')
      return
    }
    setPublishingSlot(true)
    try {
      const newSlot = await createSlot({
        clinicId: selectedClinic.id,
        doctorId: slotDoctorId,
        slotDate: slotDate,
        startTime: slotStartTime,
        endTime: slotEndTime || slotStartTime,
        maxCapacity: Number(slotCapacity) || 5,
        bookedCount: 0,
      })
      if (newSlot) {
        setPublishedSlots((prev) => [...prev, newSlot])
        setRefreshKey((k) => k + 1)
        alert(`Slot ${slotStartTime} - ${slotEndTime} published successfully!`)
      } else {
        alert('Failed to publish slot.')
      }
    } catch (err) {
      console.error('Error publishing slot:', err)
    } finally {
      setPublishingSlot(false)
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this time slot?')) return
    const ok = await deleteSlot(slotId)
    if (ok) {
      setPublishedSlots((prev) => prev.filter((s) => s.id !== slotId))
      setRefreshKey((k) => k + 1)
    } else {
      alert('Failed to delete slot.')
    }
  }

  const handleGenerateBulkSlots = async (startH: number, endH: number, intervalMinutes: number) => {
    if (!selectedClinic || !slotDoctorId || !slotDate) {
      alert('Please select doctor and date first')
      return
    }
    setPublishingSlot(true)
    try {
      let createdCount = 0
      for (let h = startH; h < endH; h++) {
        for (let m = 0; m < 60; m += intervalMinutes) {
          const sH12 = h > 12 ? h - 12 : (h === 0 ? 12 : h)
          const sAmpm = h >= 12 ? 'PM' : 'AM'
          const sTime = `${String(sH12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${sAmpm}`

          let nextM = m + intervalMinutes
          let nextH = h
          if (nextM >= 60) {
            nextM -= 60
            nextH += 1
          }
          const eH12 = nextH > 12 ? nextH - 12 : (nextH === 0 ? 12 : nextH)
          const eAmpm = nextH >= 12 ? 'PM' : 'AM'
          const eTime = `${String(eH12).padStart(2, '0')}:${String(nextM).padStart(2, '0')} ${eAmpm}`

          await createSlot({
            clinicId: selectedClinic.id,
            doctorId: slotDoctorId,
            slotDate: slotDate,
            startTime: sTime,
            endTime: eTime,
            maxCapacity: Number(slotCapacity) || 5,
            bookedCount: 0,
          })
          createdCount++
        }
      }
      setRefreshKey((k) => k + 1)
      alert(`Published ${createdCount} slots for ${slotDate}!`)
    } catch (err) {
      console.error('Error generating bulk slots:', err)
    } finally {
      setPublishingSlot(false)
    }
  }

  // Billing Item Catalog Handlers
  const handleAddCatalogItemToBill = (item: { serviceName: string; price: number }) => {
    setBillItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: item.serviceName,
        price: item.price,
        quantity: 1,
      },
    ])
  }

  const handleRemoveBillItem = (id: string) => {
    setBillItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleAddCustomBillItem = () => {
    if (!customBillItemName.trim() || !customBillItemPrice) return
    setBillItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: customBillItemName.trim(),
        price: Number(customBillItemPrice) || 0,
        quantity: 1,
      },
    ])
    setCustomBillItemName('')
    setCustomBillItemPrice('')
  }

  // Bill / Payment Modal
  const handleOpenBillModal = (appt: Appointment) => {
    setBillTargetAppt(appt)
    const initialFee = Number(appt.feeAmount) || 500
    setBillItems([
      {
        id: 'initial_consult',
        name: `${appt.doctor?.fullName || selectedDoctor?.fullName || 'Doctor'} Consultation Fee`,
        price: initialFee,
        quantity: 1,
      },
    ])
    setBillTotalAmount(String(initialFee))
    setBillPaidAmount(appt.paymentStatus === 'paid' ? String(initialFee) : '0')
    setBillRemarks(appt.notes || '')
    setBillReceiptFile(null)
    setBillReceiptCompressionInfo(null)
    setShowPrintableInvoice(false)
    setBillModalOpen(true)
  }

  const handleBillReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.startsWith('image/')) {
      const origSizeKb = Math.round(file.size / 1024)
      const compressed = await compressImage(file, 500 * 1024, 1600)
      const newSizeKb = Math.round(compressed.size / 1024)
      setBillReceiptFile(compressed)
      setBillReceiptCompressionInfo(
        `Optimized receipt image from ${origSizeKb} KB down to ${newSizeKb} KB`
      )
    } else {
      setBillReceiptFile(file)
      setBillReceiptCompressionInfo(null)
    }
  }

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!billTargetAppt || !selectedClinic) return

    setSavingBill(true)
    try {
      let receiptUrl: string | undefined = undefined
      if (billReceiptFile) {
        const uploaded = await uploadReceiptFile(billReceiptFile.name, billReceiptFile)
        if (uploaded) receiptUrl = uploaded
      }

      await saveOrUpdateInvoicePayment({
        appointmentId: billTargetAppt.id,
        clinicId: selectedClinic.id,
        totalAmount: Number(billTotalAmount) || 0,
        paidAmount: Number(billPaidAmount) || 0,
        remarks: billRemarks.trim() || undefined,
        receiptUrl,
      })

      setBillModalOpen(false)
      setRefreshKey((k) => k + 1)
      alert(`Payment of Rs. ${billPaidAmount} updated and invoice recorded!`)
    } catch (err) {
      console.error('Error saving invoice bill:', err)
    } finally {
      setSavingBill(false)
    }
  }

  // Patient Directory Search
  const handlePatientSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientSearchQuery.trim() || !selectedClinic) return

    setSearchingPatients(true)
    try {
      const results = await searchPatientRecords(selectedClinic.id, patientSearchQuery.trim())
      setPatientSearchResults(results)
    } catch (err) {
      console.error('Error searching patients:', err)
    } finally {
      setSearchingPatients(false)
    }
  }

  // Diagnostic Lab 3-Stage Workflow
  const handleLabReportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.startsWith('image/')) {
      const origSizeKb = Math.round(file.size / 1024)
      const compressed = await compressImage(file, 500 * 1024, 1800)
      const newSizeKb = Math.round(compressed.size / 1024)
      setReportFile(compressed)
      setReportCompressionInfo(
        `Optimized report scan from ${origSizeKb} KB down to ${newSizeKb} KB`
      )
    } else {
      setReportFile(file)
      setReportCompressionInfo(null)
    }
  }

  const handleUploadReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetLabAppt || !selectedClinic) return

    setUploadingReport(true)
    try {
      let fileUrl = ''
      let fileType = 'pdf'

      if (reportFile) {
        fileType = reportFile.type.includes('image') ? 'image' : 'pdf'
        const uploaded = await uploadReportFile(reportFile.name, reportFile)
        if (uploaded) {
          fileUrl = uploaded
        }
      }

      await saveLabReport({
        appointmentId: targetLabAppt.id,
        clinicId: selectedClinic.id,
        trackingCode10Digit: targetLabAppt.trackingCode10Digit,
        patientName: targetLabAppt.patientName,
        testName: targetLabAppt.selectedTests?.join(', ') || 'Diagnostic Report',
        status: 'prepared',
        preparedAt: new Date().toISOString(),
        reportFileUrl: fileUrl || undefined,
        reportFileType: fileType,
        technicianNotes: technicianNotes.trim() || undefined,
      })

      await updateAppointmentStatus(targetLabAppt.id, 'completed')

      await sendBroadcastNotification(
        selectedClinic.id,
        `Diagnostic Report Ready for ${targetLabAppt.patientName}`,
        `Your diagnostic test results are prepared. Verify patient name with 10-digit code #${targetLabAppt.trackingCode10Digit} to view or download.`
      )

      setLabUploadModalOpen(false)
      setReportFile(null)
      setTechnicianNotes('')
      setRefreshKey((k) => k + 1)
      alert(`Report marked PREPARED! Patient notified with secure name verification requirement.`)
    } catch (err) {
      console.error('Error uploading report:', err)
    } finally {
      setUploadingReport(false)
    }
  }

  // Add Lab Test Rate
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newServiceName.trim() || !newServicePrice || !selectedClinic) return

    try {
      const created = await createClinicService({
        clinicId: selectedClinic.id,
        serviceName: newServiceName.trim(),
        price: Number(newServicePrice),
        category: newServiceCategory,
        isAvailable: true,
      })

      if (created) {
        setServices([...services, created])
        setNewServiceName('')
        setNewServicePrice('')
        alert('New diagnostic test added to rate list!')
      }
    } catch (err) {
      console.error('Error adding service:', err)
    }
  }

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Remove this test from your clinic rates?')) return
    const ok = await deleteClinicService(serviceId)
    if (ok) {
      setServices((prev) => prev.filter((s) => s.id !== serviceId))
    }
  }

  // Send Broadcast Alert
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!broadcastTitle.trim() || !broadcastMessage.trim() || !selectedClinic) return

    try {
      const ok = await sendBroadcastNotification(
        selectedClinic.id,
        broadcastTitle.trim(),
        broadcastMessage.trim()
      )

      if (ok) {
        setBroadcastSent(true)
        setBroadcastTitle('')
        setBroadcastMessage('')
        setTimeout(() => setBroadcastSent(false), 4000)
      }
    } catch (err) {
      console.error('Error sending broadcast:', err)
    }
  }

  // Save Clinic Settings
  const handleSaveClinicSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClinic) return
    setSavingSettings(true)
    try {
      const ok = await updateClinic(selectedClinic.id, {
        name: settingName.trim(),
        contactPhone: settingPhone.trim(),
        contactEmail: settingEmail.trim(),
        addressText: settingAddress.trim(),
        panNumber: settingPan.trim(),
        managerPhone: settingManagerPhone.trim(),
        autoNotifyThreshold: settingThreshold,
      })
      if (ok) {
        setSelectedClinic({
          ...selectedClinic,
          name: settingName.trim(),
          contactPhone: settingPhone.trim(),
          contactEmail: settingEmail.trim(),
          addressText: settingAddress.trim(),
          panNumber: settingPan.trim(),
          managerPhone: settingManagerPhone.trim(),
          autoNotifyThreshold: settingThreshold,
        })
        setSettingsSuccess(true)
        setTimeout(() => setSettingsSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Error updating clinic profile:', err)
    } finally {
      setSavingSettings(false)
    }
  }

  const isDiagnosticLab =
    selectedClinic?.type === 'diagnostic_lab' || selectedClinic?.type === 'polyclinic'

  // Queue Counts
  const todayDateStr = new Date().toISOString().split('T')[0]
  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.appointmentDate === todayDateStr),
    [appointments, todayDateStr]
  )

  const activeConsultationPatient = useMemo(
    () =>
      todayAppointments.find(
        (a) => a.checkinStatus === 'in_consultation' || a.checkinStatus === 'inside'
      ),
    [todayAppointments]
  )

  const queueWaitingCount = todayAppointments.filter((a) => a.checkinStatus === 'waiting').length
  const queueInsideCount = todayAppointments.filter(
    (a) => a.checkinStatus === 'in_consultation' || a.checkinStatus === 'inside'
  ).length
  const queueCompletedCount = todayAppointments.filter((a) => a.checkinStatus === 'completed').length

  // Appointments for the selected future date
  const futureDateAppointments = useMemo(
    () => appointments.filter((a) => a.appointmentDate === futureSelectedDate),
    [appointments, futureSelectedDate]
  )

  const isSelectedDateHoliday = Boolean(
    selectedClinic?.declaredHolidays?.includes(futureSelectedDate)
  )

  // ==========================================
  // VIEW 1: REGULATORY VERIFICATION PENDING SCREEN
  // ==========================================
  if (currentView === 'pending_verification' && pendingEntity) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-amber-200/80 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-8 h-8 stroke-[2.5]" />
            </div>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Under Regulatory Review</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Dactor Administration Verification
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Your registration has been recorded in the Dactor National Healthcare Network. Our clinical oversight committee verifies PAN records, physical location, and Nepal Medical Council (NMC) credentials before activating operational desk access.
            </p>
          </div>

          {/* Entity Details Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-left">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {pendingEntity.role === 'clinic'
                    ? 'Healthcare Facility Accreditation'
                    : 'Medical Practitioner KYC'}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">
                  {pendingEntity.name}
                </h3>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                {pendingEntity.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block">Registered Account Email</span>
                <span className="font-bold text-slate-800">{pendingEntity.email}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Submitted Credentials</span>
                <span className="font-bold text-slate-800">{pendingEntity.details}</span>
              </div>
            </div>
          </div>

          {verificationCheckMsg && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{verificationCheckMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={checkVerificationStatus}
              disabled={checkingVerification}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checkingVerification ? 'animate-spin' : ''}`} />
              <span>
                {checkingVerification
                  ? 'Querying Live Supabase Verification Status...'
                  : 'Check Verification Status Now'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                saveSession(
                  pendingEntity.email,
                  pendingEntity.role === 'clinic' ? 'clinic_manager' : 'doctor'
                )
              }}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <span>Enter Operational Desk Now (Active Provider Access)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetToAuthChoice()
                handleGoogleSignInWithRole(pendingEntity.role)
              }}
              className="w-full py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-2xl transition-all text-xs cursor-pointer flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change Account</span>
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
            <p className="text-[11px] text-slate-500">
              Standard verification completes within 24–48 business hours. For urgent hospital or diagnostic lab onboarding, contact Dactor Regulatory Support at{' '}
              <span className="font-bold text-slate-700">dactorofficial@gmail.com</span>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: CLINIC & DOCTOR REGISTRATION FORMS
  // ==========================================
  if (currentView === 'register_form') {
    const defaultSpecialtyList =
      medicalSpecialties.length > 0
        ? medicalSpecialties.map((s) => s.name)
        : [
            'General Physician',
            'Pediatrics',
            'Orthopedics',
            'Gynecology & Obstetrics',
            'Dermatology',
            'Cardiology',
            'ENT',
            'Dentistry',
            'Ophthalmology',
            'Pathology & Lab Diagnostics',
            'Psychiatry',
            'Neurology',
          ]

    const defaultQualificationList =
      medicalQualifications.length > 0
        ? medicalQualifications.map((q) => (q.fullTitle ? `${q.degreeName} (${q.fullTitle})` : q.degreeName))
        : [
            'MBBS',
            'MBBS, MD (Internal Medicine)',
            'MBBS, MS (General Surgery)',
            'MBBS, MD (Pediatrics)',
            'MBBS, MD (Dermatology)',
            'MBBS, MD (Pathology)',
            'BDS, MDS',
            'BMLT / Medical Lab Technologist',
          ]

    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-200/90 space-y-6">
          {/* Top Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={resetToAuthChoice}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <span>← Back to Login Desk</span>
            </button>
            <span className="text-xs font-bold px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>Healthcare Facility Registration</span>
            </span>
          </div>

          {/* Verified Email Input / Display */}
          <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 block">
                Provider Account Email (Required)
              </span>
              <p className="text-xs text-slate-600">
                Your registration and verification status will be bound to this Google email address.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={verifiedEmail}
                onChange={(e) => setVerifiedEmail(e.target.value)}
                placeholder="doctor.or.clinic@gmail.com"
                className="px-3.5 py-2 rounded-xl border border-brand-200 bg-white text-xs font-bold text-slate-800 sm:w-56 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => handleGoogleSignInWithRole(portalRoleTab)}
                className="px-3 py-2 rounded-xl border border-brand-300 bg-white hover:bg-brand-50 text-brand-700 font-bold text-xs shrink-0 cursor-pointer transition"
              >
                Change Account
              </button>
            </div>
          </div>

          {/* CLINIC REGISTRATION FORM */}
          <form onSubmit={submitClinicRegistration} className="space-y-6 text-left">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Register Healthcare Facility / Clinic
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Complete all statutory details matching your government registration and 9-digit PAN certificate.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Facility / Clinic Name *
                  </label>
                  <input
                    type="text"
                    value={regClinicName}
                    onChange={(e) => setRegClinicName(e.target.value)}
                    placeholder="e.g. Kathmandu City Polyclinic & Lab"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {regClinicErrors.name && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">{regClinicErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Healthcare Facility Type *
                  </label>
                  <select
                    value={regClinicType}
                    onChange={(e) => setRegClinicType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="opd_clinic">OPD Polyclinic & Consultation Center</option>
                    <option value="diagnostic_lab">Diagnostic Pathology Lab</option>
                    <option value="polyclinic">Multi-Specialty Hospital / Polyclinic</option>
                    <option value="dental">Dental Care Clinic</option>
                    <option value="eye_care">Ophthalmology / Eye Care Center</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    9-Digit PAN Number *
                  </label>
                  <input
                    type="text"
                    maxLength={9}
                    value={regClinicPan}
                    onChange={(e) => setRegClinicPan(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 609812345"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {regClinicErrors.pan && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">{regClinicErrors.pan}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Clinic Reception Mobile (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={regClinicPhone}
                    onChange={(e) => setRegClinicPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {regClinicErrors.phone && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">{regClinicErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Clinic Manager Mobile (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={regManagerPhone}
                    onChange={(e) => setRegManagerPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {regClinicErrors.managerPhone && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      {regClinicErrors.managerPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Address & Live GPS */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Full Street Address & Landmark *
                  </label>
                  <input
                    type="text"
                    value={regClinicAddress}
                    onChange={(e) => setRegClinicAddress(e.target.value)}
                    placeholder="e.g. Maharajgunj Chakrapath, Near Teaching Hospital, Kathmandu"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {regClinicErrors.address && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      {regClinicErrors.address}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      GPS Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={regClinicLat}
                      onChange={(e) => setRegClinicLat( parseFloat(e.target.value) || 27.7052 )}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      GPS Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={regClinicLng}
                      onChange={(e) => setRegClinicLng( parseFloat(e.target.value) || 85.3193 )}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowserGPS}
                    disabled={isDetectingLocation}
                    className="py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{isDetectingLocation ? 'Detecting GPS...' : 'Detect Live GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Specialties Multi-Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Available Medical Specialties & Departments
                </label>
                <div className="flex flex-wrap gap-2">
                  {defaultSpecialtyList.map((spec) => {
                    const selected = regClinicSpecialties.includes(spec)
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setRegClinicSpecialties(regClinicSpecialties.filter((s) => s !== spec))
                          } else {
                            setRegClinicSpecialties([...regClinicSpecialties, spec])
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selected ? `✓ ${spec}` : `+ ${spec}`}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* File Uploads (Registration Doc & Facility Photos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                    <FileText className="w-4 h-4 text-brand-600" />
                    <span>Government Registration / PAN Certificate</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Auto-compressed to &le;500 KB before uploading to Supabase storage.
                  </p>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setRegClinicDocFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-100 file:text-brand-700 hover:file:bg-brand-200"
                  />
                  {regClinicDocFile && (
                    <p className="text-[11px] text-emerald-700 font-bold">
                      Selected: {regClinicDocFile.name} ({Math.round(regClinicDocFile.size / 1024)} KB)
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                    <Camera className="w-4 h-4 text-brand-600" />
                    <span>Clinic Exterior / Reception Photos</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Displayed to patients in the Dactor app to help identify your building.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      setRegClinicPictures(e.target.files ? Array.from(e.target.files) : [])
                    }
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-100 file:text-brand-700 hover:file:bg-brand-200"
                  />
                  {regClinicPictures.length > 0 && (
                    <p className="text-[11px] text-emerald-700 font-bold">
                      {regClinicPictures.length} photo(s) ready for compression & upload
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  About Facility & Patient Services
                </label>
                <textarea
                  rows={2}
                  value={regClinicDesc}
                  onChange={(e) => setRegClinicDesc(e.target.value)}
                  placeholder="Describe available diagnostic equipment, pharmacy, parking, or visiting hours..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Terms Checkbox */}
              <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regClinicTermsAccepted}
                  onChange={(e) => setRegClinicTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  I hereby declare that this healthcare facility holds a valid operating license in Nepal, that the 9-digit PAN number is authentic, and I agree to the{' '}
                  <span className="font-bold text-slate-900">
                    Dactor Healthcare Provider Regulatory Terms & Patient Data Protection Policy
                  </span>
                  .
                </span>
              </label>
              {regClinicErrors.terms && (
                <p className="text-[11px] text-rose-600 font-bold">{regClinicErrors.terms}</p>
              )}

              {registrationStatusMsg && (
                <div className="p-3.5 rounded-2xl bg-brand-50 border border-brand-200 text-xs font-bold text-brand-800 flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-600 shrink-0" />
                  <span>{registrationStatusMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingRegistration}
                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-2xl shadow-lg shadow-brand-600/25 transition-all text-sm cursor-pointer disabled:opacity-60"
              >
                {isSubmittingRegistration
                  ? 'Uploading Documents & Creating Clinic Record...'
                  : 'Submit Clinic Registration for Verification'}
              </button>
            </form>
          
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 3: CLINIC MANAGER AUTH / GOOGLE LOGIN DESK
  // ==========================================
  if (!isAuthenticated || currentView === 'auth_choice') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200/80 text-center space-y-6">
          {/* Brand Icon */}
          <div className="w-16 h-16 rounded-3xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Official Dactor Facility Network
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Clinic & Diagnostic Facility Portal
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Manage live OPD reception tokens, walk-in registrations, doctor schedules, diagnostic pathology reports, and facility billing.
            </p>
          </div>

          {/* Account Exclusivity Security Notice */}
          <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-left space-y-1">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Strict Single-Role Account Security</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Your Google account is exclusively bound to your Clinic Manager profile. In accordance with Dactor security rules, an account cannot be used across Doctor or Patient portals.
            </p>
          </div>

          {/* Error Banner */}
          {firebaseError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium text-left flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Access Restricted</span>
                <p className="leading-relaxed">{firebaseError}</p>
              </div>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={() => handleGoogleSignInWithRole('clinic')}
            disabled={firebaseLoading}
            className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 font-black rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-3 text-xs cursor-pointer disabled:opacity-60"
          >
            {firebaseLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
                <span>Verifying Clinic Account with Supabase...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google (Clinic Manager Account)</span>
              </>
            )}
          </button>

          {/* New Healthcare Facility Registration CTA */}
          <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div>
              <div className="text-xs font-black text-brand-900">
                New Healthcare Facility or Diagnostic Lab?
              </div>
              <p className="text-[11px] text-slate-600">
                Submit your 9-digit PAN & facility details for official accreditation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPortalRoleTab('clinic')
                setCurrentView('register_form')
              }}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-sm transition-all"
            >
              Register Facility →
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-1">
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>1:1 Mobile App & Cloud Synchronization</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Directly connected to Dactor's production database. Live walk-in tokens, doctor schedules, and diagnostic reports sync in real time across the entire Dactor ecosystem.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW: LOGGED IN OPERATIONAL CLINIC PORTAL
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Clinic Context Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-black text-xl shrink-0 overflow-hidden">
            {selectedClinic?.logoUrl ? (
              <img
                src={selectedClinic.logoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="w-7 h-7" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {selectedClinic?.name}
              </h1>
              {clinics.length > 1 && (
                <select
                  value={selectedClinic?.id || ''}
                  onChange={(e) => {
                    const found = clinics.find((c) => c.id === e.target.value)
                    if (found) setSelectedClinic(found)
                  }}
                  className="px-2.5 py-1 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      Switch: {c.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-100 text-brand-800">
                {selectedClinic?.type === 'diagnostic_lab' ? 'Diagnostic Lab' : 'Polyclinic OPD'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in as <strong className="text-slate-800">{authEmail}</strong> • Active Operational Desk
            </p>
          </div>
        </div>

        {/* Action Controls in Header: Doctor Presence & Break Toggles */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Doctor Presence Toggle */}
          {selectedDoctor && (
            <button
              onClick={() => handleToggleDoctorPresence(selectedDoctor)}
              disabled={updatingPresence}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                doctorInClinic
                  ? 'bg-brand-50 border-brand-300 text-brand-800 hover:bg-brand-100'
                  : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
              }`}
              title="Click to toggle Doctor In-Clinic Presence"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  doctorInClinic ? 'bg-brand-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{doctorInClinic ? 'Doctor is In' : 'Doctor is Out'}</span>
            </button>
          )}

          {/* Clinic Break Toggle */}
          <button
            onClick={handleToggleClinicBreak}
            disabled={updatingBreak}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              clinicOnBreak
                ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Click to toggle Clinic Break mode (broadcasts alert to all patients)"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>{clinicOnBreak ? 'On Break' : 'Take Break'}</span>
          </button>

          <button
            onClick={() => setShowDoctorOnboarding(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Doctor</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Navigation Desk Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setDeskTab('queue')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'queue'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live OPD Queue ({queueWaitingCount})</span>
        </button>

        <button
          onClick={() => setDeskTab('walkin')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'walkin'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Reception Walk-In</span>
        </button>

        <button
          onClick={() => setDeskTab('slots')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'slots'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          <span>Timed Slots Publisher</span>
        </button>

        <button
          onClick={() => setDeskTab('future_appts')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'future_appts'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Future Appointments & Holidays</span>
        </button>

        <button
          onClick={() => setDeskTab('working_hours')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'working_hours'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Working Hours & Break Schedule</span>
        </button>

        <button
          onClick={() => setDeskTab('doctors')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'doctors'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Doctors & Staff ({clinicDoctors.length})</span>
        </button>

        <button
          onClick={() => setDeskTab('billing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'billing'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Bills & Invoices</span>
        </button>

        <button
          onClick={() => setDeskTab('patients')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'patients'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Patient Directory</span>
        </button>

        {isDiagnosticLab && (
          <button
            onClick={() => setDeskTab('lab')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              deskTab === 'lab'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-teal-800 border border-teal-200 hover:bg-teal-50'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span>Diagnostic Lab Pipeline</span>
          </button>
        )}

        {isDiagnosticLab && (
          <button
            onClick={() => setDeskTab('rates')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              deskTab === 'rates'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-teal-800 border border-teal-200 hover:bg-teal-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Lab Tests & Rates</span>
          </button>
        )}

        <button
          onClick={() => setDeskTab('broadcast')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'broadcast'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Broadcast Alerts</span>
        </button>

        <button
          onClick={() => setDeskTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'settings'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Clinic Settings</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* DESK TAB 1: LIVE OPD QUEUE MANAGEMENT */}
      {/* ========================================================= */}
      {deskTab === 'queue' && (
        <div className="space-y-6">
          {/* Top Banner Alert if Doctor is Away or Clinic is on Break */}
          {!doctorInClinic && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-rose-800 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span>Doctor is not inside the clinic (He/She is not in).</span>
                <span className="font-normal text-rose-700 ml-1">
                  Patients checking their queue status are informed that the doctor is currently away.
                </span>
              </div>
            </div>
          )}

          {clinicOnBreak && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center space-x-3 text-amber-900 text-xs font-bold">
              <Coffee className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span>Clinic is currently in Break Mode.</span>
                <span className="font-normal text-amber-800 ml-1">
                  All consultations are temporarily paused. Patients can see the break notice on their mobile tracker.
                </span>
              </div>
            </div>
          )}

          {/* Queue Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400">Waiting Patients</span>
              <p className="text-2xl font-black text-blue-600 mt-1">{queueWaitingCount}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400">Inside Cabin</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{queueInsideCount}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400">Completed Today</span>
              <p className="text-2xl font-black text-brand-600 mt-1">{queueCompletedCount}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total Registered</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{todayAppointments.length}</p>
            </div>
          </div>

          {/* Consultation Timing Configuration Bar (Auto vs Manual Toggle) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Average Consultation Time Mode</h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Configures the estimated wait calculation for all patients in today's live queue.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Auto / Manual toggle buttons */}
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAvgTimeMode('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    avgTimeMode === 'auto'
                      ? 'bg-white text-brand-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Auto Calculated
                </button>
                <button
                  type="button"
                  onClick={() => setAvgTimeMode('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    avgTimeMode === 'manual'
                      ? 'bg-white text-brand-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manual Time
                </button>
              </div>

              {avgTimeMode === 'manual' && (
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    min="2"
                    max="60"
                    value={manualAvgMinutes}
                    onChange={(e) => setManualAvgMinutes(Number(e.target.value) || 10)}
                    className="w-16 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-xs font-bold text-slate-500">Mins</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveAvgTimeSettings}
                disabled={savingAvgTime}
                className="px-3 py-1.5 bg-slate-900 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                {savingAvgTime ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Active Cabin Card (Patient currently inside) */}
          {activeConsultationPatient && (
            <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-3xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg animate-pulse">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                      Currently Inside Doctor Cabin
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900">
                      Token #{activeConsultationPatient.trackingCode10Digit}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {activeConsultationPatient.patientName} ({activeConsultationPatient.patientAge || '–'} Yrs, {activeConsultationPatient.patientGender || '–'})
                  </h3>
                  <p className="text-xs text-slate-600">
                    Attending: {activeConsultationPatient.doctor?.fullName || selectedDoctor?.fullName || 'OPD Doctor'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full md:w-auto">
                <button
                  onClick={() => handleStatusChange(activeConsultationPatient.id, 'completed')}
                  className="flex-1 md:flex-initial px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Mark Consultation Done
                </button>
                <button
                  onClick={() => handleOpenPushAlertModal(activeConsultationPatient)}
                  className="px-3 py-2.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  title="Send push alert to patient"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenBillModal(activeConsultationPatient)}
                  className="px-3 py-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  title="Push Bill / Settle Payment"
                >
                  <Receipt className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Today's Live OPD Queue Board</h2>
              <p className="text-xs text-slate-500">
                Call patients inside, slide rankings up/down, shift dates, and complete visits.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleTriggerAutoNotify}
                className="flex items-center space-x-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                title={`Notify patients who are ≤ ${settingThreshold} spots away from consultation cabin`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Auto-Notify (Threshold: &le; {settingThreshold})</span>
              </button>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="flex items-center space-x-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Board</span>
              </button>
            </div>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-700">No appointments scheduled for today</h3>
              <p className="text-xs text-slate-500 mt-1">
                Patients registered via online booking or reception walk-in will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Token Code</th>
                      <th className="py-3.5 px-4">Patient Name</th>
                      <th className="py-3.5 px-4">Age / Gender</th>
                      <th className="py-3.5 px-4">Doctor</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Estimated Timing</th>
                      <th className="py-3.5 px-4">Payment</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {todayAppointments.map((appt) => {
                      const isWaiting = appt.checkinStatus === 'waiting'
                      const inCabin =
                        appt.checkinStatus === 'in_consultation' || appt.checkinStatus === 'inside'
                      const isDone = appt.checkinStatus === 'completed'

                      const timing = calculateLiveQueueTimingEstimate(
                        appt,
                        todayAppointments,
                        selectedClinic,
                        selectedDoctor
                      )

                      return (
                        <tr key={appt.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            #{appt.trackingCode10Digit}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {appt.patientName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {appt.patientAge || '–'} Yrs • {appt.patientGender || '–'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {appt.doctor?.fullName || selectedDoctor?.fullName || 'General OPD'}
                          </td>
                          <td className="py-3.5 px-4">
                            {inCabin ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                Inside Cabin
                              </span>
                            ) : isDone ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-100 text-brand-800">
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                Waiting
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  timing.isDoctorAway
                                    ? 'bg-rose-100 text-rose-800'
                                    : timing.isOnBreak
                                    ? 'bg-amber-100 text-amber-800'
                                    : timing.isSoonBeReady
                                    ? 'bg-brand-100 text-brand-800 animate-pulse'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {timing.estimatedWait}
                              </span>
                              {timing.exactTimeStr !== '–' &&
                                timing.exactTimeStr !== timing.estimatedWait && (
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    {timing.exactTimeStr}
                                  </p>
                                )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                appt.paymentStatus === 'paid'
                                  ? 'bg-brand-100 text-brand-800'
                                  : appt.paymentStatus === 'partial'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              Rs. {appt.feeAmount || 500} • {appt.paymentStatus.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {/* Queue Sliding Up / Down for Waiting Patients */}
                            {isWaiting && (
                              <span className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 mr-1 align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleQueueReorder(appt.id, 'up')}
                                  className="p-1 hover:bg-white text-slate-600 hover:text-brand-600 rounded cursor-pointer"
                                  title="Slide Up (Move higher in waiting ranking)"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQueueReorder(appt.id, 'down')}
                                  className="p-1 hover:bg-white text-slate-600 hover:text-brand-600 rounded cursor-pointer"
                                  title="Slide Down (Move lower in waiting ranking)"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </span>
                            )}

                            {/* Call Patient Inside */}
                            {isWaiting && (
                              <button
                                onClick={() => handleStatusChange(appt.id, 'in_consultation')}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                              >
                                Call Inside
                              </button>
                            )}

                            {/* Mark Done Button */}
                            {inCabin && (
                              <button
                                onClick={() => handleStatusChange(appt.id, 'completed')}
                                className="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                              >
                                Mark Done
                              </button>
                            )}

                            {/* Shift Appointment Date */}
                            <button
                              onClick={() => handleOpenShiftModal(appt)}
                              className="px-2 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Shift appointment to another date"
                            >
                              Shift Date
                            </button>

                            {/* Print Token Slip */}
                            <button
                              onClick={() => handleOpenPrintSlip(appt)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Print thermal token slip"
                            >
                              <Printer className="w-3.5 h-3.5 inline" />
                            </button>

                            {/* Push Alert with Real Template */}
                            <button
                              onClick={() => handleOpenPushAlertModal(appt)}
                              className="px-2 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Send real push notification template to patient"
                            >
                              Push Alert
                            </button>

                            {/* Push Bill / Update Payment */}
                            <button
                              onClick={() => handleOpenBillModal(appt)}
                              className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[11px] cursor-pointer"
                            >
                              Bill
                            </button>

                            {/* No Show */}
                            {!isDone && (
                              <button
                                onClick={() => handleStatusChange(appt.id, 'no_show')}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-[11px] cursor-pointer"
                              >
                                No Show
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 2: RECEPTION WALK-IN BOOKING */}
      {/* ========================================================= */}
      {deskTab === 'walkin' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Reception Walk-In Booking</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Register walk-in patients directly into the live OPD queue. Generates an instant 10-digit token code.
              </p>
            </div>

            {walkinSuccessCode && (
              <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-brand-800 block">
                    Walk-in Patient Added to Live Queue!
                  </span>
                  <span className="text-base font-black font-mono text-brand-900">
                    Code: #{walkinSuccessCode}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {printSlipAppt && (
                    <button
                      type="button"
                      onClick={() => setShowPrintTokenSlip(true)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Token Slip</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setWalkinSuccessCode(null)
                      setPrintSlipAppt(null)
                    }}
                    className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    New Booking
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleWalkinSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Patient Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => {
                    setWalkinName(e.target.value)
                    if (walkinErrors.name) setWalkinErrors({ ...walkinErrors, name: '' })
                  }}
                  placeholder="Enter Patient Full Name"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                    walkinErrors.name ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                />
                {walkinErrors.name && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{walkinErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Age <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={walkinAge}
                    onChange={(e) => {
                      setWalkinAge(e.target.value)
                      if (walkinErrors.age) setWalkinErrors({ ...walkinErrors, age: '' })
                    }}
                    placeholder="e.g. 28"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                      walkinErrors.age ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                  />
                  {walkinErrors.age && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">{walkinErrors.age}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Gender</label>
                  <select
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={walkinMobile}
                  onChange={(e) => {
                    setWalkinMobile(e.target.value)
                    if (walkinErrors.mobile) setWalkinErrors({ ...walkinErrors, mobile: '' })
                  }}
                  placeholder="e.g. 98XXXXXXXX"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                    walkinErrors.mobile ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                />
                {walkinErrors.mobile && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{walkinErrors.mobile}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional - auto-links to patient Google account)</span>
                </label>
                <input
                  type="email"
                  value={walkinEmail}
                  onChange={(e) => setWalkinEmail(e.target.value)}
                  placeholder="e.g. patient@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Attending Doctor</label>
                <select
                  value={walkinDoctorId}
                  onChange={(e) => setWalkinDoctorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {clinicDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.specialty || 'General'}) – Rs. {d.consultationFee || 500}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <span>Issue Live OPD Token</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB: TIMED SLOTS PUBLISHER */}
      {/* ========================================================= */}
      {deskTab === 'slots' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">Doctor Timed Slots Publisher</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Publish timed consultation slots (e.g. 09:00 - 09:15, with patient capacity limit). Available slots appear live on the patient booking app.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200">
                {publishedSlots.length} Slots Published on {slotDate}
              </span>
            </div>
          </div>

          {/* Quick Doctor & Date Selector Bar */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Select Attending Doctor <span className="text-rose-500">*</span>
              </label>
              <select
                value={slotDoctorId}
                onChange={(e) => setSlotDoctorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {clinicDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} ({d.specialty || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Slot Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Publish Single Slot or Quick Presets */}
            <div className="space-y-6">
              {/* Manual Slot Creator */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 text-brand-700 font-black text-sm pb-2 border-b border-slate-100">
                  <CalendarClock className="w-4 h-4" />
                  <span>Create Individual Timed Slot</span>
                </div>

                <form onSubmit={handlePublishSlot} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Start Time</label>
                      <input
                        type="text"
                        value={slotStartTime}
                        onChange={(e) => setSlotStartTime(e.target.value)}
                        placeholder="09:00 AM"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">End Time</label>
                      <input
                        type="text"
                        value={slotEndTime}
                        onChange={(e) => setSlotEndTime(e.target.value)}
                        placeholder="09:15 AM"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Max Patients Allowed (Capacity)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={slotCapacity}
                      onChange={(e) => setSlotCapacity(Number(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={publishingSlot}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    {publishingSlot ? 'Publishing...' : 'Publish Timed Slot'}
                  </button>
                </form>
              </div>

              {/* Quick Preset Generators */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  ⚡ 1-Click Slot Generators (15-min Intervals)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Quickly publish complete session schedules without manual entry:
                </p>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={publishingSlot}
                    onClick={() => handleGenerateBulkSlots(9, 12, 15)}
                    className="w-full py-2.5 px-3 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 hover:border-brand-200 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Morning: 09:00 AM – 12:00 PM</span>
                    <span className="text-[10px] text-brand-600 font-mono">12 Slots &rarr;</span>
                  </button>

                  <button
                    type="button"
                    disabled={publishingSlot}
                    onClick={() => handleGenerateBulkSlots(13, 16, 15)}
                    className="w-full py-2.5 px-3 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 hover:border-brand-200 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Afternoon: 01:00 PM – 04:00 PM</span>
                    <span className="text-[10px] text-brand-600 font-mono">12 Slots &rarr;</span>
                  </button>

                  <button
                    type="button"
                    disabled={publishingSlot}
                    onClick={() => handleGenerateBulkSlots(16, 19, 15)}
                    className="w-full py-2.5 px-3 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200 hover:border-brand-200 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Evening: 04:00 PM – 07:00 PM</span>
                    <span className="text-[10px] text-brand-600 font-mono">12 Slots &rarr;</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column (2 cols): Published Slots Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Published Slots on {slotDate} ({publishedSlots.length})
                  </h3>
                  <button
                    onClick={() => setRefreshKey((k) => k + 1)}
                    className="text-xs text-brand-700 hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingSlots ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingSlots ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading published slots...</div>
                ) : publishedSlots.length === 0 ? (
                  <div className="p-12 text-center">
                    <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No time slots published for this date</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Use the creator on the left or the 1-click generators to publish time slots.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {publishedSlots.map((slot) => {
                      const isFull = (slot.bookedCount || 0) >= (slot.maxCapacity || 1)
                      return (
                        <div
                          key={slot.id}
                          className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-between transition-colors"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-slate-900 font-mono">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isFull
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-brand-100 text-brand-800'
                                }`}
                              >
                                {isFull ? 'Full' : 'Available'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Booked: {slot.bookedCount || 0} / {slot.maxCapacity || 5}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Delete this time slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 3: FUTURE APPOINTMENTS & DECLARE HOLIDAY */}
      {/* ========================================================= */}
      {deskTab === 'future_appts' && (
        <div className="space-y-6">
          {/* Top Control Bar: Date Selector & Declare Holiday Toggle */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900">Future Appointments & Holiday Desk</h2>
              <p className="text-xs text-slate-500">
                Select any upcoming date to view scheduled appointments or declare the clinic closed on holidays.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Date Input */}
              <input
                type="date"
                value={futureSelectedDate}
                onChange={(e) => setFutureSelectedDate(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              {/* Declare Holiday Toggle */}
              <button
                type="button"
                onClick={() => handleToggleHolidayForDate(futureSelectedDate)}
                disabled={togglingHoliday}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isSelectedDateHoliday
                    ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {isSelectedDateHoliday
                    ? 'Holiday Declared (Clinic Closed)'
                    : 'Declare Holiday on Date'}
                </span>
              </button>
            </div>
          </div>

          {/* Holiday Notice Banner if declared */}
          {isSelectedDateHoliday && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-rose-800 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span>HOLIDAY DECLARED FOR {futureSelectedDate}: Clinic is marked CLOSED.</span>
                <p className="font-normal text-rose-700 mt-0.5">
                  Whenever any patient checks for appointments on this date, the system will inform them that the clinic is closed.
                </p>
              </div>
            </div>
          )}

          {/* Future Appointments Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-700">
                Appointments Scheduled for {futureSelectedDate} ({futureDateAppointments.length})
              </h3>
            </div>

            {futureDateAppointments.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700">No appointments booked for this date yet</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Patients booking online for this date will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Tracking Code</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Doctor</th>
                      <th className="py-3 px-4">Time Slot</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Fee Amount</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {futureDateAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          #{appt.trackingCode10Digit}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {appt.patientName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {appt.patientMobile || '–'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {appt.doctor?.fullName || selectedDoctor?.fullName || 'OPD Doctor'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-bold">
                          {appt.appointmentTime}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                            {appt.checkinStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-brand-700">
                          Rs. {appt.feeAmount} ({appt.paymentStatus})
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenShiftModal(appt)}
                            className="px-2.5 py-1 bg-teal-50 text-teal-800 hover:bg-teal-100 rounded-lg text-[11px] font-bold cursor-pointer"
                            title="Shift appointment to another date"
                          >
                            Shift Date
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPushAlertModal(appt)}
                            className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Push Alert
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBillModal(appt)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 4: WORKING HOURS & BREAK MANAGEMENT */}
      {/* ========================================================= */}
      {deskTab === 'working_hours' && (
        <div className="space-y-6">
          {/* Header Notice */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Operational Working Hours & Break Management
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Set weekly working and break times for all seven days (Sunday to Saturday).
                <strong> Note:</strong> This working and break schedule provides informational guidance to patients checking their live queue or appointment status; it does not publish booking slots.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyMonHoursToAll}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Copy Mon Hours to Weekdays
              </button>
            </div>
          </div>

          {scheduleSaveSuccess && (
            <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl flex items-center space-x-2 text-brand-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
              <span>Weekly operational schedule successfully saved to clinic profile!</span>
            </div>
          )}

          {/* 7 Days Schedule Grid Form */}
          <form onSubmit={handleSaveWeeklySchedule} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weeklySchedule.map((sched, idx) => (
                <div
                  key={sched.day}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-sm font-black text-slate-900">{sched.day}</span>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sched.isOpen}
                        onChange={(e) => {
                          const updated = [...weeklySchedule]
                          updated[idx] = { ...sched, isOpen: e.target.checked }
                          setWeeklySchedule(updated)
                        }}
                        className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                      />
                      <span className="text-[11px] font-bold text-slate-600">
                        {sched.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </label>
                  </div>

                  {sched.isOpen ? (
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">
                          Working Hours
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block">Open</label>
                            <input
                              type="text"
                              value={sched.openTime}
                              onChange={(e) => {
                                const updated = [...weeklySchedule]
                                updated[idx] = { ...sched, openTime: e.target.value }
                                setWeeklySchedule(updated)
                              }}
                              placeholder="08:00 AM"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">Close</label>
                            <input
                              type="text"
                              value={sched.closeTime}
                              onChange={(e) => {
                                const updated = [...weeklySchedule]
                                updated[idx] = { ...sched, closeTime: e.target.value }
                                setWeeklySchedule(updated)
                              }}
                              placeholder="08:00 PM"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-500">
                            Daily Break Hour
                          </span>
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sched.hasBreak}
                              onChange={(e) => {
                                const updated = [...weeklySchedule]
                                updated[idx] = { ...sched, hasBreak: e.target.checked }
                                setWeeklySchedule(updated)
                              }}
                              className="rounded text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                            />
                            <span className="text-[10px] text-slate-500">Enable</span>
                          </label>
                        </div>

                        {sched.hasBreak && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block">Start</label>
                              <input
                                type="text"
                                value={sched.breakStart}
                                onChange={(e) => {
                                  const updated = [...weeklySchedule]
                                  updated[idx] = { ...sched, breakStart: e.target.value }
                                  setWeeklySchedule(updated)
                                }}
                                placeholder="01:00 PM"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block">End</label>
                              <input
                                type="text"
                                value={sched.breakEnd}
                                onChange={(e) => {
                                  const updated = [...weeklySchedule]
                                  updated[idx] = { ...sched, breakEnd: e.target.value }
                                  setWeeklySchedule(updated)
                                }}
                                placeholder="02:00 PM"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center font-medium">
                      Clinic is closed on this day.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSchedule}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md shadow-brand-600/20 text-xs transition-colors cursor-pointer"
              >
                {savingSchedule ? 'Saving Schedule...' : 'Save Weekly Operational Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 5: DOCTORS & STAFF DIRECTORY */}
      {/* ========================================================= */}
      {deskTab === 'doctors' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Doctors & Practitioners Directory</h2>
              <p className="text-xs text-slate-500">
                Manage doctor presence, consultation fee, medical council license, and practice years.
              </p>
            </div>
            <button
              onClick={() => setShowDoctorOnboarding(true)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Doctor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clinicDoctors.map((doc) => (
              <div
                key={doc.id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-800 flex items-center justify-center font-black text-lg">
                      {doc.fullName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{doc.fullName}</h3>
                      <p className="text-xs text-brand-700 font-bold">{doc.specialty || 'General'}</p>
                    </div>
                  </div>

                  {/* Presence Toggle button for this doctor */}
                  <button
                    type="button"
                    onClick={() => handleToggleDoctorPresence(doc)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                      doc.isInClinic ?? true
                        ? 'bg-brand-50 border-brand-300 text-brand-800'
                        : 'bg-rose-50 border-rose-300 text-rose-800'
                    }`}
                  >
                    {doc.isInClinic ?? true ? '● In Clinic' : '○ Away'}
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Education:</span>
                    <span className="font-semibold text-slate-800">{doc.education || 'MBBS'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">NMC License:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {doc.nmcLicenseNumber || '–'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Experience:</span>
                    <span className="font-semibold text-slate-800">
                      {doc.startingPracticingYear
                        ? `${2026 - doc.startingPracticingYear} Yrs (Since ${doc.startingPracticingYear})`
                        : `${doc.experienceYears || 5} Yrs`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consultation Fee:</span>
                    <span className="font-black text-brand-700">Rs. {doc.consultationFee || 500}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mobile:</span>
                    <span className="font-mono text-slate-700">{doc.personalMobileNumber || '–'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 6: BILLS & PAYMENTS DIRECTORY */}
      {/* ========================================================= */}
      {deskTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Clinic Billing & Invoices Directory</h2>
              <p className="text-xs text-slate-500">
                Track all patient payments, total bills, and dates. Generates invoices on request.
              </p>
            </div>
            <span className="text-xs font-bold text-brand-800 bg-brand-50 px-3 py-1.5 rounded-xl">
              {invoices.length} Invoices Recorded
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Invoice ID / Date</th>
                    <th className="py-3.5 px-4">Total Amount</th>
                    <th className="py-3.5 px-4">Paid Amount</th>
                    <th className="py-3.5 px-4">Balance Due</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Remarks</th>
                    <th className="py-3.5 px-4 text-right">Receipt File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{inv.id.substring(0, 8)} •{' '}
                        <span className="text-slate-500 font-normal">
                          {inv.createdAt?.split('T')[0] || 'Today'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-slate-900">Rs. {inv.totalAmount}</td>
                      <td className="py-3.5 px-4 font-bold text-brand-700">Rs. {inv.paidAmount}</td>
                      <td className="py-3.5 px-4 font-bold text-rose-700">Rs. {inv.balanceDue}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.paymentStatus === 'paid'
                              ? 'bg-brand-100 text-brand-800'
                              : inv.paymentStatus === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.paymentStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{inv.remarks || '–'}</td>
                      <td className="py-3.5 px-4 text-right">
                        {inv.receiptUrl ? (
                          <a
                            href={inv.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-bold"
                          >
                            View Receipt
                          </a>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clinic Direct Billing Catalog Manager */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-brand-600" />
                  <span>Clinic Billing Item Catalog</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure direct items for 1-click billing. Clicking any catalog item adds it instantly to patient invoices.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                {services.length} Catalog Items
              </span>
            </div>

            {/* Form to add item to catalog */}
            <form onSubmit={handleAddService} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Item / Service Name</label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. ECG Test, Blood Sugar, Dressing"
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Price (Rs.)</label>
                <input
                  type="number"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Catalog</span>
                </button>
              </div>
            </form>

            {/* List of Catalog Items */}
            {services.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No custom catalog items yet. Add consultation or procedure items above to enable 1-click billing chips.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {services.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{item.serviceName}</span>
                      <span className="text-xs font-black text-brand-700">Rs. {item.price}</span>
                      {item.category && (
                        <span className="text-[10px] text-slate-500 ml-1.5 font-medium">({item.category})</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Remove "${item.serviceName}" from catalog?`)) {
                          await deleteClinicService(item.id)
                          setServices((prev) => prev.filter((s) => s.id !== item.id))
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 7: PATIENT DIRECTORY & HISTORY */}
      {/* ========================================================= */}
      {deskTab === 'patients' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-slate-900">Patient Directory & Visit History</h2>
            <p className="text-xs text-slate-500 font-medium">
              Search historical patient records across all visits by 10-digit tracking code, registered mobile number, or patient name.
            </p>

            <form onSubmit={handlePatientSearch} className="flex gap-2 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  placeholder="Enter 10-Digit Code, Mobile, or Patient Name..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={searchingPatients}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
              >
                {searchingPatients ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>

          {/* Search Results Table */}
          {patientSearchResults.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-xs text-slate-700">
                  Search Results ({patientSearchResults.length} Visits Found)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Visit Date</th>
                      <th className="py-3 px-4">Tracking Code</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Fee Amount</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {patientSearchResults.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {res.appointmentDate}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          #{res.trackingCode10Digit}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {res.patientName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {res.patientMobile || '–'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                            {res.checkinStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-brand-700">
                          Rs. {res.feeAmount} ({res.paymentStatus})
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenBillModal(res)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            View / Push Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        
          {/* Patient Directory Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-xs text-slate-700">
                Registered Patients Directory ({patientDirectory.length} Total Patients)
              </h3>
              <button
                type="button"
                onClick={async () => {
                  if (selectedClinic) {
                    const refreshed = await getClinicPatientDirectory(selectedClinic.id)
                    setPatientDirectory(refreshed)
                  }
                }}
                className="flex items-center space-x-1 text-[11px] font-bold text-brand-700 hover:text-brand-800 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Directory</span>
              </button>
            </div>
            {patientDirectory.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No patient records found yet. Walk-in and online bookings will automatically populate this directory.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Gender & Age</th>
                      <th className="py-3 px-4">Total Visits</th>
                      <th className="py-3 px-4">Last Visit</th>
                      <th className="py-3 px-4">Tracking Code(s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {patientDirectory.map((pat) => (
                      <tr key={pat.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {pat.fullName}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {pat.phone}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {pat.gender} {pat.age ? `• ${pat.age} yrs` : ''}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-brand-700">
                          {pat.visitCount} {pat.visitCount === 1 ? 'visit' : 'visits'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {pat.lastVisitDate || '–'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {pat.trackingCodes.slice(0, 2).map((code) => (
                              <span
                                key={code}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[10px] font-bold"
                              >
                                #{code}
                              </span>
                            ))}
                            {pat.trackingCodes.length > 2 && (
                              <span className="text-[10px] text-slate-500 font-bold">
                                +{pat.trackingCodes.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
</div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 8: DIAGNOSTIC LAB 3-STAGE PIPELINE */}
      {/* ========================================================= */}
      {deskTab === 'lab' && isDiagnosticLab && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Diagnostic Laboratory Pipeline (3-Stage Workflow)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Step 1: Collect Sample → Step 2: Processing in Lab → Step 3: Mark Prepared & Upload Report
              </p>
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center space-x-1.5 text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Lab Queue</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-teal-50/70 border-b border-teal-100 text-teal-900 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Tracking Code</th>
                    <th className="py-3.5 px-4">Patient Name</th>
                    <th className="py-3.5 px-4">Tests Ordered</th>
                    <th className="py-3.5 px-4">Current Lab Status</th>
                    <th className="py-3.5 px-4 text-right">Lab Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {appointments.map((appt) => {
                    const relatedReport = labReports.find(
                      (r) => r.trackingCode10Digit === appt.trackingCode10Digit
                    )

                    const labStatus =
                      relatedReport?.status ||
                      (appt.checkinStatus === 'completed'
                        ? 'prepared'
                        : appt.checkinStatus === 'in_consultation'
                        ? 'processing'
                        : 'sample_collected')

                    return (
                      <tr key={appt.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          #{appt.trackingCode10Digit}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {appt.patientName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {appt.selectedTests?.join(', ') || 'Diagnostic Routine'}
                        </td>
                        <td className="py-3.5 px-4">
                          {labStatus === 'prepared' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-100 text-brand-800">
                              Prepared (Ready)
                            </span>
                          ) : labStatus === 'processing' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 animate-pulse">
                              Processing in Lab
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Sample Collected
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          {labStatus !== 'processing' && labStatus !== 'prepared' && (
                            <button
                              onClick={() => handleStatusChange(appt.id, 'in_consultation')}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                            >
                              Mark Processing
                            </button>
                          )}
                          {labStatus !== 'prepared' && (
                            <button
                              onClick={() => {
                                setTargetLabAppt(appt)
                                setLabUploadModalOpen(true)
                              }}
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                            >
                              Mark Prepared & Upload
                            </button>
                          )}
                          {labStatus === 'prepared' && relatedReport?.reportFileUrl && (
                            <a
                              href={relatedReport.reportFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View File</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 9: MANAGE LAB TESTS & PRICING RATES */}
      {/* ========================================================= */}
      {deskTab === 'rates' && isDiagnosticLab && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-900">Add Diagnostic Test</h3>
            <p className="text-xs text-slate-500 font-medium">
              Create a new test or package with your official rate.
            </p>

            <form onSubmit={handleAddService} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Test Name</label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Complete Blood Count (CBC)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Price (Rs.)</label>
                <input
                  type="number"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder="e.g. 600"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={newServiceCategory}
                  onChange={(e) => setNewServiceCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Hematology">Hematology</option>
                  <option value="Biochemistry">Biochemistry</option>
                  <option value="Hormones & Immunology">Hormones & Immunology</option>
                  <option value="Microbiology & Serology">Microbiology & Serology</option>
                  <option value="Clinical Pathology">Clinical Pathology</option>
                  <option value="Radiology & Imaging">Radiology & Imaging</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
              >
                Save Test & Publish Rate
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Current Clinic Diagnostic Rates</h3>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                {services.length} Tests Active
              </span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{srv.serviceName}</h4>
                    <span className="text-[10px] text-slate-400 font-medium">{srv.category}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-black text-teal-700">Rs. {srv.price}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(srv.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Remove test"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 10: BROADCAST NOTIFICATION ALERT */}
      {/* ========================================================= */}
      {deskTab === 'broadcast' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Clinic Notification Broadcast Desk
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Transmits real-time alerts directly to patient devices and live tracker boards.
              </p>
            </div>

            {broadcastSent && (
              <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl text-brand-800 text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
                <span>Broadcast message successfully sent to all patients!</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. Doctor Delay Notice / Break Hour Resumption"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Alert Message
                </label>
                <textarea
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter detailed notification content..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Broadcast Notification</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 11: CLINIC PROFILE & OPERATIONAL SETTINGS */}
      {/* ========================================================= */}
      {deskTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Clinic Profile & Operational Settings</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Configure your official registration details, emergency manager phone, and auto-queue thresholds.
              </p>
            </div>

            {settingsSuccess && (
              <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl text-brand-800 text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
                <span>Clinic settings successfully updated in database!</span>
              </div>
            )}

            <form onSubmit={handleSaveClinicSettings} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Clinic Name</label>
                <input
                  type="text"
                  value={settingName}
                  onChange={(e) => setSettingName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={settingPhone}
                    onChange={(e) => setSettingPhone(e.target.value)}
                    placeholder="e.g. 014XXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Manager Phone</label>
                  <input
                    type="tel"
                    value={settingManagerPhone}
                    onChange={(e) => setSettingManagerPhone(e.target.value)}
                    placeholder="e.g. 98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">PAN / VAT Number</label>
                  <input
                    type="text"
                    value={settingPan}
                    onChange={(e) => setSettingPan(e.target.value)}
                    placeholder="e.g. 601234567"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={settingEmail}
                    onChange={(e) => setSettingEmail(e.target.value)}
                    placeholder="clinic@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Address Text</label>
                <input
                  type="text"
                  value={settingAddress}
                  onChange={(e) => setSettingAddress(e.target.value)}
                  placeholder="Street Address, City, Ward"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Auto-Notify Threshold (Number of patients ahead before auto-alert)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settingThreshold}
                  onChange={(e) => setSettingThreshold(Number(e.target.value) || 2)}
                  className="w-32 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md shadow-brand-600/20 transition-all text-xs cursor-pointer"
              >
                {savingSettings ? 'Saving Settings...' : 'Save Clinic Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PUSH ALERT NOTIFICATION WITH REAL TEMPLATE PREVIEW */}
      {/* ========================================================= */}
      {pushAlertModalOpen && pushAlertTargetAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                  Live Queue Push Alert
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Send Push Notification to Patient
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: <strong className="text-slate-900">{pushAlertTargetAppt.patientName}</strong> • Token #{pushAlertTargetAppt.trackingCode10Digit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPushAlertModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* REAL NOTIFICATION TEMPLATE PREVIEW */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-inner space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {/* Real App Logo SVG */}
                  <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center text-white shadow-xs">
                    <Stethoscope className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-black tracking-wide text-brand-400">
                    DACTOR HEALTH
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Real-Time Alert</span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white">{pushAlertTitle}</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                  {pushAlertMessage}
                </p>
              </div>

              {/* 2-Metric Pill Cards (Notification Template requirement) */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Estimated Time Left
                  </span>
                  <span className="text-xs font-black text-brand-400 mt-0.5 block">
                    {pushAlertLeftVal || 'Soon, be ready'}
                  </span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Your Appointment Time
                  </span>
                  <span className="text-xs font-black text-blue-400 mt-0.5 block">
                    {pushAlertRightVal || 'Soon, be ready'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 block">Quick Alert Templates:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPushAlertTitle(`Token #${pushAlertTargetAppt.trackingCode10Digit}: Doctor Ready for Consultation`)
                    setPushAlertMessage(`Dear ${pushAlertTargetAppt.patientName}, doctor is ready for consultation. Please proceed to Cabin 1.`)
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Ready for Cabin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPushAlertTitle(`Token #${pushAlertTargetAppt.trackingCode10Digit}: Minor Consultation Delay`)
                    setPushAlertMessage(`Doctor consultation is running approximately 10 minutes late due to critical OPD case. Thank you for your patience.`)
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  10 Mins Delay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPushAlertTitle(`Token #${pushAlertTargetAppt.trackingCode10Digit}: Clinic on Short Break`)
                    setPushAlertMessage(`The clinic is temporarily on a 15-minute break. Live queue consultations will resume shortly.`)
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Clinic on Break
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPushAlertTitle(`Token #${pushAlertTargetAppt.trackingCode10Digit}: Report to Reception Desk`)
                    setPushAlertMessage(`Please report to the reception desk for document and billing settlement.`)
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Visit Reception
                </button>
              </div>
            </div>

            <form onSubmit={handleSendPushAlertSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={pushAlertTitle}
                  onChange={(e) => setPushAlertTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Message Content
                </label>
                <textarea
                  rows={3}
                  value={pushAlertMessage}
                  onChange={(e) => setPushAlertMessage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Left Metric (Estimated Wait)
                  </label>
                  <input
                    type="text"
                    value={pushAlertLeftVal}
                    onChange={(e) => setPushAlertLeftVal(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Right Metric (Appointment Time)
                  </label>
                  <input
                    type="text"
                    value={pushAlertRightVal}
                    onChange={(e) => setPushAlertRightVal(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-slate-50"
                  />
                </div>
              </div>

              {pushAlertSentSuccess && (
                <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-600" />
                  <span>Push notification delivered to patient device!</span>
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPushAlertModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingPushAlert}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  {sendingPushAlert ? 'Transmitting Alert...' : 'Send Push Alert to Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PUSH BILL & UPDATE PAYMENT (WITH DIRECT CATALOG) */}
      {/* ========================================================= */}
      {billModalOpen && billTargetAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  Billing & Payment Desk
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Push Bill & Invoice to Patient
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: <strong className="text-slate-900">{billTargetAppt.patientName}</strong> • Token #{billTargetAppt.trackingCode10Digit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBillModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-4">
              {/* Direct Catalog 1-Click Quick Chips */}
              <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-600" />
                  <span>Click to Add from Clinic Catalog:</span>
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                  {/* Default standard items */}
                  {[
                    { serviceName: 'OPD Consultation', price: Number(selectedDoctor?.consultationFee) || 500 },
                    { serviceName: 'Blood Glucose Test', price: 150 },
                    { serviceName: 'CBC Blood Count', price: 400 },
                    { serviceName: 'ECG Recording', price: 800 },
                    { serviceName: 'Wound Dressing', price: 250 },
                    { serviceName: 'Nebulization', price: 300 },
                    ...services,
                  ].map((catItem, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddCatalogItemToBill(catItem)}
                      className="px-2.5 py-1 bg-white hover:bg-brand-50 hover:text-brand-800 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-brand-300 transition-colors cursor-pointer shadow-2xs flex items-center space-x-1"
                    >
                      <span>+ {catItem.serviceName}</span>
                      <span className="text-brand-600 font-mono font-black">(Rs. {catItem.price})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Line Item Input */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customBillItemName}
                  onChange={(e) => setCustomBillItemName(e.target.value)}
                  placeholder="Custom Item Name (e.g. Suture, Injection)"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="number"
                  value={customBillItemPrice}
                  onChange={(e) => setCustomBillItemPrice(e.target.value)}
                  placeholder="Price (Rs.)"
                  className="w-24 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomBillItem}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Add
                </button>
              </div>

              {/* Itemized Line Items Table */}
              {billItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-100 p-2 font-bold text-slate-700 flex justify-between">
                    <span>Invoice Line Items</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto bg-white">
                    {billItems.map((it) => (
                      <div key={it.id} className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveBillItem(it.id)}
                            className="text-slate-300 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-slate-800">{it.name}</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            @ Rs. {it.price}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          Rs. {it.price * (it.quantity || 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Total Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={billTotalAmount}
                    onChange={(e) => setBillTotalAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Paid Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={billPaidAmount}
                    onChange={(e) => setBillPaidAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Dynamic Balance Due Banner */}
              {billTotalAmount && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Calculated Balance Due:</span>
                  <span className="font-black text-slate-900 font-mono">
                    Rs. {Math.max(0, (Number(billTotalAmount) || 0) - (Number(billPaidAmount) || 0))}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Remarks / Reception Notes (Optional)
                </label>
                <input
                  type="text"
                  value={billRemarks}
                  onChange={(e) => setBillRemarks(e.target.value)}
                  placeholder="Optional notes (e.g. Paid in Cash / eSewa, Follow-up next week)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Compressed Image Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Attach Bill / Prescription Image (Auto-Compress to &le; 500 KB)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleBillReceiptFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                />
                {billReceiptCompressionInfo && (
                  <p className="text-[11px] text-brand-700 font-bold bg-brand-50 p-2 rounded-lg border border-brand-200">
                    ⚡ {billReceiptCompressionInfo}
                  </p>
                )}
              </div>

              {/* On-Demand Bill Generation & Thermal Print */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPrintableInvoice(!showPrintableInvoice)}
                  className="text-xs font-bold text-brand-700 hover:text-brand-900 flex items-center space-x-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{showPrintableInvoice ? 'Hide Invoice Preview' : 'Generate & Preview Invoice'}</span>
                </button>
              </div>

              {/* Printable Invoice View */}
              {showPrintableInvoice && (
                <div id="dactor-printable-invoice" className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 text-xs space-y-3 font-mono">
                  <div className="flex justify-between font-black text-slate-800 pb-2 border-b border-slate-300">
                    <div>
                      <span className="text-sm uppercase block font-black">{selectedClinic?.name}</span>
                      <span className="text-[10px] text-slate-500">{selectedClinic?.addressText}</span>
                      {selectedClinic?.panNumber && (
                        <span className="text-[10px] text-slate-500 block">PAN: {selectedClinic.panNumber}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">INVOICE</span>
                      <span className="font-bold text-slate-700">{new Date().toISOString().split('T')[0]}</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-700 text-[11px]">
                    <span>Patient: <strong>{billTargetAppt.patientName}</strong></span>
                    <span>Token: <strong>#{billTargetAppt.trackingCode10Digit}</strong></span>
                  </div>

                  {/* Itemized Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="p-1.5">Description</th>
                          <th className="p-1.5 text-right">Amount (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {billItems.length > 0 ? (
                          billItems.map((it) => (
                            <tr key={it.id}>
                              <td className="p-1.5 font-medium">{it.name}</td>
                              <td className="p-1.5 text-right font-mono font-bold">Rs. {it.price * (it.quantity || 1)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="p-1.5">Consultation & Services</td>
                            <td className="p-1.5 text-right font-mono font-bold">Rs. {billTotalAmount || 500}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-300 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Bill:</span>
                      <span className="font-bold">Rs. {billTotalAmount || 500}</span>
                    </div>
                    <div className="flex justify-between font-bold text-brand-700">
                      <span>Amount Paid:</span>
                      <span>Rs. {billPaidAmount || 0}</span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-700">
                      <span>Balance Due:</span>
                      <span>
                        Rs. {Math.max(0, (Number(billTotalAmount) || 0) - (Number(billPaidAmount) || 0))}
                      </span>
                    </div>
                    {billRemarks && (
                      <div className="text-[10px] text-slate-500 pt-1">
                        Remarks: {billRemarks}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice / Thermal Receipt</span>
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBillModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBill}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-brand-600/20 cursor-pointer"
                >
                  {savingBill ? 'Saving & Recording...' : 'Push Bill to Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SHIFT APPOINTMENT DATE / RESCHEDULE */}
      {/* ========================================================= */}
      {shiftModalOpen && shiftTargetAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
                  Reschedule / Shift Appointment
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Shift Appointment Date
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: <strong className="text-slate-900">{shiftTargetAppt.patientName}</strong> • #{shiftTargetAppt.trackingCode10Digit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="text-slate-600">
                Current Scheduled Date: <strong className="text-slate-900">{shiftTargetAppt.appointmentDate}</strong>
              </p>
              <p className="text-slate-600">
                Current Time: <strong className="text-slate-900">{shiftTargetAppt.appointmentTime}</strong>
              </p>
            </div>

            <form onSubmit={handleShiftAppointmentSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Appointment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={shiftNewDate}
                  onChange={(e) => setShiftNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Time Slot
                </label>
                <input
                  type="text"
                  value={shiftNewTime}
                  onChange={(e) => setShiftNewTime(e.target.value)}
                  placeholder="e.g. 10:00 AM"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Reason for Rescheduling
                </label>
                <input
                  type="text"
                  value={shiftReason}
                  onChange={(e) => setShiftReason(e.target.value)}
                  placeholder="e.g. Patient requested, Doctor schedule adjusted"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <p className="text-[11px] text-teal-800 bg-teal-50 p-2.5 rounded-xl border border-teal-200 font-medium leading-relaxed">
                🔔 The patient will automatically receive a real-time notification alert informing them that their appointment has been rescheduled.
              </p>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shiftingAppointment}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-teal-600/20 cursor-pointer"
                >
                  {shiftingAppointment ? 'Shifting...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PRINTABLE RECEPTION TOKEN SLIP */}
      {/* ========================================================= */}
      {showPrintTokenSlip && printSlipAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">
                Reception Walk-In Token Slip
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintTokenSlip(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal printable card container */}
            <div id="dactor-token-receipt" className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl font-mono text-xs space-y-3 text-slate-800">
              <div className="text-center border-b border-slate-300 pb-2">
                <h2 className="text-base font-black uppercase text-slate-900">{selectedClinic?.name}</h2>
                <p className="text-[10px] text-slate-600">{selectedClinic?.addressText || 'Kathmandu, Nepal'}</p>
                <p className="text-[10px] text-slate-600">Tel: {selectedClinic?.contactPhone || '+9779800000000'}</p>
                <p className="text-[10px] text-brand-700 font-bold mt-1">DACTOR LIVE OPD TOKEN</p>
              </div>

              <div className="text-center py-2 bg-white rounded-xl border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500">Universal 10-Digit Live Code</p>
                <p className="text-xl font-black tracking-widest text-brand-800 my-1">
                  {printSlipAppt.trackingCode10Digit}
                </p>
                <p className="text-[10px] text-slate-500">Live Status: dactor.health</p>
              </div>

              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Patient:</span>
                  <span className="font-bold">{printSlipAppt.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Age / Gender:</span>
                  <span>{printSlipAppt.patientAge} Yrs / {printSlipAppt.patientGender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Doctor:</span>
                  <span className="font-bold">{printSlipAppt.doctor?.fullName || selectedDoctor?.fullName || 'General OPD Doctor'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span>{printSlipAppt.appointmentDate} ({printSlipAppt.appointmentTime})</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                  <span>Consultation Fee:</span>
                  <span>Rs. {printSlipAppt.feeAmount || 500}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-500 border-t border-slate-300 pt-2 leading-relaxed">
                * Track your live token queue position in real time on any smartphone without downloading any app using your 10-digit code.
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintTokenSlip(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-brand-600/20 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: LAB REPORT UPLOAD & MARK PREPARED */}
      {/* ========================================================= */}
      {labUploadModalOpen && targetLabAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
                Step 3: Laboratory Completion
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Mark Prepared & Upload Report
              </h3>
              <p className="text-xs text-slate-500">
                Patient: <strong className="text-slate-900">{targetLabAppt.patientName}</strong> (Code #{targetLabAppt.trackingCode10Digit})
              </p>
            </div>

            <form onSubmit={handleUploadReportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Upload PDF Report or Scan (Auto-Compress to &le; 500 KB)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleLabReportFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
                {reportCompressionInfo && (
                  <p className="text-[11px] text-teal-700 font-bold bg-teal-50 p-2 rounded-lg border border-teal-200 mt-1">
                    ⚡ {reportCompressionInfo}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Technician Notes / Pathologist Remarks
                </label>
                <textarea
                  rows={3}
                  value={technicianNotes}
                  onChange={(e) => setTechnicianNotes(e.target.value)}
                  placeholder="e.g. All parameters within normal biological reference ranges..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                Patient will only be able to view and download this report after verifying their registered patient name for privacy.
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLabUploadModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingReport}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-teal-600/20 cursor-pointer"
                >
                  {uploadingReport ? 'Uploading File...' : 'Mark Prepared & Notify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DOCTOR / PRACTITIONER ONBOARDING */}
      {/* ========================================================= */}
      {showDoctorOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Register Doctor / Medical Practitioner
              </h3>
              <p className="text-xs text-slate-500">
                Add a specialist to {selectedClinic?.name} with starting practice year and consultation fee.
              </p>
            </div>

            <form onSubmit={handleCreateDoctor} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => {
                    setDocName(e.target.value)
                    if (onboardingErrors.name) setOnboardingErrors({ ...onboardingErrors, name: '' })
                  }}
                  placeholder="e.g. Dr. Sushil Karki"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                    onboardingErrors.name ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                />
                {onboardingErrors.name && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{onboardingErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Specialty</label>
                  <select
                    value={docSpecialty}
                    onChange={(e) => setDocSpecialty(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="General Physician">General Physician</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Pathology & Lab Medicine">Pathology & Lab Medicine</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Gynecology">Gynecology</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Qualifications</label>
                  <input
                    type="text"
                    value={docEducation}
                    onChange={(e) => setDocEducation(e.target.value)}
                    placeholder="MBBS, MD"
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    NMC / Council License <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={docLicense}
                    onChange={(e) => {
                      setDocLicense(e.target.value)
                      if (onboardingErrors.license) setOnboardingErrors({ ...onboardingErrors, license: '' })
                    }}
                    placeholder="e.g. 14250"
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {onboardingErrors.license && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">{onboardingErrors.license}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Start Year of Practice
                  </label>
                  <select
                    value={docStartingYear}
                    onChange={(e) => setDocStartingYear(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {practicingYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr} ({2026 - yr} Yrs Experience)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Contact Mobile <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={docMobile}
                    onChange={(e) => {
                      setDocMobile(e.target.value)
                      if (onboardingErrors.mobile) setOnboardingErrors({ ...onboardingErrors, mobile: '' })
                    }}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {onboardingErrors.mobile && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">{onboardingErrors.mobile}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Fee (Rs.)</label>
                  <input
                    type="number"
                    value={docFee}
                    onChange={(e) => setDocFee(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDoctorOnboarding(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-brand-600/20 cursor-pointer"
                >
                  Register Practitioner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
