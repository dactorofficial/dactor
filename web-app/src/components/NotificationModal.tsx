import React, { useState, useEffect } from 'react'
import {
  X,
  Bell,
  Clock,
  Building2,
  AlertCircle,
  Tag,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { getClinicNotifications } from '../services/db'
import { DactorNotification } from '../types'

interface NotificationModalProps {
  isOpen: boolean
  onClose: () => void
  clinicId?: string
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  clinicId = 'global',
}) => {
  const [notifications, setNotifications] = useState<DactorNotification[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotes = async () => {
    setLoading(true)
    try {
      const data = await getClinicNotifications(clinicId)
      // Provide clean default notifications if empty
      if (data.length === 0) {
        setNotifications([
          {
            id: 'demo-1',
            title: 'Live OPD Queue Engine Active',
            message: 'All clinics have real-time 10-digit tracking active. Patients can monitor their token number from home.',
            type: 'clinic_broadcast',
            isRead: false,
            createdAt: new Date().toISOString(),
            leftLabel: 'Department',
            leftValue: 'OPD Central',
            rightLabel: 'Priority',
            rightValue: 'High Alert',
          },
          {
            id: 'demo-2',
            title: 'Diagnostic Lab 3-Stage Pipeline Ready',
            message: 'Lab clinics can collect samples, mark processing, and upload PDF reports with mandatory patient name verification.',
            type: 'lab_report',
            isRead: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            leftLabel: 'Service',
            leftValue: 'Pathology Desk',
            rightLabel: 'Security',
            rightValue: 'Name-Verified',
          },
        ])
      } else {
        setNotifications(data)
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchNotes()
    }
  }, [isOpen, clinicId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[85vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center">
              <Bell className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Notifications & Alerts</h3>
              <p className="text-xs text-slate-500 font-medium">
                Clinic announcements & real-time updates
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchNotes}
              className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
          {notifications.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-brand-50/20 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 inline-block" />
                  <span>{note.title}</span>
                </h4>
                <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
                  {new Date(note.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {note.message}
              </p>

              {/* Template Meta Grid (matching app template requirement) */}
              {(note.leftLabel || note.rightLabel || note.trackingCode) && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                  {note.leftLabel && (
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">{note.leftLabel}</span>
                      <span className="font-bold text-slate-800">{note.leftValue || 'General'}</span>
                    </div>
                  )}

                  {note.rightLabel && (
                    <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block font-medium">{note.rightLabel}</span>
                      <span className="font-bold text-brand-700">{note.rightValue || 'Alert'}</span>
                    </div>
                  )}

                  {note.trackingCode && (
                    <div className="col-span-2 bg-brand-50 px-2.5 py-1.5 rounded-lg border border-brand-200 text-brand-900 font-bold">
                      Tracking Code: #{note.trackingCode}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Powered by Dactor Live Alert Transmission Engine
          </p>
        </div>
      </div>
    </div>
  )
}
