import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  Building2,
  Stethoscope,
  FlaskConical,
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  ShieldCheck,
  Star,
  Users,
  Sparkles,
  X,
  History,
} from 'lucide-react'
import { Clinic } from '../types'
import { getClinics } from '../services/db'
import {
  matchClinic,
  QUICK_SPECIALTY_SUGGESTIONS,
  getRecentSearches,
  saveRecentSearch,
} from '../utils/searchEngine'

interface FindClinicsProps {
  onSelectClinic: (clinicId: string, initialTab?: string) => void
  initialFilter?: string
}

export const FindClinics: React.FC<FindClinicsProps> = ({
  onSelectClinic,
  initialFilter = 'all',
}) => {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState(initialFilter)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches())

  useEffect(() => {
    async function load() {
      try {
        const data = await getClinics()
        setClinics(data)
      } catch (err) {
        console.error('Failed to load clinics', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSearchChange = (term: string) => {
    setSearchTerm(term)
    if (term.trim().length >= 3) {
      saveRecentSearch(term)
      setRecentSearches(getRecentSearches())
    }
  }

  const handleSelectQuickSuggestion = (suggestion: string) => {
    // Extract base keyword e.g. "Skin" from "Skin / Dermatologist"
    const keyword = suggestion.split('/')[0].split('&')[0].replace(/\(.*\)/, '').trim()
    setSearchTerm(keyword)
    saveRecentSearch(keyword)
    setRecentSearches(getRecentSearches())
  }

  // Filter and score clinics with MedicalSearchEngine
  const scoredClinics = useMemo(() => {
    return clinics
      .map((clinic) => {
        const t = (clinic.type || '').toLowerCase()
        const n = (clinic.name || '').toLowerCase()
        const isLab =
          t === 'diagnostic_lab' ||
          t.includes('lab') ||
          n.includes('lab') ||
          (clinic.specialties?.some(
            (s) => s.toLowerCase().includes('lab') || s.toLowerCase().includes('patholog')
          ) ?? false)

        const isSingle = !isLab && (t === 'single_visit' || t === 'single_doctor')
        const isPoly = !isLab && !isSingle

        // Category filter check
        if (filterType === 'diagnostic_lab' && !isLab) return null
        if (filterType === 'single_doctor' && !isSingle) return null
        if (filterType === 'polyclinic' && !isPoly) return null

        if (!searchTerm.trim()) {
          return { clinic, score: 10, isLab, isSingle, isPoly, matchReason: undefined }
        }

        const match = matchClinic(clinic, [], [], searchTerm)
        if (!match.isMatch) return null

        return {
          clinic,
          score: match.score,
          isLab,
          isSingle,
          isPoly,
          matchReason: match.matchHighlightReason,
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b?.score || 0) - (a?.score || 0))
  }, [clinics, searchTerm, filterType])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-brand-600" />
          <span>Intelligent Medical Search</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Verified Clinics & Diagnostic Labs
        </h1>
        <p className="text-sm text-slate-500 font-medium max-w-2xl">
          Search polyclinics for specialist OPD consultations, single-doctor chambers, or diagnostic pathology labs for tests and packages.
        </p>
      </div>

      {/* Filter and Search Bar Container */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Search Input */}
        <div className="relative w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search symptoms (skin, heart, fever, bone), doctors, or diagnostic tests..."
            className="w-full px-4 py-3.5 pl-11 pr-10 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:font-normal placeholder:text-slate-400"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Recent Search Chips (if available) */}
        {recentSearches.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs text-slate-500">
            <span className="font-bold flex items-center space-x-1 shrink-0 text-slate-400">
              <History className="w-3.5 h-3.5" />
              <span>Recent:</span>
            </span>
            {recentSearches.map((keyword) => (
              <button
                key={keyword}
                onClick={() => handleSearchChange(keyword)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold shrink-0 cursor-pointer transition text-[11px]"
              >
                {keyword}
              </button>
            ))}
          </div>
        )}

        {/* Quick Specialty Suggestions Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
          <span className="font-bold text-slate-400 shrink-0 text-[11px] uppercase tracking-wider">
            Quick Symptoms:
          </span>
          {QUICK_SPECIALTY_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSelectQuickSuggestion(suggestion)}
              className="px-3 py-1 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold shrink-0 cursor-pointer transition border border-brand-200/60 text-[11px]"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* 4 Clinic Category Filter Tabs */}
        <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: `All Centers (${clinics.length})`, icon: Building2 },
            { id: 'single_doctor', label: 'Single-Visit OPD Clinics', icon: Stethoscope },
            { id: 'polyclinic', label: 'Multi-Specialty Polyclinics', icon: Users },
            { id: 'diagnostic_lab', label: 'Diagnostic Pathology Labs', icon: FlaskConical },
          ].map((pill) => {
            const Icon = pill.icon
            const isSelected = filterType === pill.id
            return (
              <button
                key={pill.id}
                onClick={() => setFilterType(pill.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{pill.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Clinics Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : scoredClinics.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No medical centers matched</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your symptom keyword or clearing category filters.
          </p>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterType('all')
            }}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition"
          >
            Reset Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scoredClinics.map((item) => {
            if (!item) return null
            const { clinic, isLab, isSingle, isPoly, matchReason } = item

            let hoursText = `Avg ~${clinic.avgConsultationTimeMinutes || 10} min / token`
            if (clinic.weeklyScheduleJson) {
              try {
                const parsed = JSON.parse(clinic.weeklyScheduleJson)
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const openDays = parsed.filter((d: any) => d.isOpen !== false)
                  if (openDays.length > 0) {
                    const first = openDays[0]
                    hoursText = `${first.openTime || '09:00 AM'} – ${first.closeTime || '05:00 PM'}${
                      first.breakStart && first.breakEnd ? ` (Break: ${first.breakStart} – ${first.breakEnd})` : ''
                    }`
                  }
                }
              } catch {}
            }

            const coverPhoto =
              (clinic.pictures && clinic.pictures.length > 0 ? clinic.pictures[0] : null) || clinic.logoUrl

            return (
              <div
                key={clinic.id}
                className="group bg-white rounded-3xl border border-slate-200/80 hover:border-brand-400 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Clinic Photo Banner */}
                  <div className="relative w-full h-44 bg-slate-100 overflow-hidden">
                    {coverPhoto ? (
                      <img
                        src={coverPhoto}
                        alt={clinic.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-brand-700 via-brand-600 to-teal-600 flex items-center justify-center text-white">
                        <div className="text-center space-y-1">
                          <Building2 className="w-10 h-10 mx-auto opacity-80" />
                          <span className="text-xs font-bold tracking-wider uppercase opacity-90">
                            Dactor Healthcare Center
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Gradient Overlay for Legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-black/20" />

                    {/* Top Overlay Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm ${
                          isLab
                            ? 'bg-purple-600/90 text-white'
                            : isSingle
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-brand-600/90 text-white'
                        }`}
                      >
                        {isLab
                          ? 'Diagnostic Pathology Lab'
                          : isSingle
                          ? 'Single-Visit OPD'
                          : 'Multi-Specialty Polyclinic'}
                      </span>

                      <div className="flex items-center space-x-1.5">
                        {clinic.isOnBreak && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm">
                            On Break
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow-sm">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Verified
                        </span>
                      </div>
                    </div>

                    {/* Bottom Left Photo Count Indicator */}
                    {clinic.pictures && clinic.pictures.length > 1 && (
                      <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white flex items-center space-x-1">
                        <span>📷 {clinic.pictures.length} Photos</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-6 space-y-3">
                    {/* Match Reason Highlight Pill */}
                    {matchReason && (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-1.5 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{matchReason}</span>
                      </div>
                    )}

                    <div>
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-1">
                        {clinic.name}
                      </h3>

                      <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{clinic.addressText || 'Nepal'}</span>
                      </div>
                    </div>

                    {/* Operational Hours Strip */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>{hoursText}</span>
                    </div>

                    {/* Specialties Pills */}
                    {clinic.specialties && clinic.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {clinic.specialties.slice(0, 3).map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold"
                          >
                            {s}
                          </span>
                        ))}
                        {clinic.specialties.length > 3 && (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-medium">
                            +{clinic.specialties.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Distinct Action Buttons for the 3 Clinic Types */}
                <div className="p-6 pt-0 space-y-2">
                  {isLab ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => onSelectClinic(clinic.id, 'lab')}
                        className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-purple-700/20 flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <FlaskConical className="w-4 h-4" />
                        <span>Book Lab Tests (No Doctor Required)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectClinic(clinic.id, 'lab')}
                        className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                      >
                        View Test Catalog & Prices
                      </button>
                    </div>
                  ) : isSingle ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => onSelectClinic(clinic.id, 'opd')}
                        className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-emerald-700/20 flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Stethoscope className="w-4 h-4" />
                        <span>Book Specialist Consultation</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectClinic(clinic.id, 'opd')}
                        className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                      >
                        Single OPD Token
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => onSelectClinic(clinic.id, 'opd')}
                        className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold transition shadow-md shadow-brand-600/20 flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Users className="w-4 h-4" />
                        <span>Consult Specialists (Choose Doctor)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectClinic(clinic.id, 'opd')}
                        className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                      >
                        Follow-Up Visit (FREE with Code)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
