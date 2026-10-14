import React, { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Search,
  Sparkles,
  Clock,
  CheckCircle2,
  Building2,
  Stethoscope,
  Users,
  AlertCircle,
  RefreshCw,
  BellRing,
  ArrowRight,
  ShieldCheck,
  User,
  FlaskConical,
  Copy,
  Phone,
  MapPin,
  ExternalLink,
  Lock,
  Eye,
  Download,
  Calendar,
  X,
  FileText,
  PauseCircle,
  Coffee,
  Check,
  Hourglass,
  Receipt,
  ArrowLeft,
  Zap,
} from 'lucide-react'
import { Appointment, Clinic, Doctor, LabReport, BillingInvoice } from '../types'
import {
  getAppointmentByTrackingCode,
  getAppointmentByTrackingCodeOrContact,
  getAppointmentsByClinic,
  getClinicById,
  getDoctorById,
  getLabReportsByTrackingCode,
  shiftAppointmentDate,
  cancelAppointment,
} from '../services/db'

interface LiveQueueProps {
  initialCode?: string
  onOpenReportModal?: (code: string) => void
  onNavigateHome?: () => void
  onNavigate?: (tab: string, params?: any) => void
}

export const LiveQueue: React.FC<LiveQueueProps> = ({
  initialCode = '',
  onOpenReportModal,
  onNavigateHome,
  onNavigate,
}) => {
  const [inputCode, setInputCode] = useState(initialCode)
  const [activeCode, setActiveCode] = useState(initialCode)

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [clinicQueue, setClinicQueue] = useState<Appointment[]>([])
  const [labReports, setLabReports] = useState<LabReport[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(false)

  // Live Consultation Timer
  const [currentEpochSecond, setCurrentEpochSecond] = useState<number>(() =>
    Math.floor(Date.now() / 1000)
  )

  // Security Verification State (Name or Mobile Number check for confidential file/report access & rescheduling)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isReportIdentityVerified, setIsReportIdentityVerified] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [pendingVerificationAction, setPendingVerificationAction] = useState<
    'view_report' | 'download_report' | 'reschedule' | 'cancel'
  >('view_report')
  const [verifyMethod, setVerifyMethod] = useState<'name' | 'phone'>('name')
  const [verificationInput, setVerificationInput] = useState('')
  const [verifyError, setVerifyError] = useState('')

  // Report Viewing Modal
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedReportToView, setSelectedReportToView] = useState<LabReport | null>(null)

  // Prescription & Bill Modal
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)

  // Reschedule Modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleProcessing, setRescheduleProcessing] = useState(false)
  const [rescheduleMsg, setRescheduleMsg] = useState('')

  // 1-second interval ticker for live in-cabin consultation elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentEpochSecond(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Main data loader by 10-digit code, Gmail address, or phone number
  const fetchQueueData = async (targetCode: string, silent = false) => {
    const clean = targetCode.trim()
    if (!clean) return
    if (!silent) setLoading(true)
    setErrorMsg('')

    try {
      const appt = await getAppointmentByTrackingCodeOrContact(clean)
      setAppointment(appt)

      if (appt) {
        const effectiveCode = appt.trackingCode10Digit || clean
        // Fetch clinic details
        if (appt.clinicId) {
          const [clinicData, queueList, reportsData] = await Promise.all([
            getClinicById(appt.clinicId),
            getAppointmentsByClinic(appt.clinicId, appt.appointmentDate),
            getLabReportsByTrackingCode(effectiveCode),
          ])
          setClinic(clinicData)
          setClinicQueue(queueList)
          setLabReports(reportsData)

          // Fetch attending doctor if linked
          if (appt.doctorId) {
            const doc = await getDoctorById(appt.doctorId)
            setDoctor(doc)
          } else if (clinicData && clinicData.type === 'single_doctor') {
            // If single doctor clinic, doctor can be inferred from clinic roster
          }
        }
      } else {
        if (!silent) setErrorMsg(`No booking record found for '${clean}'.`)
      }
    } catch {
      if (!silent) setErrorMsg('Failed to update live queue status. Please try again.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Load when activeCode changes
  useEffect(() => {
    if (activeCode) {
      fetchQueueData(activeCode)
    }
  }, [activeCode])

  // Live auto-refresh every 4 seconds (matching Android QueueStatusScreen.kt)
  useEffect(() => {
    if (!activeCode) return
    const interval = setInterval(() => {
      fetchQueueData(activeCode, true)
    }, 4000)
    return () => clearInterval(interval)
  }, [activeCode])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = inputCode.trim()
    if (!clean) {
      setErrorMsg('Please enter your 10-digit tracking code, Gmail address, or mobile number.')
      return
    }
    setActiveCode(clean)
  }

  const handleCopyCode = () => {
    if (!appointment?.trackingCode10Digit) return
    navigator.clipboard.writeText(appointment.trackingCode10Digit)
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }

  // Calculations for live queue status
  const waitingPatients = useMemo(
    () => clinicQueue.filter((a) => a.checkinStatus === 'waiting'),
    [clinicQueue]
  )
  const inConsultationPatient = useMemo(
    () => clinicQueue.find((a) => a.checkinStatus === 'in_consultation'),
    [clinicQueue]
  )

  let patientsAhead = 0
  if (appointment && appointment.checkinStatus === 'waiting') {
    const myIndex = waitingPatients.findIndex((a) => a.id === appointment.id)
    patientsAhead = myIndex >= 0 ? myIndex : 0
    if (inConsultationPatient && inConsultationPatient.id !== appointment.id) {
      patientsAhead += 1
    }
  }

  const clinicAvgMinutes = clinic?.avgConsultationTimeMinutes || 10
  const estimatedWaitMinutes = Math.max(0, patientsAhead * clinicAvgMinutes)

  // Status flags
  const isLabClinic =
    clinic?.type === 'diagnostic_lab' ||
    Boolean(appointment?.selectedTests && appointment.selectedTests.length > 0) ||
    labReports.length > 0

  const isConsultancyCompleted =
    appointment?.checkinStatus === 'completed' || appointment?.checkinStatus === 'done'

  const isInsideChamber = appointment?.checkinStatus === 'in_consultation'

  const hasPreparedReport = labReports.some((r) => r.status === 'prepared' || r.status === 'delivered')
  const hasProcessingReport = labReports.some((r) => r.status === 'processing')

  const effectiveLabStatus: 'waiting' | 'processing' | 'prepared' = hasPreparedReport
    ? 'prepared'
    : hasProcessingReport || isInsideChamber
    ? 'processing'
    : 'waiting'

  // Verification handling
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!verificationInput.trim()) {
      setVerifyError('Please enter your patient name or registered mobile number.')
      return
    }

    const inputClean = verificationInput.trim().toLowerCase()
    const targetName = (appointment?.patientName || '').toLowerCase()
    const targetPhone = (appointment?.patientMobile || '').toLowerCase()

    const nameMatches =
      targetName.includes(inputClean) ||
      inputClean.includes(targetName) ||
      targetName.split(/\s+/).some((p) => p.length >= 3 && inputClean.includes(p))

    const phoneMatches =
      targetPhone.replace(/\D/g, '').includes(inputClean.replace(/\D/g, '')) &&
      inputClean.replace(/\D/g, '').length >= 6

    if (nameMatches || phoneMatches) {
      setIsUnlocked(true)
      setIsReportIdentityVerified(true)
      setShowVerificationModal(false)
      setVerifyError('')

      if (pendingVerificationAction === 'view_report') {
        const rep = labReports.find((r) => r.status === 'prepared') || labReports[0]
        setSelectedReportToView(rep || null)
        setShowReportModal(true)
      } else if (pendingVerificationAction === 'reschedule') {
        if (onNavigate && appointment?.clinicId) {
          setShowVerificationModal(false)
          onNavigate('clinic-detail', {
            clinicId: appointment.clinicId,
            doctorId: appointment.doctorId,
            trackingCode: appointment.trackingCode10Digit,
            isReschedule: true,
          })
        } else {
          setRescheduleDate(appointment?.appointmentDate || '')
          setRescheduleTime(appointment?.appointmentTime || '10:00 AM')
          setShowRescheduleModal(true)
        }
      } else if (pendingVerificationAction === 'cancel') {
        executeCancellation()
      }
    } else {
      setVerifyError('Identity verification failed. Name or phone does not match this booking.')
    }
  }

  const handleActionWithAuth = (
    action: 'view_report' | 'download_report' | 'reschedule' | 'cancel'
  ) => {
    if (isUnlocked || isReportIdentityVerified) {
      if (action === 'view_report') {
        const rep = labReports.find((r) => r.status === 'prepared') || labReports[0]
        setSelectedReportToView(rep || null)
        setShowReportModal(true)
      } else if (action === 'download_report') {
        triggerReportDownload()
      } else if (action === 'reschedule') {
        if (onNavigate && appointment?.clinicId) {
          onNavigate('clinic-detail', {
            clinicId: appointment.clinicId,
            doctorId: appointment.doctorId,
            trackingCode: appointment.trackingCode10Digit,
            isReschedule: true,
          })
        } else {
          setRescheduleDate(appointment?.appointmentDate || '')
          setRescheduleTime(appointment?.appointmentTime || '10:00 AM')
          setShowRescheduleModal(true)
        }
      } else if (action === 'cancel') {
        executeCancellation()
      }
    } else {
      setPendingVerificationAction(action)
      setVerificationInput('')
      setVerifyError('')
      setShowVerificationModal(true)
    }
  }

  const triggerReportDownload = () => {
    const rep = labReports.find((r) => r.status === 'prepared') || labReports[0]
    if (rep?.reportFileUrl) {
      window.open(rep.reportFileUrl, '_blank')
    } else {
      alert(
        'Your diagnostic report is certified and ready for collection at the clinic desk. A digital PDF download will sync shortly.'
      )
    }
  }

  const executeCancellation = async () => {
    if (!appointment) return
    const confirmed = window.confirm(
      'Are you sure you want to cancel this appointment? This action cannot be undone.'
    )
    if (!confirmed) return

    try {
      await cancelAppointment(appointment.id)
      alert('Appointment cancelled successfully.')
      fetchQueueData(activeCode)
    } catch {
      alert('Failed to cancel appointment.')
    }
  }

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!appointment || !rescheduleDate) return
    setRescheduleProcessing(true)
    setRescheduleMsg('')
    try {
      await shiftAppointmentDate(appointment.id, rescheduleDate, rescheduleTime || '10:00 AM')
      setRescheduleMsg('Appointment rescheduled successfully!')
      setTimeout(() => {
        setShowRescheduleModal(false)
        fetchQueueData(activeCode)
      }, 1200)
    } catch {
      setRescheduleMsg('Failed to reschedule. Please contact clinic reception.')
    } finally {
      setRescheduleProcessing(false)
    }
  }

  // Doctor presence flag
  const isDoctorInClinic = doctor?.isInClinic !== false

  // Helper to parse slot start time
  const slotStartDate = useMemo(() => {
    if (!appointment?.appointmentTime) return null
    const token = appointment.appointmentTime.split(/[-–]|to/)[0]?.trim()
    if (!token) return null
    const m = token.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([APap][Mm]))?/)
    if (!m) return null
    let hours = parseInt(m[1], 10)
    const minutes = parseInt(m[2], 10)
    const ampm = m[3]?.toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    return d
  }, [appointment?.appointmentTime])

  const {
    effectiveExpectedTime,
    timeWindowText,
    approxTimeText,
    suggestedArrivalText,
    slotNoticeText,
    canOfferEarlyArrival,
    displayWaitText
  } = useMemo(() => {
    const now = new Date()
    const isDoctorFree = isDoctorInClinic && !inConsultationPatient && clinic?.isOnBreak !== true

    let arrivalStr = ''
    let slotStartFmt = ''
    if (slotStartDate) {
      const arr = new Date(slotStartDate.getTime() - 15 * 60000)
      arrivalStr = arr.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      slotStartFmt = slotStartDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }

    const arrivalAdvice = arrivalStr ? `Please arrive by ${arrivalStr}.` : ''
    const notice = slotStartDate
      ? (patientsAhead === 0
          ? `No one ahead of you. Your slot starts at ${slotStartFmt}. ${arrivalAdvice}`
          : `${patientsAhead} ${patientsAhead === 1 ? 'person' : 'people'} ahead. Your slot starts at ${slotStartFmt}. ${arrivalAdvice}`)
      : (patientsAhead === 0
          ? 'No one ahead of you. You are up next!'
          : `${patientsAhead} ahead in line. Est. wait: ~${estimatedWaitMinutes} mins`)

    const dynamicTime = new Date(now.getTime() + estimatedWaitMinutes * 60000)
    const isSlotInFuture = slotStartDate ? now.getTime() < slotStartDate.getTime() : false
    const canEarly = Boolean(isDoctorFree && isSlotInFuture && appointment?.optInEarlyCall && patientsAhead === 0)

    let finalExpected: Date
    let waitText: string

    if (patientsAhead === 0) {
      if (isSlotInFuture && !canEarly) {
        finalExpected = slotStartDate || now
        const diffMins = Math.round((finalExpected.getTime() - now.getTime()) / 60000)
        waitText = diffMins > 60 ? `Starts at ${slotStartFmt}` : `~${diffMins} min`
      } else {
        // Position 1 and current time is within slot, doctor free early, or slot is over:
        finalExpected = now
        waitText = 'Arrive Fast'
      }
    } else {
      // Patient is at position 2, 3, etc. (patientsAhead > 0)
      if (isSlotInFuture && slotStartDate) {
        // Stagger patient by (patientsAhead * clinicAvgMinutes) so time is in between the time slot!
        const slotStaggered = new Date(slotStartDate.getTime() + patientsAhead * clinicAvgMinutes * 60000)
        finalExpected = dynamicTime.getTime() > slotStaggered.getTime() ? dynamicTime : slotStaggered
        const diffMins = Math.round((finalExpected.getTime() - now.getTime()) / 60000)
        waitText = diffMins > 60 ? `~${Math.round(diffMins / 60)} hr` : `~${diffMins} min`
      } else {
        // Current time is within slot or slot is over: calculate dynamically based on active queue
        finalExpected = dynamicTime
        waitText = `~${estimatedWaitMinutes} min`
      }
    }

    const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const startWin = new Date(finalExpected.getTime() - 5 * 60000)
    const endWin = new Date(finalExpected.getTime() + 10 * 60000)

    const isArriveFast = waitText === 'Arrive Fast'

    return {
      effectiveExpectedTime: finalExpected,
      timeWindowText: isArriveFast ? 'Immediate' : `${fmt(startWin)} – ${fmt(endWin)}`,
      approxTimeText: isArriveFast ? 'Your turn, arrive fast' : `around ${fmt(finalExpected)}`,
      suggestedArrivalText: arrivalAdvice,
      slotNoticeText: isArriveFast ? 'You are at position 1! You are next in line — arrive fast.' : notice,
      canOfferEarlyArrival: canEarly,
      displayWaitText: waitText
    }
  }, [slotStartDate, isDoctorInClinic, inConsultationPatient, clinic?.isOnBreak, appointment?.optInEarlyCall, patientsAhead, estimatedWaitMinutes])

  // Formatted expected call time
  const formattedExpectedTime = approxTimeText

  return (
    <div className="min-h-screen pb-28 sm:pb-16">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: DARK OBSIDIAN / TEAL REFRACTION                     */}
      {/* ========================================================================= */}
      <div className="w-full bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white pt-6 sm:pt-8 pb-12 sm:pb-16 px-3 sm:px-6 lg:px-8 border-b border-teal-500/20 relative overflow-hidden shadow-glass-elevated">
        {/* Specular Edge Highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4 relative z-10">
          {/* Top Brand Capsule Pill + Refresh Action */}
          <div className="flex items-center justify-between">
            <div className="px-3 py-1 rounded-full bg-white/10 text-teal-300 text-[11px] sm:text-xs font-semibold backdrop-blur-md tracking-wide truncate max-w-[230px] sm:max-w-none border border-white/15">
              {clinic?.name || 'Dactor • Healthcare Ecosystem'}
            </div>

            <button
              onClick={() => fetchQueueData(activeCode)}
              disabled={loading}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition cursor-pointer active:scale-95 shadow-glass-sm"
              title="Refresh live queue status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Title Row with Back Button */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 pt-1">
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition cursor-pointer shrink-0 active:scale-95 shadow-glass-sm"
                title="Back to home"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">Live Queue Position</h1>
              <p className="text-[11px] sm:text-xs text-teal-300/90 font-medium">Your health, our priority</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OVERLAPPING CONTENT CONTAINER (Negative offset over Teal Header)        */}
      {/* ========================================================================= */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 space-y-4 sm:space-y-5">
        {/* Search Input Bar (If not loaded or searching another code) */}
        <div className="liquid-glass-elevated rounded-3xl p-2 sm:p-2.5 border-teal-500/30 shadow-glass-elevated">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter 10-Digit Code..."
                maxLength={10}
                className="w-full pl-9 sm:pl-11 pr-2 sm:pr-4 py-2 sm:py-2.5 bg-transparent text-sm sm:text-lg font-black tracking-wider text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-xs font-bold rounded-2xl shadow-glass-base transition cursor-pointer shrink-0 active:scale-95 border-t border-white/20"
            >
              {loading ? 'Tracking...' : 'Track'}
            </button>
          </form>

          {errorMsg && (
            <div className="mt-2 p-2.5 sm:p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center space-x-2 backdrop-blur-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* ACTIVE APPOINTMENT LIVE BOARD                                         */}
        {/* --------------------------------------------------------------------- */}
        {appointment && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* 1. BOOKING CODE CARD WITH COPY BUTTON */}
            <div className="liquid-glass-card rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    BOOKING CODE
                  </span>
                  <div className="text-lg font-black text-slate-900 dark:text-white tracking-wider font-mono">
                    #{appointment.trackingCode10Digit}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCopyCode}
                className="p-2.5 rounded-xl liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 transition flex items-center space-x-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                title="Copy code to clipboard"
              >
                {copyFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. CLINIC ON BREAK ALERT BANNER (If clinic is on break) */}
            {clinic?.isOnBreak && !isConsultancyCompleted && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center space-x-3 text-amber-900 dark:text-amber-300 shadow-glass-sm backdrop-blur-sm">
                <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <PauseCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    CLINIC IS CURRENTLY ON BREAK
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-400/90">
                    Consultations are paused temporarily. They will resume shortly.
                  </p>
                </div>
              </div>
            )}

            {/* 3. DOCTOR PRESENCE / AWAY BANNER */}
            {!isConsultancyCompleted && !isLabClinic && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center space-x-2.5 backdrop-blur-sm ${
                  isDoctorInClinic
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-300'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isDoctorInClinic ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                  }`}
                />
                <span className="font-bold">
                  {isDoctorInClinic
                    ? `Doctor is inside the clinic cabin • Attending active OPD tokens`
                    : `Doctor Temporarily Away • Will resume consultations shortly`}
                </span>
              </div>
            )}

            {/* 4. MAIN LIVE QUEUE STATUS CARD (Position Badge, Stepper, Slot & Wait) */}
            <div className="liquid-glass-elevated rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Top Token Row: Position Circle + Dynamic Title */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                {/* Circular Position Badge with Outer Halo Ring */}
                <div className="relative flex items-center justify-center shrink-0">
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center backdrop-blur-md border ${
                      isInsideChamber
                        ? 'bg-blue-500/15 border-blue-500/30'
                        : isConsultancyCompleted
                        ? 'bg-emerald-500/15 border-emerald-500/30'
                        : patientsAhead === 0
                        ? 'bg-emerald-500/15 border-emerald-500/30'
                        : 'bg-teal-500/15 border-teal-500/30'
                    }`}
                  >
                    <div
                      className={`w-13 h-13 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center text-white shadow-glass-base ${
                        isInsideChamber
                          ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                          : isConsultancyCompleted
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-600'
                          : patientsAhead === 0
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-600'
                          : 'bg-gradient-to-tr from-teal-600 to-cyan-600'
                      }`}
                    >
                      <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider opacity-90 leading-tight">
                        {isInsideChamber
                          ? 'CURRENT'
                          : isConsultancyCompleted
                          ? 'VISIT'
                          : patientsAhead === 0
                          ? 'UP NEXT'
                          : 'POSITION'}
                      </span>
                      <span className="text-xl sm:text-2xl font-black leading-none mt-0.5">
                        {isInsideChamber
                          ? 'NOW'
                          : isConsultancyCompleted
                          ? '✓'
                          : patientsAhead >= 0
                          ? patientsAhead
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Title, Subtitle, and Token Badge */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3
                      className={`text-base sm:text-xl font-black leading-snug ${
                        isLabClinic && effectiveLabStatus === 'prepared'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isLabClinic && effectiveLabStatus === 'processing'
                          ? 'text-amber-700 dark:text-amber-300'
                          : isInsideChamber
                          ? 'text-blue-700 dark:text-blue-300'
                          : isConsultancyCompleted
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isLabClinic
                        ? effectiveLabStatus === 'prepared'
                        ? 'Status: Report Prepared'
                        : effectiveLabStatus === 'processing'
                        ? 'Status: Sample Processing'
                        : patientsAhead === 0
                        ? 'Next for Sample Collection!'
                        : `${patientsAhead} Ahead for Phlebotomy`
                      : isInsideChamber
                      ? 'You are in OPD session'
                      : isConsultancyCompleted
                      ? 'Consultation completed'
                      : patientsAhead === 0
                      ? "You're next in line!"
                      : `${patientsAhead} patients ahead`}
                    </h3>

                    <span className="px-2 sm:px-2.5 py-0.5 rounded-md liquid-glass-subtle text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-bold">
                      Token #{appointment.queueNumber || 1}
                    </span>
                  </div>

                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {isLabClinic
                      ? effectiveLabStatus === 'prepared'
                        ? 'Certified report ready • Verify identity below to view & download file'
                        : effectiveLabStatus === 'processing'
                        ? 'Sample collected • Biochemical processing underway in laboratory'
                        : 'Booked in Live Queue • Please proceed for sample collection'
                      : isInsideChamber
                      ? 'Currently with specialist in consultation cabin'
                      : isConsultancyCompleted
                      ? 'Thank you for visiting • Prescription & bill available below'
                      : slotNoticeText || (patientsAhead === 0
                      ? '0 patients ahead • Please stay close to the consultation cabin'
                      : `${patientsAhead} ahead in line • Est. wait: ~${estimatedWaitMinutes} mins`)}
                  </p>
                </div>
              </div>

              {/* 4-Step Stepper Progress Bar */}
              <div className="py-2 overflow-x-auto scrollbar-none">
                <div className="flex items-center justify-between relative min-w-[270px]">
                  {/* Connecting line behind */}
                  <div className="absolute top-1/2 left-4 sm:left-6 right-4 sm:right-6 -translate-y-1/2 h-0.5 bg-slate-200/60 dark:bg-white/10 -z-0" />

                  {(isLabClinic
                    ? ['Booked', 'Collected', 'Processing', 'Prepared']
                    : ['Booked', 'Waiting', 'In OPD', 'Done']
                  ).map((stepName, idx) => {
                    const isLab = isLabClinic
                    const isDone = isLab
                      ? (idx === 0) ||
                        (idx === 1 && (effectiveLabStatus === 'processing' || effectiveLabStatus === 'prepared')) ||
                        (idx === 2 && (effectiveLabStatus === 'processing' || effectiveLabStatus === 'prepared')) ||
                        (idx === 3 && effectiveLabStatus === 'prepared')
                      : (idx === 0) ||
                        (idx === 1 && (!isConsultancyCompleted || isInsideChamber)) ||
                        (idx === 2 && (isInsideChamber || isConsultancyCompleted)) ||
                        (idx === 3 && isConsultancyCompleted)

                    const isActive = isLab
                      ? (idx === 3 && effectiveLabStatus === 'prepared') ||
                        (idx === 2 && effectiveLabStatus === 'processing') ||
                        (idx === 1 && effectiveLabStatus === 'waiting' && patientsAhead === 0)
                      : (idx === 3 && isConsultancyCompleted) ||
                        (idx === 2 && isInsideChamber) ||
                        (idx === 1 && !isInsideChamber && !isConsultancyCompleted)

                    return (
                      <div
                        key={stepName}
                        className="flex flex-col items-center space-y-1 z-10 px-1 sm:px-2"
                      >
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black transition-all ${
                            isDone || isActive
                              ? 'bg-gradient-to-tr from-teal-600 to-cyan-600 text-white shadow-glass-sm'
                              : 'liquid-glass-subtle text-slate-400'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : idx + 1}
                        </div>
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold ${
                            isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {stepName}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Slot & Expected Call Informational Cards (Hidden when completed or lab prepared) */}
              {!isConsultancyCompleted && effectiveLabStatus !== 'prepared' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl liquid-glass-subtle space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Your Booked Window
                      </span>
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        {appointment.appointmentTime || 'Real-time queue'}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {suggestedArrivalText || `Date: ${appointment.appointmentDate}`}
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl liquid-glass-subtle space-y-0.5 ${canOfferEarlyArrival ? 'border border-emerald-500/40 bg-emerald-500/10' : 'border-teal-500/30'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${canOfferEarlyArrival ? 'text-emerald-700 dark:text-emerald-300' : 'text-teal-700 dark:text-teal-300'}`}>
                        {canOfferEarlyArrival ? '⚡ Doctor Free Early' : 'Expected Window'}
                      </span>
                      <div className={`text-base font-black ${canOfferEarlyArrival ? 'text-emerald-900 dark:text-emerald-200' : 'text-teal-900 dark:text-teal-200'}`}>
                        {displayWaitText}
                      </div>
                      <span className={`text-[11px] ${canOfferEarlyArrival ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-teal-700 dark:text-teal-400'}`}>
                        {timeWindowText} ({approxTimeText})
                      </span>
                    </div>
                  </div>

                  {/* ⚡ Early Arrival Invite Banner if doctor is free now */}
                  {canOfferEarlyArrival && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 flex items-start space-x-3">
                      <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold">⚡ Doctor is Free Now! Come in early?</div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                          The doctor finished earlier consultations ahead of schedule. Since you opted in at booking, you can proceed to the clinic now!
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. CLINIC & DOCTOR PROFILE CARD (Call, Directions & Roster) */}
            <div className="liquid-glass-card rounded-3xl p-6 space-y-5">
              {/* Clinic Information */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      HEALTHCARE FACILITY
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      {clinic?.name || appointment.clinic?.name || 'OPD Medical Center'}
                    </h4>
                  </div>
                </div>

                <div className="flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-300 pl-1">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{clinic?.addressText || 'Nepal'}</span>
                </div>

                {/* Call Clinic & Google Maps Directions Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <a
                    href={`tel:${clinic?.contactPhone || clinic?.managerPhone || '01-4412345'}`}
                    className="py-2.5 px-3 rounded-xl liquid-glass-subtle text-teal-700 dark:text-teal-300 hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call clinic</span>
                  </a>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${clinic?.name || ''} ${clinic?.addressText || ''}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl liquid-glass-subtle text-teal-700 dark:text-teal-300 hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>

              {/* Attending Doctor Profile (If applicable) */}
              {doctor && (
                <div className="pt-4 border-t border-slate-200/50 dark:border-white/10 flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 flex items-center justify-center font-black text-lg shrink-0 overflow-hidden">
                    {doctor.profilePictureUrl ? (
                      <img
                        src={doctor.profilePictureUrl}
                        alt={doctor.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      doctor.fullName.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                      ATTENDING DOCTOR
                    </span>
                    <h5 className="font-bold text-slate-900 dark:text-white text-sm">
                      {doctor.fullName.startsWith('Dr.') ? doctor.fullName : `Dr. ${doctor.fullName}`}
                    </h5>
                    <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                      {doctor.specialty || 'General OPD Specialist'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {doctor.education ? `${doctor.education} • ` : ''}
                      Consultation for general health & OPD
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 6. BOOKED DIAGNOSTIC LAB TESTS CARD (If applicable) */}
            {Boolean(appointment.selectedTests && appointment.selectedTests.length > 0) && (
              <div className="liquid-glass-subtle border-purple-500/30 rounded-3xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-purple-900 dark:text-purple-300 font-bold text-xs uppercase tracking-wider">
                  <FlaskConical className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Booked Diagnostic Lab Investigations</span>
                </div>
                <p className="text-xs font-bold text-purple-950 dark:text-purple-200">
                  {appointment.selectedTests?.join(', ')}
                </p>
              </div>
            )}

            {/* 7. ACTIVE IN-CHAMBER OPD CONSULTATION TIMER BANNER */}
            {isInsideChamber && (
              <div className="liquid-glass-elevated border-blue-500/50 rounded-3xl p-5 space-y-2 text-blue-900 dark:text-blue-300">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Active Consultation Session in Progress
                  </span>
                </div>
                <p className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  Please step into the consultation room and discuss your symptoms with the attending specialist.
                </p>
              </div>
            )}

            {/* 8. CONSULTATION COMPLETED & PRESCRIPTION / BILL READY */}
            {isConsultancyCompleted && (
              <div className="liquid-glass-card border-emerald-500/30 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-900 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-black text-sm">Consultation Finished & Bill Ready</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-xs font-black">
                    COMPLETED
                  </span>
                </div>

                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 font-medium">
                  Total Bill: NPR {appointment.feeAmount || 500} • Status: {appointment.paymentStatus === 'paid' ? 'Paid' : 'Settled at Reception'}
                </p>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-glass-sm active:scale-95 border-t border-white/20"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Prescription & Bill Summary</span>
                  </button>
                </div>
              </div>
            )}

            {/* ===================================================================== */}
            {/* 9. UNIFIED DIAGNOSTIC LAB REPORTS & FILES SECTION                     */}
            {/* (NO SEPARATE PORTAL: FILE CHECKING & REPORTS DIRECTLY INTEGRATED HERE)*/}
            {/* ===================================================================== */}
            {(isLabClinic || labReports.length > 0) && (
              <div className="liquid-glass-elevated rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      Diagnostic Lab Reports & Files
                    </h4>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      effectiveLabStatus === 'prepared'
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                        : effectiveLabStatus === 'processing'
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20'
                        : 'bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/20'
                    }`}
                  >
                    {effectiveLabStatus === 'prepared'
                      ? 'PREPARED'
                      : effectiveLabStatus === 'processing'
                      ? 'PROCESSING'
                      : 'LIVE QUEUE'}
                  </span>
                </div>

                {effectiveLabStatus === 'prepared' ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl liquid-glass-subtle border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
                      <div className="font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Certified Diagnostic Report Prepared</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        {isReportIdentityVerified
                          ? `✓ Identity verified (${appointment.patientName}). Access and download your digital report below.`
                          : '🔒 Confidential medical report. Verify patient name or mobile number to view or download file.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleActionWithAuth('view_report')}
                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-glass-sm active:scale-95 border-t border-white/20"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isReportIdentityVerified ? 'View Report In-App' : 'Verify & View Report'}</span>
                      </button>

                      <button
                        onClick={() => handleActionWithAuth('download_report')}
                        className="py-2.5 px-4 liquid-glass-subtle text-teal-700 dark:text-teal-300 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                ) : effectiveLabStatus === 'processing' ? (
                  <div className="p-4 rounded-2xl liquid-glass-subtle border-amber-500/30 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Hourglass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Sample Collected • Processing in Laboratory</span>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Your biological sample has been received and transferred to the diagnostic chamber. As soon as the certified pathologist signs off, this screen will transition to Prepared and unlock the report file.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl liquid-glass-subtle border-teal-500/30 text-xs text-teal-900 dark:text-teal-300 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>Waiting in Queue for Sample Collection</span>
                    </div>
                    <p className="text-[11px] text-teal-700 dark:text-teal-400">
                      Please present your token #{appointment.queueNumber || 1} at the phlebotomy collection counter.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 10. RESCHEDULE & CANCEL ACTIONS */}
            {!isConsultancyCompleted ? (
              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  onClick={() => handleActionWithAuth('reschedule')}
                  className="font-bold text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer flex items-center space-x-1 active:scale-95"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reschedule Visit</span>
                </button>

                <button
                  onClick={() => handleActionWithAuth('cancel')}
                  className="font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer active:scale-95"
                >
                  Cancel Appointment
                </button>
              </div>
            ) : appointment?.clinicId ? (
              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('clinic-detail', {
                        clinicId: appointment.clinicId,
                        doctorId: appointment.doctorId,
                        trackingCode: appointment.trackingCode10Digit,
                        isReschedule: false,
                      })
                    }
                  }}
                  className="font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 transition cursor-pointer flex items-center space-x-1.5 active:scale-95 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Book Free Follow-Up Visit</span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECURITY VERIFICATION MODAL                                               */}
      {/* ========================================================================= */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400" />
                <span>Patient Identity Verification</span>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              For privacy and medical data protection, please confirm the registered Patient's Full Name or Mobile Number.
            </p>

            <form onSubmit={handleVerifySubmit} className="space-y-3">
              <input
                type="text"
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
                placeholder="Enter Patient Name or Mobile..."
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 liquid-glass-input rounded-xl font-bold text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />

              {verifyError && (
                <p className="text-xs text-rose-600 font-bold">{verifyError}</p>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerificationModal(false)}
                  className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold liquid-glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/80 cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-xl text-xs font-bold shadow-glass-sm cursor-pointer active:scale-95 border-t border-white/20"
                >
                  Verify & Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP LAB REPORT FILE VIEWER MODAL                                       */}
      {/* ========================================================================= */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="liquid-glass-modal rounded-3xl max-w-2xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {selectedReportToView?.testName || 'Diagnostic Pathology Report'}
                </h3>
                <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
                  Patient: {appointment?.patientName} • Token #{appointment?.queueNumber || 1}
                </span>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedReportToView?.reportFileUrl ? (
              <div className="space-y-3">
                <div className="p-3.5 sm:p-4 liquid-glass-subtle rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Official Signed Lab Report
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                        File Type: PDF / Digital Image
                      </span>
                    </div>
                  </div>
                  <a
                    href={selectedReportToView.reportFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 shadow-glass-sm active:scale-95 border-t border-white/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                </div>

                <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-200/50 dark:border-white/10 bg-slate-900/20 flex items-center justify-center">
                  <iframe
                    src={selectedReportToView.reportFileUrl}
                    title="Lab Report Document"
                    className="w-full h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 text-center space-y-2 liquid-glass-subtle rounded-2xl">
                <FileText className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-teal-600 dark:text-teal-400" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Diagnostic Report Prepared in Center
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Your physical certified test report is prepared and signed by the pathologist at {clinic?.name || 'the clinic desk'}. A digital scan will synchronize directly to this portal.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRESCRIPTION & BILL MODAL                                                 */}
      {/* ========================================================================= */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="liquid-glass-modal rounded-3xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Prescription & Billing Receipt
                </h3>
              </div>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 liquid-glass-subtle rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span>Patient Name:</span>
                  <span>{appointment?.patientName}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Facility:</span>
                  <span>{clinic?.name || 'OPD Clinic'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Attending Doctor:</span>
                  <span>{doctor?.fullName || 'OPD Specialist'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Visit Date:</span>
                  <span>{appointment?.appointmentDate}</span>
                </div>
              </div>

              <div className="p-3 liquid-glass-subtle border-emerald-500/30 text-emerald-900 dark:text-emerald-300 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-sm">
                  <span>Total Consultation Fee:</span>
                  <span>NPR {appointment?.feeAmount || 500}</span>
                </div>
                <div className="flex justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
                  <span>Payment Status:</span>
                  <span className="font-bold uppercase">{appointment?.paymentStatus || 'Paid'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl text-xs font-bold shadow-glass-sm cursor-pointer active:scale-95 border-t border-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESCHEDULE DATE MODAL                                                     */}
      {/* ========================================================================= */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/10 pb-3">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Reschedule Consultation</h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Select New Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3.5 sm:px-4 py-2.5 liquid-glass-input rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              {rescheduleMsg && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">{rescheduleMsg}</p>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-3.5 sm:px-4 py-2 text-xs font-bold liquid-glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-xl cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleProcessing}
                  className="px-4 sm:px-5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-xs font-bold rounded-xl shadow-glass-sm cursor-pointer active:scale-95 border-t border-white/20"
                >
                  {rescheduleProcessing ? 'Saving...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
