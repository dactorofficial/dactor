import React, { useState, useEffect, useMemo } from 'react'
import {
  Stethoscope,
  Activity,
  Clock,
  UserCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronRight,
  RefreshCw,
  LogOut,
  LogIn,
  Search,
  Building2,
  Sparkles,
  Phone,
  ShieldCheck,
  FileText,
  Send,
  X,
  Sliders,
  Edit3,
  Award,
  Check,
  User,
  Coffee,
  AlertTriangle,
  Camera,
  MapPin,
  HelpCircle,
} from 'lucide-react'
import {
  Doctor,
  Appointment,
  Clinic,
  MedicalSpecialty,
  MedicalQualification,
} from '../types'
import {
  getDoctorByEmail,
  getDoctorById,
  updateDoctorPresence,
  updateAppointmentStatus,
  getDoctorAppointments,
  getAffiliatedClinicsForDoctor,
  createDoctor,
  updateDoctor,
  uploadClinicDocument,
  getMedicalSpecialties,
  getMedicalQualifications,
  checkEmailPortalAssociation,
  sendManualNotification,
  getClinics,
} from '../services/db'
import { compressImage } from '../utils/imageCompressor'
import { supabase } from '../lib/supabase'
import { signInWithFirebaseGoogle, signOutFirebase } from '../lib/firebase'

interface DoctorPortalProps {
  onLogout?: () => void
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ onLogout }) => {
  // Current Authenticated Doctor & Affiliated Clinic
  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null)
  const [affiliatedClinics, setAffiliatedClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null)

  // Auth / Navigation State Machine
  const [currentView, setCurrentView] = useState<
    'auth_screen' | 'register_form' | 'kyc_pending' | 'consultation_desk'
  >(() => {
    try {
      const savedDoc = localStorage.getItem('dactor_doctor_session')
      if (savedDoc) return 'consultation_desk'
      const pending = localStorage.getItem('dactor_doctor_pending_kyc')
      if (pending) return 'kyc_pending'
      return 'auth_screen'
    } catch {
      return 'auth_screen'
    }
  })

  const [verifiedEmail, setVerifiedEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('dactor_doctor_email') || ''
    } catch {
      return ''
    }
  })

  const [pendingDocData, setPendingDocData] = useState<{
    id: string
    email: string
    name: string
    nmcNumber: string
    specialty: string
    status: string
  } | null>(() => {
    try {
      const raw = localStorage.getItem('dactor_doctor_pending_kyc')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // Google OAuth Loading / Error
  const [firebaseLoading, setFirebaseLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [checkingKyc, setCheckingKyc] = useState(false)
  const [kycCheckMsg, setKycCheckMsg] = useState<string | null>(null)

  // Desk State
  const [deskTab, setDeskTab] = useState<'today_queue' | 'future_appts' | 'profile_settings'>('today_queue')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingAppts, setLoadingAppts] = useState(false)
  const [selectedFutureDate, setSelectedFutureDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })

  // Presence State
  const [isInCabin, setIsInCabin] = useState<boolean>(true)
  const [updatingPresence, setUpdatingPresence] = useState(false)

  // Alert Modal State
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [alertTargetAppt, setAlertTargetAppt] = useState<Appointment | null>(null)
  const [alertTitle, setAlertTitle] = useState('')
  const [alertMessage, setAlertMessage] = useState('')
  const [sendingAlert, setSendingAlert] = useState(false)
  const [alertSuccess, setAlertSuccess] = useState(false)

  // Profile Edit State
  const [editFee, setEditFee] = useState<number>(500)
  const [editPublicPhone, setEditPublicPhone] = useState('')
  const [editBio, setEditBio] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false)

  // ==========================================
  // REGISTRATION & KYC FORM FIELDS
  // ==========================================
  const [regName, setRegName] = useState('')
  const [regGender, setRegGender] = useState('Male')
  const [regAge, setRegAge] = useState('')
  const [regStartingYear, setRegStartingYear] = useState<number>(2020)
  const [regSpecialty, setRegSpecialty] = useState('General Physician')
  const [regEducation, setRegEducation] = useState('MBBS, MD')
  const [regNmc, setRegNmc] = useState('')
  const [regPersonalPhone, setRegPersonalPhone] = useState('')
  const [regPublicPhone, setRegPublicPhone] = useState('')
  const [regClinicId, setRegClinicId] = useState('')
  const [regFee, setRegFee] = useState(500)
  const [regDesc, setRegDesc] = useState('')
  const [regPhotoFile, setRegPhotoFile] = useState<File | null>(null)
  const [regLicenseFile, setRegLicenseFile] = useState<File | null>(null)
  const [regDegreeFile, setRegDegreeFile] = useState<File | null>(null)
  const [regTermsAccepted, setRegTermsAccepted] = useState(false)
  const [regErrors, setRegErrors] = useState<{ [key: string]: string }>({})
  const [submittingReg, setSubmittingReg] = useState(false)
  const [regStatusMsg, setRegStatusMsg] = useState<string | null>(null)

  // Taxonomies
  const [specialtiesList, setSpecialtiesList] = useState<MedicalSpecialty[]>([])
  const [qualificationsList, setQualificationsList] = useState<MedicalQualification[]>([])
  const [allClinics, setAllClinics] = useState<Clinic[]>([])

  // Load initial taxonomies and existing session
  useEffect(() => {
    async function init() {
      try {
        const [specs, quals, cls] = await Promise.all([
          getMedicalSpecialties(),
          getMedicalQualifications(),
          getClinics(),
        ])
        setSpecialtiesList(specs)
        setQualificationsList(quals)
        setAllClinics(cls)

        // If saved doctor session exists, reload fresh doctor record
        const savedDocRaw = localStorage.getItem('dactor_doctor_session')
        if (savedDocRaw) {
          const parsed = JSON.parse(savedDocRaw)
          if (parsed?.id) {
            const fresh = await getDoctorById(parsed.id)
            if (fresh) {
              const kStatus = (fresh.kycStatus || 'approved').toLowerCase()
              if (kStatus === 'approved' || kStatus === 'verified') {
                setCurrentDoctor(fresh)
                setIsInCabin(fresh.isInClinic ?? true)
                setEditFee(fresh.consultationFee || 500)
                setEditPublicPhone(fresh.publicMobileNumber || '')
                setEditBio(fresh.description || '')
                setCurrentView('consultation_desk')
                loadDoctorClinicsAndAppointments(fresh)
              } else {
                setPendingDocData({
                  id: fresh.id,
                  email: fresh.email || '',
                  name: fresh.fullName,
                  nmcNumber: fresh.nmcLicenseNumber || '',
                  specialty: fresh.specialty || '',
                  status: kStatus,
                })
                setCurrentView('kyc_pending')
              }
            }
          }
        }
      } catch (err) {
        console.error('DoctorPortal init error:', err)
      }
    }
    init()
  }, [])

  // Load affiliated clinics and appointments for the doctor
  const loadDoctorClinicsAndAppointments = async (doctor: Doctor) => {
    setLoadingAppts(true)
    try {
      const clinics = await getAffiliatedClinicsForDoctor(doctor.id)
      setAffiliatedClinics(clinics)
      const primaryClinic =
        clinics.find((c) => c.id === (doctor.activeClinicId || doctor.clinicId)) ||
        clinics[0] ||
        null
      setSelectedClinic(primaryClinic)

      const todayStr = new Date().toISOString().split('T')[0]
      const appts = await getDoctorAppointments(doctor.id)
      setAppointments(appts)
    } catch (err) {
      console.error('Error loading doctor data:', err)
    } finally {
      setLoadingAppts(false)
    }
  }

  // Realtime subscription for queue updates for this doctor
  useEffect(() => {
    if (!currentDoctor) return

    const channel = supabase
      .channel(`doctor-queue-${currentDoctor.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async () => {
        const appts = await getDoctorAppointments(currentDoctor.id)
        setAppointments(appts)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, async () => {
        const appts = await getDoctorAppointments(currentDoctor.id)
        setAppointments(appts)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentDoctor])

  // Save session helper
  const saveDoctorSession = (doctor: Doctor) => {
    try {
      localStorage.setItem('dactor_doctor_session', JSON.stringify(doctor))
      localStorage.setItem('dactor_doctor_email', doctor.email || '')
      localStorage.setItem('dactor_auth_logged_in', 'true')
      localStorage.setItem('dactor_auth_email', doctor.email || '')
      localStorage.setItem('dactor_auth_role', 'doctor')
      window.dispatchEvent(new Event('storage'))
    } catch {}
  }

  // Pure Google Sign-In with Role Exclusivity Check
  const handleGoogleSignIn = async () => {
    setFirebaseLoading(true)
    setAuthError(null)

    try {
      await signOutFirebase().catch(() => {})
      const googleUser = await signInWithFirebaseGoogle()
      if (!googleUser || !googleUser.email) {
        throw new Error('Google sign-in did not return user credentials.')
      }

      const trimmedEmail = googleUser.email.trim().toLowerCase()
      setVerifiedEmail(trimmedEmail)

      // 1. Enforce strict single-account exclusivity
      const assoc = await checkEmailPortalAssociation(trimmedEmail)
      if (assoc && assoc.portal !== 'doctor') {
        await signOutFirebase().catch(() => {})
        setAuthError(
          `This Google account (${trimmedEmail}) is already registered as a ${assoc.portalLabel} account. Under Dactor rules, an account cannot be used across multiple portals. Please sign in with your Doctor Google account.`
        )
        return
      }

      // 2. Check if doctor already exists
      const existing = await getDoctorByEmail(trimmedEmail)
      if (existing) {
        const kStatus = (existing.kycStatus || 'approved').toLowerCase()
        if (kStatus === 'approved' || kStatus === 'verified') {
          setCurrentDoctor(existing)
          setIsInCabin(existing.isInClinic ?? true)
          setEditFee(existing.consultationFee || 500)
          setEditPublicPhone(existing.publicMobileNumber || '')
          setEditBio(existing.description || '')
          saveDoctorSession(existing)
          setCurrentView('consultation_desk')
          await loadDoctorClinicsAndAppointments(existing)
        } else {
          const pending = {
            id: existing.id,
            email: trimmedEmail,
            name: existing.fullName,
            nmcNumber: existing.nmcLicenseNumber || '',
            specialty: existing.specialty || '',
            status: kStatus,
          }
          setPendingDocData(pending)
          localStorage.setItem('dactor_doctor_pending_kyc', JSON.stringify(pending))
          setCurrentView('kyc_pending')
        }
      } else {
        // Unregistered doctor -> open KYC registration form
        setRegName(googleUser.displayName ? `Dr. ${googleUser.displayName.replace(/^Dr\.?\s*/i, '')}` : '')
        setCurrentView('register_form')
      }
    } catch (err: any) {
      console.warn('Doctor Google sign-in notice:', err)
      const errCode = err?.code || ''
      if (errCode === 'auth/popup-closed-by-user' || err?.message?.includes('closed-by-user')) {
        setAuthError('Sign-in popup was closed before completing. Please try again.')
      } else if (errCode === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.')
      } else {
        setAuthError(err?.message || 'Failed to authenticate with Google. Please try again.')
      }
    } finally {
      setFirebaseLoading(false)
    }
  }

  // Refresh KYC Status
  const handleCheckKycStatus = async () => {
    if (!pendingDocData) return
    setCheckingKyc(true)
    setKycCheckMsg(null)
    try {
      const refreshed = pendingDocData.id
        ? await getDoctorById(pendingDocData.id)
        : await getDoctorByEmail(pendingDocData.email)

      if (refreshed) {
        const kStatus = (refreshed.kycStatus || 'pending').toLowerCase()
        if (kStatus === 'approved' || kStatus === 'verified') {
          localStorage.removeItem('dactor_doctor_pending_kyc')
          setCurrentDoctor(refreshed)
          setIsInCabin(refreshed.isInClinic ?? true)
          saveDoctorSession(refreshed)
          setCurrentView('consultation_desk')
          await loadDoctorClinicsAndAppointments(refreshed)
        } else {
          setPendingDocData({ ...pendingDocData, status: kStatus })
          localStorage.setItem(
            'dactor_doctor_pending_kyc',
            JSON.stringify({ ...pendingDocData, status: kStatus })
          )
          setKycCheckMsg('Status checked: Medical KYC is still under regulatory review.')
        }
      } else {
        setKycCheckMsg('Doctor record not found. Please re-register.')
      }
    } catch (err: any) {
      setKycCheckMsg(err?.message || 'Failed to check verification status')
    } finally {
      setCheckingKyc(false)
    }
  }

  // Submit Doctor Registration Form
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: { [key: string]: string } = {}

    if (regName.trim().length < 3) errors.name = 'Full name must be at least 3 characters.'
    const parsedAge = parseInt(regAge, 10)
    if (isNaN(parsedAge) || parsedAge < 20 || parsedAge > 100) errors.age = 'Age must be between 20 and 100.'
    if (regNmc.trim().length < 3) errors.nmc = 'Nepal Medical Council (NMC) license number is required.'
    const cleanPersonal = regPersonalPhone.replace(/\D/g, '')
    if (cleanPersonal.length !== 10 || !cleanPersonal.startsWith('9')) {
      errors.personalPhone = 'Personal mobile must be a valid 10-digit number starting with 9.'
    }
    if (!regTermsAccepted) {
      errors.terms = 'You must accept the NMC Code of Ethics & Telehealth terms.'
    }

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors)
      return
    }

    setSubmittingReg(true)
    setRegStatusMsg('Compressing certificates and uploading KYC documents...')

    try {
      let photoUrl: string | undefined
      if (regPhotoFile) {
        const compressed = await compressImage(regPhotoFile, 400)
        photoUrl =
          (await uploadClinicDocument(`doc_photo_${regPhotoFile.name}`, compressed, 'doctor_photos')) ||
          undefined
      }

      let licenseDocUrl: string | undefined
      if (regLicenseFile) {
        const compressed = await compressImage(regLicenseFile, 500)
        licenseDocUrl =
          (await uploadClinicDocument(`nmc_${regLicenseFile.name}`, compressed, 'doctor_kyc_docs')) ||
          undefined
      }

      const cleanPublic = regPublicPhone.replace(/\D/g, '')

      const payload: Partial<Doctor> = {
        fullName: regName.trim().startsWith('Dr.') ? regName.trim() : `Dr. ${regName.trim()}`,
        email: verifiedEmail.trim(),
        gender: regGender,
        age: parsedAge,
        startingPracticingYear: regStartingYear,
        specialty: regSpecialty,
        specialties: [regSpecialty],
        education: regEducation,
        nmcLicenseNumber: regNmc.trim(),
        personalMobileNumber: cleanPersonal,
        publicMobileNumber: cleanPublic || undefined,
        clinicId: regClinicId || undefined,
        activeClinicId: regClinicId || undefined,
        consultationFee: regFee || 500,
        description: regDesc.trim() || undefined,
        profilePictureUrl: photoUrl,
        kycStatus: 'pending',
        isInClinic: true,
      }

      setRegStatusMsg('Saving verified practitioner KYC to Supabase...')
      const created = await createDoctor(payload)
      if (!created) throw new Error('Failed to create doctor profile.')

      const pending = {
        id: created.id,
        email: verifiedEmail.trim(),
        name: created.fullName,
        nmcNumber: created.nmcLicenseNumber || '',
        specialty: created.specialty || '',
        status: 'pending',
      }
      setPendingDocData(pending)
      localStorage.setItem('dactor_doctor_pending_kyc', JSON.stringify(pending))
      setCurrentView('kyc_pending')
    } catch (err: any) {
      console.error('Registration error:', err)
      setRegErrors({ form: err?.message || 'Failed to submit doctor registration.' })
    } finally {
      setSubmittingReg(false)
    }
  }

  // Toggle Doctor Presence in Cabin
  const handleTogglePresence = async () => {
    if (!currentDoctor) return
    const nextState = !isInCabin
    setUpdatingPresence(true)
    try {
      const ok = await updateDoctorPresence(currentDoctor.id, nextState)
      if (ok) {
        setIsInCabin(nextState)
        setCurrentDoctor({ ...currentDoctor, isInClinic: nextState })
      }
    } catch (err) {
      console.error('Error updating presence:', err)
    } finally {
      setUpdatingPresence(false)
    }
  }

  // Consultation Status Update Actions
  const handleMarkInsideCabin = async (appt: Appointment) => {
    if (!currentDoctor) return
    try {
      await updateAppointmentStatus(appt.id, 'in_consultation')
      const refreshed = await getDoctorAppointments(currentDoctor.id)
      setAppointments(refreshed)
    } catch (err) {
      console.error('Error updating to inside cabin:', err)
    }
  }

  const handleMarkCompleted = async (appt: Appointment) => {
    if (!currentDoctor) return
    try {
      await updateAppointmentStatus(appt.id, 'completed')
      const refreshed = await getDoctorAppointments(currentDoctor.id)
      setAppointments(refreshed)
    } catch (err) {
      console.error('Error completing consultation:', err)
    }
  }

  // Send Direct Alert Notification to Patient
  const handleSendPatientAlert = async () => {
    if (!alertTargetAppt || !alertTitle.trim() || !alertMessage.trim()) return
    setSendingAlert(true)
    try {
      await sendManualNotification(
        alertTargetAppt.id,
        alertTitle.trim(),
        alertMessage.trim(),
        undefined,
        undefined,
        alertTargetAppt.trackingCode10Digit,
        alertTargetAppt.userId || undefined,
        alertTargetAppt.clinicId
      )
      setAlertSuccess(true)
      setTimeout(() => {
        setAlertSuccess(false)
        setAlertModalOpen(false)
        setAlertTargetAppt(null)
        setAlertTitle('')
        setAlertMessage('')
      }, 1500)
    } catch (err) {
      console.error('Error sending alert:', err)
    } finally {
      setSendingAlert(false)
    }
  }

  // Save Doctor Profile Settings
  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentDoctor) return
    setSavingProfile(true)
    try {
      const ok = await updateDoctor(currentDoctor.id, {
        consultationFee: editFee,
        publicMobileNumber: editPublicPhone.replace(/\D/g, ''),
        description: editBio.trim(),
      })
      if (ok) {
        setCurrentDoctor({
          ...currentDoctor,
          consultationFee: editFee,
          publicMobileNumber: editPublicPhone,
          description: editBio,
        })
        setProfileSaveSuccess(true)
        setTimeout(() => setProfileSaveSuccess(false), 2500)
      }
    } catch (err) {
      console.error('Error saving doctor profile:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('dactor_doctor_session')
    localStorage.removeItem('dactor_doctor_email')
    localStorage.removeItem('dactor_doctor_pending_kyc')
    localStorage.removeItem('dactor_auth_logged_in')
    localStorage.removeItem('dactor_auth_email')
    localStorage.removeItem('dactor_auth_role')
    setCurrentDoctor(null)
    setCurrentView('auth_screen')
    signOutFirebase().catch(() => {})
    window.dispatchEvent(new Event('storage'))
    if (onLogout) onLogout()
  }

  // Queue Analytics
  const todayDateStr = new Date().toISOString().split('T')[0]
  const todayAppointments = useMemo(
    () => appointments.filter((a) => a.appointmentDate === todayDateStr),
    [appointments, todayDateStr]
  )
  const waitingPatients = useMemo(
    () => todayAppointments.filter((a) => a.checkinStatus === 'waiting'),
    [todayAppointments]
  )
  const currentInsidePatient = useMemo(
    () =>
      todayAppointments.find(
        (a) => a.checkinStatus === 'in_consultation' || a.checkinStatus === 'inside'
      ),
    [todayAppointments]
  )
  const completedPatients = useMemo(
    () => todayAppointments.filter((a) => a.checkinStatus === 'completed'),
    [todayAppointments]
  )
  const futureAppointments = useMemo(
    () => appointments.filter((a) => a.appointmentDate === selectedFutureDate),
    [appointments, selectedFutureDate]
  )

  // ==========================================
  // VIEW 1: DEDICATED DOCTOR AUTH / SIGN-IN
  // ==========================================
  if (currentView === 'auth_screen') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200/80 text-center space-y-6">
          {/* Brand Icon */}
          <div className="w-16 h-16 rounded-3xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto shadow-inner">
            <Stethoscope className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Official Dactor Practitioner Network
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Doctor Consultation Desk
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Dedicated portal for licensed medical doctors & practitioners. Manage live cabin presence, review today's patient queue, call tokens, and maintain consultation history.
            </p>
          </div>

          {/* Account Exclusivity Notice */}
          <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-left space-y-1">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Strict Single-Role Account Security</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Your Google account is exclusively bound to your Doctor profile. A single account cannot be shared with Clinic or Patient portals.
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium text-left flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Access Restricted</span>
                <p className="leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={firebaseLoading}
            className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 font-black rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-3 text-xs cursor-pointer disabled:opacity-60"
          >
            {firebaseLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-brand-600" />
                <span>Verifying Doctor Account with Supabase...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google (Doctor Account)</span>
              </>
            )}
          </button>

          {/* New Practitioner Onboarding Prompt */}
          <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div>
              <div className="text-xs font-black text-brand-900">
                New Medical Practitioner on Dactor?
              </div>
              <p className="text-[11px] text-slate-600">
                Sign in with Google above to submit your NMC license & degrees for verification.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-sm transition-all"
            >
              Start KYC Registration →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: KYC PENDING REVIEW SCREEN
  // ==========================================
  if (currentView === 'kyc_pending' && pendingDocData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-amber-200/80 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              Registration Under Review
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Medical KYC Awaiting Regulatory Verification
            </h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Your doctor application has been submitted to the Dactor Medical Accreditation Board. We verify Nepal Medical Council (NMC) registration before activating consultation desks.
            </p>
          </div>

          {/* Submitted Profile Summary Card */}
          <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-amber-200/60 font-bold text-amber-950">
              <span>Practitioner Name</span>
              <span className="font-black text-slate-900">{pendingDocData.name}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-amber-200/60 font-bold text-amber-950">
              <span>NMC License Number</span>
              <span className="font-mono font-black text-slate-900">{pendingDocData.nmcNumber}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-amber-200/60 font-bold text-amber-950">
              <span>Medical Specialty</span>
              <span className="font-black text-slate-900">{pendingDocData.specialty}</span>
            </div>
            <div className="flex justify-between items-center font-bold text-amber-950">
              <span>Registered Google Email</span>
              <span className="font-mono text-slate-700">{pendingDocData.email}</span>
            </div>
          </div>

          {kycCheckMsg && (
            <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 text-xs text-center font-bold">
              {kycCheckMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleCheckKycStatus}
              disabled={checkingKyc}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checkingKyc ? 'animate-spin' : ''}`} />
              <span>Check Verification Status Now</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-2xl transition-all text-xs cursor-pointer flex items-center justify-center space-x-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out & Switch Account</span>
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
            <p className="text-[11px] text-slate-500">
              Medical KYC approvals complete within 12-24 business hours. For urgent hospital roster deployment, contact Dactor Practitioner Support at{' '}
              <span className="font-bold text-slate-700">dactorofficial@gmail.com</span>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 3: DOCTOR REGISTRATION & KYC FORM
  // ==========================================
  if (currentView === 'register_form') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200 space-y-6">
          <div className="text-left space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              Step 2 of 2: Medical Accreditation
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Doctor Registration & NMC KYC Form
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Submit your medical qualifications and NMC registration number. Verified doctors receive full desk access and high trust rating on patient discovery cards.
            </p>
          </div>

          <div className="p-3.5 bg-brand-50 rounded-2xl border border-brand-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-brand-900">Verified Google ID:</span>
              <span className="font-mono text-brand-700">{verifiedEmail}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-brand-600 hover:text-brand-800 font-bold underline cursor-pointer text-[11px]"
            >
              Change Account
            </button>
          </div>

          {regErrors.form && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
              {regErrors.form}
            </div>
          )}

          <form onSubmit={handleSubmitRegistration} className="space-y-6 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Doctor Full Name (with Dr. prefix) *
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Dr. Anubhav Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {regErrors.name && <p className="text-[11px] text-rose-600 mt-1">{regErrors.name}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  NMC License Registration Number *
                </label>
                <input
                  type="text"
                  value={regNmc}
                  onChange={(e) => setRegNmc(e.target.value)}
                  placeholder="e.g. 18452-MED"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {regErrors.nmc && <p className="text-[11px] text-rose-600 mt-1">{regErrors.nmc}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Medical Specialty *</label>
                <select
                  value={regSpecialty}
                  onChange={(e) => setRegSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {specialtiesList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {specialtiesList.length === 0 && (
                    <>
                      <option value="General Physician">General Physician</option>
                      <option value="Cardiology (Heart Care)">Cardiology (Heart Care)</option>
                      <option value="Pediatrics & Child Health">Pediatrics & Child Health</option>
                      <option value="Orthopedics & Joint Care">Orthopedics & Joint Care</option>
                      <option value="Dermatology & Skin Care">Dermatology & Skin Care</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Qualification / Degree *</label>
                <select
                  value={regEducation}
                  onChange={(e) => setRegEducation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {qualificationsList.map((q) => (
                    <option key={q.id} value={q.degreeName}>
                      {q.degreeName} ({q.fullTitle})
                    </option>
                  ))}
                  {qualificationsList.length === 0 && (
                    <>
                      <option value="MBBS">MBBS</option>
                      <option value="MBBS, MD">MBBS, MD</option>
                      <option value="MS - General Surgery">MS - General Surgery</option>
                      <option value="BDS">BDS</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Practicing Since Year</label>
                <input
                  type="number"
                  min="1970"
                  max={new Date().getFullYear()}
                  value={regStartingYear}
                  onChange={(e) => setRegStartingYear(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Gender *</label>
                <select
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Age *</label>
                <input
                  type="number"
                  value={regAge}
                  onChange={(e) => setRegAge(e.target.value)}
                  placeholder="e.g. 36"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {regErrors.age && <p className="text-[11px] text-rose-600 mt-1">{regErrors.age}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Standard OPD Fee (NPR)</label>
                <input
                  type="number"
                  value={regFee}
                  onChange={(e) => setRegFee(parseInt(e.target.value, 10) || 500)}
                  placeholder="500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Personal Mobile Number (Private) *
                </label>
                <input
                  type="tel"
                  value={regPersonalPhone}
                  onChange={(e) => setRegPersonalPhone(e.target.value)}
                  placeholder="98XXXXXXXX (10 digits)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {regErrors.personalPhone && (
                  <p className="text-[11px] text-rose-600 mt-1">{regErrors.personalPhone}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Clinic Affiliation (Optional)
                </label>
                <select
                  value={regClinicId}
                  onChange={(e) => setRegClinicId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">Independent / Multi-Clinic Practice</option>
                  {allClinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.addressText || 'Nepal'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Camera className="w-4 h-4 text-brand-600" />
                  <span>Doctor Profile Picture (Optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRegPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-brand-50 file:text-brand-700 file:font-bold hover:file:bg-brand-100 cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-brand-600" />
                  <span>NMC Certificate Document / Photo *</span>
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setRegLicenseFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-brand-50 file:text-brand-700 file:font-bold hover:file:bg-brand-100 cursor-pointer"
                />
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="pt-2">
              <label className="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regTermsAccepted}
                  onChange={(e) => setRegTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                />
                <span>
                  I declare under penalty of law that I am an actively registered medical practitioner with the Nepal Medical Council (NMC) and agree to Dactor's ethical code and live OPD privacy standards.
                </span>
              </label>
              {regErrors.terms && <p className="text-[11px] text-rose-600 mt-1">{regErrors.terms}</p>}
            </div>

            {regStatusMsg && (
              <div className="p-3 bg-brand-50 text-brand-800 font-bold text-xs rounded-xl flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{regStatusMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingReg}
              className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-2xl shadow-lg shadow-brand-600/20 text-xs sm:text-sm cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center space-x-2"
            >
              {submittingReg ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting KYC to Supabase...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Doctor KYC for Verification →</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 4: ACTIVE DOCTOR CONSULTATION DESK
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner / Doctor Context Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-black text-xl shrink-0 overflow-hidden border border-brand-200">
            {currentDoctor?.profilePictureUrl ? (
              <img
                src={currentDoctor.profilePictureUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Stethoscope className="w-7 h-7" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {currentDoctor?.fullName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>NMC: {currentDoctor?.nmcLicenseNumber || 'Verified'}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-100 text-brand-800">
                {currentDoctor?.specialty || 'General Physician'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span>{currentDoctor?.education || 'MBBS, MD'}</span>
              <span>•</span>
              <span>Logged in: <strong className="text-slate-700">{currentDoctor?.email}</strong></span>
              {selectedClinic && (
                <>
                  <span>•</span>
                  <span className="font-bold text-brand-700 flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{selectedClinic.name}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Doctor Presence Toggle & Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Clinic Switcher (if doctor practices at multiple facilities) */}
          {affiliatedClinics.length > 1 && (
            <select
              value={selectedClinic?.id || ''}
              onChange={(e) => {
                const found = affiliatedClinics.find((c) => c.id === e.target.value)
                if (found) setSelectedClinic(found)
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {affiliatedClinics.map((c) => (
                <option key={c.id} value={c.id}>
                  Clinic: {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Real In-Cabin Presence Switch */}
          <button
            onClick={handleTogglePresence}
            disabled={updatingPresence}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
              isInCabin
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
            }`}
            title="Click to toggle In-Cabin Presence. Live queues update immediately across website and mobile apps."
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isInCabin ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{isInCabin ? 'Doctor is In Cabin' : 'Doctor is Away (Out)'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setDeskTab('today_queue')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'today_queue'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Today's Consultation Queue ({waitingPatients.length} Waiting)</span>
        </button>

        <button
          onClick={() => setDeskTab('future_appts')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'future_appts'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Upcoming Schedule & Dates</span>
        </button>

        <button
          onClick={() => setDeskTab('profile_settings')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'profile_settings'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Practitioner Profile & Fees</span>
        </button>
      </div>

      {/* ==========================================
          TAB 1: TODAY'S CONSULTATION QUEUE
          ========================================== */}
      {deskTab === 'today_queue' && (
        <div className="space-y-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{waitingPatients.length}</div>
                <div className="text-xs text-slate-500 font-bold">Waiting in OPD Lobby</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {currentInsidePatient ? '1 Inside' : 'None Inside'}
                </div>
                <div className="text-xs text-slate-500 font-bold">Currently in Cabin</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{completedPatients.length}</div>
                <div className="text-xs text-slate-500 font-bold">Completed Consultations</div>
              </div>
            </div>
          </div>

          {/* ACTIVE IN-CABIN PATIENT HERO CARD */}
          {currentInsidePatient && (
            <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-sky-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-brand-700/60 pb-4">
                <div className="flex items-center space-x-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    Currently Inside Cabin
                  </span>
                </div>
                <span className="font-mono text-xs px-3 py-1 rounded-full bg-white/10 text-cyan-100 border border-white/20">
                  Universal Token: {currentInsidePatient.trackingCode10Digit}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-3xl font-black text-white">
                    {currentInsidePatient.patientName}
                  </div>
                  <p className="text-xs text-cyan-200 mt-1">
                    {currentInsidePatient.patientAge ? `${currentInsidePatient.patientAge} Yrs` : ''}{' '}
                    {currentInsidePatient.patientGender ? `• ${currentInsidePatient.patientGender}` : ''}{' '}
                    • Mobile: {currentInsidePatient.patientMobile || 'N/A'}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-cyan-200">Token Number</div>
                  <div className="text-2xl font-black text-white font-mono">
                    Token #{String(currentInsidePatient.queueNumber).padStart(2, '0')}
                  </div>
                  <p className="text-xs text-cyan-200 mt-1">
                    {currentInsidePatient.appointmentTime || 'Immediate Walk-In'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAlertTargetAppt(currentInsidePatient)
                      setAlertTitle(`Doctor Cabin Alert • ${currentDoctor?.fullName}`)
                      setAlertMessage('Your consultation is ongoing. Please remain inside cabin.')
                      setAlertModalOpen(true)
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Alert</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkCompleted(currentInsidePatient)}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Consultation Completed</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WAITING QUEUE PATIENTS LIST */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Waiting Patients Queue</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patients currently waiting outside your cabin for today's OPD consultation.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {waitingPatients.length} In Queue
              </span>
            </div>

            {waitingPatients.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-800">No Waiting Patients in Lobby</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All booked and walk-in OPD patients for today have completed consultations or no patients are currently checked in.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {waitingPatients.map((appt, idx) => (
                  <div
                    key={appt.id}
                    className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 flex flex-col items-center justify-center font-mono font-black shrink-0">
                        <span className="text-[10px] text-brand-500 uppercase leading-none">Token</span>
                        <span className="text-base leading-none">
                          #{String(appt.queueNumber || idx + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-black text-slate-900">{appt.patientName}</h4>
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {appt.trackingCode10Digit}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {appt.patientAge ? `${appt.patientAge} Yrs` : ''}{' '}
                          {appt.patientGender ? `• ${appt.patientGender}` : ''}{' '}
                          • Mobile: {appt.patientMobile || 'N/A'}{' '}
                          {appt.appointmentTime ? `• Slot: ${appt.appointmentTime}` : ''}
                        </p>
                        {appt.notes && (
                          <p className="text-[11px] text-brand-700 font-medium">Notes: {appt.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setAlertTargetAppt(appt)
                          setAlertTitle(`Your Turn is Next • Dr. ${currentDoctor?.fullName}`)
                          setAlertMessage(
                            `Token #${appt.queueNumber}: Please proceed towards Dr. ${currentDoctor?.fullName}'s cabin.`
                          )
                          setAlertModalOpen(true)
                        }}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                        title="Send Push Alert to Patient"
                      >
                        <Send className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkInsideCabin(appt)}
                        className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Call to Cabin</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPLETED PATIENTS ACCORDION / LIST */}
          {completedPatients.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">
                  Completed Today ({completedPatients.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {completedPatients.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.patientName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Token #{c.queueNumber} • {c.trackingCode10Digit}
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 2: FUTURE UPCOMING SCHEDULE
          ========================================== */}
      {deskTab === 'future_appts' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Upcoming Appointments Calendar</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review advance bookings and slots reserved by patients for upcoming dates.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600">Select Date:</label>
              <input
                type="date"
                value={selectedFutureDate}
                onChange={(e) => setSelectedFutureDate(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {futureAppointments.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">
                No Advance Bookings on {selectedFutureDate}
              </h4>
              <p className="text-xs text-slate-400">
                Patients who book slots online for this date will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {futureAppointments.map((appt) => (
                <div key={appt.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{appt.patientName}</span>
                    <span className="text-slate-500 ml-2">Slot: {appt.appointmentTime}</span>
                  </div>
                  <span className="font-mono text-slate-600">{appt.trackingCode10Digit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 3: PRACTITIONER PROFILE & SETTINGS
          ========================================== */}
      {deskTab === 'profile_settings' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 max-w-2xl mx-auto">
          <div className="text-left space-y-1">
            <h3 className="text-lg font-black text-slate-900">Practitioner Profile & Rates</h3>
            <p className="text-xs text-slate-500">
              Update your public consultation fees and bio displayed on patient booking screens.
            </p>
          </div>

          <form onSubmit={handleSaveProfileSettings} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Standard Consultation Fee (NPR)
              </label>
              <input
                type="number"
                value={editFee}
                onChange={(e) => setEditFee(parseInt(e.target.value, 10) || 500)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Public Reception Phone (For Patients)
              </label>
              <input
                type="tel"
                value={editPublicPhone}
                onChange={(e) => setEditPublicPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Professional Bio & Specializations
              </label>
              <textarea
                rows={4}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Summarize your clinical experience, special procedures, and hospital affiliations..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {profileSaveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Profile updated successfully in Supabase!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-md text-xs cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center space-x-2"
            >
              {savingProfile ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Practitioner Settings</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* PUSH ALERT MODAL */}
      {alertModalOpen && alertTargetAppt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-brand-600" />
                <h3 className="text-base font-black text-slate-900">Push Alert to Patient</h3>
              </div>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-brand-50 rounded-xl text-xs space-y-1">
              <div className="font-bold text-brand-900">
                Recipient: {alertTargetAppt.patientName} (Token #{alertTargetAppt.queueNumber})
              </div>
              <div className="font-mono text-brand-700">
                Tracking Code: {alertTargetAppt.trackingCode10Digit}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Alert Title</label>
                <input
                  type="text"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Message Content</label>
                <textarea
                  rows={3}
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {alertSuccess && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Alert sent to patient's live tracker!</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendPatientAlert}
                disabled={sendingAlert}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-1.5"
              >
                {sendingAlert ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Send Alert</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
