/**
 * Home - Minimal overview focused on what's important
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckSquare,
  Clock,
  Lightbulb,
  Sparkles,
  User,
} from 'lucide-react'
import { actionItems, isOverdue } from '../../store/mockData'
import { useUpcomingMeetings, type NormalizedMeeting } from '../../services/meeting'
import aiApi from '../../lib/api/ai'

const formatShortDate = (date: Date) =>
  date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' })

const Dashboard = () => {
  const { data: upcomingMeetings, isLoading: loadingMeetings } = useUpcomingMeetings(3)
  const [askValue, setAskValue] = useState('')
  const [askResponse, setAskResponse] = useState<string | null>(null)
  const [askError, setAskError] = useState<string | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const myTasks = actionItems
    .filter(item => item.status !== 'completed' && item.status !== 'cancelled')
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 4)

  const suggestions = [
    {
      title: 'Tóm tắt cuộc họp gần nhất',
      description: 'Tổng hợp quyết định, action items và người phụ trách trong 60 giây.',
    },
    {
      title: 'Chuẩn bị agenda tuần này',
      description: 'Gợi ý agenda dựa trên lịch họp và tài liệu liên quan.',
    },
    {
      title: 'Rà soát action items quá hạn',
      description: 'Ưu tiên những việc có rủi ro trễ deadline.',
    },
  ]

  const kpis = [
    {
      value: '25 giờ/ngày',
      label: 'Thời gian tiết kiệm',
      note: '100 cuộc họp × 15 phút',
      variant: 'impact',
      trend: 'up',
      delta: '+18% tuần này',
    },
    {
      value: '<10 phút',
      label: 'Phát hành minutes',
      note: 'Chuẩn hóa sau họp',
      variant: 'speed',
      trend: 'down',
      delta: 'Giảm 35% thời gian',
    },
    {
      value: '2-3s',
      label: 'Độ trễ recap live',
      note: 'Realtime mượt mà',
      variant: 'latency',
      trend: 'down',
      delta: 'Giảm 12% độ trễ',
    },
    {
      value: '92%',
      label: 'Action đúng hạn',
      note: 'Owner + deadline rõ',
      variant: 'quality',
      trend: 'up',
      delta: '+9% tỉ lệ đúng hạn',
    },
  ]

  const handleAskSubmit = async () => {
    const trimmed = askValue.trim()
    if (!trimmed || askLoading) return

    setAskLoading(true)
    setAskResponse(null)
    setAskError(null)

    try {
      const response = await aiApi.homeAsk(trimmed)
      setAskResponse(response.message)
      setAskValue('')
    } catch {
      setAskError('Không thể kết nối Groq lúc này. Vui lòng thử lại sau.')
    } finally {
      setAskLoading(false)
    }
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1 className="home-title">Home</h1>
          <p className="home-subtitle">Tập trung vào những điểm quan trọng hôm nay.</p>
        </div>
      </div>

      <div className="home-ask-stack">
        <div className="home-ask">
          <Sparkles size={18} className="home-ask__icon" />
          <input
            className="home-ask__input"
            placeholder="Hôm nay bạn thế nào? Chia sẻ hay muốn hỏi gì không?"
            value={askValue}
            onChange={event => setAskValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAskSubmit()
              }
            }}
            aria-label="Hỏi nhanh Minute"
            disabled={askLoading}
          />
          <button
            className="home-ask__btn"
            type="button"
            onClick={handleAskSubmit}
            disabled={askLoading || !askValue.trim()}
          >
            {askLoading ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
        {(askResponse || askError) && (
          <div
            className={`home-ask-response ${askError ? 'home-ask-response--error' : ''}`}
            role="status"
            aria-live="polite"
          >
            <div className="home-ask-response__label">Minute AI</div>
            <div className="home-ask-response__text">{askError ?? askResponse}</div>
          </div>
        )}
      </div>

      <div className="home-kpi-grid">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`home-kpi-card home-kpi-card--${kpi.variant}`}>
            <div className={`home-kpi-trend home-kpi-trend--${kpi.trend}`}>
              {kpi.trend === 'down' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
              <span>{kpi.delta}</span>
            </div>
            <div className="home-kpi-card__label">{kpi.label}</div>
            <div className="home-kpi-card__value">{kpi.value}</div>
            <div className="home-kpi-card__note">{kpi.note}</div>
          </div>
        ))}
      </div>

      <div className="home-grid">
        <section className="home-panel">
          <div className="home-panel__header">
            <div className="home-panel__title">
              <Calendar size={18} />
              Upcoming meetings
            </div>
            <Link to="/app/meetings" className="home-panel__link">
              Xem tất cả
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="home-panel__body">
            {loadingMeetings ? (
              <div className="home-skeleton-list">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="home-skeleton-row" />
                ))}
              </div>
            ) : upcomingMeetings && upcomingMeetings.length > 0 ? (
              <ul className="home-meeting-list">
                {upcomingMeetings.map((meeting: NormalizedMeeting) => (
                  <li key={meeting.id} className="home-meeting-item">
                    <div className="home-meeting-time">
                      <div className="home-meeting-hour">{meeting.start}</div>
                      <div className="home-meeting-date">{formatShortDate(meeting.startTime)}</div>
                    </div>
                    <div className="home-meeting-content">
                      <div className="home-meeting-title">{meeting.title}</div>
                      <div className="home-meeting-meta">
                        <span>{meeting.location || 'Online'}</span>
                        <span>{meeting.participants} người</span>
                      </div>
                    </div>
                    <Link to={`/app/meetings/${meeting.id}/detail`} className="home-meeting-link">
                      Xem
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="home-empty">Không có cuộc họp sắp tới.</div>
            )}
          </div>
        </section>

        <section className="home-panel">
          <div className="home-panel__header">
            <div className="home-panel__title">
              <CheckSquare size={18} />
              My tasks
            </div>
            <Link to="/app/tasks" className="home-panel__link">
              Xem tất cả
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="home-panel__body">
            {myTasks.length === 0 ? (
              <div className="home-empty">Bạn chưa có nhiệm vụ nào.</div>
            ) : (
              <ul className="home-task-list">
                {myTasks.map(task => {
                  const overdue = isOverdue(task.deadline)
                  return (
                    <li key={task.id} className="home-task-item">
                      <div className={`home-task-dot ${overdue ? 'home-task-dot--overdue' : ''}`} />
                      <div className="home-task-content">
                        <div className="home-task-title">{task.description}</div>
                        <div className="home-task-meta">
                          <span>
                            <User size={12} /> {task.owner.displayName.split(' ').slice(-1)[0]}
                          </span>
                          <span className={overdue ? 'home-task-meta--overdue' : ''}>
                            <Clock size={12} /> {overdue ? 'Quá hạn' : formatShortDate(task.deadline)}
                          </span>
                        </div>
                      </div>
                      <span className={`home-pill ${overdue ? 'home-pill--danger' : ''}`}>
                        {overdue ? 'Quá hạn' : 'Đang xử lý'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="home-panel home-panel--suggested">
        <div className="home-panel__header">
          <div className="home-panel__title">
            <Lightbulb size={18} />
            AI Suggested for you
          </div>
        </div>
        <div className="home-panel__body">
          <div className="home-suggestions">
            {suggestions.map(item => (
              <div key={item.title} className="home-suggestion">
                <div className="home-suggestion__title">{item.title}</div>
                <p className="home-suggestion__desc">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
