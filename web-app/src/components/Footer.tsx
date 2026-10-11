import React from 'react'
import {
  Activity,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  Heart,
  ChevronRight,
} from 'lucide-react'

interface FooterProps {
  onNavigate: (tab: string) => void
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/25">
                <Activity className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">Dactor</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Empowering healthcare facilities with real-time OPD queue transparency, seamless doctor consultations, and 3-stage diagnostic lab tracking with verified report delivery.
            </p>
            <div className="pt-2 flex items-center space-x-3 text-xs text-slate-400">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Verified Clinics & Doctors
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Zero Queue Waiting
              </span>
            </div>
          </div>

          {/* Patient Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">For Patients</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onNavigate('clinics')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Find Clinics & Doctors</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('clinics')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Book OPD Appointments</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('lab-reports')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Download Lab Reports</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('average-time')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Live Wait Time Insights</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Clinics & Healthcare Providers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">For Providers</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onNavigate('portal')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Unified Clinic Portal</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('portal')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Doctor Consultation Desk</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('portal')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Lab Technicians & Rates</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('portal')}
                  className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Reception Walk-In Tokens</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Contact</h4>
            <div className="space-y-2.5 text-sm text-slate-400">
              <div className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Kathmandu, Nepal & India Regional OPD Hubs</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>support@dactor.health</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>+977-9800000000 / OPD Desk</span>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Notice & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="max-w-2xl text-slate-400 leading-normal">
            <strong className="text-rose-400 font-semibold">Medical Notice:</strong> Dactor is designed for scheduled OPD clinic visits, token tracking, and diagnostic reports. If you are experiencing an acute medical emergency, please call your local emergency service or proceed to an emergency room immediately.
          </p>
          <div className="flex items-center space-x-1 shrink-0 text-slate-400">
            <span>© {new Date().getFullYear()} Dactor Health. Built with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 mx-0.5" />
            <span>for better care.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
