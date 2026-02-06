import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  RefreshCw,
  Video,
  Edit2,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { meetingsApi } from '../../../lib/api/meetings';
import { sessionsApi } from '../../../lib/api/sessions';
import type { MeetingWithParticipants, MeetingUpdate } from '../../../shared/dto/meeting';
import { MEETING_TYPE_LABELS } from '../../../shared/dto/meeting';
import { USE_API } from '../../../config/env';
import { useChatContext } from '../../../contexts/ChatContext';

// Tab Components
import PostMeetTabFireflies from './tabs/PostMeetTabFireflies';

export const MeetingDetail = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<MeetingWithParticipants | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [audioIngestToken, setAudioIngestToken] = useState('');
  const [sessionInitError, setSessionInitError] = useState<string | null>(null);
  const [isInitSessionLoading, setIsInitSessionLoading] = useState(false);
  const { setOverride, clearOverride } = useChatContext();

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    teams_link: '',
    location: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await meetingsApi.get(meetingId);
      setMeeting(data);
      setStreamSessionId(data.id);
    } catch (err) {
      console.error('Failed to fetch meeting:', err);
      setError('Không thể tải thông tin cuộc họp');
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  useEffect(() => {
    if (!meeting) return;
    setOverride({
      scope: 'meeting',
      meetingId: meeting.id,
      phase: 'post',
      title: meeting.title,
    });
  }, [meeting?.id, meeting?.title, setOverride]);

  useEffect(() => {
    return () => clearOverride();
  }, [clearOverride]);

  const openMeetingDock = (override?: { sessionId?: string; token?: string }) => {
    if (!meeting) return;
    const params = new URLSearchParams();
    const session = override?.sessionId || streamSessionId || meeting.id;
    if (session) params.set('session', session);
    params.set('platform', 'gmeet');
    const token = override?.token || audioIngestToken;
    if (token) params.set('token', token);
    const qs = params.toString();
    navigate(`/app/meetings/${meeting.id}/dock${qs ? `?${qs}` : ''}`);
  };

  const handleInitRealtimeSession = async () => {
    if (!USE_API) {
      setShowJoinModal(false);
      return;
    }
    const desiredSessionId = streamSessionId || meeting?.id;
    if (!desiredSessionId) return;

    setIsInitSessionLoading(true);
    setSessionInitError(null);
    try {
      const res = await sessionsApi.create({
        session_id: desiredSessionId,
        language_code: 'vi-VN',
        target_sample_rate_hz: 16000,
        audio_encoding: 'PCM_S16LE',
        channels: 1,
        realtime: true,
        interim_results: true,
        enable_word_time_offsets: true,
      });
      const sessionId = res.session_id;
      setStreamSessionId(sessionId);

      let token = audioIngestToken.trim();
      if (!token) {
        const tokenRes = await sessionsApi.registerSource(sessionId);
        token = tokenRes.audio_ingest_token;
      }
      setAudioIngestToken(token);
      setShowJoinModal(false);
      openMeetingDock({ sessionId, token });
    } catch (err) {
      console.error('Failed to init realtime session:', err);
      setSessionInitError('Không thể khởi tạo realtime session. Kiểm tra backend /api/v1/sessions.');
    } finally {
      setIsInitSessionLoading(false);
    }
  };

  // Open edit modal with current meeting data
  const handleOpenEdit = () => {
    if (!meeting) return;

    // Format datetime for input fields
    const formatDateTimeLocal = (dateStr: string | undefined) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toISOString().slice(0, 16);
    };

    setEditForm({
      title: meeting.title || '',
      description: meeting.description || '',
      start_time: formatDateTimeLocal(meeting.start_time),
      end_time: formatDateTimeLocal(meeting.end_time),
      teams_link: meeting.teams_link || '',
      location: meeting.location || '',
    });
    setShowEditModal(true);
  };

  // Save edited meeting
  const handleSaveEdit = async () => {
    if (!meetingId) return;

    setIsSaving(true);
    try {
      const updateData: MeetingUpdate = {
        title: editForm.title || undefined,
        description: editForm.description || undefined,
        start_time: editForm.start_time ? new Date(editForm.start_time).toISOString() : undefined,
        end_time: editForm.end_time ? new Date(editForm.end_time).toISOString() : undefined,
        teams_link: editForm.teams_link || undefined,
        location: editForm.location || undefined,
      };

      await meetingsApi.update(meetingId, updateData);
      setShowEditModal(false);
      fetchMeeting();
    } catch (err) {
      console.error('Failed to update meeting:', err);
      alert('Không thể cập nhật cuộc họp');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete meeting
  const handleDelete = async () => {
    if (!meetingId) return;

    setIsDeleting(true);
    try {
      await meetingsApi.delete(meetingId);
      navigate('/app/meetings');
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      alert('Không thể xóa cuộc họp');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="meeting-detail-loading">
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
        <p>Đang tải thông tin cuộc họp...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="empty-state">
        <AlertCircle className="empty-state__icon" />
        <h3 className="empty-state__title">{error || 'Không tìm thấy cuộc họp'}</h3>
        <button className="btn btn--secondary" onClick={() => navigate('/app/meetings')}>
          Quay lại
        </button>
      </div>
    );
  }

  const startTime = meeting.start_time ? new Date(meeting.start_time) : null;
  const sessionIdValue = streamSessionId || meeting.id;

  return (
    <div className="meeting-detail-v2">
      {/* Compact Header */}
      <header className="meeting-detail-v2__header">
        <div className="meeting-detail-v2__header-left">
          <button
            className="btn btn--ghost btn--icon btn--sm"
            style={{ padding: '6px', width: '32px', height: '32px' }}
            onClick={() => navigate('/app/meetings')}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="meeting-detail-v2__header-info">
            <div className="meeting-detail-v2__header-badges">
              <span className="badge badge--neutral">{MEETING_TYPE_LABELS[meeting.meeting_type as keyof typeof MEETING_TYPE_LABELS] || meeting.meeting_type}</span>
            </div>
            <h1 className="meeting-detail-v2__title">{meeting.title}</h1>
          </div>
        </div>

        <div className="meeting-detail-v2__header-right">
          <div className="meeting-detail-v2__meta-compact">
            {startTime && (
              <>
                <span className="meta-item">
                  <Calendar size={14} />
                  {startTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="meta-item">
                  <Clock size={14} />
                  {startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>

          <div className="meeting-detail-v2__actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Utility */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                style={{ padding: '6px', width: '32px', height: '32px' }}
                onClick={fetchMeeting}
                title="Làm mới"
              >
                <RefreshCw size={16} />
              </button>
              {meeting.phase === 'pre' && (
                <button
                  className="btn btn--ghost btn--icon btn--sm"
                  style={{ padding: '6px', width: '32px', height: '32px' }}
                  onClick={handleOpenEdit}
                  title="Chỉnh sửa"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {meeting.phase === 'pre' && (
                <button
                  className="btn btn--ghost btn--icon btn--sm"
                  style={{ padding: '6px', width: '32px', height: '32px', color: 'var(--error)' }}
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Xóa cuộc họp"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Navigation / join */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn--secondary"
                onClick={() => setShowJoinModal(true)}
                title="Mở dock để capture audio"
              >
                <Video size={16} />
                Live Record
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Summary only */}
      <main className="meeting-detail-v2__content">
        <PostMeetTabFireflies
          meeting={meeting}
          onRefresh={fetchMeeting}
        />
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal__header">
              <h2 className="modal__title">
                <Edit2 size={20} />
                Chỉnh sửa cuộc họp
              </h2>
              <button className="btn btn--ghost btn--icon" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal__body">
              <div className="form-group">
                <label className="form-label">Tiêu đề cuộc họp</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Nhập tiêu đề..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea
                  className="form-input"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Nhập mô tả..."
                  rows={3}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-base)' }}>
                <div className="form-group">
                  <label className="form-label">
                    <Clock size={14} style={{ marginRight: '6px' }} />
                    Thời gian bắt đầu
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={editForm.start_time}
                    onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Clock size={14} style={{ marginRight: '6px' }} />
                    Thời gian kết thúc
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={editForm.end_time}
                    onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Video size={14} style={{ marginRight: '6px' }} />
                  Link MS Teams
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={editForm.teams_link}
                  onChange={e => setEditForm({ ...editForm, teams_link: e.target.value })}
                  placeholder="https://teams.microsoft.com/..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <MapPin size={14} style={{ marginRight: '6px' }} />
                  Địa điểm
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.location}
                  onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="Phòng họp hoặc Online"
                />
              </div>
            </div>

            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowEditModal(false)}>
                Hủy
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSaveEdit}
                disabled={isSaving || !editForm.title}
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: 'var(--error)' }}>
                <Trash2 size={20} />
                Xóa cuộc họp
              </h2>
              <button className="btn btn--ghost btn--icon" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal__body">
              <p style={{ marginBottom: 'var(--space-base)' }}>
                Bạn có chắc chắn muốn xóa cuộc họp này?
              </p>
              <div className="card" style={{ background: 'var(--bg-elevated)', padding: 'var(--space-base)' }}>
                <strong>{meeting.title}</strong>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {startTime?.toLocaleString('vi-VN')}
                </div>
              </div>
              <p style={{ marginTop: 'var(--space-base)', fontSize: '13px', color: 'var(--text-muted)' }}>
                Hành động này không thể hoàn tác.
              </p>
            </div>

            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowDeleteConfirm(false)}>
                Hủy
              </button>
              <button
                className="btn btn--error"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{ background: 'var(--error)' }}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Xóa cuộc họp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join meeting modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal join-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal__header join-modal__header">
              <div className="join-modal__header-left">
                <div className="join-modal__icon">
                  <Video size={18} />
                </div>
                <div>
                  <h2 className="modal__title">Minute Capture</h2>
                  <p className="join-modal__subtitle">Select any other Google tab to capture.</p>
                </div>
              </div>
              <button className="btn btn--ghost btn--icon" onClick={() => setShowJoinModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body join-modal__body">
              <div className="join-modal__notice">
                Select any other Google tab to capture.
              </div>
              <div className="form-group">
                <label className="form-label">Stream ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={sessionIdValue}
                  onChange={e => setStreamSessionId(e.target.value)}
                  placeholder="session_id (default: meeting.id)"
                />
                <p className="form-hint">Stream ID is used for realtime transcript.</p>
              </div>
              {sessionInitError && (
                <div className="join-modal__alert join-modal__alert--error">
                  {sessionInitError}
                </div>
              )}
            </div>
            <div className="modal__footer join-modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowJoinModal(false)}>
                Close
              </button>
              <button
                className="btn btn--primary"
                onClick={handleInitRealtimeSession}
                disabled={!sessionIdValue}
              >
                {isInitSessionLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingDetail;
