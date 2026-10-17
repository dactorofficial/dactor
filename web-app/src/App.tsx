import React, { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { BottomNav } from './components/BottomNav'
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
import { Login } from './pages/Login'
import { Support } from './pages/Support'
import { NotFound } from './pages/NotFound'
import { LiveTrackerModal } from './components/LiveTrackerModal'
import { LabReportModal } from './components/LabReportModal'
import { NotificationModal } from './components/NotificationModal'
import { getPatientNotifications, getDoctorById } from './services/db'
import { supabase } from './lib/supabase'
import { LiquidAuroraBackground } from './components/glass'

// Helper to determine initial tab from URL hash, path, or query
const getTabFromUrl = (): string => {
  if (typeof window === 'undefined') return 'home'

  // 1. Check URL query parameters (e.g. ?clinic=123 or ?page=support or ?tab=clinics)
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('clinic') || params.get('clinicId')) return 'clinic-detail'
    if (params.get('doctor') || params.get('doctorId')) return 'clinic-detail'
    if (params.get('code') || params.get('track')) return 'live-queue'
    if (params.get('q') || params.get('search') || params.get('specialty')) return 'clinics'

    const tabParam = params.get('tab') || params.get('page')
    if (tabParam) {
      const cleanParam = tabParam.toLowerCase().trim()
      if (cleanParam === 'login' || cleanParam === 'signin' || cleanParam === 'auth') return 'login'
      if (cleanParam === 'support' || cleanParam === 'contact' || cleanParam === 'helpdesk') return 'support'
      if (cleanParam === 'patient' || cleanParam === 'patient-portal' || cleanParam === 'my-health') return 'patient-portal'
      if (cleanParam === 'records' || cleanParam === 'medical-records') return 'records'
      if (cleanParam === 'account' || cleanParam === 'profile') return 'account'
      if (cleanParam === 'doctor' || cleanParam === 'doctor-portal' || cleanParam === 'practitioner') return 'doctor-portal'
      if (cleanParam === 'portal' || cleanParam === 'admin-portal' || cleanParam === 'clinic-portal' || cleanParam === 'clinic') return 'portal'
      if (cleanParam === 'clinics') return 'clinics'
      if (cleanParam === 'clinic-detail') return 'clinic-detail'
      if (cleanParam === 'lab-reports' || cleanParam === 'reports') return 'lab-reports'
      if (cleanParam === 'average-time' || cleanParam === 'wait-time') return 'average-time'
      if (cleanParam === 'live-queue' || cleanParam === 'queue') return 'live-queue'
      if (cleanParam === 'home') return 'home'
      return '404'
    }
  } catch {}

  // 2. Check URL Hash (e.g. #clinics, #live-queue, #records, #account)
  const rawHash = window.location.hash.toLowerCase()
  if (rawHash) {
    const hash = rawHash.replace(/^#\/?/, '').replace(/\/$/, '').split('?')[0]
    if (hash === '' || hash === 'home') return 'home'
    if (hash === 'login' || hash === 'signin' || hash === 'auth') return 'login'
    if (hash === 'support' || hash === 'contact' || hash === 'helpdesk') return 'support'
    if (
      hash === 'patient' ||
      hash === 'patient-portal' ||
      hash === 'my-health' ||
      hash === 'book' ||
      hash === 'booking' ||
      hash === 'book-appointment'
    )
      return 'patient-portal'
    if (hash === 'records') return 'records'
    if (hash === 'account' || hash === 'profile') return 'account'
    if (hash === 'doctor' || hash === 'doctor-portal' || hash === 'practitioner') return 'doctor-portal'
    if (
      hash === 'portal' ||
      hash === 'admin-portal' ||
      hash === 'clinic-portal' ||
      hash === 'clinic' ||
      hash === 'tickets' ||
      hash === 'admin-tickets' ||
      hash === 'helpdesk-admin' ||
      hash === 'admin'
    )
      return 'portal'
    if (hash === 'clinics') return 'clinics'
    if (hash === 'clinic-detail' || hash.startsWith('clinic')) return 'clinic-detail'
    if (hash === 'lab-reports' || hash === 'reports') return 'lab-reports'
    if (hash === 'average-time' || hash === 'wait-time') return 'average-time'
    if (hash === 'live-queue' || hash === 'queue') return 'live-queue'
    if (hash === '404' || hash === 'not-found' || hash === 'error') return '404'

    // If an unknown hash was specifically navigated to, it is a 404 broken link!
    return '404'
  }

  // 3. Check pathname (e.g. /support, /clinics, /records, /account)
  let path = window.location.pathname.toLowerCase().replace(/\/$/, '')
  // Support GitHub Pages project subpath /dactor or /dactor/
  if (path === '/dactor' || path === '/dactor/index.html' || path === '/dactor/index') {
    path = ''
  } else if (path.startsWith('/dactor/')) {
    path = path.slice('/dactor'.length).replace(/\/$/, '')
  }

  if (!path || path === '' || path === '/' || path === '/index.html' || path === '/index') return 'home'

  if (path.includes('login') || path.includes('signin') || path.includes('auth')) return 'login'
  if (path.includes('support') || path.includes('contact') || path.includes('helpdesk')) return 'support'
  if (path.includes('records')) return 'records'
  if (path.includes('account') || path.includes('profile')) return 'account'
  if (
    path.includes('patient') ||
    path.includes('my-health') ||
    path.includes('book') ||
    path.includes('booking')
  )
    return 'patient-portal'
  if (path.includes('doctor') || path.includes('practitioner')) return 'doctor-portal'
  if (
    path.includes('admin-portal') ||
    path.includes('/portal') ||
    path.includes('clinic-portal') ||
    path.includes('tickets') ||
    path.includes('admin')
  )
    return 'portal'
  if (path.includes('clinics')) return 'clinics'
  if (path.includes('lab-reports')) return 'lab-reports'
  if (path.includes('average-time')) return 'average-time'
  if (path.includes('live-queue')) return 'live-queue'
  if (path.includes('home')) return 'home'
  if (path.includes('404') || path.includes('not-found')) return '404'

  // Non-empty unknown path is a 404 broken link
  return '404'
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(() => getTabFromUrl())
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('clinic')) return p.get('clinic')
      if (p.get('clinicId')) return p.get('clinicId')
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
        return hashParams.get('clinic') || hashParams.get('clinicId') || null
      }
      return null
    } catch {
      return null
    }
  })
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('doctor')) return p.get('doctor')
      if (p.get('doctorId')) return p.get('doctorId')
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
        return hashParams.get('doctor') || hashParams.get('doctorId') || null
      }
      return null
    } catch {
      return null
    }
  })
  const [autoOpenBooking, setAutoOpenBooking] = useState<boolean>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const action = p.get('action') || p.get('intent')
      if (action === 'book' || action === 'appointment' || action === 'reserve') return true
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
        const hashAction = hashParams.get('action') || hashParams.get('intent')
        return hashAction === 'book' || hashAction === 'appointment' || hashAction === 'reserve'
      }
      return false
    } catch {
      return false
    }
  })
  const [activeTrackingCode, setActiveTrackingCode] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      return p.get('code') || p.get('track') || ''
    } catch {
      return ''
    }
  })
  const [clinicFilter, setClinicFilter] = useState<string>('all')
  const [rescheduleTrackingCode, setRescheduleTrackingCode] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      return p.get('rescheduleCode') || p.get('followupCode') || ''
    } catch {
      return ''
    }
  })
  const [isRescheduleMode, setIsRescheduleMode] = useState<boolean>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      return p.get('reschedule') === 'true'
    } catch {
      return false
    }
  })

  // Isolated Authentication State per Active Portal Tab
  const getTabAuthState = (tab: string) => {
    try {
      if (tab === 'portal') {
        const isClinic = localStorage.getItem('dactor_clinic_logged_in') === 'true'
        const email = localStorage.getItem('dactor_clinic_email') || null
        return {
          isLoggedIn: isClinic,
          currentUserEmail: isClinic ? email : null,
          authRole: isClinic ? ('clinic_manager' as const) : null,
        }
      }
      if (tab === 'doctor-portal') {
        const isDoc =
          localStorage.getItem('dactor_doctor_logged_in') === 'true' &&
          Boolean(localStorage.getItem('dactor_doctor_session'))
        const email = localStorage.getItem('dactor_doctor_email') || null
        return {
          isLoggedIn: isDoc,
          currentUserEmail: isDoc ? email : null,
          authRole: isDoc ? ('doctor' as const) : null,
        }
      }
      if (tab === 'patient-portal' || tab === 'records' || tab === 'account') {
        const isPat =
          localStorage.getItem('dactor_patient_logged_in') === 'true' ||
          Boolean(localStorage.getItem('dactor_patient_session'))
        const email = localStorage.getItem('dactor_patient_email') || null
        return {
          isLoggedIn: isPat,
          currentUserEmail: isPat ? email : null,
          authRole: isPat ? ('patient' as const) : null,
        }
      }
      // Public browsing tabs: associate with patient session if active
      const isPat =
        localStorage.getItem('dactor_patient_logged_in') === 'true' ||
        Boolean(localStorage.getItem('dactor_patient_session'))
      if (isPat) {
        return {
          isLoggedIn: true,
          currentUserEmail: localStorage.getItem('dactor_patient_email') || null,
          authRole: 'patient' as const,
        }
      }
      return { isLoggedIn: false, currentUserEmail: null, authRole: null }
    } catch {
      return { isLoggedIn: false, currentUserEmail: null, authRole: null }
    }
  }

  const initialTabAuth = getTabAuthState(getTabFromUrl())
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(initialTabAuth.isLoggedIn)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(initialTabAuth.currentUserEmail)
  const [authRole, setAuthRole] = useState<'clinic_manager' | 'doctor' | 'patient' | null>(initialTabAuth.authRole)

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
      const st = getTabAuthState(tab)
      setIsLoggedIn(st.isLoggedIn)
      setCurrentUserEmail(st.currentUserEmail)
      setAuthRole(st.authRole)
    }

    const syncAuth = () => {
      try {
        const currentTab = getTabFromUrl()
        const st = getTabAuthState(currentTab)
        setIsLoggedIn(st.isLoggedIn)
        setCurrentUserEmail(st.currentUserEmail)
        setAuthRole(st.authRole)
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

  // Resolve clinic if only doctor ID was provided in URL (e.g. direct Google Search or AI overview link)
  useEffect(() => {
    if (selectedDoctorId && !selectedClinicId) {
      let isMounted = true
      getDoctorById(selectedDoctorId).then((doc) => {
        if (isMounted && doc?.clinicId) {
          setSelectedClinicId(doc.clinicId)
        }
      })
      return () => {
        isMounted = false
      }
    }
  }, [selectedDoctorId, selectedClinicId])

  // Navigation handler with deep link support
  const handleNavigate = (tab: string, params?: any) => {
    if (tab === 'clinic-detail' && (params?.clinicId || selectedClinicId)) {
      const cId = params?.clinicId || selectedClinicId
      setSelectedClinicId(cId)
      if (params?.doctorId !== undefined) {
        setSelectedDoctorId(params.doctorId || null)
      }
      if (params?.action === 'book' || params?.autoOpenBooking || params?.isReschedule) {
        setAutoOpenBooking(true)
      } else {
        setAutoOpenBooking(false)
      }
      if (params?.trackingCode || params?.followupCode) {
        setRescheduleTrackingCode(params.trackingCode || params.followupCode)
      } else if (params?.resetTrackingCode) {
        setRescheduleTrackingCode('')
      }
      if (params?.isReschedule !== undefined) {
        setIsRescheduleMode(Boolean(params.isReschedule))
      } else if (params?.resetTrackingCode) {
        setIsRescheduleMode(false)
      }
      setActiveTab('clinic-detail')
      try {
        const url = new URL(window.location.href)
        url.searchParams.set('clinic', cId!)
        if (params?.doctorId) url.searchParams.set('doctor', params.doctorId)
        else url.searchParams.delete('doctor')
        if (params?.action === 'book') url.searchParams.set('action', 'book')
        else url.searchParams.delete('action')
        if (params?.trackingCode) {
          url.searchParams.set(params.isReschedule ? 'rescheduleCode' : 'followupCode', params.trackingCode)
        }
        if (params?.isReschedule !== undefined) {
          url.searchParams.set('reschedule', String(params.isReschedule))
        }
        url.searchParams.delete('tab')
        url.searchParams.delete('page')
        window.history.pushState({}, '', url.toString())
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (tab === 'clinics' && params?.filter) {
      setClinicFilter(params.filter)
    }

    setActiveTab(tab)
    const nextAuth = getTabAuthState(tab)
    setIsLoggedIn(nextAuth.isLoggedIn)
    setCurrentUserEmail(nextAuth.currentUserEmail)
    setAuthRole(nextAuth.authRole)

    try {
      const url = new URL(window.location.href)
      if (tab === 'home') {
        url.search = ''
      } else {
        url.searchParams.delete('clinic')
        url.searchParams.delete('doctor')
        url.searchParams.delete('action')
        url.searchParams.set('tab', tab)
      }
      window.history.pushState({}, '', url.toString())
    } catch {}

    if (window.location.hash !== `#${tab}`) {
      window.location.hash = `#${tab}`
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle logout
  const handleLogout = () => {
    try {
      if (activeTab === 'portal') {
        localStorage.removeItem('dactor_clinic_logged_in')
        localStorage.removeItem('dactor_clinic_email')
        localStorage.removeItem('dactor_clinic_role')
      } else if (activeTab === 'doctor-portal') {
        localStorage.removeItem('dactor_doctor_session')
        localStorage.removeItem('dactor_doctor_email')
        localStorage.removeItem('dactor_doctor_logged_in')
        localStorage.removeItem('dactor_doctor_pending_kyc')
      } else {
        localStorage.removeItem('dactor_patient_session')
        localStorage.removeItem('dactor_patient_email')
        localStorage.removeItem('dactor_patient_logged_in')
      }
      const st = getTabAuthState(activeTab)
      setIsLoggedIn(st.isLoggedIn)
      setCurrentUserEmail(st.currentUserEmail)
      setAuthRole(st.authRole)
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
    <LiquidAuroraBackground>
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
            initialDoctorId={selectedDoctorId || undefined}
            autoOpenBooking={autoOpenBooking}
            initialTrackingCode={rescheduleTrackingCode || undefined}
            isReschedule={isRescheduleMode}
            onBack={() => {
              setRescheduleTrackingCode('')
              setIsRescheduleMode(false)
              handleNavigate('clinics')
            }}
            onOpenLiveQueue={handleOpenLiveQueue}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'clinic-detail' && !selectedClinicId && selectedDoctorId ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Opening doctor consultation & direct booking details...
              </p>
            </div>
          </div>
        ) : activeTab === 'clinic-detail' && !selectedClinicId ? (
          <NotFound
            attemptedPath="Clinic ID was not specified"
            onNavigate={handleNavigate}
            onOpenTrackerModal={() => setTrackerModalOpen(true)}
            onOpenReportModal={handleOpenReportModal}
          />
        ) : null}

        {(activeTab === 'live-queue' || activeTab === 'lab-reports') && (
          <LiveQueue
            initialCode={activeTrackingCode}
            onOpenReportModal={handleOpenReportModal}
            onNavigateHome={() => handleNavigate('home')}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'average-time' && (
          <AverageTime
            onSelectClinic={(clinicId) => handleNavigate('clinic-detail', { clinicId })}
          />
        )}

        {(activeTab === 'patient-portal' || activeTab === 'records' || activeTab === 'account') && (
          <PatientPortal
            initialTab={activeTab === 'records' ? 'records' : activeTab === 'account' ? 'account' : 'book'}
            onNavigateHome={() => handleNavigate('home')}
            onOpenLiveQueue={handleOpenLiveQueue}
            onOpenReportModal={handleOpenReportModal}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'login' && (
          <Login
            onNavigate={handleNavigate}
            onOpenTrackerModal={() => setTrackerModalOpen(true)}
            onOpenReportModal={handleOpenReportModal}
          />
        )}

        {activeTab === 'doctor-portal' && <DoctorPortal />}

        {activeTab === 'portal' && <ClinicPortal />}
        {activeTab === 'support' && <Support />}

        {/* 404 Not Found & Broken Link Handler */}
        {(activeTab === '404' ||
          ![
            'home',
            'clinics',
            'clinic-detail',
            'live-queue',
            'lab-reports',
            'average-time',
            'patient-portal',
            'login',
            'doctor-portal',
            'portal',
            'support',
          ].includes(activeTab)) && (
          <NotFound
            attemptedPath={
              typeof window !== 'undefined'
                ? window.location.pathname + window.location.hash
                : activeTab
            }
            onNavigate={handleNavigate}
            onOpenTrackerModal={() => setTrackerModalOpen(true)}
            onOpenReportModal={handleOpenReportModal}
          />
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

      {/* Mobile Bottom Navigation Bar (Visible on mobile/tablet) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTrackerModal={() => setTrackerModalOpen(true)}
        authRole={authRole}
      />

      <LiveTrackerModal
        isOpen={trackerModalOpen}
        onClose={() => setTrackerModalOpen(false)}
        onOpenFullQueue={handleOpenLiveQueue}
        onNavigateSupport={(ticketCode) => {
          if (ticketCode) {
            window.location.hash = `#support?track=${encodeURIComponent(ticketCode)}`
          } else {
            window.location.hash = '#support?view=track'
          }
          setActiveTab('support')
        }}
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
    </LiquidAuroraBackground>
  )
}
