import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface DateScrollerProps {
  selectedDate: string // 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void
  minDate?: string // default: today or allow past
  className?: string
}

export const DateScroller: React.FC<DateScrollerProps> = ({
  selectedDate,
  onSelectDate,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Track the month currently viewed in the scroller
  const [viewedYear, setViewedYear] = useState<number>(() => {
    try {
      const parts = selectedDate.split('-')
      if (parts.length === 3) return parseInt(parts[0], 10)
    } catch {}
    return new Date().getFullYear()
  })

  const [viewedMonth, setViewedMonth] = useState<number>(() => {
    try {
      const parts = selectedDate.split('-')
      if (parts.length === 3) return parseInt(parts[1], 10) - 1
    } catch {}
    return new Date().getMonth()
  })

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Days in currently viewed month
  const daysInMonth = new Date(viewedYear, viewedMonth + 1, 0).getDate()

  // Generate list of dates in viewed month
  const dates = []
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewedYear, viewedMonth, day)
    const dateStr = `${viewedYear}-${String(viewedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = dayNames[d.getDay()]
    dates.push({ day, dayOfWeek, dateStr, isToday: dateStr === todayStr })
  }

  // Handle month prev/next
  const handlePrevMonth = () => {
    if (viewedMonth === 0) {
      setViewedMonth(11)
      setViewedYear((y) => y - 1)
    } else {
      setViewedMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewedMonth === 11) {
      setViewedMonth(0)
      setViewedYear((y) => y + 1)
    } else {
      setViewedMonth((m) => m + 1)
    }
  }

  const handleJumpToToday = () => {
    setViewedYear(today.getFullYear())
    setViewedMonth(today.getMonth())
    onSelectDate(todayStr)
  }

  // Auto-scroll active card into view
  useEffect(() => {
    if (!containerRef.current) return
    const activeEl = containerRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [selectedDate, viewedYear, viewedMonth])

  return (
    <div className={`p-2.5 sm:p-3 liquid-glass-subtle rounded-2xl border border-white/60 dark:border-white/10 ${className}`}>
      {/* Month & Year Navigation Header with Today button */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
            {monthNames[viewedMonth]} {viewedYear}
          </span>
          <button
            type="button"
            onClick={handleJumpToToday}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer border ${
              selectedDate === todayStr
                ? 'bg-brand-600 text-white border-brand-500 shadow-2xs'
                : 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/20 hover:bg-brand-500/20'
            }`}
          >
            Today
          </button>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/10 transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/10 transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Compact Date Cards Scroller */}
      <div
        ref={containerRef}
        className="flex space-x-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
      >
        {dates.map((item) => {
          const isSelected = item.dateStr === selectedDate
          return (
            <button
              key={item.dateStr}
              type="button"
              data-selected={isSelected ? 'true' : 'false'}
              onClick={() => onSelectDate(item.dateStr)}
              className={`flex-shrink-0 w-[48px] sm:w-[52px] h-[58px] sm:h-[62px] rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-gradient-to-b from-brand-600 to-sky-600 text-white border-brand-500 shadow-sm shadow-brand-500/30 scale-[1.02]'
                  : 'liquid-glass-subtle text-slate-700 dark:text-slate-300 border-white/50 dark:border-white/10 hover:border-brand-400 hover:bg-white/80 dark:hover:bg-slate-800/80'
              }`}
            >
              <span
                className={`text-[9.5px] sm:text-[10px] font-bold leading-none ${
                  isSelected ? 'text-white/90' : 'text-slate-400 dark:text-slate-400'
                }`}
              >
                {item.dayOfWeek}
              </span>
              <span
                className={`text-sm sm:text-base font-black mt-1 leading-none ${
                  isSelected ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                {item.day}
              </span>
              {item.isToday && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-brand-500 mt-1"></span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
