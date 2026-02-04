import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  MapPin,
  FolderOpen,
  Tag,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import {
  meetings as mockMeetings,
  formatTime,
  formatDate,
  getMeetingTypeLabel,
  getPhaseLabel,
} from '../../../store/mockData'
import { Modal } from '../../../components/ui/Modal'
import { CreateMeetingForm } from '../../../features/meetings/components/CreateMeetingForm'
import MeetingsViewToggle from '../../../components/MeetingsViewToggle'
import { meetingsApi } from '../../../lib/api/meetings'
import type { Meeting, MeetingPhase } from '../../../shared/dto/meeting'
import { USE_API } from '../../../config/env'

const Meetings = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'week'>('all')

  const fetchMeetings = useCallback(async () => {
    if (!USE_API) {
      // Use mock data
      setMeetings(mockMeetings.map(m => ({
        id: m.id,
        title: m.title,
        description: '',
        meeting_type: m.meetingType as Meeting['meeting_type'],
        phase: m.phase as MeetingPhase,
        start_time: m.startTime.toISOString(),
        end_time: m.endTime.toISOString(),
        location: m.location,
        project_id: undefined,
      })))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await meetingsApi.list()
      setMeetings(response.meetings)
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
      setError('Không thể tải danh sách cuộc họp. Vui lòng thử lại.')
      // Fallback to mock data
      setMeetings(mockMeetings.map(m => ({
        id: m.id,
        title: m.title,
        description: '',
        meeting_type: m.meetingType as Meeting['meeting_type'],
        phase: m.phase as MeetingPhase,
        start_time: m.startTime.toISOString(),
        end_time: m.endTime.toISOString(),
        location: m.location,
        project_id: undefined,
      })))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false)
    fetchMeetings() // Refresh the list
  }

  // Filter meetings by tab
  const filteredMeetings = meetings.filter(m => {
    if (activeTab === 'all') return true
    
    const startTime = m.start_time ? new Date(m.start_time) : null
    if (!startTime) return activeTab === 'all'
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    if (activeTab === 'today') {
      return startTime >= today && startTime < tomorrow
    }
    if (activeTab === 'week') {
      return startTime >= today && startTime < weekEnd
    }
    return true
  })

  // Group meetings by phase
  const sortedMeetings = [...filteredMeetings].sort((a, b) => {
    const aTime = a.start_time ? new Date(a.start_time).getTime() : 0
    const bTime = b.start_time ? new Date(b.start_time).getTime() : 0
    return bTime - aTime
  })

  const meetingsByPhase = {
    in: sortedMeetings.filter(m => m.phase === 'in'),
    pre: sortedMeetings.filter(m => m.phase === 'pre'),
    post: sortedMeetings.filter(m => m.phase === 'post'),
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Cuộc họp</h1>
          <p className="page-header__subtitle">Quản lý tất cả cuộc họp của bạn</p>
        </div>
        <div className="page-header__actions meetings-header__actions">
          <div className="meetings-header__filters">
            <div className="tabs">
              <button 
                className={`tabs__item ${activeTab === 'all' ? 'tabs__item--active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                Tất cả
              </button>
              <button 
                className={`tabs__item ${activeTab === 'today' ? 'tabs__item--active' : ''}`}
                onClick={() => setActiveTab('today')}
              >
                Hôm nay
              </button>
              <button 
                className={`tabs__item ${activeTab === 'week' ? 'tabs__item--active' : ''}`}
                onClick={() => setActiveTab('week')}
              >
                Tuần này
              </button>
            </div>
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
            <button 
              className="btn btn--primary"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={16} />
              Tạo cuộc họp
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
            Bấm "Tạo cuộc họp" để thêm cuộc họp mới
          </p>
        </div>
      )}

      {/* Live Meetings */}
      {meetingsByPhase.in.length > 0 && (
        <div className="mb-6">
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span className="live-indicator">
              <span className="live-indicator__dot"></span>
              LIVE
            </span>
            Đang diễn ra
          </h2>
          <div className="meeting-list">
            {meetingsByPhase.in.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Meetings */}
      {meetingsByPhase.pre.length > 0 && (
        <div className="mb-6">
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
            Sắp diễn ra
          </h2>
          <div className="meeting-list">
            {meetingsByPhase.pre.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Meetings */}
      {meetingsByPhase.post.length > 0 && (
        <div className="mb-6">
          <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
            Đã hoàn thành
          </h2>
          <div className="meeting-list">
            {meetingsByPhase.post.map(meeting => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      )}

      {/* Create Meeting Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo cuộc họp mới"
        size="lg"
      >
        <CreateMeetingForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>
    </div>
  )
}

interface MeetingCardProps {
  meeting: Meeting
}

const MeetingCard = ({ meeting }: MeetingCardProps) => {
  const startTime = meeting.start_time ? new Date(meeting.start_time) : null

  return (
    <Link
      to={`/app/meetings/${meeting.id}/detail`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="meeting-item">
        <div className="meeting-item__time">
          <div className="meeting-item__time-value">
            {startTime ? formatTime(startTime) : '--:--'}
          </div>
          <div className="meeting-item__time-period">
            {startTime ? formatDate(startTime) : 'TBD'}
          </div>
        </div>
        <div className="meeting-item__divider"></div>
        <div className="meeting-item__content">
          <div className="meeting-item__title">{meeting.title}</div>
          <div className="meeting-item__meta">
            <span className="meeting-item__meta-item">
              <Tag size={12} />
              {getMeetingTypeLabel(meeting.meeting_type)}
            </span>
            {meeting.location && (
              <span className="meeting-item__meta-item">
                <MapPin size={12} />
                {meeting.location}
              </span>
            )}
          </div>
        </div>
        <span className={`meeting-item__phase meeting-item__phase--${meeting.phase}`}>
          {meeting.phase === 'in' ? 'Live' : getPhaseLabel(meeting.phase)}
        </span>
      </div>
    </Link>
  )
}

export default Meetings
