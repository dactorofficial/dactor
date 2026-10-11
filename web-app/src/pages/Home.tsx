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
} from 'lucide-react'
import { Clinic, Doctor } from '../types'
import { getClinics, getDoctors } from '../services/db'
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
  { id: 'all', label: 'All Specialties' },
  { id: 'skin', label: 'Skin / Dermatology' },
  { id: 'heart', label: 'Heart / Cardiology' },
  { id: 'ortho', label: 'Bone & Joint (Orthopedics)' },
  { id: 'eye', label: 'Eye / Ophthalmology' },
  { id: 'child', label: 'Child / Pediatrics' },
  { id: 'dental', label: 'Dental Care' },
  { id: 'general', label: 'General Medicine' },
  { id: 'ent', label: 'ENT (Ear, Nose & Throat)' },
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

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.addressText && c.addressText.toLowerCase().includes(q)) ||
          c.specialties?.some((s) => s.toLowerCase().includes(q)) ||
          c.doctorsList.some(
            (d) =>
              d.fullName.toLowerCase().includes(q) ||
              d.specialty?.toLowerCase().includes(q)
          )
      )
    }

    // Specialty chip filter
    if (selectedSpecialty !== 'all') {
      const target = selectedSpecialty.toLowerCase()
      result = result.filter(
        (c) =>
          c.specialties?.some((s) => s.toLowerCase().includes(target)) ||
          c.doctorsList.some((d) => d.specialty?.toLowerCase().includes(target))
      )
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
    <div className="min-h-screen bg-slate-50 space-y-12 pb-24 font-sans text-slate-900 selection:bg-brand-500 selection:text-white">
      {/* ========================================================= */}
      {/* TOP LOCATION & REAL APP BRAND BAR */}
      {/* ========================================================= */}
      <section className="bg-white border-b border-slate-200/80 sticky top-20 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Location Selector (matches real app's "All Nepal" dropdown) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="flex items-center space-x-2 text-slate-800 hover:text-brand-600 transition-colors group cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-brand-600" />
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  {selectedLocation}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showLocationDropdown && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                        className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                          selectedLocation === loc
                            ? 'bg-brand-50 text-brand-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
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
              className="w-full sm:w-auto flex items-center gap-2 bg-slate-100/90 hover:bg-slate-100 p-1 rounded-2xl border border-slate-200"
            >
              <div className="relative flex-1 sm:w-60">
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="10-Digit Token Code..."
                  maxLength={10}
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-bold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
                <Sparkles className="w-3.5 h-3.5 text-brand-600 absolute left-2.5 top-2.5" />
              </div>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs shrink-0 cursor-pointer"
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
      <section className="relative overflow-hidden pt-4 pb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-brand-50/70 via-slate-50 to-white border border-brand-200/60 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          {/* Subtle medical shield background watermark */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 opacity-5 pointer-events-none -mr-16">
            <img src={dactorLogo} alt="" className="w-full h-full object-contain" />
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
            {/* Left: Branding & Message */}
            <div className="space-y-4 max-w-2xl text-left">
              <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-brand-100/90 border border-brand-300 text-brand-900 text-xs font-bold tracking-wide shadow-xs">
                <img src={dactorLogo} alt="Dactor" className="w-4 h-4 object-contain rounded-full" />
                <span>Nepal's Realtime OPD Queue & Diagnostic Ecosystem</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Live OPD Tokens.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-sky-500">
                  Zero Waiting Room Hassle.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                Check whether your doctor is physically inside the clinic right now, book your slot, track real-time queue position with a 10-digit code, and unlock name-verified lab reports.
              </p>
            </div>

            {/* Right: Authentic Logo Showcase & Quick Highlights */}
            <div className="flex flex-col sm:flex-row items-center gap-5 shrink-0 bg-white/80 backdrop-blur-xs p-5 rounded-3xl border border-brand-100 shadow-sm">
              <img
                src={dactorLogo}
                alt="Dactor Shield"
                className="w-24 h-24 object-contain drop-shadow-md rounded-2xl"
              />
              <div className="space-y-2 text-xs text-slate-600 font-medium text-left">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-slate-800">Live Doctor Physical Presence</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>10-Digit Universal Queue Code</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>3-Stage Diagnostic Lab Pipeline</span>
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
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-300 rounded-full text-sm font-semibold text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 placeholder:text-slate-400 placeholder:font-normal"
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

        {/* Scrollable Specialty Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {SPECIALTY_CHIPS.map((chip) => {
            const isSelected = selectedSpecialty === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedSpecialty(chip.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-brand-300 hover:bg-brand-50/50'
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Month Header with < > buttons */}
        <div className="flex items-center justify-between px-1">
          <span className="text-base sm:text-lg font-black text-slate-900">
            {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex items-center space-x-1 text-slate-400">
            <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
              7-Day Availability
            </span>
          </div>
        </div>

        {/* 7 Days Strip */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {dateList.map((item, idx) => {
            const isSelected = selectedDateIndex === idx
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDateIndex(idx)}
                className={`py-3.5 sm:py-4 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/25 scale-[1.02]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-brand-200 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[11px] sm:text-xs font-bold ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                  {item.dayName}
                </span>
                <span className="text-lg sm:text-2xl font-black mt-0.5">
                  {item.dayNum}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selected Day Status & Sort Filter Bar */}
        <div className="flex items-center justify-between pt-2 px-1">
          <h2 className="text-base sm:text-lg font-black text-slate-900">
            {dateList[selectedDateIndex]?.fullDateStr}
          </h2>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors cursor-pointer shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Sort</span>
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSort('default')
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                    selectedSort === 'default' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
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
                    selectedSort === 'in_clinic' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
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
                    selectedSort === 'fee_asc' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
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
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClinics.map((clinic) => {
              const doc = clinic.primaryDoctor
              const isDocInClinic = clinic.hasDocInClinic || doc?.isInClinic

              return (
                <div
                  key={clinic.id}
                  className="bg-white rounded-3xl border border-slate-200/90 hover:border-brand-400 p-5 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-4"
                >
                  {/* Top: Clinic Title & Multi-Visit Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 line-clamp-1">
                          {clinic.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{clinic.addressText || 'Kathmandu, Nepal'}</span>
                        </p>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {clinic.type === 'diagnostic_lab' ? 'Diagnostic Lab' : 'Multi-Visit'}
                      </span>
                    </div>

                    {/* LIVE DOCTOR PHYSICAL PRESENCE BANNER (The Signature Feature) */}
                    <div className="mt-3.5">
                      {isDocInClinic ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-emerald-800">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-ping" />
                          <span className="text-xs font-bold">
                            Doctor is Physically Inside Clinic Now
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2 text-slate-600">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                          <span className="text-xs font-semibold">
                            Doctor Away • Available for Next OPD Slot
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Doctor Info */}
                    {doc && (
                      <div className="mt-3.5 space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                          <User className="w-4 h-4 text-brand-600 shrink-0" />
                          <span>{doc.fullName}</span>
                          {doc.specialty && (
                            <span className="text-slate-500 font-normal">
                              • {doc.specialty}
                            </span>
                          )}
                        </div>

                        {/* Available Today Time Slot */}
                        <div className="flex items-center space-x-2 text-xs font-medium text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span>Available Today:</span>
                          <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-800 font-mono font-bold text-[11px] border border-cyan-200">
                            19:38:00
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Fee & Book OPD Action */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Fee: Rs. {doc?.consultationFee || 500}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate('clinic-detail', { clinicId: clinic.id })}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-brand-600/20 hover:scale-[1.02] active:scale-[0.98] flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>Book OPD</span>
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Find Clinics */}
          <div
            onClick={() => onNavigate('clinics')}
            className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-brand-400 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-brand-600 transition-colors">
                Find Clinics & OPD
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                Browse polyclinics, check doctor rosters, and inspect transparent working & break hours.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
              <span>Browse Clinics</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Card 2: Book Doctor Slot */}
          <div
            onClick={() => onNavigate('clinics')}
            className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-brand-400 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                <Stethoscope className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-cyan-600 transition-colors">
                Doctor Consultations
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                Book appointment slots with NMC verified specialists. Pay at reception or directly.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-bold text-cyan-600 group-hover:translate-x-1 transition-transform">
              <span>Book Doctor Slot</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Card 3: Diagnostic Lab Tests */}
          <div
            onClick={() => onNavigate('clinics', { filter: 'diagnostic_lab' })}
            className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-brand-400 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                <FlaskConical className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-sky-600 transition-colors">
                Diagnostic Lab Tests
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                Pathology tests with upfront clinic prices and rapid sample collection.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-bold text-sky-600 group-hover:translate-x-1 transition-transform">
              <span>Select Lab Tests</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Card 4: Verified Lab Reports */}
          <div
            onClick={() => onOpenReportModal()}
            className="group p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-brand-400 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-brand-600 transition-colors">
                Name-Verified Reports
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                Track 3-stage lab status (Collected $\rightarrow$ Processing $\rightarrow$ Ready) and download in-app.
              </p>
            </div>
            <div className="mt-5 flex items-center text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
              <span>Verify & Download</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3-STAGE LAB SYSTEM EXPLAINER SECTION */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-brand-50 via-slate-50 to-white border border-brand-200 rounded-3xl p-8 sm:p-12">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold tracking-wider uppercase text-brand-700">
              For Diagnostic Lab Clinics & Patients
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              3-Stage Diagnostic Pipeline with Name-Verified Delivery
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Diagnostic centers on Dactor operate on an integrated laboratory pipeline specifically engineered for specimen collection, test pricing, and digital report delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white p-6 rounded-2xl border border-brand-100 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                1
              </div>
              <h4 className="font-black text-slate-900 text-base">Sample Collected</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                When patient arrives, lab technician marks sample collected with a single tap in operational management.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-brand-100 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold">
                2
              </div>
              <h4 className="font-black text-slate-900 text-base">Processing in Lab</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Patient tracking updates automatically to 'Processing'. Real-time progress is shown without calling the lab.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-brand-100 shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                3
              </div>
              <h4 className="font-black text-slate-900 text-base">Prepared & Uploaded</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lab technician marks prepared and uploads report. Patient unlocks the file with their verified full name.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* CLINIC ONBOARDING CTA BANNER (Unified Google Login) */}
      {/* ========================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-cyan-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Are you a Clinic Owner or Doctor?
            </h2>
            <p className="text-sm text-cyan-100 font-medium leading-relaxed">
              Join the unified Dactor portal. Manage OPD walk-in tokens, set consultation fees, publish slots, and manage diagnostic tests with simple Google authentication.
            </p>
          </div>

          <button
            onClick={() => onNavigate('portal')}
            className="px-8 py-4 bg-white text-brand-900 hover:bg-slate-50 font-black rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0 flex items-center space-x-2 text-sm cursor-pointer"
          >
            <span>Open Clinic / Doctor Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  )
}
