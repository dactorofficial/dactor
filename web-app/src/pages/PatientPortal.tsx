import React, { useState, useEffect } from 'react'
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
} from '../types'
import {
  getClinics,
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
  getClinicPaymentConfig,
  isSlotTimeExpired,
  recordPaymentTransaction,
  getLabReportsByTrackingCode,
  getPatientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  checkEmailPortalAssociation,
} from '../services/db'
import {
  firebaseSignInWithEmail,
  firebaseSignUpWithEmail,
  firebaseSendPasswordReset,
  firebaseSignOut,
  signInWithFirebaseGoogle,
  FirebaseAuthUser,
} from '../lib/firebase'
import { supabase } from '../lib/supabase'

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

  // Auth Modals & Inputs
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authFullName, setAuthFullName] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authAge, setAuthAge] = useState('')
  const [authGender, setAuthGender] = useState('Male')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSuccess, setAuthSuccess] = useState<string | null>(null)
  const [authSubmitting, setAuthSubmitting] = useState(false)

  // Edit Profile Modal
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editGender, setEditGender] = useState('Male')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  // Account Deletion State
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'appointments' | 'book' | 'transactions' | 'reports' | 'notifications' | 'family'
  >('appointments')

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
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)
  const [clinicDoctors, setClinicDoctors] = useState<Doctor[]>([])
  const [clinicServices, setClinicServices] = useState<ClinicService[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedService, setSelectedService] = useState<ClinicService | null>(null)
  const [bookingMode, setBookingMode] = useState<'opd' | 'lab'>('opd')

  // Date & Slot Selection
  const [bookingDate, setBookingDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)

  // Patient Details for Booking
  const [bookFor, setBookFor] = useState<'self' | 'family'>('self')
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [bookPatientName, setBookPatientName] = useState('')
  const [bookPatientPhone, setBookPatientPhone] = useState('')
  const [bookPatientAge, setBookPatientAge] = useState('')
  const [bookPatientGender, setBookPatientGender] = useState('Male')
  const [bookPatientNotes, setBookPatientNotes] = useState('')

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
  // INITIALIZATION & SESSION RESTORE
  // ==========================================
  useEffect(() => {
    async function restoreSession() {
      setIsAuthLoading(true)
      try {
        const storedEmail =
          localStorage.getItem('dactor_patient_email') ||
          localStorage.getItem('dactor_auth_email')
        if (storedEmail) {
          const profile = await getPatientProfileByEmail(storedEmail)
          if (profile) {
            setPatientUser(profile)
            initProfileFields(profile)
            try {
              localStorage.setItem('dactor_patient_session', JSON.stringify(profile))
            } catch {}
          } else {
            // Do NOT auto-fill name, gender, or age from email/Google
            const partial: PatientProfile = {
              id: crypto.randomUUID(),
              email: storedEmail,
              fullName: '',
              role: 'patient',
            }
            setPatientUser(partial)
            initProfileFields(partial)
            setShowEditProfileModal(true)
          }
        }
        // Load clinics for booking
        const cList = await getClinics()
        setClinics(cList.filter((c) => !c.isArchived))
      } catch (err) {
        console.error('Session restore error:', err)
      } finally {
        setIsAuthLoading(false)
      }
    }
    restoreSession()
  }, [])

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
  }, [patientUser])

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
  const handleSelectClinic = async (clinic: Clinic) => {
    setSelectedClinic(clinic)
    setSelectedDoctor(null)
    setSelectedService(null)
    setSelectedSlot(null)

    try {
      const [docs, servs, pCfg] = await Promise.all([
        getDoctorsByClinic(clinic.id),
        getClinicServices(clinic.id),
        getClinicPaymentConfig(clinic.id),
      ])
      setClinicDoctors(docs.filter((d) => d.isInClinic))
      setClinicServices(servs.filter((s) => s.isAvailable))
      setClinicPaymentConfig(pCfg)

      if (clinic.type === 'diagnostic_lab') {
        setBookingMode('lab')
        if (servs.length > 0) setSelectedService(servs[0])
      } else {
        setBookingMode('opd')
        if (docs.length > 0) setSelectedDoctor(docs[0])
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
  }, [selectedClinic, bookingDate, bookingStep])

  // Calculate Fee
  const calculatedFee =
    bookingMode === 'lab'
      ? selectedService?.price || 500
      : selectedDoctor?.consultationFee || 500

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

  // Complete Payment (either Testing Bypass or Gateway Confirmation)
  const handleExecutePayment = async (isBypass: boolean = false) => {
    if (isPaymentProcessing) return // Prevent double clicking!
    setIsPaymentProcessing(true)

    try {
      const code10 = generate10DigitTrackingCode()
      const slotTimeStr = selectedSlot
        ? `${selectedSlot.startTime} - ${selectedSlot.endTime}`
        : '10:00 AM'

      // 1. Create Appointment in Supabase
      const newAppt = await createAppointment({
        trackingCode10Digit: code10,
        userId: patientUser?.id,
        clinicId: selectedClinic!.id,
        doctorId: bookingMode === 'opd' ? selectedDoctor?.id : undefined,
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
        notes: bookPatientNotes.trim() || undefined,
        selectedTests: bookingMode === 'lab' && selectedService ? [selectedService.serviceName] : [],
      })

      if (!newAppt) {
        throw new Error('Failed to create appointment in database')
      }

      // 2. Record Transaction & Billing Invoice in Supabase
      const methodLabel = isBypass
        ? 'Bypass Test'
        : selectedPaymentMethod.toUpperCase()

      await recordPaymentTransaction({
        appointmentId: newAppt.id,
        trackingCode: code10,
        clinicId: selectedClinic!.id,
        doctorId: selectedDoctor?.id,
        patientName: bookPatientName.trim(),
        appointmentDate: bookingDate,
        appointmentTime: slotTimeStr,
        amount: calculatedFee,
        paymentMethod: methodLabel,
        paymentStatus: 'paid',
        notes: isBypass ? 'Confirmed via Testing Bypass button' : `Digital Wallet (${methodLabel})`,
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
  // AUTHENTICATION HANDLERS
  // ==========================================
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthSuccess(null)

    if (authMode === 'signup') {
      if (authFullName.trim().length < 2) {
        setAuthError('Please enter your full legal name (minimum 2 characters).')
        return
      }
      const cleanPhone = authPhone.replace(/\D/g, '')
      if (!/^9\d{9}$/.test(cleanPhone)) {
        setAuthError('Please enter a valid 10-digit mobile number starting with 9 (e.g. 98XXXXXXXX).')
        return
      }
      const ageNum = Number(authAge)
      if (!authAge || !Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
        setAuthError('Please enter a valid age between 1 and 120.')
        return
      }
    }

    setAuthSubmitting(true)

    try {
      // Enforce 1 Google Account = 1 Portal Role rule
      if (authMode === 'login' || authMode === 'signup') {
        const assoc = await checkEmailPortalAssociation(authEmail)
        if (assoc && assoc.portal !== 'patient') {
          await firebaseSignOut()
          const entitySuffix = assoc.entityName ? ` (${assoc.entityName})` : ''
          setAuthError(
            `This Google account (${assoc.email}) is already associated with a ${assoc.portalLabel} account${entitySuffix}. You cannot log in to the Patient Portal with this Google ID. Please change your Google account.`
          )
          return
        }
      }

      if (authMode === 'login') {
        const res = await firebaseSignInWithEmail(authEmail, authPassword)
        if (!res.success || !res.user) {
          setAuthError(res.error || 'Login failed')
          return
        }

        const profile = await getPatientProfileByEmail(res.user.email)
        if (profile && profile.fullName && profile.phone && profile.age && profile.gender) {
          setPatientUser(profile)
          initProfileFields(profile)
          localStorage.setItem('dactor_patient_email', profile.email)
          localStorage.setItem('dactor_patient_session', JSON.stringify(profile))
          localStorage.setItem('dactor_auth_logged_in', 'true')
          localStorage.setItem('dactor_auth_email', profile.email)
          localStorage.setItem('dactor_auth_role', 'patient')
          window.dispatchEvent(new Event('storage'))
          setShowAuthModal(false)
        } else {
          // Do NOT auto-fill name, gender, or age — prompt user to complete profile
          const partial: PatientProfile = profile || {
            id: crypto.randomUUID(),
            authUid: res.user.uid,
            email: res.user.email,
            fullName: '',
            role: 'patient',
          }
          setPatientUser(partial)
          initProfileFields(partial)
          localStorage.setItem('dactor_patient_email', partial.email)
          localStorage.setItem('dactor_auth_logged_in', 'true')
          localStorage.setItem('dactor_auth_email', partial.email)
          localStorage.setItem('dactor_auth_role', 'patient')
          window.dispatchEvent(new Event('storage'))
          setShowAuthModal(false)
          setShowEditProfileModal(true)
        }
      } else if (authMode === 'signup') {
        const res = await firebaseSignUpWithEmail(authEmail, authPassword, authFullName.trim())
        if (!res.success || !res.user) {
          setAuthError(res.error || 'Signup failed')
          return
        }

        const newProfile = await savePatientProfile({
          email: res.user.email,
          authUid: res.user.uid,
          fullName: authFullName.trim(),
          phone: authPhone.replace(/\D/g, ''),
          age: parseInt(authAge, 10),
          gender: authGender,
          role: 'patient',
        })

        if (newProfile) {
          setPatientUser(newProfile)
          initProfileFields(newProfile)
          localStorage.setItem('dactor_patient_email', newProfile.email)
          localStorage.setItem('dactor_patient_session', JSON.stringify(newProfile))
          localStorage.setItem('dactor_auth_logged_in', 'true')
          setShowAuthModal(false)
        }
      } else if (authMode === 'forgot') {
        const res = await firebaseSendPasswordReset(authEmail)
        if (res.success) {
          setAuthSuccess('Password reset link sent to your email!')
        } else {
          setAuthError(res.error || 'Failed to send reset link')
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error')
    } finally {
      setAuthSubmitting(false)
    }
  }

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
      if (profile && profile.fullName && profile.phone && profile.age && profile.gender) {
        setPatientUser(profile)
        initProfileFields(profile)
        localStorage.setItem('dactor_patient_email', profile.email)
        localStorage.setItem('dactor_patient_session', JSON.stringify(profile))
        localStorage.setItem('dactor_auth_logged_in', 'true')
        localStorage.setItem('dactor_auth_email', profile.email)
        localStorage.setItem('dactor_auth_role', 'patient')
        window.dispatchEvent(new Event('storage'))
        setShowAuthModal(false)
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
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Transaction Failed Notice Toast (2-second transient notice) */}
        {transactionFailedNotice && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-bounce">
            <AlertCircle className="w-5 h-5" />
            <span className="font-bold text-sm">{transactionFailedNotice}</span>
          </div>
        )}

        {/* ==========================================
            PATIENT HEADER & PROFILE BAR
        ========================================== */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 font-black text-2xl flex-shrink-0">
                {patientUser?.fullName ? patientUser.fullName.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {patientUser?.fullName || 'Guest Patient Portal'}
                  </h1>
                  {patientUser ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-800">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Verified Patient
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      Guest Mode
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>{patientUser?.email || 'Track bookings & health records'}</span>
                  {patientUser?.phone && <span>• Phone: {patientUser.phone}</span>}
                  {patientUser?.age && <span>• Age: {patientUser.age} yrs</span>}
                  {patientUser?.gender && <span>• Gender: {patientUser.gender}</span>}
                </p>
              </div>
            </div>

            {/* Profile Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {patientUser ? (
                <>
                  <button
                    onClick={() => setShowEditProfileModal(true)}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1.5 px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('login')
                    setShowAuthModal(true)
                  }}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-600/20 transition transform hover:scale-[1.02]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Patient Login / Sign Up</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ==========================================
            PORTAL NAVIGATION TABS
        ========================================== */}
        <div className="bg-white rounded-2xl p-2 shadow-xs border border-slate-200 flex flex-wrap gap-2">
          {[
            { id: 'appointments', label: 'My Appointments & Live Queue', icon: Calendar, badge: myAppointments.length },
            { id: 'book', label: 'Book New Appointment', icon: Sparkles },
            { id: 'transactions', label: 'Transaction History', icon: CreditCard, badge: transactions.length },
            { id: 'reports', label: 'Diagnostic Lab Reports', icon: FileText, badge: patientLabReports.length },
            { id: 'notifications', label: 'Queue Alerts & Updates', icon: Bell, badge: unreadCount },
            { id: 'family', label: 'Family Profiles', icon: Users, badge: familyMembers.length },
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
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`ml-1 px-2 py-0.5 text-xs rounded-full font-bold ${
                      isActive ? 'bg-white text-brand-800' : 'bg-slate-200 text-slate-700'
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 bg-slate-200/80 p-1 rounded-xl">
                <button
                  onClick={() => setAppointmentFilter('active')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                    appointmentFilter === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Active & Upcoming
                </button>
                <button
                  onClick={() => setAppointmentFilter('past')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                    appointmentFilter === 'past' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Past & History
                </button>
              </div>

              <button
                onClick={() => {
                  setActiveTab('book')
                  setBookingStep(1)
                }}
                className="flex items-center space-x-1.5 text-sm font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-4 py-2 rounded-xl transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>+ Book Another</span>
              </button>
            </div>

            {isLoadingAppointments ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-3" />
                <p className="text-slate-500 font-semibold text-sm">Loading your appointments & live queue tokens...</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Calendar className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">No {appointmentFilter} appointments found</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                    You have no {appointmentFilter} tokens scheduled. Book an OPD slot or diagnostic lab test to get a live tracking token.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('book')
                    setBookingStep(1)
                  }}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-brand-600/20"
                >
                  Book OPD or Lab Slot
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredAppointments.map((appt) => {
                  const isToday = appt.appointmentDate === todayStr
                  const isCancelled = appt.checkinStatus === 'cancelled'

                  return (
                    <div
                      key={appt.id}
                      className={`bg-white rounded-3xl p-6 shadow-sm border transition hover:shadow-md ${
                        isToday ? 'border-brand-500/80 ring-2 ring-brand-500/10' : 'border-slate-200'
                      }`}
                    >
                      {/* Top Bar with 10-Digit Code Pill */}
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            10-Digit Token:
                          </span>
                          <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {appt.trackingCode10Digit}
                          </span>
                          <button
                            onClick={() => handleCopyCode(appt.trackingCode10Digit)}
                            className="p-1 text-slate-400 hover:text-brand-600 transition"
                            title="Copy tracking code"
                          >
                            {copiedCode === appt.trackingCode10Digit ? (
                              <Check className="w-4 h-4 text-brand-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-800'
                              : appt.checkinStatus === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : appt.checkinStatus === 'in_consultation'
                              ? 'bg-purple-100 text-purple-800 animate-pulse'
                              : 'bg-brand-100 text-brand-800'
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
                            <h4 className="text-lg font-black text-slate-900">
                              {appt.doctor?.fullName || 'General OPD Specialist'}
                            </h4>
                            <p className="text-xs font-semibold text-brand-600">
                              {appt.doctor?.specialty || 'General Medicine'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-400 block">Consultation Fee</span>
                            <span className="text-sm font-black text-slate-900">
                              NPR {appt.feeAmount > 0 ? appt.feeAmount : 'Free'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 text-xs font-medium text-slate-500">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{appt.clinic?.name || 'Clinic Center'}</span>
                          {appt.clinic?.addressText && <span>• {appt.clinic.addressText}</span>}
                        </div>

                        {/* Date & Slot Time */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-700">
                          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{appt.appointmentDate}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{appt.appointmentTime}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 bg-brand-50 text-brand-800 px-3 py-1.5 rounded-xl border border-brand-200/60">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{appt.paymentStatus === 'paid' ? 'Paid Online' : 'Payment at Clinic'}</span>
                          </div>
                        </div>

                        {/* Patient Name */}
                        <div className="text-xs text-slate-500 pt-1">
                          Patient: <strong className="text-slate-800">{appt.patientName}</strong> ({appt.patientAge || 28} yrs, {appt.patientGender || 'Male'})
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                        <button
                          onClick={() => {
                            if (onOpenLiveQueue) {
                              onOpenLiveQueue(appt.trackingCode10Digit)
                            } else {
                              window.location.hash = '#live-queue'
                            }
                          }}
                          className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-brand-600 rounded-xl transition"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Live Queue Board</span>
                        </button>

                        {!isCancelled && appt.checkinStatus !== 'completed' && (
                          <button
                            onClick={() => handleCancelAppointment(appt.id)}
                            disabled={cancellingApptId === appt.id}
                            className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition border border-rose-200"
                          >
                            {cancellingApptId === appt.id ? 'Cancelling...' : 'Cancel'}
                          </button>
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
          <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 space-y-8">
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
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-4 ring-brand-100'
                          : bookingStep > st.num
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {bookingStep > st.num ? '✓' : st.num}
                    </div>
                    <span
                      className={`text-xs font-bold hidden sm:inline ${
                        bookingStep === st.num ? 'text-slate-900' : 'text-slate-400'
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
                <div className="text-center max-w-md mx-auto">
                  <h3 className="text-xl font-black text-slate-900">Choose a Medical Center</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Select a clinic or diagnostic pathology center to view certified doctors and live slot schedules.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clinics.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectClinic(c)}
                      className="p-5 rounded-2xl border border-slate-200 hover:border-brand-500 bg-slate-50/50 hover:bg-brand-50/30 cursor-pointer transition flex flex-col justify-between group shadow-xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {(c.type || 'clinic').replace('_', ' ')}
                          </span>
                          <span className="text-xs font-bold text-brand-600 flex items-center">
                            Select <ChevronRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-base">{c.name}</h4>
                        <p className="text-xs text-slate-500 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{c.addressText || 'Nepal'}</span>
                        </p>
                      </div>
                      <div className="pt-3 mt-3 border-t border-slate-200/60 text-xs text-slate-400 font-medium">
                        Contact: {c.contactPhone || 'Available'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: SELECT DATE & VALID SLOTS */}
            {bookingStep === 2 && selectedClinic && (
              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setBookingStep(1)}
                    className="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Clinics</span>
                  </button>
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full">
                    {selectedClinic.name}
                  </span>
                </div>

                {/* Doctor Selection (for OPD clinics) */}
                {bookingMode === 'opd' && clinicDoctors.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Select Doctor / Specialist *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clinicDoctors.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDoctor(doc)}
                          className={`p-4 rounded-2xl border cursor-pointer transition ${
                            selectedDoctor?.id === doc.id
                              ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="font-bold text-sm text-slate-900">{doc.fullName}</div>
                          <div className="text-xs text-brand-600 font-medium">{doc.specialty}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Fee: <strong>NPR {doc.consultationFee || 500}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Appointment Date *
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>

                {/* Slots with strictly filtered expired slots */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Available Time Slots *
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
                      <p className="text-xs font-bold">No available slots for this date</p>
                      <p className="text-[11px] text-amber-700">
                        All slots for today have either ended or reached full capacity. Please select tomorrow or a future date.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded-xl border text-center transition ${
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

                <button
                  onClick={() => setBookingStep(3)}
                  disabled={!selectedSlot && availableSlots.length > 0}
                  className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-600/20 transition flex items-center justify-center space-x-2"
                >
                  <span>Continue to Patient Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
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
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Consultant / Specialist</span>
                    <strong className="text-slate-800">{selectedDoctor?.fullName || 'General OPD'}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Patient</span>
                    <strong className="text-slate-800">{bookPatientName}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Slot</span>
                    <strong className="text-slate-800">{bookingDate} • {selectedSlot?.startTime}</strong>
                  </div>
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Total Consultation Fee</span>
                    <span className="text-lg font-black text-brand-700">NPR {calculatedFee}</span>
                  </div>
                </div>

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
                        className={`p-4 rounded-2xl border text-left transition flex items-center space-x-3 ${
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
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center space-x-2"
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
                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-600/20 transition flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {isPaymentProcessing
                        ? 'Processing Payment...'
                        : `Pay NPR ${calculatedFee} via ${selectedPaymentMethod.toUpperCase()} & Book`}
                    </span>
                  </button>

                  {/* Cancel Transaction Button (Redirects to slot booking & shows 2-second failed toast) */}
                  <button
                    type="button"
                    onClick={() => handleCancelPaymentSession('User clicked cancel button')}
                    disabled={isPaymentProcessing}
                    className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  >
                    Cancel Transaction & Choose Different Slot
                  </button>
                </div>
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Appointment Transactions</h3>
                <p className="text-xs text-slate-500">
                  Comprehensive audit history of your appointment payments and booking receipts.
                </p>
              </div>
              <button
                onClick={loadTransactions}
                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-xl transition"
                title="Refresh transactions"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoadingTransactions ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                <span className="text-xs text-slate-500">Loading transaction history...</span>
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
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
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
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 font-mono font-bold text-slate-900">{tx.transactionId}</td>
                        <td className="py-3 font-mono">{tx.trackingCode}</td>
                        <td className="py-3">
                          <div className="font-bold text-slate-900">{tx.doctorName}</div>
                          <div className="text-[11px] text-slate-400">{tx.clinicName}</div>
                        </td>
                        <td className="py-3">{tx.appointmentDate} • {tx.appointmentTime}</td>
                        <td className="py-3 font-bold text-slate-900">NPR {tx.amount}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              tx.paymentStatus === 'paid'
                                ? 'bg-brand-100 text-brand-800'
                                : tx.paymentStatus === 'free'
                                ? 'bg-blue-100 text-blue-800'
                                : tx.paymentStatus === 'failed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {tx.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadTransactionReceipt(tx)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-bold text-[11px] transition cursor-pointer"
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Diagnostic Pathology Reports</h3>
                <p className="text-xs text-slate-500">
                  Access digital lab test results, blood work, and biochemistry PDFs securely.
                </p>
              </div>
            </div>

            {isLoadingReports ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                <span className="text-xs text-slate-500">Checking lab records...</span>
              </div>
            ) : patientLabReports.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <FileText className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-sm font-semibold">No lab test reports found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When you have diagnostic blood tests or urine samples collected at our partner labs, verified reports will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patientLabReports.map((rep) => (
                  <div key={rep.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        Code: {rep.trackingCode10Digit}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          rep.status === 'delivered' || rep.status === 'prepared'
                            ? 'bg-brand-100 text-brand-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rep.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-base text-slate-900">{rep.testName}</h4>
                      <p className="text-xs text-slate-500">Patient: {rep.patientName}</p>
                    </div>

                    {rep.technicianNotes && (
                      <p className="text-xs text-slate-600 italic bg-white p-2.5 rounded-xl border border-slate-200/60">
                        "{rep.technicianNotes}"
                      </p>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Uploaded: {rep.uploadedAt?.split('T')[0] || 'Recent'}
                      </span>
                      {rep.reportFileUrl ? (
                        <a
                          href={rep.reportFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </a>
                      ) : (
                        <span className="text-xs text-amber-600 font-semibold">Processing at Lab</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 5: NOTIFICATIONS & QUEUE ALERTS
        ========================================== */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Clinic Alerts & Queue Broadcasts</h3>
                <p className="text-xs text-slate-500">
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
                    className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Mark All Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadNotifications}
                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
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
                        ? 'border-slate-200 bg-white'
                        : 'border-brand-300 bg-brand-50/40 shadow-xs'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                          )}
                          <span>{notif.title}</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {notif.createdAt?.split('T')[0]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Family Members</h3>
                <p className="text-xs text-slate-500">
                  Save family members to book doctor slots and lab tests with 1 click.
                </p>
              </div>
              <button
                onClick={() => setShowAddFamilyModal(true)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
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
                  <div key={mem.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                        {mem.relation}
                      </span>
                      <button
                        onClick={() => handleDeleteFamilyMember(mem.id)}
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="font-bold text-base text-slate-900">{mem.name}</div>
                    <div className="text-xs text-slate-500">
                      {mem.age} yrs • {mem.gender}
                      {mem.phone && ` • ${mem.phone}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==========================================
          MODAL: PATIENT AUTHENTICATION (LOGIN / SIGNUP)
      ========================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <User className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Patient Health Portal
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Sign in with your verified Google account to track live queue tokens, access lab reports & manage appointments.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold space-y-2.5">
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
                  className="w-full py-2 px-3 rounded-lg bg-white hover:bg-rose-100/60 border border-rose-300 text-rose-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
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
                className="w-full py-3.5 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{authSubmitting ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  <span>Single-Role Patient Identity</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Your Google identity ensures verified authentication. First-time users will specify their full name, phone number, and age to maintain your personal health records.
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 relative">
            <button
              onClick={() => setShowEditProfileModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-black text-slate-900">Update Profile</h3>
              <p className="text-xs text-slate-500">Sync details with Supabase patient database.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
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
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ADD FAMILY MEMBER
      ========================================== */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 relative">
            <button
              onClick={() => setShowAddFamilyModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-black text-slate-900">Add Family Member</h3>
              <p className="text-xs text-slate-500">Save family profile for fast appointment booking.</p>
            </div>

            <form onSubmit={handleAddFamilyMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  placeholder="e.g. Suman Sharma"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Relationship</label>
                  <select
                    value={newFamilyRelation}
                    onChange={(e) => setNewFamilyRelation(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Age *</label>
                  <input
                    type="number"
                    required
                    value={newFamilyAge}
                    onChange={(e) => setNewFamilyAge(e.target.value)}
                    placeholder="e.g. 7"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone (Optional)</label>
                <input
                  type="tel"
                  value={newFamilyPhone}
                  onChange={(e) => setNewFamilyPhone(e.target.value)}
                  placeholder="98xxxxxxxx"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                Save Family Member
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
