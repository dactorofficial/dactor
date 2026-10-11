import React, { useState, useEffect } from 'react'
import {
  Activity,
  Search,
  Sparkles,
  Calendar,
  Clock,
  ShieldCheck,
  Stethoscope,
  FlaskConical,
  Building2,
  ArrowRight,
  CheckCircle2,
  Users,
  MapPin,
  ChevronRight,
  TrendingDown,
  BellRing,
} from 'lucide-react'
import { Clinic } from '../types'
import { getClinics } from '../services/db'

interface HomeProps {
  onNavigate: (tab: string, params?: any) => void
  onOpenTrackerModal: (code?: string) => void
  onOpenReportModal: (code?: string) => void
}

export const Home: React.FC<HomeProps> = ({
  onNavigate,
  onOpenTrackerModal,
  onOpenReportModal,
}) => {
  const [trackingCode, setTrackingCode] = useState('')
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loadingClinics, setLoadingClinics] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const list = await getClinics()
        setClinics(list)
      } catch (err) {
        console.error('Failed to load clinics', err)
      } finally {
        setLoadingClinics(false)
      }
    }
    loadData()
  }, [])

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (trackingCode.trim()) {
      onOpenTrackerModal(trackingCode.trim())
    }
  }

  const filteredClinics = clinics.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.addressText && c.addressText.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.type && c.type.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-20 pb-20">
      {/* ========================================================= */}
      {/* HERO SECTION (Aaransh360 Theme: Emerald + Slate + Glass) */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-emerald-50/60 via-slate-50 to-white">
        {/* Subtle decorative background blur shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-200/30 to-teal-100/20 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-bold tracking-wide uppercase shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Next-Gen Healthcare OPD & Lab Ecosystem</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Smarter Healthcare,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                Zero Waiting Time.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
              Track live OPD queue tokens from your phone, discover top specialist doctors with transparent consultation fees, and access secure 3-stage diagnostic lab reports.
            </p>

            {/* Hero Quick 10-Digit Code Tracker Box */}
            <div className="max-w-xl mx-auto pt-4">
              <form
                onSubmit={handleTrackSubmit}
                className="p-2 sm:p-2.5 bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-200/80 flex flex-col sm:flex-row items-center gap-2"
              >
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="Enter 10-Digit Token Code..."
                    maxLength={10}
                    className="w-full px-4 py-3 pl-11 text-slate-900 font-bold text-base bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <Search className="w-5 h-5 text-emerald-600 absolute left-3.5 top-3.5" />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center space-x-2 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Activity className="w-4 h-4" />
                  <span>Track Live Queue</span>
                </button>
              </form>
              <div className="mt-3 flex items-center justify-center space-x-4 text-xs text-slate-500 font-medium">
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Real-time Patient Ahead Count</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Name-Verified Lab Reports</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Grid (4 Aaransh-Style Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-16">
            {/* Card 1: Find Clinics */}
            <div
              onClick={() => onNavigate('clinics')}
              className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Find Clinics & OPD
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Browse polyclinics, check doctor rosters, and inspect transparent working & break hours.
                </p>
              </div>
              <div className="mt-5 flex items-center text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
                <span>Browse Clinics</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>

            {/* Card 2: Book Doctor Slot */}
            <div
              onClick={() => onNavigate('clinics')}
              className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                  <Stethoscope className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                  Doctor Consultations
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Book direct appointment slots with NMC verified specialists. Pay at reception or online.
                </p>
              </div>
              <div className="mt-5 flex items-center text-xs font-bold text-teal-700 group-hover:translate-x-1 transition-transform">
                <span>Book Slot</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>

            {/* Card 3: Diagnostic Lab Tests */}
            <div
              onClick={() => onNavigate('clinics', { filter: 'diagnostic_lab' })}
              className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                  <FlaskConical className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                  Diagnostic Lab Tests
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Select blood tests & pathology packages with upfront clinic prices and fast sample collection.
                </p>
              </div>
              <div className="mt-5 flex items-center text-xs font-bold text-blue-700 group-hover:translate-x-1 transition-transform">
                <span>Select Tests</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>

            {/* Card 4: Verified Lab Reports */}
            <div
              onClick={() => onOpenReportModal()}
              className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 stroke-[2]" />
                </div>
                <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Name-Verified Reports
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Track 3-stage lab status (Collected $\rightarrow$ Processing $\rightarrow$ Prepared) and download in-app.
                </p>
              </div>
              <div className="mt-5 flex items-center text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
                <span>Verify & Download</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* LIVE STATS & HOW IT WORKS STRIP */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="space-y-3 lg:col-span-1">
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">
                Queue Elimination Engine
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
                Why wait hours inside crowded clinic hallways?
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                With Dactor, your 10-digit code gives you live visibility into which patient is currently with the doctor and when you should arrive.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 lg:col-span-2">
              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-3xl font-black text-emerald-400">0 min</div>
                <div className="text-xs font-bold text-slate-300 mt-1">Hallway Waiting</div>
                <div className="text-[11px] text-slate-400 mt-1">Arrive just before your turn</div>
              </div>

              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <div className="text-3xl font-black text-teal-400">3-Stage</div>
                <div className="text-xs font-bold text-slate-300 mt-1">Diagnostic Pipeline</div>
                <div className="text-[11px] text-slate-400 mt-1">Collected • Processing • Ready</div>
              </div>

              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60 col-span-2 sm:col-span-1">
                <div className="text-3xl font-black text-emerald-400">100%</div>
                <div className="text-xs font-bold text-slate-300 mt-1">Confidential</div>
                <div className="text-[11px] text-slate-400 mt-1">Strict Name Verification</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* FEATURED CLINICS DIRECTORY PREVIEW */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold tracking-wider uppercase text-emerald-600">
              Verified Healthcare Centers
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Popular Clinics & Diagnostic Labs
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Check live status, break hours, and doctor consultation fees
            </p>
          </div>

          <button
            onClick={() => onNavigate('clinics')}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors self-start md:self-auto"
          >
            <span>View All Clinics</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Clinics Grid */}
        {loadingClinics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clinics.slice(0, 6).map((clinic) => (
              <div
                key={clinic.id}
                onClick={() => onNavigate('clinic-detail', { clinicId: clinic.id })}
                className="group bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg">
                      {clinic.name.charAt(0)}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        clinic.type === 'diagnostic_lab'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {clinic.type === 'diagnostic_lab' ? 'Diagnostic Lab' : 'Polyclinic & OPD'}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                    {clinic.name}
                  </h3>

                  <div className="flex items-center space-x-1 text-xs text-slate-500 mt-1 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{clinic.addressText || 'Kathmandu, Central Valley'}</span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mt-3 leading-relaxed">
                    {clinic.description ||
                      'Providing comprehensive outpatient care, live queue scheduling, and certified medical consultations.'}
                  </p>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">
                    {clinic.specialties?.length || 4} Specialties Available
                  </span>
                  <span className="text-emerald-700 group-hover:translate-x-1 transition-transform flex items-center">
                    <span>Book Now</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 3-STAGE LAB SYSTEM EXPLAINER SECTION */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-slate-50 border border-emerald-200/80 rounded-3xl p-8 sm:p-12">
          <div className="max-w-3xl space-y-4">
            <span className="text-xs font-bold tracking-wider uppercase text-teal-700">
              For Diagnostic Lab Clinics
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              A Complete 3-Stage Workflow with Name-Verified Delivery
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Diagnostic centers on Dactor enjoy an integrated laboratory pipeline tailored specifically for specimen collection, test pricing, and digital report issuance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                1
              </div>
              <h4 className="font-black text-slate-900 text-base">Sample Collected</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                When patient checks in, lab technician marks sample collected with a single tap in operational management.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                2
              </div>
              <h4 className="font-black text-slate-900 text-base">Processing in Lab</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Patient tracking with 10-digit code updates automatically to 'Processing'. Real-time progress is shown without phone calls.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                3
              </div>
              <h4 className="font-black text-slate-900 text-base">Prepared & Uploaded</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lab technician marks prepared and uploads PDF or picture report. Patient unlocks file with their verified full name.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* CLINIC ONBOARDING CTA BANNER (Unified Google Login) */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-3xl p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Are you a Clinic Owner or Doctor?
            </h2>
            <p className="text-sm text-emerald-100 font-medium leading-relaxed">
              Join the unified Dactor portal. Manage OPD walk-in tokens, set consultation fees, publish slots, and manage diagnostic tests with simple Google authentication.
            </p>
          </div>

          <button
            onClick={() => onNavigate('portal')}
            className="px-8 py-4 bg-white text-emerald-800 hover:bg-slate-50 font-black rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0 flex items-center space-x-2 text-sm"
          >
            <span>Open Clinic / Doctor Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  )
}
