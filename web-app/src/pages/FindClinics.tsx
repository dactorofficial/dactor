import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Clinic } from '../types'
import { getClinics } from '../services/db'

interface FindClinicsProps {
  onSelectClinic: (clinicId: string) => void
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

  const filteredClinics = clinics.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.addressText && c.addressText.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.specialties && c.specialties.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase())))

    if (!matchesSearch) return false

    if (filterType === 'all') return true
    if (filterType === 'diagnostic_lab') return c.type === 'diagnostic_lab'
    if (filterType === 'polyclinic') return c.type !== 'diagnostic_lab'
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
          Find Healthcare Centers
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Verified Clinics & Diagnostic Labs
        </h1>
        <p className="text-sm text-slate-500 font-medium max-w-2xl">
          Search polyclinics for specialist OPD consultations or diagnostic pathology centers for blood tests and health checkup packages.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search input */}
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by clinic name, specialty, or location..."
            className="w-full px-4 py-3 pl-11 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:font-normal placeholder:text-slate-400"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === 'all'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Centers ({clinics.length})
          </button>
          <button
            onClick={() => setFilterType('polyclinic')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === 'polyclinic'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Polyclinics & OPD
          </button>
          <button
            onClick={() => setFilterType('diagnostic_lab')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === 'diagnostic_lab'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Diagnostic Labs & Pathology
          </button>
        </div>
      </div>

      {/* Clinics Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredClinics.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">No clinics found</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your search keywords or clear the category filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClinics.map((clinic) => {
            const isLab = clinic.type === 'diagnostic_lab'
            let hoursText = `Avg ~${clinic.avgConsultationTimeMinutes || 10} min / patient`
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

            return (
              <div
                key={clinic.id}
                className="group bg-white rounded-3xl border border-slate-200/80 hover:border-brand-300 p-6 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                        isLab
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {clinic.logoUrl ? (
                        <img
                          src={clinic.logoUrl}
                          alt={clinic.name}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : isLab ? (
                        <FlaskConical className="w-6 h-6" />
                      ) : (
                        clinic.name.charAt(0)
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {clinic.isOnBreak && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          On Break
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          isLab
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-brand-50 text-brand-800 border-brand-200'
                        }`}
                      >
                        {isLab ? 'Diagnostic Lab' : clinic.type === 'single_visit' ? 'Single-Visit OPD' : 'Multi-Visit OPD'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Address */}
                  <h3 className="text-xl font-black text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-1">
                    {clinic.name}
                  </h3>

                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{clinic.addressText || 'Nepal'}</span>
                  </div>

                  {/* Operational Hours Strip */}
                  <div className="mt-3.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    <span>{hoursText}</span>
                  </div>

                  {/* Specialties Pills */}
                  {clinic.specialties && clinic.specialties.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
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

                {/* Bottom CTA Button */}
                <div className="pt-6 mt-6 border-t border-slate-100">
                  <button
                    onClick={() => onSelectClinic(clinic.id)}
                    className={`w-full py-3 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-2 ${
                      isLab
                        ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                        : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20'
                    }`}
                  >
                    <span>{isLab ? 'Select Diagnostic Tests' : 'Book OPD Consultation'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
