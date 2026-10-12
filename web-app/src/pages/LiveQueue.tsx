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
} from 'lucide-react'
import { Appointment, Clinic, Doctor, LabReport, BillingInvoice } from '../types'
import {
  getAppointmentByTrackingCode,
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
}

export const LiveQueue: React.FC<LiveQueueProps> = ({
  initialCode = '',
  onOpenReportModal,
  onNavigateHome,
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

  // Main data loader by 10-digit code
  const fetchQueueData = async (targetCode: string, silent = false) => {
    const clean = targetCode.trim().replace(/\D/g, '')
    if (!clean) return
    if (!silent) setLoading(true)
    setErrorMsg('')

    try {
      const appt = await getAppointmentByTrackingCode(clean)
      setAppointment(appt)

      if (appt) {
        // Fetch clinic details
        if (appt.clinicId) {
          const [clinicData, queueList, reportsData] = await Promise.all([
            getClinicById(appt.clinicId),
            getAppointmentsByClinic(appt.clinicId, appt.appointmentDate),
            getLabReportsByTrackingCode(clean),
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
        if (!silent) setErrorMsg(`No booking record found for 10-digit code #${clean}.`)
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
    const clean = inputCode.trim().replace(/\D/g, '')
    if (clean.length < 5) {
      setErrorMsg('Please enter a valid 10-digit tracking code.')
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
        setRescheduleDate(appointment?.appointmentDate || '')
        setRescheduleTime(appointment?.appointmentTime || '10:00 AM')
        setShowRescheduleModal(true)
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
        setRescheduleDate(appointment?.appointmentDate || '')
        setRescheduleTime(appointment?.appointmentTime || '10:00 AM')
        setShowRescheduleModal(true)
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

  // Formatted expected call time
  const formattedExpectedTime = useMemo(() => {
    if (patientsAhead === 0) return 'Next in line'
    try {
      const now = new Date()
      now.setMinutes(now.getMinutes() + estimatedWaitMinutes)
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return `~${estimatedWaitMinutes} mins`
    }
  }, [patientsAhead, estimatedWaitMinutes])

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-16">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: DEEP MEDICAL TEAL (#0D5C4D) MATCHING QueueStatusScreen.kt  */}
      {/* ========================================================================= */}
      <div className="w-full bg-[#0D5C4D] text-white pt-8 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Top Brand Capsule Pill + Refresh Action */}
          <div className="flex items-center justify-between">
            <div className="px-3.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-xs tracking-wide">
              {clinic?.name || 'Dactor • Healthcare Ecosystem'}
            </div>

            <button
              onClick={() => fetchQueueData(activeCode)}
              disabled={loading}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
              title="Refresh live queue status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Title Row with Back Button */}
          <div className="flex items-center space-x-3 pt-1">
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition cursor-pointer"
                title="Back to home"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Live Queue Position</h1>
              <p className="text-xs text-white/80 font-medium">Your health, our priority</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OVERLAPPING CONTENT CONTAINER (Negative offset over Teal Header)        */}
      {/* ========================================================================= */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 space-y-5">
        {/* Search Input Bar (If not loaded or searching another code) */}
        <div className="bg-white rounded-3xl p-2.5 border border-slate-200/90 shadow-md">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-[#0D5C4D] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter 10-Digit Tracking Code..."
                maxLength={10}
                className="w-full pl-11 pr-4 py-2.5 bg-transparent text-base sm:text-lg font-black tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-[#0D5C4D] hover:bg-[#0a483c] text-white text-xs font-bold rounded-2xl shadow-md transition cursor-pointer shrink-0"
            >
              {loading ? 'Tracking...' : 'Track'}
            </button>
          </form>

          {errorMsg && (
            <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center space-x-2">
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
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    BOOKING CODE
                  </span>
                  <div className="text-lg font-black text-slate-900 tracking-wider font-mono">
                    #{appointment.trackingCode10Digit}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCopyCode}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
                title="Copy code to clipboard"
              >
                {copyFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
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
              <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-center space-x-3 text-rose-900 shadow-xs">
                <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                  <PauseCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-800">
                    CLINIC IS CURRENTLY ON BREAK
                  </h4>
                  <p className="text-xs text-rose-700">
                    Consultations are paused temporarily. They will resume shortly.
                  </p>
                </div>
              </div>
            )}

            {/* 3. DOCTOR PRESENCE / AWAY BANNER */}
            {!isConsultancyCompleted && !isLabClinic && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center space-x-2.5 ${
                  isDoctorInClinic
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
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
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              {/* Top Token Row: Position Circle + Dynamic Title */}
              <div className="flex items-center space-x-4">
                {/* Circular Position Badge with Outer Halo Ring */}
                <div className="relative flex items-center justify-center shrink-0">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center ${
                      isInsideChamber
                        ? 'bg-blue-100'
                        : isConsultancyCompleted
                        ? 'bg-emerald-100'
                        : patientsAhead === 0
                        ? 'bg-emerald-100'
                        : 'bg-sky-100'
                    }`}
                  >
                    <div
                      className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-white shadow-sm ${
                        isInsideChamber
                          ? 'bg-blue-600'
                          : isConsultancyCompleted
                          ? 'bg-emerald-600'
                          : patientsAhead === 0
                          ? 'bg-emerald-600'
                          : 'bg-[#0284C7]'
                      }`}
                    >
                      <span className="text-[8px] font-black uppercase tracking-wider opacity-90 leading-tight">
                        {isInsideChamber
                          ? 'CURRENT'
                          : isConsultancyCompleted
                          ? 'VISIT'
                          : patientsAhead === 0
                          ? 'UP NEXT'
                          : 'POSITION'}
                      </span>
                      <span className="text-2xl font-black leading-none mt-0.5">
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
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-lg sm:text-xl font-black ${
                        isLabClinic && effectiveLabStatus === 'prepared'
                          ? 'text-emerald-700'
                          : isLabClinic && effectiveLabStatus === 'processing'
                          ? 'text-amber-700'
                          : isInsideChamber
                          ? 'text-blue-700'
                          : isConsultancyCompleted
                          ? 'text-emerald-700'
                          : 'text-slate-900'
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

                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                      Token #{appointment.queueNumber || 1}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-medium">
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
                      : patientsAhead === 0
                      ? '0 patients ahead • Please stay close to the consultation cabin'
                      : `${patientsAhead} ahead in line • Est. wait: ~${estimatedWaitMinutes} mins`}
                  </p>
                </div>
              </div>

              {/* 4-Step Stepper Progress Bar */}
              <div className="py-2">
                <div className="flex items-center justify-between relative">
                  {/* Connecting line behind */}
                  <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />

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
                        className="flex flex-col items-center space-y-1.5 z-10 bg-white px-2"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                            isDone || isActive
                              ? 'bg-[#0D5C4D] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                        >
                          {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>
                        <span
                          className={`text-[11px] font-bold ${
                            isActive ? 'text-[#0D5C4D]' : 'text-slate-500'
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Your Booked Window
                    </span>
                    <div className="text-base font-black text-slate-900">
                      {appointment.appointmentTime || 'Real-time queue'}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Date: {appointment.appointmentDate}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                      Expected Call
                    </span>
                    <div className="text-base font-black text-sky-900">
                      {patientsAhead > 0 ? `~${estimatedWaitMinutes} mins` : '< 5 mins'}
                    </div>
                    <span className="text-[11px] text-sky-700">
                      {patientsAhead > 0 ? `Approx. ${formattedExpectedTime}` : "You're next in line"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. CLINIC & DOCTOR PROFILE CARD (Call, Directions & Roster) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              {/* Clinic Information */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      HEALTHCARE FACILITY
                    </span>
                    <h4 className="text-base font-black text-slate-900">
                      {clinic?.name || appointment.clinic?.name || 'OPD Medical Center'}
                    </h4>
                  </div>
                </div>

                <div className="flex items-start space-x-2 text-xs text-slate-600 pl-1">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{clinic?.addressText || 'Nepal'}</span>
                </div>

                {/* Call Clinic & Google Maps Directions Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <a
                    href={`tel:${clinic?.contactPhone || clinic?.managerPhone || '01-4412345'}`}
                    className="py-2.5 px-3 rounded-xl border border-[#0D5C4D] text-[#0D5C4D] hover:bg-teal-50 text-xs font-bold transition flex items-center justify-center space-x-1.5"
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
                    className="py-2.5 px-3 rounded-xl border border-[#0D5C4D] text-[#0D5C4D] hover:bg-teal-50 text-xs font-bold transition flex items-center justify-center space-x-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>

              {/* Attending Doctor Profile (If applicable) */}
              {doctor && (
                <div className="pt-4 border-t border-slate-100 flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#CCFBF1] text-[#0D5C4D] flex items-center justify-center font-black text-lg shrink-0 overflow-hidden">
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      ATTENDING DOCTOR
                    </span>
                    <h5 className="font-bold text-slate-900 text-sm">
                      {doctor.fullName.startsWith('Dr.') ? doctor.fullName : `Dr. ${doctor.fullName}`}
                    </h5>
                    <p className="text-xs font-semibold text-teal-700">
                      {doctor.specialty || 'General OPD Specialist'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {doctor.education ? `${doctor.education} • ` : ''}
                      Consultation for general health & OPD
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 6. BOOKED DIAGNOSTIC LAB TESTS CARD (If applicable) */}
            {Boolean(appointment.selectedTests && appointment.selectedTests.length > 0) && (
              <div className="bg-purple-50/70 border border-purple-200 rounded-3xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
                  <FlaskConical className="w-4 h-4 text-purple-600" />
                  <span>Booked Diagnostic Lab Investigations</span>
                </div>
                <p className="text-xs font-bold text-purple-950">
                  {appointment.selectedTests?.join(', ')}
                </p>
              </div>
            )}

            {/* 7. ACTIVE IN-CHAMBER OPD CONSULTATION TIMER BANNER */}
            {isInsideChamber && (
              <div className="bg-blue-50 border-2 border-blue-500 rounded-3xl p-5 space-y-2 text-blue-900">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-blue-800">
                    Active Consultation Session in Progress
                  </span>
                </div>
                <p className="text-xs font-bold text-blue-950">
                  Please step into the consultation room and discuss your symptoms with the attending specialist.
                </p>
              </div>
            )}

            {/* 8. CONSULTATION COMPLETED & PRESCRIPTION / BILL READY */}
            {isConsultancyCompleted && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-black text-sm">Consultation Finished & Bill Ready</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                    COMPLETED
                  </span>
                </div>

                <p className="text-xs text-emerald-800 font-medium">
                  Total Bill: NPR {appointment.feeAmount || 500} • Status: {appointment.paymentStatus === 'paid' ? 'Paid' : 'Settled at Reception'}
                </p>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
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
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <FileText className="w-5 h-5 text-teal-600" />
                    <h4 className="text-sm font-black text-slate-900">
                      Diagnostic Lab Reports & Files
                    </h4>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      effectiveLabStatus === 'prepared'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : effectiveLabStatus === 'processing'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-sky-100 text-sky-800 border border-sky-200'
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
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <div className="font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Certified Diagnostic Report Prepared</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        {isReportIdentityVerified
                          ? `✓ Identity verified (${appointment.patientName}). Access and download your digital report below.`
                          : '🔒 Confidential medical report. Verify patient name or mobile number to view or download file.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleActionWithAuth('view_report')}
                        className="flex-1 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isReportIdentityVerified ? 'View Report In-App' : 'Verify & View Report'}</span>
                      </button>

                      <button
                        onClick={() => handleActionWithAuth('download_report')}
                        className="py-2.5 px-4 border border-teal-700 text-teal-700 hover:bg-teal-50 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                ) : effectiveLabStatus === 'processing' ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Hourglass className="w-4 h-4 text-amber-600" />
                      <span>Sample Collected • Processing in Laboratory</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      Your biological sample has been received and transferred to the diagnostic chamber. As soon as the certified pathologist signs off, this screen will transition to Prepared and unlock the report file.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <FlaskConical className="w-4 h-4 text-sky-600" />
                      <span>Waiting in Queue for Sample Collection</span>
                    </div>
                    <p className="text-[11px] text-sky-700">
                      Please present your token #{appointment.queueNumber || 1} at the phlebotomy collection counter.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 10. RESCHEDULE & CANCEL ACTIONS */}
            {!isConsultancyCompleted && (
              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  onClick={() => handleActionWithAuth('reschedule')}
                  className="font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer flex items-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reschedule Visit</span>
                </button>

                <button
                  onClick={() => handleActionWithAuth('cancel')}
                  className="font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                >
                  Cancel Appointment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECURITY VERIFICATION MODAL                                               */}
      {/* ========================================================================= */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-base">
                <Lock className="w-5 h-5 text-[#0D5C4D]" />
                <span>Patient Identity Verification</span>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              For privacy and medical data protection, please confirm the registered Patient's Full Name or Mobile Number.
            </p>

            <form onSubmit={handleVerifySubmit} className="space-y-3">
              <input
                type="text"
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
                placeholder="Enter Patient Name or Mobile..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C4D]"
              />

              {verifyError && (
                <p className="text-xs text-rose-600 font-bold">{verifyError}</p>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerificationModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#0D5C4D] hover:bg-[#0a483c] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {selectedReportToView?.testName || 'Diagnostic Pathology Report'}
                </h3>
                <span className="text-xs text-slate-400">
                  Patient: {appointment?.patientName} • Token #{appointment?.queueNumber || 1}
                </span>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedReportToView?.reportFileUrl ? (
              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-teal-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Official Signed Lab Report
                      </span>
                      <span className="text-[11px] text-slate-500">
                        File Type: PDF / Digital Image
                      </span>
                    </div>
                  </div>
                  <a
                    href={selectedReportToView.reportFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="px-4 py-2 bg-[#0D5C4D] hover:bg-[#0a483c] text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                </div>

                <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                  <iframe
                    src={selectedReportToView.reportFileUrl}
                    title="Lab Report Document"
                    className="w-full h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                <FileText className="w-10 h-10 mx-auto text-teal-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  Diagnostic Report Prepared in Center
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">
                  Prescription & Billing Receipt
                </h3>
              </div>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Patient Name:</span>
                  <span>{appointment?.patientName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Facility:</span>
                  <span>{clinic?.name || 'OPD Clinic'}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Attending Doctor:</span>
                  <span>{doctor?.fullName || 'OPD Specialist'}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Visit Date:</span>
                  <span>{appointment?.appointmentDate}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                <div className="flex justify-between font-bold text-sm">
                  <span>Total Consultation Fee:</span>
                  <span>NPR {appointment?.feeAmount || 500}</span>
                </div>
                <div className="flex justify-between text-[11px] text-emerald-700">
                  <span>Payment Status:</span>
                  <span className="font-bold uppercase">{appointment?.paymentStatus || 'Paid'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Reschedule Consultation</h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Select New Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#0D5C4D]"
                  required
                />
              </div>

              {rescheduleMsg && (
                <p className="text-xs text-emerald-700 font-bold">{rescheduleMsg}</p>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleProcessing}
                  className="px-5 py-2 bg-[#0D5C4D] hover:bg-[#0a483c] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
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
