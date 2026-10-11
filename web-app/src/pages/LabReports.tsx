import React, { useState } from 'react'
import {
  FlaskConical,
  Search,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  ShieldCheck,
  AlertCircle,
  FileText,
  Building2,
  Lock,
} from 'lucide-react'
import { getLabReportsByTrackingCode, getAppointmentByTrackingCode } from '../services/db'
import { LabReport, Appointment } from '../types'

export const LabReports: React.FC = () => {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<LabReport[]>([])
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [searched, setSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Verification state
  const [verifyNameInput, setVerifyNameInput] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  // Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
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
        setErrorMsg('No diagnostic lab records found matching this tracking code.')
      }
    } catch {
      setErrorMsg('Error retrieving diagnostic report status.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyNameInput.trim()) {
      setVerifyError('Please enter the patient full name.')
      return
    }

    const targetName = (
      appointment?.patientName ||
      reports[0]?.patientName ||
      ''
    ).trim().toLowerCase()

    const inputName = verifyNameInput.trim().toLowerCase()
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
      setVerifyError('Name does not match patient records. Please check the spelling.')
    }
  }

  const currentStatus =
    reports.length > 0
      ? reports[0].status
      : appointment?.checkinStatus === 'completed'
      ? 'prepared'
      : appointment?.checkinStatus === 'in_consultation'
      ? 'processing'
      : 'sample_collected'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wider">
          <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
          <span>Pathology & Lab Diagnostics</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Retrieve Diagnostic Lab Reports
        </h1>
        <p className="text-sm text-slate-500 font-medium max-w-xl mx-auto">
          Track 3-stage status and securely access verified lab test reports with patient identity verification.
        </p>
      </div>

      {/* Code Input */}
      <div className="max-w-xl mx-auto">
        <form
          onSubmit={handleSearch}
          className="p-2 bg-white rounded-3xl border border-slate-200/80 shadow-md flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 10-Digit Tracking Code..."
              maxLength={10}
              className="w-full px-4 py-3 pl-11 text-lg font-black tracking-wider text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal"
            />
            <Search className="w-5 h-5 text-teal-600 absolute left-3.5 top-3.5" />
          </div>
          <button
            type="submit"
            className="px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-md shadow-teal-600/20 transition-all shrink-0"
          >
            {loading ? 'Checking...' : 'Check Status'}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Results Area */}
      {searched && (reports.length > 0 || appointment) && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in duration-200">
          {/* 3-Stage Process Card */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Laboratory Processing Status
              </span>
              <span className="text-xs font-black font-mono text-slate-800">
                Code: #{code}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div
                className={`p-4 rounded-2xl border text-center transition-all ${
                  currentStatus === 'sample_collected' ||
                  currentStatus === 'processing' ||
                  currentStatus === 'prepared' ||
                  currentStatus === 'delivered'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="text-[10px] font-bold uppercase">Stage 1</div>
                <div className="text-xs sm:text-sm font-black mt-1">Sample Collected</div>
              </div>

              <div
                className={`p-4 rounded-2xl border text-center transition-all ${
                  currentStatus === 'processing' ||
                  currentStatus === 'prepared' ||
                  currentStatus === 'delivered'
                    ? currentStatus === 'processing'
                      ? 'bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-300'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="text-[10px] font-bold uppercase">Stage 2</div>
                <div className="text-xs sm:text-sm font-black mt-1">Processing in Lab</div>
              </div>

              <div
                className={`p-4 rounded-2xl border text-center transition-all ${
                  currentStatus === 'prepared' || currentStatus === 'delivered'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-300'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="text-[10px] font-bold uppercase">Stage 3</div>
                <div className="text-xs sm:text-sm font-black mt-1">Report Prepared</div>
              </div>
            </div>
          </div>

          {/* If Prepared: Name Verification Unlock */}
          {currentStatus === 'prepared' || currentStatus === 'delivered' ? (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <Lock className="w-5 h-5 text-emerald-600" />
                <span>Patient Name Verification</span>
              </div>
              <p className="text-xs text-slate-600">
                To access and download your certified diagnostic report, please confirm the registered patient's full name.
              </p>

              {!isVerified ? (
                <form onSubmit={handleVerify} className="max-w-md space-y-3">
                  <input
                    type="text"
                    value={verifyNameInput}
                    onChange={(e) => setVerifyNameInput(e.target.value)}
                    placeholder="Enter Patient Full Name..."
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {verifyError && (
                    <p className="text-xs text-rose-600 font-bold">{verifyError}</p>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    Verify & Unlock Report
                  </button>
                </form>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl flex items-center space-x-2 text-emerald-900 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Identity Verified for: {appointment?.patientName || reports[0]?.patientName}</span>
                  </div>

                  {reports.length > 0 && reports[0].reportFileUrl ? (
                    <div className="p-4 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-8 h-8 text-teal-600" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {reports[0].testName || 'Diagnostic Report File'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Uploaded on {new Date(reports[0].uploadedAt || Date.now()).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <a
                          href={reports[0].reportFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Report</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-white rounded-xl border border-emerald-200 text-xs text-slate-600">
                      Your diagnostic report is prepared and ready for collection at the clinic desk. A digital PDF copy will also sync here if uploaded by the lab.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start space-x-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Report Still In Preparation</strong>
                <span>
                  Your diagnostic specimen is being processed. As soon as the certified pathologist signs off, this screen will transition to 'Report Prepared' and allow you to view the file.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
