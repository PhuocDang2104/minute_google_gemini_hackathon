import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Mic,
  CheckSquare,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Check,
  X,
  Edit3,
  Play,
} from 'lucide-react'
import { useChatContext } from '../../../contexts/ChatContext'
import {
  meetings,
  transcriptChunks,
  actionItems,
  decisions,
  risks,
  formatDuration,
  getInitials,
} from '../../../store/mockData'

const MeetingIn = () => {
  const { meetingId } = useParams()
  const meeting = meetings.find(m => m.id === meetingId)
  const transcript = transcriptChunks.filter(t => t.meetingId === meetingId)
  const actions = actionItems.filter(a => a.meetingId === meetingId).slice(0, 3)
  const meetingDecisions = decisions.filter(d => d.meetingId === meetingId)
  const meetingRisks = risks.filter(r => r.meetingId === meetingId)
  const { setOverride, clearOverride } = useChatContext()

  useEffect(() => {
    if (!meeting) return
    setOverride({
      scope: 'meeting',
      meetingId: meeting.id,
      phase: 'in',
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
    <div className="panel-split">
      {/* Main Content - Transcript */}
      <div className="panel-split__main">
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">
              <Mic size={18} className="card__title-icon" />
              Live Transcript
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span className="live-indicator">
                <span className="live-indicator__dot"></span>
                Recording
              </span>
            </div>
          </div>
          <div className="card__body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <div className="transcript">
              {transcript.map(chunk => (
                <div key={chunk.id} className="transcript-chunk">
                  <div className="transcript-chunk__avatar">
                    {getInitials(chunk.speaker.displayName)}
                  </div>
                  <div className="transcript-chunk__content">
                    <div className="transcript-chunk__header">
                      <span className="transcript-chunk__speaker">{chunk.speaker.displayName}</span>
                      <span className="transcript-chunk__time">{formatDuration(chunk.startTime)}</span>
                    </div>
                    <div className="transcript-chunk__text">{chunk.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detected Items */}
        <div className="grid grid--3 mt-6">
          {/* Actions Detected */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">
                <CheckSquare size={16} className="card__title-icon" />
                Actions
              </h3>
              <span className="badge badge--info">{actions.length}</span>
            </div>
            <div className="card__body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {actions.map(action => (
                  <div key={action.id} style={{ 
                    padding: 'var(--space-md)', 
                    background: 'var(--bg-surface)', 
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--accent)'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: 'var(--space-xs)' }}>
                      {action.description.slice(0, 60)}...
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <User size={12} />
                      {action.owner.displayName.split(' ').slice(-1)[0]}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
                      <button className="btn btn--primary btn--sm" style={{ padding: '4px 8px', fontSize: '11px' }}>
                        <Check size={12} />
                      </button>
                      <button className="btn btn--secondary btn--sm" style={{ padding: '4px 8px', fontSize: '11px' }}>
                        <Edit3 size={12} />
                      </button>
                      <button className="btn btn--ghost btn--sm" style={{ padding: '4px 8px', fontSize: '11px' }}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Decisions Detected */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">
                <FileText size={16} className="card__title-icon" />
                Decisions
              </h3>
              <span className="badge badge--success">{meetingDecisions.length}</span>
            </div>
            <div className="card__body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {meetingDecisions.map(decision => (
                  <div key={decision.id} style={{ 
                    padding: 'var(--space-md)', 
                    background: 'var(--bg-surface)', 
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--success)'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: 'var(--space-xs)' }}>
                      {decision.description.slice(0, 60)}...
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <Check size={12} className="text-success" />
                      {decision.confirmedBy.displayName.split(' ').slice(-1)[0]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risks Detected */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">
                <AlertTriangle size={16} className="card__title-icon" />
                Risks
              </h3>
              <span className="badge badge--warning">{meetingRisks.length}</span>
            </div>
            <div className="card__body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {meetingRisks.map(risk => (
                  <div key={risk.id} style={{ 
                    padding: 'var(--space-md)', 
                    background: 'var(--bg-surface)', 
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: `3px solid var(--${risk.severity === 'high' ? 'error' : 'warning'})`
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: 'var(--space-xs)' }}>
                      {risk.description.slice(0, 60)}...
                    </div>
                    <span className={`badge badge--${risk.severity === 'high' ? 'error' : 'warning'}`}>
                      {risk.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="panel-split__side">
        {/* Live Recap */}
        <div className="card mt-4">
          <div className="card__header">
            <h3 className="card__title">
              <Play size={16} className="card__title-icon" />
              Live Recap
            </h3>
          </div>
          <div className="card__body">
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Tiến độ:</strong> Core Banking đạt 68%. Module Account Management hoàn thành UAT.
              <br /><br />
              <strong>Vấn đề:</strong> Cần thêm 2 developers cho batch processing optimization.
              <br /><br />
              <strong>Đề xuất:</strong> Điều chuyển resources từ Mobile team.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeetingIn
