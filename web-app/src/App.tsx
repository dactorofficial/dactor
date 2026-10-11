import React, { useState } from 'react'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { FindClinics } from './pages/FindClinics'
import { ClinicDetail } from './pages/ClinicDetail'
import { LiveQueue } from './pages/LiveQueue'
import { LabReports } from './pages/LabReports'
import { AverageTime } from './pages/AverageTime'
import { ClinicPortal } from './pages/ClinicPortal'
import { LiveTrackerModal } from './components/LiveTrackerModal'
import { LabReportModal } from './components/LabReportModal'
import { NotificationModal } from './components/NotificationModal'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home')
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)
  const [activeTrackingCode, setActiveTrackingCode] = useState<string>('')
  const [clinicFilter, setClinicFilter] = useState<string>('all')

  // Modals
  const [trackerModalOpen, setTrackerModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [notificationModalOpen, setNotificationModalOpen] = useState(false)
  const [reportModalInitialCode, setReportModalInitialCode] = useState('')

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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Open live queue page with specific tracking code
  const handleOpenLiveQueue = (code: string) => {
    setActiveTrackingCode(code)
    setActiveTab('live-queue')
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
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-800 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Navbar with Aaransh360 Emerald Theme */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => handleNavigate(tab)}
        onOpenTrackerModal={() => setTrackerModalOpen(true)}
        onOpenReportModal={() => handleOpenReportModal()}
        onOpenNotificationModal={() => setNotificationModalOpen(true)}
        unreadNotificationsCount={2}
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

        {activeTab === 'average-time' && <AverageTime />}

        {activeTab === 'portal' && <ClinicPortal />}
      </main>

      {/* Modern Aaransh360-Style Footer */}
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
      />
    </div>
  )
}
