import React, { useState, useEffect, useMemo } from 'react'
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
  ChevronDown,
  User,
  SlidersHorizontal,
  X,
  Phone,
  Check,
  AlertCircle,
  RefreshCw,
  Eye,
  Navigation,
  Camera,
} from 'lucide-react'
import { Clinic, Doctor } from '../types'
import { getClinics, getDoctors } from '../services/db'
import { matchClinic } from '../utils/searchEngine'
import { updatePageSEO } from '../utils/seo'
import dactorLogo from '../assets/logo.png'

interface HomeProps {
  onNavigate: (tab: string, params?: any) => void
  onOpenTrackerModal: (code?: string) => void
  onOpenReportModal: (code?: string) => void
}

// Major Nepal cities & districts matching real Android app
const NEPAL_MAJOR_LOCATIONS = [
  'All Nepal',
  'Kathmandu',
  'Lalitpur',
  'Bhaktapur',
  'Pokhara',
  'Janakpur',
  'Biratnagar',
  'Birgunj',
  'Dharan',
  'Chitwan',
  'Butwal',
  'Nepalgunj',
  'Hetauda',
  'Dhangadhi',
]

// Common department / symptom chips from real app
const SPECIALTY_CHIPS = [
  { id: 'all', label: 'All Clinics & Labs' },
  { id: 'skin', label: 'Skin / Dermatology' },
  { id: 'heart', label: 'Heart / Cardiology' },
  { id: 'ortho', label: 'Bone & Joint (Orthopedics)' },
  { id: 'eye', label: 'Eye / Ophthalmology' },
  { id: 'child', label: 'Child / Pediatrics' },
  { id: 'dental', label: 'Dental Care' },
  { id: 'general', label: 'General Medicine' },
  { id: 'ent', label: 'ENT (Ear, Nose & Throat)' },
  { id: 'lab', label: 'Diagnostic Pathology Lab' },
  { id: 'mri', label: 'MRI Scan' },
  { id: 'ct', label: 'CT Scan' },
  { id: 'ultrasound', label: 'Ultrasound / USG / X-Ray' },
]

export const Home: React.FC<HomeProps> = ({
  onNavigate,
  onOpenTrackerModal,
  onOpenReportModal,
}) => {
  const [trackingCode, setTrackingCode] = useState('')
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  // Location selector state
  const [selectedLocation, setSelectedLocation] = useState('All Nepal')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [selectedSort, setSelectedSort] = useState<'default' | 'in_clinic' | 'fee_asc'>('default')
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  // Date strip state (7 consecutive days starting from today)
  const today = useMemo(() => new Date(), [])
  const [selectedDateIndex, setSelectedDateIndex] = useState(0)

  const dateList = useMemo(() => {
    const list = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(today.getDate() + i)
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
      const dayNum = d.getDate()
      const fullDateStr = d.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      list.push({ date: d, dayName, dayNum, fullDateStr })
    }
    return list
  }, [today])

  useEffect(() => {
    async function loadData() {
      try {
        const [cList, dList] = await Promise.all([getClinics(), getDoctors()])
        setClinics(cList.filter((c) => !c.isArchived))
        setDoctors(dList)
      } catch (err) {
        console.error('Failed to load clinics & doctors', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    updatePageSEO({
      title: "Dactor - Nepal Healthcare OPD Queue Tracker & Clinic Booking Portal",
      description: "Search verified specialist doctors, polyclinics, and diagnostic pathology labs in Nepal. Book doctor appointments online, track live token queue status in real time, and download certified medical test reports.",
    })
  }, [])

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (trackingCode.trim()) {
      onOpenTrackerModal(trackingCode.trim())
    }
  }

  // Filter and sort clinics & doctor cards
  const filteredClinics = useMemo(() => {
    let result = clinics.map((c) => {
      // Find affiliated doctors for this clinic
      const clinicDocs = doctors.filter(
        (d) => d.clinicId === c.id || (d as any).activeClinicId === c.id
      )
      const primaryDoc = clinicDocs[0] || null
      const hasDocInClinic = clinicDocs.some((d) => d.isInClinic)

      return {
        ...c,
        doctorsList: clinicDocs,
        primaryDoctor: primaryDoc,
        hasDocInClinic,
      }
    })

    // Location filter
    if (selectedLocation !== 'All Nepal') {
      result = result.filter(
        (c) =>
          c.addressText?.toLowerCase().includes(selectedLocation.toLowerCase()) ||
          c.name.toLowerCase().includes(selectedLocation.toLowerCase())
      )
    }

    // Search query filter with MedicalSearchEngine symptom & organ matching
    if (searchQuery.trim()) {
      result = result.filter((c) => {
        const match = matchClinic(c, c.doctorsList, [], searchQuery)
        return match.isMatch
      })
    }

    // Specialty chip filter
    if (selectedSpecialty !== 'all') {
      const target = selectedSpecialty.toLowerCase()
      result = result.filter((c) => {
        if (target === 'lab') {
          return (
            c.type === 'diagnostic_lab' ||
            c.specialties?.some((s) => s.toLowerCase().includes('lab') || s.toLowerCase().includes('patholog'))
          )
        }
        if (target === 'mri') {
          return (
            c.specialties?.some((s) => s.toLowerCase().includes('mri') || s.toLowerCase().includes('radiolog')) ||
            c.name.toLowerCase().includes('mri') ||
            c.type === 'diagnostic_lab'
          )
        }
        if (target === 'ct') {
          return (
            c.specialties?.some((s) => s.toLowerCase().includes('ct') || s.toLowerCase().includes('radiolog') || s.toLowerCase().includes('scan')) ||
            c.name.toLowerCase().includes('ct') ||
            c.type === 'diagnostic_lab'
          )
        }
        if (target === 'ultrasound') {
          return (
            c.specialties?.some((s) => s.toLowerCase().includes('ultrasound') || s.toLowerCase().includes('usg') || s.toLowerCase().includes('x-ray') || s.toLowerCase().includes('xray')) ||
            c.type === 'diagnostic_lab'
          )
        }
        return (
          c.specialties?.some((s) => s.toLowerCase().includes(target)) ||
          c.doctorsList.some((d) => d.specialty?.toLowerCase().includes(target))
        )
      })
    }

    // Sorting
    if (selectedSort === 'in_clinic') {
      result.sort((a, b) => (b.hasDocInClinic ? 1 : 0) - (a.hasDocInClinic ? 1 : 0))
    } else if (selectedSort === 'fee_asc') {
      result.sort((a, b) => {
        const feeA = a.primaryDoctor?.consultationFee || 500
        const feeB = b.primaryDoctor?.consultationFee || 500
        return feeA - feeB
      })
    }

    return result
  }, [clinics, doctors, selectedLocation, searchQuery, selectedSpecialty, selectedSort])

  return (
    <div className="min-h-screen space-y-8 sm:space-y-12 pb-24 font-sans text-slate-900 selection:bg-brand-500 selection:text-white">
      {/* ========================================================= */}
      {/* TOP LOCATION & REAL APP BRAND BAR */}
      {/* ========================================================= */}
      <section className="liquid-glass-elevated border-b border-white/60 sticky top-16 sm:top-20 z-40 shadow-glass-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            {/* Location Selector (matches real app's "All Nepal" dropdown) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="w-full sm:w-auto flex items-center justify-between sm:justify-start space-x-2 text-slate-800 hover:text-brand-600 transition-colors group cursor-pointer py-1 px-1"
              >
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                    {selectedLocation}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showLocationDropdown && (
                <div className="absolute left-0 mt-2 w-full sm:w-64 liquid-glass-elevated rounded-2xl shadow-glass-lg border border-white/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Select City / Region
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {NEPAL_MAJOR_LOCATIONS.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(loc)
                          setShowLocationDropdown(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors ${
                          selectedLocation === loc
                            ? 'bg-brand-50/90 text-brand-700 font-bold'
                            : 'text-slate-700 hover:bg-white/60'
                        }`}
                      >
                        <span>{loc}</span>
                        {selectedLocation === loc && <Check className="w-3.5 h-3.5 text-brand-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live 10-Digit Quick Code Tracker Form (Pill styled like real app) */}
            <form
              onSubmit={handleTrackSubmit}
              className="w-full sm:w-auto flex items-center gap-2 liquid-glass-input p-1 rounded-2xl border border-white/70 shadow-glass-sm"
            >
              <div className="relative flex-1 sm:w-60">
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="10-Digit Token Code..."
                  maxLength={10}
                  className="w-full pl-8 pr-3 py-1.5 text-sm sm:text-xs font-bold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
                <Sparkles className="w-3.5 h-3.5 text-brand-600 absolute left-2.5 top-2.5" />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 bg-gradient-to-r from-brand-600 to-cyan-500 hover:brightness-105 text-white font-bold rounded-xl text-xs transition-all shadow-glass-brand shrink-0 cursor-pointer active:scale-[0.97]"
              >
                Track Queue
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* HERO SECTION WITH AUTHENTIC DACTOR LOGO & MEDICAL THEME */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden pt-2 sm:pt-4 pb-4 sm:pb-6 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="liquid-glass-elevated border border-white/80 rounded-3xl p-5 sm:p-10 shadow-glass-lg relative overflow-hidden">
          {/* Specular Perimeter Line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] rounded-t-3xl bg-gradient-to-r from-transparent via-white/80 to-transparent" aria-hidden="true" />

          {/* Subtle medical shield background watermark */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 opacity-5 pointer-events-none -mr-16">
            <img src={dactorLogo} alt="" className="w-full h-full object-contain" />
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8 relative z-10">
            {/* Left: Branding & Message */}
            <div className="space-y-3 sm:space-y-4 max-w-2xl text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full liquid-glass-subtle border border-brand-200/60 text-brand-900 text-[11px] sm:text-xs font-bold tracking-wide shadow-glass-sm">
                <img src={dactorLogo} alt="Dactor" className="w-4 h-4 object-contain rounded-full" />
                <span>Nepal's Realtime OPD Queue & Diagnostic Ecosystem</span>
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Live OPD Tokens.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-sky-500 to-cyan-500">
                  Zero Waiting Room Hassle.
                </span>
              </h1>

              <p className="text-xs sm:text-base text-slate-600 font-medium leading-relaxed">
                Check whether your doctor is physically inside the clinic right now, book your slot, track real-time queue position with a 10-digit code, and unlock name-verified lab reports.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('patient-portal')}
                  className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-brand-600 via-sky-600 to-cyan-500 hover:brightness-105 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-glass-brand border border-white/30 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <User className="w-4 h-4" />
                  <span>Patient Portal & My Bookings</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('live-queue')}
                  className="w-full sm:w-auto px-4 py-3 liquid-glass-subtle hover:bg-white/90 text-slate-800 border border-white/80 font-bold rounded-2xl text-xs sm:text-sm shadow-glass-sm flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Activity className="w-4 h-4 text-brand-600" />
                  <span>Live Queue Tracker</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('lab-reports')}
                  className="w-full sm:w-auto px-4 py-3 liquid-glass-subtle hover:bg-white/90 text-slate-800 border border-white/80 font-bold rounded-2xl text-xs sm:text-sm shadow-glass-sm flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <FlaskConical className="w-4 h-4 text-emerald-600" />
                  <span>3-Stage Lab Reports</span>
                </button>
              </div>
            </div>

            {/* Right: Authentic Logo Showcase & Quick Highlights */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-5 shrink-0 liquid-glass-base p-5 rounded-3xl border border-white/80 shadow-glass-md">
              <img
                src={dactorLogo}
                alt="Dactor Shield"
                className="w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-md rounded-2xl shadow-glass-sm"
              />
              <div className="space-y-1.5 sm:space-y-2 text-xs text-slate-600 font-medium text-left w-full sm:w-auto">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 shadow-xs shadow-emerald-500/50" />
                  <span className="font-bold text-slate-800 text-[11px] sm:text-xs">Live Doctor Physical Presence</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-semibold">10-Digit Universal Queue Code</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-semibold">3-Stage Diagnostic Lab Pipeline</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SEARCH BAR & SPECIALTY CHIPS (Exactly like Real Android App) */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Pill Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skin, heart, child, clinic or doctor..."
            className="w-full pl-12 pr-10 py-3.5 liquid-glass-input rounded-full text-sm font-semibold text-slate-900 shadow-glass-sm border border-white/80 placeholder:text-slate-400 placeholder:font-normal"
          />
          <Search className="w-5 h-5 text-brand-600 absolute left-4 top-3.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Specialty Chips with smooth edge-to-edge swiping */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {SPECIALTY_CHIPS.map((chip) => {
            const isSelected = selectedSpecialty === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedSpecialty(chip.id)}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-gradient-to-r from-brand-600 to-cyan-500 text-white border-white/40 shadow-glass-brand scale-[1.02]'
                    : 'liquid-glass-subtle text-slate-700 border-white/60 hover:bg-white/90 shadow-glass-sm'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* HORIZONTAL DATE PICKER STRIP (Matches 01_home_dashboard.png) */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-3 sm:space-y-4">
        {/* Month Header with badge */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm sm:text-lg font-black text-slate-900">
            {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex items-center space-x-1 text-slate-400">
            <span className="text-[11px] sm:text-xs font-semibold text-brand-700 liquid-glass-subtle border border-brand-200/60 px-2.5 py-0.5 sm:py-1 rounded-full shadow-xs">
              7-Day Availability
            </span>
          </div>
        </div>

        {/* 7 Days Strip */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {dateList.map((item, idx) => {
            const isSelected = selectedDateIndex === idx
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDateIndex(idx)}
                className={`py-2.5 sm:py-4 px-0.5 sm:px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-gradient-to-r from-brand-600 via-sky-600 to-cyan-500 text-white border-white/40 shadow-glass-brand scale-[1.03]'
                    : 'liquid-glass-subtle text-slate-700 border-white/60 hover:bg-white/80 shadow-glass-sm'
                }`}
              >
                <span className={`text-[10px] sm:text-xs font-bold leading-tight ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                  {item.dayName}
                </span>
                <span className="text-sm sm:text-2xl font-black mt-0.5 leading-none">
                  {item.dayNum}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selected Day Status & Sort Filter Bar */}
        <div className="flex items-center justify-between pt-1 sm:pt-2 px-1 gap-2">
          <h2 className="text-xs sm:text-lg font-black text-slate-900 truncate">
            {dateList[selectedDateIndex]?.fullDateStr}
          </h2>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-brand-600 to-cyan-500 text-white rounded-xl text-xs font-bold hover:brightness-105 transition-all cursor-pointer shadow-glass-brand border border-white/30"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Sort</span>
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-48 liquid-glass-elevated rounded-2xl shadow-glass-lg border border-white/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSort('default')
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                    selectedSort === 'default' ? 'bg-brand-50/90 text-brand-700 font-bold' : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  Recommended
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSort('in_clinic')
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                    selectedSort === 'in_clinic' ? 'bg-brand-50/90 text-brand-700 font-bold' : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  🟢 Doctor In Clinic First
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSort('fee_asc')
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                    selectedSort === 'fee_asc' ? 'bg-brand-50/90 text-brand-700 font-bold' : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  Lowest Fee First
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* CLINIC & DOCTOR OPD CARDS (Matches 01_home_dashboard.png) */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-md mx-auto space-y-3">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No clinics found matching criteria</h3>
            <p className="text-xs text-slate-500">
              Try clearing filters or switching location to "All Nepal".
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedSpecialty('all')
                setSelectedLocation('All Nepal')
              }}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredClinics.map((clinic) => {
              const doc = clinic.primaryDoctor
              const isDocInClinic = clinic.hasDocInClinic || doc?.isInClinic
              const selectedDayShort = dateList[selectedDateIndex]?.dayName || 'Mon'
              let scheduleLabel = `Avg ~${clinic.avgConsultationTimeMinutes || 10} min / patient`
              if (clinic.weeklyScheduleJson) {
                try {
                  const parsed = JSON.parse(clinic.weeklyScheduleJson)
                  if (Array.isArray(parsed)) {
                    const match = parsed.find((item: any) =>
                      String(item.day || '').toLowerCase().startsWith(selectedDayShort.toLowerCase())
                    )
                    if (match) {
                      scheduleLabel = match.isOpen === false
                        ? 'Closed on selected day'
                        : `${match.openTime || '09:00 AM'} – ${match.closeTime || '05:00 PM'}`
                    }
                  }
                } catch {}
              }

              const coverPhoto = (clinic.pictures && clinic.pictures.length > 0 ? clinic.pictures[0] : null) || clinic.logoUrl

              return (
                <div
                  key={clinic.id}
                  className="group liquid-glass-card rounded-3xl border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all duration-300 flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Clinic Photo Banner */}
                    <div className="relative w-full h-40 sm:h-44 bg-slate-100 overflow-hidden">
                      {coverPhoto ? (
                        <img
                          src={coverPhoto}
                          alt={clinic.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-brand-600 via-brand-500 to-teal-500 flex items-center justify-center text-white">
                          <div className="text-center space-y-1">
                            <Building2 className="w-10 h-10 mx-auto opacity-80" />
                            <span className="text-xs font-bold tracking-wider uppercase opacity-90">Dactor Certified Clinic</span>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-black/20" />

                      {/* Top Overlay Badges */}
                      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 flex flex-wrap items-center justify-between gap-1.5">
                        <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-white/90 text-brand-900 backdrop-blur-md shadow-glass-sm border border-white/80">
                          {clinic.type === 'diagnostic_lab'
                            ? 'Diagnostic Lab'
                            : clinic.type === 'single_visit'
                            ? 'Single-Visit'
                            : 'Multi-Visit'}
                        </span>

                        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500 text-white shadow-xs border border-white/30">
                          <ShieldCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5 mr-1" />
                          Verified
                        </span>
                      </div>

                      {/* Photo Count Indicator */}
                      {clinic.pictures && clinic.pictures.length > 1 && (
                        <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white flex items-center space-x-1 border border-white/20">
                          <Camera className="w-3 h-3" />
                          <span>{clinic.pictures.length} Photos</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-5 space-y-3 sm:space-y-3.5">
                      {/* Clinic Title & Address */}
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 line-clamp-1 group-hover:text-brand-600 transition-colors">
                          {clinic.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{clinic.addressText || 'Nepal'}</span>
                        </p>
                      </div>

                      {/* LIVE DOCTOR PHYSICAL PRESENCE & BREAK BANNER */}
                      <div className="space-y-1.5">
                        {clinic.isOnBreak ? (
                          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-300/60 flex items-center space-x-2 text-amber-800 backdrop-blur-xs">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                            <span className="text-[11px] sm:text-xs font-bold leading-tight">
                              Clinic Currently on Short Break • Queue Paused
                            </span>
                          </div>
                        ) : isDocInClinic ? (
                          <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-300/60 flex items-center space-x-2 text-emerald-800 backdrop-blur-xs">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-ping" />
                            <span className="text-[11px] sm:text-xs font-bold leading-tight">
                              Doctor is Physically Inside Clinic Now
                            </span>
                          </div>
                        ) : (
                          <div className="p-2 sm:p-2.5 rounded-xl liquid-glass-subtle border border-white/60 flex items-center space-x-2 text-slate-600">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="text-[11px] sm:text-xs font-semibold leading-tight">
                              {clinic.type === 'diagnostic_lab'
                                ? 'Lab Open for Sample Collection'
                                : 'Doctor Away • Available for Next OPD Slot'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Doctor & Schedule Info */}
                      <div className="space-y-2 pt-2 border-t border-slate-100/70">
                        {doc ? (
                          <div className="flex items-center space-x-2.5 text-xs font-bold text-slate-800">
                            <div className="w-8 h-8 rounded-xl bg-brand-50/80 text-brand-800 flex items-center justify-center font-black text-xs shrink-0 overflow-hidden border border-white/80 shadow-xs">
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
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-slate-900 line-clamp-1">{doc.fullName}</span>
                              {doc.specialty && (
                                <span className="text-brand-700 font-medium text-[11px] block truncate">
                                  {doc.specialty}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
                            <Stethoscope className="w-4 h-4 text-brand-600 shrink-0" />
                            <span className="truncate">
                              {clinic.specialties && clinic.specialties.length > 0
                                ? clinic.specialties.slice(0, 2).join(' • ')
                                : 'OPD & Diagnostic Services'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span className="shrink-0">Schedule:</span>
                          <span className="px-2 py-0.5 rounded-md bg-cyan-50/80 text-cyan-800 font-mono font-bold text-[10px] sm:text-[11px] border border-cyan-200/60 truncate">
                            {scheduleLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Fee & Book OPD Action */}
                  <div className="p-4 pt-3 border-t border-slate-100/70 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        {doc?.consultationFee
                          ? `Fee: Rs. ${doc.consultationFee}`
                          : `Avg: ~${clinic.avgConsultationTimeMinutes || 10}m`}
                      </span>
                      {!isDocInClinic && clinic.type !== 'diagnostic_lab' && (
                        <span className="text-[10px] text-teal-700 font-semibold block">
                          Next slot available
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('clinic-detail', { clinicId: clinic.id })}
                      className="px-3.5 py-2 bg-gradient-to-r from-brand-600 via-sky-600 to-cyan-500 hover:brightness-105 text-white font-bold rounded-xl text-xs transition-all shadow-glass-brand border border-white/30 hover:scale-[1.02] active:scale-[0.98] flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <span>
                        {clinic.type === 'diagnostic_lab'
                          ? 'Book Lab'
                          : isDocInClinic
                          ? 'Book OPD'
                          : 'Book on Another Date'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 4 QUICK ACTION TILES (Medical Cyan & Deep Navy Themed) */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Find Clinics */}
          <div
            onClick={() => onNavigate('clinics')}
            className="group p-5 sm:p-6 liquid-glass-card rounded-3xl border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-50/80 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors flex items-center justify-center mb-3 sm:mb-4 border border-brand-200/50 shadow-glass-sm backdrop-blur-md">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-brand-600 transition-colors">
                Find Clinics & OPD
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Browse polyclinics, check doctor rosters, and inspect transparent working & break hours.
              </p>
            </div>
            <div className="mt-4 sm:mt-5 flex items-center text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
              <span>Browse Clinics</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Card 2: Book Doctor Slot */}
          <div
            onClick={() => onNavigate('clinics')}
            className="group p-5 sm:p-6 liquid-glass-card rounded-3xl border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-cyan-50/80 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors flex items-center justify-center mb-3 sm:mb-4 border border-cyan-200/50 shadow-glass-sm backdrop-blur-md">
                <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-cyan-600 transition-colors">
                Doctor Consultations
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Book appointment slots with NMC verified specialists. Pay at reception or directly.
              </p>
            </div>
            <div className="mt-4 sm:mt-5 flex items-center text-xs font-bold text-cyan-600 group-hover:translate-x-1 transition-transform">
              <span>Book Doctor Slot</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Card 3: Diagnostic Lab Tests */}
          <div
            onClick={() => onNavigate('clinics', { filter: 'diagnostic_lab' })}
            className="group p-5 sm:p-6 liquid-glass-card rounded-3xl border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-sky-50/80 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors flex items-center justify-center mb-3 sm:mb-4 border border-sky-200/50 shadow-glass-sm backdrop-blur-md">
                <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors">
                Diagnostic Lab Tests
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Pathology tests with upfront clinic prices and rapid sample collection.
              </p>
            </div>
            <div className="mt-4 sm:mt-5 flex items-center text-xs font-bold text-sky-600 group-hover:translate-x-1 transition-transform">
              <span>Select Lab Tests</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Card 4: Verified Lab Reports */}
          <div
            onClick={() => onOpenReportModal()}
            className="group p-5 sm:p-6 liquid-glass-card rounded-3xl border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-50/80 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors flex items-center justify-center mb-3 sm:mb-4 border border-brand-200/50 shadow-glass-sm backdrop-blur-md">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-brand-600 transition-colors">
                Name-Verified Reports
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Track 3-stage lab status (Collected &rarr; Processing &rarr; Ready) and download in-app.
              </p>
            </div>
            <div className="mt-4 sm:mt-5 flex items-center text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
              <span>Verify & Download</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3-STAGE LAB SYSTEM EXPLAINER SECTION */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="liquid-glass-elevated border border-white/80 rounded-3xl p-6 sm:p-12 shadow-glass-lg relative overflow-hidden">
          {/* Specular Perimeter Line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] rounded-t-3xl bg-gradient-to-r from-transparent via-white/80 to-transparent" aria-hidden="true" />

          <div className="max-w-3xl space-y-2 sm:space-y-3">
            <span className="text-xs font-bold tracking-wider uppercase text-brand-700 liquid-glass-subtle px-3 py-1 rounded-full border border-brand-200/60 shadow-xs">
              For Diagnostic Lab Clinics & Patients
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
              3-Stage Diagnostic Pipeline with Name-Verified Delivery
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Diagnostic centers on Dactor operate on an integrated laboratory pipeline specifically engineered for specimen collection, test pricing, and digital report delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8">
            <div className="liquid-glass-subtle p-5 sm:p-6 rounded-2xl border border-white/70 shadow-glass-sm space-y-2 hover:bg-white/80 transition-all">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100/80 text-amber-800 border border-amber-200/50 flex items-center justify-center font-bold text-sm shadow-xs">
                1
              </div>
              <h4 className="font-black text-slate-900 text-sm sm:text-base">Sample Collected</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                When patient arrives, lab technician marks sample collected with a single tap in operational management.
              </p>
            </div>

            <div className="liquid-glass-subtle p-5 sm:p-6 rounded-2xl border border-white/70 shadow-glass-sm space-y-2 hover:bg-white/80 transition-all">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-100/80 text-cyan-800 border border-cyan-200/50 flex items-center justify-center font-bold text-sm shadow-xs">
                2
              </div>
              <h4 className="font-black text-slate-900 text-sm sm:text-base">Processing in Lab</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Patient tracking updates automatically to 'Processing'. Real-time progress is shown without calling the lab.
              </p>
            </div>

            <div className="liquid-glass-subtle p-5 sm:p-6 rounded-2xl border border-white/70 shadow-glass-sm space-y-2 hover:bg-white/80 transition-all">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100/80 text-emerald-800 border border-emerald-200/50 flex items-center justify-center font-bold text-sm shadow-xs">
                3
              </div>
              <h4 className="font-black text-slate-900 text-sm sm:text-base">Prepared & Uploaded</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lab technician marks prepared and uploads report. Patient unlocks the file with their verified full name.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* DEDICATED HEALTHCARE PORTALS SECTION */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-5 sm:space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600 liquid-glass-subtle px-3 py-1 rounded-full border border-brand-200/60 shadow-xs">
            Dedicated Role Desks
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Dactor Healthcare Portals
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Separate, secure portals for patients, licensed medical doctors, and healthcare facilities. Strict single-role account exclusivity guaranteed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* 1. Patient Portal Card */}
          <div className="liquid-glass-card rounded-3xl p-5 sm:p-8 border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all flex flex-col justify-between space-y-5 sm:space-y-6 group">
            <div className="space-y-3 sm:space-y-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-50/80 text-brand-700 flex items-center justify-center font-bold shadow-glass-sm border border-brand-200/50 group-hover:scale-105 transition-transform backdrop-blur-md">
                <User className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  Patients & Citizens
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 tracking-tight">
                  Patient Health Portal
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Track live OPD queue tokens in real time, view appointment schedules, manage family health profiles, and download name-verified diagnostic lab reports.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('patient-portal')}
              className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-brand-600 via-sky-600 to-cyan-500 hover:brightness-105 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 shadow-glass-brand border border-white/30 cursor-pointer active:scale-[0.98]"
            >
              <span>Enter Patient Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Doctor Portal Card */}
          <div className="liquid-glass-card rounded-3xl p-5 sm:p-8 border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all flex flex-col justify-between space-y-5 sm:space-y-6 group">
            <div className="space-y-3 sm:space-y-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50/80 text-emerald-700 flex items-center justify-center font-bold shadow-glass-sm border border-emerald-200/50 group-hover:scale-105 transition-transform backdrop-blur-md">
                <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Medical Practitioners
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 tracking-tight">
                  Doctor Consultation Desk
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Live in-cabin physical presence toggle, calling waiting patients, token queue status updates, push alerts, and direct consultation records with NMC credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('doctor-portal')}
              className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 border border-white/30 cursor-pointer active:scale-[0.98]"
            >
              <span>Enter Doctor Desk</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3. Clinic & Lab Portal Card */}
          <div className="liquid-glass-card rounded-3xl p-5 sm:p-8 border border-white/80 shadow-glass-md hover:shadow-glass-lg transition-all flex flex-col justify-between space-y-5 sm:space-y-6 group">
            <div className="space-y-3 sm:space-y-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50/80 text-indigo-700 flex items-center justify-center font-bold shadow-glass-sm border border-indigo-200/50 group-hover:scale-105 transition-transform backdrop-blur-md">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Clinics, Hospitals & Labs
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 tracking-tight">
                  Clinic & Lab Center
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Reception walk-in token generation with 10-digit codes, doctor rosters, patient directories, 3-stage pathology pipelines, and billing invoice printing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('portal')}
              className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-indigo-600 to-brand-700 hover:brightness-105 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 shadow-md shadow-indigo-600/20 border border-white/30 cursor-pointer active:scale-[0.98]"
            >
              <span>Enter Clinic Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* PROVIDER ONBOARDING CTA BANNER */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-slate-950/90 backdrop-blur-2xl text-white rounded-3xl p-6 sm:p-12 shadow-glass-modal border border-white/20 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
          {/* Specular Perimeter Line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] rounded-t-3xl bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" aria-hidden="true" />

          <div className="space-y-2 sm:space-y-3 max-w-xl text-left">
            <h2 className="text-xl sm:text-3xl font-black tracking-tight">
              Empower Your Medical Practice with Dactor
            </h2>
            <p className="text-xs sm:text-sm text-cyan-100 font-medium leading-relaxed">
              Connect your clinic or join as an accredited doctor. Real-time token synchronization, zero waiting room clutter, and name-verified lab delivery with pure Google authentication.
            </p>
          </div>

          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => onNavigate('doctor-portal')}
              className="w-full sm:w-auto justify-center px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-105 text-white font-black rounded-2xl shadow-md border border-white/30 transition-transform active:scale-95 flex items-center space-x-2 text-xs cursor-pointer"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Doctor Portal</span>
            </button>

            <button
              onClick={() => onNavigate('portal')}
              className="w-full sm:w-auto justify-center px-6 py-3.5 bg-white/95 text-brand-900 hover:bg-white font-black rounded-2xl shadow-glass-md border border-white/80 transition-transform active:scale-95 flex items-center space-x-2 text-xs cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>Clinic Portal</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
