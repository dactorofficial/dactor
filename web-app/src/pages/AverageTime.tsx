import React, { useState, useEffect } from 'react'
import {
  Clock,
  Activity,
  Users,
  Building2,
  MapPin,
  ArrowRight,
  RefreshCw,
  Stethoscope,
} from 'lucide-react'
import { Clinic, Doctor, Appointment } from '../types'
import { getClinics, getDoctors, getAppointmentsByClinic } from '../services/db'
import { supabase } from '../lib/supabase'

interface AverageTimeProps {
  onSelectClinic?: (clinicId: string) => void
}

interface ClinicWaitTelemetry {
  clinic: Clinic
  doctors: Doctor[]
  waitingCount: number
  insideCount: number
  completedTodayCount: number
  avgMinutesPerPatient: number
  estimatedNewTokenWaitMins: number
}

export const AverageTime: React.FC<AverageTimeProps> = ({ onSelectClinic }) => {
  const [telemetry, setTelemetry] = useState<ClinicWaitTelemetry[]>([])
  const [loading, setLoading] = useState(true)

  const loadLiveTelemetry = async () => {
    setLoading(true)
    try {
      const todayIso = new Date().toISOString().split('T')[0]
      const [clinicsList, doctorsList] = await Promise.all([getClinics(), getDoctors()])
      const activeClinics = clinicsList.filter((c) => !c.isArchived)

      const entries: ClinicWaitTelemetry[] = await Promise.all(
        activeClinics.map(async (c) => {
          const appts: Appointment[] = await getAppointmentsByClinic(c.id, todayIso)
          const waitingCount = appts.filter((a) => a.checkinStatus === 'waiting').length
          const insideCount = appts.filter((a) => a.checkinStatus === 'in_consultation').length
          const completedTodayCount = appts.filter((a) => a.checkinStatus === 'completed').length
          const clinicDocs = doctorsList.filter(
            (d) => d.clinicId === c.id || d.activeClinicId === c.id
          )
          const avgMins =
            c.avgTimeMode === 'manual'
              ? c.manualAvgConsultationTimeMinutes || c.avgConsultationTimeMinutes || 10
              : c.calculatedAvgConsultationTimeMinutes || c.avgConsultationTimeMinutes || 10

          return {
            clinic: c,
            doctors: clinicDocs,
            waitingCount,
            insideCount,
            completedTodayCount,
            avgMinutesPerPatient: avgMins,
            estimatedNewTokenWaitMins: waitingCount * avgMins + (c.isOnBreak ? 20 : 0),
          }
        })
      )

      setTelemetry(entries)
    } catch (err) {
      console.error('Error loading live wait telemetry:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLiveTelemetry()

    const channel = supabase
      .channel('avg-wait-time-telemetry')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinics' }, () => loadLiveTelemetry())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => loadLiveTelemetry())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadLiveTelemetry())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => loadLiveTelemetry())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalWaitingAllClinics = telemetry.reduce((acc, t) => acc + t.waitingCount, 0)
  const totalDoctorsInClinicNow = telemetry.reduce(
    (acc, t) => acc + t.doctors.filter((d) => d.isInClinic).length,
    0
  )
  const overallAvgMins =
    telemetry.length > 0
      ? Math.round(
          telemetry.reduce((acc, t) => acc + t.avgMinutesPerPatient, 0) / telemetry.length
        )
      : 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-brand-600" />
            <span>Live Supabase Queue Telemetry</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Real-Time Clinic Wait Times & Queue Speed
          </h1>
          <p className="text-sm text-slate-500 font-medium max-w-2xl">
            Live consultation speed, waiting queue length, break status, and doctor physical presence synced directly from Supabase.
          </p>
        </div>

        <button
          onClick={loadLiveTelemetry}
          className="self-start sm:self-auto px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center space-x-2 shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-brand-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Telemetry</span>
        </button>
      </div>

      {/* 3 Live Aggregate Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="text-3xl font-black text-slate-900">
            {telemetry.length > 0 ? `${overallAvgMins} min` : '—'}
          </div>
          <h3 className="text-base font-bold text-slate-900">Live Avg Consultation Time</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Calculated across {telemetry.length} registered clinic{telemetry.length === 1 ? '' : 's'} in Supabase.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Stethoscope className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="text-3xl font-black text-slate-900">{totalDoctorsInClinicNow}</div>
          <h3 className="text-base font-bold text-slate-900">Doctors Physically in Clinic Now</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Real-time physical presence toggled by doctors and clinic desks.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Users className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="text-3xl font-black text-slate-900">{totalWaitingAllClinics}</div>
          <h3 className="text-base font-bold text-slate-900">Patients Currently Waiting Today</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Live queue count across all active OPD and diagnostic centers today.
          </p>
        </div>
      </div>

      {/* Live Per-Clinic Wait Time Breakdown */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900">
          Per-Clinic Live Queue & Consultation Pace
        </h2>

        {loading && telemetry.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : telemetry.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Active Clinics in Database</h3>
            <p className="text-xs text-slate-500">
              Clinics registered in Supabase will display their live queue speed and wait telemetry here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {telemetry.map((item) => {
              const {
                clinic,
                doctors,
                waitingCount,
                insideCount,
                completedTodayCount,
                avgMinutesPerPatient,
                estimatedNewTokenWaitMins,
              } = item
              const docsInClinic = doctors.filter((d) => d.isInClinic)

              return (
                <div
                  key={clinic.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">{clinic.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{clinic.addressText || 'Nepal'}</span>
                        </p>
                      </div>

                      {clinic.isOnBreak ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          On Break
                        </span>
                      ) : docsInClinic.length > 0 ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          Doctor In Clinic
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Open
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-2xl bg-brand-50/70 border border-brand-100">
                        <span className="text-[10px] font-bold uppercase text-brand-700 block">
                          Avg Time / Patient
                        </span>
                        <span className="text-lg font-black text-slate-900">
                          ~{avgMinutesPerPatient} min
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
                        <span className="text-[10px] font-bold uppercase text-amber-800 block">
                          Waiting in Queue
                        </span>
                        <span className="text-lg font-black text-slate-900">{waitingCount}</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                        <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                          Est. Wait for New Token
                        </span>
                        <span className="text-lg font-black text-emerald-900">
                          {estimatedNewTokenWaitMins === 0 ? 'Immediate' : `~${estimatedNewTokenWaitMins}m`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
                      <span>
                        In Consultation Now: <strong className="text-slate-800">{insideCount}</strong>
                      </span>
                      <span>
                        Completed Today: <strong className="text-slate-800">{completedTodayCount}</strong>
                      </span>
                      <span>
                        Mode:{' '}
                        <strong className="text-slate-800 uppercase">
                          {clinic.avgTimeMode || 'auto'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {onSelectClinic && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onSelectClinic(clinic.id)}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm cursor-pointer"
                      >
                        <span>Book Slot at {clinic.name}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
