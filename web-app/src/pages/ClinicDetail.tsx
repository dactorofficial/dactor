import React, { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Calendar,
  CheckCircle2,
  Stethoscope,
  FlaskConical,
  ShieldCheck,
  User,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Info,
  DollarSign,
} from 'lucide-react'
import { Clinic, Doctor, ClinicService, Slot, Appointment } from '../types'
import {
  getClinicById,
  getDoctorsByClinic,
  getClinicServices,
  getSlots,
  createAppointment,
  generate10DigitTrackingCode,
} from '../services/db'

interface ClinicDetailProps {
  clinicId: string
  onBack: () => void
  onOpenLiveQueue: (trackingCode: string) => void
}

export const ClinicDetail: React.FC<ClinicDetailProps> = ({
  clinicId,
  onBack,
  onOpenLiveQueue,
}) => {
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [services, setServices] = useState<ClinicService[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  // Active view tab: 'opd' or 'lab'
  const [activeTab, setActiveTab] = useState<'opd' | 'lab'>('opd')

  // OPD Selection
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('10:00 AM')

  // Diagnostic Lab Selection
  const [selectedTests, setSelectedTests] = useState<{ [serviceId: string]: boolean }>({})

  // Booking Form State
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [patientGender, setPatientGender] = useState('Male')
  const [patientMobile, setPatientMobile] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientNotes, setPatientNotes] = useState('')
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})
  const [submitting, setSubmitting] = useState(false)

  // Booking Success
  const [confirmedAppt, setConfirmedAppt] = useState<Appointment | null>(null)

  useEffect(() => {
    async function loadClinicData() {
      setLoading(true)
      try {
        const [cData, dData, sData] = await Promise.all([
          getClinicById(clinicId),
          getDoctorsByClinic(clinicId),
          getClinicServices(clinicId),
        ])

        setClinic(cData)
        setDoctors(dData)
        setServices(sData)

        if (cData?.type === 'diagnostic_lab') {
          setActiveTab('lab')
        } else {
          setActiveTab('opd')
        }

        if (dData.length > 0) {
          setSelectedDoctor(dData[0])
        }

        // Provide standard tests if none configured yet
        if (sData.length === 0 && (cData?.type === 'diagnostic_lab' || cData?.type === 'polyclinic')) {
          setServices([
            { id: 't1', clinicId, serviceName: 'Complete Blood Count (CBC)', price: 450, category: 'Hematology', isAvailable: true },
            { id: 't2', clinicId, serviceName: 'Lipid Profile (Cholesterol, HDL, LDL)', price: 850, category: 'Biochemistry', isAvailable: true },
            { id: 't3', clinicId, serviceName: 'Thyroid Function Test (TFT - T3, T4, TSH)', price: 950, category: 'Hormones', isAvailable: true },
            { id: 't4', clinicId, serviceName: 'Fasting Blood Sugar (FBS)', price: 150, category: 'Biochemistry', isAvailable: true },
            { id: 't5', clinicId, serviceName: 'Liver Function Test (LFT)', price: 800, category: 'Biochemistry', isAvailable: true },
            { id: 't6', clinicId, serviceName: 'Renal / Kidney Function Test (KFT / RFT)', price: 750, category: 'Biochemistry', isAvailable: true },
            { id: 't7', clinicId, serviceName: 'Urine Routine & Microscopic Examination', price: 200, category: 'Clinical Pathology', isAvailable: true },
            { id: 't8', clinicId, serviceName: 'Vitamin D (25-OH) Total', price: 1800, category: 'Immunoassay', isAvailable: true },
          ])
        }
      } catch (err) {
        console.error('Failed to load clinic details:', err)
      } finally {
        setLoading(false)
      }
    }
    loadClinicData()
  }, [clinicId])

  // Toggle selected test
  const toggleTest = (id: string) => {
    setSelectedTests((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Calculate total lab tests fee
  const selectedTestList = services.filter((s) => selectedTests[s.id])
  const calculatedLabFee = selectedTestList.reduce((acc, curr) => acc + curr.price, 0)

  // Validation
  const validateForm = () => {
    const errors: { [key: string]: string } = {}

    if (!patientName.trim()) {
      errors.name = 'Patient full name is strictly required.'
    }
    if (!patientMobile.trim() || patientMobile.replace(/\D/g, '').length < 8) {
      errors.mobile = 'Valid contact mobile number is required.'
    }
    if (!patientAge || isNaN(Number(patientAge)) || Number(patientAge) <= 0 || Number(patientAge) > 120) {
      errors.age = 'Please enter a valid age between 1 and 120.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle final appointment submission
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const code10 = generate10DigitTrackingCode()
      const totalFee = activeTab === 'lab' ? calculatedLabFee : (selectedDoctor?.consultationFee || 500)
      const testsSelectedNames = activeTab === 'lab' ? selectedTestList.map((t) => t.serviceName) : []

      const created = await createAppointment({
        clinicId,
        doctorId: activeTab === 'opd' ? selectedDoctor?.id : undefined,
        trackingCode10Digit: code10,
        patientName: patientName.trim(),
        patientAge: Number(patientAge),
        patientGender,
        patientMobile: patientMobile.trim(),
        patientEmail: patientEmail.trim() || undefined,
        appointmentDate: selectedDate,
        appointmentTime: selectedSlotTime,
        checkinStatus: 'waiting',
        paymentStatus: 'unpaid',
        feeAmount: totalFee,
        selectedTests: testsSelectedNames,
        notes: patientNotes.trim() || undefined,
      })

      if (created) {
        setConfirmedAppt(created)
      } else {
        alert('Could not book appointment. Please check connection.')
      }
    } catch (err) {
      console.error('Error creating booking:', err)
      alert('An error occurred during booking.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-bold">Loading clinic profile...</p>
      </div>
    )
  }

  if (!clinic) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Clinic Not Found</h2>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2.5 bg-brand-600 text-white font-bold rounded-xl"
        >
          Return to Clinics
        </button>
      </div>
    )
  }

  // Confirmation Success View
  if (confirmedAppt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-brand-100 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Booking Confirmed
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Appointment Token Generated!
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Your appointment is registered with {clinic.name}.
            </p>
          </div>

          {/* 10-Digit Code Showcase Box */}
          <div className="p-6 bg-gradient-to-br from-brand-50 to-teal-50 rounded-2xl border border-brand-200 text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Your 10-Digit Live Tracking Code
            </span>
            <div className="text-3xl sm:text-4xl font-black tracking-widest text-slate-900 font-mono">
              {confirmedAppt.trackingCode10Digit}
            </div>
            <p className="text-xs text-slate-600 font-medium pt-1">
              Use this code to check your live queue position or unlock lab reports.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl text-left text-xs">
            <div>
              <span className="text-slate-400 font-medium">Patient</span>
              <p className="font-bold text-slate-800 text-sm">{confirmedAppt.patientName}</p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Date & Time</span>
              <p className="font-bold text-slate-800 text-sm">
                {confirmedAppt.appointmentDate} • {confirmedAppt.appointmentTime}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Department / Type</span>
              <p className="font-bold text-slate-800 text-sm">
                {activeTab === 'lab' ? 'Diagnostic Pathology Lab' : 'OPD Doctor Consultation'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Total Fee Payable</span>
              <p className="font-bold text-brand-700 text-sm">Rs. {confirmedAppt.feeAmount}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => onOpenLiveQueue(confirmedAppt.trackingCode10Digit)}
              className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Track Live Queue Now</span>
            </button>
            <button
              onClick={onBack}
              className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-brand-700 transition-colors py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Clinics Directory</span>
      </button>

      {/* ========================================================= */}
      {/* CLINIC HERO BANNER & WORKING/BREAK HOURS (No Empty Space!) */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start space-x-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-brand-600 to-teal-500 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md shrink-0">
              {clinic.logoUrl ? (
                <img
                  src={clinic.logoUrl}
                  alt={clinic.name}
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : clinic.type === 'diagnostic_lab' ? (
                <FlaskConical className="w-10 h-10" />
              ) : (
                clinic.name.charAt(0)
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{clinic.name}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-800">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-brand-600" />
                  Verified Clinic
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{clinic.addressText || 'Kathmandu, Nepal'}</span>
                </span>
                {clinic.contactPhone && (
                  <span className="flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{clinic.contactPhone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Pills */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('opd')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'opd'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>OPD Doctor Desk</span>
            </button>
            <button
              onClick={() => setActiveTab('lab')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'lab'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>Diagnostic Tests ({services.length})</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* WORKING HOURS & BREAK HOURS STRIP (Replaces Empty Space!) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Working Hours */}
          <div className="p-4 bg-brand-50/60 rounded-2xl border border-brand-200/80 flex items-start space-x-3.5">
            <div className="p-2 bg-brand-100 text-brand-700 rounded-xl shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-brand-800 uppercase tracking-wider block">
                Daily Working Hours
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                08:00 AM – 07:30 PM
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Monday to Saturday (Full OPD & Lab)</p>
            </div>
          </div>

          {/* Break Hours */}
          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex items-start space-x-3.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Official Break Hours
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                01:00 PM – 02:00 PM
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Lunch & Doctor Sanitization Break</p>
            </div>
          </div>

          {/* Sunday & Emergency Hours */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start space-x-3.5">
            <div className="p-2 bg-slate-200 text-slate-700 rounded-xl shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Sunday & Evening Schedule
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                09:00 AM – 02:00 PM
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Sunday OPD Half-Day & Walk-Ins</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN CONTENT: OPD CONSULTATION VS DIAGNOSTIC LAB TESTS */}
      {/* ========================================================= */}
      {activeTab === 'opd' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Doctor Selection & Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900">Available Doctors & Specialists</h2>
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full">
                {doctors.length} Doctors on Roster
              </span>
            </div>

            {doctors.length === 0 ? (
              <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500">
                <Stethoscope className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="font-bold">No registered doctors currently available.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {doctors.map((doc) => {
                  const isSelected = selectedDoctor?.id === doc.id

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctor(doc)}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-brand-50/50 border-brand-400 shadow-md shadow-brand-500/10 ring-2 ring-brand-400/30'
                          : 'bg-white border-slate-200/80 hover:border-brand-300'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xl shrink-0">
                          {doc.profilePictureUrl ? (
                            <img
                              src={doc.profilePictureUrl}
                              alt={doc.fullName}
                              className="w-full h-full object-cover rounded-2xl"
                            />
                          ) : (
                            doc.fullName.charAt(0)
                          )}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-black text-slate-900">{doc.fullName}</h3>
                            {doc.isInClinic && (
                              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" title="In Clinic Now" />
                            )}
                          </div>
                          <p className="text-xs font-bold text-brand-700">
                            {doc.specialty || 'Consultant Physician'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {doc.education || 'MBBS, MD'} • {doc.startingPracticingYear ? `Practicing since ${doc.startingPracticingYear}` : `${doc.experienceYears || 5}+ Years Exp`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Consultation Fee</span>
                          <span className="text-base font-black text-slate-900">
                            Rs. {doc.consultationFee || 500}
                          </span>
                        </div>
                        <span
                          className={`mt-1 text-xs font-bold px-3 py-1 rounded-xl ${
                            isSelected
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Slot Selection & Appointment Trigger */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 sticky top-28">
              <h3 className="text-lg font-black text-slate-900">Book OPD Consultation</h3>

              {/* Date Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Select Date</label>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[0, 1, 2].map((offset) => {
                    const d = new Date()
                    d.setDate(d.getDate() + offset)
                    const iso = d.toISOString().split('T')[0]
                    const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short' })
                    const isSelected = selectedDate === iso

                    return (
                      <button
                        key={iso}
                        onClick={() => setSelectedDate(iso)}
                        className={`p-2.5 rounded-xl border font-bold transition-all ${
                          isSelected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="block text-[10px] opacity-80 uppercase">{label}</span>
                        <span className="text-xs font-black">{d.getDate()} {d.toLocaleDateString([], { month: 'short' })}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slot Time Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Select Time Slot</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['09:30 AM', '10:30 AM', '11:30 AM', '02:30 PM', '04:00 PM', '05:30 PM'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedSlotTime(t)}
                      className={`p-2.5 rounded-xl border font-bold transition-all ${
                        selectedSlotTime === t
                          ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Specialist:</span>
                  <span className="font-bold text-slate-900">{selectedDoctor?.fullName || 'Assigned Doctor'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Slot:</span>
                  <span className="font-bold text-slate-900">{selectedDate} at {selectedSlotTime}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span className="text-slate-700">Total Fee:</span>
                  <span className="text-brand-700 text-sm">Rs. {selectedDoctor?.consultationFee || 500}</span>
                </div>
              </div>

              <button
                onClick={() => setShowBookingModal(true)}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-2xl shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <span>Proceed to Patient Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* TAB B: DIAGNOSTIC LAB TESTS SELECTION (Live Calculated Fee) */
        /* ========================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Select Diagnostic Tests</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Check individual tests to assemble your test profile. Prices are set directly by the clinic.
                </p>
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                {selectedTestList.length} Selected
              </span>
            </div>

            {/* Test List with Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((srv) => {
                const isChecked = !!selectedTests[srv.id]

                return (
                  <div
                    key={srv.id}
                    onClick={() => toggleTest(srv.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-teal-50/60 border-teal-400 ring-2 ring-teal-400/30 shadow-xs'
                        : 'bg-white border-slate-200/80 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 leading-tight">
                          {srv.serviceName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {srv.category || 'Diagnostic'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-teal-700">Rs. {srv.price}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Lab Checkout Summary */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 sticky top-28">
              <h3 className="text-lg font-black text-slate-900">Lab Booking Summary</h3>

              {/* Selected Tests List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedTestList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tests selected yet. Please select at least one test from the left.</p>
                ) : (
                  selectedTestList.map((t) => (
                    <div key={t.id} className="flex justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-700 truncate max-w-[160px]">{t.serviceName}</span>
                      <span className="font-bold text-slate-900">Rs. {t.price}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Date selection for Lab */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Sample Collection Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              {/* Total Calculation */}
              <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Selected Tests ({selectedTestList.length}):</span>
                  <span>Rs. {calculatedLabFee}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sample Collection Fee:</span>
                  <span className="text-brand-700 font-bold">FREE</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-teal-200/80 font-black text-sm text-teal-900">
                  <span>Total Payable:</span>
                  <span>Rs. {calculatedLabFee}</span>
                </div>
              </div>

              <button
                disabled={selectedTestList.length === 0}
                onClick={() => setShowBookingModal(true)}
                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <span>Proceed to Patient Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PATIENT BOOKING MODAL (No Demo Data, Strict Validation) */}
      {/* ========================================================= */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Confirm Patient Details
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Enter the patient's verified details. These details are used to issue your 10-digit live token and verify lab reports.
            </p>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              {/* Patient Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Patient Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => {
                    setPatientName(e.target.value)
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' })
                  }}
                  placeholder="e.g. Ramesh Sharma"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                    formErrors.name
                      ? 'border-rose-500 bg-rose-50/50 focus:ring-rose-500'
                      : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-brand-500'
                  } focus:outline-none focus:ring-2`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Age and Gender Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Age <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => {
                      setPatientAge(e.target.value)
                      if (formErrors.age) setFormErrors({ ...formErrors, age: '' })
                    }}
                    placeholder="e.g. 32"
                    min="1"
                    max="120"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                      formErrors.age
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                  />
                  {formErrors.age && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.age}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Gender</label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={patientMobile}
                  onChange={(e) => {
                    setPatientMobile(e.target.value)
                    if (formErrors.mobile) setFormErrors({ ...formErrors, mobile: '' })
                  }}
                  placeholder="e.g. 98XXXXXXXX"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                    formErrors.mobile
                      ? 'border-rose-500 bg-rose-50/50'
                      : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-brand-500`}
                />
                {formErrors.mobile && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.mobile}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Medical Notes / Symptoms (Optional)
                </label>
                <textarea
                  rows={2}
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Describe any symptoms or recent medical history..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-brand-600/20"
                >
                  {submitting ? 'Confirming Token...' : 'Confirm & Generate Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
