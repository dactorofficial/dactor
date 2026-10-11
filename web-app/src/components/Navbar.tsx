import React, { useState } from 'react'
import {
  Activity,
  Search,
  Bell,
  LogIn,
  Menu,
  X,
  Stethoscope,
  Clock,
  FileText,
  Building2,
  Sparkles,
} from 'lucide-react'

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
  currentUserEmail = null,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { id: 'home', label: 'Home', icon: Activity },
    { id: 'clinics', label: 'Find Clinics & OPD', icon: Stethoscope },
    { id: 'lab-reports', label: 'Lab Reports', icon: FileText },
    { id: 'average-time', label: 'Average Wait Time', icon: Clock },
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
              src="./app_logo.png"
              alt="Dactor Logo"
              className="w-11 h-11 rounded-2xl object-contain shadow-md shadow-cyan-600/20 group-hover:scale-105 transition-transform duration-200 bg-white border border-slate-100 p-0.5"
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
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
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
          <div className="hidden sm:flex items-center space-x-3">
            {/* Quick 10-Digit Code Tracker Button */}
            <button
              onClick={onOpenTrackerModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 rounded-xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Track live token queue by 10-digit code"
            >
              <Sparkles className="w-4 h-4 text-brand-600 animate-pulse" />
              <span>Track 10-Digit Code</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotificationModal}
              className="relative p-2.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-xl transition-colors duration-150 cursor-pointer"
              title="View clinic announcements & notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Clinic & Doctor Unified Portal CTA */}
            {isLoggedIn ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('portal')}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-600/20 transition-all duration-150 hover:scale-[1.02] cursor-pointer"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Clinic Desk</span>
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-semibold cursor-pointer"
                    title="Log Out"
                  >
                    Logout
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('portal')}
                className="flex items-center space-x-2 px-4 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-brand-600 rounded-xl shadow-md shadow-slate-900/10 hover:shadow-brand-600/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Clinic / Doctor Portal</span>
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
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
          <div className="md:hidden py-4 border-t border-slate-100 space-y-2 animate-in slide-in-from-top duration-200">
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
                  setActiveTab('portal')
                  setMobileMenuOpen(false)
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-brand-600 transition-colors shadow-sm"
              >
                <Building2 className="w-4 h-4" />
                <span>Clinic / Doctor Portal</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
