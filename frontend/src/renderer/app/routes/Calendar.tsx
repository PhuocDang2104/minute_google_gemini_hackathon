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

type ViewMode = 'year' | 'month' | 'week'

// Days of week in Vietnamese
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WEEKDAYS_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 
                'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']

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
          title: `Năm ${year}`,
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
          title: `${MONTHS[month]} ${year}`,
        }
    }
  }, [currentDate, viewMode])

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
          <h1 className="page-header__title">Lịch họp</h1>
          <p className="page-header__subtitle">Quản lý lịch họp của bạn</p>
        </div>
        <div className="page-header__actions">
          <MeetingsViewToggle />
          <button className="btn btn--ghost" onClick={() => refetch()} title="Làm mới">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link to="/app/meetings" className="btn btn--primary">
            <Plus size={16} />
            Tạo cuộc họp
          </Link>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="card mb-4" style={{ borderColor: 'var(--error)', borderLeftWidth: 3 }}>
          <div className="card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--error)' }} />
            <span>Không thể tải dữ liệu. Đang sử dụng dữ liệu mẫu.</span>
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
                Hôm nay
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
                  title="Xem theo năm"
                >
                  <Grid3X3 size={16} />
                  Năm
                </button>
                <button 
                  className={`view-toggle__btn ${viewMode === 'month' ? 'view-toggle__btn--active' : ''}`}
                  onClick={() => setViewMode('month')}
                  title="Xem theo tháng"
                >
                  <LayoutGrid size={16} />
                  Tháng
                </button>
                <button 
                  className={`view-toggle__btn ${viewMode === 'week' ? 'view-toggle__btn--active' : ''}`}
                  onClick={() => setViewMode('week')}
                  title="Xem theo tuần"
                >
                  <CalendarDays size={16} />
                  Tuần
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
              />
            )}
            {viewMode === 'month' && (
              <MonthView 
                currentDate={currentDate}
                meetings={meetings || []}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}
            {viewMode === 'week' && (
              <WeekView 
                currentDate={currentDate}
                meetings={meetings || []}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
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
                    {WEEKDAYS_FULL[selectedDate.getDay()]}
                  </div>
                  <div className="calendar-sidebar__month">
                    {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                  </div>
                </div>
                {!isToday(selectedDate) && (
                  <button 
                    className="btn btn--ghost btn--icon" 
                    onClick={() => setSelectedDate(null)}
                    title="Đóng"
                  >
                    <X size={18} />
                  </button>
                )}
              </>
            ) : (
              <div className="calendar-sidebar__placeholder">
                <CalendarIcon size={24} />
                <span>Chọn một ngày để xem lịch họp</span>
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
                  <p>Không có cuộc họp nào</p>
                  <Link to="/app/meetings" className="btn btn--secondary btn--sm">
                    <Plus size={14} />
                    Tạo cuộc họp
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
}

const YearView = ({ year, meetings, selectedDate, onSelectDate }: YearViewProps) => {
  const getMeetingCount = (month: number, day: number) => {
    return meetings.filter(m => 
      m.startTime.getFullYear() === year &&
      m.startTime.getMonth() === month &&
      m.startTime.getDate() === day
    ).length
  }

  return (
    <div className="year-view">
      {MONTHS.map((monthName, monthIndex) => {
        const firstDay = new Date(year, monthIndex, 1)
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
        const startDay = firstDay.getDay()
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
        const emptyDays = Array.from({ length: startDay }, (_, i) => i)

        return (
          <div key={monthIndex} className="mini-month">
            <div className="mini-month__header">{monthName}</div>
            <div className="mini-month__weekdays">
              {WEEKDAYS.map(d => <div key={d}>{d}</div>)}
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
}

const MonthView = ({ currentDate, meetings, selectedDate, onSelectDate }: MonthViewProps) => {
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
        {WEEKDAYS.map(d => <div key={d} className="month-view__weekday">{d}</div>)}
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
                  <div className="month-view__more">+{dayMeetings.length - 3} more</div>
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
}

const WeekView = ({ currentDate, meetings, selectedDate, onSelectDate }: WeekViewProps) => {
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
              <div className="week-view__weekday">{WEEKDAYS[date.getDay()]}</div>
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
                      {meeting.status === 'in_progress' ? 'LIVE' : meeting.phase === 'pre' ? 'Chuẩn bị' : 'Đã xong'}
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
          {meeting.status === 'in_progress' ? 'Live' : meeting.phase === 'pre' ? 'Chuẩn bị' : 'Đã xong'}
        </span>
      </div>
      <h4 className="meeting-card__title">{truncateTitle(meeting.title, 52)}</h4>
      <div className="meeting-card__meta">
        <span>
          <Users size={12} />
          {meeting.participants} người
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
          Tham gia Teams
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
