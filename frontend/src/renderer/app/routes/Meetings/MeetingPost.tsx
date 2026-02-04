import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText,
  CheckSquare,
  AlertTriangle,
  Download,
  Share2,
  Clock,
  User,
  Check,
  ExternalLink,
  Play,
  Mail,
} from 'lucide-react'
import {
  meetings,
  actionItems,
  decisions,
  risks,
} from '../../../store/mockData'
import { useChatContext } from '../../../contexts/ChatContext'

const MeetingPost = () => {
  const { meetingId } = useParams()
  const meeting = meetings.find(m => m.id === meetingId)
  const actions = actionItems.filter(a => a.meetingId === meetingId)
  const meetingDecisions = decisions.filter(d => d.meetingId === meetingId)
  const meetingRisks = risks.filter(r => r.meetingId === meetingId)
  const { setOverride, clearOverride } = useChatContext()

  useEffect(() => {
    if (!meeting) return
    setOverride({
      scope: 'meeting',
      meetingId: meeting.id,
      phase: 'post',
      title: meeting.title,
    })
  }, [meeting?.id, meeting?.title, setOverride])

  useEffect(() => {
    return () => clearOverride()
  }, [clearOverride])

  if (!meeting) {
    return <div>Meeting not found</div>
  }

  return (
    <div>
      {/* Executive Summary */}
      <div className="card mb-6">
        <div className="card__header">
          <h3 className="card__title">
            <FileText size={18} className="card__title-icon" />
            Executive Summary
          </h3>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn--secondary btn--sm">
              <Download size={14} />
              Export
            </button>
            <button className="btn btn--primary btn--sm">
              <Share2 size={14} />
              Gửi biên bản
            </button>
          </div>
        </div>
        <div className="card__body">
          <div style={{ 
            padding: 'var(--space-lg)', 
            background: 'var(--bg-surface)', 
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--accent)'
          }}>
            <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Dự án Core Banking đạt <strong style={{ color: 'var(--text-primary)' }}>68% tiến độ</strong>. 
              Module Account Management đã hoàn thành UAT. Đã phê duyệt việc điều chuyển 
              <strong style={{ color: 'var(--text-primary)' }}> 2 senior developers</strong> từ team Mobile 
              để hỗ trợ optimization trong <strong style={{ color: 'var(--text-primary)' }}>4 tuần</strong>. 
              Có <strong style={{ color: 'var(--text-primary)' }}>{actions.length} action items</strong> được giao 
              với deadline trong tuần. <strong style={{ color: 'var(--text-primary)' }}>{meetingRisks.length} risks</strong> được 
              identify và có mitigation plan.
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid--4 mt-6">
            <div style={{ textAlign: 'center', padding: 'var(--space-base)' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>{actions.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Action Items</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-base)' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>{meetingDecisions.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quyết định</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-base)' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warning)' }}>{meetingRisks.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rủi ro</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-base)' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--info)' }}>60</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phút</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid--2">
        {/* Action Items */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <CheckSquare size={18} className="card__title-icon" />
              Action Items
            </h3>
          </div>
          <div className="card__body">
            <div className="action-list">
              {actions.map(action => (
                <div key={action.id} className="action-item">
                  <div className={`action-item__checkbox ${action.status === 'completed' ? 'action-item__checkbox--checked' : ''}`}>
                    {action.status === 'completed' && <Check size={12} />}
                  </div>
                  <div className="action-item__content">
                    <div className="action-item__title">{action.description}</div>
                    <div className="action-item__meta">
                      <span className={`action-item__priority action-item__priority--${action.priority}`}>
                        {action.priority}
                      </span>
                      <span className="action-item__meta-item">
                        <User size={12} />
                        {action.owner.displayName.split(' ').slice(-1)[0]}
                      </span>
                      <span className="action-item__meta-item">
                        <Clock size={12} />
                        {action.deadline.toLocaleDateString('vi-VN')}
                      </span>
                      {action.externalLink && (
                        <a href={action.externalLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decisions */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <FileText size={18} className="card__title-icon" />
              Quyết định
            </h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {meetingDecisions.map((decision, index) => (
                <div key={decision.id} style={{ 
                  padding: 'var(--space-base)', 
                  background: 'var(--bg-surface)', 
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid var(--success)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                    <span className="badge badge--success">QĐ-{String(index + 1).padStart(3, '0')}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <Check size={12} style={{ marginRight: '4px' }} />
                      {decision.confirmedBy.displayName}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: 'var(--space-sm)' }}>
                    {decision.description}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {decision.rationale}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Risks */}
      <div className="card mt-6">
        <div className="card__header">
          <h3 className="card__title">
            <AlertTriangle size={18} className="card__title-icon" />
            Rủi ro đã nhận diện
          </h3>
        </div>
        <div className="card__body">
          <div className="grid grid--3">
            {meetingRisks.map((risk, index) => (
              <div key={risk.id} style={{ 
                padding: 'var(--space-base)', 
                background: 'var(--bg-surface)', 
                borderRadius: 'var(--radius-md)',
                borderTop: `3px solid var(--${risk.severity === 'high' ? 'error' : 'warning'})`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>R-{String(index + 1).padStart(3, '0')}</span>
                  <span className={`badge badge--${risk.severity === 'high' ? 'error' : 'warning'}`}>
                    {risk.severity}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: 'var(--space-sm)' }}>
                  {risk.description}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                  <strong>Mitigation:</strong> {risk.mitigation}
                </div>
                <span className={`badge badge--${risk.status === 'mitigated' ? 'success' : 'neutral'}`}>
                  {risk.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution Log */}
      <div className="card mt-6">
        <div className="card__header">
          <h3 className="card__title">
            <Mail size={18} className="card__title-icon" />
            Phân phối biên bản
          </h3>
          <button className="btn btn--primary btn--sm">
            <Share2 size={14} />
            Gửi lại
          </button>
        </div>
        <div className="card__body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {meeting.participants.slice(0, 4).map(participant => (
              <div key={participant.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: 'var(--accent)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--bg-base)'
                  }}>
                    {participant.displayName.split(' ').slice(-1)[0][0]}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{participant.displayName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{participant.email}</div>
                  </div>
                </div>
                <span className="badge badge--success">
                  <Check size={10} />
                  Delivered
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Highlight Clips */}
      <div className="card mt-6">
        <div className="card__header">
          <h3 className="card__title">
            <Play size={18} className="card__title-icon" />
            Highlight Clips
          </h3>
        </div>
        <div className="card__body">
          <div className="grid grid--2">
            <div style={{ 
              padding: 'var(--space-base)', 
              background: 'var(--bg-surface)', 
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'var(--accent-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Play size={16} className="text-accent" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Quyết định điều chuyển resources</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>10:01 - 12:00</div>
                </div>
              </div>
              <span className="badge badge--info">Decision</span>
            </div>
            <div style={{ 
              padding: 'var(--space-base)', 
              background: 'var(--bg-surface)', 
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'var(--accent-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Play size={16} className="text-accent" />
                </div>
  <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Phân công Action Items</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>13:21 - 16:00</div>
                </div>
              </div>
              <span className="badge badge--success">Action Summary</span>
            </div>
          </div>
        </div>
      </div>
  </div>
)
}

export default MeetingPost
