import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  Plus,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  Layout,
  BookOpen, // For Study Session
  Users, // For Meeting
} from 'lucide-react'
import {
  meetings as mockMeetings,
  formatTime,
  formatDate,
} from '../../../store/mockData'
import MeetingsViewToggle from '../../../components/MeetingsViewToggle'
import { meetingsApi } from '../../../lib/api/meetings'
import type { Meeting, MeetingPhase } from '../../../shared/dto/meeting'
import { MEETING_TYPE_LABELS } from '../../../shared/dto/meeting'
import { USE_API } from '../../../config/env'

const Meetings = () => {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    if (!USE_API) {
      // Mock data mapping
      setMeetings(mockMeetings.map(m => ({
        id: m.id,
        title: m.title,
        description: '',
        meeting_type: m.meetingType as any,
        phase: m.phase as MeetingPhase,
        start_time: m.startTime.toISOString(),
        end_time: m.endTime.toISOString(),
        created_at: m.startTime.toISOString(), // Fallback for mock
        location: m.location,
        project_id: undefined,
      })).sort((a, b) => new Date(b.created_at || b.start_time).getTime() - new Date(a.created_at || a.start_time).getTime()))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await meetingsApi.list()
      const sorted = response.meetings.sort((a, b) => {
        const timeA = new Date(a.created_at || a.start_time).getTime()
        const timeB = new Date(b.created_at || b.start_time).getTime()
        return timeB - timeA // Descending
      })
      setMeetings(sorted)
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
      setError('Không thể tải danh sách cuộc họp. Vui lòng thử lại.')
      // Fallback to mock on error? Or just show error
      // setMeetings([]) 
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Gần đây</h1>
          <p className="page-header__subtitle">Danh sách các phiên làm việc gần nhất</p>
        </div>
        <div className="page-header__actions meetings-header__actions">
          <div className="meetings-header__filters">
            {/* Removed Tabs as requested */}
            <MeetingsViewToggle />
          </div>
          <div className="meetings-header__actions-right">
            <button
              className="btn btn--secondary"
              onClick={fetchMeetings}
              disabled={isLoading}
              title="Làm mới"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-md)',
          background: 'var(--warning-subtle)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-lg)',
          fontSize: '13px',
          color: 'var(--warning)',
          border: '1px solid var(--warning)',
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && meetings.length === 0 && (
        <div className="form-loading" style={{ padding: 'var(--space-2xl)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && meetings.length === 0 && (
        <div className="empty-state">
          <FolderOpen className="empty-state__icon" />
          <h3 className="empty-state__title">Chưa có cuộc họp nào</h3>
          <p className="empty-state__description">
            Bấm nút <Plus size={14} style={{ display: 'inline', margin: '0 2px' }} /> trên thanh bên để thêm phiên mới
          </p>
        </div>
      )}

      {/* Meetings List */}
      {!isLoading && meetings.length > 0 && (
        <div className="meeting-list-container">
          <div className="meeting-list-header" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 200px 150px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <div>Tên phiên</div>
            <div>Loại</div>
            <div>Ngày tạo</div>
          </div>

          <div className="meeting-list-body">
            {meetings.map((meeting) => (
              <SimpleMeetingRow key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface MeetingRowProps {
  meeting: Meeting
}

const SimpleMeetingRow = ({ meeting }: MeetingRowProps) => {
  const createdDate = meeting.created_at ? new Date(meeting.created_at) : (meeting.start_time ? new Date(meeting.start_time) : new Date())

  // Determine icon based on meeting type
  const isStudy = meeting.meeting_type === 'study_session'
  const TypeIcon = isStudy ? BookOpen : Users

  return (
    <Link
      to={`/app/meetings/${meeting.id}/detail`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div className="meeting-row" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px 150px',
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center',
        transition: 'background 0.2s',
        cursor: 'pointer'
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {/* Title Column */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: isStudy ? 'rgba(79, 70, 229, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: isStudy ? '#4F46E5' : '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TypeIcon size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {meeting.title}
            </div>
            {/* Optional: Show status or duration as subtitle */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
              {meeting.phase === 'in' && <span style={{ color: 'var(--error)', fontWeight: 600 }}>● Live</span>}
              <span>{formatTime(new Date(meeting.start_time))} - {formatTime(new Date(meeting.end_time))}</span>
            </div>
          </div>
        </div>

        {/* Type Column */}
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TagIcon type={meeting.meeting_type} />
          <span>{MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}</span>
        </div>

        {/* Date Column */}
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} />
          {formatDate(createdDate)}
        </div>
      </div>
    </Link>
  )
}

const TagIcon = ({ type }: { type: string }) => {
  // Simple dot or small icon
  return <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', opacity: 0.5 }}></div>
}

export default Meetings
