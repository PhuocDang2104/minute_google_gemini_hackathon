import { Link } from 'react-router-dom'
import { Radio, Users, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { useLiveMeeting } from '../../services/meeting'

const LiveMeeting = () => {
  const { data: liveMeeting, isLoading } = useLiveMeeting()

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Live Meeting</h1>
            <p className="page-header__subtitle">Đang kiểm tra...</p>
          </div>
        </div>

        <div className="card">
          <div className="card__body" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        </div>
      </div>
    )
  }

  // No live meeting
  if (!liveMeeting) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Live Meeting</h1>
            <p className="page-header__subtitle">Không có cuộc họp nào đang diễn ra</p>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <div className="empty-state">
              <Radio size={48} className="empty-state__icon" />
              <div className="empty-state__title">Không có cuộc họp live</div>
              <div className="empty-state__description">
                Hiện tại không có cuộc họp nào đang diễn ra. Khi thời gian hiện tại nằm trong khoảng thời gian họp, cuộc họp sẽ xuất hiện ở đây.
              </div>
              <Link to="/app/meetings" className="btn btn--primary" style={{ marginTop: 'var(--space-lg)' }}>
                Xem danh sách cuộc họp
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Live meeting found
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Live Meeting</h1>
          <p className="page-header__subtitle">Cuộc họp đang diễn ra</p>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--error)', borderLeftWidth: '3px' }}>
        <div className="card__body" style={{ padding: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to={`/app/meetings/${liveMeeting.id}/detail`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <span className="live-indicator">
                    <span className="live-indicator__dot"></span>
                    LIVE
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Bắt đầu lúc {liveMeeting.start}
                  </span>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                  {liveMeeting.title}
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    <Users size={14} />
                    {liveMeeting.participants} người tham gia
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    <Clock size={14} />
                    Đang diễn ra
                  </span>
                </div>
              </div>
            </Link>
            {liveMeeting.teamsLink && (
              <a 
                href={liveMeeting.teamsLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn--primary" 
                style={{ fontSize: '15px', padding: 'var(--space-md) var(--space-xl)' }}
                onClick={(e) => e.stopPropagation()}
              >
                Tham gia ngay
                <ArrowRight size={18} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LiveMeeting
