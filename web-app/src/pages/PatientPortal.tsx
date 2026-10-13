import React, { useState, useEffect, useMemo } from 'react'
import {
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  Bell,
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
  Copy,
  Check,
  Activity,
  Stethoscope,
  Building2,
  Trash2,
  Users,
  Sparkles,
  MapPin,
  ExternalLink,
  ChevronDown,
  Download,
  Receipt,
  ArrowRight,
  ArrowLeft,
  Timer,
  AlertTriangle,
  Info,
  Lock,
  Unlock,
  KeyRound,
  CalendarRange,
  FlaskConical,
  Layers,
  History,
  CheckSquare,
  Square,
  Tag,
  Headphones,
  HelpCircle,
  LifeBuoy,
  MessageSquare,
} from 'lucide-react'
function triggerConfettiBurst() {
  try {
    const canvas = document.createElement('canvas')
    canvas.style.position = 'fixed'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '99999'
    document.body.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: any[] = []
    const colors = ['#10B981', '#06B6D4', '#3B82F6', '#F59E0B', '#EC4899']

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
        opacity: 1,
      })
    }

    let animationFrame: number
    const start = performance.now()

    function animate(now: number) {
      if (now - start > 2500) {
        cancelAnimationFrame(animationFrame)
        canvas.remove()
        return
      }
      ctx!.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.35
        p.rotation += p.vr
        p.opacity = Math.max(0, 1 - (now - start) / 2500)

        ctx!.save()
        ctx!.translate(p.x, p.y)
        ctx!.rotate((p.rotation * Math.PI) / 180)
        ctx!.globalAlpha = p.opacity
        ctx!.fillStyle = p.color
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx!.restore()
      })
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
  } catch {}
}
import {
  Clinic,
  Doctor,
  Appointment,
  Slot,
  ClinicService,
  LabReport,
  DactorNotification,
  PatientProfile,
  PatientTransactionRecord,
  PaymentGatewaysConfig,
  SupportTicket,
} from '../types'
import {
  getClinics,
  getDoctors,
  getDoctorsByClinic,
  getClinicServices,
  getSlots,
  createAppointment,
  generate10DigitTrackingCode,
  getPatientProfileByEmail,
  savePatientProfile,
  getAppointmentsByPatient,
  getPatientTransactions,
  cancelAppointment,
  shiftAppointmentDate,
  getAppointmentByTrackingCode,
  getClinicPaymentConfig,
  isSlotTimeExpired,
  recordPaymentTransaction,
  getLabReportsByTrackingCode,
  getPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  checkEmailPortalAssociation,
  schedulePatientArchive,
  cancelPatientArchive,
  deletePatientProfilePermanently,
  getSupportUrl,
  getSupportTickets,
  getSupportTicketByCodeOrContact,
} from '../services/db'
import {
  firebaseSignOut,
  signInWithFirebaseGoogle,
  checkRedirectGoogleUser,
  deleteFirebaseUserAccount,
} from '../lib/firebase'
import { supabase } from '../lib/supabase'
import {
  matchClinic,
  QUICK_SPECIALTY_SUGGESTIONS,
  getRecentSearches,
  saveRecentSearch,
} from '../utils/searchEngine'

interface PatientPortalProps {
  onNavigateHome?: () => void
  onOpenLiveQueue?: (trackingCode: string) => void
  onOpenReportModal?: (trackingCode: string) => void
}

interface FamilyMember {
  id: string
  name: string
  relation: string
  age: number
  gender: string
  phone?: string
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  onNavigateHome,
  onOpenLiveQueue,
  onOpenReportModal,
}) => {
  // ==========================================
  // AUTHENTICATION & PATIENT PROFILE STATE
  // ==========================================
  const [patientUser, setPatientUser] = useState<PatientProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  // Auth Modals & Inputs (Strictly Google Sign-In Only)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSubmitting, setAuthSubmitting] = useState(false)

  // Edit Profile Modal
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editGender, setEditGender] = useState('Male')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
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

  // Account Deletion State
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false)

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'appointments' | 'book' | 'transactions' | 'reports' | 'notifications' | 'family' | 'help'
  >('appointments')

  // Support / Help Requests State
  const [patientTickets, setPatientTickets] = useState<SupportTicket[]>([])
  const [loadingPatientTickets, setLoadingPatientTickets] = useState(false)
  const [ticketSearchInput, setTicketSearchInput] = useState('')
  const [ticketLookupResult, setTicketLookupResult] = useState<SupportTicket | null>(null)
  const [isSearchingTicket, setIsSearchingTicket] = useState(false)
  const [ticketSearchError, setTicketSearchError] = useState<string | null>(null)

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // ==========================================
  // APPOINTMENTS & LIVE QUEUE STATE
  // ==========================================
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([])
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
  const [appointmentFilter, setAppointmentFilter] = useState<'active' | 'past'>('active')
  const [cancellingApptId, setCancellingApptId] = useState<string | null>(null)

  // ==========================================
  // BOOKING WIZARD STATE
  // ==========================================
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [clinicSearchQuery, setClinicSearchQuery] = useState('')
  const [clinicCategoryFilter, setClinicCategoryFilter] = useState<
    'all' | 'single_doctor' | 'polyclinic' | 'diagnostic_lab'
  >('all')
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)
  const [clinicDoctors, setClinicDoctors] = useState<Doctor[]>([])
  const [clinicServices, setClinicServices] = useState<ClinicService[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedService, setSelectedService] = useState<ClinicService | null>(null)
  const [selectedLabTests, setSelectedLabTests] = useState<ClinicService[]>([])
  const [bookingMode, setBookingMode] = useState<'opd' | 'lab'>('opd')
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([])
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all')
  const [viewingBillAppt, setViewingBillAppt] = useState<Appointment | null>(null)

  const clinicDoctorsMap = useMemo(() => {
    const map: Record<string, Doctor[]> = {}
    for (const doc of allDoctors) {
      if (doc.clinicId) {
        if (!map[doc.clinicId]) map[doc.clinicId] = []
        map[doc.clinicId].push(doc)
      }
    }
    return map
  }, [allDoctors])

  const availableCities = useMemo(() => {
    const set = new Set<string>()
    for (const c of clinics) {
      if (c.city && c.city.trim()) set.add(c.city.trim())
      else if (c.addressText) {
        const parts = c.addressText.split(',')
        const last = parts[parts.length - 1]?.trim()
        if (last && last.length < 25) set.add(last)
      }
    }
    return Array.from(set)
  }, [clinics])

  // Polyclinic Follow-Up Visit State
  const [isReturningPatient, setIsReturningPatient] = useState(false)
  const [followupCodeInput, setFollowupCodeInput] = useState('')
  const [retainedAppointment, setRetainedAppointment] = useState<Appointment | null>(null)
  const [isLookingUpCode, setIsLookingUpCode] = useState(false)
  const [followupLookupError, setFollowupLookupError] = useState<string | null>(null)

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

  // Auto-bind single doctor if Single Doctor Clinic
  useEffect(() => {
    if (isSingleDoctorClinic && clinicDoctors.length > 0) {
      setSelectedDoctor(clinicDoctors[0])
    }
  }, [isSingleDoctorClinic, clinicDoctors])

  // Date & Slot Selection
  const [bookingDate, setBookingDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  // Follow-Up 10-Digit Code Realtime Lookup
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
            setBookPatientName(found.patientName)
            setBookPatientAge(String(found.patientAge || ''))
            setBookPatientGender(found.patientGender || 'Male')
            setBookPatientPhone(found.patientMobile || '')
            if (found.doctorId && clinicDoctors.length > 0) {
              const matchedDoc = clinicDoctors.find((d) => d.id === found.doctorId)
              if (matchedDoc) setSelectedDoctor(matchedDoc)
            }
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
  }, [isReturningPatient, followupCodeInput, clinicDoctors])

  // Patient Details for Booking
  const [bookFor, setBookFor] = useState<'self' | 'family'>('self')
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [bookPatientName, setBookPatientName] = useState('')
  const [bookPatientPhone, setBookPatientPhone] = useState('')
  const [bookPatientAge, setBookPatientAge] = useState('')
  const [bookPatientGender, setBookPatientGender] = useState('Male')
  const [bookPatientNotes, setBookPatientNotes] = useState('')
  const [bookOptInEarlyCall, setBookOptInEarlyCall] = useState(false)

  // Wizard Step (1: Clinic & Doctor, 2: Slot & Date, 3: Details, 4: Payment, 5: Confirmed)
  const [bookingStep, setBookingStep] = useState<number>(1)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null)

  // Payment State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'esewa' | 'khalti' | 'fonepay' | 'cash'
  >('esewa')
  const [clinicPaymentConfig, setClinicPaymentConfig] = useState<PaymentGatewaysConfig | null>(null)
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false)
  const [transactionFailedNotice, setTransactionFailedNotice] = useState<string | null>(null)

  // Persistent 5-Minute (300 seconds) Countdown Timer
  const [paymentTimeRemaining, setPaymentTimeRemaining] = useState<number>(300)

  // ==========================================
  // TRANSACTIONS STATE
  // ==========================================
  const [transactions, setTransactions] = useState<PatientTransactionRecord[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)

  // ==========================================
  // LAB REPORTS STATE
  // ==========================================
  const [patientLabReports, setPatientLabReports] = useState<LabReport[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)

  // ==========================================
  // NOTIFICATIONS STATE
  // ==========================================
  const [notifications, setNotifications] = useState<DactorNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // ==========================================
  // FAMILY MEMBERS STATE
  // ==========================================
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    try {
      const saved = localStorage.getItem('dactor_family_members')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false)
  const [newFamilyName, setNewFamilyName] = useState('')
  const [newFamilyRelation, setNewFamilyRelation] = useState('Spouse')
  const [newFamilyAge, setNewFamilyAge] = useState('')
  const [newFamilyGender, setNewFamilyGender] = useState('Male')
  const [newFamilyPhone, setNewFamilyPhone] = useState('')

  // ==========================================
  // PENDING BOOKING REDIRECT & TOAST STATE
  // ==========================================
  const [pendingBookingRedirectNotice, setPendingBookingRedirectNotice] = useState(false)
  const [bookingRestoredToast, setBookingRestoredToast] = useState<string | null>(null)

  // ==========================================
  // CLAIM APPOINTMENT WITH 10-DIGIT CODE STATE
  // ==========================================
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [claimCodeInput, setClaimCodeInput] = useState('')
  const [claimCodeError, setClaimCodeError] = useState<string | null>(null)
  const [isClaimingCode, setIsClaimingCode] = useState(false)

  // ==========================================
  // RESCHEDULE APPOINTMENT STATE
  // ==========================================
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null)
  const [newRescheduleDate, setNewRescheduleDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [newRescheduleTime, setNewRescheduleTime] = useState<string>('10:00 AM - 11:00 AM')
  const [rescheduleReason, setRescheduleReason] = useState<string>('')
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [rescheduleAvailableSlots, setRescheduleAvailableSlots] = useState<Slot[]>([])
  const [isLoadingRescheduleSlots, setIsLoadingRescheduleSlots] = useState(false)

  // Dynamically load published timed slots when rescheduling
  useEffect(() => {
    if (rescheduleAppt && rescheduleAppt.clinicId && newRescheduleDate) {
      setIsLoadingRescheduleSlots(true)
      getSlots(rescheduleAppt.clinicId, newRescheduleDate)
        .then((slots) => {
          const avail = (slots || []).filter(
            (s) =>
              s.isAvailable !== false &&
              (!rescheduleAppt.doctorId || !s.doctorId || s.doctorId === rescheduleAppt.doctorId)
          )
          setRescheduleAvailableSlots(avail)
          if (avail.length > 0) {
            setNewRescheduleTime(`${avail[0].startTime} - ${avail[0].endTime}`)
          }
        })
        .catch(() => setRescheduleAvailableSlots([]))
        .finally(() => setIsLoadingRescheduleSlots(false))
    } else {
      setRescheduleAvailableSlots([])
    }
  }, [rescheduleAppt, newRescheduleDate])

  // ==========================================
  // LAB REPORTS PRIVACY VERIFICATION & SEARCH
  // ==========================================
  const [reportSearchCode, setReportSearchCode] = useState('')
  const [isSearchingReport, setIsSearchingReport] = useState(false)
  const [reportSearchError, setReportSearchError] = useState<string | null>(null)
  const [unlockedReportIds, setUnlockedReportIds] = useState<string[]>([])
  const [verifyingReport, setVerifyingReport] = useState<LabReport | null>(null)
  const [verifyMethod, setVerifyMethod] = useState<'name' | 'phone'>('name')
  const [verificationInput, setVerificationInput] = useState('')
  const [verificationError, setVerificationError] = useState<string | null>(null)

  // ==========================================
  // INITIALIZATION & SESSION RESTORE
  // ==========================================
  useEffect(() => {
    async function restoreSession() {
      setIsAuthLoading(true)
      try {
        const redirectedUser = await checkRedirectGoogleUser()
        const storedEmail =
          redirectedUser?.email ||
          localStorage.getItem('dactor_patient_email') ||
          localStorage.getItem('dactor_auth_email')
        if (storedEmail) {
          const profile = await getPatientProfileByEmail(storedEmail)
          if (profile) {
            const photo = redirectedUser?.photoURL || profile.photoUrl
            const fullProfile = { ...profile, photoUrl: photo }
            setPatientUser(fullProfile)
            initProfileFields(fullProfile)
            try {
              localStorage.setItem('dactor_patient_session', JSON.stringify(fullProfile))
            } catch {}
          } else {
            // Do NOT auto-fill name, gender, or age from email/Google
            const partial: PatientProfile = {
              id: crypto.randomUUID(),
              email: storedEmail,
              fullName: '',
              photoUrl: redirectedUser?.photoURL,
              role: 'patient',
            }
            setPatientUser(partial)
            initProfileFields(partial)
            setShowEditProfileModal(true)
          }
        }
        // Load clinics and doctors for booking
        const [cList, docList] = await Promise.all([getClinics(), getDoctors()])
        const activeClinics = cList.filter((c) => !c.isArchived)
        setClinics(activeClinics)
        setAllDoctors(docList)

        // Restore pending booking redirect if exists
        const pendingRaw = localStorage.getItem('dactor_pending_booking_redirect')
        if (pendingRaw) {
          try {
            const parsed = JSON.parse(pendingRaw)
            if (parsed.clinicId) {
              const clinicMatch = activeClinics.find((c) => c.id === parsed.clinicId)
              if (clinicMatch) {
                setSelectedClinic(clinicMatch)
                const [docs, servs, pCfg] = await Promise.all([
                  getDoctorsByClinic(clinicMatch.id),
                  getClinicServices(clinicMatch.id),
                  getClinicPaymentConfig(clinicMatch.id),
                ])
                setClinicDoctors(docs)
                setClinicServices(servs.filter((s) => s.isAvailable))
                setClinicPaymentConfig(pCfg)

                if (parsed.doctorId) {
                  const docMatch = docs.find((d) => d.id === parsed.doctorId)
                  if (docMatch) setSelectedDoctor(docMatch)
                }
                if (parsed.serviceId) {
                  const servMatch = servs.find((s) => s.id === parsed.serviceId)
                  if (servMatch) setSelectedService(servMatch)
                }
                if (parsed.bookingMode) setBookingMode(parsed.bookingMode)
                if (parsed.bookingDate) setBookingDate(parsed.bookingDate)

                if (parsed.selectedSlotId) {
                  const rawSlots = await getSlots(clinicMatch.id, parsed.bookingDate)
                  const validSlots = rawSlots.filter((slot) => {
                    const isExpired = isSlotTimeExpired(parsed.bookingDate, slot.endTime)
                    const hasCapacity = slot.bookedCount < slot.maxCapacity
                    return !isExpired && hasCapacity && slot.isAvailable !== false
                  })
                  setAvailableSlots(validSlots)
                  const slotMatch = validSlots.find((s) => s.id === parsed.selectedSlotId)
                  if (slotMatch) setSelectedSlot(slotMatch)
                }

                if (storedEmail) {
                  setActiveTab('book')
                  setBookingStep(3)
                  localStorage.removeItem('dactor_pending_booking_redirect')
                  setPendingBookingRedirectNotice(false)
                  setBookingRestoredToast('Booking selection restored! Resuming right where you left off.')
                  setTimeout(() => setBookingRestoredToast(null), 4000)
                } else {
                  setPendingBookingRedirectNotice(true)
                }
              }
            }
          } catch (e) {
            console.warn('Pending booking restore notice:', e)
          }
        }
      } catch (err) {
        console.error('Session restore error:', err)
      } finally {
        setIsAuthLoading(false)
      }
    }
    restoreSession()
  }, [])

  const archiveDaysLeft = React.useMemo(() => {
    if (!patientUser?.deletionScheduledAt) return 30
    try {
      const scheduled = new Date(patientUser.deletionScheduledAt).getTime()
      const diff = Math.ceil((scheduled - Date.now()) / (1000 * 60 * 60 * 24))
      return Math.max(1, Math.min(30, diff))
    } catch {
      return 30
    }
  }, [patientUser?.deletionScheduledAt])

  const handleCancelPatientArchive = async () => {
    if (!patientUser) return
    const ok = await cancelPatientArchive(patientUser.id)
    if (ok) {
      const updated = { ...patientUser, isArchived: false, deletionScheduledAt: undefined }
      setPatientUser(updated)
      localStorage.setItem('dactor_patient_session', JSON.stringify(updated))
    } else {
      alert('Could not cancel deletion. Please try again.')
    }
  }

  const handleSchedulePatientArchive = async () => {
    if (!patientUser) return
    const ok = await schedulePatientArchive(patientUser.id)
    if (ok) {
      const updated = {
        ...patientUser,
        isArchived: true,
        deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }
      setPatientUser(updated)
      localStorage.setItem('dactor_patient_session', JSON.stringify(updated))
      setShowDeleteConfirmModal(false)
      setShowEditProfileModal(false)
    } else {
      alert('Could not schedule account deletion. Please try again.')
    }
  }

  const handlePermanentDeletePatient = async () => {
    if (!patientUser) return
    const confirmName = window.prompt(
      `⚠️ PERMANENT ACCOUNT DELETION:\nThis will permanently delete your patient profile and authentication credentials.\n\nType "${patientUser.fullName}" to confirm:`
    )
    if (confirmName !== patientUser.fullName) {
      if (confirmName !== null) alert('Name did not match. Account deletion aborted.')
      return
    }

    setIsDeletingPermanently(true)
    try {
      await deletePatientProfilePermanently(patientUser.id)
      await deleteFirebaseUserAccount()
      localStorage.removeItem('dactor_patient_session')
      setPatientUser(null)
      setShowDeleteConfirmModal(false)
      setShowEditProfileModal(false)
      alert('Your patient account and authentication details have been permanently deleted.')
    } catch (e: any) {
      alert(`Error during deletion: ${e?.message || e}`)
    } finally {
      setIsDeletingPermanently(false)
    }
  }

  function initProfileFields(profile: PatientProfile) {
    setEditName(profile.fullName || '')
    setEditPhone(profile.phone || '')
    setEditAge(profile.age ? profile.age.toString() : '')
    setEditGender(profile.gender || 'Male')

    setBookPatientName(profile.fullName || '')
    setBookPatientPhone(profile.phone || '')
    setBookPatientAge(profile.age ? profile.age.toString() : '')
    setBookPatientGender(profile.gender || 'Male')
  }

  // Load patient data on mount and whenever patientUser changes
  useEffect(() => {
    loadAppointments()
    loadTransactions()
    loadNotifications()
    loadMySupportTickets()
  }, [patientUser])

  useEffect(() => {
    if (activeTab === 'help') {
      loadMySupportTickets()
    }
  }, [activeTab])

  // ==========================================
  // DATA LOADERS
  // ==========================================
  async function loadAppointments() {
    setIsLoadingAppointments(true)
    try {
      const storedCodes = getStoredTrackingCodes()
      if (!patientUser && storedCodes.length === 0) {
        setMyAppointments([])
        setPatientLabReports([])
        return
      }
      const appts = await getAppointmentsByPatient({
        userId: patientUser?.id,
        email: patientUser?.email,
        phone: patientUser?.phone,
        trackingCodes: storedCodes,
      })
      setMyAppointments(appts)

      // Also fetch lab reports for all appointments
      const allReports: LabReport[] = []
      for (const a of appts.slice(0, 15)) {
        const repList = await getLabReportsByTrackingCode(a.trackingCode10Digit)
        allReports.push(...repList)
      }
      setPatientLabReports(allReports)
    } catch (err) {
      console.error('Failed to load appointments:', err)
    } finally {
      setIsLoadingAppointments(false)
    }
  }

  async function loadTransactions() {
    setIsLoadingTransactions(true)
    try {
      const storedCodes = getStoredTrackingCodes()
      if (!patientUser && storedCodes.length === 0) {
        setTransactions([])
        return
      }
      const txns = await getPatientTransactions({
        userId: patientUser?.id,
        email: patientUser?.email,
        phone: patientUser?.phone,
        trackingCodes: storedCodes,
      })
      setTransactions(txns)
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setIsLoadingTransactions(false)
    }
  }

  async function loadNotifications() {
    try {
      const storedCodes = getStoredTrackingCodes()
      const notifs = await getPatientNotifications({
        userId: patientUser?.id,
        trackingCodes: storedCodes,
      })
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n) => !n.isRead).length)
    } catch {}
  }

  function getStoredTrackingCodes(): string[] {
    try {
      const raw = localStorage.getItem('dactor_patient_tracking_codes')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function saveTrackingCodeLocally(code: string) {
    try {
      const existing = getStoredTrackingCodes()
      if (!existing.includes(code)) {
        const updated = [code, ...existing]
        localStorage.setItem('dactor_patient_tracking_codes', JSON.stringify(updated))
      }
    } catch {}
  }

  async function loadMySupportTickets() {
    setLoadingPatientTickets(true)
    try {
      const all = await getSupportTickets()
      const pEmail = patientUser?.email?.trim().toLowerCase()
      const pPhone = (patientUser?.phone || '').replace(/\D/g, '')

      let deviceTicketCodes: string[] = []
      try {
        const raw = localStorage.getItem('dactor_recent_tickets')
        if (raw) deviceTicketCodes = JSON.parse(raw)
      } catch {}

      const filtered = all.filter((t) => {
        if (deviceTicketCodes.includes(t.ticketCode)) return true
        const tEmail = t.email?.trim().toLowerCase()
        const tPhone = (t.phone || '').replace(/\D/g, '')
        if (pEmail && tEmail && tEmail === pEmail) return true
        if (pPhone && pPhone.length >= 7 && tPhone && tPhone.includes(pPhone)) return true
        return false
      })
      setPatientTickets(filtered)
    } catch {} finally {
      setLoadingPatientTickets(false)
    }
  }

  const handleSearchPatientTicket = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = ticketSearchInput.trim()
    if (!q) {
      setTicketSearchError('Please enter a Ticket ID, phone number, or email.')
      return
    }
    setIsSearchingTicket(true)
    setTicketSearchError(null)
    setTicketLookupResult(null)
    try {
      const res = await getSupportTicketByCodeOrContact(q)
      if (res) {
        setTicketLookupResult(res)
      } else {
        setTicketSearchError('No support ticket found matching this code or contact info.')
      }
    } catch {
      setTicketSearchError('Unable to check ticket status. Please try again.')
    } finally {
      setIsSearchingTicket(false)
    }
  }

  // ==========================================
  // REAL-TIME SUPABASE SUBSCRIPTION
  // ==========================================
  useEffect(() => {
    if (!patientUser) return

    const channel = supabase
      .channel('patient_portal_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          loadAppointments()
          loadTransactions()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_reports' },
        () => {
          loadAppointments()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientUser])

  // ==========================================
  // PERSISTENT 5-MINUTE PAYMENT TIMER LOGIC
  // ==========================================
  useEffect(() => {
    if (bookingStep !== 4) return

    // Check or initialize stored expiration epoch ms
    const sessionKey = 'dactor_patient_payment_session'
    let targetEpoch: number
    const savedSession = localStorage.getItem(sessionKey)

    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession)
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          targetEpoch = parsed.expiresAt
        } else {
          // expired or invalid, reset 5 min
          targetEpoch = Date.now() + 300_000
          localStorage.setItem(sessionKey, JSON.stringify({ expiresAt: targetEpoch }))
        }
      } catch {
        targetEpoch = Date.now() + 300_000
        localStorage.setItem(sessionKey, JSON.stringify({ expiresAt: targetEpoch }))
      }
    } else {
      targetEpoch = Date.now() + 300_000
      localStorage.setItem(sessionKey, JSON.stringify({ expiresAt: targetEpoch }))
    }

    const interval = setInterval(() => {
      const remainingSeconds = Math.max(0, Math.floor((targetEpoch - Date.now()) / 1000))
      setPaymentTimeRemaining(remainingSeconds)

      if (remainingSeconds <= 0) {
        clearInterval(interval)
        localStorage.removeItem(sessionKey)
        handleCancelPaymentSession('Payment timer expired (5 minutes). Slot reservation returned.')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [bookingStep])

  // ==========================================
  // BOOKING WIZARD HANDLERS
  // ==========================================
  // When Clinic is selected, load its doctors, services, and payment config
  const handleSelectClinic = async (clinic: Clinic, preselectedDoctor?: Doctor) => {
    setSelectedClinic(clinic)
    setSelectedDoctor(preselectedDoctor || null)
    setSelectedService(null)
    setSelectedLabTests([])
    setSelectedSlot(null)
    setIsReturningPatient(false)
    setFollowupCodeInput('')
    setRetainedAppointment(null)
    setFollowupLookupError(null)

    try {
      const [docs, servs, pCfg] = await Promise.all([
        getDoctorsByClinic(clinic.id),
        getClinicServices(clinic.id),
        getClinicPaymentConfig(clinic.id),
      ])
      setClinicDoctors(docs)
      const availServs = servs.filter((s) => s.isAvailable !== false)
      setClinicServices(availServs)
      setClinicPaymentConfig(pCfg)

      const isLab =
        clinic.type === 'diagnostic_lab' ||
        clinic.type?.toLowerCase().includes('lab') ||
        clinic.name.toLowerCase().includes('lab') ||
        (clinic.specialties?.some(
          (s) => s.toLowerCase().includes('lab') || s.toLowerCase().includes('patholog')
        ) ?? false)

      if (isLab) {
        setBookingMode('lab')
        if (availServs.length > 0) {
          setSelectedLabTests([availServs[0]])
        } else {
          setSelectedLabTests([])
        }
      } else {
        setBookingMode('opd')
        if (preselectedDoctor) {
          const matched = docs.find((d) => d.id === preselectedDoctor.id) || preselectedDoctor
          setSelectedDoctor(matched)
        } else if (docs.length > 0) {
          setSelectedDoctor(docs[0])
        }
      }

      setBookingStep(2)
    } catch (err) {
      console.error('Failed to load clinic details:', err)
    }
  }

  // Load available slots for selected clinic & date
  useEffect(() => {
    if (!selectedClinic || bookingStep !== 2) return

    async function loadSlotsForDate() {
      setIsLoadingSlots(true)
      try {
        const rawSlots = await getSlots(selectedClinic!.id, bookingDate)

        // FILTER: Remove slots whose end time has already expired!
        const validSlots = rawSlots.filter((slot) => {
          const isExpired = isSlotTimeExpired(bookingDate, slot.endTime)
          const hasCapacity = slot.bookedCount < slot.maxCapacity
          return !isExpired && hasCapacity && slot.isAvailable !== false
        })

        setAvailableSlots(validSlots)
        if (validSlots.length > 0) {
          setSelectedSlot(validSlots[0])
        } else {
          setSelectedSlot(null)
        }
      } catch (err) {
        console.error('Failed to load slots:', err)
      } finally {
        setIsLoadingSlots(false)
      }
    }

    loadSlotsForDate()
  }, [selectedClinic, bookingDate, bookingStep, isLabClinic])

  // Calculate Fee strictly matching rules for all 3 clinic types
  const calculatedFee = useMemo(() => {
    if (isLabClinic) {
      return selectedLabTests.reduce((acc, t) => acc + (t.price || 0), 0)
    }
    if (isReturningPatient && retainedAppointment) {
      return 0 // 100% Free Follow-up
    }
    return selectedDoctor?.consultationFee || 500
  }, [isLabClinic, selectedLabTests, isReturningPatient, retainedAppointment, selectedDoctor])

  // Confirm booking & launch payment
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault()

    if (!bookPatientName.trim()) {
      alert('Please enter patient full name')
      return
    }
    if (!bookPatientPhone.trim() || bookPatientPhone.length < 8) {
      alert('Please enter a valid 10-digit mobile number')
      return
    }

    // Set new payment timer session
    const expiresAt = Date.now() + 300_000
    localStorage.setItem('dactor_patient_payment_session', JSON.stringify({ expiresAt }))
    setPaymentTimeRemaining(300)
    setBookingStep(4)
  }

  // Cancel payment session & show 2-second failed notice
  const handleCancelPaymentSession = (reason: string = 'Transaction cancelled') => {
    localStorage.removeItem('dactor_patient_payment_session')
    setBookingStep(2) // Back to slot booking
    setTransactionFailedNotice(`Transaction Cancelled: ${reason}`)
    setTimeout(() => {
      setTransactionFailedNotice(null)
    }, 2000)
  }

  // Complete Payment (either Testing Bypass, Free Follow-up, or Gateway Confirmation)
  const handleExecutePayment = async (isBypass: boolean = false) => {
    if (isPaymentProcessing) return // Prevent double clicking!
    setIsPaymentProcessing(true)

    try {
      const code10 = generate10DigitTrackingCode()
      const slotTimeStr = selectedSlot
        ? `${selectedSlot.startTime} - ${selectedSlot.endTime}`
        : '10:00 AM'

      const isFreeFollowup = isReturningPatient && retainedAppointment && calculatedFee === 0

      // 1. Create Appointment in Supabase
      const newAppt = await createAppointment({
        trackingCode10Digit: code10,
        userId: patientUser?.id,
        clinicId: selectedClinic!.id,
        doctorId: isLabClinic ? undefined : selectedDoctor?.id,
        patientName: bookPatientName.trim(),
        patientAge: parseInt(bookPatientAge) || 28,
        patientGender: bookPatientGender,
        patientMobile: bookPatientPhone.trim(),
        patientEmail: patientUser?.email,
        appointmentDate: bookingDate,
        appointmentTime: slotTimeStr,
        checkinStatus: 'waiting',
        paymentStatus: 'paid',
        feeAmount: calculatedFee,
        notes: isFreeFollowup
          ? `Follow-Up Visit (Previous Code: #${retainedAppointment.trackingCode10Digit})`
          : (bookPatientNotes.trim() || (isLabClinic ? 'Diagnostic Lab Sample Collection' : undefined)),
        selectedTests: isLabClinic ? selectedLabTests.map((t) => t.serviceName) : [],
        optInEarlyCall: bookOptInEarlyCall,
      })

      if (!newAppt) {
        throw new Error('Failed to create appointment in database')
      }

      // 2. Record Transaction & Billing Invoice in Supabase
      const methodLabel = isFreeFollowup
        ? 'FREE FOLLOW-UP'
        : isBypass
        ? 'Bypass Test'
        : selectedPaymentMethod.toUpperCase()

      await recordPaymentTransaction({
        appointmentId: newAppt.id,
        trackingCode: code10,
        clinicId: selectedClinic!.id,
        doctorId: isLabClinic ? undefined : selectedDoctor?.id,
        patientName: bookPatientName.trim(),
        appointmentDate: bookingDate,
        appointmentTime: slotTimeStr,
        amount: calculatedFee,
        paymentMethod: methodLabel,
        paymentStatus: 'paid',
        notes: isFreeFollowup
          ? `Free Follow-Up (Previous ID: #${retainedAppointment.trackingCode10Digit})`
          : isBypass
          ? 'Confirmed via Testing Bypass button'
          : `Digital Wallet (${methodLabel})`,
      })

      // 3. Save tracking code locally
      saveTrackingCodeLocally(code10)

      // 4. Clear payment session
      localStorage.removeItem('dactor_patient_payment_session')

      // 5. Trigger Confetti & Success View
      setConfirmedBooking(newAppt)
      setBookingStep(5)
      triggerConfettiBurst()

      // Reload appointments & transactions
      loadAppointments()
      loadTransactions()
    } catch (err: any) {
      alert(`Booking failed: ${err.message || 'Unknown network error'}`)
    } finally {
      setIsPaymentProcessing(false)
    }
  }

  // Cancel Appointment from list
  const handleCancelAppointment = async (apptId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return
    setCancellingApptId(apptId)
    try {
      const ok = await cancelAppointment(apptId)
      if (ok) {
        await loadAppointments()
        await loadTransactions()
      } else {
        alert('Could not cancel appointment. Please try again.')
      }
    } finally {
      setCancellingApptId(null)
    }
  }

  // Copy tracking code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // ==========================================
  // PENDING BOOKING RESTORE & ADVANCE HANDLERS
  // ==========================================
  const handleProceedFromSlotStep = () => {
    if (isLabClinic && selectedLabTests.length === 0) {
      alert('Please select at least one diagnostic test or pathology package to continue.')
      return
    }
    if (!selectedSlot && availableSlots.length > 0) {
      alert('Please select a preferred time slot to continue.')
      return
    }

    // If unauthenticated (Guest / Demo mode), save booking position and prompt Google Sign-In
    if (!patientUser) {
      const pendingRedirect = {
        clinicId: selectedClinic?.id,
        doctorId: selectedDoctor?.id,
        serviceId: selectedService?.id,
        selectedLabTestIds: selectedLabTests.map((t) => t.id),
        bookingMode,
        bookingDate,
        selectedSlotId: selectedSlot?.id,
        isReturningPatient,
        followupCodeInput,
      }
      try {
        localStorage.setItem('dactor_pending_booking_redirect', JSON.stringify(pendingRedirect))
      } catch {}
      setPendingBookingRedirectNotice(true)
      setShowAuthModal(true)
      return
    }

    setBookingStep(3)
  }

  const restorePendingBookingRedirect = async (overrideClinics?: Clinic[]) => {
    const pendingRaw = localStorage.getItem('dactor_pending_booking_redirect')
    if (!pendingRaw) return
    try {
      const parsed = JSON.parse(pendingRaw)
      if (parsed.clinicId) {
        const availableClinics = overrideClinics || clinics
        let clinicMatch = availableClinics.find((c) => c.id === parsed.clinicId)
        if (!clinicMatch) {
          const fetched = await getClinics()
          clinicMatch = fetched.find((c) => c.id === parsed.clinicId)
        }
        if (clinicMatch) {
          setSelectedClinic(clinicMatch)
          const [docs, servs, pCfg] = await Promise.all([
            getDoctorsByClinic(clinicMatch.id),
            getClinicServices(clinicMatch.id),
            getClinicPaymentConfig(clinicMatch.id),
          ])
          setClinicDoctors(docs)
          setClinicServices(servs.filter((s) => s.isAvailable))
          setClinicPaymentConfig(pCfg)

          if (parsed.doctorId) {
            const docMatch = docs.find((d) => d.id === parsed.doctorId)
            if (docMatch) setSelectedDoctor(docMatch)
          }
          if (parsed.serviceId) {
            const servMatch = servs.find((s) => s.id === parsed.serviceId)
            if (servMatch) setSelectedService(servMatch)
          }
          if (parsed.bookingMode) setBookingMode(parsed.bookingMode)
          if (parsed.bookingDate) setBookingDate(parsed.bookingDate)

          if (parsed.selectedSlotId) {
            const rawSlots = await getSlots(clinicMatch.id, parsed.bookingDate)
            const validSlots = rawSlots.filter((slot) => {
              const isExpired = isSlotTimeExpired(parsed.bookingDate, slot.endTime)
              const hasCapacity = slot.bookedCount < slot.maxCapacity
              return !isExpired && hasCapacity && slot.isAvailable !== false
            })
            setAvailableSlots(validSlots)
            const slotMatch = validSlots.find((s) => s.id === parsed.selectedSlotId)
            if (slotMatch) setSelectedSlot(slotMatch)
          }

          setActiveTab('book')
          setBookingStep(3)
          localStorage.removeItem('dactor_pending_booking_redirect')
          setPendingBookingRedirectNotice(false)
          setBookingRestoredToast('Booking selection restored! Resuming right where you left off.')
          setTimeout(() => setBookingRestoredToast(null), 4000)
        }
      }
    } catch (err) {
      console.warn('Failed restoring booking redirect:', err)
    }
  }

  // ==========================================
  // CLAIM APPOINTMENT WITH 10-DIGIT CODE
  // ==========================================
  const handleClaimAppointmentCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = claimCodeInput.trim().replace(/\D/g, '')
    if (clean.length !== 10) {
      setClaimCodeError('Please enter a valid 10-digit numeric tracking code.')
      return
    }

    setIsClaimingCode(true)
    setClaimCodeError(null)
    try {
      const appt = await getAppointmentByTrackingCode(clean)
      if (!appt) {
        setClaimCodeError(`No appointment found with tracking code #${clean}. Please verify and try again.`)
        return
      }

      saveTrackingCodeLocally(clean)

      if (patientUser?.id && (!appt.userId || appt.userId !== patientUser.id)) {
        try {
          await supabase
            .from('appointments')
            .update({ user_id: patientUser.id, patient_email: patientUser.email })
            .eq('tracking_code_10_digit', clean)
        } catch {}
      }

      await loadAppointments()
      await loadTransactions()
      setShowClaimModal(false)
      setClaimCodeInput('')
      setBookingRestoredToast(`Token #${clean} for ${appt.patientName} claimed & added to your appointments!`)
      setTimeout(() => setBookingRestoredToast(null), 4000)
    } catch (err: any) {
      setClaimCodeError(err.message || 'Failed to claim appointment.')
    } finally {
      setIsClaimingCode(false)
    }
  }

  // ==========================================
  // RESCHEDULE APPOINTMENT HANDLER
  // ==========================================
  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rescheduleAppt) return
    setIsRescheduling(true)
    try {
      const ok = await shiftAppointmentDate(
        rescheduleAppt.id,
        newRescheduleDate,
        newRescheduleTime,
        rescheduleReason.trim() || 'Patient requested reschedule via Patient Portal'
      )
      if (ok) {
        setRescheduleAppt(null)
        await loadAppointments()
        setBookingRestoredToast(`Appointment shifted to ${newRescheduleDate} (${newRescheduleTime}) successfully!`)
        setTimeout(() => setBookingRestoredToast(null), 3500)
      } else {
        alert('Could not reschedule appointment. Please try again.')
      }
    } catch (err: any) {
      alert(`Error rescheduling: ${err.message || err}`)
    } finally {
      setIsRescheduling(false)
    }
  }

  // ==========================================
  // LAB REPORTS LOOKUP & PRIVACY VERIFICATION
  // ==========================================
  const handleLookupLabReport = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = reportSearchCode.trim().replace(/\D/g, '')
    if (clean.length < 5) return
    setIsSearchingReport(true)
    setReportSearchError(null)
    try {
      const reports = await getLabReportsByTrackingCode(clean)
      if (reports.length > 0) {
        setPatientLabReports((prev) => {
          const map = new Map<string, LabReport>()
          for (const r of [...reports, ...prev]) map.set(r.id, r)
          return Array.from(map.values())
        })
        saveTrackingCodeLocally(clean)
        setBookingRestoredToast(`Found ${reports.length} report(s) for token #${clean}`)
        setTimeout(() => setBookingRestoredToast(null), 3000)
      } else {
        setReportSearchError(`No diagnostic lab report found for token #${clean}.`)
      }
    } catch {
      setReportSearchError('Failed to lookup lab report.')
    } finally {
      setIsSearchingReport(false)
    }
  }

  const handleExecuteReportVerification = (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyingReport) return
    const rawInput = verificationInput.trim()
    if (!rawInput) {
      setVerificationError(
        verifyMethod === 'name'
          ? "Please enter the patient's registered name"
          : "Please enter the patient's registered mobile number"
      )
      return
    }

    if (verifyMethod === 'name') {
      const expected = (verifyingReport.patientName || '').trim().toLowerCase().replace(/\s+/g, ' ')
      const entered = rawInput.toLowerCase().replace(/\s+/g, ' ')
      if (
        !expected ||
        expected === entered ||
        (expected.length >= 3 && expected.includes(entered)) ||
        (entered.length >= 3 && entered.includes(expected))
      ) {
        setUnlockedReportIds((prev) => [...prev, verifyingReport.id])
        if (verifyingReport.reportFileUrl) {
          window.open(verifyingReport.reportFileUrl, '_blank')
        }
        setVerifyingReport(null)
        setVerificationError(null)
      } else {
        setVerificationError('Name does not match records. Please check spelling.')
      }
    } else {
      const enteredDigits = rawInput.replace(/\D/g, '')
      const expectedPhone = (patientUser?.phone || '').replace(/\D/g, '')
      if (
        enteredDigits.length >= 7 &&
        (!expectedPhone ||
          enteredDigits.slice(-10) === expectedPhone.slice(-10) ||
          enteredDigits === expectedPhone)
      ) {
        setUnlockedReportIds((prev) => [...prev, verifyingReport.id])
        if (verifyingReport.reportFileUrl) {
          window.open(verifyingReport.reportFileUrl, '_blank')
        }
        setVerifyingReport(null)
        setVerificationError(null)
      } else {
        setVerificationError('Mobile number does not match the appointment record.')
      }
    }
  }

  // ==========================================
  // AUTHENTICATION HANDLERS (STRICTLY GOOGLE SIGN-IN ONLY)
  // ==========================================
  // Real Google Sign-In linked to Supabase patient database (strictly NO auto-fill of name/gender/age from Google)
  const handleGoogleSignIn = async () => {
    setAuthSubmitting(true)
    setAuthError(null)
    try {
      await firebaseSignOut()
      const gUser = await signInWithFirebaseGoogle()
      if (!gUser || !gUser.email) return

      // Enforce 1 Google Account = 1 Portal Role rule
      const assoc = await checkEmailPortalAssociation(gUser.email)
      if (assoc && assoc.portal !== 'patient') {
        await firebaseSignOut()
        const entitySuffix = assoc.entityName ? ` (${assoc.entityName})` : ''
        setAuthError(
          `This Google account (${assoc.email}) is already associated with a ${assoc.portalLabel} account${entitySuffix}. You cannot log in to the Patient Portal with this Google ID. Please change your Google account.`
        )
        return
      }

      const profile = await getPatientProfileByEmail(gUser.email)
      const photo = gUser.photoURL || undefined
      if (profile && profile.fullName && profile.phone && profile.age && profile.gender) {
        const fullProfile = { ...profile, photoUrl: photo || profile.photoUrl }
        setPatientUser(fullProfile)
        initProfileFields(fullProfile)
        localStorage.setItem('dactor_patient_email', profile.email)
        localStorage.setItem('dactor_patient_session', JSON.stringify(fullProfile))
        localStorage.setItem('dactor_auth_logged_in', 'true')
        localStorage.setItem('dactor_auth_email', profile.email)
        localStorage.setItem('dactor_auth_role', 'patient')
        window.dispatchEvent(new Event('storage'))
        setShowAuthModal(false)
        await restorePendingBookingRedirect()
      } else {
        // New or incomplete Google user: strictly do NOT auto-fill name, gender, or age from Google account
        const partial: PatientProfile = {
          id: profile?.id || crypto.randomUUID(),
          authUid: gUser.uid,
          email: gUser.email,
          fullName: profile?.fullName || '',
          phone: profile?.phone || '',
          age: profile?.age,
          gender: profile?.gender || '',
          photoUrl: photo,
          role: 'patient',
        }
        setPatientUser(partial)
        setEditName(partial.fullName || '')
        setEditPhone(partial.phone || '')
        setEditAge(partial.age ? String(partial.age) : '')
        setEditGender(partial.gender || '')
        localStorage.setItem('dactor_patient_email', partial.email)
        localStorage.setItem('dactor_auth_logged_in', 'true')
        localStorage.setItem('dactor_auth_email', partial.email)
        localStorage.setItem('dactor_auth_role', 'patient')
        window.dispatchEvent(new Event('storage'))
        setShowAuthModal(false)
        setShowEditProfileModal(true)
      }
    } catch (err: any) {
      console.warn('Patient Google Sign-In notice:', err)
      const errCode = err?.code || ''
      if (errCode === 'auth/popup-closed-by-user' || err?.message?.includes('closed-by-user')) {
        setAuthError('Sign-in popup was closed before completing. Please try again.')
      } else if (errCode === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        setAuthError('Popup was blocked by your browser. Please allow popups and try again.')
      } else {
        setAuthError(err.message || 'Google Sign-In failed')
      }
    } finally {
      setAuthSubmitting(false)
    }
  }

  // Save updated profile with strict criteria validation
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientUser) return
    if (editName.trim().length < 2) {
      alert('Please enter your full name (at least 2 characters).')
      return
    }
    const cleanPhone = editPhone.replace(/\D/g, '')
    if (!/^9\d{9}$/.test(cleanPhone)) {
      alert('Please enter a valid 10-digit mobile number starting with 9 (e.g. 98XXXXXXXX).')
      return
    }
    const ageNum = Number(editAge)
    if (!editAge || !Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      alert('Please enter a valid age between 1 and 120.')
      return
    }
    if (!['Male', 'Female', 'Other'].includes(editGender)) {
      alert('Please select your gender.')
      return
    }

    setIsUpdatingProfile(true)
    try {
      const updated = await savePatientProfile({
        id: patientUser.id,
        authUid: patientUser.authUid,
        email: patientUser.email,
        fullName: editName.trim(),
        phone: cleanPhone,
        age: ageNum,
        gender: editGender,
        role: 'patient',
      })
      if (updated) {
        setPatientUser(updated)
        initProfileFields(updated)
        localStorage.setItem('dactor_patient_session', JSON.stringify(updated))
        setShowEditProfileModal(false)
        await restorePendingBookingRedirect()
      }
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleDownloadTransactionReceipt = (tx: PatientTransactionRecord) => {
    const win = window.open('', '_blank', 'width=800,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dactor Receipt - ${tx.trackingCode}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 36px; color: #0f172a; }
            .box { max-width: 680px; margin: 0 auto; border: 2px solid #0284c7; border-radius: 16px; padding: 28px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 999px; font-weight: 800; font-size: 12px; text-transform: uppercase; }
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
                <h2 style="margin:0;font-size:22px;">${tx.clinicName}</h2>
                <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Official Payment & Appointment Invoice</p>
              </div>
              <span class="badge">${tx.paymentStatus}</span>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;">10-Digit Universal Tracking Code</div>
              <div class="code">${tx.trackingCode}</div>
            </div>
            <table>
              <tr><th>Transaction ID</th><td><strong>${tx.transactionId}</strong></td></tr>
              <tr><th>Patient Name</th><td><strong>${tx.patientName}</strong></td></tr>
              <tr><th>Doctor / Service</th><td>${tx.doctorName}</td></tr>
              <tr><th>Appointment Date & Time</th><td>${tx.appointmentDate} • ${tx.appointmentTime}</td></tr>
              <tr><th>Payment Method</th><td>${tx.paymentMethod}</td></tr>
              <tr><th>Total Amount</th><td class="total">NPR ${tx.amount}</td></tr>
            </table>
            <p style="margin-top:24px;font-size:11px;color:#64748b;text-align:center;">
              Synced from Supabase Billing Invoices • Dactor Healthcare Ecosystem
            </p>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const handlePrintAppointmentBill = (appt: Appointment) => {
    const win = window.open('', '_blank', 'width=800,height=750')
    if (!win) return
    const clinicTitle = appt.clinic?.name || 'Dactor Certified Healthcare Center'
    const clinicAddr = appt.clinic?.addressText || 'Kathmandu, Nepal'
    const docTitle = appt.doctor?.fullName || 'General OPD Specialist'
    const docSpec = appt.doctor?.specialty || 'General Medicine'
    const isPaid = appt.paymentStatus === 'paid'

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dactor Bill Slip - #${appt.trackingCode10Digit}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; padding: 32px; color: #0f172a; background: #fff; }
            .box { max-width: 650px; margin: 0 auto; border: 2px solid #0d9488; border-radius: 16px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f0fdfa; padding-bottom: 16px; margin-bottom: 18px; }
            .badge { background: ${isPaid ? '#ecfdf5' : '#fffbeb'}; color: ${isPaid ? '#047857' : '#b45309'}; border: 1px solid ${isPaid ? '#a7f3d0' : '#fde68a'}; padding: 6px 12px; border-radius: 999px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            .code-box { background: #f0fdf4; border: 1px dashed #14b8a6; border-radius: 12px; padding: 12px 16px; margin: 16px 0; text-align: center; }
            .code { font-family: monospace; font-size: 28px; font-weight: 900; letter-spacing: 4px; color: #0f766e; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 9px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            th { color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
            .total-row { border-top: 2px solid #0f172a; font-size: 16px; font-weight: 900; color: #0f172a; }
            .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="header">
              <div>
                <h2 style="margin:0;font-size:20px;color:#0f172a;">${clinicTitle}</h2>
                <p style="margin:3px 0 0;font-size:12px;color:#64748b;">${clinicAddr}</p>
                <p style="margin:2px 0 0;font-size:11px;font-weight:700;color:#0d9488;">Official Medical Consultation Invoice & Token Slip</p>
              </div>
              <span class="badge">${isPaid ? 'PAID ONLINE' : 'PAYABLE AT CLINIC'}</span>
            </div>

            <div class="code-box">
              <div style="font-size:10px;text-transform:uppercase;color:#0f766e;font-weight:800;letter-spacing:1px;">10-Digit Live OPD Queue Token</div>
              <div class="code">#${appt.trackingCode10Digit}</div>
              <div style="font-size:11px;color:#475569;margin-top:2px;">Present this token at the reception desk for instant queue check-in</div>
            </div>

            <table>
              <tr><th>Invoice No.</th><td><strong style="font-family:monospace;">INV-${appt.trackingCode10Digit}</strong></td></tr>
              <tr><th>Patient Name</th><td><strong>${appt.patientName}</strong> (${appt.patientAge || '–'} Yrs, ${appt.patientGender || '–'})</td></tr>
              <tr><th>Attending Doctor</th><td>Dr. ${docTitle} (${docSpec})</td></tr>
              <tr><th>Scheduled Date & Slot</th><td><strong>${appt.appointmentDate}</strong> • ${appt.appointmentTime}</td></tr>
              <tr><th>Registered Phone</th><td><span style="font-family:monospace;">${appt.patientMobile || '–'}</span></td></tr>
              <tr><th>Doctor Consultation Charge</th><td>NPR ${appt.feeAmount || 0}</td></tr>
              <tr><th>Clinic Token & Registration</th><td><span style="color:#059669;font-weight:700;">FREE / INCLUDED</span></td></tr>
              <tr class="total-row"><th>Total Payable Amount</th><td style="color:#0d9488;font-size:17px;font-weight:900;">NPR ${appt.feeAmount || 0}</td></tr>
              <tr><th>Payment Mode</th><td>${appt.paymentMethod ? appt.paymentMethod.toUpperCase() : (isPaid ? 'DIGITAL GATEWAY' : 'CASH / FONEPAY AT RECEPTION')}</td></tr>
            </table>

            <div class="footer">
              <p style="margin:0;font-weight:700;color:#334155;">Verified by Dactor Unified Health Cloud Ecosystem</p>
              <p style="margin:3px 0 0;font-size:10px;">Generated automatically on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const handleLogout = () => {
    firebaseSignOut()
    localStorage.removeItem('dactor_patient_email')
    localStorage.removeItem('dactor_patient_session')
    localStorage.removeItem('dactor_auth_logged_in')
    localStorage.removeItem('dactor_auth_email')
    localStorage.removeItem('dactor_auth_role')
    setPatientUser(null)
    setMyAppointments([])
    setTransactions([])
    window.dispatchEvent(new Event('storage'))
  }

  // Family Members Management
  const handleAddFamilyMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFamilyName.trim()) return

    const newMem: FamilyMember = {
      id: crypto.randomUUID(),
      name: newFamilyName.trim(),
      relation: newFamilyRelation,
      age: parseInt(newFamilyAge) || 25,
      gender: newFamilyGender,
      phone: newFamilyPhone.trim(),
    }

    const updated = [...familyMembers, newMem]
    setFamilyMembers(updated)
    localStorage.setItem('dactor_family_members', JSON.stringify(updated))
    setNewFamilyName('')
    setNewFamilyAge('')
    setNewFamilyPhone('')
    setShowAddFamilyModal(false)
  }

  const handleDeleteFamilyMember = (id: string) => {
    const updated = familyMembers.filter((f) => f.id !== id)
    setFamilyMembers(updated)
    localStorage.setItem('dactor_family_members', JSON.stringify(updated))
  }

  // Filter Active vs Past appointments
  const todayStr = new Date().toISOString().split('T')[0]
  const filteredAppointments = myAppointments.filter((a) => {
    if (appointmentFilter === 'active') {
      return a.appointmentDate >= todayStr && a.checkinStatus !== 'cancelled'
    } else {
      return a.appointmentDate < todayStr || a.checkinStatus === 'cancelled'
    }
  })

  // Format countdown minutes:seconds
  const timerMinutes = Math.floor(paymentTimeRemaining / 60)
  const timerSeconds = paymentTimeRemaining % 60
  const formattedTimer = `${timerMinutes.toString().padStart(2, '0')}:${timerSeconds.toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen py-5 sm:py-8 px-3 sm:px-6 lg:px-8 pb-28 sm:pb-12">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Transaction Failed Notice Toast (2-second transient notice) */}
        {transactionFailedNotice && (
          <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-50 bg-rose-600/90 backdrop-blur-md text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-bounce text-xs sm:text-sm border border-rose-400/30">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="font-bold">{transactionFailedNotice}</span>
          </div>
        )}

        {/* Booking Selection Restored Toast */}
        {bookingRestoredToast && (
          <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600/90 backdrop-blur-md text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4 text-xs sm:text-sm border border-emerald-400/30">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="font-bold">{bookingRestoredToast}</span>
          </div>
        )}

        {/* 30-DAY ARCHIVE LOCK BANNER (ProfileScreen.kt lines 42-78) */}
        {patientUser?.isArchived && (
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl liquid-glass-elevated bg-rose-950/80 text-white border border-rose-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-rose-400/50 to-transparent" />
            <div className="flex items-start space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-600/80 flex items-center justify-center shrink-0 border border-rose-400/30">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="space-y-1 text-left">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white">
                    30-Day Deletion Grace Period
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-200">
                    {archiveDaysLeft} Days Remaining
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black">
                  Patient Account Archived &amp; Scheduled for Deletion
                </h2>
                <p className="text-xs text-rose-200 max-w-2xl leading-relaxed">
                  Your patient account is scheduled for permanent deletion on{' '}
                  <strong>{patientUser.deletionScheduledAt?.split('T')[0] || '30 days from archive'}</strong>. You can restore full account access, health records, and booking history anytime before the countdown expires.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelPatientArchive}
              className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-500/25 cursor-pointer shrink-0 transition active:scale-[0.98]"
            >
              Cancel Deletion &amp; Restore Account
            </button>
          </div>
        )}

        {/* ==========================================
            PATIENT HEADER & PROFILE BAR
        ========================================== */}
        <div className="liquid-glass-elevated rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-white/40 dark:border-white/10 relative overflow-hidden shadow-sm">
          {/* Top specular refraction sheen */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 font-black text-xl sm:text-2xl flex-shrink-0 overflow-hidden border border-white/20">
                {patientUser?.photoUrl ? (
                  <img
                    src={patientUser.photoUrl}
                    alt={patientUser.fullName || 'Patient Photo'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                ) : patientUser?.fullName ? (
                  patientUser.fullName.charAt(0).toUpperCase()
                ) : (
                  <User className="w-6 h-6 sm:w-8 sm:h-8" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                    {patientUser?.fullName || 'Guest Patient Portal'}
                  </h1>
                  {patientUser ? (
                    <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Verified Patient
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      Guest Mode
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="truncate max-w-[200px] sm:max-w-none">{patientUser?.email || 'Track bookings & health records'}</span>
                  {patientUser?.phone && <span>• {patientUser.phone}</span>}
                  {patientUser?.age && <span>• {patientUser.age}y</span>}
                  {patientUser?.gender && <span>• {patientUser.gender}</span>}
                </p>
              </div>
            </div>

            {/* Profile Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-white/20 dark:border-white/5">
              {patientUser ? (
                <>
                  <button
                    onClick={() => setShowEditProfileModal(true)}
                    className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 liquid-glass-card hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-xl transition border border-white/40 dark:border-white/10 cursor-pointer active:scale-[0.98]"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 liquid-glass-card hover:bg-rose-500/20 rounded-xl transition border border-rose-500/30 cursor-pointer active:scale-[0.98]"
                  >
                    <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAuthError(null)
                    setShowAuthModal(true)
                  }}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 sm:px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-teal-500/20 transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ==========================================
            PORTAL NAVIGATION TABS
        ========================================== */}
        <div className="liquid-glass-subtle rounded-2xl p-1.5 sm:p-2 border border-white/40 dark:border-white/10 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none sm:flex-wrap">
          {[
            { id: 'appointments', label: 'My Appointments & Live Queue', icon: Calendar, badge: myAppointments.length },
            { id: 'book', label: 'Book New Appointment', icon: Sparkles },
            { id: 'transactions', label: 'Transaction History', icon: CreditCard, badge: transactions.length },
            { id: 'reports', label: 'Diagnostic Lab Reports', icon: FileText, badge: patientLabReports.length },
            { id: 'notifications', label: 'Queue Alerts & Updates', icon: Bell, badge: unreadCount },
            { id: 'family', label: 'Family Profiles', icon: Users, badge: familyMembers.length },
            {
              id: 'help',
              label: 'Help Requests',
              icon: Headphones,
              badge: patientTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
            },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any)
                  if (tab.id === 'book') setBookingStep(1)
                }}
                className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 sm:shrink cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full font-bold ${
                      isActive ? 'bg-white text-teal-800' : 'liquid-glass-card text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ==========================================
            TAB 1: MY APPOINTMENTS & LIVE QUEUE
        ========================================== */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            {/* Filter Sub-nav */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-1.5 liquid-glass-subtle p-1 rounded-xl border border-white/40 dark:border-white/10">
                <button
                  onClick={() => setAppointmentFilter('active')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    appointmentFilter === 'active'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Active & Upcoming
                </button>
                <button
                  onClick={() => setAppointmentFilter('past')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    appointmentFilter === 'past'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Past & History
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setClaimCodeInput('')
                    setClaimCodeError(null)
                    setShowClaimModal(true)
                  }}
                  className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 liquid-glass-card hover:bg-white/80 dark:hover:bg-slate-800/80 border border-white/40 dark:border-white/10 px-3.5 py-2 rounded-xl transition shadow-2xs cursor-pointer active:scale-[0.98]"
                >
                  <KeyRound className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Claim 10-Digit Code</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('book')
                    setBookingStep(1)
                  }}
                  className="flex items-center space-x-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-3.5 py-2 rounded-xl transition cursor-pointer border border-teal-500/20 active:scale-[0.98]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ Book Another</span>
                </button>
              </div>
            </div>

            {isLoadingAppointments ? (
              <div className="p-12 text-center liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 dark:text-teal-400 mb-3" />
                <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm">Loading your appointments & live queue tokens...</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="p-12 text-center liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <Calendar className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">No {appointmentFilter} appointments found</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    You have no {appointmentFilter} tokens scheduled. Book an OPD slot or claim an existing 10-digit appointment code.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('book')
                      setBookingStep(1)
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-sm rounded-xl transition shadow-md shadow-teal-500/20 cursor-pointer active:scale-[0.98]"
                  >
                    Book OPD or Lab Slot
                  </button>
                  <button
                    onClick={() => {
                      setClaimCodeInput('')
                      setClaimCodeError(null)
                      setShowClaimModal(true)
                    }}
                    className="px-5 py-2.5 liquid-glass-card hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl transition border border-white/40 dark:border-white/10 shadow-2xs cursor-pointer active:scale-[0.98]"
                  >
                    Claim with 10-Digit Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredAppointments.map((appt) => {
                  const isToday = appt.appointmentDate === todayStr
                  const isCancelled = appt.checkinStatus === 'cancelled'

                  return (
                    <div
                      key={appt.id}
                      className={`liquid-glass-card rounded-3xl p-6 shadow-sm border transition hover:shadow-md relative overflow-hidden ${
                        isToday ? 'border-teal-500/80 ring-2 ring-teal-500/20' : 'border-white/40 dark:border-white/10'
                      }`}
                    >
                      {/* Top Bar with 10-Digit Code Pill */}
                      <div className="flex items-center justify-between pb-4 border-b border-white/20 dark:border-white/5">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            10-Digit Token:
                          </span>
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-white liquid-glass-subtle px-2.5 py-1 rounded-lg border border-white/30 dark:border-white/10">
                            {appt.trackingCode10Digit}
                          </span>
                          <button
                            onClick={() => handleCopyCode(appt.trackingCode10Digit)}
                            className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer"
                            title="Copy tracking code"
                          >
                            {copiedCode === appt.trackingCode10Digit ? (
                              <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                            isCancelled
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                              : appt.checkinStatus === 'completed'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                              : appt.checkinStatus === 'in_consultation'
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 animate-pulse'
                              : 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20'
                          }`}
                        >
                          {isCancelled
                            ? 'Cancelled'
                            : appt.checkinStatus === 'in_consultation'
                            ? 'Inside Chamber'
                            : appt.checkinStatus === 'completed'
                            ? 'Completed'
                            : 'In Queue'}
                        </span>
                      </div>

                      {/* Doctor & Clinic Info */}
                      <div className="py-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white">
                              {appt.doctor?.fullName || 'General OPD Specialist'}
                            </h4>
                            <p className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                              {appt.doctor?.specialty || 'General Medicine'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block">Consultation Fee</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              NPR {appt.feeAmount > 0 ? appt.feeAmount : 'Free'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{appt.clinic?.name || 'Clinic Center'}</span>
                          {appt.clinic?.addressText && <span>• {appt.clinic.addressText}</span>}
                        </div>

                        {/* Date & Slot Time */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <div className="flex items-center space-x-1.5 liquid-glass-subtle px-3 py-1.5 rounded-xl border border-white/30 dark:border-white/10">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{appt.appointmentDate}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 liquid-glass-subtle px-3 py-1.5 rounded-xl border border-white/30 dark:border-white/10">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{appt.appointmentTime}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 bg-teal-500/10 text-teal-800 dark:text-teal-300 px-3 py-1.5 rounded-xl border border-teal-500/20">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{appt.paymentStatus === 'paid' ? 'Paid Online' : 'Payment at Clinic'}</span>
                          </div>
                        </div>

                        {/* Patient Name */}
                        <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                          Patient: <strong className="text-slate-800 dark:text-slate-200">{appt.patientName}</strong> ({appt.patientAge || 28} yrs, {appt.patientGender || 'Male'})
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-4 border-t border-white/20 dark:border-white/5 flex items-center justify-between gap-3">
                        <button
                          onClick={() => {
                            if (onOpenLiveQueue) {
                              onOpenLiveQueue(appt.trackingCode10Digit)
                            } else {
                              window.location.hash = '#live-queue'
                            }
                          }}
                          className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 rounded-xl transition shadow-xs cursor-pointer active:scale-[0.98]"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Queue Board</span>
                        </button>

                        <button
                          onClick={() => setViewingBillAppt(appt)}
                          className="px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 liquid-glass-card hover:bg-teal-500/20 rounded-xl transition border border-teal-500/30 flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                          title="View Official Medical Bill / Slip"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Bill Slip</span>
                        </button>

                        {!isCancelled && appt.checkinStatus !== 'completed' && (
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => {
                                setRescheduleAppt(appt)
                                setNewRescheduleDate(appt.appointmentDate)
                                setNewRescheduleTime(appt.appointmentTime || '10:00 AM - 11:00 AM')
                                setRescheduleReason('')
                              }}
                              className="px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 liquid-glass-card hover:bg-teal-500/20 rounded-xl transition border border-teal-500/30 cursor-pointer active:scale-[0.98]"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(appt.id)}
                              disabled={cancellingApptId === appt.id}
                              className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 liquid-glass-card hover:bg-rose-500/20 rounded-xl transition border border-rose-500/30 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                            >
                              {cancellingApptId === appt.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 2: BOOK NEW APPOINTMENT (STEP-BY-STEP)
        ========================================== */}
        {activeTab === 'book' && (
          <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-10 shadow-sm border border-white/40 dark:border-white/10 space-y-8 relative overflow-hidden">
            {/* Top specular refraction sheen */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

            {/* Step Progress Header */}
            <div>
              <div className="flex items-center justify-between max-w-xl mx-auto mb-6">
                {[
                  { num: 1, label: 'Select Clinic' },
                  { num: 2, label: 'Date & Slot' },
                  { num: 3, label: 'Patient Info' },
                  { num: 4, label: 'Payment' },
                ].map((st) => (
                  <div key={st.num} className="flex items-center space-x-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        bookingStep === st.num
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/30 ring-4 ring-teal-500/20'
                          : bookingStep > st.num
                          ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20'
                          : 'liquid-glass-subtle text-slate-400 dark:text-slate-500 border border-white/20'
                      }`}
                    >
                      {bookingStep > st.num ? '✓' : st.num}
                    </div>
                    <span
                      className={`text-xs font-bold hidden sm:inline ${
                        bookingStep === st.num ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 1: SELECT CLINIC & DOCTOR */}
            {bookingStep === 1 && (
              <div className="space-y-6">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">Choose a Medical Center</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select an OPD Clinic, Multi-Specialty Polyclinic, or Diagnostic Pathology Lab. All verified centers include real-time queue tokens and address directions.
                  </p>
                </div>

                {/* Search & Clinic Category Filter Pills */}
                <div className="space-y-3 max-w-3xl mx-auto">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={clinicSearchQuery}
                      onChange={(e) => setClinicSearchQuery(e.target.value)}
                      placeholder="Search clinic by name, address city, or medical specialty..."
                      className="w-full pl-11 pr-4 py-3 liquid-glass-input rounded-2xl text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    />
                    {clinicSearchQuery && (
                      <button
                        onClick={() => setClinicSearchQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 4 Category Filter Pills */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {[
                      { id: 'all', label: 'All Centers', icon: Building2 },
                      { id: 'single_doctor', label: 'Single-Visit OPD Clinics', icon: Stethoscope },
                      { id: 'polyclinic', label: 'Multi-Specialty Polyclinics', icon: Users },
                      { id: 'diagnostic_lab', label: 'Diagnostic Pathology Labs', icon: FlaskConical },
                    ].map((pill) => {
                      const Icon = pill.icon
                      const isSel = clinicCategoryFilter === pill.id
                      return (
                        <button
                          key={pill.id}
                          onClick={() => setClinicCategoryFilter(pill.id as any)}
                          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-[0.98] ${
                            isSel
                              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-xs'
                              : 'liquid-glass-card text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-white/40 dark:border-white/10'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{pill.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* City Selector if multiple cities available */}
                  {availableCities.length > 1 && (
                    <div className="flex items-center justify-center pt-1">
                      <div className="flex items-center space-x-1.5 liquid-glass-subtle px-3 py-1.5 rounded-xl border border-white/40 dark:border-white/10 text-xs font-bold">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span className="text-slate-500">City / Region:</span>
                        <select
                          value={selectedCityFilter}
                          onChange={(e) => setSelectedCityFilter(e.target.value)}
                          className="bg-transparent font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
                        >
                          <option value="all" className="dark:bg-slate-900">All Locations</option>
                          {availableCities.map((city) => (
                            <option key={city} value={city} className="dark:bg-slate-900">
                              {city}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Quick Symptoms Suggestion Chips */}
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs justify-center pt-1 scrollbar-none">
                    <span className="font-bold text-slate-400 dark:text-slate-500 shrink-0 text-[11px] uppercase tracking-wider">
                      Quick Symptoms:
                    </span>
                    {QUICK_SPECIALTY_SUGGESTIONS.slice(0, 7).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          const keyword = suggestion.split('/')[0].split('&')[0].replace(/\(.*\)/, '').trim()
                          setClinicSearchQuery(keyword)
                          saveRecentSearch(keyword)
                        }}
                        className="px-2.5 py-1 rounded-xl liquid-glass-subtle hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold shrink-0 cursor-pointer transition border border-teal-500/20 text-[11px] active:scale-[0.98]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtered Clinics Grid with MedicalSearchEngine Scoring */}
                {(() => {
                  const scored = clinics
                    .map((c) => {
                      const t = (c.type || '').toLowerCase()
                      const n = (c.name || '').toLowerCase()
                      const isLab =
                        t === 'diagnostic_lab' ||
                        t.includes('lab') ||
                        n.includes('lab') ||
                        (c.specialties?.some(
                          (s) => s.toLowerCase().includes('lab') || s.toLowerCase().includes('patholog')
                        ) ?? false)
                      const isSingle = !isLab && (t === 'single_visit' || t === 'single_doctor')
                      const isPoly = !isLab && !isSingle

                      if (clinicCategoryFilter === 'diagnostic_lab' && !isLab) return null
                      if (clinicCategoryFilter === 'single_doctor' && !isSingle) return null
                      if (clinicCategoryFilter === 'polyclinic' && !isPoly) return null

                      if (selectedCityFilter !== 'all') {
                        const cityMatch =
                          (c.city || '').toLowerCase() === selectedCityFilter.toLowerCase() ||
                          (c.addressText || '').toLowerCase().includes(selectedCityFilter.toLowerCase())
                        if (!cityMatch) return null
                      }

                      const clinicDocs = clinicDoctorsMap[c.id] || []

                      if (!clinicSearchQuery.trim()) {
                        return { c, isLab, isSingle, isPoly, score: 10, matchReason: undefined, matchedDoctor: undefined }
                      }

                      const match = matchClinic(c, clinicDocs, [], clinicSearchQuery)
                      if (!match.isMatch) return null

                      return {
                        c,
                        isLab,
                        isSingle,
                        isPoly,
                        score: match.score,
                        matchReason: match.matchHighlightReason,
                        matchedDoctor: match.matchedDoctors?.[0],
                      }
                    })
                    .filter(Boolean)
                    .sort((a, b) => (b?.score || 0) - (a?.score || 0))

                  if (scored.length === 0) {
                    return (
                      <div className="p-12 text-center liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 max-w-md mx-auto space-y-2">
                        <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">No medical centers matched</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Try adjusting your symptom keyword or selecting a different category filter.
                        </p>
                        <button
                          onClick={() => {
                            setClinicSearchQuery('')
                            setClinicCategoryFilter('all')
                          }}
                          className="mt-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl text-xs font-bold transition cursor-pointer active:scale-[0.98]"
                        >
                          Reset Filters
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {scored.map((item) => {
                        if (!item) return null
                        const { c, isLab, isSingle, matchReason, matchedDoctor } = item

                        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${c.name} ${c.addressText || ''}`
                        )}`

                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectClinic(c, matchedDoctor)}
                            className="liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 hover:border-teal-500/60 hover:shadow-lg hover:shadow-teal-500/10 cursor-pointer transition flex flex-col justify-between group overflow-hidden"
                          >
                            {/* Card Header with Type Badge */}
                            <div className="p-6 space-y-3">
                              {matchedDoctor && (
                                <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center space-x-1.5 text-[11px] font-bold text-teal-800 dark:text-teal-300">
                                  <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                  <span className="truncate">Matched Doctor: Dr. {matchedDoctor.fullName} ({matchedDoctor.specialty || 'Specialist'})</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                {isLab ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                                    <FlaskConical className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                    <span>Diagnostic Pathology Lab</span>
                                  </span>
                                ) : isSingle ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                    <Stethoscope className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>Single-Visit OPD Clinic</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                                    <Building2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                    <span>Multi-Specialty Polyclinic</span>
                                  </span>
                                )}

                                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center group-hover:translate-x-0.5 transition-transform">
                                  Select <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                                </span>
                              </div>

                              {/* Search Match Reason Pill */}
                              {matchReason && (
                                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center space-x-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{matchReason}</span>
                                </div>
                              )}

                              <div>
                                <h4 className="font-black text-slate-900 dark:text-white text-lg group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                                  {c.name}
                                </h4>
                                <div className="mt-1 flex items-start space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{c.addressText || 'Nepal'}</span>
                                </div>
                              </div>

                              {/* Google Maps Directions Pill */}
                              <div className="pt-1">
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline liquid-glass-subtle px-2.5 py-1 rounded-lg border border-teal-500/20"
                                >
                                  <span>Google Maps Directions</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>

                            {/* Card Footer: Type-Specific Action Buttons */}
                            <div className="px-6 py-4 liquid-glass-subtle border-t border-white/20 dark:border-white/5 space-y-2">
                              {isLab ? (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-purple-700 dark:text-purple-300 font-bold liquid-glass-card px-2.5 py-1 rounded-lg border border-purple-500/20">
                                    Book Lab Tests (No Doctor Required) →
                                  </span>
                                </div>
                              ) : isSingle ? (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-emerald-700 dark:text-emerald-300 font-bold liquid-glass-card px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                    Book Specialist (Single OPD Token) →
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-teal-700 dark:text-teal-300 font-bold liquid-glass-card px-2.5 py-1 rounded-lg border border-teal-500/20">
                                    Consult Specialists (Choose Doctor) →
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* STEP 2: SELECT DATE & VALID SLOTS */}
            {bookingStep === 2 && selectedClinic && (
              <div className="space-y-6 max-w-2xl mx-auto">
                {/* Back Button & Clinic Summary Banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setBookingStep(1)}
                      className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Medical Centers</span>
                    </button>
                    {isLabClinic ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                        <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                        <span>Diagnostic Pathology Lab</span>
                      </span>
                    ) : isSingleDoctorClinic ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Single-Visit OPD Clinic</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Multi-Specialty Polyclinic</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900">{selectedClinic.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{selectedClinic.addressText || 'Nepal'}</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${selectedClinic.name} ${selectedClinic.addressText || ''}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-brand-600 hover:underline font-bold"
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {selectedClinic.contactPhone && (
                        <div className="flex items-center space-x-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{selectedClinic.contactPhone}</span>
                        </div>
                      )}
                      {selectedClinic.managerPhone && (
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-400 font-bold">• Reception:</span>
                          <span>{selectedClinic.managerPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* CASE 1: DIAGNOSTIC PATHOLOGY LAB */}
                {/* ============================================================== */}
                {isLabClinic && (
                  <div className="space-y-6">
                    {/* Notice Banner */}
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-start space-x-3 text-purple-900">
                      <FlaskConical className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <strong className="block font-bold">Diagnostic Pathology Lab Booking</strong>
                        <p className="text-purple-700">
                          Select the tests or pathology packages you need, then pick your preferred sample collection slot. Verified digital reports will be uploaded directly to your portal once processed.
                        </p>
                      </div>
                    </div>

                    {/* Test Catalog Checkboxes */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Select Diagnostic Tests & Packages *
                        </label>
                        <span className="text-xs font-bold text-purple-700">
                          {selectedLabTests.length} tests selected
                        </span>
                      </div>

                      {clinicServices.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
                          <p className="font-semibold text-slate-800">Standard Pathology Service Catalog:</p>
                          {[
                            { id: 's1', serviceName: 'Complete Blood Count (CBC)', price: 450 },
                            { id: 's2', serviceName: 'Lipid Profile (Cholesterol / Triglycerides)', price: 900 },
                            { id: 's3', serviceName: 'Liver Function Test (LFT)', price: 1100 },
                            { id: 's4', serviceName: 'Thyroid Function Test (TSH, T3, T4)', price: 1200 },
                            { id: 's5', serviceName: 'Fasting Blood Sugar (FBS)', price: 200 },
                            { id: 's6', serviceName: 'Urine Routine Examination', price: 250 },
                          ].map((item) => {
                            const isChecked = selectedLabTests.some((t) => t.id === item.id)
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedLabTests(selectedLabTests.filter((t) => t.id !== item.id))
                                  } else {
                                    setSelectedLabTests([...selectedLabTests, item as any])
                                  }
                                }}
                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                                  isChecked
                                    ? 'bg-purple-50/70 border-purple-500 ring-1 ring-purple-500'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center space-x-2.5">
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-purple-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                  <span className="font-bold text-slate-800 text-xs">{item.serviceName}</span>
                                </div>
                                <span className="font-black text-slate-900 text-xs">NPR {item.price}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {clinicServices.map((service) => {
                            const isChecked = selectedLabTests.some((t) => t.id === service.id)
                            return (
                              <div
                                key={service.id}
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedLabTests(selectedLabTests.filter((t) => t.id !== service.id))
                                  } else {
                                    setSelectedLabTests([...selectedLabTests, service])
                                  }
                                }}
                                className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                                  isChecked
                                    ? 'bg-purple-50/70 border-purple-500 ring-1 ring-purple-500 shadow-2xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-800 text-xs">{service.serviceName}</div>
                                    {service.description && (
                                      <div className="text-[11px] text-slate-400 line-clamp-1">{service.description}</div>
                                    )}
                                  </div>
                                </div>
                                <span className="font-black text-slate-900 text-xs">
                                  NPR {service.price || 500}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Selected Tests Summary Pill */}
                      {selectedLabTests.length > 0 && (
                        <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-semibold text-purple-900">Total Diagnostic Tests Cost:</span>
                          <span className="font-black text-purple-900 text-sm">NPR {calculatedFee}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* CASE 2: SINGLE-DOCTOR / SINGLE-VISIT CLINIC */}
                {/* ============================================================== */}
                {isSingleDoctorClinic && (
                  <div className="space-y-6">
                    {/* Notice Banner */}
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start space-x-3 text-emerald-900">
                      <Stethoscope className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <strong className="block font-bold">Single-Visit Consultation Clinic</strong>
                        <p className="text-emerald-700">
                          Each booking generates a dedicated single-use OPD token with our verified attending specialist. Arrive at the clinic during your chosen slot.
                        </p>
                      </div>
                    </div>

                    {/* Single Doctor Profile Card */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Attending Specialist Doctor
                      </label>
                      <div className="p-5 rounded-3xl border-2 border-emerald-500 bg-emerald-50/30 flex items-start space-x-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xl shrink-0 overflow-hidden">
                          {selectedDoctor?.profilePictureUrl ? (
                            <img
                              src={selectedDoctor.profilePictureUrl}
                              alt={selectedDoctor.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-7 h-7" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-slate-900 text-base">
                              {selectedDoctor?.fullName || 'Certified Specialist'}
                            </h4>
                            <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                              NPR {selectedDoctor?.consultationFee || 500}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-emerald-700">
                            {selectedDoctor?.specialty || 'General OPD Medicine'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500 font-medium">
                            <span>{selectedDoctor?.education || 'MBBS, MD'}</span>
                            {selectedDoctor?.startingPracticingYear && (
                              <span>• {new Date().getFullYear() - selectedDoctor.startingPracticingYear} Yrs Exp</span>
                            )}
                            {selectedDoctor?.nmcLicenseNumber && <span>• NMC #{selectedDoctor.nmcLicenseNumber}</span>}
                          </div>
                          <div className="pt-1.5 flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                selectedDoctor?.isInClinic !== false
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              <span>{selectedDoctor?.isInClinic !== false ? 'In Clinic Chamber' : 'Scheduled'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* CASE 3: POLYCLINIC / MULTI-SPECIALTY CLINIC */}
                {/* ============================================================== */}
                {isPolyclinic && (
                  <div className="space-y-6">
                    {/* Notice Banner */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start space-x-3 text-blue-900">
                      <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <strong className="block font-bold">Multi-Specialty Polyclinic</strong>
                        <p className="text-blue-700">
                          Choose between a New Patient Consultation or a 100% Free Follow-Up Visit with your previous 10-digit Appointment ID.
                        </p>
                      </div>
                    </div>

                    {/* Visit Type Toggle: New vs Follow-up */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Consultation Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsReturningPatient(false)
                            setFollowupCodeInput('')
                            setRetainedAppointment(null)
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                            !isReturningPatient
                              ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20 font-bold'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900">New Patient Consultation</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Standard consultation fee applies</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsReturningPatient(true)}
                          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                            isReturningPatient
                              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 font-bold'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
                            <span>Follow-Up Visit</span>
                            <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">
                              FREE
                            </span>
                          </div>
                          <div className="text-[11px] text-emerald-700 mt-0.5">100% Free with 10-digit ID</div>
                        </button>
                      </div>
                    </div>

                    {/* Follow-up 10-Digit Code Input Box */}
                    {isReturningPatient && (
                      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
                        <label className="block text-xs font-bold text-emerald-900">
                          Enter 10-Digit Previous Appointment Token ID *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            maxLength={10}
                            value={followupCodeInput}
                            onChange={(e) => setFollowupCodeInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 10-digit token (e.g. 8472910384)"
                            className="w-full px-4 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {isLookingUpCode && (
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
                          )}
                        </div>

                        {followupLookupError && (
                          <p className="text-[11px] text-rose-600 font-bold">{followupLookupError}</p>
                        )}

                        {retainedAppointment && (
                          <div className="p-3 bg-white rounded-xl border border-emerald-300 flex items-start space-x-3 text-xs text-emerald-900">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-bold">Verified Retained Patient: {retainedAppointment.patientName}</div>
                              <div className="text-[11px] text-slate-500">
                                Previous Visit: {retainedAppointment.appointmentDate} • Token #{retainedAppointment.trackingCode10Digit}
                              </div>
                              <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                                ✓ 100% Free Follow-Up Visit Activated (NPR 0)
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Doctor Selection Roster for Polyclinic */}
                    {clinicDoctors.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Select Specialist Doctor *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {clinicDoctors.map((doc) => (
                            <div
                              key={doc.id}
                              onClick={() => setSelectedDoctor(doc)}
                              className={`p-4 rounded-2xl border cursor-pointer transition ${
                                selectedDoctor?.id === doc.id
                                  ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20 shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="font-bold text-sm text-slate-900">{doc.fullName}</div>
                              <div className="text-xs text-brand-600 font-medium">{doc.specialty}</div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                                <span>{doc.education || 'MBBS, MD'}</span>
                                <strong className="text-slate-800">
                                  {isReturningPatient && retainedAppointment ? 'Free Follow-Up' : `NPR ${doc.consultationFee || 500}`}
                                </strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Common Date Picker */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {isLabClinic ? 'Select Sample Collection Date *' : 'Select Appointment Date *'}
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>

                {/* Common Slots Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {isLabClinic ? 'Available Sample Collection Slots *' : 'Available Time Slots *'}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      (Past slots ending before now are hidden)
                    </span>
                  </div>

                  {isLoadingSlots ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-600 mb-2" />
                      <span className="text-xs text-slate-500">Checking slot availability...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-6 text-center bg-amber-50/60 rounded-2xl border border-amber-200 text-amber-900 space-y-1">
                      <Clock className="w-5 h-5 mx-auto text-amber-600 mb-1" />
                      <p className="text-xs font-bold">No Slots Published for {bookingDate}</p>
                      <p className="text-[11px] text-amber-700">
                        This center has not published time slots for this date. Please pick another date or contact clinic reception directly.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                            selectedSlot?.id === slot.id
                              ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20 font-bold'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-semibold'
                          }`}
                        >
                          <div className="text-xs">{slot.startTime} - {slot.endTime}</div>
                          <div className={`text-[10px] mt-0.5 ${selectedSlot?.id === slot.id ? 'text-brand-100' : 'text-slate-400'}`}>
                            {slot.maxCapacity - slot.bookedCount} spots left
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Continue Action */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleProceedFromSlotStep}
                    disabled={
                      !selectedSlot ||
                      availableSlots.length === 0 ||
                      (isLabClinic && selectedLabTests.length === 0)
                    }
                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-600/20 transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Continue to Patient Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {!patientUser && (
                    <p className="text-[11px] text-center text-slate-500 font-medium">
                      🔒 Sign-in required on next step. Your selected clinic, services, date, and slot will be saved automatically.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: PATIENT INFORMATION */}
            {bookingStep === 3 && (
              <form onSubmit={handleProceedToPayment} className="space-y-6 max-w-xl mx-auto">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setBookingStep(2)}
                    className="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Slot</span>
                  </button>
                  <span className="text-xs font-bold text-slate-500">
                    Slot: {selectedSlot?.startTime} ({bookingDate})
                  </span>
                </div>

                {/* Book for Self or Family */}
                {familyMembers.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Who is this appointment for?
                    </label>
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setBookFor('self')
                          if (patientUser) {
                            setBookPatientName(patientUser.fullName || '')
                            setBookPatientPhone(patientUser.phone || '')
                            setBookPatientAge(patientUser.age ? patientUser.age.toString() : '28')
                            setBookPatientGender(patientUser.gender || 'Male')
                          }
                        }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                          bookFor === 'self'
                            ? 'bg-brand-50 text-brand-800 border-brand-500'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        Self ({patientUser?.fullName || 'Me'})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookFor('family')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                          bookFor === 'family'
                            ? 'bg-brand-50 text-brand-800 border-brand-500'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        Family Member
                      </button>
                    </div>

                    {bookFor === 'family' && (
                      <select
                        value={selectedFamilyId}
                        onChange={(e) => {
                          setSelectedFamilyId(e.target.value)
                          const mem = familyMembers.find((f) => f.id === e.target.value)
                          if (mem) {
                            setBookPatientName(mem.name)
                            setBookPatientAge(mem.age.toString())
                            setBookPatientGender(mem.gender)
                            if (mem.phone) setBookPatientPhone(mem.phone)
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="">-- Choose family member --</option>
                        {familyMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.relation})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Patient Full Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    value={bookPatientName}
                    onChange={(e) => setBookPatientName(e.target.value)}
                    placeholder="e.g. Sita Sharma"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Mobile Number & Age */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Mobile Number (10 digits) *</label>
                    <input
                      type="tel"
                      required
                      value={bookPatientPhone}
                      onChange={(e) => setBookPatientPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="98xxxxxxxx"
                      maxLength={10}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Patient Age (Years) *</label>
                    <input
                      type="number"
                      required
                      value={bookPatientAge}
                      onChange={(e) => setBookPatientAge(e.target.value)}
                      placeholder="e.g. 32"
                      min="1"
                      max="120"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Gender *</label>
                  <div className="flex items-center space-x-3">
                    {['Male', 'Female', 'Other'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setBookPatientGender(g)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                          bookPatientGender === g
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Symptoms / Clinical Notes */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Symptoms / Medical Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={bookPatientNotes}
                    onChange={(e) => setBookPatientNotes(e.target.value)}
                    placeholder="Brief description of headache, fever, previous checkup..."
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Early Consultation Call Opt-In */}
                <div
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 cursor-pointer select-none"
                  onClick={() => setBookOptInEarlyCall(!bookOptInEarlyCall)}
                >
                  <input
                    type="checkbox"
                    id="portalEarlyCallOptIn"
                    checked={bookOptInEarlyCall}
                    onChange={(e) => setBookOptInEarlyCall(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="portalEarlyCallOptIn" className="text-xs text-slate-700 cursor-pointer">
                    <span className="font-bold text-emerald-800 block">⚡ Allow Early Consultation Call</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      If the doctor finishes consultations ahead of schedule, receive an instant push notification to come in early. If unchecked, your original slot remains strictly unchanged.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-600/20 transition flex items-center justify-center space-x-2"
                >
                  <span>Proceed to Payment Confirmation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* STEP 4: PAYMENT GATEWAY & 5-MINUTE RETAIN TIMER */}
            {bookingStep === 4 && (
              <div className="space-y-6 max-w-xl mx-auto">
                {/* 5-Minute Retain Countdown Timer Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-amber-900">
                  <div className="flex items-center space-x-3">
                    <Timer className="w-6 h-6 text-amber-600 animate-pulse" />
                    <div>
                      <div className="text-xs font-bold">Slot Reservation Retained</div>
                      <div className="text-[11px] text-amber-700">
                        Retains your spot for 5 minutes even if you close or refresh this tab.
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xl font-black text-amber-900 tracking-wider">
                      {formattedTimer}
                    </span>
                  </div>
                </div>

                {/* Appointment & Fee Summary */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Medical Center</span>
                    <strong className="text-slate-800">{selectedClinic?.name}</strong>
                  </div>
                  {isLabClinic ? (
                    <div className="flex items-start justify-between text-xs text-slate-500">
                      <span>Diagnostic Tests ({selectedLabTests.length})</span>
                      <strong className="text-slate-800 text-right max-w-[240px] truncate">
                        {selectedLabTests.map((t) => t.serviceName).join(', ')}
                      </strong>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Attending Specialist</span>
                      <strong className="text-slate-800">{selectedDoctor?.fullName || 'General OPD'}</strong>
                    </div>
                  )}
                  {isReturningPatient && retainedAppointment && (
                    <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      <span>Visit Type</span>
                      <strong className="font-bold">Follow-Up (Previous Token #{retainedAppointment.trackingCode10Digit})</strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Patient</span>
                    <strong className="text-slate-800">{bookPatientName}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{isLabClinic ? 'Sample Collection Slot' : 'Appointment Slot'}</span>
                    <strong className="text-slate-800">{bookingDate} • {selectedSlot?.startTime}</strong>
                  </div>
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {isLabClinic ? 'Total Pathology Lab Fee' : 'Total Consultation Fee'}
                    </span>
                    <span className="text-lg font-black text-brand-700">
                      {calculatedFee === 0 ? 'FREE (NPR 0)' : `NPR ${calculatedFee}`}
                    </span>
                  </div>
                </div>

                {/* 100% Free Follow-Up Visit Card OR Digital Payment Gateways */}
                {calculatedFee === 0 ? (
                  <div className="bg-emerald-50 border-2 border-emerald-500 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center space-x-3 text-emerald-900">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-base font-black">100% Free Follow-Up Visit (NPR 0)</div>
                        <div className="text-xs text-emerald-700">
                          Verified with Previous Appointment #{retainedAppointment?.trackingCode10Digit}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium">
                      Your follow-up visit with Dr. {selectedDoctor?.fullName} is eligible for zero consultation charge. No digital payment gateway fee will be charged.
                    </p>
                    <button
                      type="button"
                      disabled={isPaymentProcessing}
                      onClick={() => handleExecutePayment(true)}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>{isPaymentProcessing ? 'Confirming Follow-Up...' : 'Confirm Free Follow-Up Appointment'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelPaymentSession('User cancelled follow-up')}
                      disabled={isPaymentProcessing}
                      className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                    >
                      Cancel & Choose Different Slot
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Select Payment Method */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Select Digital Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'esewa', name: 'eSewa Wallet', color: 'bg-brand-500' },
                          { id: 'khalti', name: 'Khalti Digital', color: 'bg-purple-600' },
                          { id: 'fonepay', name: 'Fonepay QR', color: 'bg-rose-500' },
                          { id: 'cash', name: 'Pay at Clinic', color: 'bg-slate-700' },
                        ].map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setSelectedPaymentMethod(pm.id as any)}
                            className={`p-4 rounded-2xl border text-left transition flex items-center space-x-3 cursor-pointer ${
                              selectedPaymentMethod === pm.id
                                ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded-full ${pm.color}`} />
                            <div>
                              <div className="text-xs font-bold text-slate-900">{pm.name}</div>
                              <div className="text-[10px] text-slate-400">Instant verification</div>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Real Gateway Credential display from clinic config */}
                      <div className="p-4 bg-slate-100 rounded-xl text-xs space-y-1 text-slate-600">
                        <div className="font-semibold text-slate-800">
                          Merchant Account: {selectedClinic?.name}
                        </div>
                        <div>
                          Gateway ID:{' '}
                          <code className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded">
                            {clinicPaymentConfig?.esewa?.merchantCode || 'EPAYTEST'}
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* ACTION BUTTONS (With double-click prevention) */}
                    <div className="space-y-3 pt-2">
                      {/* Testing Bypass Button requested by user */}
                      <button
                        type="button"
                        disabled={isPaymentProcessing}
                        onClick={() => handleExecutePayment(true)}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {isPaymentProcessing ? 'Confirming...' : 'Bypass Payment for Testing (Confirm Appointment)'}
                        </span>
                      </button>

                      {/* Standard Pay & Confirm Button */}
                      <button
                        type="button"
                        disabled={isPaymentProcessing}
                        onClick={() => handleExecutePayment(false)}
                        className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-600/20 transition flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          {isPaymentProcessing
                            ? 'Processing Payment...'
                            : `Pay NPR ${calculatedFee} via ${selectedPaymentMethod.toUpperCase()} & Book`}
                        </span>
                      </button>

                      {/* Cancel Transaction Button */}
                      <button
                        type="button"
                        onClick={() => handleCancelPaymentSession('User clicked cancel button')}
                        disabled={isPaymentProcessing}
                        className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      >
                        Cancel Transaction & Choose Different Slot
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 5: BOOKING CONFIRMED */}
            {bookingStep === 5 && confirmedBooking && (
              <div className="space-y-6 max-w-md mx-auto text-center py-4">
                <div className="w-16 h-16 rounded-3xl bg-brand-100 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Appointment Confirmed!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Your appointment has been registered in the live clinic queue board.
                  </p>
                </div>

                {/* 10-Digit Code Box */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">
                    Your 10-Digit Live Token
                  </span>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="font-mono text-3xl font-black text-slate-900 tracking-wider">
                      {confirmedBooking.trackingCode10Digit}
                    </span>
                    <button
                      onClick={() => handleCopyCode(confirmedBooking.trackingCode10Digit)}
                      className="p-1.5 text-slate-400 hover:text-brand-600"
                    >
                      {copiedCode === confirmedBooking.trackingCode10Digit ? (
                        <Check className="w-5 h-5 text-brand-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-brand-600 font-semibold">
                    Keep this 10-digit code to track your queue position or check in at the clinic desk.
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setViewingBillAppt(confirmedBooking)}
                    className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs rounded-xl shadow-glass-brand border border-white/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>View & Download Official Invoice Slip</span>
                  </button>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      if (onOpenLiveQueue) {
                        onOpenLiveQueue(confirmedBooking.trackingCode10Digit)
                      } else {
                        window.location.hash = '#live-queue'
                      }
                    }}
                    className="flex-1 py-3 bg-slate-900 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    Open Live Queue Board
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('appointments')
                      setBookingStep(1)
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
                  >
                    View All Appointments
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 3: TRANSACTION HISTORY
        ========================================== */}
        {activeTab === 'transactions' && (
          <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 shadow-sm border border-white/40 dark:border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Appointment Transactions</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprehensive audit history of your appointment payments and booking receipts.
                </p>
              </div>
              <button
                onClick={loadTransactions}
                className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 liquid-glass-subtle rounded-xl transition cursor-pointer"
                title="Refresh transactions"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoadingTransactions ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 dark:text-teal-400 mb-2" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Loading transaction history...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Receipt className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-sm font-semibold">No transaction records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/20 dark:border-white/5 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      <th className="pb-3">Transaction ID</th>
                      <th className="pb-3">Tracking Code</th>
                      <th className="pb-3">Doctor & Clinic</th>
                      <th className="pb-3">Appointment Date</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Method</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20 dark:divide-white/5 font-medium text-slate-700 dark:text-slate-300">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">{tx.transactionId}</td>
                        <td className="py-3 font-mono">{tx.trackingCode}</td>
                        <td className="py-3">
                          <div className="font-bold text-slate-900 dark:text-white">{tx.doctorName}</div>
                          <div className="text-[11px] text-slate-400">{tx.clinicName}</div>
                        </td>
                        <td className="py-3">{tx.appointmentDate} • {tx.appointmentTime}</td>
                        <td className="py-3 font-bold text-slate-900 dark:text-white">NPR {tx.amount}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-md liquid-glass-subtle text-slate-700 dark:text-slate-300 font-bold border border-white/20">
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                              tx.paymentStatus === 'paid'
                                ? 'bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20'
                                : tx.paymentStatus === 'free'
                                ? 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20'
                                : tx.paymentStatus === 'failed'
                                ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                            }`}
                          >
                            {tx.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadTransactionReceipt(tx)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 liquid-glass-subtle hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-lg font-bold text-[11px] transition cursor-pointer border border-teal-500/20 active:scale-[0.98]"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 4: DIAGNOSTIC LAB REPORTS
        ========================================== */}
        {activeTab === 'reports' && (
          <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 shadow-sm border border-white/40 dark:border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Diagnostic Pathology Reports</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Access digital lab test results, blood work, and biochemistry PDFs securely with privacy verification.
                </p>
              </div>
              <form onSubmit={handleLookupLabReport} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Lookup 10-Digit Code..."
                  value={reportSearchCode}
                  onChange={(e) => setReportSearchCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="px-3.5 py-2 liquid-glass-input rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-teal-500 w-44 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={isSearchingReport || reportSearchCode.length < 5}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-[0.98]"
                >
                  {isSearchingReport ? 'Searching...' : 'Search'}
                </button>
              </form>
            </div>

            {reportSearchError && (
              <div className="p-3 liquid-glass-subtle border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{reportSearchError}</span>
              </div>
            )}

            {isLoadingReports ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 dark:text-teal-400 mb-2" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Checking lab records...</span>
              </div>
            ) : patientLabReports.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <FileText className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-sm font-semibold">No lab test reports found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Enter your 10-digit tracking code above to look up any diagnostic test results, or book a lab test appointment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patientLabReports.map((rep) => {
                  const isUnlocked =
                    unlockedReportIds.includes(rep.id) ||
                    Boolean(patientUser?.fullName && rep.patientName && rep.patientName.toLowerCase().includes(patientUser.fullName.toLowerCase()))

                  return (
                    <div key={rep.id} className="p-5 rounded-2xl border border-white/40 dark:border-white/10 liquid-glass-subtle space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                          Code: {rep.trackingCode10Digit}
                        </span>
                        <div className="flex items-center space-x-2">
                          {isUnlocked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold liquid-glass-card text-slate-700 dark:text-slate-300 border border-white/20">
                              <Lock className="w-3 h-3 mr-1" />
                              Protected
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                              rep.status === 'delivered' || rep.status === 'prepared'
                                ? 'bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20'
                                : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                            }`}
                          >
                            {rep.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-white">{rep.testName}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Patient: {rep.patientName}</p>
                      </div>

                      {rep.technicianNotes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic liquid-glass-card p-2.5 rounded-xl border border-white/30 dark:border-white/10">
                          "{rep.technicianNotes}"
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Uploaded: {rep.uploadedAt?.split('T')[0] || 'Recent'}
                        </span>
                        {rep.reportFileUrl ? (
                          isUnlocked ? (
                            <a
                              href={rep.reportFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-[0.98]"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download PDF</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyingReport(rep)
                                setVerifyMethod('name')
                                setVerificationInput('')
                                setVerificationError(null)
                              }}
                              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-[0.98]"
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-300" />
                              <span>Unlock & Download</span>
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Processing at Lab</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 5: NOTIFICATIONS & QUEUE ALERTS
        ========================================== */}
        {activeTab === 'notifications' && (
          <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 shadow-sm border border-white/40 dark:border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Clinic Alerts & Queue Broadcasts</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Important announcements, holiday notices, and real-time queue alerts from Supabase.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ids = notifications.filter((n) => !n.isRead).map((n) => n.id)
                      await markAllNotificationsAsRead(ids)
                      loadNotifications()
                    }}
                    className="px-3 py-1.5 liquid-glass-subtle hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-xs rounded-xl transition cursor-pointer border border-teal-500/20 active:scale-[0.98]"
                  >
                    Mark All Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadNotifications}
                  className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 liquid-glass-subtle rounded-xl transition cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Bell className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-sm font-semibold">No notifications right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={async () => {
                      if (!notif.isRead) {
                        await markNotificationAsRead(notif.id)
                        loadNotifications()
                      }
                    }}
                    className={`p-4 rounded-2xl border flex items-start space-x-3.5 transition cursor-pointer ${
                      notif.isRead
                        ? 'border-white/30 dark:border-white/10 liquid-glass-subtle'
                        : 'border-teal-500/40 bg-teal-500/10 shadow-xs'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-teal-500/20">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                          )}
                          <span>{notif.title}</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {notif.createdAt?.split('T')[0]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 6: FAMILY PROFILES
        ========================================== */}
        {activeTab === 'family' && (
          <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 shadow-sm border border-white/40 dark:border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Family Members</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Save family members to book doctor slots and lab tests with 1 click.
                </p>
              </div>
              <button
                onClick={() => setShowAddFamilyModal(true)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer active:scale-[0.98]"
              >
                <Users className="w-4 h-4" />
                <span>+ Add Member</span>
              </button>
            </div>

            {familyMembers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Users className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-sm font-semibold">No family members registered</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Add spouse, children, or elderly parents to easily manage their medical appointments.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {familyMembers.map((mem) => (
                  <div key={mem.id} className="p-5 rounded-2xl border border-white/40 dark:border-white/10 liquid-glass-subtle space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/20">
                        {mem.relation}
                      </span>
                      <button
                        onClick={() => handleDeleteFamilyMember(mem.id)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="font-bold text-base text-slate-900 dark:text-white">{mem.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {mem.age} yrs • {mem.gender}
                      {mem.phone && ` • ${mem.phone}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 7: HELP REQUESTS & SUPPORT TICKETS
        ========================================== */}
        {activeTab === 'help' && (
          <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 shadow-sm border border-white/40 dark:border-white/10 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/20 dark:border-white/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <LifeBuoy className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    Help Requests & Support Status
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track resolution updates for your submitted inquiries, live queue issues, or clinic support.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadMySupportTickets}
                  disabled={loadingPatientTickets}
                  className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 liquid-glass-subtle rounded-xl transition cursor-pointer"
                  title="Refresh Help Requests"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPatientTickets ? 'animate-spin' : ''}`} />
                </button>
                <a
                  href="#support"
                  onClick={() => {
                    window.location.hash = '#support'
                    window.dispatchEvent(new HashChangeEvent('hashchange'))
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-500/20 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Submit New Request</span>
                </a>
              </div>
            </div>

            {/* Instant Ticket Search Bar */}
            <div className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle border border-indigo-200/60 dark:border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-indigo-500" />
                  <span>Check Any Ticket by ID, Phone, or Gmail</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">e.g. #DAC-TKT-1082</span>
              </div>
              <form onSubmit={handleSearchPatientTicket} className="flex gap-2">
                <input
                  type="text"
                  value={ticketSearchInput}
                  onChange={(e) => setTicketSearchInput(e.target.value)}
                  placeholder="Enter Ticket ID (#DAC-TKT-...) or contact phone / email"
                  className="flex-1 px-4 py-2.5 rounded-xl liquid-glass-input text-xs sm:text-sm font-semibold border border-white/60 dark:border-white/10 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={isSearchingTicket || !ticketSearchInput.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:brightness-105 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap"
                >
                  {isSearchingTicket ? 'Searching...' : 'Check Status'}
                </button>
              </form>

              {ticketSearchError && (
                <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{ticketSearchError}</span>
                </div>
              )}

              {ticketLookupResult && (
                <div className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-indigo-300/60 dark:border-indigo-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                        {ticketLookupResult.ticketCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(ticketLookupResult.ticketCode)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Copy Ticket ID"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ticketLookupResult.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : ticketLookupResult.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : ticketLookupResult.status === 'closed'
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                      }`}
                    >
                      {ticketLookupResult.status === 'resolved'
                        ? 'Resolved'
                        : ticketLookupResult.status === 'in_progress'
                        ? 'In Progress'
                        : ticketLookupResult.status === 'closed'
                        ? 'Closed'
                        : 'Open / In Queue'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Category: </span>
                    {(ticketLookupResult as any).reasonCategory || ticketLookupResult.category || 'General Inquiry'}
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 italic">
                    "{ticketLookupResult.message}"
                  </div>

                  {ticketLookupResult.adminNotes && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="font-bold mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Admin Resolution Notes:</span>
                      </div>
                      <p>{ticketLookupResult.adminNotes}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <a
                      href={`#support?track=${encodeURIComponent(ticketLookupResult.ticketCode)}`}
                      onClick={() => {
                        window.location.hash = `#support?track=${encodeURIComponent(ticketLookupResult.ticketCode)}`
                        window.dispatchEvent(new HashChangeEvent('hashchange'))
                      }}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>Open Full Support Desk & WhatsApp →</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* List of Tickets linked to Patient Profile / Device */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Your Registered Help Requests ({patientTickets.length})
              </h4>

              {loadingPatientTickets ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-500" />
                  <span>Loading your help requests...</span>
                </div>
              ) : patientTickets.length === 0 ? (
                <div className="text-center py-10 space-y-3 liquid-glass-subtle rounded-2xl border border-white/30 dark:border-white/10 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <Headphones className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    No Help Requests Found
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    You haven't submitted any help requests from this account yet, or your past inquiries are under a different phone number.
                  </p>
                  <div className="pt-2">
                    <a
                      href="#support"
                      onClick={() => {
                        window.location.hash = '#support'
                        window.dispatchEvent(new HashChangeEvent('hashchange'))
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 text-white font-bold text-xs shadow-xs hover:bg-teal-600 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Contact Support Now</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patientTickets.map((t) => (
                    <div
                      key={t.id || t.ticketCode}
                      className="p-5 rounded-2xl liquid-glass-subtle border border-white/40 dark:border-white/10 space-y-3 hover:border-indigo-400/50 transition shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                            {t.ticketCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(t.ticketCode)}
                            className="text-slate-400 hover:text-slate-600 transition"
                            title="Copy Code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            t.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : t.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : t.status === 'closed'
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                          }`}
                        >
                          {t.status === 'resolved'
                            ? 'Resolved'
                            : t.status === 'in_progress'
                            ? 'In Progress'
                            : t.status === 'closed'
                            ? 'Closed'
                            : 'Open'}
                        </span>
                      </div>

                      <div className="text-xs">
                        <span className="text-slate-400 font-medium">Category: </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {(t as any).reasonCategory || t.category || 'General Inquiry'}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Recent'}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic bg-white/40 dark:bg-slate-900/40 p-2.5 rounded-xl border border-white/20 dark:border-white/5">
                        "{t.message}"
                      </p>

                      {t.adminNotes && (
                        <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                          <div className="font-bold flex items-center gap-1 mb-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Resolution Notes:</span>
                          </div>
                          <p className="font-medium text-emerald-900 dark:text-emerald-200">
                            {t.adminNotes}
                          </p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/30 dark:border-white/5 flex items-center justify-between text-xs">
                        <a
                          href={`#support?track=${encodeURIComponent(t.ticketCode)}`}
                          onClick={() => {
                            window.location.hash = `#support?track=${encodeURIComponent(t.ticketCode)}`
                            window.dispatchEvent(new HashChangeEvent('hashchange'))
                          }}
                          className="font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                        >
                          <span>Track Live Details</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={`https://wa.me/9779800000000?text=${encodeURIComponent(
                            `Hello Dactor Support Desk, following up on Help Request Ticket ${t.ticketCode}.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==========================================
          MODAL: PATIENT AUTHENTICATION (LOGIN / SIGNUP)
      ========================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-white/40 dark:border-white/10 space-y-6 relative animate-in fade-in zoom-in-95 overflow-hidden">
            {/* Top specular refraction sheen */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

            <button
              onClick={() => {
                setShowAuthModal(false)
                setPendingBookingRedirectNotice(false)
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3 shadow-inner border border-teal-500/20">
                <User className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Patient Health Portal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Sign in with your verified Google account to track live queue tokens, access lab reports & manage appointments.
              </p>
            </div>

            {/* Pending Booking Redirect Notice matching patient-app LoginScreen.kt lines 607-620 */}
            {pendingBookingRedirectNotice && (
              <div className="p-4 rounded-2xl liquid-glass-subtle border border-teal-500/30 text-left flex items-start space-x-3 animate-in fade-in">
                <Info className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    Sign In Required to Book Appointment
                  </div>
                  <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-snug">
                    Your selected clinic, doctor, date, and slot position are saved. You'll return right where you left off after signing in.
                  </p>
                </div>
              </div>
            )}

            {authError && (
              <div className="p-3.5 rounded-xl liquid-glass-subtle border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold space-y-2.5">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null)
                    handleGoogleSignIn()
                  }}
                  disabled={authSubmitting}
                  className="w-full py-2 px-3 rounded-lg liquid-glass-card hover:bg-rose-500/20 border border-rose-500/30 text-rose-800 dark:text-rose-200 font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try With Different Google Account</span>
                </button>
              </div>
            )}

            {/* Official Google Sign-In Desk */}
            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authSubmitting}
                className="w-full py-3.5 liquid-glass-card hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-900 dark:text-white font-black text-xs rounded-2xl border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{authSubmitting ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              <div className="p-3.5 liquid-glass-subtle rounded-2xl border border-white/40 dark:border-white/10 text-left space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Single-Role Patient Identity</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your Google identity ensures verified authentication. First-time users will specify their full name, phone number, and age to maintain your personal health records.
                </p>
              </div>

              {/* Cross-Portal Quick Navigation Links */}
              <div className="pt-2 border-t border-white/20 dark:border-white/5 space-y-1.5 text-center text-[11px]">
                <p className="text-slate-500 dark:text-slate-400">
                  Are you a Medical Doctor?{' '}
                  <a
                    href="#doctor-portal"
                    onClick={() => setShowAuthModal(false)}
                    className="font-bold text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    Doctor Login & NMC Registration →
                  </a>
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Are you a Clinic / Hospital Manager?{' '}
                  <a
                    href="#portal"
                    onClick={() => setShowAuthModal(false)}
                    className="font-bold text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    Clinic Portal & Onboarding →
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: EDIT PATIENT PROFILE
      ========================================== */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-glass-modal border border-white/60 dark:border-white/15 space-y-5 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowEditProfileModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Update Profile</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sync details with Supabase patient database.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mobile Number (10 Digits)</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-glass-brand border border-white/25 transition active:scale-[0.98] cursor-pointer"
              >
                {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>

              {/* Helpdesk & Support Links */}
              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProfileModal(false)
                    setActiveTab('help')
                  }}
                  className="w-full py-2.5 px-4 rounded-xl liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 border border-teal-200 dark:border-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-teal-500" />
                    <span>Check My Help Request Status</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>

                <a
                  href={supportUrl.startsWith('http') || supportUrl.startsWith('mailto:') ? supportUrl : `https://${supportUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-indigo-500" />
                    <span>Contact Us & Dactor Helpdesk Support</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>

              <div className="pt-3 border-t border-white/40 dark:border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Account Settings</span>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(true)}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Schedule 30-Day Account Deletion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ADD FAMILY MEMBER
      ========================================== */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-glass-modal border border-white/60 dark:border-white/15 space-y-5 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAddFamilyModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Add Family Member</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Save family profile for fast appointment booking.</p>
            </div>

            <form onSubmit={handleAddFamilyMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  placeholder="e.g. Suman Sharma"
                  className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Relationship</label>
                  <select
                    value={newFamilyRelation}
                    onChange={(e) => setNewFamilyRelation(e.target.value)}
                    className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Child">Child</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Age *</label>
                  <input
                    type="number"
                    required
                    value={newFamilyAge}
                    onChange={(e) => setNewFamilyAge(e.target.value)}
                    placeholder="e.g. 7"
                    className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone (Optional)</label>
                <input
                  type="tel"
                  value={newFamilyPhone}
                  onChange={(e) => setNewFamilyPhone(e.target.value)}
                  placeholder="98xxxxxxxx"
                  className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl shadow-glass-brand border border-white/25 transition active:scale-[0.98] cursor-pointer"
              >
                Save Family Member
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: 30-DAY REVERSIBLE ACCOUNT DELETION
      ========================================== */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-glass-modal border border-rose-300/60 dark:border-rose-500/30 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/40 dark:border-white/10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  30-Day Reversible Archive
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Schedule Patient Account Deletion?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-500/10 backdrop-blur-md border border-rose-300/60 dark:border-rose-500/30 rounded-2xl text-xs text-rose-900 dark:text-rose-200 space-y-1.5 leading-relaxed text-left">
              <p className="font-bold">What happens when you schedule deletion:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Your profile enters a <strong>30-day reversible grace period</strong>.</li>
                <li>You can cancel deletion anytime with 1 click during the next 30 days.</li>
                <li>After 30 days, personal profile details are permanently removed.</li>
              </ul>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-2.5 liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-white/50 dark:border-white/10 transition cursor-pointer"
              >
                Keep Account Active
              </button>
              <button
                type="button"
                onClick={handleSchedulePatientArchive}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-[0.98] cursor-pointer"
              >
                Schedule 30-Day Archive
              </button>
            </div>

            <div className="pt-2 border-t border-white/40 dark:border-white/10">
              <button
                type="button"
                disabled={isDeletingPermanently}
                onClick={handlePermanentDeletePatient}
                className="w-full py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>{isDeletingPermanently ? 'Deleting Profile...' : 'Permanent Delete (Immediate)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CLAIM APPOINTMENT WITH 10-DIGIT CODE
      ========================================== */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-glass-modal border border-white/60 dark:border-white/15 space-y-5 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowClaimModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-400/30 text-brand-700 dark:text-brand-300 flex items-center justify-center mx-auto mb-2 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Claim Appointment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Enter your 10-digit universal tracking code to link an appointment booked offline or in guest mode to your account.
              </p>
            </div>

            {claimCodeError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-300/60 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{claimCodeError}</span>
              </div>
            )}

            <form onSubmit={handleClaimAppointmentCode} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  10-Digit Tracking Code
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  placeholder="e.g. 8492018471"
                  value={claimCodeInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    setClaimCodeInput(digits)
                    if (claimCodeError) setClaimCodeError(null)
                  }}
                  className="w-full px-4 py-3 liquid-glass-input rounded-xl font-mono text-center text-lg font-bold tracking-widest text-slate-900 dark:text-white outline-none"
                />
                <span className="text-[11px] text-slate-400 block text-center">
                  {claimCodeInput.length}/10 digits entered
                </span>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 py-3 liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-white/50 dark:border-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClaimingCode || claimCodeInput.length !== 10}
                  className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-glass-brand border border-white/25 active:scale-[0.98] cursor-pointer"
                >
                  {isClaimingCode ? 'Verifying...' : 'Claim & Link Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: RESCHEDULE APPOINTMENT
      ========================================== */}
      {rescheduleAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-glass-modal border border-white/60 dark:border-white/15 space-y-5 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setRescheduleAppt(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Token #{rescheduleAppt.trackingCode10Digit}
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Reschedule Appointment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Shift appointment date or slot with {rescheduleAppt.doctor?.fullName || 'the clinic'}.
              </p>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">New Appointment Date *</label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={newRescheduleDate}
                  onChange={(e) => setNewRescheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Preferred Time Slot *</label>
                  {isLoadingRescheduleSlots && (
                    <span className="text-[10px] text-teal-600 animate-pulse font-semibold">Loading doctor slots...</span>
                  )}
                </div>
                {rescheduleAvailableSlots.length > 0 ? (
                  <select
                    value={newRescheduleTime}
                    onChange={(e) => setNewRescheduleTime(e.target.value)}
                    className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                  >
                    <optgroup label="Published Doctor Slots">
                      {rescheduleAvailableSlots.map((s) => (
                        <option key={s.id} value={`${s.startTime} - ${s.endTime}`}>
                          {s.startTime} - {s.endTime} ({s.bookedCount || 0}/{s.maxCapacity || 5} booked)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="General Time Slots">
                      <option value="09:00 AM - 10:00 AM">09:00 AM - 10:00 AM (Morning)</option>
                      <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM (Noon)</option>
                      <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM (Afternoon)</option>
                      <option value="04:00 PM - 05:00 PM">04:00 PM - 05:00 PM (Evening)</option>
                    </optgroup>
                  </select>
                ) : (
                  <select
                    value={newRescheduleTime}
                    onChange={(e) => setNewRescheduleTime(e.target.value)}
                    className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="09:00 AM - 10:00 AM">09:00 AM - 10:00 AM (Morning)</option>
                    <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM (Morning)</option>
                    <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM (Noon)</option>
                    <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM (Afternoon)</option>
                    <option value="03:00 PM - 04:00 PM">03:00 PM - 04:00 PM (Afternoon)</option>
                    <option value="04:00 PM - 05:00 PM">04:00 PM - 05:00 PM (Evening)</option>
                    <option value="05:00 PM - 06:00 PM">05:00 PM - 06:00 PM (Evening)</option>
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Reason for Rescheduling (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Schedule conflict, feeling better today..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleAppt(null)}
                  className="flex-1 py-3 liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-white/50 dark:border-white/10 transition cursor-pointer"
                >
                  Keep Existing
                </button>
                <button
                  type="submit"
                  disabled={isRescheduling}
                  className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-glass-brand border border-white/25 active:scale-[0.98] cursor-pointer"
                >
                  {isRescheduling ? 'Shifting...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: LAB REPORT PRIVACY VERIFICATION GATE
      ========================================== */}
      {verifyingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-glass-modal border border-white/60 dark:border-white/15 space-y-5 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setVerifyingReport(null)
                setVerificationError(null)
              }}
              className="absolute top-5 right-5 p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto mb-2 shadow-inner">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Health Privacy Verification
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                To protect confidential clinical data, please verify the registered patient's identity before viewing or downloading this report.
              </p>
            </div>

            {verificationError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-300/60 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{verificationError}</span>
              </div>
            )}

            <div className="flex items-center space-x-2 liquid-glass-subtle p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setVerifyMethod('name')
                  setVerificationInput('')
                  setVerificationError(null)
                }}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  verifyMethod === 'name'
                    ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
                }`}
              >
                Patient Name
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerifyMethod('phone')
                  setVerificationInput('')
                  setVerificationError(null)
                }}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  verifyMethod === 'phone'
                    ? 'bg-gradient-to-r from-brand-600 to-teal-500 text-white shadow-glass-brand'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'
                }`}
              >
                Mobile Number
              </button>
            </div>

            <form onSubmit={handleExecuteReportVerification} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {verifyMethod === 'name' ? "Enter Patient's Full Name" : "Enter Patient's Mobile Number (10 digits)"}
                </label>
                <input
                  type={verifyMethod === 'name' ? 'text' : 'tel'}
                  required
                  placeholder={verifyMethod === 'name' ? 'e.g. Ram Bahadur' : '98xxxxxxxx'}
                  value={verificationInput}
                  onChange={(e) => setVerificationInput(e.target.value)}
                  className="w-full px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setVerifyingReport(null)
                    setVerificationError(null)
                  }}
                  className="flex-1 py-3 liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-white/50 dark:border-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition shadow-glass-brand border border-white/25 active:scale-[0.98] cursor-pointer"
                >
                  Verify & Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: OFFICIAL APPOINTMENT BILL & SLIP
      ========================================== */}
      {viewingBillAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-glass-modal border border-white/60 dark:border-white/15 space-y-6 relative animate-in fade-in zoom-in-95 my-8">
            <button
              onClick={() => setViewingBillAppt(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full liquid-glass-subtle text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Bill Header */}
            <div className="flex items-start justify-between border-b border-white/40 dark:border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 block">
                  Official Medical Invoice & OPD Slip
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {viewingBillAppt.clinic?.name || 'Dactor Certified Healthcare Center'}
                </h3>
                {viewingBillAppt.clinic?.addressText && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{viewingBillAppt.clinic.addressText}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25">
                  {viewingBillAppt.paymentStatus === 'paid' ? 'PAID' : 'PAYABLE AT CLINIC'}
                </span>
                <span className="text-[10px] font-mono text-slate-400 block mt-1">
                  INV-#{viewingBillAppt.trackingCode10Digit}
                </span>
              </div>
            </div>

            {/* 10-Digit Live Token Badge */}
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 block">
                  OPD Live Queue Token
                </span>
                <span className="font-mono text-2xl font-black text-slate-900 dark:text-white tracking-wider">
                  #{viewingBillAppt.trackingCode10Digit}
                </span>
              </div>
              <button
                onClick={() => handleCopyCode(viewingBillAppt.trackingCode10Digit)}
                className="px-3 py-1.5 rounded-xl liquid-glass-subtle text-xs font-bold text-teal-700 dark:text-teal-300 border border-teal-500/30 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode === viewingBillAppt.trackingCode10Digit ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-teal-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Token</span>
                  </>
                )}
              </button>
            </div>

            {/* Details Table */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-white/40 dark:bg-slate-800/40 p-4 rounded-2xl border border-white/50 dark:border-white/10">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Patient Name</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {viewingBillAppt.patientName}
                </span>
                <span className="text-slate-500 text-[11px] block">
                  {viewingBillAppt.patientAge || '–'} Yrs • {viewingBillAppt.patientGender || '–'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Attending Doctor</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {viewingBillAppt.doctor?.fullName || 'General OPD Specialist'}
                </span>
                <span className="text-brand-600 dark:text-brand-400 text-[11px] font-semibold block">
                  {viewingBillAppt.doctor?.specialty || 'General Medicine'}
                </span>
              </div>

              <div className="pt-2 border-t border-white/30 dark:border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Appointment Date</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {viewingBillAppt.appointmentDate}
                </span>
              </div>

              <div className="pt-2 border-t border-white/30 dark:border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheduled Slot</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {viewingBillAppt.appointmentTime}
                </span>
              </div>

              <div className="col-span-2 pt-2 border-t border-white/30 dark:border-white/10 flex justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Phone</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {viewingBillAppt.patientMobile || 'Not provided'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Mode</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {viewingBillAppt.paymentMethod?.toUpperCase() || (viewingBillAppt.paymentStatus === 'paid' ? 'ONLINE DIGITAL' : 'CASH AT RECEPTION')}
                  </span>
                </div>
              </div>
            </div>

            {/* Itemized Charges */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Itemized Fee Breakdown
              </span>
              <div className="divide-y divide-white/40 dark:divide-white/10 border-y border-white/40 dark:border-white/10 py-1">
                <div className="flex justify-between py-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span>Doctor Consultation / OPD Entry Fee</span>
                  <span className="font-bold">NPR {viewingBillAppt.feeAmount || 0}</span>
                </div>
                {viewingBillAppt.selectedTests && viewingBillAppt.selectedTests.length > 0 && (
                  viewingBillAppt.selectedTests.map((t, idx) => (
                    <div key={idx} className="flex justify-between py-1.5 text-slate-600 dark:text-slate-400">
                      <span>Diagnostic Test: {t}</span>
                      <span className="font-semibold">Included</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-1.5 text-slate-500">
                  <span>Dactor Cloud Verification & Live Queue Tracking</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">FREE / WAIVED</span>
                </div>
                <div className="flex justify-between py-2 text-sm font-black text-slate-900 dark:text-white">
                  <span>Total Amount Payable</span>
                  <span className="text-teal-600 dark:text-teal-400">NPR {viewingBillAppt.feeAmount || 0}</span>
                </div>
              </div>
            </div>

            {/* Official Stamp & Security Seal */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 text-[11px] flex items-center justify-between border border-white/40 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Digitally Authenticated • Dactor Health Cloud Network</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                {new Date(viewingBillAppt.createdAt || Date.now()).toLocaleDateString()}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setViewingBillAppt(null)}
                className="flex-1 py-3 liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-white/50 dark:border-white/10 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handlePrintAppointmentBill(viewingBillAppt)}
                className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition shadow-glass-brand border border-white/25 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Print Official Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

