import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Appointment } from '../types'
import { getAppointmentByTrackingCode, getAppointmentsByClinic } from '../services/db'

interface LiveQueueProps {
  initialCode?: string
  onOpenReportModal: (code: string) => void
}

export const LiveQueue: React.FC<LiveQueueProps> = ({
  initialCode = '',
  onOpenReportModal,
}) => {
  const [code, setCode] = useState(initialCode)
  const [activeCode, setActiveCode] = useState(initialCode)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [clinicQueue, setClinicQueue] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchQueueData = async (targetCode: string) => {
    if (!targetCode) return
    setLoading(true)
    setErrorMsg('')
    try {
      const appt = await getAppointmentByTrackingCode(targetCode)
      setAppointment(appt)
      if (appt) {
        // Fetch all appointments for today at this clinic
        const list = await getAppointmentsByClinic(appt.clinicId, appt.appointmentDate)
        setClinicQueue(list)
      } else {
        setErrorMsg('No appointment found for this tracking code.')
      }
    } catch {
      setErrorMsg('Failed to update live queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeCode) {
      fetchQueueData(activeCode)
    }
  }, [activeCode])

  // Polling for live real-time updates every 10 seconds
  useEffect(() => {
    if (!autoRefresh || !activeCode) return
    const interval = setInterval(() => {
      fetchQueueData(activeCode)
    }, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, activeCode])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = code.trim().replace(/\D/g, '')
    if (clean.length < 5) {
      setErrorMsg('Please enter a valid tracking code.')
      return
    }
    setActiveCode(clean)
  }

  // Calculate patients ahead
  const waitingPatients = clinicQueue.filter((a) => a.checkinStatus === 'waiting')
  const inConsultationPatient = clinicQueue.find((a) => a.checkinStatus === 'in_consultation')
  
  // Position calculation
  let patientsAhead = 0
  if (appointment && appointment.checkinStatus === 'waiting') {
    const myIndex = waitingPatients.findIndex((a) => a.id === appointment.id)
    patientsAhead = myIndex >= 0 ? myIndex : 0
    if (inConsultationPatient) {
      patientsAhead += 1
    }
  }

  const estimatedMinutes = Math.max(0, patientsAhead * 8)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-bold uppercase tracking-wider">
          <Activity className="w-3.5 h-3.5 text-brand-600 animate-pulse" />
          <span>Real-Time Queue Telemetry</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Live OPD Queue Tracker
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Enter any 10-digit code to view live doctor cabin status, current token, and estimated wait.
        </p>
      </div>

      {/* Code Search Input Bar */}
      <div className="max-w-xl mx-auto">
        <form
          onSubmit={handleSearch}
          className="p-2 bg-white rounded-3xl border border-slate-200/80 shadow-md flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 10-Digit Tracking Code..."
              maxLength={10}
              className="w-full px-4 py-3 pl-11 text-lg font-black tracking-wider text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal"
            />
            <Search className="w-5 h-5 text-brand-600 absolute left-3.5 top-3.5" />
          </div>
          <button
            type="submit"
            className="px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md shadow-brand-600/20 transition-all shrink-0"
          >
            Track
          </button>
        </form>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Live Board Display */}
      {appointment && (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
          {/* Top Status Bar with Auto-Refresh */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center space-x-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping inline-block" />
              <span>Live Synced with OPD Desk</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => fetchQueueData(activeCode)}
                className="flex items-center space-x-1 text-brand-700 hover:underline font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Now</span>
              </button>
            </div>
          </div>

          {/* Alert Banner if currently IN CONSULTATION */}
          {appointment.checkinStatus === 'in_consultation' && (
            <div className="p-6 bg-gradient-to-r from-amber-500 to-brand-600 text-white rounded-3xl shadow-xl flex items-center space-x-4 animate-bounce">
              <BellRing className="w-10 h-10 shrink-0" />
              <div>
                <h3 className="text-xl font-black">YOUR TURN IS NOW!</h3>
                <p className="text-xs font-semibold text-brand-100">
                  Doctor is currently seeing you in consultation cabin. Please step inside.
                </p>
              </div>
            </div>
          )}

          {/* Main Status Hero Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Column 1: Your Token & Status */}
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Your Tracking Code
              </span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-wider">
                #{appointment.trackingCode10Digit}
              </div>
              <div className="pt-2">
                {appointment.checkinStatus === 'in_consultation' ? (
                  <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-900">
                    Currently Inside Cabin
                  </span>
                ) : appointment.checkinStatus === 'completed' ? (
                  <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black bg-brand-100 text-brand-800">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Consultation Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                    <Clock className="w-4 h-4 mr-1" />
                    In Waiting Queue
                  </span>
                )}
              </div>
            </div>

            {/* Column 2: Patients Ahead & Estimated Time */}
            <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Position in Line
              </span>
              <div className="text-4xl font-black text-brand-600">
                {appointment.checkinStatus === 'completed'
                  ? '0'
                  : `${patientsAhead} Ahead`}
              </div>
              <p className="text-xs text-slate-500 font-medium pt-1">
                {appointment.checkinStatus === 'completed'
                  ? 'Session finished'
                  : `Estimated wait: ~${estimatedMinutes} mins`}
              </p>
            </div>

            {/* Column 3: Patient & Clinic Details */}
            <div className="space-y-3 text-xs border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
              <div>
                <span className="text-slate-400 font-medium">Patient Name</span>
                <p className="font-bold text-slate-900 text-sm">{appointment.patientName}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Healthcare Facility</span>
                <p className="font-bold text-slate-900 truncate">
                  {appointment.clinic?.name || 'Central OPD Clinic'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Attending Doctor</span>
                <p className="font-bold text-slate-900">
                  {appointment.doctor?.fullName || 'Assigned Specialist'}
                </p>
              </div>
            </div>
          </div>

          {/* Diagnostic Lab Tests Strip (if applicable) */}
          {appointment.selectedTests && appointment.selectedTests.length > 0 && (
            <div className="bg-teal-50/70 border border-teal-200 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Diagnostic Lab Tests Associated
                  </h4>
                  <p className="text-xs text-slate-600">
                    Tests: {appointment.selectedTests.join(', ')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onOpenReportModal(appointment.trackingCode10Digit)}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs flex items-center space-x-1.5"
              >
                <span>Track 3-Stage Lab Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
