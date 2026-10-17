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
  Headphones,
  ExternalLink,
  LifeBuoy,
  Receipt,
  CreditCard,
} from 'lucide-react'
import {
  Doctor,
  Appointment,
  Clinic,
  ClinicInvitation,
  MedicalSpecialty,
  MedicalQualification,
} from '../types'
import {
  getDoctorByEmail,
  getDoctorById,
  updateDoctorPresence,
  updateAppointmentStatus,
  updateAppointmentNotes,
  getDoctorAppointments,
  getAffiliatedClinicsForDoctor,
  getDoctorInvitations,
  respondToDoctorInvitation,
  createDoctor,
  updateDoctor,
  uploadClinicDocument,
  getMedicalSpecialties,
  getMedicalQualifications,
  checkEmailPortalAssociation,
  sendManualNotification,
  getClinics,
  uploadDoctorPhoto,
  getSupportUrl,
} from '../services/db'
import { compressImage } from '../utils/imageCompressor'
import { extractCleanClinicalRemarks } from '../utils/paymentLedger'
import { playChimeSound } from '../utils/audioChime'
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
      const isDoctorLoggedIn = localStorage.getItem('dactor_doctor_logged_in') === 'true'
      const savedDoc = localStorage.getItem('dactor_doctor_session')
      if (savedDoc && isDoctorLoggedIn) return 'consultation_desk'
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

  const [supportUrl, setSupportUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('dactor_support_url') || 'https://rajanpurbe.github.io/Dactor/support'
    } catch {
      return 'https://rajanpurbe.github.io/Dactor/support'
    }
  })

  useEffect(() => {
    getSupportUrl().then((url) => {
      if (url) setSupportUrl(url)
    })
  }, [])

  // Google OAuth Loading / Error
  const [firebaseLoading, setFirebaseLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [checkingKyc, setCheckingKyc] = useState(false)
  const [kycCheckMsg, setKycCheckMsg] = useState<string | null>(null)

  // Desk State
  const [deskTab, setDeskTab] = useState<
    'today_queue' | 'future_appts' | 'patients' | 'billing' | 'profile_settings'
  >('today_queue')
  const [docPatientSearch, setDocPatientSearch] = useState('')
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

  // Prescription & Clinical Notes Writer State (Parity with DoctorDashboardScreen.kt)
  const [rxModalOpen, setRxModalOpen] = useState(false)
  const [rxTargetAppt, setRxTargetAppt] = useState<Appointment | null>(null)
  const [rxDiagnosis, setRxDiagnosis] = useState('')
  const [rxMedicines, setRxMedicines] = useState<Array<{ name: string; dosage: string; frequency: string; duration: string; instructions: string }>>([
    { name: '', dosage: '500mg', frequency: '1-0-1 (Twice daily)', duration: '5 days', instructions: 'After meals' },
  ])
  const [rxAdvice, setRxAdvice] = useState('')
  const [savingRx, setSavingRx] = useState(false)

  // Patient History Drawer / Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyPatientName, setHistoryPatientName] = useState('')
  const [historyVisits, setHistoryVisits] = useState<Appointment[]>([])

  // Clinic Affiliation Invitations for Doctor
  const [doctorInvitations, setDoctorInvitations] = useState<ClinicInvitation[]>([])
  const [invitationClinics, setInvitationClinics] = useState<Record<string, Clinic>>({})
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null)

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
  const [regClinicTypeFilter, setRegClinicTypeFilter] = useState<
    'all' | 'single_visit' | 'multi_visit' | 'diagnostic_lab'
  >('all')

  const displayedClinics = useMemo(() => {
    if (regClinicTypeFilter === 'all') return allClinics
    if (regClinicTypeFilter === 'diagnostic_lab') {
      return allClinics.filter(
        (c) =>
          c.type === 'diagnostic_lab' ||
          c.type?.includes('lab') ||
          c.name?.toLowerCase().includes('lab') ||
          c.name?.toLowerCase().includes('imaging') ||
          c.name?.toLowerCase().includes('mri') ||
          c.name?.toLowerCase().includes('scan') ||
          c.specialties?.some(
            (s) =>
              s.toLowerCase().includes('lab') ||
              s.toLowerCase().includes('patholog') ||
              s.toLowerCase().includes('mri') ||
              s.toLowerCase().includes('scan')
          )
      )
    }
    if (regClinicTypeFilter === 'single_visit') {
      return allClinics.filter((c) => c.type === 'single_visit' || c.type === 'single_doctor')
    }
    return allClinics.filter((c) => c.type === 'multi_visit' || c.type === 'polyclinic')
  }, [allClinics, regClinicTypeFilter])

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

      // Load pending clinic affiliation invitations
      if (doctor.email) {
        const invites = await getDoctorInvitations(doctor.email, doctor.id)
        setDoctorInvitations(invites)
        if (invites.length > 0) {
          const allCls = await getClinics()
          const map: Record<string, Clinic> = {}
          invites.forEach((inv) => {
            const found = allCls.find((c) => c.id === inv.clinicId)
            if (found) map[inv.id] = found
          })
          setInvitationClinics(map)
        }
      }
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
      localStorage.setItem('dactor_doctor_logged_in', 'true')
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
        const compressed = await compressImage(regPhotoFile, 300 * 1024)
        photoUrl =
          (await uploadClinicDocument(`doc_photo_${regPhotoFile.name}`, compressed, 'doctor_photos')) ||
          undefined
      }

      let licenseDocUrl: string | undefined
      if (regLicenseFile) {
        const compressed = await compressImage(regLicenseFile, 300 * 1024)
        licenseDocUrl =
          (await uploadClinicDocument(`nmc_${regLicenseFile.name}`, compressed, 'doctor_kyc_docs')) ||
          undefined
      }

      let certificatesDocUrl: string | undefined
      if (regDegreeFile) {
        const compressed = await compressImage(regDegreeFile, 300 * 1024)
        certificatesDocUrl =
          (await uploadClinicDocument(`degree_${regDegreeFile.name}`, compressed, 'doctor_kyc_docs')) ||
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
        licenseDocUrl,
        certificatesDocUrl,
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
    playChimeSound()
    try {
      await updateAppointmentStatus(appt.id, 'in_consultation')
      // Send real notification to patient that doctor is ready
      sendManualNotification(
        appt.id,
        `Dr. ${currentDoctor.fullName} is Ready`,
        `Token #${appt.queueNumber || 'N/A'}: Dr. ${currentDoctor.fullName} is ready for your consultation. Please enter the cabin.`,
        undefined,
        undefined,
        appt.trackingCode10Digit,
        appt.userId || undefined,
        appt.clinicId
      ).catch(() => {})
      const refreshed = await getDoctorAppointments(currentDoctor.id)
      setAppointments(refreshed)
    } catch (err) {
      console.error('Error updating to inside cabin:', err)
    }
  }

  const handleOpenPrescriptionModal = (appt: Appointment) => {
    setRxTargetAppt(appt)
    setRxDiagnosis('')
    setRxMedicines([
      { name: '', dosage: '500mg', frequency: '1-0-1 (Twice daily)', duration: '5 days', instructions: 'After meals' },
    ])
    setRxAdvice('')
    setRxModalOpen(true)
  }

  const handleAddMedicineRow = () => {
    setRxMedicines((prev) => [
      ...prev,
      { name: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: 'After meals' },
    ])
  }

  const handleRemoveMedicineRow = (index: number) => {
    setRxMedicines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateMedicineField = (index: number, field: string, val: string) => {
    setRxMedicines((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    )
  }

  const handleSavePrescriptionAndComplete = async () => {
    if (!rxTargetAppt || !currentDoctor) return
    setSavingRx(true)
    try {
      const validMeds = rxMedicines.filter((m) => m.name.trim().length > 0)
      let formattedNotes = ''
      if (rxDiagnosis.trim()) {
        formattedNotes += `DIAGNOSIS:\n${rxDiagnosis.trim()}\n\n`
      }
      if (validMeds.length > 0) {
        formattedNotes += `PRESCRIPTION (Rx):\n` + validMeds.map((m, idx) =>
          `${idx + 1}. ${m.name} ${m.dosage ? `(${m.dosage})` : ''} - ${m.frequency} for ${m.duration} [${m.instructions}]`
        ).join('\n') + '\n\n'
      }
      if (rxAdvice.trim()) {
        formattedNotes += `CLINICAL ADVICE:\n${rxAdvice.trim()}`
      }

      if (formattedNotes.trim()) {
        await updateAppointmentNotes(rxTargetAppt.id, formattedNotes.trim())
      }
      await updateAppointmentStatus(rxTargetAppt.id, 'completed')

      // Refresh appointments
      const refreshed = await getDoctorAppointments(currentDoctor.id)
      setAppointments(refreshed)
      setRxModalOpen(false)
      setRxTargetAppt(null)
    } catch (err) {
      console.error('Error saving prescription:', err)
    } finally {
      setSavingRx(false)
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

  const handleOpenPatientHistory = (patientName: string) => {
    setHistoryPatientName(patientName)
    const visits = appointments.filter(
      (a) => a.patientName?.trim().toLowerCase() === patientName.trim().toLowerCase()
    )
    setHistoryVisits(visits)
    setHistoryModalOpen(true)
  }

  const handleRespondInvitation = async (invite: ClinicInvitation, accept: boolean) => {
    if (!currentDoctor) return
    setRespondingInviteId(invite.id)
    try {
      const ok = await respondToDoctorInvitation(invite.id, accept, currentDoctor.id, invite.clinicId)
      if (ok) {
        await loadDoctorClinicsAndAppointments(currentDoctor)
      }
    } catch (err) {
      console.error('Error responding to invitation:', err)
    } finally {
      setRespondingInviteId(null)
    }
  }

  const handleMarkNoShow = async (appt: Appointment) => {
    if (!currentDoctor) return
    const confirmed = window.confirm(
      `Mark ${appt.patientName} (Token #${appt.queueNumber || 'N/A'}) as No-Show? They can be readmitted from the reception desk if they arrive.`
    )
    if (!confirmed) return
    try {
      await updateAppointmentStatus(appt.id, 'no_show')
      const refreshed = await getDoctorAppointments(currentDoctor.id)
      setAppointments(refreshed)
    } catch (err) {
      console.error('Error marking no-show:', err)
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

  // Photo Upload
  const [updatingPhoto, setUpdatingPhoto] = useState(false)
  const [photoUpdateMsg, setPhotoUpdateMsg] = useState<string | null>(null)

  const handleUploadDoctorPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentDoctor) return
    setUpdatingPhoto(true)
    setPhotoUpdateMsg('Compressing & uploading photo...')
    try {
      const compressed = await compressImage(file, 300 * 1024)
      const publicUrl = await uploadDoctorPhoto(currentDoctor.id, compressed, file.name)
      if (!publicUrl) throw new Error('Upload failed')
      const ok = await updateDoctor(currentDoctor.id, { profilePictureUrl: publicUrl })
      if (!ok) throw new Error('Failed to update doctor profile')
      const updated = { ...currentDoctor, profilePictureUrl: publicUrl }
      setCurrentDoctor(updated)
      localStorage.setItem('dactor_doctor_session', JSON.stringify(updated))
      setPhotoUpdateMsg('Profile photo updated!')
      setTimeout(() => setPhotoUpdateMsg(null), 3000)
    } catch (err: any) {
      alert(err?.message || 'Failed to update photo')
      setPhotoUpdateMsg(null)
    } finally {
      setUpdatingPhoto(false)
      e.target.value = ''
    }
  }

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('dactor_doctor_session')
    localStorage.removeItem('dactor_doctor_email')
    localStorage.removeItem('dactor_doctor_logged_in')
    localStorage.removeItem('dactor_doctor_pending_kyc')
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

  // Grouped patients for patient directory
  const doctorPatientsList = useMemo(() => {
    const map = new Map<string, {
      patientName: string
      patientMobile: string
      patientAge?: number
      patientGender?: string
      trackingCodes: string[]
      totalVisits: number
      lastVisitDate: string
      notes: string[]
      lastStatus: string
    }>()

    appointments.forEach((a) => {
      const key = (a.patientMobile?.trim() || a.patientName?.trim() || a.id).toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.totalVisits += 1
        if (a.trackingCode10Digit && !existing.trackingCodes.includes(a.trackingCode10Digit)) {
          existing.trackingCodes.push(a.trackingCode10Digit)
        }
        if (a.appointmentDate > existing.lastVisitDate) {
          existing.lastVisitDate = a.appointmentDate
          existing.lastStatus = a.checkinStatus || 'completed'
        }
        if (a.notes && !existing.notes.includes(a.notes)) {
          existing.notes.push(a.notes)
        }
      } else {
        map.set(key, {
          patientName: a.patientName,
          patientMobile: a.patientMobile || '',
          patientAge: a.patientAge,
          patientGender: a.patientGender,
          trackingCodes: a.trackingCode10Digit ? [a.trackingCode10Digit] : [],
          totalVisits: 1,
          lastVisitDate: a.appointmentDate,
          notes: a.notes ? [a.notes] : [],
          lastStatus: a.checkinStatus || 'completed',
        })
      }
    })

    const list = Array.from(map.values())
    if (!docPatientSearch.trim()) return list
    const q = docPatientSearch.trim().toLowerCase()
    return list.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        p.patientMobile.includes(q) ||
        p.trackingCodes.some((code) => code.includes(q))
    )
  }, [appointments, docPatientSearch])

  // Billing ledger calculations
  const doctorBillingStats = useMemo(() => {
    let totalBilled = 0
    let onlinePaid = 0
    let settledCash = 0
    appointments.forEach((a) => {
      const fee = a.feeAmount > 0 ? a.feeAmount : (currentDoctor?.consultationFee || 500)
      totalBilled += fee
      if (a.paymentStatus === 'paid') {
        onlinePaid += fee
      } else {
        settledCash += fee
      }
    })
    return {
      totalBilled,
      onlinePaid,
      settledCash,
      totalCount: appointments.length,
    }
  }, [appointments, currentDoctor])

  // ==========================================
  // VIEW 1: DEDICATED DOCTOR AUTH / SIGN-IN
  // ==========================================
  if (currentView === 'auth_screen') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="liquid-glass-elevated rounded-3xl p-8 sm:p-10 text-center space-y-6 relative overflow-hidden">
          {/* Top specular refraction sheen */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          {/* Brand Icon */}
          <div className="w-16 h-16 rounded-3xl bg-teal-500/10 dark:bg-teal-400/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-inner border border-teal-500/20">
            <Stethoscope className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Official Dactor Practitioner Network
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Doctor Consultation Desk
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              Dedicated portal for licensed medical doctors & practitioners. Manage live cabin presence, review today's patient queue, call tokens, and maintain consultation history.
            </p>
          </div>

          {/* Account Exclusivity Notice */}
          <div className="p-3.5 liquid-glass-subtle rounded-2xl border border-amber-500/30 dark:border-amber-400/20 text-left space-y-1">
            <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Strict Single-Role Account Security</span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-200/90 leading-relaxed">
              Your Google account is exclusively bound to your Doctor profile. A single account cannot be shared with Clinic or Patient portals.
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-4 rounded-2xl liquid-glass-subtle border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs font-medium text-left space-y-2.5">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Access Restricted</span>
                  <p className="leading-relaxed">{authError}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-3 py-1.5 rounded-xl liquid-glass-card hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold text-xs cursor-pointer transition"
                >
                  Change Account
                </button>
              </div>
            </div>
          )}

          {/* Single Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={firebaseLoading}
            className="w-full py-4 px-6 liquid-glass-card hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-900 dark:text-white font-bold rounded-2xl transition-all flex items-center justify-center space-x-3 text-sm cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.98] border border-white/60 dark:border-white/10 disabled:opacity-60"
          >
            {firebaseLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-teal-600 dark:text-teal-400" />
                <span>Verifying Doctor Account...</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                </div>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="p-3.5 liquid-glass-subtle rounded-2xl border border-white/40 dark:border-white/10 text-left space-y-1">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Unified Doctor Login & NMC KYC Onboarding</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Sign in with your Google account above. Verified practitioners enter the live OPD cabin directly; new doctors are guided through NMC license verification.
            </p>
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
        <div className="liquid-glass-elevated rounded-3xl p-8 sm:p-10 border border-amber-500/30 dark:border-amber-400/20 space-y-6 relative overflow-hidden">
          {/* Top amber specular refraction sheen */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner border border-amber-500/20">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1 rounded-full">
              Registration Under Review
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Medical KYC Awaiting Regulatory Verification
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              Your doctor application has been submitted to the Dactor Medical Accreditation Board. We verify Nepal Medical Council (NMC) registration before activating consultation desks.
            </p>
          </div>

          {/* Submitted Profile Summary Card */}
          <div className="p-5 liquid-glass-subtle rounded-2xl border border-amber-500/20 space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-white/20 dark:border-white/5 font-bold text-amber-950 dark:text-amber-200">
              <span>Practitioner Name</span>
              <span className="font-black text-slate-900 dark:text-white">{pendingDocData.name}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-white/20 dark:border-white/5 font-bold text-amber-950 dark:text-amber-200">
              <span>NMC License Number</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{pendingDocData.nmcNumber}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-white/20 dark:border-white/5 font-bold text-amber-950 dark:text-amber-200">
              <span>Medical Specialty</span>
              <span className="font-black text-slate-900 dark:text-white">{pendingDocData.specialty}</span>
            </div>
            <div className="flex justify-between items-center font-bold text-amber-950 dark:text-amber-200">
              <span>Registered Google Email</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{pendingDocData.email}</span>
            </div>
          </div>

          {kycCheckMsg && (
            <div className="p-3 liquid-glass-subtle border border-teal-500/30 rounded-xl text-teal-800 dark:text-teal-200 text-xs text-center font-bold">
              {kycCheckMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <a
              href={supportUrl.startsWith('http') || supportUrl.startsWith('mailto:') ? supportUrl : `https://${supportUrl}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-white font-black rounded-2xl shadow-lg border border-amber-400/40 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer"
            >
              <Headphones className="w-4 h-4" />
              <span>Contact Dactor Practitioner Support Desk</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
            </a>

            <button
              type="button"
              onClick={handleCheckKycStatus}
              disabled={checkingKyc}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-black rounded-2xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checkingKyc ? 'animate-spin' : ''}`} />
              <span>Check Verification Status Now</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 liquid-glass-card hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-white/40 dark:border-white/10 font-bold rounded-2xl active:scale-[0.98] transition-all text-xs cursor-pointer flex items-center justify-center space-x-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out & Switch Account</span>
            </button>
          </div>

          <div className="p-3.5 liquid-glass-subtle rounded-2xl border border-white/30 dark:border-white/10 text-center">
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Medical KYC approvals complete within 12-24 business hours. For urgent hospital roster deployment, contact Dactor Practitioner Support at{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">dactorofficial@gmail.com</span>.
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
        <div className="liquid-glass-elevated rounded-3xl p-8 sm:p-10 space-y-6 relative overflow-hidden border border-white/40 dark:border-white/10">
          {/* Top specular refraction sheen */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          <div className="text-left space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Step 2 of 2: Medical Accreditation
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Doctor Registration & NMC KYC Form
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Submit your medical qualifications and NMC registration number. Verified doctors receive full desk access and high trust rating on patient discovery cards.
            </p>
          </div>

          <div className="p-3.5 liquid-glass-subtle rounded-2xl border border-teal-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-teal-900 dark:text-teal-200">Verified Google ID:</span>
              <span className="font-mono text-teal-700 dark:text-teal-300">{verifiedEmail}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-bold underline cursor-pointer text-[11px]"
            >
              Change Account
            </button>
          </div>

          {regErrors.form && (
            <div className="p-3 liquid-glass-subtle border border-rose-500/30 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-bold">
              {regErrors.form}
            </div>
          )}

          <form onSubmit={handleSubmitRegistration} className="space-y-6 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Doctor Full Name (with Dr. prefix) *
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Dr. Anubhav Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
                {regErrors.name && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{regErrors.name}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  NMC License Registration Number *
                </label>
                <input
                  type="text"
                  value={regNmc}
                  onChange={(e) => setRegNmc(e.target.value)}
                  placeholder="e.g. 18452-MED"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white font-mono"
                />
                {regErrors.nmc && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{regErrors.nmc}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Medical Specialty *</label>
                <select
                  value={regSpecialty}
                  onChange={(e) => setRegSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white bg-white/70 dark:bg-slate-900/80"
                >
                  {specialtiesList.map((s) => (
                    <option key={s.id} value={s.name} className="dark:bg-slate-900 text-slate-900 dark:text-white">
                      {s.name}
                    </option>
                  ))}
                  {specialtiesList.length === 0 && (
                    <>
                      <option value="General Physician" className="text-slate-900">General Physician & Internal Medicine</option>
                      <option value="Cardiology (Heart Care)" className="text-slate-900">Cardiology (Heart Specialist)</option>
                      <option value="Dermatology & Skin Care" className="text-slate-900">Dermatology & Venereology (Skin, Hair & Cosmetology)</option>
                      <option value="Pediatrics & Child Health" className="text-slate-900">Pediatrics & Neonatology (Child Specialist)</option>
                      <option value="Orthopedics & Joint Care" className="text-slate-900">Orthopedics & Joint Replacement (Bone & Spine)</option>
                      <option value="Gynecology & Obstetrics" className="text-slate-900">Gynecology & Obstetrics (Women's Health)</option>
                      <option value="Ophthalmology (Eye Care)" className="text-slate-900">Ophthalmology (Eye Specialist)</option>
                      <option value="ENT (Ear, Nose & Throat)" className="text-slate-900">ENT (Ear, Nose & Throat Specialist)</option>
                      <option value="Dental Surgery & Orthodontics" className="text-slate-900">Dental Surgery & Oral Health</option>
                      <option value="Neurology & Neurosurgery" className="text-slate-900">Neurology & Neurosurgery (Brain & Nerve)</option>
                      <option value="Gastroenterology & Hepatology" className="text-slate-900">Gastroenterology (Stomach, Liver & Digestion)</option>
                      <option value="Pulmonology (Chest & Lungs)" className="text-slate-900">Pulmonology & Respiratory Medicine</option>
                      <option value="Nephrology & Urology" className="text-slate-900">Nephrology & Urology (Kidney & Urinary)</option>
                      <option value="Psychiatry & Behavioral Health" className="text-slate-900">Psychiatry & Mental Health</option>
                      <option value="Diagnostic Radiology (MRI, CT, USG, X-Ray)" className="text-slate-900">Diagnostic Radiology (MRI, CT Scan, Ultrasound, X-Ray)</option>
                      <option value="Clinical Pathology & Lab Medicine" className="text-slate-900">Clinical Pathology & Diagnostic Laboratory Medicine</option>
                      <option value="Endocrinology & Diabetology" className="text-slate-900">Endocrinology & Diabetes Specialist</option>
                      <option value="General & Laparoscopic Surgery" className="text-slate-900">General & Laparoscopic Surgery</option>
                      <option value="Physiotherapy & Rehabilitation" className="text-slate-900">Physiotherapy & Physical Rehabilitation</option>
                      <option value="Oncology (Cancer Care)" className="text-slate-900">Oncology (Cancer Specialist)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Qualification / Degree *</label>
                <select
                  value={regEducation}
                  onChange={(e) => setRegEducation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white bg-white/70 dark:bg-slate-900/80"
                >
                  {qualificationsList.map((q) => (
                    <option key={q.id} value={q.degreeName} className="dark:bg-slate-900 text-slate-900 dark:text-white">
                      {q.degreeName} ({q.fullTitle})
                    </option>
                  ))}
                  {qualificationsList.length === 0 && (
                    <>
                      <option value="MBBS" className="dark:bg-slate-900 text-slate-900 dark:text-white">MBBS</option>
                      <option value="MBBS, MD" className="dark:bg-slate-900 text-slate-900 dark:text-white">MBBS, MD</option>
                      <option value="MS - General Surgery" className="dark:bg-slate-900 text-slate-900 dark:text-white">MS - General Surgery</option>
                      <option value="BDS" className="dark:bg-slate-900 text-slate-900 dark:text-white">BDS</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Practicing Since Year</label>
                <input
                  type="number"
                  min="1970"
                  max={new Date().getFullYear()}
                  value={regStartingYear}
                  onChange={(e) => setRegStartingYear(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Gender *</label>
                <select
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white bg-white/70 dark:bg-slate-900/80"
                >
                  <option value="Male" className="dark:bg-slate-900 text-slate-900 dark:text-white">Male</option>
                  <option value="Female" className="dark:bg-slate-900 text-slate-900 dark:text-white">Female</option>
                  <option value="Other" className="dark:bg-slate-900 text-slate-900 dark:text-white">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Age *</label>
                <input
                  type="number"
                  value={regAge}
                  onChange={(e) => setRegAge(e.target.value)}
                  placeholder="e.g. 36"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
                {regErrors.age && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{regErrors.age}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Standard OPD Fee (NPR)</label>
                <input
                  type="number"
                  value={regFee}
                  onChange={(e) => setRegFee(parseInt(e.target.value, 10) || 500)}
                  placeholder="500"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Personal Mobile Number (Private) *
                </label>
                <input
                  type="tel"
                  value={regPersonalPhone}
                  onChange={(e) => setRegPersonalPhone(e.target.value)}
                  placeholder="98XXXXXXXX (10 digits)"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
                {regErrors.personalPhone && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{regErrors.personalPhone}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Clinic Affiliation (Optional)
                  </label>
                  <select
                    value={regClinicTypeFilter}
                    onChange={(e) => setRegClinicTypeFilter(e.target.value as any)}
                    className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/20 rounded-lg px-2 py-0.5 cursor-pointer"
                  >
                    <option value="all">All Center Types</option>
                    <option value="single_visit">Single-Doctor OPD</option>
                    <option value="multi_visit">Multi-Specialty Polyclinic</option>
                    <option value="diagnostic_lab">Diagnostic Lab & Imaging (MRI/CT)</option>
                  </select>
                </div>
                <select
                  value={regClinicId}
                  onChange={(e) => setRegClinicId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white bg-white/70 dark:bg-slate-900/80"
                >
                  <option value="" className="dark:bg-slate-900 text-slate-900 dark:text-white">Independent / Multi-Clinic Practice</option>
                  {displayedClinics.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900 text-slate-900 dark:text-white">
                      {c.name} • {c.type === 'diagnostic_lab' ? 'Diagnostic Lab (MRI/CT)' : c.type === 'single_visit' ? 'Single-Doctor' : 'Polyclinic'} ({c.addressText || 'Nepal'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/40 dark:border-white/10">
              <div className="p-4 rounded-2xl liquid-glass-subtle border border-white/40 dark:border-white/10 space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <Camera className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Doctor Profile Picture (Optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRegPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-teal-500/10 file:text-teal-700 dark:file:text-teal-300 file:font-bold hover:file:bg-teal-500/20 cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl liquid-glass-subtle border border-white/40 dark:border-white/10 space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>NMC Certificate / Photo *</span>
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setRegLicenseFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-teal-500/10 file:text-teal-700 dark:file:text-teal-300 file:font-bold hover:file:bg-teal-500/20 cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl liquid-glass-subtle border border-white/40 dark:border-white/10 space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Degree Certificate (MBBS/MD)</span>
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setRegDegreeFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-teal-500/10 file:text-teal-700 dark:file:text-teal-300 file:font-bold hover:file:bg-teal-500/20 cursor-pointer"
                />
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="pt-2">
              <label className="flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regTermsAccepted}
                  onChange={(e) => setRegTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                />
                <span>
                  I declare under penalty of law that I am an actively registered medical practitioner with the Nepal Medical Council (NMC) and agree to Dactor's ethical code and live OPD privacy standards.
                </span>
              </label>
              {regErrors.terms && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{regErrors.terms}</p>}
            </div>

            {regStatusMsg && (
              <div className="p-3 liquid-glass-subtle text-teal-900 dark:text-teal-200 font-bold text-xs rounded-xl flex items-center space-x-2 border border-teal-500/30">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400" />
                <span>{regStatusMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingReg}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-black rounded-2xl shadow-lg shadow-teal-500/25 text-xs sm:text-sm cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center space-x-2"
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6 pb-28 sm:pb-12">
      {/* Top Banner / Doctor Context Bar */}
      <div className="liquid-glass-elevated rounded-2xl sm:rounded-3xl border border-white/40 dark:border-white/10 p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        {/* Top specular refraction sheen */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <div className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-300 flex items-center justify-center font-black text-xl shrink-0 overflow-hidden border border-teal-500/20 shadow-xs">
            {currentDoctor?.profilePictureUrl ? (
              <img
                src={currentDoctor.profilePictureUrl}
                alt={currentDoctor.fullName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = 'none'
                }}
              />
            ) : (
              <Stethoscope className="w-7 h-7 sm:w-8 sm:h-8" />
            )}
            <label
              className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-[9px] font-bold cursor-pointer"
              title="Click to update your profile photo"
            >
              <Camera className="w-4 h-4" />
              <span>{updatingPhoto ? '...' : 'Photo'}</span>
              <input
                type="file"
                accept="image/*"
                disabled={updatingPhoto}
                onChange={handleUploadDoctorPhoto}
                className="hidden"
              />
            </label>
          </div>

          <div className="min-w-0">
            {photoUpdateMsg && (
              <span className="inline-block mb-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {photoUpdateMsg}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                {currentDoctor?.fullName}
              </h1>
              <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>NMC: {currentDoctor?.nmcLicenseNumber || 'Verified'}</span>
              </span>
              <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                {currentDoctor?.specialty || 'General Physician'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>{currentDoctor?.education || 'MBBS, MD'}</span>
              <span>•</span>
              <span className="truncate max-w-[200px] sm:max-w-none">Logged in: <strong className="text-slate-700 dark:text-slate-300">{currentDoctor?.email}</strong></span>
              {selectedClinic && (
                <>
                  <span>•</span>
                  <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center space-x-1 truncate max-w-[180px] sm:max-w-none">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{selectedClinic.name}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Doctor Presence Toggle & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/20 dark:border-white/5">
          {/* Clinic Switcher (if doctor practices at multiple facilities) */}
          {affiliatedClinics.length > 1 && (
            <select
              value={selectedClinic?.id || ''}
              onChange={(e) => {
                const found = affiliatedClinics.find((c) => c.id === e.target.value)
                if (found) setSelectedClinic(found)
              }}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl liquid-glass-input text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white/70 dark:bg-slate-900/80"
            >
              {affiliatedClinics.map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-slate-900">
                  Clinic: {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Real In-Cabin Presence Switch */}
          <button
            onClick={handleTogglePresence}
            disabled={updatingPresence}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs active:scale-[0.98] ${
              isInCabin
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25'
            }`}
            title="Click to toggle In-Cabin Presence. Live queues update immediately across website and mobile apps."
          >
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                isInCabin ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="truncate">{isInCabin ? 'Doctor is In Cabin' : 'Doctor is Away (Out)'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-2 liquid-glass-card hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-white/40 dark:border-white/10"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* PENDING CLINIC AFFILIATION INVITATIONS (Parity with DoctorDashboardScreen.kt) */}
      {doctorInvitations.length > 0 && (
        <div className="space-y-3">
          {doctorInvitations.map((inv) => {
            const clinicInfo = invitationClinics[inv.id]
            const isResponding = respondingInviteId === inv.id
            return (
              <div
                key={inv.id}
                className="liquid-glass-elevated p-4 sm:p-5 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/10 via-sky-900/10 to-indigo-900/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        Clinic Invitation
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {clinicInfo?.name || 'Verified Dactor Clinic Partner'}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {clinicInfo?.addressText ? `Location: ${clinicInfo.addressText}. ` : ''}
                      Accepting allows this clinic to schedule patients and publish OPD slots for your profile.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0">
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => handleRespondInvitation(inv, false)}
                    className="px-3.5 py-2 rounded-xl liquid-glass-subtle hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-300/60 dark:border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => handleRespondInvitation(inv, true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:brightness-110 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isResponding ? 'Accepting...' : 'Accept Invite'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-white/40 dark:border-white/10 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setDeskTab('today_queue')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'today_queue'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/20'
              : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-white/40 dark:border-white/10'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Today's Consultation Queue ({waitingPatients.length} Waiting)</span>
        </button>

        <button
          onClick={() => setDeskTab('future_appts')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'future_appts'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/20'
              : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-white/40 dark:border-white/10'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Upcoming Schedule & Dates</span>
        </button>

        <button
          onClick={() => setDeskTab('patients')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'patients'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/20'
              : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-white/40 dark:border-white/10'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Patient Directory</span>
        </button>

        <button
          onClick={() => setDeskTab('billing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'billing'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/20'
              : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-white/40 dark:border-white/10'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Invoices & Rx Fee</span>
        </button>

        <button
          onClick={() => setDeskTab('profile_settings')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            deskTab === 'profile_settings'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/20'
              : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 border border-white/40 dark:border-white/10'
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
            <div className="liquid-glass-card p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold border border-amber-500/20">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{waitingPatients.length}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Waiting in OPD Lobby</div>
              </div>
            </div>

            <div className="liquid-glass-card p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold border border-teal-500/20">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {currentInsidePatient ? '1 Inside' : 'None Inside'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Currently in Cabin</div>
              </div>
            </div>

            <div className="liquid-glass-card p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{completedPatients.length}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Completed Consultations</div>
              </div>
            </div>
          </div>

          {/* ACTIVE IN-CABIN PATIENT HERO CARD */}
          {currentInsidePatient && (
            <div className="liquid-glass-elevated bg-gradient-to-r from-teal-950/85 via-slate-950/85 to-cyan-950/85 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-4 border border-teal-500/30 relative overflow-hidden backdrop-blur-2xl">
              {/* Top cyan specular line */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-teal-700/40 pb-4">
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

                <div className="flex flex-col sm:flex-row items-center gap-2.5 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAlertTargetAppt(currentInsidePatient)
                      setAlertTitle(`Doctor Cabin Alert • ${currentDoctor?.fullName}`)
                      setAlertMessage('Your consultation is ongoing. Please remain inside cabin.')
                      setAlertModalOpen(true)
                    }}
                    className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-[0.98]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Alert</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenPrescriptionModal(currentInsidePatient)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 hover:brightness-110 text-white font-black text-xs shadow-md shadow-blue-500/30 border border-white/30 transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-[0.98]"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Write Rx & Complete</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkCompleted(currentInsidePatient)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-[0.98]"
                    title="Complete consultation without adding new prescription notes"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Quick Complete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WAITING QUEUE PATIENTS LIST */}
          <div className="liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-white/20 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Waiting Patients Queue</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Patients currently waiting outside your cabin for today's OPD consultation.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full liquid-glass-subtle text-slate-700 dark:text-slate-300 border border-white/30 dark:border-white/10">
                {waitingPatients.length} In Queue
              </span>
            </div>

            {waitingPatients.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">No Waiting Patients in Lobby</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  All booked and walk-in OPD patients for today have completed consultations or no patients are currently checked in.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/20 dark:divide-white/5">
                {waitingPatients.map((appt, idx) => (
                  <div
                    key={appt.id}
                    className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 flex flex-col items-center justify-center font-mono font-black shrink-0">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase leading-none">Token</span>
                        <span className="text-base leading-none">
                          #{String(appt.queueNumber || idx + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">{appt.patientName}</h4>
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md liquid-glass-subtle text-slate-700 dark:text-slate-300 border border-white/20">
                            {appt.trackingCode10Digit}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {appt.patientAge ? `${appt.patientAge} Yrs` : ''}{' '}
                          {appt.patientGender ? `• ${appt.patientGender}` : ''}{' '}
                          • Mobile: {appt.patientMobile || 'N/A'}{' '}
                          {appt.appointmentTime ? `• Slot: ${appt.appointmentTime}` : ''}
                        </p>
                        {appt.notes && (
                          <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">Notes: {appt.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap gap-y-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPatientHistory(appt.patientName)}
                        className="px-3 py-2 rounded-xl liquid-glass-card border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-blue-500/10 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 active:scale-[0.98]"
                        title="View Patient's Past Visits and Prescriptions"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>History</span>
                      </button>

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
                        className="p-2 rounded-xl liquid-glass-card border border-white/40 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-500/10 transition-colors cursor-pointer active:scale-[0.98]"
                        title="Send Push Alert to Patient"
                      >
                        <Send className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkNoShow(appt)}
                        className="px-3 py-2 rounded-xl liquid-glass-subtle border border-rose-300/60 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 text-xs font-bold transition-all cursor-pointer active:scale-[0.98]"
                        title="Mark patient as absent / no-show"
                      >
                        No-Show
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkInsideCabin(appt)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 hover:brightness-110 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center space-x-1.5 active:scale-[0.98]"
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
            <div className="liquid-glass-subtle rounded-3xl border border-white/40 dark:border-white/10 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Completed Today ({completedPatients.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {completedPatients.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 liquid-glass-card rounded-2xl border border-emerald-500/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{c.patientName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        Token #{c.queueNumber} • {c.trackingCode10Digit}
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
        <div className="liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Upcoming Appointments Calendar</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review advance bookings and slots reserved by patients for upcoming dates.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Select Date:</label>
              <input
                type="date"
                value={selectedFutureDate}
                onChange={(e) => setSelectedFutureDate(e.target.value)}
                className="px-3.5 py-2 rounded-xl liquid-glass-input text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {futureAppointments.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No Advance Bookings on {selectedFutureDate}
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Patients who book slots online for this date will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/20 dark:divide-white/5">
              {futureAppointments.map((appt) => (
                <div key={appt.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{appt.patientName}</span>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">Slot: {appt.appointmentTime}</span>
                  </div>
                  <span className="font-mono text-slate-600 dark:text-slate-400">{appt.trackingCode10Digit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB: PATIENT DIRECTORY & CLINICAL RECORDS
          ========================================== */}
      {deskTab === 'patients' && (
        <div className="space-y-6">
          <div className="liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Patient Directory & Clinical History</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Search past patients, view visit frequencies, 10-digit tracking codes, and clinical notes.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, code..."
                  value={docPatientSearch}
                  onChange={(e) => setDocPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {doctorPatientsList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {docPatientSearch.trim() ? 'No Matching Patients Found' : 'No Patient Consultations Recorded Yet'}
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Patients who book or complete consultations will be archived in your directory.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctorPatientsList.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl liquid-glass-subtle border border-white/30 dark:border-white/10 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">{p.patientName}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {p.patientAge ? `${p.patientAge} Yrs` : ''} {p.patientGender ? `• ${p.patientGender}` : ''}{' '}
                          {p.patientMobile ? `• ${p.patientMobile}` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                        {p.totalVisits} {p.totalVisits === 1 ? 'Visit' : 'Visits'}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 pt-1 border-t border-white/20 dark:border-white/5">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Last Consulted:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{p.lastVisitDate}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Active Tracking:</span>
                        <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {p.trackingCodes.slice(-1)[0] || 'N/A'}
                        </span>
                      </div>
                      {p.notes.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Clinical Remarks:</span>
                          <p className="text-[11px] text-teal-800 dark:text-teal-300 font-medium line-clamp-2">
                            {extractCleanClinicalRemarks(p.notes.slice(-1)[0])}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB: OPD INVOICES & CONSULTATION FEES
          ========================================== */}
      {deskTab === 'billing' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="liquid-glass-card p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold border border-teal-500/20">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  NPR {doctorBillingStats.totalBilled}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total OPD Consultation Billed</div>
              </div>
            </div>

            <div className="liquid-glass-card p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  NPR {doctorBillingStats.onlinePaid}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Online Verified (eSewa / Khalti)</div>
              </div>
            </div>

            <div className="liquid-glass-card p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  NPR {doctorBillingStats.settledCash}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Cash at Reception / Desk</div>
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 shadow-sm p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/20 dark:border-white/5">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">OPD Consultation Invoices</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time billing transactions for all consultations under your practitioner profile.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full liquid-glass-subtle text-slate-700 dark:text-slate-300 border border-white/20">
                {appointments.length} Total Records
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Receipt className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Invoices Recorded Yet</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Booked patients and consultation records will automatically generate invoices here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/20 dark:divide-white/5">
                {appointments.slice(0, 30).map((a) => {
                  const fee = a.feeAmount > 0 ? a.feeAmount : (currentDoctor?.consultationFee || 500)
                  return (
                    <div key={a.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 dark:text-white">{a.patientName}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-md liquid-glass-subtle text-slate-600 dark:text-slate-400 border border-white/20">
                            {a.trackingCode10Digit}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {a.appointmentDate} • Slot: {a.appointmentTime || 'Walk-In'} • Mobile: {a.patientMobile || 'N/A'}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 justify-between sm:justify-end">
                        <div className="text-right">
                          <div className="font-black text-slate-900 dark:text-white">NPR {fee}</div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              a.paymentStatus === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                            }`}
                          >
                            {a.paymentStatus === 'paid' ? 'Paid Online' : 'Settled at Reception'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          TAB: PRACTITIONER PROFILE & SETTINGS
          ========================================== */}
      {deskTab === 'profile_settings' && (
        <div className="liquid-glass-card rounded-3xl border border-white/40 dark:border-white/10 shadow-sm p-6 sm:p-8 space-y-6 max-w-2xl mx-auto">
          <div className="text-left space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Practitioner Profile & Rates</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update your public consultation fees and bio displayed on patient booking screens.
            </p>
          </div>

          <form onSubmit={handleSaveProfileSettings} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Standard Consultation Fee (NPR)
              </label>
              <input
                type="number"
                value={editFee}
                onChange={(e) => setEditFee(parseInt(e.target.value, 10) || 500)}
                className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Public Reception Phone (For Patients)
              </label>
              <input
                type="tel"
                value={editPublicPhone}
                onChange={(e) => setEditPublicPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Professional Bio & Specializations
              </label>
              <textarea
                rows={4}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Summarize your clinical experience, special procedures, and hospital affiliations..."
                className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
              />
            </div>

            {profileSaveSuccess && (
              <div className="p-3 liquid-glass-subtle text-emerald-800 dark:text-emerald-200 font-bold text-xs rounded-xl flex items-center space-x-2 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Profile updated successfully in Supabase!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold rounded-2xl shadow-md text-xs cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center space-x-2"
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

          {/* Helpdesk & Support Card in Profile Settings */}
          <div className="liquid-glass-card rounded-3xl p-6 border border-teal-500/20 space-y-4 text-left mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Contact Us & Practitioner Helpdesk
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Connect directly with our regulatory and support team for NMC licensing, consultation questions, or technical help.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={supportUrl.startsWith('http') || supportUrl.startsWith('mailto:') ? supportUrl : `https://${supportUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs shadow-md shadow-teal-500/20 transition cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Contact Support Desk</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUSH ALERT MODAL */}
      {alertModalOpen && alertTargetAppt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass-modal rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/40 dark:border-white/10 space-y-4 relative overflow-hidden">
            {/* Top specular refraction sheen */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/20 dark:border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Push Alert to Patient</h3>
              </div>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 liquid-glass-subtle rounded-xl text-xs space-y-1 border border-teal-500/30">
              <div className="font-bold text-teal-900 dark:text-teal-200">
                Recipient: {alertTargetAppt.patientName} (Token #{alertTargetAppt.queueNumber})
              </div>
              <div className="font-mono text-teal-700 dark:text-teal-300">
                Tracking Code: {alertTargetAppt.trackingCode10Digit}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Alert Title</label>
                <input
                  type="text"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Message Content</label>
                <textarea
                  rows={3}
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl liquid-glass-input text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {alertSuccess && (
              <div className="p-2.5 liquid-glass-subtle text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl flex items-center space-x-2 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Alert sent to patient's live tracker!</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="flex-1 py-2.5 liquid-glass-card hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer border border-white/40 dark:border-white/10 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendPatientAlert}
                disabled={sendingAlert}
                className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-1.5 active:scale-[0.98]"
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

      {/* ========================================================
          PRESCRIPTION & CLINICAL NOTES WRITER MODAL
          ======================================================== */}
      {rxModalOpen && rxTargetAppt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="liquid-glass-elevated w-full max-w-2xl rounded-3xl p-5 sm:p-7 border border-blue-500/30 shadow-2xl space-y-5 my-8 text-left bg-white/95 dark:bg-slate-900/95 relative max-h-[90vh] overflow-y-auto">
            {/* Top specular refraction sheen */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 rounded-t-3xl" />

            <div className="flex items-start justify-between border-b border-[var(--border)] pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    OPD Consultation Rx
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    Token #{rxTargetAppt.queueNumber || 'N/A'} • {rxTargetAppt.trackingCode10Digit}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                  Clinical Diagnosis & Prescription
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Patient: <strong className="text-slate-900 dark:text-white">{rxTargetAppt.patientName}</strong>{' '}
                  {rxTargetAppt.patientAge ? `(${rxTargetAppt.patientAge} Yrs` : ''}
                  {rxTargetAppt.patientGender ? `, ${rxTargetAppt.patientGender})` : ')'} • Dr. {currentDoctor?.fullName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRxModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnosis Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Clinical Diagnosis / Impression *</span>
                <span className="text-[10px] text-slate-400 font-normal">Primary medical diagnosis</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Acute upper respiratory infection, Essential hypertension, Viral gastritis"
                value={rxDiagnosis}
                onChange={(e) => setRxDiagnosis(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white border border-[var(--border)]"
              />
            </div>

            {/* Medications List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Prescribed Medications (Rx)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddMedicineRow}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <span>+ Add Medicine</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {rxMedicines.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-[var(--border)] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        Medicine #{idx + 1}
                      </span>
                      {rxMedicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicineRow(idx)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                        >
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Drug / Brand Name (e.g. Paracetamol, Azithromycin)"
                        value={med.name}
                        onChange={(e) => handleUpdateMedicineField(idx, 'name', e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Strength / Dosage (e.g. 500mg, 10ml, 1 tab)"
                        value={med.dosage}
                        onChange={(e) => handleUpdateMedicineField(idx, 'dosage', e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Frequency</label>
                        <input
                          type="text"
                          placeholder="e.g. 1-0-1, TDS, OD"
                          value={med.frequency}
                          onChange={(e) => handleUpdateMedicineField(idx, 'frequency', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Duration</label>
                        <input
                          type="text"
                          placeholder="e.g. 5 days, 1 week"
                          value={med.duration}
                          onChange={(e) => handleUpdateMedicineField(idx, 'duration', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Instructions</label>
                        <input
                          type="text"
                          placeholder="e.g. After food"
                          value={med.instructions}
                          onChange={(e) => handleUpdateMedicineField(idx, 'instructions', e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advice & Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Clinical Advice, Dietary Precautions & Follow-up
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Drink warm fluids, avoid heavy exertion, return for follow-up review after 5 days if symptoms do not improve."
                value={rxAdvice}
                onChange={(e) => setRxAdvice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-input text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white border border-[var(--border)]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setRxModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--border)] text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setRxModalOpen(false)
                  handleMarkCompleted(rxTargetAppt)
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Complete consultation without adding Rx text"
              >
                Skip Prescription & Complete
              </button>

              <button
                type="button"
                disabled={savingRx}
                onClick={handleSavePrescriptionAndComplete}
                className="w-full sm:flex-1 py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-sky-600 hover:brightness-110 text-white font-black text-xs shadow-md shadow-blue-500/25 border border-white/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {savingRx ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Prescription to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Rx & Complete Consultation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PATIENT MEDICAL HISTORY MODAL
          ======================================================== */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="liquid-glass-elevated w-full max-w-xl rounded-3xl p-5 sm:p-6 border border-white/40 dark:border-white/10 shadow-2xl space-y-4 text-left bg-white/95 dark:bg-slate-900/95 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Patient Medical History & Past Visits
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: <strong className="text-slate-800 dark:text-slate-200">{historyPatientName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyVisits.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-400" />
                <p>No prior visits recorded for this patient yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--border)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Visit Date: {visit.appointmentDate} • {visit.appointmentTime}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          visit.checkinStatus === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        }`}
                      >
                        {visit.checkinStatus}
                      </span>
                    </div>

                    <div className="font-mono text-[11px] text-slate-500">
                      Token #{visit.queueNumber || 'N/A'} • Universal Code: {visit.trackingCode10Digit}
                    </div>

                    {visit.notes ? (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--border)] text-slate-700 dark:text-slate-300 font-mono text-[11px] whitespace-pre-wrap">
                        {visit.notes}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">No notes recorded for this visit.</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
