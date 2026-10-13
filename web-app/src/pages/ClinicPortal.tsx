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
  Headphones,
  ExternalLink,
  HelpCircle,
  Zap,
  Copy,
  MessageSquare,
  Mail,
  LifeBuoy,
} from 'lucide-react'
import { GlassCard, GlassButton, GlassBadge } from '../components/glass'
import {
  Clinic,
  ClinicInvitation,
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
  SupportTicket,
} from '../types'
import {
  getClinics,
  getClinicById,
  getClinicForPortalById,
  getClinicByEmail,
  getDoctors,
  getDoctorsByClinic,
  getAppointmentsByClinic,
  updateAppointmentStatus,
  updateAppointmentNotes,
  createAppointment,
  getClinicServices,
  createClinicService,
  deleteClinicService,
  saveLabReport,
  uploadReportFile,
  getLabReportsByClinic,
  getClinicNotifications,
  markAllNotificationsAsRead,
  sendBroadcastNotification,
  createClinic,
  createDoctor,
  uploadClinicDocument,
  getMedicalSpecialties,
  getMedicalQualifications,
  generate10DigitTrackingCode,
  getAppointmentByTrackingCode,
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
  sendEarlyArrivalInviteNotification,
  checkEmailPortalAssociation,
  getClinicPatientDirectory,
  getSupportUrl,
  createSlot,
  getSlotsByDoctorAndDate,
  updateSlot,
  deleteSlot,
  reorderQueuePosition,
  shiftAppointmentDate,
  checkAndNotifyApproachingPatients,
  uploadClinicPhoto,
  uploadDoctorPhoto,
  requestClinicActivationRenewal,
  completeClinicSubscriptionPayment,
  scheduleClinicDeletion,
  cancelClinicDeletion,
  getClinicInvitations,
  sendClinicInvitation,
  cancelClinicInvitation,
  deleteClinicPermanently,
  purgeExpiredClinicData,
  getSupportTickets,
  updateSupportTicketStatus,
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
  timeWindowText?: string
  approxTimeText?: string
  slotNoticeText?: string
  canOfferEarlyArrival?: boolean
  suggestedArrivalText?: string
}

function parseSlotStartTime(slotStr?: string): Date | null {
  if (!slotStr) return null
  const token = slotStr.split(/[-–]|to/)[0]?.trim()
  if (!token) return null
  const m = token.match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?/)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const minutes = parseInt(m[2], 10)
  const ampm = m[3]?.toUpperCase()
  if (ampm === 'PM' && hours < 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return d
}

function formatTimeWindow(d: Date, spreadMinutes = 15): string {
  const start = new Date(d.getTime() - 5 * 60000)
  const end = new Date(d.getTime() + Math.max(5, spreadMinutes - 5) * 60000)
  const fmt = (x: Date) => x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${fmt(start)} – ${fmt(end)}`
}

function formatApproxTime(d: Date): string {
  const fmt = (x: Date) => x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `around ${fmt(d)}`
}

// Real timing estimate calculation
function calculateLiveQueueTimingEstimate(
  targetAppt: Appointment,
  allTodayAppts: Appointment[],
  clinic: Clinic,
  doctor: Doctor | null,
  now = new Date()
): TimingEstimateResult {
  const formatTime = (d: Date) => {
    let h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`
  }

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
      timeWindowText: 'Doctor Away',
      approxTimeText: 'Doctor Away',
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
      timeWindowText: 'On Break',
      approxTimeText: 'On Break',
    }
  }

  // Determine average consultation time
  const avgMins = Math.max(
    1,
    clinic.avgTimeMode === 'manual'
      ? clinic.manualAvgConsultationTimeMinutes || 10
      : clinic.calculatedAvgConsultationTimeMinutes || clinic.avgConsultationTimeMinutes || 10
  )

  // 3. Count ONLY active people. Strictly exclude completed, cancelled and no-show patients.
  const activeAppts = allTodayAppts.filter(
    (a) => a.checkinStatus === 'waiting' || a.checkinStatus === 'in_consultation' || a.checkinStatus === 'inside'
  )
  const insidePatient = activeAppts.find(
    (a) => a.checkinStatus === 'in_consultation' || a.checkinStatus === 'inside'
  )

  // If target patient is inside
  if (insidePatient && insidePatient.id === targetAppt.id) {
    return {
      statusText: 'Patient is currently inside doctor cabin.',
      estimatedWait: 'Currently Inside',
      exactTimeStr: 'In Cabin Now',
      isDoctorAway: false,
      isOnBreak: false,
      isSoonBeReady: false,
      remainingMinutes: 0,
      timeWindowText: 'Now in cabin',
      approxTimeText: 'In cabin now',
    }
  }

  // If target patient is already completed or cancelled
  if (
    targetAppt.checkinStatus === 'completed' ||
    targetAppt.checkinStatus === 'no_show' ||
    targetAppt.checkinStatus === 'cancelled'
  ) {
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

  // People ahead in active queue
  const waitingList = activeAppts.filter((a) => a.checkinStatus === 'waiting')
  const pos = waitingList.findIndex((a) => a.id === targetAppt.id)
  const patientsAhead = pos >= 0 ? pos + (insidePatient ? 1 : 0) : 0

  // Slot timing analysis
  const slotStartDate = parseSlotStartTime(targetAppt.appointmentTime)
  const isSlotInFuture = slotStartDate ? now.getTime() < slotStartDate.getTime() : false
  const isDoctorFree = Boolean(doctor && doctor.isInClinic !== false && !insidePatient && !clinic.isOnBreak)
  const canEarly = Boolean(isDoctorFree && isSlotInFuture && targetAppt.optInEarlyCall && patientsAhead === 0)

  let arrivalAdvice = ''
  let slotStartFmt = ''
  if (slotStartDate) {
    const arr = new Date(slotStartDate.getTime() - 15 * 60000)
    arrivalAdvice = `Please arrive by ${formatTime(arr)}.`
    slotStartFmt = formatTime(slotStartDate)
  }

  const slotNotice = slotStartDate
    ? (patientsAhead === 0
        ? `No one ahead of you. Your slot starts at ${slotStartFmt}. ${arrivalAdvice}`.trim()
        : `${patientsAhead} ${patientsAhead === 1 ? 'person' : 'people'} ahead. Your slot starts at ${slotStartFmt}. ${arrivalAdvice}`.trim())
    : (patientsAhead === 0
        ? 'No one ahead of you. You are up next!'
        : `${patientsAhead} ahead in line. Est. wait: ~${patientsAhead * avgMins} mins`)

  // Dynamic wait based on active queue
  let remainingForInside = 0
  if (insidePatient) {
    const insideStart = new Date(insidePatient.updatedAt || insidePatient.createdAt || now)
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - insideStart.getTime()) / 60000))
    remainingForInside = Math.max(0, avgMins - elapsedMinutes)
  }
  const dynamicWaitMins = remainingForInside + (pos >= 0 ? pos * avgMins : 0)
  const dynamicExpectedTime = new Date(now.getTime() + dynamicWaitMins * 60000)

  let finalExpectedTime: Date
  let waitStr: string
  let remainingMins: number

  if (slotStartDate && isSlotInFuture) {
    if (canEarly) {
      finalExpectedTime = now
      waitStr = 'Doctor Free Now'
      remainingMins = 0
    } else {
      // Slot floor enforcement: never show a time earlier than slot start, unless opted in
      if (dynamicExpectedTime.getTime() > slotStartDate.getTime()) {
        finalExpectedTime = dynamicExpectedTime
        remainingMins = Math.max(0, Math.round((dynamicExpectedTime.getTime() - now.getTime()) / 60000))
        waitStr = `~${remainingMins} mins`
      } else {
        finalExpectedTime = slotStartDate
        remainingMins = Math.max(0, Math.round((slotStartDate.getTime() - now.getTime()) / 60000))
        waitStr = remainingMins > 60 ? `Starts at ${slotStartFmt}` : `~${remainingMins} mins`
      }
    }
  } else if (slotStartDate && !isSlotInFuture) {
    // Current time at or after slot (e.g. running late at 3:20 PM)
    finalExpectedTime = dynamicExpectedTime
    remainingMins = dynamicWaitMins
    waitStr = patientsAhead === 0 ? 'Soon, be ready' : `~${dynamicWaitMins} mins`
  } else {
    // Walk-in or no slot
    finalExpectedTime = dynamicExpectedTime
    remainingMins = dynamicWaitMins
    waitStr = patientsAhead === 0 ? 'Soon, be ready' : `~${dynamicWaitMins} mins`
  }

  const windowText = formatTimeWindow(finalExpectedTime)
  const approxText = formatApproxTime(finalExpectedTime)

  const isSoon = patientsAhead === 0 || remainingMins <= 3 || waitStr.includes('Soon') || canEarly

  return {
    statusText: slotNotice,
    estimatedWait: waitStr,
    exactTimeStr: `${windowText} (${approxText})`,
    isDoctorAway: false,
    isOnBreak: false,
    isSoonBeReady: isSoon,
    remainingMinutes: remainingMins,
    timeWindowText: windowText,
    approxTimeText: approxText,
    slotNoticeText: slotNotice,
    canOfferEarlyArrival: canEarly,
    suggestedArrivalText: arrivalAdvice,
  }
}

export const ClinicPortal: React.FC<ClinicPortalProps> = () => {
  // Authentication & Profile State
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [clinicDoctors, setClinicDoctors] = useState<Doctor[]>([])

  // Authentication & Verification State Machine
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

  const [supportUrl, setSupportUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('dactor_support_url') || 'https://rajanpurbe.github.io/Dactor/support'
    } catch {
      return 'https://rajanpurbe.github.io/Dactor/support'
    }
  })

  useEffect(() => {
    getSupportUrl().then((url) => {
      if (url) setSupportUrl(url)
    })
  }, [])

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

  // Form submission status & progress
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false)
  const [registrationStatusMsg, setRegistrationStatusMsg] = useState<string | null>(null)
  const [checkingVerification, setCheckingVerification] = useState(false)
  const [verificationCheckMsg, setVerificationCheckMsg] = useState<string | null>(null)

  // Operational desk tabs matching DashboardScreen.kt
  const [deskTab, setDeskTab] = useState<
    | 'queue'
    | 'walkin'
    | 'slots'
    | 'future_appts'
    | 'noshow'
    | 'fees'
    | 'invitations'
    | 'working_hours'
    | 'doctors'
    | 'billing'
    | 'patients'
    | 'lab'
    | 'rates'
    | 'broadcast'
    | 'tickets'
    | 'settings'
  >(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const t = p.get('desk') || p.get('tab')
      if (t === 'tickets' || t === 'support' || t === 'support_tickets') return 'tickets'
      if (typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('tickets')) return 'tickets'
    } catch {}
    return 'queue'
  })

  // Support Tickets Helpdesk State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [ticketSearchQuery, setTicketSearchQuery] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')
  const [updatingTicketCode, setUpdatingTicketCode] = useState<string | null>(null)

  useEffect(() => {
    const handleHash = () => {
      try {
        const hash = window.location.hash.toLowerCase()
        if (
          hash.includes('tickets') ||
          hash.includes('tab=tickets') ||
          hash.includes('desk=tickets') ||
          hash.includes('admin-tickets') ||
          hash.includes('support_tickets')
        ) {
          setDeskTab('tickets')
        }
      } catch {}
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // Queue Board Segmented Sub-Tab (QueueBoardScreen.kt: Waiting vs Past/Completed)
  const [queueSubTab, setQueueSubTab] = useState<'waiting' | 'past'>('waiting')

  // Clinical Remark Modal State (QueueBoardScreen.kt & FutureAppointmentsScreen.kt)
  const [remarkModalOpen, setRemarkModalOpen] = useState(false)
  const [remarkTargetAppt, setRemarkTargetAppt] = useState<Appointment | null>(null)
  const [remarkText, setRemarkText] = useState('')
  const [savingRemark, setSavingRemark] = useState(false)

  // Subscription Renewal Modal & Notification Drawer State (DashboardScreen.kt)
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [renewalPlan, setRenewalPlan] = useState<'1_month' | '12_months'>('1_month')
  const [renewalTxnRef, setRenewalTxnRef] = useState('')
  const [submittingRenewal, setSubmittingRenewal] = useState(false)
  const [clinicNotifications, setClinicNotifications] = useState<DactorNotification[]>([])
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)

  // Staff & Doctor Invitations State (InvitationManagerScreen.kt)
  const [allSystemDoctors, setAllSystemDoctors] = useState<Doctor[]>([])
  const [clinicInvitations, setClinicInvitations] = useState<ClinicInvitation[]>([])
  const [inviteSubTab, setInviteSubTab] = useState<'find' | 'sent'>('find')
  const [inviteRoleFilter, setInviteRoleFilter] = useState<'all' | 'doctor' | 'lab_technician'>('all')
  const [inviteSearchQuery, setInviteSearchQuery] = useState('')
  const [customInviteEmail, setCustomInviteEmail] = useState('')
  const [customInviteName, setCustomInviteName] = useState('')
  const [customInviteRole, setCustomInviteRole] = useState<'doctor' | 'lab_technician'>('doctor')
  const [viewingDoctorProfile, setViewingDoctorProfile] = useState<Doctor | null>(null)

  // Consultation Fee Manager State (ConsultationFeeManagerScreen.kt)
  const [editingDoctorFees, setEditingDoctorFees] = useState<{ [docId: string]: number }>({})
  const [savingDocFeeId, setSavingDocFeeId] = useState<string | null>(null)

  // Slot Capacity Edit Modal State (SlotManagerScreen.kt)
  const [editingSlotCapacity, setEditingSlotCapacity] = useState<Slot | null>(null)
  const [newSlotCapacityVal, setNewSlotCapacityVal] = useState<number>(5)

  // Future OPD Sub-Filter (FutureAppointmentsScreen.kt)
  const [futureSubFilter, setFutureSubFilter] = useState<'all' | 'waiting' | 'completed'>('all')

  // Billing Date Filter & Catalog Category Filter (BillingScreen.kt & CatalogManagerScreen.kt)
  const [billingDateFilter, setBillingDateFilter] = useState<string>('all')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('All')
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('')

  // Lab Workflow Sub-Tab, Search & Verification Gate Modal (LabWorkflowScreen.kt)
  const [labSubTab, setLabSubTab] = useState<'all' | 'processing' | 'prepared'>('all')
  const [labSearchQuery, setLabSearchQuery] = useState('')
  const [labVerifyTargetReport, setLabVerifyTargetReport] = useState<{ report: LabReport; appt: Appointment } | null>(null)
  const [labVerifyInput, setLabVerifyInput] = useState('')
  const [labVerifyError, setLabVerifyError] = useState<string | null>(null)

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
  const [walkinSelectedTests, setWalkinSelectedTests] = useState<ClinicService[]>([])
  const [walkinIsFollowup, setWalkinIsFollowup] = useState(false)
  const [walkinFollowupCode, setWalkinFollowupCode] = useState('')
  const [walkinRetainedAppt, setWalkinRetainedAppt] = useState<Appointment | null>(null)
  const [walkinLookupLoading, setWalkinLookupLoading] = useState(false)
  const [walkinLookupError, setWalkinLookupError] = useState<string | null>(null)
  const [walkinSlotTime, setWalkinSlotTime] = useState('')
  const [walkinSlotId, setWalkinSlotId] = useState('')
  const [walkinAvailableSlots, setWalkinAvailableSlots] = useState<Slot[]>([])
  const [walkinUseCustomSlot, setWalkinUseCustomSlot] = useState(false)

  // 3 Clinic Types Classification for active clinic
  const isLabClinic = useMemo(() => {
    if (!selectedClinic) return false
    const t = (selectedClinic.type || '').toLowerCase()
    const n = (selectedClinic.name || '').toLowerCase()
    return (
      t === 'diagnostic_lab' ||
      t.includes('lab') ||
      n.includes('lab') ||
      (selectedClinic.specialties?.some(
        (s) => s.toLowerCase().includes('lab') || s.toLowerCase().includes('patholog')
      ) ?? false)
    )
  }, [selectedClinic])

  const isSingleDoctorClinic = useMemo(() => {
    if (isLabClinic) return false
    return (
      selectedClinic?.type === 'single_visit' ||
      selectedClinic?.type === 'single_doctor' ||
      clinicDoctors.length === 1
    )
  }, [isLabClinic, selectedClinic?.type, clinicDoctors.length])

  const isPolyclinic = useMemo(() => {
    return !isLabClinic && !isSingleDoctorClinic
  }, [isLabClinic, isSingleDoctorClinic])

  // Walk-in 10-digit follow-up code lookup
  useEffect(() => {
    let active = true
    const clean = walkinFollowupCode.trim()
    if (walkinIsFollowup && clean.length === 10 && /^\d{10}$/.test(clean)) {
      setWalkinLookupLoading(true)
      setWalkinLookupError(null)
      getAppointmentByTrackingCode(clean)
        .then((found) => {
          if (!active) return
          setWalkinLookupLoading(false)
          if (found) {
            setWalkinRetainedAppt(found)
            setWalkinName(found.patientName)
            setWalkinAge(String(found.patientAge || ''))
            setWalkinGender(found.patientGender || 'Male')
            setWalkinMobile(found.patientMobile || '')
            if (found.patientEmail) setWalkinEmail(found.patientEmail)
            if (found.doctorId && clinicDoctors.length > 0) {
              const matched = clinicDoctors.find((d) => d.id === found.doctorId)
              if (matched) setWalkinDoctorId(matched.id)
            }
          } else {
            setWalkinRetainedAppt(null)
            setWalkinLookupError(`No appointment record found for 10-digit code #${clean}.`)
          }
        })
        .catch(() => {
          if (!active) return
          setWalkinLookupLoading(false)
          setWalkinRetainedAppt(null)
          setWalkinLookupError('Failed to lookup 10-digit tracking code.')
        })
    } else {
      setWalkinRetainedAppt(null)
      if (clean.length > 0 && clean.length !== 10) {
        setWalkinLookupError('Tracking code must be exactly 10 digits.')
      } else {
        setWalkinLookupError(null)
      }
    }
    return () => {
      active = false
    }
  }, [walkinIsFollowup, walkinFollowupCode, clinicDoctors])

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

  // Clinic Settings State (ClinicSettingsScreen.kt)
  const [settingName, setSettingName] = useState('')
  const [settingType, setSettingType] = useState('multi_visit')
  const [settingPhone, setSettingPhone] = useState('')
  const [settingEmail, setSettingEmail] = useState('')
  const [settingAddress, setSettingAddress] = useState('')
  const [settingLat, setSettingLat] = useState<number>(27.7172)
  const [settingLng, setSettingLng] = useState<number>(85.324)
  const [settingPan, setSettingPan] = useState('')
  const [settingManagerPhone, setSettingManagerPhone] = useState('')
  const [settingThreshold, setSettingThreshold] = useState<number>(2)
  const [settingSpecialties, setSettingSpecialties] = useState<string[]>([])
  const [settingDesc, setSettingDesc] = useState('')
  const [settingGatewayProvider, setSettingGatewayProvider] = useState('esewa')
  const [settingMerchantId, setSettingMerchantId] = useState('')
  const [settingPaymentApiKey, setSettingPaymentApiKey] = useState('')
  const [settingPaymentSecretKey, setSettingPaymentSecretKey] = useState('')
  const [settingDirectPaymentEnabled, setSettingDirectPaymentEnabled] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showDeleteArchiveModal, setShowDeleteArchiveModal] = useState(false)
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false)

  // Generate Year dropdown options (2026 down to 1960)
  const practicingYears: number[] = []
  for (let y = 2026; y >= 1960; y--) {
    practicingYears.push(y)
  }

  const syncClinicToSettings = (clinicObj: Clinic) => {
    setClinicOnBreak(clinicObj.isOnBreak ?? false)
    setAvgTimeMode((clinicObj.avgTimeMode as any) || 'auto')
    setManualAvgMinutes(clinicObj.manualAvgConsultationTimeMinutes || 10)
    if (clinicObj.weeklyScheduleJson) {
      try {
        setWeeklySchedule(JSON.parse(clinicObj.weeklyScheduleJson))
      } catch {}
    }
    setSettingName(clinicObj.name || '')
    setSettingType(clinicObj.type || 'multi_visit')
    setSettingPhone(clinicObj.contactPhone || '')
    setSettingEmail(clinicObj.contactEmail || '')
    setSettingAddress(clinicObj.addressText || '')
    setSettingLat(clinicObj.latitude || 27.7172)
    setSettingLng(clinicObj.longitude || 85.324)
    setSettingPan(clinicObj.panNumber || '')
    setSettingManagerPhone(clinicObj.managerPhone || '')
    setSettingThreshold(clinicObj.autoNotifyThreshold || 2)
    setSettingSpecialties(clinicObj.specialties || [])
    setSettingDesc(clinicObj.description || '')
    setSettingGatewayProvider(clinicObj.paymentGatewayProvider || 'esewa')
    setSettingMerchantId(clinicObj.merchantId || '')
    setSettingPaymentApiKey(clinicObj.paymentApiKey || '')
    setSettingPaymentSecretKey(clinicObj.paymentSecretKey || '')
    setSettingDirectPaymentEnabled(clinicObj.isDirectPaymentEnabled ?? false)
  }

  // Load Clinics and Taxonomy on mount
  useEffect(() => {
    async function init() {
      const [cList, specs, quals, allDocs] = await Promise.all([
        getClinics(),
        getMedicalSpecialties(),
        getMedicalQualifications(),
        getDoctors(),
      ])
      setClinics(cList)
      setMedicalSpecialties(specs)
      setMedicalQualifications(quals)
      setAllSystemDoctors(allDocs)

      const savedEmail = (localStorage.getItem('dactor_auth_email') || '').trim().toLowerCase()
      let initialClinic: Clinic | null = null
      if (savedEmail) {
        initialClinic =
          cList.find((c) => (c.contactEmail || '').toLowerCase() === savedEmail) ||
          (await getClinicByEmail(savedEmail))
      }
      if (!initialClinic && cList.length > 0) {
        initialClinic = cList[0]
      }

      if (initialClinic) {
        setSelectedClinic(initialClinic)
        syncClinicToSettings(initialClinic)
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
        const [docs, appts, srvs, reps, invs, directory, notifs, invites, sysDocs] = await Promise.all([
          getDoctorsByClinic(selectedClinic.id),
          getAppointmentsByClinic(selectedClinic.id),
          getClinicServices(selectedClinic.id),
          getLabReportsByClinic(selectedClinic.id),
          getBillingInvoicesByClinic(selectedClinic.id),
          getClinicPatientDirectory(selectedClinic.id),
          getClinicNotifications(selectedClinic.id),
          getClinicInvitations(selectedClinic.id),
          getDoctors(),
        ])

        setClinicDoctors(docs)
        const feeMap: { [id: string]: number } = {}
        docs.forEach((d) => {
          feeMap[d.id] = d.consultationFee || 500
        })
        setEditingDoctorFees(feeMap)

        if (docs.length > 0) {
          const doc = docs[0]
          setSelectedDoctor(doc)
          setWalkinDoctorId((prev) => prev || doc.id)
          setSlotDoctorId((prev) => prev || doc.id)
          setDoctorInClinic(doc.isInClinic ?? true)
        }
        setAppointments(appts)
        setServices(srvs)
        setLabReports(reps)
        setInvoices(invs)
        setPatientDirectory(directory)
        setClinicNotifications(notifs)
        setClinicInvitations(invites)
        setAllSystemDoctors(sysDocs)
        syncClinicToSettings(selectedClinic)
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

  // Load today's published slots for walk-in appointment registration
  useEffect(() => {
    const docId = walkinDoctorId || clinicDoctors[0]?.id
    if (!docId) return
    const today = new Date().toISOString().split('T')[0]
    getSlotsByDoctorAndDate(docId, today)
      .then((slots) => setWalkinAvailableSlots(slots || []))
      .catch((err) => console.error('Error loading walkin slots:', err))
  }, [walkinDoctorId, clinicDoctors, refreshKey])

  // Load support helpdesk tickets for administration
  useEffect(() => {
    async function loadTickets() {
      setLoadingTickets(true)
      try {
        const list = await getSupportTickets()
        setSupportTickets(list)
      } catch (err) {
        console.error('Error loading support tickets:', err)
      } finally {
        setLoadingTickets(false)
      }
    }
    loadTickets()
  }, [refreshKey])

  const handleTicketStatusChange = async (
    ticketCode: string,
    newStatus: 'open' | 'in_progress' | 'resolved' | 'closed'
  ) => {
    setUpdatingTicketCode(ticketCode)
    try {
      await updateSupportTicketStatus(ticketCode, newStatus)
      setSupportTickets((prev) =>
        prev.map((t) => (t.ticketCode === ticketCode ? { ...t, status: newStatus } : t))
      )
    } catch (err) {
      console.error('Error updating ticket status:', err)
    } finally {
      setUpdatingTicketCode(null)
    }
  }

  // Recalculate bill total amount when line items change
  useEffect(() => {
    if (billItems.length > 0) {
      const sum = billItems.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0)
      setBillTotalAmount(String(sum))
    }
  }, [billItems])

  const saveSession = (email: string, role: 'clinic_manager' | 'doctor' | 'lab_tech' = 'clinic_manager') => {
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

  // 1. Process Login & Verification for Clinic Email (Strictly Clinic Portal Only)
  const processLoginForEmail = async (email: string, _roleTab: 'clinic' | 'doctor' = 'clinic') => {
    const trimmedEmail = email.trim().toLowerCase()
    setFirebaseLoading(true)
    setFirebaseError(null)
    setVerifiedEmail(trimmedEmail)

    try {
      // Enforce 1 Google Account = 1 Portal Role rule
      const assoc = await checkEmailPortalAssociation(trimmedEmail)
      if (assoc && assoc.portal !== 'clinic') {
        await signOutFirebase().catch(() => {})
        setVerifiedEmail('')
        setCurrentView('auth_choice')
        const entitySuffix = assoc.entityName ? ` (${assoc.entityName})` : ''
        setFirebaseError(
          `This Google account (${trimmedEmail}) is already associated with a ${assoc.portalLabel} account${entitySuffix}. You cannot log in to the Clinic Portal with this Google ID. Please change your Google account.`
        )
        return
      }

      const existingClinic = await getClinicByEmail(trimmedEmail)
      if (existingClinic) {
        const vStatus = (existingClinic.verificationStatus || 'approved').toLowerCase()
        if (vStatus === 'approved' || vStatus === 'verified') {
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
        // Unregistered clinic -> Open Clinic Registration Form! (Never prefill name from Google)
        setRegClinicName('')
        setRegClinicErrors({})
        setCurrentView('register_form')
      }
    } catch (err: any) {
      console.error('Error verifying clinic account:', err)
      setFirebaseError(err.message || 'Error communicating with database')
    } finally {
      setFirebaseLoading(false)
    }
  }

  // 2. Google Sign-In Trigger for Clinic Portal
  const handleGoogleSignInWithRole = async (_roleTab: 'clinic' | 'doctor' = 'clinic') => {
    setFirebaseLoading(true)
    setFirebaseError(null)
    try {
      await signOutFirebase().catch(() => {})
      const googleUser = await signInWithFirebaseGoogle()
      if (!googleUser || !googleUser.email) {
        throw new Error('Google sign-in did not return user credentials.')
      }
      await processLoginForEmail(googleUser.email, 'clinic')
    } catch (err: any) {
      if (err?.message?.includes('cancelled')) {
        // User closed account chooser
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
      const refreshed = pendingEntity.id
        ? await getClinicForPortalById(pendingEntity.id)
        : await getClinicByEmail(pendingEntity.email)
      if (refreshed) {
        const st = (refreshed.verificationStatus || 'pending').toLowerCase()
        if (st === 'approved' || st === 'verified') {
          setSelectedClinic(refreshed)
          saveSession(pendingEntity.email, 'clinic_manager')
          return
        } else {
          setPendingEntity({ ...pendingEntity, status: st })
          localStorage.setItem('dactor_pending_verification', JSON.stringify({ ...pendingEntity, status: st }))
          setVerificationCheckMsg('Status checked: Registration is still under administrative review.')
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
        setSettingLat(pos.coords.latitude)
        setSettingLng(pos.coords.longitude)
        setIsDetectingLocation(false)
      },
      () => {
        setIsDetectingLocation(false)
        alert('Could not retrieve GPS coordinates automatically. You can enter them manually or select a Nepal City Preset.')
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
        const compressed = await compressImage(regClinicDocFile, 300 * 1024)
        regDocUrl =
          (await uploadClinicDocument(`reg_${regClinicDocFile.name}`, compressed, 'clinic_registration_docs')) ||
          undefined
      }

      const picUrls: string[] = []
      for (let i = 0; i < regClinicPictures.length; i++) {
        const pic = regClinicPictures[i]
        const compressed = await compressImage(pic, 300 * 1024)
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

  // Master Doctor Presence Toggle (All Doctors Present / Off-Duty at once - DashboardScreen.kt)
  const handleToggleAllDoctorsPresence = async (makePresent: boolean) => {
    if (clinicDoctors.length === 0) return
    setUpdatingPresence(true)
    try {
      await Promise.all(clinicDoctors.map((d) => updateDoctorPresence(d.id, makePresent)))
      setClinicDoctors((prev) => prev.map((d) => ({ ...d, isInClinic: makePresent })))
      setDoctorInClinic(makePresent)
      if (selectedDoctor) {
        setSelectedDoctor({ ...selectedDoctor, isInClinic: makePresent })
      }
    } catch (err) {
      console.error('Error toggling all doctors presence:', err)
    } finally {
      setUpdatingPresence(false)
    }
  }

  // Clinical Remark Save Handler (QueueBoardScreen.kt & FutureAppointmentsScreen.kt)
  const handleOpenRemarkModal = (appt: Appointment) => {
    setRemarkTargetAppt(appt)
    setRemarkText(appt.notes || '')
    setRemarkModalOpen(true)
  }

  const handleSaveClinicalRemark = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!remarkTargetAppt) return
    setSavingRemark(true)
    try {
      const ok = await updateAppointmentNotes(remarkTargetAppt.id, remarkText)
      if (ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === remarkTargetAppt.id ? { ...a, notes: remarkText.trim() } : a))
        )
        setRemarkModalOpen(false)
      }
    } finally {
      setSavingRemark(false)
    }
  }

  // Subscription Renewal & Instant Bypass Handlers (DashboardScreen.kt & ClinicSettingsScreen.kt)
  const handleRequestRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClinic) return
    if (!renewalTxnRef.trim()) {
      alert('Please enter your payment transaction ID / reference.')
      return
    }
    setSubmittingRenewal(true)
    try {
      const amt = renewalPlan === '12_months' ? 15000 : 1500
      const ok = await requestClinicActivationRenewal(selectedClinic.id, renewalPlan, amt, renewalTxnRef.trim())
      if (ok) {
        alert('Renewal payment reference submitted to Dactor Admin for verification!')
        setShowRenewalModal(false)
        setRenewalTxnRef('')
      }
    } finally {
      setSubmittingRenewal(false)
    }
  }

  const handleInstantBypassSubscription = async () => {
    if (!selectedClinic) return
    setSubmittingRenewal(true)
    try {
      const amt = renewalPlan === '12_months' ? 15000 : 1500
      const ok = await completeClinicSubscriptionPayment(
        selectedClinic.id,
        renewalPlan,
        amt,
        `BYPASS-${Date.now()}`
      )
      if (ok) {
        const refreshed = await getClinicForPortalById(selectedClinic.id)
        if (refreshed) setSelectedClinic(refreshed)
        setShowRenewalModal(false)
        alert(`Subscription activated for ${renewalPlan === '12_months' ? '365 days' : '30 days'}!`)
      }
    } finally {
      setSubmittingRenewal(false)
    }
  }

  // 30-Day Archive Schedule & Restore Handlers (ClinicSettingsScreen.kt & DashboardScreen.kt)
  const handleScheduleClinicArchive = async () => {
    if (!selectedClinic) return
    const ok = await scheduleClinicDeletion(selectedClinic.id)
    if (ok) {
      const refreshed = await getClinicForPortalById(selectedClinic.id)
      if (refreshed) setSelectedClinic(refreshed)
      setShowDeleteArchiveModal(false)
    }
  }

  const handleCancelClinicArchive = async () => {
    if (!selectedClinic) return
    const ok = await cancelClinicDeletion(selectedClinic.id)
    if (ok) {
      const refreshed = await getClinicForPortalById(selectedClinic.id)
      if (refreshed) setSelectedClinic(refreshed)
      alert('Account deletion cancelled! Your clinic operational desk is restored.')
    }
  }

  // Admin Permanent Deletion Handler
  const handlePermanentDeleteClinic = async () => {
    if (!selectedClinic) return
    const confirmName = window.prompt(
      `⚠️ ADMIN PERMANENT PURGE:\nThis will permanently delete "${selectedClinic.name}", its doctors, appointments, slots, and services from the database.\n\nType "${selectedClinic.name}" to confirm:`
    )
    if (confirmName !== selectedClinic.name) {
      if (confirmName !== null) alert('Clinic name did not match. Deletion aborted.')
      return
    }

    setIsDeletingPermanently(true)
    try {
      const ok = await deleteClinicPermanently(selectedClinic.id)
      if (ok) {
        alert(`Clinic "${selectedClinic.name}" has been permanently purged.`)
        setSelectedClinic(null)
        setShowDeleteArchiveModal(false)
        const refreshedList = await getClinics()
        setClinics(refreshedList)
      } else {
        alert('Failed to permanently delete clinic. Please verify permissions.')
      }
    } catch (e: any) {
      alert(`Error during permanent deletion: ${e?.message || e}`)
    } finally {
      setIsDeletingPermanently(false)
    }
  }

  // Slot -30m & Capacity Update Handlers (SlotManagerScreen.kt)
  const handleSubtract30MinsFromSlot = async (slot: Slot) => {
    // Parse endTime and subtract 30 mins
    try {
      const clean = slot.endTime.trim().toUpperCase()
      const isPM = clean.includes('PM')
      const isAM = clean.includes('AM')
      const parts = clean.replace(/[^0-9:]/g, '').split(':')
      let h = parseInt(parts[0] || '10', 10)
      let m = parseInt(parts[1] || '0', 10)
      if (isPM && h < 12) h += 12
      if (isAM && h === 12) h = 0
      let totalMins = h * 60 + m - 30
      if (totalMins < 0) totalMins = 0
      const newH24 = Math.floor(totalMins / 60)
      const newM = totalMins % 60
      const newAmpm = newH24 >= 12 ? 'PM' : 'AM'
      const newH12 = newH24 % 12 || 12
      const newEndStr = `${String(newH12).padStart(2, '0')}:${String(newM).padStart(2, '0')} ${newAmpm}`
      const ok = await updateSlot(slot.id, { endTime: newEndStr })
      if (ok) {
        setPublishedSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, endTime: newEndStr } : s)))
      }
    } catch {}
  }

  const handleSaveSlotCapacityUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSlotCapacity) return
    const ok = await updateSlot(editingSlotCapacity.id, { maxCapacity: newSlotCapacityVal })
    if (ok) {
      setPublishedSlots((prev) =>
        prev.map((s) => (s.id === editingSlotCapacity.id ? { ...s, maxCapacity: newSlotCapacityVal } : s))
      )
      setEditingSlotCapacity(null)
    }
  }

  // Consultation Fee Manager Handler (ConsultationFeeManagerScreen.kt)
  const handleSaveDoctorFee = async (doc: Doctor, newFee: number) => {
    setSavingDocFeeId(doc.id)
    try {
      const ok = await updateDoctor(doc.id, { consultationFee: newFee })
      if (ok) {
        setClinicDoctors((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, consultationFee: newFee } : d))
        )
        if (selectedDoctor?.id === doc.id) {
          setSelectedDoctor({ ...selectedDoctor, consultationFee: newFee })
        }
        alert(`Consultation fee for ${doc.fullName} updated to Rs. ${newFee}!`)
      }
    } finally {
      setSavingDocFeeId(null)
    }
  }

  // Staff & Doctor Invitations Handlers (InvitationManagerScreen.kt)
  const handleSendCustomStaffInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClinic || !customInviteEmail.trim() || !customInviteName.trim()) return
    const created = await sendClinicInvitation({
      clinicId: selectedClinic.id,
      clinicName: selectedClinic.name,
      invitedEmail: customInviteEmail.trim(),
      invitedName: customInviteName.trim(),
      role: customInviteRole,
    })
    if (created) {
      setClinicInvitations((prev) => [created, ...prev])
      setCustomInviteEmail('')
      setCustomInviteName('')
      alert(`Invitation sent to ${created.invitedName} (${created.invitedEmail})!`)
    }
  }

  const handleSendDoctorInvitation = async (doc: Doctor) => {
    if (!selectedClinic) return
    const role: 'doctor' | 'lab_technician' =
      doc.practitionerRole === 'lab_technician' || doc.isLabTechnician ? 'lab_technician' : 'doctor'
    const created = await sendClinicInvitation({
      clinicId: selectedClinic.id,
      clinicName: selectedClinic.name,
      doctorId: doc.id,
      invitedEmail: doc.email || `${doc.id}@dactor.health`,
      invitedName: doc.fullName,
      role,
      specialty: doc.specialty,
    })
    if (created) {
      setClinicInvitations((prev) => [created, ...prev])
      if (!clinicDoctors.some((cd) => cd.id === doc.id)) {
        setClinicDoctors((prev) => [...prev, { ...doc, clinicId: selectedClinic.id }])
      }
      alert(`Invitation sent to ${doc.fullName} and linked to ${selectedClinic.name}!`)
    }
  }

  const handleCancelStaffInvitation = async (invId: string) => {
    if (!selectedClinic) return
    const ok = await cancelClinicInvitation(invId, selectedClinic.id)
    if (ok) {
      setClinicInvitations((prev) => prev.filter((i) => i.id !== invId))
    }
  }

  const handleSettingsGPS = handleBrowserGPS

  // Lab Report Privacy Verification Gate Handler (LabWorkflowScreen.kt)
  const handleVerifyAndOpenLabReport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!labVerifyTargetReport) return
    const q = labVerifyInput.trim().toLowerCase()
    const pName = (labVerifyTargetReport.appt.patientName || '').trim().toLowerCase()
    const pPhone = (labVerifyTargetReport.appt.patientMobile || '').replace(/\D/g, '')
    const qDigits = q.replace(/\D/g, '')

    const isMatch =
      (q.length >= 2 && pName.includes(q)) ||
      (qDigits.length >= 6 && pPhone.includes(qDigits))

    if (!isMatch) {
      setLabVerifyError('Verification failed. Please enter the matching patient name or registered phone number.')
      return
    }

    const url = labVerifyTargetReport.report.reportFileUrl
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert(
        `Verified! Report: ${labVerifyTargetReport.report.testName}\nStatus: ${labVerifyTargetReport.report.status}\nNotes: ${labVerifyTargetReport.report.technicianNotes || 'Normal parameters.'}`
      )
    }
    setLabVerifyTargetReport(null)
    setLabVerifyInput('')
    setLabVerifyError(null)
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

  // Early Arrival Invite Trigger for Opted-in Patients
  const handleSendEarlyInvite = async (appt: Appointment) => {
    if (!selectedClinic) return
    const confirmed = window.confirm(
      `Send "⚡ Doctor is Free Now! Come in early?" push alert to ${appt.patientName}?`
    )
    if (!confirmed) return

    try {
      const ok = await sendEarlyArrivalInviteNotification(
        appt.id,
        appt.patientName,
        appt.trackingCode10Digit,
        appt.appointmentTime,
        appt.userId
      )
      if (ok) {
        alert(`⚡ Early arrival push notification successfully pushed to ${appt.patientName}'s device!`)
      } else {
        alert('Could not send notification. Please try again.')
      }
    } catch (err) {
      console.error('Error inviting early:', err)
      alert('Failed to send early invitation.')
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
    if (isLabClinic && walkinSelectedTests.length === 0) {
      errors.tests = 'Please select at least one diagnostic lab test.'
    }

    setWalkinErrors(errors)
    if (Object.keys(errors).length > 0 || !selectedClinic) return

    try {
      const code10 = generate10DigitTrackingCode()

      const labFee = walkinSelectedTests.reduce((acc, t) => acc + (t.price || 0), 0)
      const assignedDoc = clinicDoctors.find((d) => d.id === walkinDoctorId) || clinicDoctors[0]
      const docFee = assignedDoc?.consultationFee || 500
      const isFreeFollowup = walkinIsFollowup && walkinRetainedAppt
      const finalFee = isLabClinic ? labFee : isFreeFollowup ? 0 : docFee

      const walkinNotes = isLabClinic
        ? 'Walk-In Diagnostic Lab Sample Registration'
        : isFreeFollowup
        ? `Walk-In Free Follow-Up Visit (Previous Token #${walkinRetainedAppt.trackingCode10Digit})`
        : 'Walk-In Reception Registration'

      const created = await createAppointment({
        clinicId: selectedClinic.id,
        doctorId: isLabClinic ? undefined : (walkinDoctorId || clinicDoctors[0]?.id || undefined),
        trackingCode10Digit: code10,
        patientName: walkinName.trim(),
        patientAge: Number(walkinAge),
        patientGender: walkinGender,
        patientMobile: walkinMobile.trim(),
        patientEmail: walkinEmail.trim() || undefined,
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: walkinSlotTime.trim() || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        slotId: walkinSlotId || undefined,
        checkinStatus: 'waiting',
        paymentStatus: 'paid',
        feeAmount: finalFee,
        notes: walkinNotes,
        selectedTests: isLabClinic ? walkinSelectedTests.map((t) => t.serviceName) : [],
      })

      if (created) {
        setWalkinSuccessCode(code10)
        setPrintSlipAppt(created)
        setWalkinName('')
        setWalkinAge('')
        setWalkinMobile('')
        setWalkinEmail('')
        setWalkinSlotTime('')
        setWalkinSlotId('')
        setWalkinUseCustomSlot(false)
        setWalkinSelectedTests([])
        setWalkinIsFollowup(false)
        setWalkinFollowupCode('')
        setWalkinRetainedAppt(null)
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
      const compressed = await compressImage(file, 300 * 1024, 1600)
      const newSizeKb = Math.round(compressed.size / 1024)
      setBillReceiptFile(compressed)
      setBillReceiptCompressionInfo(
        `Optimized receipt image from ${origSizeKb} KB down to ${newSizeKb} KB (≤ 300 KB)`
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
      const compressed = await compressImage(file, 300 * 1024, 1800)
      const newSizeKb = Math.round(compressed.size / 1024)
      setReportFile(compressed)
      setReportCompressionInfo(
        `Optimized report scan from ${origSizeKb} KB down to ${newSizeKb} KB (≤ 300 KB)`
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

  // Save Clinic Settings (ClinicSettingsScreen.kt)
  const handleSaveClinicSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClinic) return
    setSavingSettings(true)
    try {
      const updates: Partial<Clinic> = {
        name: settingName.trim(),
        type: settingType as any,
        contactPhone: settingPhone.trim(),
        contactEmail: settingEmail.trim(),
        addressText: settingAddress.trim(),
        latitude: settingLat,
        longitude: settingLng,
        panNumber: settingPan.trim(),
        managerPhone: settingManagerPhone.trim(),
        autoNotifyThreshold: settingThreshold,
        specialties: settingSpecialties,
        description: settingDesc.trim(),
        paymentGatewayProvider: settingGatewayProvider,
        merchantId: settingMerchantId.trim(),
        paymentApiKey: settingPaymentApiKey.trim(),
        paymentSecretKey: settingPaymentSecretKey.trim(),
        isDirectPaymentEnabled: settingDirectPaymentEnabled,
      }
      const ok = await updateClinic(selectedClinic.id, updates)
      if (ok) {
        setSelectedClinic({
          ...selectedClinic,
          ...updates,
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

  // Doctor photo upload modal state & handler
  const [doctorPhotoModalOpen, setDoctorPhotoModalOpen] = useState(false)
  const [doctorPhotoTarget, setDoctorPhotoTarget] = useState<Doctor | null>(null)
  const [doctorPhotoFile, setDoctorPhotoFile] = useState<File | null>(null)
  const [doctorPhotoPreview, setDoctorPhotoPreview] = useState<string | null>(null)
  const [uploadingDoctorPhoto, setUploadingDoctorPhoto] = useState(false)
  const [doctorPhotoMsg, setDoctorPhotoMsg] = useState<string | null>(null)

  const handleOpenDoctorPhotoUpload = (doc: Doctor) => {
    setDoctorPhotoTarget(doc)
    setDoctorPhotoFile(null)
    setDoctorPhotoPreview(doc.profilePictureUrl || null)
    setDoctorPhotoMsg(null)
    setDoctorPhotoModalOpen(true)
  }

  const handleDoctorPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDoctorPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setDoctorPhotoPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveDoctorPhoto = async () => {
    if (!doctorPhotoTarget) return
    if (!doctorPhotoFile) {
      alert('Please select an image file first.')
      return
    }
    setUploadingDoctorPhoto(true)
    setDoctorPhotoMsg('Compressing photo to <= 300 KB...')
    try {
      const compressed = await compressImage(doctorPhotoFile, 300 * 1024)
      setDoctorPhotoMsg('Uploading to Supabase doctor_photos storage...')
      const publicUrl = await uploadDoctorPhoto(doctorPhotoTarget.id, compressed, doctorPhotoFile.name)
      if (!publicUrl) throw new Error('Failed to upload doctor photo to Supabase storage.')

      setDoctorPhotoMsg('Updating doctor profile in Supabase...')
      const ok = await updateDoctor(doctorPhotoTarget.id, { profilePictureUrl: publicUrl })
      if (!ok) throw new Error('Failed to update doctor profile picture in database.')

      setClinicDoctors((prev) =>
        prev.map((d) => (d.id === doctorPhotoTarget.id ? { ...d, profilePictureUrl: publicUrl } : d))
      )
      if (selectedDoctor?.id === doctorPhotoTarget.id) {
        setSelectedDoctor({ ...selectedDoctor, profilePictureUrl: publicUrl })
      }
      setDoctorPhotoMsg('Doctor profile picture updated successfully!')
      setTimeout(() => {
        setDoctorPhotoModalOpen(false)
        setDoctorPhotoMsg(null)
      }, 1500)
    } catch (err: any) {
      console.error('Error saving doctor photo:', err)
      alert(err?.message || 'Failed to save doctor photo')
      setDoctorPhotoMsg(null)
    } finally {
      setUploadingDoctorPhoto(false)
    }
  }

  // Clinic Facility Photos Upload & Management
  const [uploadingClinicPhoto, setUploadingClinicPhoto] = useState(false)
  const [clinicPhotoStatusMsg, setClinicPhotoStatusMsg] = useState<string | null>(null)

  const handleUploadClinicPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedClinic) return
    const currentPics = selectedClinic.pictures || []
    if (currentPics.length >= 4) {
      alert('A maximum of 4 clinic facility photos can be added. Please remove an existing photo first.')
      return
    }

    setUploadingClinicPhoto(true)
    setClinicPhotoStatusMsg('Compressing facility image...')
    try {
      const compressed = await compressImage(file, 300 * 1024)
      setClinicPhotoStatusMsg('Uploading to Supabase clinic_photos storage...')
      const publicUrl = await uploadClinicPhoto(selectedClinic.id, compressed, file.name)
      if (!publicUrl) throw new Error('Failed to upload photo to Supabase storage.')

      const updatedPics = [...currentPics, publicUrl]
      setClinicPhotoStatusMsg('Saving to clinic profile in Supabase...')
      const ok = await updateClinic(selectedClinic.id, { pictures: updatedPics })
      if (!ok) throw new Error('Failed to update clinic pictures in database.')

      setSelectedClinic({ ...selectedClinic, pictures: updatedPics })
      setClinicPhotoStatusMsg('Facility photo uploaded successfully!')
      setTimeout(() => setClinicPhotoStatusMsg(null), 3000)
    } catch (err: any) {
      console.error('Error uploading clinic photo:', err)
      alert(err?.message || 'Failed to upload clinic photo')
      setClinicPhotoStatusMsg(null)
    } finally {
      setUploadingClinicPhoto(false)
      e.target.value = ''
    }
  }

  const handleRemoveClinicPhoto = async (indexToRemove: number) => {
    if (!selectedClinic) return
    const currentPics = selectedClinic.pictures || []
    if (!window.confirm('Are you sure you want to remove this facility photo?')) return

    const updatedPics = currentPics.filter((_, idx) => idx !== indexToRemove)
    try {
      const ok = await updateClinic(selectedClinic.id, { pictures: updatedPics })
      if (ok) {
        setSelectedClinic({ ...selectedClinic, pictures: updatedPics })
      }
    } catch (err) {
      console.error('Error removing clinic photo:', err)
    }
  }

  const handleSetClinicCoverPhoto = async (photoUrl: string) => {
    if (!selectedClinic) return
    try {
      const ok = await updateClinic(selectedClinic.id, { logoUrl: photoUrl })
      if (ok) {
        setSelectedClinic({ ...selectedClinic, logoUrl: photoUrl })
        alert('Cover logo updated successfully!')
      }
    } catch (err) {
      console.error('Error setting cover photo:', err)
    }
  }

  const isDiagnosticLab = true // Allow all clinics access to Lab & Rates modules like DashboardScreen.kt

  // Subscription & Archive Countdown Calculations (DashboardScreen.kt & ClinicSettingsScreen.kt)
  const subscriptionDaysLeft = useMemo(() => {
    if (!selectedClinic?.activationExpiresAt) return 30
    try {
      const exp = new Date(selectedClinic.activationExpiresAt).getTime()
      const diff = Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24))
      return Math.max(0, diff)
    } catch {
      return 30
    }
  }, [selectedClinic?.activationExpiresAt])

  const isSubscriptionActive = Boolean(
    (selectedClinic?.isActivated ?? true) && subscriptionDaysLeft > 0
  )

  const archiveDaysLeft = useMemo(() => {
    if (!selectedClinic?.deletionScheduledAt) return 30
    try {
      const del = new Date(selectedClinic.deletionScheduledAt).getTime()
      const diff = Math.ceil((del - Date.now()) / (1000 * 60 * 60 * 24))
      return Math.max(0, diff)
    } catch {
      return 30
    }
  }, [selectedClinic?.deletionScheduledAt])

  // 14-Day Horizontal Date Strip (SlotManagerScreen.kt & FutureAppointmentsScreen.kt)
  const upcoming14Dates = useMemo(() => {
    const arr: { dateStr: string; dayShort: string; dayNum: string; monthShort: string }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const dayShort = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' })
      const dayNum = String(d.getDate()).padStart(2, '0')
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' })
      arr.push({ dateStr, dayShort, dayNum, monthShort })
    }
    return arr
  }, [])

  // 13 Nepal City Presets (ClinicSettingsScreen.kt)
  const NEPAL_CITY_PRESETS = [
    { name: 'Kathmandu', lat: 27.7172, lng: 85.324 },
    { name: 'Lalitpur (Patan)', lat: 27.6644, lng: 85.3188 },
    { name: 'Bhaktapur', lat: 27.671, lng: 85.4298 },
    { name: 'Pokhara', lat: 28.2096, lng: 83.9856 },
    { name: 'Bharatpur (Chitwan)', lat: 27.6833, lng: 84.4333 },
    { name: 'Biratnagar', lat: 26.4525, lng: 87.2718 },
    { name: 'Birgunj', lat: 27.0104, lng: 84.877 },
    { name: 'Dharan', lat: 26.812, lng: 87.2836 },
    { name: 'Butwal', lat: 27.7006, lng: 83.4484 },
    { name: 'Hetauda', lat: 27.4284, lng: 85.0322 },
    { name: 'Janakpur', lat: 26.7288, lng: 85.9263 },
    { name: 'Nepalgunj', lat: 28.05, lng: 81.6167 },
    { name: 'Dhangadhi', lat: 28.6852, lng: 80.6216 },
  ]

  const defaultSpecialtyList = useMemo(
    () =>
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
          ],
    [medicalSpecialties]
  )

  // Queue Counts
  const todayDateStr = new Date().toISOString().split('T')[0]
  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.appointmentDate === todayDateStr),
    [appointments, todayDateStr]
  )

  const noShowAppointments = useMemo(
    () => appointments.filter((a) => a.checkinStatus === 'no_show'),
    [appointments]
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
        <div className="liquid-glass-elevated liquid-glass-ShatterHighlight rounded-3xl p-8 sm:p-10 shadow-glass-elevated border border-amber-300/60 dark:border-amber-500/30 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-400/30 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-8 h-8 stroke-[2.5]" />
            </div>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Under Regulatory Review</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Dactor Administration Verification
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
              Your registration has been recorded in the Dactor National Healthcare Network. Our clinical oversight committee verifies PAN records, physical location, and Nepal Medical Council (NMC) credentials before activating operational desk access.
            </p>
          </div>

          {/* Entity Details Card */}
          <div className="liquid-glass-subtle rounded-2xl p-5 border border-white/50 dark:border-white/10 space-y-3 text-left">
            <div className="flex items-center justify-between border-b border-white/40 dark:border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {pendingEntity.role === 'clinic'
                    ? 'Healthcare Facility Accreditation'
                    : 'Medical Practitioner KYC'}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {pendingEntity.name}
                </h3>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40">
                {pendingEntity.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block">Registered Account Email</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{pendingEntity.email}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Submitted Credentials</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{pendingEntity.details}</span>
              </div>
            </div>
          </div>

          {verificationCheckMsg && (
            <div className="p-4 rounded-2xl bg-amber-500/10 backdrop-blur-md border border-amber-300/60 dark:border-amber-500/30 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{verificationCheckMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <a
              href="#support?view=track"
              onClick={() => {
                window.location.hash = '#support?view=track'
                window.dispatchEvent(new HashChangeEvent('hashchange'))
              }}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:brightness-110 text-white font-bold rounded-2xl shadow-lg border border-indigo-400/40 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer active:scale-[0.98]"
            >
              <LifeBuoy className="w-4 h-4" />
              <span>Check Help Request Status</span>
            </a>

            <a
              href={supportUrl.startsWith('http') || supportUrl.startsWith('mailto:') ? supportUrl : `https://${supportUrl}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-white font-bold rounded-2xl shadow-lg border border-amber-400/40 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer active:scale-[0.98]"
            >
              <Headphones className="w-4 h-4" />
              <span>Contact Dactor Support & Onboarding Desk</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
            </a>

            <button
              type="button"
              onClick={checkVerificationStatus}
              disabled={checkingVerification}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white font-bold rounded-2xl shadow-glass-brand border border-white/25 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:opacity-60 active:scale-[0.98]"
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
              className="w-full py-3.5 bg-slate-900/90 hover:bg-slate-800 text-white font-bold rounded-2xl border border-white/15 transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer active:scale-[0.98]"
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
              className="w-full py-3 liquid-glass-card hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 border border-white/50 dark:border-white/10 font-bold rounded-2xl transition-all text-xs cursor-pointer flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change Account</span>
            </button>
          </div>

          <div className="p-3.5 liquid-glass-subtle rounded-2xl border border-white/40 dark:border-white/10 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Standard verification completes within 24–48 business hours. For urgent hospital or diagnostic lab onboarding, contact Dactor Regulatory Support at{' '}
              <span className="font-bold text-slate-700 dark:text-slate-200">dactorofficial@gmail.com</span>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: CLINIC REGISTRATION FORM
  // ==========================================
  if (currentView === 'register_form') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="liquid-glass-elevated liquid-glass-ShatterHighlight rounded-3xl p-6 sm:p-10 shadow-glass-elevated border border-white/60 dark:border-white/15 space-y-6">
          {/* Top Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/40 dark:border-white/10 pb-4">
            <button
              type="button"
              onClick={resetToAuthChoice}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <span>← Back to Login Desk</span>
            </button>
            <span className="text-xs font-bold px-3 py-1 bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-400/30 rounded-full flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>Healthcare Facility Registration</span>
            </span>
          </div>

          {/* Account Not Registered Notice Banner */}
          <div className="p-4 rounded-2xl bg-amber-500/10 backdrop-blur-md border border-amber-300/60 dark:border-amber-500/30 flex items-start space-x-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                Account Not Registered
              </span>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                No Clinic profile is registered under <strong>"{verifiedEmail}"</strong>. Complete your details below to register, or tap Change Account to use another Gmail.
              </p>
            </div>
          </div>

          {/* Read-Only Selected Google Account Card */}
          <div className="p-4 rounded-2xl bg-brand-500/10 backdrop-blur-md border border-brand-300/60 dark:border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 dark:text-brand-300 block">
                Selected Google Account
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white font-mono block">
                {verifiedEmail}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleGoogleSignInWithRole('clinic')}
              className="px-3.5 py-2 rounded-xl border border-brand-300/60 dark:border-brand-500/30 liquid-glass-card hover:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-bold text-xs shrink-0 cursor-pointer transition shadow-2xs"
            >
              Change Account
            </button>
          </div>

          {/* CLINIC REGISTRATION FORM */}
          <form onSubmit={submitClinicRegistration} className="space-y-6 text-left">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Register Healthcare Facility / Clinic
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Complete all statutory details matching your government registration and 9-digit PAN certificate.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Facility / Clinic Name *
                  </label>
                  <input
                    type="text"
                    value={regClinicName}
                    onChange={(e) => setRegClinicName(e.target.value)}
                    placeholder="e.g. Kathmandu City Polyclinic & Lab"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                  {regClinicErrors.name && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">{regClinicErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Healthcare Facility Type *
                  </label>
                  <select
                    value={regClinicType}
                    onChange={(e) => setRegClinicType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-bold text-slate-800 dark:text-white outline-none"
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
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    9-Digit PAN Number *
                  </label>
                  <input
                    type="text"
                    maxLength={9}
                    value={regClinicPan}
                    onChange={(e) => setRegClinicPan(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 609812345"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                  {regClinicErrors.pan && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">{regClinicErrors.pan}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Clinic Reception Mobile (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={regClinicPhone}
                    onChange={(e) => setRegClinicPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                  {regClinicErrors.phone && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">{regClinicErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Clinic Manager Mobile (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={regManagerPhone}
                    onChange={(e) => setRegManagerPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                  {regClinicErrors.managerPhone && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                      {regClinicErrors.managerPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* Address & Live GPS */}
              <div className="p-4 rounded-2xl liquid-glass-subtle border border-white/50 dark:border-white/10 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Full Street Address & Landmark *
                  </label>
                  <input
                    type="text"
                    value={regClinicAddress}
                    onChange={(e) => setRegClinicAddress(e.target.value)}
                    placeholder="e.g. Maharajgunj Chakrapath, Near Teaching Hospital, Kathmandu"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                  {regClinicErrors.address && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                      {regClinicErrors.address}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      GPS Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={regClinicLat}
                      onChange={(e) => setRegClinicLat( parseFloat(e.target.value) || 27.7052 )}
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      GPS Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={regClinicLng}
                      onChange={(e) => setRegClinicLng( parseFloat(e.target.value) || 85.3193 )}
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowserGPS}
                    disabled={isDetectingLocation}
                    className="py-2 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-glass-brand border border-white/25 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{isDetectingLocation ? 'Detecting GPS...' : 'Detect Live GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Specialties Multi-Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
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
                            ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white border-white/25 shadow-glass-brand'
                            : 'liquid-glass-subtle text-slate-700 dark:text-slate-200 border-white/50 dark:border-white/10 hover:bg-white/60'
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
                <div className="p-4 rounded-2xl border border-dashed border-white/60 dark:border-white/20 liquid-glass-subtle space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>Government Registration / PAN Certificate</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Auto-compressed to &le;300 KB before uploading to Supabase storage.
                  </p>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setRegClinicDocFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-500/15 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-500/25"
                  />
                  {regClinicDocFile && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                      Selected: {regClinicDocFile.name} ({Math.round(regClinicDocFile.size / 1024)} KB)
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-2xl border border-dashed border-white/60 dark:border-white/20 liquid-glass-subtle space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Camera className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>Clinic Exterior / Reception Photos</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Displayed to patients in the Dactor app to help identify your building.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      setRegClinicPictures(e.target.files ? Array.from(e.target.files) : [])
                    }
                    className="text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-500/15 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-500/25"
                  />
                  {regClinicPictures.length > 0 && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                      {regClinicPictures.length} photo(s) ready for compression & upload
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  About Facility & Patient Services
                </label>
                <textarea
                  rows={2}
                  value={regClinicDesc}
                  onChange={(e) => setRegClinicDesc(e.target.value)}
                  placeholder="Describe available diagnostic equipment, pharmacy, parking, or visiting hours..."
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-medium text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* Terms Checkbox */}
              <label className="flex items-start space-x-3 p-3.5 rounded-2xl liquid-glass-subtle border border-white/50 dark:border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regClinicTermsAccepted}
                  onChange={(e) => setRegClinicTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  I hereby declare that this healthcare facility holds a valid operating license in Nepal, that the 9-digit PAN number is authentic, and I agree to the{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    Dactor Healthcare Provider Regulatory Terms & Patient Data Protection Policy
                  </span>
                  .
                </span>
              </label>
              {regClinicErrors.terms && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">{regClinicErrors.terms}</p>
              )}

              {registrationStatusMsg && (
                <div className="p-3.5 rounded-2xl bg-brand-500/10 border border-brand-300/60 dark:border-brand-500/30 text-xs font-bold text-brand-800 dark:text-brand-200 flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-600 shrink-0" />
                  <span>{registrationStatusMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingRegistration}
                className="w-full py-4 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white font-black rounded-2xl shadow-glass-brand border border-white/25 transition-all text-sm cursor-pointer disabled:opacity-60 active:scale-[0.98]"
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
        <div className="liquid-glass-elevated liquid-glass-ShatterHighlight rounded-3xl p-8 sm:p-10 shadow-glass-elevated border border-white/60 dark:border-white/15 text-center space-y-6">
          {/* Brand Icon */}
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-600 to-teal-500 text-white flex items-center justify-center mx-auto shadow-glass-brand border border-white/30">
            <Building2 className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Official Dactor Facility Network
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Clinic & Diagnostic Facility Portal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Manage live OPD reception tokens, walk-in registrations, doctor schedules, diagnostic pathology reports, and facility billing.
            </p>
          </div>

          {/* Account Exclusivity Security Notice */}
          <div className="p-3.5 bg-amber-500/10 backdrop-blur-md rounded-2xl border border-amber-300/60 dark:border-amber-500/30 text-left space-y-1">
            <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Strict Single-Role Account Security</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              Your Google account is exclusively bound to your Clinic Manager profile. In accordance with Dactor security rules, an account cannot be used across Doctor or Patient portals.
            </p>
          </div>

          {/* Error Banner */}
          {firebaseError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 backdrop-blur-md border border-rose-300/60 dark:border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs font-medium text-left space-y-2.5">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Access Restricted</span>
                  <p className="leading-relaxed">{firebaseError}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleGoogleSignInWithRole('clinic')}
                  className="px-3 py-1.5 rounded-xl liquid-glass-card hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300/60 font-bold text-xs cursor-pointer transition"
                >
                  Change Account
                </button>
              </div>
            </div>
          )}

          {/* Single Google Sign In Button */}
          <button
            type="button"
            onClick={() => handleGoogleSignInWithRole('clinic')}
            disabled={firebaseLoading}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white font-black rounded-2xl shadow-glass-brand border border-white/25 transition-all flex items-center justify-center space-x-3 text-sm cursor-pointer disabled:opacity-60 active:scale-[0.98]"
          >
            {firebaseLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-white" />
                <span>Verifying Clinic Account...</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                </div>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Terms & Policy Disclosure Button */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-300 underline cursor-pointer transition"
            >
              By continuing, you accept Dactor&apos;s Clinic Terms &amp; Policy
            </button>
          </div>

          <div className="p-3.5 liquid-glass-subtle rounded-2xl border border-white/40 dark:border-white/10 text-left space-y-1">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Unified Clinic Login &amp; Registration</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Sign in with your Google account above. Verified clinics enter their operational dashboard directly; new healthcare facilities are guided through registration.
            </p>
          </div>
        </div>

        {/* Terms Modal accessible from Login Screen */}
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-md">
            <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 shadow-glass-modal border border-white/60 dark:border-white/15 space-y-4 max-h-[85vh] flex flex-col text-left animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-white/40 dark:border-white/10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                    Healthcare Governance
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Dactor Clinic Terms, Privacy &amp; Regulatory Compliance
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pr-1">
                <p>
                  <strong>1. Nepal Medical Council (NMC) &amp; MoHP Compliance:</strong> All doctors and laboratory personnel registered under this clinic must hold valid, active licenses from the Nepal Medical Council (NMC) or Nepal Health Professional Council (NHPC).
                </p>
                <p>
                  <strong>2. Patient Data Confidentiality:</strong> Patient medical records, diagnostic pathology reports, and contact details are strictly confidential and protected under Nepal&apos;s Individual Privacy Act. Laboratory reports require patient name/mobile verification before viewing.
                </p>
                <p>
                  <strong>3. Transparent Billing &amp; PAN Disclosure:</strong> Clinics issuing digital invoices or accepting direct eSewa/Khalti/Fonepay settlements are responsible for accurate tax and PAN reporting.
                </p>
                <p>
                  <strong>4. 30-Day Reversible Account Archive Policy:</strong> When a clinic schedules account deletion, all public listings are hidden immediately, while historical patient records remain safely archived for 30 days in case the clinic administrator chooses to restore the account.
                </p>
              </div>
              <div className="pt-2 border-t border-white/40 dark:border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-glass-brand border border-white/25 cursor-pointer"
                >
                  I Understand &amp; Acknowledge
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // VIEW: LOGGED IN OPERATIONAL CLINIC PORTAL
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-8 pb-28 sm:pb-12">
      {/* 30-DAY ARCHIVE LOCK BANNER */}
      {selectedClinic?.isArchived && (
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-rose-950/85 backdrop-blur-xl text-white border border-rose-500/60 shadow-glass-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-600/80 border border-rose-400/50 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white">
                  30-Day Deletion Grace Period
                </span>
                <span className="text-xs font-mono font-bold text-rose-200">
                  {archiveDaysLeft} Days Remaining
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black">
                Clinic Account Archived &amp; Hidden from Patient Bookings
              </h2>
              <p className="text-xs text-rose-200 max-w-2xl leading-relaxed">
                This clinic is scheduled for permanent deletion on{' '}
                <strong>{selectedClinic.deletionScheduledAt?.split('T')[0] || '30 days from archive'}</strong>. You can restore full operational status anytime before the countdown expires.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelClinicArchive}
            className="w-full md:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-xs shadow-lg cursor-pointer shrink-0 transition active:scale-[0.98]"
          >
            Cancel Deletion &amp; Restore Clinic Account
          </button>
        </div>
      )}

      {/* Top Banner / Clinic Context Bar */}
      <div className="liquid-glass-elevated liquid-glass-ShatterHighlight rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/15 p-4 sm:p-6 shadow-glass-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 text-white flex items-center justify-center font-black text-xl shrink-0 overflow-hidden border border-white/40 shadow-glass-brand relative">
            {selectedClinic?.logoUrl || (selectedClinic?.pictures && selectedClinic.pictures.length > 0) ? (
              <img
                src={selectedClinic.logoUrl || selectedClinic.pictures![0]}
                alt={selectedClinic?.name || 'Clinic Photo'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                {selectedClinic?.name}
              </h1>
              {/* Subscription Status Pill */}
              <button
                type="button"
                onClick={() => setShowRenewalModal(true)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border flex items-center gap-1 cursor-pointer transition ${
                  isSubscriptionActive
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-400/40 hover:bg-rose-500/25 animate-pulse'
                }`}
                title="Click to manage Clinic Subscription & License Renewal"
              >
                <CreditCard className="w-3 h-3" />
                <span>
                  {isSubscriptionActive
                    ? `Active • ${subscriptionDaysLeft}d left`
                    : 'Expired • Renew'}
                </span>
              </button>

              {selectedClinic?.pictures && selectedClinic.pictures.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDeskTab('settings')}
                  className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold liquid-glass-subtle hover:bg-brand-500/15 text-slate-700 dark:text-slate-200 hover:text-brand-800 dark:hover:text-brand-300 border border-white/50 dark:border-white/10 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Click to view and manage clinic facility photos in Settings"
                >
                  <Camera className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>{selectedClinic.pictures.length} {selectedClinic.pictures.length === 1 ? 'Photo' : 'Photos'}</span>
                </button>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-brand-500/15 text-brand-800 dark:text-brand-300 border border-brand-400/30">
                {selectedClinic?.type === 'diagnostic_lab'
                  ? 'Diagnostic Lab'
                  : selectedClinic?.type === 'single_Specialty'
                  ? 'Single Specialty'
                  : 'Polyclinic OPD'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Logged in as <strong className="text-slate-800 dark:text-slate-200">{authEmail}</strong> • Active Operational Desk
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/40 dark:border-white/10">
          {/* Notification Bell Drawer Trigger */}
          <button
            type="button"
            onClick={() => setShowNotificationsModal(true)}
            className="relative p-2 sm:p-2.5 rounded-xl liquid-glass-subtle hover:bg-brand-500/15 text-slate-700 dark:text-slate-200 hover:text-brand-700 border border-white/50 dark:border-white/10 transition cursor-pointer"
            title="View Clinic Notifications"
          >
            <Bell className="w-4 h-4" />
            {clinicNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                {Math.min(9, clinicNotifications.length)}
              </span>
            )}
          </button>

          {/* Doctor Presence Toggle */}
          {selectedDoctor && (
            <button
              onClick={() => handleToggleDoctorPresence(selectedDoctor)}
              disabled={updatingPresence}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                doctorInClinic
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 border-rose-400/40 text-rose-800 dark:text-rose-300 hover:bg-rose-500/25'
              }`}
              title="Click to toggle Doctor In-Clinic Presence"
            >
              <span
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                  doctorInClinic ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="truncate">{doctorInClinic ? 'Doctor In' : 'Doctor Out'}</span>
            </button>
          )}

          {/* Clinic Break Toggle */}
          <button
            onClick={handleToggleClinicBreak}
            disabled={updatingBreak}
            className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              clinicOnBreak
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-900 dark:text-amber-200 hover:bg-amber-500/30'
                : 'liquid-glass-subtle border-white/50 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60'
            }`}
            title="Click to toggle Clinic Break mode (broadcasts alert to all patients)"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>{clinicOnBreak ? 'On Break' : 'Take Break'}</span>
          </button>

          <button
            onClick={() => setShowDoctorOnboarding(true)}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-2 bg-brand-500/15 hover:bg-brand-500/25 text-brand-800 dark:text-brand-300 border border-brand-400/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Add Doctor</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-2 liquid-glass-subtle hover:bg-rose-500/15 hover:text-rose-600 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/10 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Navigation Desk Tabs (All 15 Modules) */}
      <div className="flex items-center space-x-2 p-1.5 rounded-2xl liquid-glass-base overflow-x-auto scrollbar-none">
        <button
          onClick={() => setDeskTab('queue')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'queue'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live OPD Queue ({queueWaitingCount})</span>
        </button>

        <button
          onClick={() => setDeskTab('walkin')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'walkin'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Reception Walk-In</span>
        </button>

        <button
          onClick={() => setDeskTab('slots')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'slots'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          <span>Timed Slots Publisher</span>
        </button>

        <button
          onClick={() => setDeskTab('future_appts')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'future_appts'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Future Appointments & Holidays</span>
        </button>

        <button
          onClick={() => setDeskTab('noshow')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'noshow'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-rose-700 dark:text-rose-300 hover:bg-rose-500/15'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>No-Show Patients ({noShowAppointments.length})</span>
        </button>

        <button
          onClick={() => setDeskTab('fees')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'fees'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Consultation Fees</span>
        </button>

        <button
          onClick={() => setDeskTab('invitations')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'invitations'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Doctor & Staff Invitations</span>
        </button>

        <button
          onClick={() => setDeskTab('working_hours')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'working_hours'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Working Hours & Break Schedule</span>
        </button>

        <button
          onClick={() => setDeskTab('doctors')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'doctors'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Doctors & Staff ({clinicDoctors.length})</span>
        </button>

        <button
          onClick={() => setDeskTab('billing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'billing'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Bills & Invoices</span>
        </button>

        <button
          onClick={() => setDeskTab('patients')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'patients'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
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
                ? 'bg-gradient-to-r from-teal-600 to-brand-500 text-white shadow-glass-brand border border-white/25'
                : 'text-teal-800 dark:text-teal-300 hover:bg-teal-500/15'
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
                ? 'bg-gradient-to-r from-teal-600 to-brand-500 text-white shadow-glass-brand border border-white/25'
                : 'text-teal-800 dark:text-teal-300 hover:bg-teal-500/15'
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
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Broadcast Alerts</span>
        </button>

        <button
          onClick={() => setDeskTab('tickets')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'tickets'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-glass-brand border border-white/25'
              : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/15'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>Support Tickets ({supportTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length})</span>
        </button>

        <button
          onClick={() => setDeskTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'settings'
              ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand border border-white/25'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
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
          {/* Enlisted Doctors & Presence Roster Bar with Master Switch */}
          {clinicDoctors.length > 0 && (
            <div className="liquid-glass-card p-5 rounded-3xl border border-white/60 dark:border-white/15 shadow-glass-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/40 dark:border-white/10 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>Enlisted Doctors & Live Cabin Presence Roster ({clinicDoctors.filter((d) => d.isInClinic ?? true).length}/{clinicDoctors.length} Present)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Toggle individual doctor presence or use the Master Switch to set all doctors Present or Off-Duty.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={updatingPresence}
                    onClick={() => handleToggleAllDoctorsPresence(true)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-400/40 text-xs font-bold cursor-pointer transition active:scale-[0.98]"
                  >
                    ● Set All Present
                  </button>
                  <button
                    type="button"
                    disabled={updatingPresence}
                    onClick={() => handleToggleAllDoctorsPresence(false)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-400/40 text-xs font-bold cursor-pointer transition active:scale-[0.98]"
                  >
                    ○ Set All Off-Duty
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {clinicDoctors.map((doc) => {
                  const isPresent = doc.isInClinic ?? true
                  return (
                    <div
                      key={doc.id}
                      className={`px-3 py-2 rounded-2xl border flex items-center space-x-2.5 text-xs transition ${
                        isPresent
                          ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-950 dark:text-emerald-200'
                          : 'liquid-glass-subtle border-white/40 dark:border-white/10 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white font-black flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {doc.profilePictureUrl ? (
                          <img src={doc.profilePictureUrl} alt={doc.fullName} className="w-full h-full object-cover" />
                        ) : (
                          doc.fullName.charAt(0)
                        )}
                      </div>
                      <div>
                        <span className="font-bold block leading-tight">{doc.fullName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{doc.specialty || 'General'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleDoctorPresence(doc)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition ${
                          isPresent
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-400/30'
                        }`}
                      >
                        {isPresent ? 'IN' : 'OUT'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top Banner Alert if Doctor is Away or Clinic is on Break */}
          {!doctorInClinic && (
            <div className="p-4 bg-rose-500/10 backdrop-blur-md border border-rose-300/60 dark:border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-800 dark:text-rose-200 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span>Doctor is not inside the clinic (He/She is not in).</span>
                <span className="font-normal text-rose-700 dark:text-rose-300 ml-1">
                  Patients checking their queue status are informed that the doctor is currently away.
                </span>
              </div>
            </div>
          )}

          {clinicOnBreak && (
            <div className="p-4 bg-amber-500/10 backdrop-blur-md border border-amber-300/60 dark:border-amber-500/30 rounded-2xl flex items-center space-x-3 text-amber-900 dark:text-amber-200 text-xs font-bold">
              <Coffee className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span>Clinic is currently in Break Mode.</span>
                <span className="font-normal text-amber-800 dark:text-amber-300 ml-1">
                  All consultations are temporarily paused. Patients can see the break notice on their mobile tracker.
                </span>
              </div>
            </div>
          )}

          {/* Queue Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="liquid-glass-card p-4 rounded-2xl border border-white/50 dark:border-white/10 shadow-glass-sm">
              <span className="text-[11px] font-bold uppercase text-slate-400">Waiting Patients</span>
              <p className="text-2xl font-black text-sky-500 dark:text-sky-400 mt-1">{queueWaitingCount}</p>
            </div>
            <div className="liquid-glass-card p-4 rounded-2xl border border-white/50 dark:border-white/10 shadow-glass-sm">
              <span className="text-[11px] font-bold uppercase text-slate-400">Inside Cabin</span>
              <p className="text-2xl font-black text-amber-500 dark:text-amber-400 mt-1">{queueInsideCount}</p>
            </div>
            <div className="liquid-glass-card p-4 rounded-2xl border border-white/50 dark:border-white/10 shadow-glass-sm">
              <span className="text-[11px] font-bold uppercase text-slate-400">Completed Today</span>
              <p className="text-2xl font-black text-teal-500 dark:text-teal-400 mt-1">{queueCompletedCount}</p>
            </div>
            <div className="liquid-glass-card p-4 rounded-2xl border border-white/50 dark:border-white/10 shadow-glass-sm">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total Registered</span>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{todayAppointments.length}</p>
            </div>
          </div>

          {/* Consultation Timing Configuration Bar (Auto vs Manual Toggle) */}
          <div className="liquid-glass-card p-4 rounded-2xl border border-white/50 dark:border-white/10 shadow-glass-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl liquid-glass-subtle flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Average Consultation Time Mode</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Configures the estimated wait calculation for all patients in today's live queue.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Auto / Manual toggle buttons */}
              <div className="flex p-1 liquid-glass-subtle rounded-xl border border-white/40 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setAvgTimeMode('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    avgTimeMode === 'auto'
                      ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Auto Calculated
                </button>
                <button
                  type="button"
                  onClick={() => setAvgTimeMode('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    avgTimeMode === 'manual'
                      ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
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
                    className="w-16 px-2.5 py-1.5 liquid-glass-input rounded-lg text-xs font-bold text-center text-slate-900 dark:text-white outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Mins</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveAvgTimeSettings}
                disabled={savingAvgTime}
                className="px-3 py-1.5 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white rounded-lg text-xs font-bold transition-colors shadow-glass-brand border border-white/25 cursor-pointer active:scale-[0.98]"
              >
                {savingAvgTime ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Active Cabin Card (Patient currently inside) */}
          {activeConsultationPatient && (
            <div className="p-5 bg-amber-500/10 backdrop-blur-md border border-amber-300/60 dark:border-amber-500/30 rounded-3xl shadow-glass-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg animate-pulse shadow-md">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full border border-amber-400/30">
                      Currently Inside Doctor Cabin
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900 dark:text-amber-200">
                      Token #{activeConsultationPatient.trackingCode10Digit}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {activeConsultationPatient.patientName} ({activeConsultationPatient.patientAge || '–'} Yrs, {activeConsultationPatient.patientGender || '–'})
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Attending: {activeConsultationPatient.doctor?.fullName || selectedDoctor?.fullName || 'OPD Doctor'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full md:w-auto">
                <button
                  onClick={() => handleStatusChange(activeConsultationPatient.id, 'completed')}
                  className="flex-1 md:flex-initial px-4 py-2.5 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-glass-brand border border-white/25 transition-colors cursor-pointer active:scale-[0.98]"
                >
                  Mark Consultation Done
                </button>
                <button
                  onClick={() => handleOpenRemarkModal(activeConsultationPatient)}
                  className="px-3 py-2.5 liquid-glass-card hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 border border-white/50 dark:border-white/10 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  title="Add or edit clinical remark"
                >
                  Remark
                </button>
                <button
                  onClick={() => handleOpenPushAlertModal(activeConsultationPatient)}
                  className="px-3 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-300/60 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  title="Send push alert to patient"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenBillModal(activeConsultationPatient)}
                  className="px-3 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-800 dark:text-sky-200 border border-sky-300/60 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  title="Push Bill / Settle Payment"
                >
                  <Receipt className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Section Header + Segmented Sub-Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex p-1 liquid-glass-subtle rounded-2xl border border-white/40 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setQueueSubTab('waiting')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                    queueSubTab === 'waiting'
                      ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Waiting Queue ({queueWaitingCount + queueInsideCount})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueSubTab('past')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                    queueSubTab === 'past'
                      ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Past / Completed Queue ({todayAppointments.filter((a) => a.checkinStatus === 'completed' || a.checkinStatus === 'no_show' || a.checkinStatus === 'cancelled').length})
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleTriggerAutoNotify}
                className="flex items-center space-x-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-300/60 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                title={`Notify patients who are ≤ ${settingThreshold} spots away from consultation cabin`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Auto-Notify (Threshold: &le; {settingThreshold})</span>
              </button>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="flex items-center space-x-1.5 text-xs font-bold text-brand-700 dark:text-brand-300 liquid-glass-subtle border border-brand-400/30 px-3 py-1.5 rounded-xl cursor-pointer transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Board</span>
              </button>
            </div>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="p-12 text-center liquid-glass-card rounded-3xl border border-white/60 dark:border-white/10 shadow-glass-sm">
              <Activity className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">No appointments scheduled for today</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Patients registered via online booking or reception walk-in will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="liquid-glass-elevated rounded-3xl border border-white/60 dark:border-white/15 overflow-hidden shadow-glass-base">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="liquid-glass-subtle border-b border-white/40 dark:border-white/10 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Token Code</th>
                      <th className="py-3.5 px-4">Patient Name & Phone</th>
                      <th className="py-3.5 px-4">Age / Gender</th>
                      <th className="py-3.5 px-4">Doctor</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Estimated Timing</th>
                      <th className="py-3.5 px-4">Payment</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/30 dark:divide-white/5 font-medium">
                    {todayAppointments
                      .filter((appt) =>
                        queueSubTab === 'waiting'
                          ? appt.checkinStatus === 'waiting' ||
                            appt.checkinStatus === 'in_consultation' ||
                            appt.checkinStatus === 'inside'
                          : appt.checkinStatus === 'completed' ||
                            appt.checkinStatus === 'no_show' ||
                            appt.checkinStatus === 'cancelled'
                      )
                      .map((appt) => {
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
                        <tr key={appt.id} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center space-x-1.5">
                              <span>#{appt.trackingCode10Digit}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(appt.trackingCode10Digit)
                                  alert(`Copied 10-digit ID: ${appt.trackingCode10Digit}`)
                                }}
                                className="px-1.5 py-0.5 rounded liquid-glass-subtle hover:bg-brand-500/15 text-[10px] font-sans font-bold text-slate-600 dark:text-slate-300 hover:text-brand-700 cursor-pointer"
                                title="Copy 10-Digit Tracking ID"
                              >
                                Copy
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            <div>{appt.patientName}</div>
                            {appt.optInEarlyCall && (
                              <div className="mt-0.5">
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/40 text-[10px] font-bold">
                                  <Zap className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Early Call Opted-In</span>
                                </span>
                              </div>
                            )}
                            {appt.patientMobile && (
                              <a
                                href={`tel:${appt.patientMobile}`}
                                className="inline-flex items-center space-x-1 text-[11px] font-mono text-brand-700 dark:text-brand-400 hover:underline mt-0.5"
                                title="Call Patient Mobile"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{appt.patientMobile}</span>
                              </a>
                            )}
                            {appt.notes && (
                              <div className="mt-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-300/50 text-[10px] text-amber-900 dark:text-amber-200 font-medium">
                                Remark: {appt.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            {appt.patientAge || '–'} Yrs • {appt.patientGender || '–'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            {appt.doctor?.fullName || selectedDoctor?.fullName || 'General OPD'}
                          </td>
                          <td className="py-3.5 px-4">
                            {inCabin ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-400/40 animate-pulse">
                                Inside Cabin
                              </span>
                            ) : isDone ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border border-emerald-400/40">
                                Completed
                              </span>
                            ) : appt.checkinStatus === 'no_show' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-900 dark:text-rose-200 border border-rose-400/40">
                                No-Show
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-900 dark:text-sky-200 border border-sky-400/40">
                                Waiting
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  timing.isDoctorAway
                                    ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-400/40'
                                    : timing.isOnBreak
                                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/40'
                                    : timing.isSoonBeReady
                                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-400/40 animate-pulse'
                                    : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 border border-white/40'
                                }`}
                              >
                                {timing.estimatedWait}
                              </span>
                              {timing.exactTimeStr !== '–' &&
                                timing.exactTimeStr !== timing.estimatedWait && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    {timing.exactTimeStr}
                                  </p>
                                )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                appt.paymentStatus === 'paid'
                                  ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/40'
                                  : appt.paymentStatus === 'partial'
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40'
                                  : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 border border-white/40'
                              }`}
                            >
                              Rs. {appt.feeAmount || 500} • {appt.paymentStatus.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {/* Queue Sliding Up / Down for Waiting Patients */}
                            {isWaiting && (
                              <span className="inline-flex rounded-lg border border-white/50 dark:border-white/10 p-0.5 liquid-glass-subtle mr-1 align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleQueueReorder(appt.id, 'up')}
                                  className="p-1 hover:bg-white/60 text-slate-600 dark:text-slate-300 hover:text-brand-600 rounded cursor-pointer"
                                  title="Slide Up (Move higher in waiting ranking)"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQueueReorder(appt.id, 'down')}
                                  className="p-1 hover:bg-white/60 text-slate-600 dark:text-slate-300 hover:text-brand-600 rounded cursor-pointer"
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
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shadow-sm cursor-pointer active:scale-[0.98]"
                              >
                                Call Inside
                              </button>
                            )}

                            {/* Mark Done Button */}
                            {inCabin && (
                              <button
                                onClick={() => handleStatusChange(appt.id, 'completed')}
                                className="px-2.5 py-1.5 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white rounded-lg font-bold text-[11px] shadow-glass-brand border border-white/25 cursor-pointer active:scale-[0.98]"
                              >
                                Mark Done
                              </button>
                            )}

                            {/* Add / Edit Clinical Remark */}
                            <button
                              type="button"
                              onClick={() => handleOpenRemarkModal(appt)}
                              className="px-2 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-300/50 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Add or edit clinical remark / notes"
                            >
                              Remark
                            </button>

                            {/* Shift Appointment Date */}
                            <button
                              onClick={() => handleOpenShiftModal(appt)}
                              className="px-2 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 text-teal-800 dark:text-teal-300 border border-teal-300/50 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Shift appointment to another date"
                            >
                              Shift Date
                            </button>

                            {/* Print Token Slip */}
                            <button
                              onClick={() => handleOpenPrintSlip(appt)}
                              className="px-2 py-1.5 liquid-glass-subtle hover:bg-white/70 text-slate-700 dark:text-slate-200 border border-white/50 dark:border-white/10 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Print thermal token slip"
                            >
                              <Printer className="w-3.5 h-3.5 inline" />
                            </button>

                            {/* ⚡ Invite Early for Opted-In Patients */}
                            {appt.optInEarlyCall && isWaiting && (
                              <button
                                type="button"
                                onClick={() => handleSendEarlyInvite(appt)}
                                className="px-2 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-400/50 rounded-lg font-bold text-[11px] cursor-pointer inline-flex items-center space-x-1"
                                title="Send 'Doctor is free now. Come in early?' push notification to patient"
                              >
                                <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Invite Early</span>
                              </button>
                            )}

                            {/* Push Alert */}
                            <button
                              onClick={() => handleOpenPushAlertModal(appt)}
                              className="px-2 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-300/50 rounded-lg font-bold text-[11px] cursor-pointer"
                              title="Send real push notification template to patient"
                            >
                              Push Alert
                            </button>

                            {/* Push Bill / Update Payment */}
                            <button
                              onClick={() => handleOpenBillModal(appt)}
                              className="px-2 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-300/50 rounded-lg font-bold text-[11px] cursor-pointer"
                            >
                              Bill
                            </button>

                            {/* No Show */}
                            {!isDone && appt.checkinStatus !== 'no_show' && (
                              <button
                                onClick={() => handleStatusChange(appt.id, 'no_show')}
                                className="px-2 py-1.5 liquid-glass-subtle hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-white/50 dark:border-white/10 rounded-lg font-bold text-[11px] cursor-pointer"
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
          <GlassCard variant="elevated" padding="lg" radius="xl" specular className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Reception Walk-In Booking</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Register walk-in patients directly into the live OPD queue. Generates an instant 10-digit token code.
              </p>
            </div>

            {walkinSuccessCode && (
              <div className="p-4 bg-brand-50/80 backdrop-blur-md border border-brand-200/80 rounded-2xl flex items-center justify-between shadow-glass-sm">
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
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer shadow-glass-sm"
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
                    className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg cursor-pointer shadow-glass-sm"
                  >
                    New Booking
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleWalkinSubmit} className="space-y-4">
              {/* Type-Specific Notice Header */}
              {isLabClinic ? (
                <div className="p-3.5 bg-purple-50/80 backdrop-blur-md border border-purple-200/80 rounded-2xl flex items-center space-x-2.5 text-xs text-purple-900">
                  <FlaskConical className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="font-semibold">
                    Diagnostic Pathology Center Desk: Select tests to register sample collection token.
                  </span>
                </div>
              ) : isSingleDoctorClinic ? (
                <div className="p-3.5 bg-emerald-50/80 backdrop-blur-md border border-emerald-200/80 rounded-2xl flex items-center space-x-2.5 text-xs text-emerald-900">
                  <Stethoscope className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">
                    Single-Visit Clinic: Auto-assigning verified attending specialist.
                  </span>
                </div>
              ) : (
                /* Polyclinic Consultation Type Toggle */
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Consultation Type</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setWalkinIsFollowup(false)
                        setWalkinFollowupCode('')
                        setWalkinRetainedAppt(null)
                      }}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        !walkinIsFollowup
                          ? 'border-brand-600 bg-brand-50/70 backdrop-blur-md ring-2 ring-brand-500/20 font-bold text-slate-900 shadow-glass-sm'
                          : 'border-white/70 bg-white/55 backdrop-blur-md text-slate-600 hover:bg-white/80'
                      }`}
                    >
                      <div className="text-xs font-bold">New Patient</div>
                      <div className="text-[10px] text-slate-400">Normal OPD Fee</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalkinIsFollowup(true)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        walkinIsFollowup
                          ? 'border-emerald-600 bg-emerald-50/70 backdrop-blur-md ring-2 ring-emerald-500/20 font-bold text-emerald-900 shadow-glass-sm'
                          : 'border-white/70 bg-white/55 backdrop-blur-md text-slate-600 hover:bg-white/80'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>Follow-Up Visit</span>
                        <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black">FREE</span>
                      </div>
                      <div className="text-[10px] text-emerald-700">10-Digit ID lookup</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Polyclinic Follow-Up 10-Digit Code Lookup */}
              {isPolyclinic && walkinIsFollowup && (
                <div className="p-3.5 bg-emerald-50/75 backdrop-blur-md border border-emerald-200/80 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-emerald-900 block">
                    Enter Previous 10-Digit Appointment ID *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={10}
                      value={walkinFollowupCode}
                      onChange={(e) => setWalkinFollowupCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 8472910384"
                      className="w-full px-3.5 py-2 rounded-xl text-sm font-mono font-black border border-emerald-300 bg-white/85 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {walkinLookupLoading && (
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {walkinLookupError && (
                    <p className="text-[11px] text-rose-600 font-bold">{walkinLookupError}</p>
                  )}
                  {walkinRetainedAppt && (
                    <div className="p-2.5 bg-white/85 backdrop-blur-md border border-emerald-300 rounded-xl flex items-start space-x-2 text-xs text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Verified Patient: {walkinRetainedAppt.patientName}</strong>
                        <div className="text-[10px] text-slate-500">
                          Previous Visit: {walkinRetainedAppt.appointmentDate} • Token #{walkinRetainedAppt.trackingCode10Digit}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-700">✓ 100% Free Follow-Up Fee (Rs. 0)</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Patient Full Name */}
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
                    walkinErrors.name ? 'border-rose-500 bg-rose-50/50' : 'liquid-glass-input'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                />
                {walkinErrors.name && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{walkinErrors.name}</p>
                )}
              </div>

              {/* Age and Gender */}
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
                      walkinErrors.age ? 'border-rose-500 bg-rose-50/50' : 'liquid-glass-input'
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
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Mobile Number */}
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
                    walkinErrors.mobile ? 'border-rose-500 bg-rose-50/50' : 'liquid-glass-input'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                />
                {walkinErrors.mobile && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{walkinErrors.mobile}</p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional - auto-links to patient Google account)</span>
                </label>
                <input
                  type="email"
                  value={walkinEmail}
                  onChange={(e) => setWalkinEmail(e.target.value)}
                  placeholder="e.g. patient@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Diagnostic Lab Tests Checklist vs Doctor Selector */}
              {isLabClinic ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">
                      Select Diagnostic Pathology Tests <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-xs font-bold text-purple-700">
                      Total: Rs. {walkinSelectedTests.reduce((acc, t) => acc + (t.price || 0), 0)}
                    </span>
                  </div>

                  {services.length === 0 ? (
                    <div className="p-3 liquid-glass-subtle rounded-xl border border-white/70 text-xs text-slate-600 space-y-1.5">
                      {[
                        { id: 's1', serviceName: 'Complete Blood Count (CBC)', price: 450 },
                        { id: 's2', serviceName: 'Lipid Profile', price: 900 },
                        { id: 's3', serviceName: 'Liver Function Test (LFT)', price: 1100 },
                        { id: 's4', serviceName: 'Thyroid Function Test (TSH)', price: 1200 },
                        { id: 's5', serviceName: 'Fasting Blood Sugar (FBS)', price: 200 },
                      ].map((item) => {
                        const isChecked = walkinSelectedTests.some((t) => t.id === item.id)
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (isChecked) {
                                setWalkinSelectedTests(walkinSelectedTests.filter((t) => t.id !== item.id))
                              } else {
                                setWalkinSelectedTests([...walkinSelectedTests, item as any])
                              }
                            }}
                            className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                              isChecked ? 'bg-purple-50/85 border-purple-400 shadow-glass-sm' : 'bg-white/75 border-white/80'
                            }`}
                          >
                            <span className="font-semibold text-xs text-slate-800">{item.serviceName}</span>
                            <span className="font-bold text-xs text-slate-900">Rs. {item.price}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {services.map((s) => {
                        const isChecked = walkinSelectedTests.some((t) => t.id === s.id)
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (isChecked) {
                                setWalkinSelectedTests(walkinSelectedTests.filter((t) => t.id !== s.id))
                              } else {
                                setWalkinSelectedTests([...walkinSelectedTests, s])
                              }
                            }}
                            className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                              isChecked ? 'bg-purple-50/85 border-purple-400 shadow-glass-sm' : 'bg-white/75 border-white/80'
                            }`}
                          >
                            <span className="font-semibold text-xs text-slate-800">{s.serviceName}</span>
                            <span className="font-bold text-xs text-slate-900">Rs. {s.price || 500}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {walkinErrors.tests && (
                    <p className="text-[11px] text-rose-600 font-bold">{walkinErrors.tests}</p>
                  )}
                </div>
              ) : isSingleDoctorClinic ? (
                /* Single Doctor Card */
                <div className="p-3.5 bg-emerald-50/75 backdrop-blur-md border border-emerald-200/80 rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Attending Specialist Doctor
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-slate-900 text-sm">
                        {clinicDoctors[0]?.fullName || 'Verified Attending Specialist'}
                      </strong>
                      <div className="text-emerald-700 font-semibold">
                        {clinicDoctors[0]?.specialty || 'General Medicine'} • {clinicDoctors[0]?.education || 'MBBS, MD'}
                      </div>
                    </div>
                    <span className="font-black text-emerald-900 text-sm bg-white/85 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Rs. {clinicDoctors[0]?.consultationFee || 500}
                    </span>
                  </div>
                </div>
              ) : (
                /* Polyclinic Doctor Dropdown */
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Attending Specialist Doctor</label>
                  <select
                    value={walkinDoctorId}
                    onChange={(e) => setWalkinDoctorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {clinicDoctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.specialty || 'General'}) – {walkinIsFollowup && walkinRetainedAppt ? 'FREE' : `Rs. ${d.consultationFee || 500}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Consultation Time Slot Window Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Consultation Time Slot Window
                  </label>
                  {walkinAvailableSlots.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setWalkinUseCustomSlot(!walkinUseCustomSlot)
                        setWalkinSlotTime('')
                        setWalkinSlotId('')
                      }}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      {walkinUseCustomSlot ? 'Pick Published Slot' : 'Enter Custom Slot'}
                    </button>
                  )}
                </div>

                {!walkinUseCustomSlot && walkinAvailableSlots.length > 0 ? (
                  <select
                    value={walkinSlotId}
                    onChange={(e) => {
                      const selId = e.target.value
                      setWalkinSlotId(selId)
                      const found = walkinAvailableSlots.find((s) => s.id === selId)
                      if (found) {
                        setWalkinSlotTime(`${found.startTime} - ${found.endTime}`)
                      } else {
                        setWalkinSlotTime('')
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Current Time / Immediate OPD</option>
                    {walkinAvailableSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.startTime} - {s.endTime} ({s.bookedCount || 0}/{s.maxCapacity || 5} booked)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="e.g. 2:00 PM - 3:00 PM or 2-3 (Leave empty for Immediate OPD)"
                      value={walkinSlotTime}
                      onChange={(e) => {
                        setWalkinSlotTime(e.target.value)
                        setWalkinSlotId('')
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {['9:00 - 10:00 AM', '10:00 - 11:00 AM', '11:00 - 12:00 PM', '2:00 - 3:00 PM', '3:00 - 4:00 PM', '4:00 - 5:00 PM'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setWalkinSlotTime(preset)
                            setWalkinSlotId('')
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                            walkinSlotTime === preset
                              ? 'bg-brand-500 text-white border-brand-600'
                              : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Walk-in patient will be placed at the last position of the selected time slot, and all subsequent time slot patients will automatically shift down (+1).
                </p>
              </div>

              {/* Submit Button */}
              <GlassButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                {isLabClinic
                  ? `Issue Diagnostic Lab Token (Rs. ${walkinSelectedTests.reduce((acc, t) => acc + (t.price || 0), 0)})`
                  : walkinIsFollowup && walkinRetainedAppt
                  ? 'Issue Live OPD Token (100% FREE Follow-Up)'
                  : 'Issue Live OPD Token'}
              </GlassButton>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB: TIMED SLOTS PUBLISHER (SlotManagerScreen.kt) */}
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
              <GlassBadge variant="brand" size="md">
                {publishedSlots.length} Slots Published on {slotDate}
              </GlassBadge>
            </div>
          </div>

          {/* 14-Day Horizontal Date Strip (SlotManagerScreen.kt) */}
          <GlassCard variant="subtle" padding="md" radius="xl" className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Quick 14-Day Schedule Selector
            </span>
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {upcoming14Dates.map((d) => {
                const isSelected = slotDate === d.dateStr
                const isHol = selectedClinic?.declaredHolidays?.includes(d.dateStr)
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setSlotDate(d.dateStr)}
                    className={`px-3.5 py-2 rounded-2xl border text-center shrink-0 transition cursor-pointer ${
                      isSelected
                        ? 'bg-brand-600 border-brand-600 text-white shadow-glass-brand'
                        : isHol
                        ? 'bg-rose-50/80 border-rose-200 text-rose-700 backdrop-blur-md'
                        : 'bg-white/60 border-white/80 text-slate-700 hover:bg-white/90 backdrop-blur-md'
                    }`}
                  >
                    <span className="text-[10px] font-bold block uppercase opacity-80">{d.dayShort}</span>
                    <span className="text-sm font-black block">{d.dayNum} {d.monthShort}</span>
                  </button>
                )
              })}
            </div>
          </GlassCard>

          {/* Quick Doctor & Date Selector Bar */}
          <GlassCard variant="base" padding="md" radius="xl" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Select Attending Doctor <span className="text-rose-500">*</span>
              </label>
              <select
                value={slotDoctorId}
                onChange={(e) => setSlotDoctorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Publish Single Slot or Quick Presets */}
            <div className="space-y-6">
              {/* Manual Slot Creator */}
              <GlassCard variant="base" padding="md" radius="xl" className="space-y-4">
                <div className="flex items-center space-x-2 text-brand-700 font-black text-sm pb-2 border-b border-white/60">
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
                        className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                        className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <GlassButton
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    disabled={publishingSlot}
                  >
                    {publishingSlot ? 'Publishing...' : 'Publish Timed Slot'}
                  </GlassButton>
                </form>
              </GlassCard>

              {/* Quick Preset Generators */}
              <GlassCard variant="base" padding="md" radius="xl" className="space-y-3">
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
                    className="w-full py-2.5 px-3 bg-white/60 hover:bg-brand-50/80 hover:text-brand-700 border border-white/80 hover:border-brand-200 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer flex items-center justify-between shadow-glass-sm"
                  >
                    <span>Morning: 09:00 AM – 12:00 PM</span>
                    <span className="text-[10px] text-brand-600 font-mono">12 Slots &rarr;</span>
                  </button>

                  <button
                    type="button"
                    disabled={publishingSlot}
                    onClick={() => handleGenerateBulkSlots(13, 16, 15)}
                    className="w-full py-2.5 px-3 bg-white/60 hover:bg-brand-50/80 hover:text-brand-700 border border-white/80 hover:border-brand-200 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer flex items-center justify-between shadow-glass-sm"
                  >
                    <span>Afternoon: 01:00 PM – 04:00 PM</span>
                    <span className="text-[10px] text-brand-600 font-mono">12 Slots &rarr;</span>
                  </button>

                  <button
                    type="button"
                    disabled={publishingSlot}
                    onClick={() => handleGenerateBulkSlots(16, 19, 15)}
                    className="w-full py-2.5 px-3 bg-white/60 hover:bg-brand-50/80 hover:text-brand-700 border border-white/80 hover:border-brand-200 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer flex items-center justify-between shadow-glass-sm"
                  >
                    <span>Evening: 04:00 PM – 07:00 PM</span>
                    <span className="text-[10px] text-brand-600 font-mono">12 Slots &rarr;</span>
                  </button>
                </div>
              </GlassCard>
            </div>

            {/* Right Column (2 cols): Published Slots Grid */}
            <div className="lg:col-span-2 space-y-4">
              <GlassCard variant="base" padding="md" radius="xl" className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/60">
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
                          className="p-3.5 liquid-glass-subtle hover:bg-white/80 rounded-2xl border border-white/75 flex items-center justify-between transition-colors gap-2 shadow-glass-sm"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-slate-900 font-mono">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isFull
                                    ? 'bg-rose-100/90 text-rose-800'
                                    : 'bg-brand-100/90 text-brand-800'
                                }`}
                              >
                                {isFull ? 'Full' : 'Available'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Booked: {slot.bookedCount || 0} / {slot.maxCapacity || 5}
                              </span>
                            </div>
                          </div>

                          {/* Slot Actions from SlotManagerScreen.kt: -30m, Edit Capacity, Delete */}
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSubtract30MinsFromSlot(slot)}
                              className="px-2 py-1 text-[10px] font-bold bg-amber-50/85 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg cursor-pointer"
                              title="Shorten slot end time by 30 minutes"
                            >
                              -30m
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSlotCapacity(slot)
                                setNewSlotCapacityVal(slot.maxCapacity || 5)
                              }}
                              className="px-2 py-1 text-[10px] font-bold bg-white/80 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-white/90 rounded-lg cursor-pointer"
                              title="Edit max patients capacity"
                            >
                              Cap
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl transition-colors cursor-pointer"
                              title="Delete this time slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 3: FUTURE APPOINTMENTS & DECLARE HOLIDAY */}
      {/* ========================================================= */}
      {deskTab === 'future_appts' && (
        <div className="space-y-6">
          {/* 14-Day Horizontal Date Strip with Holiday & Booking Indicators (FutureAppointmentsScreen.kt) */}
          <GlassCard variant="subtle" padding="md" radius="xl" className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              14-Day Upcoming OPD Calendar Strip
            </span>
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {upcoming14Dates.map((d) => {
                const isSelected = futureSelectedDate === d.dateStr
                const isHol = selectedClinic?.declaredHolidays?.includes(d.dateStr)
                const apptCount = appointments.filter((a) => a.appointmentDate === d.dateStr).length
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setFutureSelectedDate(d.dateStr)}
                    className={`px-3.5 py-2 rounded-2xl border text-center shrink-0 transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-brand-600 border-brand-600 text-white shadow-glass-brand'
                        : isHol
                        ? 'bg-rose-50/80 border-rose-300 text-rose-800 backdrop-blur-md'
                        : 'bg-white/60 border-white/80 text-slate-700 hover:bg-white/90 backdrop-blur-md'
                    }`}
                  >
                    <span className="text-[10px] font-bold block uppercase opacity-80">{d.dayShort}</span>
                    <span className="text-sm font-black block">{d.dayNum} {d.monthShort}</span>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      {isHol && (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-rose-600 text-white">
                          Closed
                        </span>
                      )}
                      {apptCount > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                            isSelected ? 'bg-white text-brand-700' : 'bg-brand-100 text-brand-800'
                          }`}
                        >
                          {apptCount} OPD
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </GlassCard>

          {/* Top Control Bar: Date Selector & Declare Holiday Toggle */}
          <GlassCard variant="base" padding="md" radius="xl" className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900">Future Appointments & Holiday Desk</h2>
              <p className="text-xs text-slate-500">
                Select any upcoming date to view scheduled appointments or declare the clinic closed on holidays.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Sub-filter Pills (FutureAppointmentsScreen.kt: All / Waiting / Completed) */}
              <div className="flex p-1 liquid-glass-subtle rounded-xl border border-white/70">
                {(['all', 'waiting', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFutureSubFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                      futureSubFilter === f
                        ? 'bg-white/90 text-brand-700 shadow-glass-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'waiting' ? 'Waiting / Active' : 'Completed'}
                  </button>
                ))}
              </div>

              {/* Date Input */}
              <input
                type="date"
                value={futureSelectedDate}
                onChange={(e) => setFutureSelectedDate(e.target.value)}
                className="px-3.5 py-2 rounded-xl liquid-glass-input text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              {/* Declare Holiday Toggle */}
              <button
                type="button"
                onClick={() => handleToggleHolidayForDate(futureSelectedDate)}
                disabled={togglingHoliday}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isSelectedDateHoliday
                    ? 'bg-rose-600 border-rose-600 text-white shadow-glass-sm'
                    : 'bg-white/65 border-white/80 text-slate-700 hover:bg-rose-50 hover:text-rose-700 backdrop-blur-md'
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
          </GlassCard>

          {/* Holiday Notice Banner if declared */}
          {isSelectedDateHoliday && (
            <div className="p-4 bg-rose-50/85 backdrop-blur-md border border-rose-200/80 rounded-2xl flex items-center space-x-3 text-rose-800 text-xs font-bold shadow-glass-sm">
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
          <GlassCard variant="base" padding="none" radius="xl" className="overflow-hidden">
            <div className="p-4 bg-white/45 backdrop-blur-md border-b border-white/70 flex items-center justify-between">
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
                  <thead className="bg-white/45 text-slate-500 uppercase tracking-wider font-bold border-b border-white/60">
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
                  <tbody className="divide-y divide-slate-200/50 font-medium">
                    {futureDateAppointments
                      .filter((appt) =>
                        futureSubFilter === 'all'
                          ? true
                          : futureSubFilter === 'waiting'
                          ? appt.checkinStatus === 'waiting' || appt.checkinStatus === 'in_consultation'
                          : appt.checkinStatus === 'completed'
                      )
                      .map((appt) => (
                      <tr key={appt.id} className="hover:bg-white/45 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          #{appt.trackingCode10Digit}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>{appt.patientName}</div>
                          {appt.optInEarlyCall && (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 border border-emerald-400/40 text-[10px] font-bold">
                                <Zap className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Early Call Opted-In</span>
                              </span>
                            </div>
                          )}
                          {appt.notes && (
                            <div className="mt-0.5 text-[10px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200 inline-block">
                              Remark: {appt.notes}
                            </div>
                          )}
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
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/75 border border-white/80 text-slate-800">
                            {appt.checkinStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-brand-700">
                          Rs. {appt.feeAmount} ({appt.paymentStatus})
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenRemarkModal(appt)}
                            className="px-2.5 py-1 bg-amber-50/85 text-amber-900 hover:bg-amber-100 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Remark
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenShiftModal(appt)}
                            className="px-2.5 py-1 bg-teal-50/85 text-teal-800 hover:bg-teal-100 rounded-lg text-[11px] font-bold cursor-pointer"
                            title="Shift appointment to another date"
                          >
                            Shift Date
                          </button>
                          {appt.optInEarlyCall && appt.checkinStatus !== 'completed' && appt.checkinStatus !== 'no_show' && (
                            <button
                              type="button"
                              onClick={() => handleSendEarlyInvite(appt)}
                              className="px-2.5 py-1 bg-emerald-50/85 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center space-x-1"
                              title="Send 'Doctor is free now. Come in early?' push alert to patient"
                            >
                              <Zap className="w-3 h-3 text-emerald-600" />
                              <span>Invite Early</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenPushAlertModal(appt)}
                            className="px-2.5 py-1 bg-purple-50/85 text-purple-700 hover:bg-purple-100 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Push Alert
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBillModal(appt)}
                            className="px-2.5 py-1 bg-blue-50/85 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-bold cursor-pointer"
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
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB: NO-SHOW PATIENTS DESK (DashboardScreen.kt)      */}
      {/* ========================================================= */}
      {deskTab === 'noshow' && (
        <div className="space-y-6">
          <GlassCard variant="base" padding="md" radius="xl" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>No-Show Patients Management Desk</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Review patients marked as No-Show. Restore them back into the active waiting queue if they arrive late, or reschedule their appointment date.
              </p>
            </div>
            <GlassBadge variant="danger" size="md">
              {noShowAppointments.length} No-Show Records
            </GlassBadge>
          </GlassCard>

          {noShowAppointments.length === 0 ? (
            <GlassCard variant="subtle" padding="lg" radius="xl" className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-sm">Zero No-Show Patients</h3>
              <p className="text-xs text-slate-500 mt-1">
                All registered patients have attended or are actively waiting in queue.
              </p>
            </GlassCard>
          ) : (
            <GlassCard variant="base" padding="none" radius="xl" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50/75 border-b border-rose-100 text-rose-900 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Token Code</th>
                      <th className="py-3.5 px-4">Patient Name</th>
                      <th className="py-3.5 px-4">Mobile</th>
                      <th className="py-3.5 px-4">Scheduled Date</th>
                      <th className="py-3.5 px-4">Doctor</th>
                      <th className="py-3.5 px-4 text-right">Recovery Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/50 font-medium">
                    {noShowAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-white/45 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          #{appt.trackingCode10Digit}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {appt.patientName}
                        </td>
                        <td className="py-3.5 px-4">
                          {appt.patientMobile ? (
                            <a
                              href={`tel:${appt.patientMobile}`}
                              className="text-brand-700 font-mono font-bold hover:underline"
                            >
                              {appt.patientMobile}
                            </a>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{appt.appointmentDate}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {appt.doctor?.fullName || selectedDoctor?.fullName || 'OPD Doctor'}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(appt.id, 'waiting')}
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-[11px] cursor-pointer shadow-glass-sm"
                          >
                            Restore to Waiting Queue
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenShiftModal(appt)}
                            className="px-3 py-1.5 bg-teal-50/85 hover:bg-teal-100 text-teal-800 rounded-xl font-bold text-[11px] cursor-pointer"
                          >
                            Reschedule Date
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPushAlertModal(appt)}
                            className="px-3 py-1.5 bg-purple-50/85 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-[11px] cursor-pointer"
                          >
                            Push Alert
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB: CONSULTATION FEES MANAGER (ConsultationFeeManagerScreen.kt) */}
      {/* ========================================================= */}
      {deskTab === 'fees' && (
        <div className="space-y-6">
          <GlassCard variant="base" padding="md" radius="xl" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Doctor Consultation Fees Manager
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure OPD consultation fees for each enlisted doctor. Changes sync immediately to walk-in reception, online bookings, and billing invoices.
              </p>
            </div>
            <GlassBadge variant="brand" size="md">
              {clinicDoctors.length} Enlisted Doctors
            </GlassBadge>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clinicDoctors.map((doc) => {
              const currentFeeVal =
                editingDoctorFees[doc.id] !== undefined
                  ? editingDoctorFees[doc.id]
                  : doc.consultationFee || 500
              return (
                <GlassCard
                  key={doc.id}
                  variant="base"
                  padding="md"
                  radius="xl"
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-brand-100/80 text-brand-800 font-black flex items-center justify-center overflow-hidden shadow-glass-sm">
                        {doc.profilePictureUrl ? (
                          <img src={doc.profilePictureUrl} alt={doc.fullName} className="w-full h-full object-cover" />
                        ) : (
                          doc.fullName.charAt(0)
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{doc.fullName}</h3>
                        <p className="text-xs text-brand-700 font-bold">{doc.specialty || 'General Physician'}</p>
                      </div>
                    </div>
                    <GlassBadge variant="success" size="sm">
                      Current: Rs. {doc.consultationFee || 500}
                    </GlassBadge>
                  </div>

                  {/* Quick Fee Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Quick Fee Presets (NPR):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[300, 500, 700, 800, 1000, 1200, 1500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setEditingDoctorFees({ ...editingDoctorFees, [doc.id]: preset })
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition ${
                            currentFeeVal === preset
                              ? 'bg-brand-600 text-white border-brand-600 shadow-glass-sm'
                              : 'bg-white/65 text-slate-700 border-white/80 hover:bg-white/90'
                          }`}
                        >
                          Rs. {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={0}
                      value={currentFeeVal}
                      onChange={(e) =>
                        setEditingDoctorFees({
                          ...editingDoctorFees,
                          [doc.id]: Number(e.target.value) || 0,
                        })
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-black focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="md"
                      disabled={savingDocFeeId === doc.id}
                      onClick={() => handleSaveDoctorFee(doc, currentFeeVal)}
                    >
                      {savingDocFeeId === doc.id ? 'Saving...' : 'Update Fee'}
                    </GlassButton>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB: DOCTOR & STAFF INVITATIONS (InvitationManagerScreen.kt) */}
      {/* ========================================================= */}
      {deskTab === 'invitations' && (
        <div className="space-y-6">
          <GlassCard variant="base" padding="md" radius="xl" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Doctor & Clinical Staff Invitations
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Search verified Dactor practitioners across Nepal, inspect their full NMC credentials, and invite them to join {selectedClinic?.name}.
              </p>
            </div>
            <div className="flex p-1 liquid-glass-subtle rounded-2xl border border-white/70">
              <button
                type="button"
                onClick={() => setInviteSubTab('find')}
                className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
                  inviteSubTab === 'find'
                    ? 'bg-white/90 text-brand-700 shadow-glass-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Find & Invite Staff ({allSystemDoctors.length})
              </button>
              <button
                type="button"
                onClick={() => setInviteSubTab('sent')}
                className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
                  inviteSubTab === 'sent'
                    ? 'bg-white/90 text-brand-700 shadow-glass-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sent Invitations ({clinicInvitations.length})
              </button>
            </div>
          </GlassCard>

          {inviteSubTab === 'find' ? (
            <div className="space-y-6">
              {/* Direct Custom Email Invite Card */}
              <form
                onSubmit={handleSendCustomStaffInvitation}
                className="liquid-glass-card p-6 rounded-3xl space-y-4"
              >
                <h3 className="text-xs font-black uppercase tracking-wider text-brand-700">
                  Send Direct Invitation by Google Email
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={customInviteName}
                    onChange={(e) => setCustomInviteName(e.target.value)}
                    placeholder="Doctor / Technician Name"
                    className="px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold"
                    required
                  />
                  <input
                    type="email"
                    value={customInviteEmail}
                    onChange={(e) => setCustomInviteEmail(e.target.value)}
                    placeholder="practitioner@gmail.com"
                    className="px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold"
                    required
                  />
                  <select
                    value={customInviteRole}
                    onChange={(e) => setCustomInviteRole(e.target.value as any)}
                    className="px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-bold"
                  >
                    <option value="doctor">Medical Doctor</option>
                    <option value="lab_technician">Lab Technician</option>
                  </select>
                  <GlassButton
                    type="submit"
                    variant="primary"
                    size="md"
                  >
                    Send Invitation
                  </GlassButton>
                </div>
              </form>

              {/* Filter & Search Bar */}
              <GlassCard variant="subtle" padding="md" radius="xl" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {(['all', 'doctor', 'lab_technician'] as const).map((rf) => (
                    <button
                      key={rf}
                      type="button"
                      onClick={() => setInviteRoleFilter(rf)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                        inviteRoleFilter === rf
                          ? 'bg-brand-600 text-white shadow-glass-sm'
                          : 'bg-white/65 border border-white/80 text-slate-600 hover:bg-white/90'
                      }`}
                    >
                      {rf === 'all' ? 'All Roles' : rf === 'doctor' ? 'Doctors' : 'Lab Staff'}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={inviteSearchQuery}
                    onChange={(e) => setInviteSearchQuery(e.target.value)}
                    placeholder="Search by Doctor Name, Specialty, NMC License, or Email..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl liquid-glass-input text-xs font-semibold"
                  />
                </div>
              </GlassCard>

              {/* System Doctors Directory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allSystemDoctors
                  .filter((d) =>
                    inviteRoleFilter === 'all'
                      ? true
                      : (d.practitionerRole || (d.isLabTechnician ? 'lab_technician' : 'doctor')) ===
                        inviteRoleFilter
                  )
                  .filter((d) => {
                    if (!inviteSearchQuery.trim()) return true
                    const q = inviteSearchQuery.toLowerCase()
                    return (
                      d.fullName.toLowerCase().includes(q) ||
                      (d.specialty || '').toLowerCase().includes(q) ||
                      (d.nmcLicenseNumber || '').toLowerCase().includes(q) ||
                      (d.email || '').toLowerCase().includes(q)
                    )
                  })
                  .map((doc) => {
                    const alreadyEnlisted = clinicDoctors.some((cd) => cd.id === doc.id)
                    const alreadyInvited = clinicInvitations.some(
                      (inv) =>
                        inv.status === 'pending' &&
                        inv.invitedEmail.toLowerCase() === (doc.email || '').toLowerCase()
                    )
                    return (
                      <GlassCard
                        key={doc.id}
                        variant="base"
                        padding="md"
                        radius="xl"
                        className="space-y-4 flex flex-col justify-between"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-13 h-13 rounded-2xl bg-brand-100/80 text-brand-800 font-black text-lg flex items-center justify-center overflow-hidden shrink-0 shadow-glass-sm">
                            {doc.profilePictureUrl ? (
                              <img
                                src={doc.profilePictureUrl}
                                alt={doc.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              doc.fullName.charAt(0)
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900">{doc.fullName}</h4>
                            <p className="text-xs font-bold text-brand-700">
                              {doc.specialty || 'General Physician'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {doc.education || 'MBBS'} • NMC: {doc.nmcLicenseNumber || 'Verified'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-white/60">
                          <button
                            type="button"
                            onClick={() => setViewingDoctorProfile(doc)}
                            className="flex-1 py-2 px-3 rounded-xl border border-white/80 bg-white/65 hover:bg-white/90 text-slate-700 font-bold text-xs cursor-pointer transition"
                          >
                            View Full Profile
                          </button>
                          {alreadyEnlisted ? (
                            <span className="px-3 py-2 rounded-xl bg-emerald-50/85 text-emerald-800 text-xs font-black">
                              ✓ Enlisted
                            </span>
                          ) : alreadyInvited ? (
                            <span className="px-3 py-2 rounded-xl bg-amber-50/85 text-amber-800 text-xs font-black">
                              Pending Invite
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendDoctorInvitation(doc)}
                              className="flex-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs cursor-pointer shadow-glass-sm transition"
                            >
                              Invite to Clinic
                            </button>
                          )}
                        </div>
                      </GlassCard>
                    )
                  })}
              </div>
            </div>
          ) : (
            <GlassCard variant="base" padding="none" radius="xl" className="overflow-hidden">
              {clinicInvitations.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No staff invitations have been sent from this clinic yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/45 border-b border-white/70 text-slate-500 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="py-3.5 px-4">Practitioner Name</th>
                        <th className="py-3.5 px-4">Email</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 font-medium">
                      {clinicInvitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/45 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{inv.invitedName}</td>
                          <td className="py-3.5 px-4 text-slate-600">{inv.invitedEmail}</td>
                          <td className="py-3.5 px-4 capitalize">{inv.role}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                inv.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {inv.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleCancelStaffInvitation(inv.id)}
                                className="px-3 py-1 bg-rose-50/85 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] cursor-pointer"
                              >
                                Cancel / Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 4: WORKING HOURS & BREAK MANAGEMENT */}
      {/* ========================================================= */}
      {deskTab === 'working_hours' && (
        <div className="space-y-6">
          {/* Header Notice */}
          <GlassCard variant="base" padding="md" radius="xl" className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyMonHoursToAll}
              >
                Copy Mon Hours to Weekdays
              </GlassButton>
            </div>
          </GlassCard>

          {scheduleSaveSuccess && (
            <div className="p-4 bg-brand-50/85 backdrop-blur-md border border-brand-200/80 rounded-2xl flex items-center space-x-2 text-brand-800 text-xs font-bold shadow-glass-sm">
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
              <span>Weekly operational schedule successfully saved to clinic profile!</span>
            </div>
          )}

          {/* 7 Days Schedule Grid Form */}
          <form onSubmit={handleSaveWeeklySchedule} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weeklySchedule.map((sched, idx) => (
                <GlassCard
                  key={sched.day}
                  variant="base"
                  padding="md"
                  radius="lg"
                  className="space-y-3.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/60">
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
                              className="w-full px-2.5 py-1.5 rounded-lg liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                              className="w-full px-2.5 py-1.5 rounded-lg liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/60">
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
                                className="w-full px-2.5 py-1.5 rounded-lg liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                                className="w-full px-2.5 py-1.5 rounded-lg liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                </GlassCard>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <GlassButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={savingSchedule}
              >
                {savingSchedule ? 'Saving Schedule...' : 'Save Weekly Operational Schedule'}
              </GlassButton>
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
            <GlassButton
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowDoctorOnboarding(true)}
            >
              Add New Doctor
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clinicDoctors.map((doc) => (
              <GlassCard
                key={doc.id}
                variant="base"
                padding="md"
                radius="xl"
                className="space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-14 h-14 rounded-2xl bg-brand-100/80 text-brand-800 flex items-center justify-center font-black text-xl shrink-0 overflow-hidden border border-white/80 shadow-glass-sm relative group">
                      {doc.profilePictureUrl ? (
                        <img
                          src={doc.profilePictureUrl}
                          alt={doc.fullName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        doc.fullName.charAt(0)
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenDoctorPhotoUpload(doc)}
                        className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-[9px] font-bold cursor-pointer"
                        title="Upload or change doctor photo"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Photo</span>
                      </button>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{doc.fullName}</h3>
                      <p className="text-xs text-brand-700 font-bold">{doc.specialty || 'General'}</p>
                      <button
                        type="button"
                        onClick={() => handleOpenDoctorPhotoUpload(doc)}
                        className="mt-1 text-[10px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>{doc.profilePictureUrl ? 'Change Photo' : '+ Upload Photo'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Presence Toggle button for this doctor */}
                  <button
                    type="button"
                    onClick={() => handleToggleDoctorPresence(doc)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                      doc.isInClinic ?? true
                        ? 'bg-brand-50/85 border-brand-300 text-brand-800'
                        : 'bg-rose-50/85 border-rose-300 text-rose-800'
                    }`}
                  >
                    {doc.isInClinic ?? true ? '● In Clinic' : '○ Away'}
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-1 border-t border-white/60">
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
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 6: BILLS & PAYMENTS DIRECTORY (BillingScreen.kt) */}
      {/* ========================================================= */}
      {deskTab === 'billing' && (
        <div className="space-y-6">
          <GlassCard variant="base" padding="md" radius="xl" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">Clinic Billing & Invoices Directory</h2>
              <p className="text-xs text-slate-500">
                Track all patient payments, total bills, balance due, and dates. Filter by date or generate thermal receipts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={billingDateFilter === 'all' ? '' : billingDateFilter}
                onChange={(e) => setBillingDateFilter(e.target.value || 'all')}
                className="px-3 py-1.5 rounded-xl liquid-glass-input text-xs font-bold text-slate-800"
              />
              {billingDateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setBillingDateFilter('all')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/75 border border-white/80 hover:bg-white text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Show All Dates
                </button>
              )}
              <GlassBadge variant="brand" size="md">
                {invoices.length} Invoices Recorded
              </GlassBadge>
            </div>
          </GlassCard>

          <GlassCard variant="base" padding="none" radius="xl" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/45 border-b border-white/70 text-slate-500 uppercase tracking-wider font-bold">
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
                <tbody className="divide-y divide-slate-200/50 font-medium">
                  {invoices
                    .filter((inv) =>
                      billingDateFilter === 'all'
                        ? true
                        : (inv.createdAt?.split('T')[0] || '') === billingDateFilter
                    )
                    .map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/45 transition-colors">
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
                              ? 'bg-brand-100/90 text-brand-800'
                              : inv.paymentStatus === 'partial'
                              ? 'bg-amber-100/90 text-amber-800'
                              : 'bg-rose-100/90 text-rose-800'
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
          </GlassCard>

          {/* Clinic Direct Billing Catalog Manager (CatalogManagerScreen.kt) */}
          <GlassCard variant="base" padding="md" radius="xl" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-white/60">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-brand-600" />
                  <span>Clinic Billing Item Catalog</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure direct items for 1-click billing. Clicking any catalog item adds it instantly to patient invoices.
                </p>
              </div>
              <GlassBadge variant="neutral" size="sm">
                {services.length} Catalog Items
              </GlassBadge>
            </div>

            {/* Category Filter Tabs & Search Bar (CatalogManagerScreen.kt) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Hematology', 'Biochemistry', 'Radiology & Imaging', 'Clinical Pathology', 'Consultation'].map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatalogCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition ${
                        catalogCategoryFilter === cat
                          ? 'bg-brand-600 text-white shadow-glass-sm'
                          : 'bg-white/65 border border-white/80 text-slate-600 hover:bg-white/90'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
              <input
                type="text"
                value={catalogSearchQuery}
                onChange={(e) => setCatalogSearchQuery(e.target.value)}
                placeholder="Search catalog items..."
                className="px-3.5 py-1.5 rounded-xl liquid-glass-input text-xs font-semibold sm:w-56"
              />
            </div>

            {/* Form to add item to catalog */}
            <form onSubmit={handleAddService} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 liquid-glass-subtle rounded-2xl border border-white/75">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Item / Service Name</label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. ECG Test, Blood Sugar, Dressing"
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
              <div className="flex items-end">
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  fullWidth
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add to Catalog
                </GlassButton>
              </div>
            </form>

            {/* List of Catalog Items */}
            {services.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No custom catalog items yet. Add consultation or procedure items above to enable 1-click billing chips.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {services
                  .filter((item) =>
                    catalogCategoryFilter === 'All'
                      ? true
                      : (item.category || '').toLowerCase() === catalogCategoryFilter.toLowerCase()
                  )
                  .filter((item) =>
                    !catalogSearchQuery.trim()
                      ? true
                      : item.serviceName.toLowerCase().includes(catalogSearchQuery.toLowerCase())
                  )
                  .map((item) => (
                  <div
                    key={item.id}
                    className="p-3 liquid-glass-subtle hover:bg-white/80 rounded-2xl border border-white/75 flex items-center justify-between transition-colors shadow-glass-sm"
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 7: PATIENT DIRECTORY & HISTORY */}
      {/* ========================================================= */}
      {deskTab === 'patients' && (
        <div className="space-y-6">
          <GlassCard variant="base" padding="md" radius="xl" className="space-y-4">
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
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <GlassButton
                type="submit"
                variant="primary"
                size="md"
                disabled={searchingPatients}
              >
                {searchingPatients ? 'Searching...' : 'Search'}
              </GlassButton>
            </form>
          </GlassCard>

          {/* Search Results Table */}
          {patientSearchResults.length > 0 && (
            <GlassCard variant="base" padding="none" radius="xl" className="overflow-hidden">
              <div className="p-4 bg-white/45 border-b border-white/70 flex justify-between items-center">
                <h3 className="font-bold text-xs text-slate-700">
                  Search Results ({patientSearchResults.length} Visits Found)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/45 text-slate-500 uppercase tracking-wider font-bold border-b border-white/60">
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
                  <tbody className="divide-y divide-slate-200/50 font-medium">
                    {patientSearchResults.map((res) => (
                      <tr key={res.id} className="hover:bg-white/45 transition-colors">
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
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/75 border border-white/80 text-slate-800">
                            {res.checkinStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-brand-700">
                          Rs. {res.feeAmount} ({res.paymentStatus})
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenBillModal(res)}
                            className="px-2.5 py-1 bg-blue-50/85 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            View / Push Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Patient Directory Table */}
          <GlassCard variant="base" padding="none" radius="xl" className="overflow-hidden">
            <div className="p-4 bg-white/45 border-b border-white/70 flex justify-between items-center">
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
                  <thead className="bg-white/45 text-slate-500 uppercase tracking-wider font-bold border-b border-white/60">
                    <tr>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Gender & Age</th>
                      <th className="py-3 px-4">Total Visits</th>
                      <th className="py-3 px-4">Last Visit</th>
                      <th className="py-3 px-4">Tracking Code(s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/50 font-medium">
                    {patientDirectory.map((pat) => (
                      <tr key={pat.id} className="hover:bg-white/45 transition-colors">
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
                            {pat.trackingCodes.slice(0, 2).map((code: string) => (
                              <span
                                key={code}
                                className="px-2 py-0.5 rounded-md bg-white/75 border border-white/80 text-slate-800 font-mono text-[10px] font-bold"
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
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 8: DIAGNOSTIC LAB 3-STAGE PIPELINE (LabWorkflowScreen.kt) */}
      {/* ========================================================= */}
      {deskTab === 'lab' && isDiagnosticLab && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              className="flex items-center space-x-1.5 text-xs font-bold text-teal-700 bg-teal-50/85 border border-teal-200 px-3 py-1.5 rounded-xl cursor-pointer self-start sm:self-auto shadow-glass-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Lab Queue</span>
            </button>
          </div>

          {/* 3 Sub-Tabs + Search Bar (LabWorkflowScreen.kt) */}
          <GlassCard variant="subtle" padding="md" radius="xl" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex p-1 liquid-glass-subtle rounded-2xl border border-white/75">
              {(['all', 'processing', 'prepared'] as const).map((lt) => (
                <button
                  key={lt}
                  type="button"
                  onClick={() => setLabSubTab(lt)}
                  className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition ${
                    labSubTab === lt
                      ? 'bg-white/95 text-teal-700 shadow-glass-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lt === 'all'
                    ? 'All Lab Orders'
                    : lt === 'processing'
                    ? 'Processing in Lab'
                    : 'Prepared & Ready'}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={labSearchQuery}
                onChange={(e) => setLabSearchQuery(e.target.value)}
                placeholder="Search by 10-Digit Code, Patient Name, or Test..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl liquid-glass-input text-xs font-semibold"
              />
            </div>
          </GlassCard>

          <GlassCard variant="base" padding="none" radius="xl" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-teal-50/75 border-b border-teal-100 text-teal-900 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Tracking Code</th>
                    <th className="py-3.5 px-4">Patient Name</th>
                    <th className="py-3.5 px-4">Tests Ordered</th>
                    <th className="py-3.5 px-4">Current Lab Status</th>
                    <th className="py-3.5 px-4 text-right">Lab Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 font-medium">
                  {appointments
                    .filter((appt) => {
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
                      if (labSubTab === 'processing' && labStatus !== 'processing') return false
                      if (labSubTab === 'prepared' && labStatus !== 'prepared') return false
                      if (labSearchQuery.trim()) {
                        const q = labSearchQuery.toLowerCase()
                        return (
                          appt.trackingCode10Digit.toLowerCase().includes(q) ||
                          appt.patientName.toLowerCase().includes(q)
                        )
                      }
                      return true
                    })
                    .map((appt) => {
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
                      <tr key={appt.id} className="hover:bg-white/45 transition-colors">
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
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-100/90 text-brand-800">
                              Prepared (Ready)
                            </span>
                          ) : labStatus === 'processing' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100/90 text-blue-800 animate-pulse">
                              Processing in Lab
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100/90 text-amber-800">
                              Sample Collected
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          {labStatus !== 'processing' && labStatus !== 'prepared' && (
                            <button
                              onClick={() => handleStatusChange(appt.id, 'in_consultation')}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] shadow-glass-sm cursor-pointer"
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
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-[11px] shadow-glass-sm cursor-pointer"
                            >
                              Mark Prepared & Upload
                            </button>
                          )}
                          {labStatus === 'prepared' && relatedReport?.reportFileUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setLabVerifyTargetReport({ report: relatedReport, appt })
                                setLabVerifyInput('')
                                setLabVerifyError(null)
                              }}
                              className="px-2.5 py-1 bg-teal-50/85 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg font-bold text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Verify & View Report</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 9: MANAGE LAB TESTS & PRICING RATES (CatalogManagerScreen.kt) */}
      {/* ========================================================= */}
      {deskTab === 'rates' && isDiagnosticLab && (
        <div className="space-y-6">
          {/* 1-Click Common Diagnostic Test Presets (CatalogManagerScreen.kt) */}
          <GlassCard variant="base" padding="md" radius="xl" className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-teal-700">
              ⚡ 1-Click Common Pathology & Diagnostic Presets
            </h3>
            <p className="text-xs text-slate-500">
              Click any standard Nepal laboratory test below to add it immediately to your clinic's published rate list:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'Complete Blood Count (CBC)', price: 450, cat: 'Hematology' },
                { name: 'Fasting Blood Sugar (FBS)', price: 150, cat: 'Biochemistry' },
                { name: 'HbA1c (Glycated Hemoglobin)', price: 750, cat: 'Biochemistry' },
                { name: 'Lipid Profile', price: 900, cat: 'Biochemistry' },
                { name: 'Liver Function Test (LFT)', price: 850, cat: 'Biochemistry' },
                { name: 'Renal Function Test (RFT)', price: 800, cat: 'Biochemistry' },
                { name: 'Thyroid Profile (T3, T4, TSH)', price: 1100, cat: 'Hormones & Immunology' },
                { name: 'Urine Routine Examination (R/E)', price: 200, cat: 'Clinical Pathology' },
                { name: 'Digital X-Ray Chest PA', price: 600, cat: 'Radiology & Imaging' },
                { name: 'USG Whole Abdomen & Pelvis', price: 1200, cat: 'Radiology & Imaging' },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={async () => {
                    if (!selectedClinic) return
                    const created = await createClinicService({
                      clinicId: selectedClinic.id,
                      serviceName: preset.name,
                      price: preset.price,
                      category: preset.cat,
                      isAvailable: true,
                    })
                    if (created) {
                      setServices((prev) => [...prev, created])
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-50/85 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold cursor-pointer transition shadow-glass-sm"
                >
                  + {preset.name} (Rs. {preset.price})
                </button>
              ))}
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <GlassCard variant="base" padding="md" radius="xl" className="space-y-4">
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
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Price (Rs.)</label>
                  <input
                    type="number"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    placeholder="e.g. 600"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Hormones & Immunology">Hormones & Immunology</option>
                    <option value="Microbiology & Serology">Microbiology & Serology</option>
                    <option value="Clinical Pathology">Clinical Pathology</option>
                    <option value="Radiology & Imaging">Radiology & Imaging</option>
                  </select>
                </div>

                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                >
                  Save Test & Publish Rate
                </GlassButton>
              </form>
            </GlassCard>

            <GlassCard variant="base" padding="md" radius="xl" className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900">Current Clinic Diagnostic Rates</h3>
                <GlassBadge variant="info" size="sm">
                  {services.length} Tests Active
                </GlassBadge>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-3.5 rounded-2xl border border-white/75 liquid-glass-subtle flex items-center justify-between shadow-glass-sm"
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
            </GlassCard>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 10: BROADCAST NOTIFICATION ALERT */}
      {/* ========================================================= */}
      {deskTab === 'broadcast' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <GlassCard variant="elevated" padding="lg" radius="xl" specular className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Clinic Notification Broadcast Desk
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Transmits real-time alerts directly to patient devices and live tracker boards.
              </p>
            </div>

            {broadcastSent && (
              <div className="p-4 bg-brand-50/85 backdrop-blur-md border border-brand-200/80 rounded-2xl text-brand-800 text-xs font-bold flex items-center space-x-2 shadow-glass-sm">
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
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <GlassButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                leftIcon={<Send className="w-4 h-4" />}
              >
                Broadcast Notification
              </GlassButton>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB: CENTRAL SUPPORT HELPDESK & TICKETS DIRECTORY     */}
      {/* ========================================================= */}
      {deskTab === 'tickets' && (
        <div className="space-y-6">
          <GlassCard variant="base" padding="md" radius="xl" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Headphones className="w-4 h-4" />
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Central Support Tickets Directory</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Access, review, and resolve all direct support inquiries and help tickets dispatched by patients, doctors, and clinics.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLoadingTickets(true)
                  try {
                    const list = await getSupportTickets()
                    setSupportTickets(list)
                  } finally {
                    setLoadingTickets(false)
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-white/75 dark:bg-slate-800/75 border border-white/80 dark:border-white/10 hover:bg-white text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5 cursor-pointer shadow-glass-sm transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin' : ''}`} />
                <span>Refresh Tickets</span>
              </button>
              <GlassBadge variant="brand" size="md">
                {supportTickets.length} Total Tickets
              </GlassBadge>
            </div>
          </GlassCard>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl liquid-glass-card border border-white/60 dark:border-white/10 text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Inquiries</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{supportTickets.length}</span>
            </div>
            <div className="p-4 rounded-2xl liquid-glass-card border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 text-left">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Open / Pending</span>
              <span className="text-2xl font-black text-rose-700 font-mono">
                {supportTickets.filter((t) => t.status === 'open').length}
              </span>
            </div>
            <div className="p-4 rounded-2xl liquid-glass-card border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 text-left">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">In Progress</span>
              <span className="text-2xl font-black text-amber-700 font-mono">
                {supportTickets.filter((t) => t.status === 'in_progress').length}
              </span>
            </div>
            <div className="p-4 rounded-2xl liquid-glass-card border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 text-left">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Resolved</span>
              <span className="text-2xl font-black text-emerald-700 font-mono">
                {supportTickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length}
              </span>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'open', 'in_progress', 'resolved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTicketStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer capitalize ${
                    ticketStatusFilter === st
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-white/80 dark:border-white/10 hover:bg-white'
                  }`}
                >
                  {st === 'all'
                    ? `All (${supportTickets.length})`
                    : `${st.replace('_', ' ')} (${
                        supportTickets.filter((t) =>
                          st === 'resolved' ? t.status === 'resolved' || t.status === 'closed' : t.status === st
                        ).length
                      })`}
                </button>
              ))}
            </div>

            <div className="relative min-w-[260px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ticketSearchQuery}
                onChange={(e) => setTicketSearchQuery(e.target.value)}
                placeholder="Search ticket code, email, phone, name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-semibold liquid-glass-input outline-none"
              />
            </div>
          </div>

          {/* Tickets List */}
          {loadingTickets ? (
            <div className="p-12 text-center text-xs font-bold text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
              <span>Loading official support tickets...</span>
            </div>
          ) : supportTickets.length === 0 ? (
            <GlassCard variant="base" padding="lg" radius="xl" className="text-center py-12 space-y-3">
              <Headphones className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Support Tickets Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No inquiries matching your criteria. Inquiries submitted via the Support page will automatically appear here with their generated Ticket ID.
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              {supportTickets
                .filter((t) => {
                  if (ticketStatusFilter === 'all') return true
                  if (ticketStatusFilter === 'resolved') return t.status === 'resolved' || t.status === 'closed'
                  return t.status === ticketStatusFilter
                })
                .filter((t) => {
                  if (!ticketSearchQuery.trim()) return true
                  const q = ticketSearchQuery.toLowerCase().trim()
                  return (
                    (t.ticketCode || '').toLowerCase().includes(q) ||
                    (t.email || '').toLowerCase().includes(q) ||
                    (t.phone || '').toLowerCase().includes(q) ||
                    (t.name || '').toLowerCase().includes(q) ||
                    (t.category || '').toLowerCase().includes(q) ||
                    (t.message || '').toLowerCase().includes(q)
                  )
                })
                .map((ticket) => {
                  const rawDigits = (ticket.phone || '').replace(/[^0-9]/g, '')
                  const waNumber = rawDigits.startsWith('977')
                    ? rawDigits
                    : rawDigits.length === 10
                    ? `977${rawDigits}`
                    : rawDigits
                  const isUpdating = updatingTicketCode === ticket.ticketCode

                  return (
                    <GlassCard
                      key={ticket.ticketCode}
                      variant="base"
                      padding="md"
                      radius="xl"
                      className="text-left space-y-4 hover:border-brand-300 transition-all shadow-glass-sm"
                    >
                      {/* Ticket Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/60 dark:border-white/10">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-sm text-brand-700 dark:text-brand-300 bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-500/20">
                            #{ticket.ticketCode}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {ticket.role?.toUpperCase() || 'PATIENT'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              ticket.status === 'open'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : ticket.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {ticket.status?.replace('_', ' ')?.toUpperCase() || 'OPEN'}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Recent'}
                        </span>
                      </div>

                      {/* Submitter & Category */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Submitter Name
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {ticket.name || 'Valued User'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Registered Gmail / Email
                          </span>
                          <a
                            href={`mailto:${ticket.email}?subject=Regarding Dactor Support Ticket #${ticket.ticketCode}`}
                            className="font-bold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            <span>{ticket.email}</span>
                          </a>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Contact Phone Number
                          </span>
                          <a
                            href={`tel:${ticket.phone}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-brand-600 hover:underline inline-flex items-center gap-1 font-mono"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{ticket.phone}</span>
                          </a>
                        </div>
                      </div>

                      {/* Reason & Message Bubble */}
                      <div className="p-3.5 rounded-xl liquid-glass-subtle border border-white/70 dark:border-white/10 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[10px] uppercase text-brand-700 dark:text-brand-300 bg-brand-500/15 px-2 py-0.5 rounded">
                            Reason: {ticket.category}
                          </span>
                          {ticket.customReason && (
                            <span className="text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                              ({ticket.customReason})
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {ticket.message || 'No additional message details provided.'}
                        </p>
                      </div>

                      {/* Action Controls & Quick Reply */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        {/* Direct Contact Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          {rawDigits.length >= 7 && (
                            <a
                              href={`https://wa.me/${waNumber}?text=Hello%20${encodeURIComponent(
                                ticket.name || 'there'
                              )},%20this%20is%20Dactor%20Official%20Support%20regarding%20your%20ticket%20%23${
                                ticket.ticketCode
                              }:%20`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp Reply</span>
                            </a>
                          )}

                          <a
                            href={`mailto:${ticket.email}?subject=Regarding Dactor Support Ticket #${ticket.ticketCode}&body=Hello ${encodeURIComponent(
                              ticket.name || 'there'
                            )},%0D%0A%0D%0AThis is Dactor Official Support in reference to your ticket #${
                              ticket.ticketCode
                            } (${encodeURIComponent(ticket.category)}).%0D%0A%0D%0A`}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Email Reply</span>
                          </a>

                          <a
                            href={`tel:${ticket.phone}`}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        </div>

                        {/* Status Change Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">Update Status:</span>
                          <select
                            value={ticket.status}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleTicketStatusChange(ticket.ticketCode, e.target.value as any)
                            }
                            className="px-3 py-1.5 rounded-xl text-xs font-bold liquid-glass-input outline-none cursor-pointer"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>
                      </div>
                    </GlassCard>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* DESK TAB 11: CLINIC PROFILE & OPERATIONAL SETTINGS (ClinicSettingsScreen.kt) */}
      {/* ========================================================= */}
      {deskTab === 'settings' && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 1. PORTAL LICENSE & SUBSCRIPTION STATUS CARD (ClinicSettingsScreen.kt lines 155-235) */}
          <GlassCard variant="base" padding="lg" radius="xl" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 block">
                  Dactor Cloud Operational License
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Portal Subscription & License Status
                </h3>
                <p className="text-xs text-slate-500">
                  Plan: <strong className="text-slate-800">{selectedClinic?.activationPlan || '1_month'}</strong> • Expires:{' '}
                  <strong className="text-slate-800">
                    {selectedClinic?.activationExpiresAt?.split('T')[0] || '30 Days'}
                  </strong>
                </p>
              </div>
              <GlassBadge
                variant={isSubscriptionActive ? 'success' : 'danger'}
                size="md"
              >
                {isSubscriptionActive
                  ? `Active • ${subscriptionDaysLeft} Days Left`
                  : 'Subscription Expired'}
              </GlassBadge>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <GlassButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowRenewalModal(true)}
              >
                Renew Subscription Plan (1 Month / 1 Year)
              </GlassButton>
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={submittingRenewal}
                onClick={handleInstantBypassSubscription}
              >
                ⚡ Instant 30-Day Testing Activation Bypass
              </GlassButton>
            </div>
          </GlassCard>

          {/* 2. CLINIC PROFILE, OPERATIONAL TYPE, GPS & PAYMENT GATEWAY FORM */}
          <GlassCard variant="base" padding="lg" radius="xl" className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Clinic Profile & Operational Settings</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Configure your official registration details, facility type, 13 Nepal City GPS coordinates, specialties, and direct payment gateway keys.
              </p>
            </div>

            {settingsSuccess && (
              <div className="p-4 bg-brand-50/85 backdrop-blur-md border border-brand-200/80 rounded-2xl text-brand-800 text-xs font-bold flex items-center space-x-2 shadow-glass-sm">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
                <span>Clinic settings successfully updated in database!</span>
              </div>
            )}

            <form onSubmit={handleSaveClinicSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Clinic Name</label>
                  <input
                    type="text"
                    value={settingName}
                    onChange={(e) => setSettingName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Operational Facility Type
                  </label>
                  <select
                    value={settingType}
                    onChange={(e) => setSettingType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="multi_visit">Polyclinic / Multi-Visit OPD Hospital</option>
                    <option value="single_Specialty">Single-Specialty Clinic</option>
                    <option value="diagnostic_lab">Diagnostic Pathology Lab</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={settingPhone}
                    onChange={(e) => setSettingPhone(e.target.value)}
                    placeholder="e.g. 014XXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Manager Phone</label>
                  <input
                    type="tel"
                    value={settingManagerPhone}
                    onChange={(e) => setSettingManagerPhone(e.target.value)}
                    placeholder="e.g. 98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={settingEmail}
                    onChange={(e) => setSettingEmail(e.target.value)}
                    placeholder="clinic@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Address & 13 Nepal Cities GPS Presets (ClinicSettingsScreen.kt) */}
              <div className="p-4 rounded-2xl liquid-glass-subtle border border-white/75 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Address Text</label>
                  <input
                    type="text"
                    value={settingAddress}
                    onChange={(e) => setSettingAddress(e.target.value)}
                    placeholder="Street Address, City, Ward"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Quick Nepal City GPS Presets (13 Major Cities):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {NEPAL_CITY_PRESETS.map((city) => (
                      <button
                        key={city.name}
                        type="button"
                        onClick={() => {
                          setSettingLat(city.lat)
                          setSettingLng(city.lng)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-brand-50 text-slate-700 hover:text-brand-800 border border-white/80 text-[10px] font-bold cursor-pointer"
                      >
                        📍 {city.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={settingLat}
                      onChange={(e) => setSettingLat(parseFloat(e.target.value) || 27.7172)}
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={settingLng}
                      onChange={(e) => setSettingLng(parseFloat(e.target.value) || 85.324)}
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSettingsGPS}
                    disabled={isDetectingLocation}
                    className="py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center space-x-1 shadow-glass-sm"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{isDetectingLocation ? 'Detecting...' : 'Detect Live GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Specialties Multi-Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Available Medical Specialties & Departments
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {defaultSpecialtyList.map((spec) => {
                    const selected = settingSpecialties.includes(spec)
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() =>
                          setSettingSpecialties(
                            selected
                              ? settingSpecialties.filter((s) => s !== spec)
                              : [...settingSpecialties, spec]
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition ${
                          selected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-glass-sm'
                            : 'bg-white/65 text-slate-700 border-white/80 hover:bg-white/90'
                        }`}
                      >
                        {selected ? `✓ ${spec}` : `+ ${spec}`}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Facility Description & Patient Instructions
                </label>
                <textarea
                  rows={2}
                  value={settingDesc}
                  onChange={(e) => setSettingDesc(e.target.value)}
                  placeholder="Describe available diagnostic services, pharmacy, parking, and OPD timings..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium liquid-glass-input"
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
                  className="w-32 px-3.5 py-2 rounded-xl text-xs font-bold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Direct Payment Gateway & API Configuration (ClinicSettingsScreen.kt lines 420-530) */}
              <div className="p-5 rounded-2xl liquid-glass-subtle border border-white/75 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Direct Patient Payment Gateway Integration
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Receive online consultation & lab payments directly into your clinic merchant account.
                    </p>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingDirectPaymentEnabled}
                      onChange={(e) => setSettingDirectPaymentEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-brand-600"
                    />
                    <span className="text-xs font-bold text-slate-800">Enable Direct Payment</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Payment Gateway Provider
                    </label>
                    <select
                      value={settingGatewayProvider}
                      onChange={(e) => setSettingGatewayProvider(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-bold"
                    >
                      <option value="esewa">eSewa Merchant (Nepal)</option>
                      <option value="khalti">Khalti Digital Wallet (Nepal)</option>
                      <option value="connectips">ConnectIPS / Fonepay</option>
                      <option value="stripe">Stripe International</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Merchant ID / Service Code
                    </label>
                    <input
                      type="text"
                      value={settingMerchantId}
                      onChange={(e) => setSettingMerchantId(e.target.value)}
                      placeholder="e.g. EPAYTEST or Merchant ID"
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Public / Live API Key
                    </label>
                    <input
                      type="text"
                      value={settingPaymentApiKey}
                      onChange={(e) => setSettingPaymentApiKey(e.target.value)}
                      placeholder="live_public_key_..."
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Merchant Secret Key
                    </label>
                    <input
                      type="password"
                      value={settingPaymentSecretKey}
                      onChange={(e) => setSettingPaymentSecretKey(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <GlassButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={savingSettings}
              >
                {savingSettings ? 'Saving Settings...' : 'Save All Clinic Profile & Gateway Settings'}
              </GlassButton>
            </form>
          </GlassCard>

          {/* 3. CLINIC FACILITY PHOTOS & LOGO GALLERY (1-4 Photos) */}
          <GlassCard variant="base" padding="lg" radius="xl" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/60">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-brand-600" />
                  <span>Clinic Facility Photos (1–4 Photos)</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Real photos of your clinic facility, reception, and consultation cabins. Synced directly to patient search and profile view.
                </p>
              </div>
              <GlassBadge variant="brand" size="md">
                {selectedClinic?.pictures?.length || 0} / 4 Photos
              </GlassBadge>
            </div>

            {clinicPhotoStatusMsg && (
              <div className="p-3 bg-brand-50/85 backdrop-blur-md border border-brand-200/80 rounded-2xl text-brand-800 text-xs font-bold flex items-center space-x-2 shadow-glass-sm">
                <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                <span>{clinicPhotoStatusMsg}</span>
              </div>
            )}

            {/* Photo Gallery Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedClinic?.pictures && selectedClinic.pictures.length > 0 ? (
                selectedClinic.pictures.map((picUrl, idx) => {
                  const isCover = (selectedClinic.logoUrl === picUrl) || (idx === 0 && !selectedClinic.logoUrl)
                  return (
                    <div
                      key={idx}
                      className="group relative rounded-2xl border border-white/80 overflow-hidden bg-slate-100 shadow-glass-sm"
                    >
                      <div className="w-full h-44 overflow-hidden relative">
                        <img
                          src={picUrl}
                          alt={`Facility Photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                          Photo #{idx + 1}
                        </span>
                        {isCover && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-brand-600 text-white shadow-xs">
                            Cover / Main Photo
                          </span>
                        )}
                      </div>

                      {/* Bottom Actions */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                        {!isCover ? (
                          <button
                            type="button"
                            onClick={() => handleSetClinicCoverPhoto(picUrl)}
                            className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white/90 hover:bg-white text-slate-800 backdrop-blur-xs shadow-xs transition-colors cursor-pointer"
                          >
                            Set as Cover
                          </button>
                        ) : (
                          <span className="text-[10px] text-white/90 font-bold drop-shadow-xs">Active Banner</span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveClinicPhoto(idx)}
                          className="p-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                          title="Remove this photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full p-8 border-2 border-dashed border-white/80 rounded-3xl text-center space-y-2 liquid-glass-subtle">
                  <Camera className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No Facility Photos Added Yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Add up to 4 real photos of your facility entrance, OPD chambers, or reception to build trust with patients.
                  </p>
                </div>
              )}
            </div>

            {/* Add Photo Button / File Picker (if < 4 photos) */}
            {(selectedClinic?.pictures?.length || 0) < 4 && (
              <div className="pt-2">
                <label className="flex items-center justify-center space-x-2 w-full py-4 px-6 border-2 border-dashed border-brand-300 hover:border-brand-500 rounded-2xl bg-brand-50/50 hover:bg-brand-50/80 backdrop-blur-md transition-all cursor-pointer">
                  <UploadCloud className="w-5 h-5 text-brand-600" />
                  <span className="text-xs font-bold text-brand-800">
                    {uploadingClinicPhoto ? 'Compressing & Uploading to Supabase...' : `+ Upload Facility Photo (${(selectedClinic?.pictures?.length || 0) + 1} of 4)`}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingClinicPhoto}
                    onChange={handleUploadClinicPhoto}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-400 text-center mt-1.5">
                  Images are automatically compressed to ≤ 300 KB and uploaded to public Supabase storage.
                </p>
              </div>
            )}
          </GlassCard>

          {/* 4. LEGAL TERMS & 30-DAY ARCHIVE ACCOUNT DELETION (ClinicSettingsScreen.kt lines 540-630) */}
          <GlassCard variant="base" padding="lg" radius="xl" className="border-rose-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Regulatory Terms & Account Lifecycle Governance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review your Dactor healthcare provider agreement or schedule a 30-day reversible clinic account deletion.
                </p>
              </div>
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowTermsModal(true)}
              >
                View Regulatory Terms & Conditions
              </GlassButton>
            </div>

            <div className="pt-3 border-t border-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-rose-700">
                <strong>30-Day Reversible Deletion Policy:</strong> Deleting your clinic account immediately hides your clinic from patient search and schedules permanent deletion in 30 days.
              </div>
              {selectedClinic?.isArchived ? (
                <button
                  type="button"
                  onClick={handleCancelClinicArchive}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shrink-0 shadow-glass-sm"
                >
                  Restore Clinic Account
                </button>
              ) : (
                <GlassButton
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteArchiveModal(true)}
                >
                  Delete Clinic Account (30-Day Grace)
                </GlassButton>
              )}
            </div>
          </GlassCard>

          {/* 5. CONTACT US & OFFICIAL SUPPORT HELPDESK */}
          <GlassCard variant="base" padding="lg" radius="xl" className="border-indigo-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Contact Us & Dactor Helpdesk Support
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connect directly to our dedicated support center for assistance with licenses, onboarding, or technical questions.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="#support?view=track"
                  onClick={() => {
                    window.location.hash = '#support?view=track'
                    window.dispatchEvent(new HashChangeEvent('hashchange'))
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl liquid-glass-subtle hover:bg-white/80 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold text-xs transition cursor-pointer"
                >
                  <LifeBuoy className="w-4 h-4 text-indigo-500" />
                  <span>Check Help Request Status</span>
                </a>
                <button
                  type="button"
                  onClick={() => setDeskTab('tickets')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold text-xs transition cursor-pointer"
                >
                  <Headphones className="w-4 h-4 text-purple-500" />
                  <span>Admin Tickets Desk</span>
                </button>
                <a
                  href={supportUrl.startsWith('http') || supportUrl.startsWith('mailto:') ? supportUrl : `https://${supportUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Open Support Desk</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
                </a>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PUSH ALERT NOTIFICATION WITH REAL TEMPLATE PREVIEW */}
      {/* ========================================================= */}
      {pushAlertModalOpen && pushAlertTargetAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
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
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* REAL NOTIFICATION TEMPLATE PREVIEW */}
            <div className="p-4 bg-slate-900/95 backdrop-blur-xl text-white rounded-2xl shadow-inner border border-white/15 space-y-3">
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
                  className="px-2.5 py-1 bg-white/75 border border-white/80 hover:bg-white text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Ready for Cabin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPushAlertTitle(`Token #${pushAlertTargetAppt.trackingCode10Digit}: Minor Consultation Delay`)
                    setPushAlertMessage(`Doctor consultation is running approximately 10 minutes late due to critical OPD case. Thank you for your patience.`)
                  }}
                  className="px-2.5 py-1 bg-white/75 border border-white/80 hover:bg-white text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  10 Mins Delay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPushAlertTitle(`Token #${pushAlertTargetAppt.trackingCode10Digit}: Clinic on Short Break`)
                    setPushAlertMessage(`The clinic is temporarily on a 15-minute break. Live queue consultations will resume shortly.`)
                  }}
                  className="px-2.5 py-1 bg-white/75 border border-white/80 hover:bg-white text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                >
                  Clinic on Break
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPushAlertTitle(`Token #${pushAlertTargetAppt.trackingCode10Digit}: Report to Reception Desk`)
                    setPushAlertMessage(`Please report to the reception desk for document and billing settlement.`)
                  }}
                  className="px-2.5 py-1 bg-white/75 border border-white/80 hover:bg-white text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
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
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-medium liquid-glass-input focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold liquid-glass-input"
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
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold liquid-glass-input"
                  />
                </div>
              </div>

              {pushAlertSentSuccess && (
                <div className="p-3 bg-brand-50/85 border border-brand-200 rounded-xl text-brand-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-600" />
                  <span>Push notification delivered to patient device!</span>
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setPushAlertModalOpen(false)}
                >
                  Cancel
                </GlassButton>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
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
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-4">
              {/* Direct Catalog 1-Click Quick Chips */}
              <div className="space-y-2 p-3 liquid-glass-subtle rounded-2xl border border-white/75">
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
                      className="px-2.5 py-1 bg-white/80 hover:bg-brand-50 hover:text-brand-800 text-slate-700 text-[11px] font-bold rounded-lg border border-white/90 hover:border-brand-300 transition-colors cursor-pointer shadow-glass-sm flex items-center space-x-1"
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
                  className="flex-1 px-3 py-2 rounded-xl liquid-glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="number"
                  value={customBillItemPrice}
                  onChange={(e) => setCustomBillItemPrice(e.target.value)}
                  placeholder="Price (Rs.)"
                  className="w-24 px-3 py-2 rounded-xl liquid-glass-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomBillItem}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer shadow-glass-sm"
                >
                  + Add
                </button>
              </div>

              {/* Itemized Line Items Table */}
              {billItems.length > 0 && (
                <div className="border border-white/80 rounded-xl overflow-hidden text-xs shadow-glass-sm">
                  <div className="bg-white/65 p-2 font-bold text-slate-700 flex justify-between border-b border-white/60">
                    <span>Invoice Line Items</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="divide-y divide-slate-200/50 max-h-36 overflow-y-auto bg-white/75 backdrop-blur-md">
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
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setBillPaidAmount(String(billTotalAmount || 0))}
                      className="px-2 py-0.5 bg-brand-50/85 hover:bg-brand-100 text-brand-700 rounded-md text-[10px] font-bold border border-brand-200 cursor-pointer"
                    >
                      Full Amount
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillPaidAmount(String(Math.round((Number(billTotalAmount) || 0) * 0.5)))}
                      className="px-2 py-0.5 bg-amber-50/85 hover:bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold border border-amber-200 cursor-pointer"
                    >
                      50% Advance
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillPaidAmount('0')}
                      className="px-2 py-0.5 bg-rose-50/85 hover:bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold border border-rose-200 cursor-pointer"
                    >
                      Unpaid (Rs. 0)
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Balance Due Banner */}
              {billTotalAmount && (
                <div className="p-3 liquid-glass-subtle rounded-xl border border-white/75 flex items-center justify-between text-xs">
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
                  className="w-full px-3.5 py-2 rounded-xl liquid-glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Compressed Image Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Attach Bill / Prescription Image (Auto-Compress to &le; 300 KB)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleBillReceiptFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                />
                {billReceiptCompressionInfo && (
                  <p className="text-[11px] text-brand-700 font-bold bg-brand-50/85 p-2 rounded-lg border border-brand-200">
                    ⚡ {billReceiptCompressionInfo}
                  </p>
                )}
              </div>

              {/* On-Demand Bill Generation & Thermal Print */}
              <div className="pt-2 flex items-center justify-between border-t border-white/60">
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
                <div id="dactor-printable-invoice" className="p-4 bg-white/85 rounded-2xl border-2 border-dashed border-slate-300 text-xs space-y-3 font-mono">
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
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setBillModalOpen(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={savingBill}
                >
                  {savingBill ? 'Saving & Recording...' : 'Push Bill to Patient'}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SHIFT APPOINTMENT DATE / RESCHEDULE */}
      {/* ========================================================= */}
      {shiftModalOpen && shiftTargetAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
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
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 liquid-glass-subtle rounded-xl border border-white/75 text-xs space-y-1">
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
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <p className="text-[11px] text-teal-800 bg-teal-50/85 p-2.5 rounded-xl border border-teal-200 font-medium leading-relaxed">
                🔔 The patient will automatically receive a real-time notification alert informing them that their appointment has been rescheduled.
              </p>

              <div className="flex items-center space-x-3 pt-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setShiftModalOpen(false)}
                >
                  Cancel
                </GlassButton>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <h3 className="text-sm font-black text-slate-900">
                Reception Walk-In Token Slip
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintTokenSlip(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal printable card container */}
            <div id="dactor-token-receipt" className="p-4 bg-white/85 border-2 border-dashed border-slate-300 rounded-2xl font-mono text-xs space-y-3 text-slate-800">
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
              <GlassButton
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setShowPrintTokenSlip(false)}
              >
                Close
              </GlassButton>
              <GlassButton
                type="button"
                variant="primary"
                size="md"
                className="flex-1"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => window.print()}
              >
                Print Slip
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: LAB REPORT UPLOAD & MARK PREPARED */}
      {/* ========================================================= */}
      {labUploadModalOpen && targetLabAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5">
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
                  Upload PDF Report or Scan (Auto-Compress to &le; 300 KB)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleLabReportFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
                {reportCompressionInfo && (
                  <p className="text-[11px] text-teal-700 font-bold bg-teal-50/85 p-2 rounded-lg border border-teal-200 mt-1">
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
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-medium liquid-glass-input focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="p-3 bg-amber-50/85 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                Patient will only be able to view and download this report after verifying their registered patient name for privacy.
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setLabUploadModalOpen(false)}
                >
                  Cancel
                </GlassButton>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Register Doctor / Medical Practitioner
              </h3>
              <p className="text-xs text-slate-500">
                Add a specialist or lab technician to {selectedClinic?.name} with starting practice year and consultation fee.
              </p>
            </div>

            <form onSubmit={handleCreateDoctor} className="space-y-4">
              {/* Role Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Practitioner Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDocRole('doctor')
                      if (docSpecialty === 'Pathology & Lab Medicine') setDocSpecialty('General Physician')
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      docRole === 'doctor'
                        ? 'bg-brand-600 text-white border-brand-600 shadow-glass-sm'
                        : 'bg-white/65 text-slate-700 border-white/80 hover:bg-white/90'
                    }`}
                  >
                    👨‍⚕️ Medical Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocRole('lab_technician')
                      setDocSpecialty('Pathology & Lab Medicine')
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      docRole === 'lab_technician'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-glass-sm'
                        : 'bg-white/65 text-slate-700 border-white/80 hover:bg-white/90'
                    }`}
                  >
                    🧪 Lab Technician
                  </button>
                </div>
              </div>

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
                    onboardingErrors.name ? 'border-rose-500 bg-rose-50/50' : 'liquid-glass-input'
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
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold liquid-glass-input focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setShowDoctorOnboarding(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1"
                >
                  Register Practitioner
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DOCTOR PHOTO UPLOAD / UPDATE                       */}
      {/* ========================================================= */}
      {doctorPhotoModalOpen && doctorPhotoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Practitioner Profile
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Update Photo for {doctorPhotoTarget.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDoctorPhotoModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo Preview */}
            <div className="flex flex-col items-center justify-center space-y-3 py-2">
              <div className="w-28 h-28 rounded-3xl bg-brand-50/80 border-2 border-brand-200 overflow-hidden flex items-center justify-center shadow-inner relative">
                {doctorPhotoPreview ? (
                  <img
                    src={doctorPhotoPreview}
                    alt={doctorPhotoTarget.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-black text-brand-700">
                    {doctorPhotoTarget.fullName.charAt(0)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {doctorPhotoTarget.specialty || 'General Practitioner'} • NMC: {doctorPhotoTarget.nmcLicenseNumber || '–'}
              </p>
            </div>

            {doctorPhotoMsg && (
              <div className="p-3 bg-brand-50/85 border border-brand-200 rounded-xl text-brand-800 text-xs font-bold text-center">
                {doctorPhotoMsg}
              </div>
            )}

            {/* File Input */}
            <div className="space-y-3">
              <label className="flex items-center justify-center space-x-2 w-full py-3 px-4 border border-white/80 hover:border-brand-400 rounded-xl liquid-glass-subtle hover:bg-brand-50/80 transition cursor-pointer text-xs font-bold text-slate-700">
                <Camera className="w-4 h-4 text-brand-600" />
                <span>{doctorPhotoFile ? doctorPhotoFile.name : 'Choose Image File (JPG, PNG, WEBP)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDoctorPhotoFileChange}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-2 pt-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="w-1/2"
                  onClick={() => setDoctorPhotoModalOpen(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-1/2"
                  disabled={uploadingDoctorPhoto || !doctorPhotoFile}
                  onClick={handleSaveDoctorPhoto}
                >
                  {uploadingDoctorPhoto ? 'Uploading...' : 'Save & Publish Photo'}
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: PORTAL SUBSCRIPTION & ACTIVATION RENEWAL         */}
      {/* ========================================================= */}
      {showRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  Dactor Portal License
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Manage & Renew Clinic Subscription
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedClinic?.name} • Status: {!isSubscriptionActive ? 'Expired / Renewal Due' : `${subscriptionDaysLeft} Days Remaining`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRenewalModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestRenewalSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRenewalPlan('1_month')}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    renewalPlan === '1_month'
                      ? 'bg-brand-50/85 border-brand-500 ring-2 ring-brand-500/20 shadow-glass-sm'
                      : 'bg-white/65 border-white/80 hover:bg-white/90'
                  }`}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600 block">
                    Monthly License
                  </span>
                  <span className="text-lg font-black text-slate-900 block mt-0.5">
                    Rs. 1,500
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    30 Days Full OPD & Lab Portal
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRenewalPlan('12_months')}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer relative ${
                    renewalPlan === '12_months'
                      ? 'bg-brand-50/85 border-brand-500 ring-2 ring-brand-500/20 shadow-glass-sm'
                      : 'bg-white/65 border-white/80 hover:bg-white/90'
                  }`}
                >
                  <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-md uppercase absolute top-2.5 right-2.5">
                    Save 17%
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600 block">
                    Annual License
                  </span>
                  <span className="text-lg font-black text-slate-900 block mt-0.5">
                    Rs. 15,000
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    365 Days Full OPD & Lab Portal
                  </span>
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  eSewa / Khalti / Bank Transaction Reference ID
                </label>
                <input
                  type="text"
                  value={renewalTxnRef}
                  onChange={(e) => setRenewalTxnRef(e.target.value)}
                  placeholder="e.g. ESW-984120394 or Bank Voucher #"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={submittingRenewal}
                  onClick={handleInstantBypassSubscription}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  ⚡ Instant Activation (Testing Bypass)
                </button>
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={submittingRenewal}
                >
                  {submittingRenewal ? 'Submitting...' : 'Submit Payment Renewal'}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CLINIC NOTIFICATIONS DRAWER                      */}
      {/* ========================================================= */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-brand-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Clinic Notifications & Activity Log
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Recent alerts, bookings, and broadcasts for {selectedClinic?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotificationsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {clinicNotifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No recent notifications found for this clinic.
                </div>
              ) : (
                clinicNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3.5 rounded-2xl liquid-glass-subtle border border-white/75 space-y-1 shadow-glass-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{n.title}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-white/60 flex justify-end">
              <GlassButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowNotificationsModal(false)}
              >
                Close Drawer
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CLINICAL REMARK / RECEPTION NOTES EDITOR         */}
      {/* ========================================================= */}
      {remarkModalOpen && remarkTargetAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Reception / Clinical Notes
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Add / Edit Remark for {remarkTargetAppt.patientName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Token #{remarkTargetAppt.trackingCode10Digit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRemarkModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClinicalRemark} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Clinical Remark / Symptoms / Reception Note
                </label>
                <textarea
                  rows={4}
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  placeholder="Enter patient vitals, chief complaint, follow-up instructions, or reception notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setRemarkModalOpen(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1"
                  disabled={savingRemark}
                >
                  {savingRemark ? 'Saving...' : 'Save Remark'}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: EDIT SLOT MAX CAPACITY                           */}
      {/* ========================================================= */}
      {editingSlotCapacity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Slot Capacity Control
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Update Max Patients for Slot
                </h3>
                <p className="text-[11px] text-slate-500">
                  {editingSlotCapacity.startTime} - {editingSlotCapacity.endTime} ({editingSlotCapacity.slotDate})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlotCapacity(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlotCapacityUpdate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Maximum Patient Bookings Allowed
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={newSlotCapacityVal}
                  onChange={(e) => setNewSlotCapacityVal(Number(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-sm font-black focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setEditingSlotCapacity(null)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1"
                >
                  Update Capacity
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: VIEW DOCTOR PROFILE (FROM INVITATIONS DIRECTORY) */}
      {/* ========================================================= */}
      {viewingDoctorProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-50/80 border border-brand-200 overflow-hidden flex items-center justify-center font-black text-brand-700 text-lg">
                  {viewingDoctorProfile.profilePictureUrl ? (
                    <img
                      src={viewingDoctorProfile.profilePictureUrl}
                      alt={viewingDoctorProfile.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    viewingDoctorProfile.fullName.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {viewingDoctorProfile.fullName}
                  </h3>
                  <p className="text-xs font-bold text-brand-600">
                    {viewingDoctorProfile.specialty || 'General Physician'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDoctorProfile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs liquid-glass-subtle p-4 rounded-2xl border border-white/75">
              <div className="flex justify-between">
                <span className="text-slate-500">NMC License Number:</span>
                <span className="font-bold text-slate-900">{viewingDoctorProfile.nmcLicenseNumber || 'Verified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Qualifications:</span>
                <span className="font-bold text-slate-900">{viewingDoctorProfile.education || 'MBBS, MD'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Experience:</span>
                <span className="font-bold text-slate-900">
                  {viewingDoctorProfile.startingPracticingYear
                    ? `${Math.max(1, 2026 - viewingDoctorProfile.startingPracticingYear)}+ Years (Since ${viewingDoctorProfile.startingPracticingYear})`
                    : `${viewingDoctorProfile.experienceYears || 5}+ Years`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Standard OPD Fee:</span>
                <span className="font-bold text-brand-700">Rs. {viewingDoctorProfile.consultationFee || 500}</span>
              </div>
              {viewingDoctorProfile.publicMobileNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Public Contact:</span>
                  <span className="font-bold text-slate-900">{viewingDoctorProfile.publicMobileNumber}</span>
                </div>
              )}
              {viewingDoctorProfile.description && (
                <div className="pt-2 border-t border-white/60 mt-2">
                  <span className="text-slate-500 block mb-0.5">Bio / Clinical Summary:</span>
                  <p className="text-slate-700 leading-relaxed">{viewingDoctorProfile.description}</p>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <GlassButton
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setViewingDoctorProfile(null)}
              >
                Close
              </GlassButton>
              <GlassButton
                type="button"
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => {
                  handleSendDoctorInvitation(viewingDoctorProfile)
                  setViewingDoctorProfile(null)
                }}
              >
                Send Clinic Invitation
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: LAB REPORT PRIVACY VERIFICATION GATE             */}
      {/* ========================================================= */}
      {labVerifyTargetReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                  Patient Privacy Security Gate
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Verify Identity to View Report
                </h3>
                <p className="text-[11px] text-slate-500">
                  Report: {labVerifyTargetReport.report.testName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLabVerifyTargetReport(null)
                  setLabVerifyInput('')
                  setLabVerifyError(null)
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyAndOpenLabReport} className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                For patient confidentiality, please enter the patient&apos;s <strong>Full Name</strong> or <strong>Registered Mobile Number</strong> to unlock and open this diagnostic report.
              </p>

              <div>
                <input
                  type="text"
                  value={labVerifyInput}
                  onChange={(e) => {
                    setLabVerifyInput(e.target.value)
                    setLabVerifyError(null)
                  }}
                  placeholder={`e.g. ${labVerifyTargetReport.appt.patientName}`}
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
                {labVerifyError && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{labVerifyError}</p>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    setLabVerifyTargetReport(null)
                    setLabVerifyInput('')
                    setLabVerifyError(null)
                  }}
                >
                  Cancel
                </GlassButton>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  Verify & Open Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: CLINIC REGULATORY TERMS & DATA COMPLIANCE        */}
      {/* ========================================================= */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Healthcare Governance
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Dactor Clinic Terms, Privacy & Regulatory Compliance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 text-xs text-slate-600 leading-relaxed pr-1">
              <p>
                <strong>1. Nepal Medical Council (NMC) & MoHP Compliance:</strong> All doctors and laboratory personnel registered under this clinic must hold valid, active licenses from the Nepal Medical Council (NMC) or Nepal Health Professional Council (NHPC).
              </p>
              <p>
                <strong>2. Patient Data Confidentiality:</strong> Patient medical records, diagnostic pathology reports, and contact details are strictly confidential and protected under Nepal&apos;s Individual Privacy Act. Laboratory reports require patient name/mobile verification before viewing.
              </p>
              <p>
                <strong>3. Transparent Billing & PAN Disclosure:</strong> Clinics issuing digital invoices or accepting direct eSewa/Khalti/Fonepay settlements are responsible for accurate tax and PAN reporting.
              </p>
              <p>
                <strong>4. 30-Day Reversible Account Archive Policy:</strong> When a clinic schedules account deletion, all public listings are hidden immediately, while historical patient records remain safely archived for 30 days in case the clinic administrator chooses to restore the account.
              </p>
            </div>

            <div className="pt-2 border-t border-white/60 flex justify-end">
              <GlassButton
                type="button"
                variant="primary"
                size="md"
                onClick={() => setShowTermsModal(false)}
              >
                I Understand & Acknowledge
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 8: 30-DAY REVERSIBLE CLINIC ACCOUNT DELETION        */}
      {/* ========================================================= */}
      {showDeleteArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-md">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 border-rose-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  30-Day Reversible Archive
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Schedule Clinic Account Deletion?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteArchiveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/85 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5 leading-relaxed">
              <p className="font-bold">What happens when you schedule deletion:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Your clinic will enter a <strong>30-day archive grace period</strong>.</li>
                <li>You can cancel deletion and restore your clinic with 1 click at any time during the next 30 days.</li>
                <li>After 30 days, the clinic profile will be permanently deactivated.</li>
              </ul>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setShowDeleteArchiveModal(false)}
              >
                Keep Account Active
              </GlassButton>
              <GlassButton
                type="button"
                variant="destructive"
                size="md"
                className="flex-1"
                onClick={handleScheduleClinicArchive}
              >
                Schedule 30-Day Archive
              </GlassButton>
            </div>

            <div className="pt-2 border-t border-white/60">
              <button
                type="button"
                disabled={isDeletingPermanently}
                onClick={handlePermanentDeleteClinic}
                className="w-full py-2 bg-red-50/85 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>{isDeletingPermanently ? 'Purging Clinic...' : 'Admin: Permanent Purge (Immediate)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
