import React, { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { FindClinics } from './pages/FindClinics'
import { ClinicDetail } from './pages/ClinicDetail'
import { LiveQueue } from './pages/LiveQueue'
import { LabReports } from './pages/LabReports'
import { AverageTime } from './pages/AverageTime'
import { ClinicPortal } from './pages/ClinicPortal'
import { PatientPortal } from './pages/PatientPortal'
import { DoctorPortal } from './pages/DoctorPortal'
import { LiveTrackerModal } from './components/LiveTrackerModal'
import { LabReportModal } from './components/LabReportModal'
import { NotificationModal } from './components/NotificationModal'
import { getPatientNotifications } from './services/db'
import { supabase } from './lib/supabase'

// Helper to determine initial tab from URL hash or path
const getTabFromUrl = (): string => {
  const hash = window.location.hash.toLowerCase().replace('#', '').replace('/', '')
  if (hash === 'patient' || hash === 'patient-portal' || hash === 'my-health') return 'patient-portal'
  if (hash === 'doctor' || hash === 'doctor-portal' || hash === 'practitioner') return 'doctor-portal'
  if (hash === 'portal' || hash === 'admin-portal' || hash === 'clinic-portal' || hash === 'clinic') return 'portal'
  if (hash === 'clinics') return 'clinics'
  if (hash === 'lab-reports' || hash === 'reports') return 'lab-reports'
  if (hash === 'average-time' || hash === 'wait-time') return 'average-time'
  if (hash === 'live-queue' || hash === 'queue') return 'live-queue'
  if (hash === 'home') return 'home'

  const path = window.location.pathname.toLowerCase()
  if (path.includes('patient') || path.includes('my-health')) return 'patient-portal'
  if (path.includes('doctor') || path.includes('practitioner')) return 'doctor-portal'
  if (path.includes('admin-portal') || path.includes('/portal') || path.includes('clinic-portal')) return 'portal'
  if (path.includes('clinics')) return 'clinics'
  if (path.includes('lab-reports')) return 'lab-reports'
  if (path.includes('average-time')) return 'average-time'
  if (path.includes('live-queue')) return 'live-queue'

  return 'home'
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(() => getTabFromUrl())
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)
  const [activeTrackingCode, setActiveTrackingCode] = useState<string>('')
  const [clinicFilter, setClinicFilter] = useState<string>('all')

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dactor_auth_logged_in') === 'true'
    } catch {
      return false
    }
  })
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem('dactor_auth_email') || null
    } catch {
      return null
    }
  })
  const [authRole, setAuthRole] = useState<'clinic_manager' | 'doctor' | 'patient' | null>(() => {
    try {
      return (localStorage.getItem('dactor_auth_role') as any) || null
    } catch {
      return null
    }
  })

  // Live unread notification count from Supabase (never hardcoded)
  const [unreadCount, setUnreadCount] = useState<number>(0)

  // Modals
  const [trackerModalOpen, setTrackerModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [reportModalInitialCode, setReportModalInitialCode] = useState('')

  const refreshUnreadNotifications = async () => {
    try {
      let trackingCodes: string[] = []
      let userId: string | undefined = undefined
      try {
        trackingCodes = JSON.parse(localStorage.getItem('dactor_patient_tracking_codes') || '[]')
        const sessionRaw = localStorage.getItem('dactor_patient_session')
        if (sessionRaw) {
          const parsed = JSON.parse(sessionRaw)
          if (parsed?.id) userId = parsed.id
        }
      } catch {}

      const list = await getPatientNotifications({ userId, trackingCodes })
      setUnreadCount(list.filter((n) => !n.isRead).length)
    } catch {}
  }

  // Sync with browser URL hash & Supabase realtime notifications
  useEffect(() => {
    const handleHashChange = () => {
      const tab = getTabFromUrl()
      setActiveTab(tab)
    }

    const syncAuth = () => {
      try {
        setIsLoggedIn(localStorage.getItem('dactor_auth_logged_in') === 'true')
        setCurrentUserEmail(localStorage.getItem('dactor_auth_email') || null)
        setAuthRole((localStorage.getItem('dactor_auth_role') as any) || null)
        refreshUnreadNotifications()
      } catch {}
    }

    refreshUnreadNotifications()

    const channel = supabase
      .channel('app-unread-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        refreshUnreadNotifications()
      })
      .subscribe()

    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('storage', syncAuth)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('storage', syncAuth)
      supabase.removeChannel(channel)
    }
  }, [])

  // Navigation handler
  const handleNavigate = (tab: string, params?: any) => {
    if (tab === 'clinic-detail' && params?.clinicId) {
      setSelectedClinicId(params.clinicId)
      setActiveTab('clinic-detail')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (tab === 'clinics' && params?.filter) {
      setClinicFilter(params.filter)
    }

    setActiveTab(tab)
    if (window.location.hash !== `#${tab}`) {
      window.location.hash = `#${tab}`
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle logout
  const handleLogout = () => {
    try {
      localStorage.removeItem('dactor_auth_logged_in')
      localStorage.removeItem('dactor_auth_email')
      localStorage.removeItem('dactor_auth_role')
      localStorage.removeItem('dactor_doctor_session')
      localStorage.removeItem('dactor_doctor_email')
      localStorage.removeItem('dactor_doctor_pending_kyc')
      localStorage.removeItem('dactor_patient_session')
      localStorage.removeItem('dactor_patient_email')
      setIsLoggedIn(false)
      setCurrentUserEmail(null)
      setAuthRole(null)
      window.dispatchEvent(new Event('storage'))
    } catch {}
  }

  // Open live queue page with specific tracking code
  const handleOpenLiveQueue = (code: string) => {
    setActiveTrackingCode(code)
    setActiveTab('live-queue')
    window.location.hash = '#live-queue'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Open report modal with specific code
  const handleOpenReportModal = (code?: string) => {
    if (code) {
      setReportModalInitialCode(code)
    }
    setReportModalOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-800 font-sans selection:bg-brand-500 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => handleNavigate(tab)}
        onOpenTrackerModal={() => setTrackerModalOpen(true)}
        onOpenReportModal={() => handleOpenReportModal()}
        onOpenNotificationModal={() => setNotificationModalOpen(true)}
        unreadNotificationsCount={unreadCount}
        isLoggedIn={isLoggedIn}
        currentUserEmail={currentUserEmail}
        authRole={authRole}
        onLogout={handleLogout}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <Home
            onNavigate={handleNavigate}
            onOpenTrackerModal={(code) => {
              if (code) {
                handleOpenLiveQueue(code)
              } else {
                setTrackerModalOpen(true)
              }
            }}
            onOpenReportModal={handleOpenReportModal}
          />
        )}

        {activeTab === 'clinics' && (
          <FindClinics
            onSelectClinic={(clinicId) => handleNavigate('clinic-detail', { clinicId })}
            initialFilter={clinicFilter}
          />
        )}

        {activeTab === 'clinic-detail' && selectedClinicId && (
          <ClinicDetail
            clinicId={selectedClinicId}
            onBack={() => handleNavigate('clinics')}
            onOpenLiveQueue={handleOpenLiveQueue}
          />
        )}

        {activeTab === 'live-queue' && (
          <LiveQueue
            initialCode={activeTrackingCode}
            onOpenReportModal={handleOpenReportModal}
          />
        )}

        {activeTab === 'lab-reports' && <LabReports />}

        {activeTab === 'average-time' && (
          <AverageTime
            onSelectClinic={(clinicId) => handleNavigate('clinic-detail', { clinicId })}
          />
        )}

        {activeTab === 'patient-portal' && (
          <PatientPortal
            onNavigateHome={() => handleNavigate('home')}
            onOpenLiveQueue={handleOpenLiveQueue}
            onOpenReportModal={handleOpenReportModal}
          />
        )}

        {activeTab === 'doctor-portal' && <DoctorPortal />}

        {activeTab === 'portal' && <ClinicPortal />}
      </main>

      <Footer onNavigate={handleNavigate} />

      {/* Global Interactive Modals */}
      <LiveTrackerModal
        isOpen={trackerModalOpen}
        onClose={() => setTrackerModalOpen(false)}
        onOpenFullQueue={handleOpenLiveQueue}
      />

      <LabReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        initialCode={reportModalInitialCode}
      />

      <NotificationModal
        isOpen={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        clinicId={selectedClinicId || 'global'}
        onNotificationsChanged={(count) => setUnreadCount(count)}
      />
    </div>
  )
}
