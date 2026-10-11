import React from 'react'
import {
  Clock,
  Activity,
  TrendingDown,
  Users,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react'

export const AverageTime: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Queue Analytics & Insights</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          How Dactor Predicts Live Wait Times
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Our intelligent telemetry engine calculates queue speeds in real-time, helping patients skip hours in crowded clinic waiting rooms.
        </p>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="text-3xl font-black text-slate-900">8 – 10 min</div>
          <h3 className="text-base font-bold text-slate-900">Average Consultation</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Specialist doctors spend adequate time with each patient for thorough diagnosis, vitals check, and prescription counseling.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <TrendingDown className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="text-3xl font-black text-slate-900">85% Reduction</div>
          <h3 className="text-base font-bold text-slate-900">Waiting Room Crowds</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            By monitoring their 10-digit code remotely, patients only arrive when their token number is 2-3 spots away.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="text-3xl font-black text-slate-900">Dynamic Buffer</div>
          <h3 className="text-base font-bold text-slate-900">Automatic Break Protection</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Scheduled clinic lunch and break hours (1:00 PM – 2:00 PM) are automatically calculated into wait time estimations.
          </p>
        </div>
      </div>

      {/* OPD Peak Hours Heatmap / Schedule */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm space-y-6">
        <h2 className="text-xl font-black text-slate-900">Clinic OPD Peak Hours Breakdown</h2>
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Morning Shift (08:30 AM – 10:30 AM)</h4>
                <p className="text-xs text-slate-500">Fastest turnaround time. Blood samples collected immediately.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
              Low Wait (~10 mins)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Mid-Day Rush (10:30 AM – 01:00 PM)</h4>
                <p className="text-xs text-slate-500">Peak OPD volume. Track token number closely.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              Medium Wait (~25 mins)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-slate-400" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Official Break Period (01:00 PM – 02:00 PM)</h4>
                <p className="text-xs text-slate-500">Sanitization and lunch pause. OPD resumes promptly at 02:00 PM.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
              Break Hour
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-teal-500" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Evening Consultations (04:00 PM – 07:30 PM)</h4>
                <p className="text-xs text-slate-500">Specialist consultations and follow-up reviews.</p>
              </div>
            </div>
            <span className="text-xs font-bold text-teal-800 bg-teal-100 px-3 py-1 rounded-full">
              Moderate Wait (~15 mins)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
