/**
 * Calendar - Notion-style meeting schedule view
 * Supports Year, Month, Week views with day selection
 */
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Users,
  MapPin,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Grid3X3,
  LayoutGrid,
  CalendarDays,
  X,
  Video,
  ExternalLink,
} from 'lucide-react'
import {
  useCalendarMeetings,
  type NormalizedMeeting,
} from '../../services/meeting'
import MeetingsViewToggle from '../../components/MeetingsViewToggle'
import { useLocaleText } from '../../i18n/useLocaleText'

type ViewMode = 'year' | 'month' | 'week'

const WEEKDAYS = {
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

const WEEKDAYS_FULL = {
  vi: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

const MONTHS = {
  vi: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

// Helper functions
const isSameDay = (d1: Date, d2: Date) => 
  d1.getDate() === d2.getDate() && 
  d1.getMonth() === d2.getMonth() && 
  d1.getFullYear() === d2.getFullYear()

const isToday = (date: Date) => isSameDay(date, new Date())

const getWeekStart = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

const getWeekDays = (date: Date) => {
  const start = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

const Calendar = () => {
  const { language, lt } = useLocaleText()
  const weekdays = WEEKDAYS[language]
  const weekdaysFull = WEEKDAYS_FULL[language]
  const months = MONTHS[language]

  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  // Calculate date range based on view mode
  const { startDate, endDate, title } = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    switch (viewMode) {
      case 'year':
        return {
          startDate: new Date(year, 0, 1),
          endDate: new Date(year, 11, 31, 23, 59, 59),
          title: lt(`Năm ${year}`, `Year ${year}`),
        }
      case 'week':
        const weekStart = getWeekStart(currentDate)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        weekEnd.setHours(23, 59, 59)
        return {
          startDate: weekStart,
          endDate: weekEnd,
          title: `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}/${year}`,
        }
      default: // month
        return {
          startDate: new Date(year, month, 1),
          endDate: new Date(year, month + 1, 0, 23, 59, 59),
          title: `${months[month]} ${year}`,
        }
    }
  }, [currentDate, lt, months, viewMode])

  // Fetch meetings for the current view range
  const { 
    data: meetings, 
    isLoading, 
    error,
    refetch 
  } = useCalendarMeetings(startDate, endDate)

  // Get meetings for a specific date
  const getMeetingsForDate = (date: Date): NormalizedMeeting[] => {
    if (!meetings) return []
    return meetings.filter(m => isSameDay(m.startTime, date))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  }

  // Navigation functions
  const goToPrevious = () => {
    const d = new Date(currentDate)
    switch (viewMode) {
      case 'year':
        d.setFullYear(d.getFullYear() - 1)
        break
      case 'week':
        d.setDate(d.getDate() - 7)
        break
      default:
        d.setMonth(d.getMonth() - 1)
    }
    setCurrentDate(d)
  }

  const goToNext = () => {
    const d = new Date(currentDate)
    switch (viewMode) {
      case 'year':
        d.setFullYear(d.getFullYear() + 1)
        break
      case 'week':
        d.setDate(d.getDate() + 7)
        break
      default:
        d.setMonth(d.getMonth() + 1)
    }
    setCurrentDate(d)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Selected date meetings
  const selectedMeetings = selectedDate ? getMeetingsForDate(selectedDate) : []

  return (
    <div className="calendar-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{lt('Lịch họp', 'Calendar')}</h1>
          <p className="page-header__subtitle">{lt('Quản lý lịch họp của bạn', 'Manage your meeting schedule')}</p>
        </div>
        <div className="page-header__actions">
          <MeetingsViewToggle />
          <button className="btn btn--ghost" onClick={() => refetch()} title={lt('Làm mới', 'Refresh')}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link to="/app/meetings" className="btn btn--primary">
            <Plus size={16} />
            {lt('Tạo cuộc họp', 'Create meeting')}
          </Link>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="card mb-4" style={{ borderColor: 'var(--error)', borderLeftWidth: 3 }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--error)' }} />
            <span>{lt('Không thể tải dữ liệu. Đang sử dụng dữ liệu mẫu.', 'Unable to load data. Using mock data.')}</span>
          </div>
        </div>
      )}

      <div className="calendar-layout">
        {/* Calendar Main */}
        <div className="calendar-main">
          {/* Calendar Controls */}
          <div className="calendar-controls">
            <div className="calendar-controls__left">
              <button
                className="btn btn--ghost btn--icon btn--sm"
                style={{ padding: '6px', width: '32px', height: '32px' }}
                onClick={goToPrevious}
              >
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn--secondary btn--sm" onClick={goToToday}>
                {lt('Hôm nay', 'Today')}
              </button>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                style={{ padding: '6px', width: '32px', height: '32px' }}
                onClick={goToNext}
              >
                <ChevronRight size={16} />
              </button>
              <h2 className="calendar-title">{title}</h2>
              {isLoading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
            </div>
            <div className="calendar-controls__right">
              <div className="view-toggle">
                <button 
                  className={`view-toggle__btn ${viewMode === 'year' ? 'view-toggle__btn--active' : ''}`}
                  onClick={() => setViewMode('year')}
                  title={lt('Xem theo năm', 'Year view')}
                >
                  <Grid3X3 size={16} />
                  {lt('Năm', 'Year')}
                </button>
                <button 
                  className={`view-toggle__btn ${viewMode === 'month' ? 'view-toggle__btn--active' : ''}`}
                  onClick={() => setViewMode('month')}
                  title={lt('Xem theo tháng', 'Month view')}
                >
                  <LayoutGrid size={16} />
                  {lt('Tháng', 'Month')}
                </button>
                <button 
                  className={`view-toggle__btn ${viewMode === 'week' ? 'view-toggle__btn--active' : ''}`}
                  onClick={() => setViewMode('week')}
                  title={lt('Xem theo tuần', 'Week view')}
                >
                  <CalendarDays size={16} />
                  {lt('Tuần', 'Week')}
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Views */}
          <div className="calendar-view">
            {viewMode === 'year' && (
              <YearView 
                year={currentDate.getFullYear()}
                meetings={meetings || []}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                weekdays={weekdays}
                months={months}
              />
            )}
            {viewMode === 'month' && (
              <MonthView 
                currentDate={currentDate}
                meetings={meetings || []}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                weekdays={weekdays}
                moreLabel={lt('thêm', 'more')}
              />
            )}
            {viewMode === 'week' && (
              <WeekView 
                currentDate={currentDate}
                meetings={meetings || []}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                weekdays={weekdays}
                preLabel={lt('Chuẩn bị', 'Pre')}
                doneLabel={lt('Đã xong', 'Done')}
              />
            )}
          </div>
        </div>

        {/* Selected Day Panel */}
        <div className="calendar-sidebar">
          <div className="calendar-sidebar__header">
            {selectedDate ? (
              <>
                <div>
                  <div className="calendar-sidebar__date">
                    {selectedDate.getDate()}
                  </div>
                  <div className="calendar-sidebar__weekday">
                    {weekdaysFull[selectedDate.getDay()]}
                  </div>
                  <div className="calendar-sidebar__month">
                    {months[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                  </div>
                </div>
                {!isToday(selectedDate) && (
                  <button 
                    className="btn btn--ghost btn--icon" 
                    onClick={() => setSelectedDate(null)}
                    title={lt('Đóng', 'Close')}
                  >
                    <X size={18} />
                  </button>
                )}
              </>
            ) : (
              <div className="calendar-sidebar__placeholder">
                <CalendarIcon size={24} />
                <span>{lt('Chọn một ngày để xem lịch họp', 'Select a day to view meetings')}</span>
              </div>
            )}
          </div>

          {selectedDate && (
            <div className="calendar-sidebar__content">
              {selectedMeetings.length > 0 ? (
                <div className="meeting-list">
                  {selectedMeetings.map(meeting => (
                    <MeetingCard key={meeting.id} meeting={meeting} />
                  ))}
                </div>
              ) : (
                <div className="calendar-sidebar__empty">
                  <Clock size={32} />
                  <p>{lt('Không có cuộc họp nào', 'No meetings')}</p>
                  <Link to="/app/meetings" className="btn btn--secondary btn--sm">
                    <Plus size={14} />
                    {lt('Tạo cuộc họp', 'Create meeting')}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Year View Component
interface YearViewProps {
  year: number
  meetings: NormalizedMeeting[]
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  weekdays: string[]
  months: string[]
}

const YearView = ({ year, meetings, selectedDate, onSelectDate, weekdays, months }: YearViewProps) => {
  const getMeetingCount = (month: number, day: number) => {
    return meetings.filter(m => 
      m.startTime.getFullYear() === year &&
      m.startTime.getMonth() === month &&
      m.startTime.getDate() === day
    ).length
  }

  return (
    <div className="year-view">
      {months.map((monthName, monthIndex) => {
        const firstDay = new Date(year, monthIndex, 1)
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
        const startDay = firstDay.getDay()
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
        const emptyDays = Array.from({ length: startDay }, (_, i) => i)

        return (
          <div key={monthIndex} className="mini-month">
            <div className="mini-month__header">{monthName}</div>
            <div className="mini-month__weekdays">
              {weekdays.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="mini-month__days">
              {emptyDays.map(i => <div key={`e-${i}`} />)}
              {days.map(day => {
                const date = new Date(year, monthIndex, day)
                const meetingCount = getMeetingCount(monthIndex, day)
                const isSelected = selectedDate && isSameDay(date, selectedDate)
                const isTodayDate = isToday(date)

                return (
                  <div
                    key={day}
                    className={`mini-month__day ${isSelected ? 'mini-month__day--selected' : ''} ${isTodayDate ? 'mini-month__day--today' : ''} ${meetingCount > 0 ? 'mini-month__day--has-meeting' : ''}`}
                    onClick={() => onSelectDate(date)}
                  >
                    {day}
                    {meetingCount > 0 && <span className="mini-month__dot" />}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Month View Component
interface MonthViewProps {
  currentDate: Date
  meetings: NormalizedMeeting[]
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  weekdays: string[]
  moreLabel: string
}

const MonthView = ({ currentDate, meetings, selectedDate, onSelectDate, weekdays, moreLabel }: MonthViewProps) => {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = firstDay.getDay()
  
  // Include days from previous month to fill the first week
  const prevMonthDays = new Date(year, month, 0).getDate()
  const prevDays = Array.from({ length: startDay }, (_, i) => ({
    day: prevMonthDays - startDay + i + 1,
    date: new Date(year, month - 1, prevMonthDays - startDay + i + 1),
    isCurrentMonth: false,
  }))
  
  const currentDays = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    date: new Date(year, month, i + 1),
    isCurrentMonth: true,
  }))
  
  // Include days from next month to fill the last week
  const totalDays = prevDays.length + currentDays.length
  const nextDaysCount = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7)
  const nextDays = Array.from({ length: nextDaysCount }, (_, i) => ({
    day: i + 1,
    date: new Date(year, month + 1, i + 1),
    isCurrentMonth: false,
  }))
  
  const allDays = [...prevDays, ...currentDays, ...nextDays]

  const getMeetingsForDay = (date: Date) => 
    meetings.filter(m => isSameDay(m.startTime, date))

  return (
    <div className="month-view">
      <div className="month-view__header">
        {weekdays.map(d => <div key={d} className="month-view__weekday">{d}</div>)}
      </div>
      <div className="month-view__grid">
        {allDays.map((item, index) => {
          const dayMeetings = getMeetingsForDay(item.date)
          const isSelected = selectedDate && isSameDay(item.date, selectedDate)
          const isTodayDate = isToday(item.date)

          return (
            <div
              key={index}
              className={`month-view__day ${!item.isCurrentMonth ? 'month-view__day--other' : ''} ${isSelected ? 'month-view__day--selected' : ''} ${isTodayDate ? 'month-view__day--today' : ''}`}
              onClick={() => onSelectDate(item.date)}
            >
              <div className="month-view__day-number">{item.day}</div>
              <div className="month-view__day-meetings">
                {dayMeetings.slice(0, 3).map(m => (
                  <div 
                    key={m.id} 
                    className={`month-view__meeting month-view__meeting--${m.status === 'in_progress' ? 'live' : m.phase}`}
                    title={m.title}
                  >
                    <span className="month-view__meeting-time">{m.start}</span>
                    <span className="month-view__meeting-title">{m.title}</span>
                  </div>
                ))}
                {dayMeetings.length > 3 && (
                  <div className="month-view__more">+{dayMeetings.length - 3} {moreLabel}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Week View Component
interface WeekViewProps {
  currentDate: Date
  meetings: NormalizedMeeting[]
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  weekdays: string[]
  preLabel: string
  doneLabel: string
}

const WeekView = ({ currentDate, meetings, selectedDate, onSelectDate, weekdays, preLabel, doneLabel }: WeekViewProps) => {
  const weekDays = getWeekDays(currentDate)
  const hours = Array.from({ length: 12 }, (_, i) => i + 7) // 7am to 6pm

  const getMeetingsForDay = (date: Date) => 
    meetings.filter(m => isSameDay(m.startTime, date))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  return (
    <div className="week-view">
      {/* Header */}
      <div className="week-view__header">
        <div className="week-view__time-gutter" />
        {weekDays.map((date, i) => {
          const isSelected = selectedDate && isSameDay(date, selectedDate)
          const isTodayDate = isToday(date)
          
          return (
            <div 
              key={i} 
              className={`week-view__day-header ${isSelected ? 'week-view__day-header--selected' : ''} ${isTodayDate ? 'week-view__day-header--today' : ''}`}
              onClick={() => onSelectDate(date)}
            >
              <div className="week-view__weekday">{weekdays[date.getDay()]}</div>
              <div className="week-view__day-number">{date.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="week-view__body">
        <div className="week-view__time-column">
          {hours.map(hour => (
            <div key={hour} className="week-view__time-slot">
              {hour}:00
            </div>
          ))}
        </div>
        
        {weekDays.map((date, dayIndex) => {
          const dayMeetings = getMeetingsForDay(date)
          
          return (
            <div key={dayIndex} className="week-view__day-column">
              {hours.map(hour => (
                <div key={hour} className="week-view__cell" />
              ))}
              {/* Render meetings */}
              {dayMeetings.map(meeting => {
                const startHour = meeting.startTime.getHours()
                const startMin = meeting.startTime.getMinutes()
                const endHour = meeting.endTime.getHours()
                const endMin = meeting.endTime.getMinutes()
                
                const top = ((startHour - 7) * 60 + startMin) * (60 / 60) // 60px per hour
                const height = ((endHour - startHour) * 60 + (endMin - startMin)) * (60 / 60)
                
                if (startHour < 7 || startHour > 18) return null
                
                return (
                  <Link
                    key={meeting.id}
                    to={`/app/meetings/${meeting.id}/pre`}
                    className={`week-view__event week-view__event--${meeting.status === 'in_progress' ? 'live' : meeting.phase}`}
                    style={{ top: `${top}px`, height: `${Math.max(height, 32)}px` }}
                  >
                    <div className="week-view__event-time">{meeting.start}</div>
                    <div className="week-view__event-title">{truncateTitle(meeting.title, 38)}</div>
                    <div className="week-view__event-badge">
                      {meeting.status === 'in_progress' ? 'LIVE' : meeting.phase === 'pre' ? preLabel : doneLabel}
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Meeting Card Component
const MeetingCard = ({ meeting }: { meeting: NormalizedMeeting }) => {
  const { lt } = useLocaleText()
  const statusColors = {
    in_progress: 'var(--error)',
    upcoming: 'var(--info)',
    completed: 'var(--success)',
    cancelled: 'var(--text-muted)',
  }

  return (
    <Link 
      to={`/app/meetings/${meeting.id}/pre`}
      className="meeting-card"
      style={{ borderLeftColor: meeting.status === 'in_progress' ? 'var(--error)' : meeting.phase === 'pre' ? 'var(--info)' : 'var(--text-muted)' }}
    >
      <div className="meeting-card__header">
        <span className="meeting-card__time">
          <Clock size={12} />
          {meeting.start} - {meeting.end}
        </span>
        <span className={`meeting-item__phase meeting-item__phase--${meeting.status === 'in_progress' ? 'live' : meeting.phase}`}>
          {meeting.status === 'in_progress' ? 'Live' : meeting.phase === 'pre' ? lt('Chuẩn bị', 'Pre') : lt('Đã xong', 'Done')}
        </span>
      </div>
      <h4 className="meeting-card__title">{truncateTitle(meeting.title, 52)}</h4>
      <div className="meeting-card__meta">
        <span>
          <Users size={12} />
          {meeting.participants} {lt('người', 'people')}
        </span>
        {meeting.location && (
          <span>
            <MapPin size={12} />
            {meeting.location}
          </span>
        )}
      </div>
      {meeting.teamsLink && (
        <div className="meeting-card__action">
          <Video size={14} />
          {lt('Tham gia Teams', 'Join Teams')}
          <ExternalLink size={12} />
        </div>
      )}
    </Link>
  )
}

function truncateTitle(text: string, max: number) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

export default Calendar
