import React, { useState } from 'react'
import {
  X,
  Search,
  Activity,
  CheckCircle2,
  Clock,
  Building2,
  User,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Copy,
} from 'lucide-react'
import { getAppointmentByTrackingCode } from '../services/db'
import { Appointment } from '../types'
import dactorLogo from '../assets/logo.png'

interface LiveTrackerModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenFullQueue: (trackingCode: string) => void
}

export const LiveTrackerModal: React.FC<LiveTrackerModalProps> = ({
  isOpen,
  onClose,
  onOpenFullQueue,
}) => {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [searched, setSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const clean = code.trim().replace(/\D/g, '')
    if (clean.length < 5) {
      setErrorMsg('Please enter a valid tracking code.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    try {
      const data = await getAppointmentByTrackingCode(clean)
      setAppointment(data)
      setSearched(true)
      if (!data) {
        setErrorMsg('No appointment found with this code. Please verify and try again.')
      }
    } catch {
      setErrorMsg('Failed to check queue status. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_consultation':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
            <Activity className="w-3.5 h-3.5 mr-1" />
            Inside Doctor's Cabin
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Consultation Completed
          </span>
        )
      case 'waiting':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-100 text-brand-800">
            <Clock className="w-3.5 h-3.5 mr-1" />
            In Waiting Queue
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status.toUpperCase()}
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-md animate-in fade-in duration-200">
      <div className="liquid-glass-modal rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-glass-modal border border-white/80 relative max-h-[92vh] overflow-y-auto">
        {/* Specular Perimeter Line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] rounded-t-3xl bg-gradient-to-r from-transparent via-white/80 to-transparent" aria-hidden="true" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 bg-white/60 hover:bg-white/90 border border-white/60 rounded-full transition-colors cursor-pointer shadow-glass-sm"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5 sm:mb-6 pr-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-brand-50/80 text-brand-600 flex items-center justify-center border border-brand-200/50 shadow-glass-sm backdrop-blur-md shrink-0">
            <img src={dactorLogo} alt="Dactor" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Live OPD Queue Tracker</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              Enter your 10-digit appointment code to see live queue position
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSearch} className="space-y-3 sm:space-y-4">
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 9812345678"
              maxLength={10}
              className="w-full px-4 py-3 sm:py-3.5 pl-11 text-base sm:text-lg font-bold tracking-widest text-slate-900 liquid-glass-input rounded-2xl transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 font-mono shadow-glass-sm"
              autoFocus
            />
            <Search className="w-5 h-5 text-brand-600 absolute left-3.5 top-3.5 sm:top-4" />
          </div>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-brand-600 via-sky-600 to-cyan-500 hover:brightness-105 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-glass-brand border border-white/30 flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] text-xs sm:text-sm"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span>Checking Live Queue...</span>
              </span>
            ) : (
              <span>Check Live Status</span>
            )}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-3 sm:mt-4 p-3 bg-rose-50/80 border border-rose-200/70 text-rose-700 rounded-xl text-xs flex items-center space-x-2 backdrop-blur-md shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Result Card (Matches Real App 09b_live_queue_tracker.png) */}
        {searched && appointment && (
          <div className="mt-4 sm:mt-6 p-4 sm:p-5 liquid-glass-base border border-white/80 rounded-2xl sm:rounded-3xl space-y-3.5 sm:space-y-4 animate-in slide-in-from-bottom duration-200 shadow-glass-md">
            {/* Real App Token Circle Header */}
            <div className="text-center py-1 sm:py-2 space-y-1.5 sm:space-y-2">
              <div className="inline-flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-brand-600 via-sky-500 to-cyan-400 text-white shadow-glass-brand border border-white/40">
                <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-cyan-100">TOKEN</span>
                <span className="text-xl sm:text-2xl font-black">#{(appointment as any).queuePosition || 1}</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-800">
                You are in Live OPD Queue
              </h4>
              <div className="inline-block px-3 py-1 rounded-full bg-brand-50/80 text-brand-900 border border-brand-200/60 font-mono font-bold text-[11px] sm:text-xs backdrop-blur-xs break-all">
                10-DIGIT CODE: {appointment.trackingCode10Digit}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
              <span className="text-xs text-slate-500 font-medium">Status</span>
              <div>{getStatusBadge(appointment.checkinStatus)}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1 text-xs">
              <div>
                <span className="text-slate-400 font-medium text-[11px]">Patient</span>
                <p className="font-bold text-slate-800 text-xs sm:text-sm">{appointment.patientName}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px]">Clinic</span>
                <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                  {appointment.clinic?.name || 'OPD Clinic'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px]">Doctor</span>
                <p className="font-bold text-slate-800 text-xs sm:text-sm">
                  {appointment.doctor?.fullName || 'Assigned Specialist'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium text-[11px]">Slot Time</span>
                <p className="font-bold text-slate-800 text-xs sm:text-sm">
                  {appointment.appointmentDate} • {appointment.appointmentTime}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose()
                onOpenFullQueue(appointment.trackingCode10Digit)
              }}
              className="w-full mt-2 py-3 bg-gradient-to-r from-slate-900 to-brand-900 hover:from-brand-600 hover:to-cyan-600 text-white text-xs font-bold rounded-xl sm:rounded-2xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-glass-sm border border-white/20 active:scale-[0.98]"
            >
              <span>View Full Live Queue Board</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
