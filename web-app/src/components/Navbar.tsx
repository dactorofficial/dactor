import React, { useState } from 'react'
import {
  Activity,
  Bell,
  LogIn,
  Menu,
  X,
  Stethoscope,
  Clock,
  FileText,
  Building2,
  Sparkles,
  User,
} from 'lucide-react'
import dactorLogo from '../assets/logo.png'

interface NavbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  onOpenTrackerModal: () => void
  onOpenReportModal: () => void
  onOpenNotificationModal: () => void
  unreadNotificationsCount?: number
  isLoggedIn?: boolean
  currentUserEmail?: string | null
  onLogout?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenTrackerModal,
  onOpenReportModal,
  onOpenNotificationModal,
  unreadNotificationsCount = 0,
  isLoggedIn = false,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { id: 'home', label: 'Home', icon: Activity },
    { id: 'clinics', label: 'Find Clinics & OPD', icon: Stethoscope },
    { id: 'patient-portal', label: 'Patient Portal', icon: User },
    { id: 'lab-reports', label: 'Lab Reports', icon: FileText },
    { id: 'average-time', label: 'Wait Time', icon: Clock },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo with Real App Icon */}
          <div
            className="flex items-center space-x-3 cursor-pointer group select-none"
            onClick={() => {
              setActiveTab('home')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            <img
              src={dactorLogo}
              alt="Dactor Logo"
              className="w-11 h-11 rounded-2xl object-contain shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform duration-200 bg-white border border-slate-100 p-0.5"
            />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-brand-600 transition-colors">
                  Dactor
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-800 tracking-wide uppercase">
                  Live
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 tracking-tight leading-none">
                Nepal OPD Queue & Healthcare Ecosystem
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center space-x-2.5">
            {/* Quick 10-Digit Code Tracker Button */}
            <button
              onClick={onOpenTrackerModal}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 rounded-xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Track live token queue by 10-digit code"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600 animate-pulse" />
              <span>Track 10-Digit Code</span>
            </button>

            {/* Patient Portal Quick Button */}
            <button
              onClick={() => setActiveTab('patient-portal')}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-150 cursor-pointer ${
                activeTab === 'patient-portal'
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-brand-400 hover:text-brand-700'
              }`}
              title="Open Patient Portal (Appointments, Family, Lab Reports & Bills)"
            >
              <User className="w-3.5 h-3.5" />
              <span>My Health</span>
            </button>

            {/* Notification Bell (Top right, non-overlapping) */}
            <button
              onClick={onOpenNotificationModal}
              className="relative p-2.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-xl transition-colors duration-150 cursor-pointer"
              title="View clinic announcements & notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Dedicated Doctor & Clinic Portal CTAs */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setActiveTab('doctor-portal')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-150 cursor-pointer ${
                  activeTab === 'doctor-portal'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                }`}
                title="Open Doctor Consultation Desk"
              >
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                <span>Doctor Desk</span>
              </button>

              <button
                onClick={() => setActiveTab('portal')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-150 cursor-pointer ${
                  activeTab === 'portal'
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-brand-50 hover:text-brand-700'
                }`}
                title="Open Clinic & Diagnostic Facility Portal"
              >
                <Building2 className="w-3.5 h-3.5 text-brand-600" />
                <span>Clinic Center</span>
              </button>

              {isLoggedIn && onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-semibold cursor-pointer"
                  title="Log Out"
                >
                  Logout
                </button>
              )}
            </div>
          </div>

          {/* Mobile menu button & top-right notification icon */}
          <div className="flex lg:hidden items-center space-x-2">
            <button
              onClick={onOpenNotificationModal}
              className="relative p-2 text-slate-600 hover:text-brand-600 bg-slate-100 rounded-xl"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              onClick={onOpenTrackerModal}
              className="p-2 text-brand-700 bg-brand-50 rounded-xl text-xs font-bold"
            >
              Track
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-100 space-y-2 animate-in slide-in-from-top duration-200">
            {navLinks.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5 text-brand-600" />
                  <span>{item.label}</span>
                </button>
              )
            })}

            <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
              <button
                onClick={() => {
                  onOpenReportModal()
                  setMobileMenuOpen(false)
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold text-brand-800 bg-brand-50 border border-brand-200"
              >
                <FileText className="w-4 h-4" />
                <span>Verify & View Lab Report</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('doctor-portal')
                  setMobileMenuOpen(false)
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Stethoscope className="w-4 h-4" />
                <span>Doctor Consultation Desk</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('portal')
                  setMobileMenuOpen(false)
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-brand-600 transition-colors shadow-sm"
              >
                <Building2 className="w-4 h-4" />
                <span>Clinic & Lab Management Portal</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
