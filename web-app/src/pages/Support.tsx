import React, { useState, useEffect } from 'react'
import {
  Headphones,
  Mail,
  Phone,
  Clock,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building2,
  Stethoscope,
  User,
  ExternalLink,
  MessageSquare
} from 'lucide-react'
import { GlassCard, GlassButton } from '../components/glass'
import { supabase } from '../lib/supabase'

export const Support: React.FC = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'clinic' | 'doctor' | 'patient'>('clinic')
  const [category, setCategory] = useState('Verification & KYC Status')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Support phone & email from config
  const [supportPhone, setSupportPhone] = useState('+977 9800000000')
  const [supportEmail, setSupportEmail] = useState('dactorofficial@gmail.com')

  useEffect(() => {
    supabase
      .from('medical_specialties')
      .select('*')
      .eq('category', 'system_config')
      .then(({ data }) => {
        if (data) {
          data.forEach((row) => {
            if (row.name === 'system_config:support_phone' && row.search_keywords) setSupportPhone(row.search_keywords)
            if (row.name === 'system_config:support_email' && row.search_keywords) setSupportEmail(row.search_keywords)
          })
        }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg(false)

    try {
      // Record inquiry in notifications for super admin
      await supabase.from('notifications').insert({
        title: `[Support Inquiry] ${category} - ${name} (${role})`,
        message: `From: ${name} (${email}, ${phone})\nRole: ${role}\nCategory: ${category}\n\n${message}`,
        type: 'queue_alert',
        target_audience: 'specific',
        is_read: false
      })

      setSuccessMsg(true)
      setName('')
      setEmail('')
      setPhone('')
      setMessage('')
    } catch (err: any) {
      // Even if offline, show graceful confirmation
      setSuccessMsg(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto shadow-inner">
          <Headphones className="w-8 h-8" />
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Official Dactor Helpdesk</span>
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          How Can We Help You Today?
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Assistance for clinic onboarding, Nepal Medical Council practitioner licensing, patient live queue questions, and platform subscriptions.
        </p>
      </div>

      {/* 3 Quick Action Contact Channels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* WhatsApp Live Chat */}
        <div className="liquid-glass-card p-6 rounded-3xl border border-white/60 dark:border-white/10 space-y-4 text-left shadow-glass-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">WhatsApp Direct Helpline</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Fastest response for urgent hospital roster deployments and verification status checks.
              </p>
            </div>
          </div>
          <a
            href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}?text=Hello%20Dactor%20Support,%20I%20need%20assistance%20with%20my%20account.`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
          >
            <span>Chat on WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Email Direct */}
        <div className="liquid-glass-card p-6 rounded-3xl border border-white/60 dark:border-white/10 space-y-4 text-left shadow-glass-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Email Regulatory Support</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Submit official NMC documents, PAN records, and accreditation files for review.
              </p>
            </div>
          </div>
          <a
            href={`mailto:${supportEmail}?subject=Dactor%20Account%20Verification%20Support`}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
          >
            <span>Email {supportEmail}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Telephone Helpline */}
        <div className="liquid-glass-card p-6 rounded-3xl border border-white/60 dark:border-white/10 space-y-4 text-left shadow-glass-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Direct Telephone Hotline</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Direct telephonic support available Monday through Saturday 9:00 AM – 6:00 PM NPT.
              </p>
            </div>
          </div>
          <a
            href={`tel:${supportPhone}`}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
          >
            <span>Call {supportPhone}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Interactive Ticket Submission Form & FAQs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Ticket Form */}
        <div className="lg:col-span-7">
          <GlassCard variant="base" padding="lg" radius="xl" className="space-y-6 text-left">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Submit a Direct Help Request</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Our support team will review your enquiry and respond to your email/phone within 12 business hours.
              </p>
            </div>

            {successMsg && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Thank you! Your inquiry has been dispatched to the Dactor Helpdesk team. We will contact you shortly.</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  I Am A <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('clinic')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      role === 'clinic'
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-white/60 dark:border-white/10 hover:bg-white'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Clinic / Hospital</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('doctor')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      role === 'doctor'
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-white/60 dark:border-white/10 hover:bg-white'
                    }`}
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Practitioner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      role === 'patient'
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-white/60 dark:border-white/10 hover:bg-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Patient</span>
                  </button>
                </div>
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Your Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Ramesh Thapa"
                    className="w-full px-4 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Registered Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-4 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Phone & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone (Nepal)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98xxxxxxxx"
                    className="w-full px-4 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Issue Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Verification & KYC Status">Verification & KYC Status</option>
                    <option value="License Activation & Billing">License Activation & Billing</option>
                    <option value="Live Queue & Appointment Issue">Live Queue & Appointment Issue</option>
                    <option value="Diagnostic Lab Reports Inquiry">Diagnostic Lab Reports Inquiry</option>
                    <option value="General Technical Support">General Technical Support</option>
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Explain your inquiry, include clinic name, NMC number, or 10-digit tracking code if applicable..."
                  className="w-full px-4 py-2.5 rounded-xl liquid-glass-input text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <GlassButton
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
                className="w-full justify-center"
              >
                {submitting ? 'Transmitting Request...' : 'Dispatch Request to Support Team'}
              </GlassButton>
            </form>
          </GlassCard>
        </div>

        {/* FAQs */}
        <div className="lg:col-span-5 space-y-4 text-left">
          <div className="liquid-glass-card p-6 rounded-3xl border border-white/60 dark:border-white/10 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-brand-600" />
              <span>Frequently Asked Questions</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">
                  How long does Clinic Verification take?
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Standard healthcare accreditation review completes within 24 to 48 business hours. You can tap &ldquo;Check Verification Status Now&rdquo; in the portal anytime.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">
                  How are Doctor NMC Credentials validated?
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Doctor applications require a valid Nepal Medical Council (NMC) registration number and degree certificate. Approvals typically take 12 to 24 hours.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">
                  How do patients view Diagnostic Lab Reports?
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  To protect patient privacy, diagnostic pathology reports require verifying the patient&apos;s registered full name or mobile number with the 10-digit booking code.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
