import React, { useState } from 'react'
import {
  X,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  ShieldCheck,
  AlertCircle,
  FlaskConical,
  ExternalLink,
} from 'lucide-react'
import { getLabReportsByTrackingCode, getAppointmentByTrackingCode } from '../services/db'
import { LabReport, Appointment } from '../types'

interface LabReportModalProps {
  isOpen: boolean
  onClose: () => void
  initialCode?: string
}

export const LabReportModal: React.FC<LabReportModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
}) => {
  const [code, setCode] = useState(initialCode)
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<LabReport[]>([])
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [searched, setSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Verification state
  const [verifyNameInput, setVerifyNameInput] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  // Preview modal state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string>('pdf')

  if (!isOpen) return null

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const clean = code.trim().replace(/\D/g, '')
    if (clean.length < 5) {
      setErrorMsg('Please enter a valid tracking code.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setVerifyError('')
    setIsVerified(false)
    setVerifyNameInput('')
    try {
      const [reportsData, apptData] = await Promise.all([
        getLabReportsByTrackingCode(clean),
        getAppointmentByTrackingCode(clean),
      ])

      setReports(reportsData)
      setAppointment(apptData)
      setSearched(true)

      if (reportsData.length === 0 && !apptData) {
        setErrorMsg('No diagnostic record found for this tracking code.')
      }
    } catch {
      setErrorMsg('Error retrieving diagnostic report status.')
    } finally {
      setLoading(false)
    }
  }

  // Name verification check
  const handleVerifyName = (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyNameInput.trim()) {
      setVerifyError('Please enter your full name as registered.')
      return
    }

    // Expected name from appointment or report
    const targetName = (
      appointment?.patientName ||
      reports[0]?.patientName ||
      ''
    ).trim().toLowerCase()

    const inputName = verifyNameInput.trim().toLowerCase()

    // Match if first word matches or substring matches
    const targetParts = targetName.split(/\s+/)
    const inputParts = inputName.split(/\s+/)

    const isMatch =
      targetName.includes(inputName) ||
      inputName.includes(targetName) ||
      targetParts.some((p) => inputParts.includes(p) && p.length > 2)

    if (isMatch) {
      setIsVerified(true)
      setVerifyError('')
    } else {
      setVerifyError('Name does not match the patient on file. Please enter the exact name provided during booking.')
    }
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'sample_collected':
        return {
          label: 'Sample Collected',
          desc: 'Your specimen has been collected at the clinic and forwarded to the diagnostic laboratory.',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: FlaskConical,
        }
      case 'processing':
        return {
          label: 'Processing in Lab',
          desc: 'Your diagnostic sample is currently in laboratory processing and pathology analysis.',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse',
          icon: Clock,
        }
      case 'prepared':
      case 'delivered':
        return {
          label: 'Prepared & Ready',
          desc: 'Your certified lab report is ready. Verify your registered patient name below to view or download.',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: CheckCircle2,
        }
      default:
        return {
          label: 'Booking Received',
          desc: 'Appointment registered. Awaiting sample collection at clinic reception.',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Clock,
        }
    }
  }

  // Determine current active status
  const currentStatus =
    reports.length > 0
      ? reports[0].status
      : appointment?.checkinStatus === 'completed'
      ? 'prepared'
      : appointment?.checkinStatus === 'in_consultation'
      ? 'processing'
      : 'sample_collected'

  const statusInfo = getStatusDisplay(currentStatus)
  const StatusIcon = statusInfo.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <FlaskConical className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">Diagnostic Lab Reports</h3>
            <p className="text-xs text-slate-500 font-medium">
              3-Stage live status & name-verified report retrieval
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 10-digit code (e.g. 9812345678)"
              maxLength={10}
              className="w-full px-4 py-3.5 pl-11 text-lg font-bold tracking-widest text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              autoFocus
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-4" />
          </div>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold rounded-2xl transition-all shadow-md shadow-teal-600/20 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <Clock className="w-5 h-5 animate-spin" />
                <span>Checking Lab Status...</span>
              </span>
            ) : (
              <span>Track Lab Status</span>
            )}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Result Area */}
        {searched && (reports.length > 0 || appointment) && (
          <div className="mt-6 space-y-5 animate-in slide-in-from-bottom duration-200">
            {/* 3-Stage Progress Indicator */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Diagnostic Pipeline
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}
                >
                  <StatusIcon className="w-3.5 h-3.5 mr-1" />
                  {statusInfo.label}
                </span>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-3 gap-2 relative mt-2">
                {/* Step 1: Collected */}
                <div
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    currentStatus === 'sample_collected' ||
                    currentStatus === 'processing' ||
                    currentStatus === 'prepared' ||
                    currentStatus === 'delivered'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase">Step 1</div>
                  <div className="text-xs font-bold mt-0.5">Sample Collected</div>
                </div>

                {/* Step 2: Processing */}
                <div
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    currentStatus === 'processing' ||
                    currentStatus === 'prepared' ||
                    currentStatus === 'delivered'
                      ? currentStatus === 'processing'
                        ? 'bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-300'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase">Step 2</div>
                  <div className="text-xs font-bold mt-0.5">Processing</div>
                </div>

                {/* Step 3: Prepared */}
                <div
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    currentStatus === 'prepared' || currentStatus === 'delivered'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-300'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase">Step 3</div>
                  <div className="text-xs font-bold mt-0.5">Report Prepared</div>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-3 font-medium bg-white p-2.5 rounded-xl border border-slate-100">
                {statusInfo.desc}
              </p>
            </div>

            {/* If Status is PREPARED: Require Name Verification before Viewing/Downloading */}
            {(currentStatus === 'prepared' || currentStatus === 'delivered') && (
              <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Confidentiality: Name Verification Required</span>
                </div>
                <p className="text-xs text-slate-600">
                  To safeguard personal medical information, please verify the registered patient name before accessing the report file.
                </p>

                {!isVerified ? (
                  <form onSubmit={handleVerifyName} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={verifyNameInput}
                        onChange={(e) => setVerifyNameInput(e.target.value)}
                        placeholder="Enter Patient Full Name"
                        className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    {verifyError && (
                      <p className="text-xs text-rose-600 font-medium">{verifyError}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Name & Unlock Report</span>
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-center space-x-2 text-emerald-900 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Identity Verified! Patient: {appointment?.patientName || reports[0]?.patientName}</span>
                    </div>

                    {/* Report Files List */}
                    {reports.length > 0 && reports[0].reportFileUrl ? (
                      <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {reports[0].testName || 'Diagnostic Lab Report'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Ready for Download • Verified
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* In-app Preview */}
                          <button
                            onClick={() => {
                              setPreviewUrl(reports[0].reportFileUrl || null)
                              setPreviewType(reports[0].reportFileType || 'pdf')
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {/* Direct Download */}
                          <a
                            href={reports[0].reportFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-white rounded-xl border border-emerald-200 text-xs text-slate-600">
                        <p className="font-semibold text-slate-900">
                          {reports[0]?.testName || 'Diagnostic Test'} marked Prepared.
                        </p>
                        <p className="mt-1">
                          The physical report is ready at the clinic desk, or an electronic copy will be uploaded shortly by the lab technician.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* In-App Preview Lightbox Modal */}
        {previewUrl && (
          <div className="fixed inset-0 z-60 bg-black/80 flex flex-col p-4">
            <div className="flex justify-between items-center text-white mb-2">
              <span className="font-bold text-sm">Lab Report Document Preview</span>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-1 hover:bg-white/20 rounded-lg text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-white rounded-2xl overflow-hidden relative">
              {previewType === 'image' || previewUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                <img
                  src={previewUrl}
                  alt="Lab Report"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title="PDF Preview"
                  className="w-full h-full border-none"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
