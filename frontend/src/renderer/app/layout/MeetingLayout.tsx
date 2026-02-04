import { Outlet, useParams, NavLink } from 'react-router-dom'
import { Calendar, Users, MapPin, Clock, FileText, Mic, CheckSquare } from 'lucide-react'
import { meetings, formatTime, getMeetingTypeLabel } from '../../store/mockData'

const MeetingLayout = () => {
  const { meetingId } = useParams()
  const meeting = meetings.find(m => m.id === meetingId)

  if (!meeting) {
    return (
      <div className="empty-state">
        <Calendar size={48} className="empty-state__icon" />
        <div className="empty-state__title">Không tìm thấy cuộc họp</div>
      </div>
    )
  }

  const tabs = [
    { path: 'pre', label: 'Chuẩn bị', icon: <FileText size={16} /> },
    { path: 'in', label: 'Trong họp', icon: <Mic size={16} /> },
    { path: 'post', label: 'Sau họp', icon: <CheckSquare size={16} /> },
  ]

  return (
    <div className="meeting-layout">
      <div className="meeting-layout__header">
        <div className="meeting-layout__info">
          <div className="meeting-layout__type">{getMeetingTypeLabel(meeting.meetingType)}</div>
          <h1 className="meeting-layout__title">{meeting.title}</h1>
          <div className="meeting-layout__meta">
            <span className="meeting-layout__meta-item">
              <Calendar size={14} />
              {meeting.startTime.toLocaleDateString('vi-VN')}
            </span>
            <span className="meeting-layout__meta-item">
              <Clock size={14} />
              {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
            </span>
            <span className="meeting-layout__meta-item">
              <Users size={14} />
              {meeting.participants.length} người tham gia
            </span>
            <span className="meeting-layout__meta-item">
              <MapPin size={14} />
              {meeting.location}
            </span>
          </div>
        </div>
        <div>
          {meeting.phase === 'in' && (
            <span className="live-indicator">
              <span className="live-indicator__dot"></span>
              LIVE
            </span>
          )}
        </div>
      </div>

      <div className="meeting-layout__tabs">
        <div className="tabs">
          {tabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) => 
                `tabs__item ${isActive ? 'tabs__item--active' : ''}`
              }
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="meeting-layout__content">
        <Outlet />
      </div>
    </div>
  )
}

export default MeetingLayout
