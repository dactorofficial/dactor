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
} from 'lucide-react'
import { getAppointmentByTrackingCode } from '../services/db'
import { Appointment } from '../types'

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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">Live OPD Queue Tracker</h3>
            <p className="text-xs text-slate-500 font-medium">
              Enter your 10-digit appointment code to see live queue position
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 9812345678"
              maxLength={10}
              className="w-full px-4 py-3.5 pl-11 text-lg font-bold tracking-widest text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              autoFocus
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-4" />
          </div>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-2xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <Activity className="w-5 h-5 animate-spin" />
                <span>Checking Live Queue...</span>
              </span>
            ) : (
              <span>Check Live Status</span>
            )}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Result Card */}
        {searched && appointment && (
          <div className="mt-6 p-5 bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-emerald-100 rounded-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Tracking Code
                </span>
                <p className="text-base font-black text-slate-900 font-mono tracking-wider">
                  #{appointment.trackingCode10Digit}
                </p>
              </div>
              <div>{getStatusBadge(appointment.checkinStatus)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Patient Name</span>
                <p className="font-bold text-slate-800 text-sm">{appointment.patientName}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Clinic</span>
                <p className="font-bold text-slate-800 text-sm truncate">
                  {appointment.clinic?.name || 'OPD Clinic'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Doctor</span>
                <p className="font-bold text-slate-800 text-sm">
                  {appointment.doctor?.fullName || 'Assigned Specialist'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Date & Time</span>
                <p className="font-bold text-slate-800 text-sm">
                  {appointment.appointmentDate} • {appointment.appointmentTime}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose()
                onOpenFullQueue(appointment.trackingCode10Digit)
              }}
              className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center space-x-2"
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
