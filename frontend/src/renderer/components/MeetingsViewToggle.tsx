import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, List } from 'lucide-react'

const MeetingsViewToggle = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isCalendar = pathname.startsWith('/app/calendar')
  const isMeetings = pathname.startsWith('/app/meetings')

  return (
    <div className="meetings-mode-toggle" role="tablist" aria-label="Chế độ xem cuộc họp">
      <button
        type="button"
        className={`meetings-mode-toggle__btn ${isCalendar ? 'meetings-mode-toggle__btn--active' : ''}`}
        onClick={() => navigate('/app/calendar')}
      >
        <CalendarDays size={16} />
        Lịch
      </button>
      <button
        type="button"
        className={`meetings-mode-toggle__btn ${isMeetings ? 'meetings-mode-toggle__btn--active' : ''}`}
        onClick={() => navigate('/app/meetings')}
      >
        <List size={16} />
        Cuộc họp
      </button>
    </div>
  )
}

export default MeetingsViewToggle
