import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Users,
  Calendar,
  Sparkles,
  Plus,
  Check,
  Clock,
  User,
  ExternalLink,
  Loader2,
  Send,
  Save,
  Edit2,
  Upload,
  UserPlus,
  Search,
  X,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  Bell,
  Mail,
  CheckCircle,
  Circle,
  CheckSquare,
  Link as LinkIcon,
  Wand2,
} from 'lucide-react';
import type { MeetingWithParticipants } from '../../../../shared/dto/meeting';
import { agendaApi, type AgendaItem, type AgendaItemCreate } from '../../../../lib/api/agenda';
import { knowledgeApi, type KnowledgeDocument } from '../../../../lib/api/knowledge';
import meetingsApi from '../../../../lib/api/meetings';

interface PreMeetTabProps {
  meeting: MeetingWithParticipants;
  onRefresh: () => void;
}

// ============================================
// MAIN COMPONENT - Grid Layout like InMeet
// ============================================
export const PreMeetTab = ({ meeting, onRefresh }: PreMeetTabProps) => {
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);

  return (
    <div className="inmeet-tab"> {/* Reuse inmeet-tab styles for consistency */}
      {/* Send Email Action Bar */}
      <SendEmailActionBar
        meeting={meeting}
        onSendEmail={() => setShowSendEmailModal(true)}
      />

      <div className="inmeet-grid">
        {/* Main Column - Agenda & Preparation */}
        <div className="inmeet-column inmeet-column--main">
          <AgendaPanel meeting={meeting} />
          <RemindersPanel meetingId={meeting.id} />
        </div>

        {/* Side Column - Participants, Documents, AI */}
        <div className="inmeet-column inmeet-column--side">
          <PrepStatusPanel meeting={meeting} />
          <ParticipantsPanel meeting={meeting} onRefresh={onRefresh} />
          <DocumentsPanel meetingId={meeting.id} />
        </div>
      </div>

      {/* Send Email Modal */}
      {showSendEmailModal && (
        <SendPrepEmailModal
          meeting={meeting}
          onClose={() => setShowSendEmailModal(false)}
        />
      )}
    </div>
  );
};

// ============================================
// SEND EMAIL ACTION BAR
// ============================================
const SendEmailActionBar = ({
  meeting,
  onSendEmail
}: {
  meeting: MeetingWithParticipants;
  onSendEmail: () => void;
}) => {
  const participants = meeting.participants || [];
  const startTime = meeting.start_time ? new Date(meeting.start_time) : null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="send-email-bar">
      <div className="send-email-bar__info">
        <div className="send-email-bar__title">
          <Calendar size={16} />
          <span>{meeting.title}</span>
        </div>
        <div className="send-email-bar__meta">
          {startTime && (
            <span className="send-email-bar__time">
              <Clock size={12} />
              {formatDate(startTime)}
            </span>
          )}
          <span className="send-email-bar__participants">
            <Users size={12} />
            {participants.length} thành viên
          </span>
        </div>
      </div>
      <button
        className="btn btn--primary send-email-bar__btn"
        onClick={onSendEmail}
      >
        <Mail size={16} />
        Gửi thông báo cuộc họp
      </button>
    </div>
  );
};

// ============================================
// SEND PREPARATION EMAIL MODAL
// ============================================
const SendPrepEmailModal = ({
  meeting,
  onClose
}: {
  meeting: MeetingWithParticipants;
  onClose: () => void;
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [includeAgenda, setIncludeAgenda] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeReminders, setIncludeReminders] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const participants = meeting.participants || [];

  // Select all participants by default
  useEffect(() => {
    setSelectedParticipants(new Set(participants.map((p: any) => p.user_id || p.id)));
  }, []);

  const toggleParticipant = (id: string) => {
    const newSet = new Set(selectedParticipants);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedParticipants(newSet);
  };

  const selectAll = () => {
    setSelectedParticipants(new Set(participants.map((p: any) => p.user_id || p.id)));
  };

  const deselectAll = () => {
    setSelectedParticipants(new Set());
  };

  const handleSend = async () => {
    if (selectedParticipants.size === 0) return;

    setIsSending(true);
    setSendStatus('sending');

    try {
      const recipients = (participants || [])
        .filter((p: any) => selectedParticipants.has(p.user_id || p.id))
        .map((p: any) => ({
          email: p.email || p.user_id, // fallback user_id as email if mock
          name: p.display_name || p.user_id,
          role: p.role,
        }))
        .filter((r: any) => !!r.email);

      if (recipients.length === 0) {
        setSendStatus('error');
        setIsSending(false);
        return;
      }

      await meetingsApi.notify(meeting.id, {
        recipients,
        include_agenda: includeAgenda,
        include_documents: includeDocuments,
        include_notes: includeReminders,
        custom_message: customMessage,
      });

      setSendStatus('success');
      setIsSending(false);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('Send notify failed', err);
      setSendStatus('error');
      setIsSending(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'organizer': return 'Chủ trì';
      case 'chair': return 'Chủ tọa';
      case 'presenter': return 'Trình bày';
      default: return 'Thành viên';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal send-prep-email-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">
            <Mail size={20} />
            Gửi thông báo cuộc họp
          </h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal__body">
          {sendStatus === 'success' ? (
            <div className="send-email-success">
              <div className="send-email-success__icon">
                <CheckCircle size={48} />
              </div>
              <h3>Đã gửi thông báo thành công!</h3>
              <p>
                Đã gửi email xác nhận cuộc họp đến {selectedParticipants.size} thành viên.
                <br />
              </p>
            </div>
          ) : (
            <>
              {/* Meeting Info */}
              <div className="send-email-meeting-info">
                <h4>{meeting.title}</h4>
                <div className="send-email-meeting-info__details">
                  <span><Clock size={14} /> {formatDate(meeting.start_time)}</span>
                  {meeting.location && <span><LinkIcon size={14} /> {meeting.location}</span>}
                </div>
              </div>

              {/* Content Options */}
              <div className="send-email-options">
                <h4>Nội dung email</h4>
                <label className="send-email-checkbox">
                  <input
                    type="checkbox"
                    checked={includeAgenda}
                    onChange={e => setIncludeAgenda(e.target.checked)}
                  />
                  <Calendar size={14} />
                  <span>Bao gồm Chương trình họp (Agenda)</span>
                </label>
                <label className="send-email-checkbox">
                  <input
                    type="checkbox"
                    checked={includeDocuments}
                    onChange={e => setIncludeDocuments(e.target.checked)}
                  />
                  <FileText size={14} />
                  <span>Bao gồm Danh sách tài liệu</span>
                </label>
                <label className="send-email-checkbox">
                  <input
                    type="checkbox"
                    checked={includeReminders}
                    onChange={e => setIncludeReminders(e.target.checked)}
                  />
                  <Bell size={14} />
                  <span>Bao gồm Ghi nhớ cá nhân</span>
                </label>
              </div>

              {/* Custom Message */}
              <div className="send-email-message">
                <h4>Lời nhắn thêm (tùy chọn)</h4>
                <textarea
                  placeholder="Thêm lời nhắn cho các thành viên..."
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Recipients */}
              <div className="send-email-recipients">
                <div className="send-email-recipients__header">
                  <h4>Người nhận ({selectedParticipants.size}/{participants.length})</h4>
                  <div className="send-email-recipients__actions">
                    <button className="btn btn--ghost btn--sm" onClick={selectAll}>Chọn tất cả</button>
                    <button className="btn btn--ghost btn--sm" onClick={deselectAll}>Bỏ chọn</button>
                  </div>
                </div>
                <div className="send-email-recipients__list">
                  {participants.map((p: any) => (
                    <label
                      key={p.user_id || p.id}
                      className={`send-email-recipient ${selectedParticipants.has(p.user_id || p.id) ? 'send-email-recipient--selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.has(p.user_id || p.id)}
                        onChange={() => toggleParticipant(p.user_id || p.id)}
                      />
                      <div className="send-email-recipient__avatar">
                        {(p.display_name || p.email || '?').charAt(0)}
                      </div>
                      <div className="send-email-recipient__info">
                        <span className="send-email-recipient__name">{p.display_name || p.email}</span>
                        <span className="send-email-recipient__email">{p.email}</span>
                      </div>
                      <span className={`badge badge--${p.role === 'organizer' ? 'accent' : 'neutral'}`}>
                        {getRoleLabel(p.role)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Email Preview */}
              <div className="send-email-preview">
                <h4>Xem trước nội dung email</h4>
                <div className="send-email-preview__content">
                  <div className="send-email-preview__subject">
                    <strong>Chủ đề:</strong> [Minute] Thông báo cuộc họp: {meeting.title}
                  </div>
                  <div className="send-email-preview__body">
                    <p>Kính gửi [Tên thành viên],</p>
                    <p>Bạn được mời tham gia cuộc họp sau:</p>
                    <ul>
                      <li><strong>Cuộc họp:</strong> {meeting.title}</li>
                      <li><strong>Thời gian:</strong> {formatDate(meeting.start_time)}</li>
                      {meeting.location && <li><strong>Địa điểm:</strong> {meeting.location}</li>}
                      {meeting.teams_link && <li><strong>Link tham gia:</strong> [Link MS Teams]</li>}
                    </ul>
                    {includeAgenda && <p>📋 <em>Chương trình họp được đính kèm</em></p>}
                    {includeDocuments && <p>📄 <em>Tài liệu chuẩn bị được đính kèm</em></p>}
                    {customMessage && <p style={{ fontStyle: 'italic', color: 'var(--accent)' }}>"{customMessage}"</p>}
                    <p>Trân trọng,<br />Minute AI</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {sendStatus !== 'success' && (
          <div className="modal__footer">
            <button className="btn btn--secondary" onClick={onClose}>
              Hủy
            </button>
            <button
              className="btn btn--primary"
              onClick={handleSend}
              disabled={selectedParticipants.size === 0 || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Gửi đến {selectedParticipants.size} người
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// AGENDA PANEL - Glass style like InMeet
// ============================================
const AgendaPanel = ({ meeting }: { meeting: MeetingWithParticipants }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [editedItems, setEditedItems] = useState<AgendaItemCreate[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadAgenda();
  }, [meeting.id]);

  const loadAgenda = async () => {
    setIsLoading(true);
    try {
      const result = await agendaApi.listByMeeting(meeting.id);
      setAgendaItems(result.items);
      setEditedItems(result.items.map(item => ({
        order_index: item.order_index,
        title: item.title,
        duration_minutes: item.duration_minutes,
        presenter_name: item.presenter_name,
        description: item.description,
      })));
    } catch (err) {
      console.error('Failed to load agenda:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDurationMinutes = (): number => {
    if (meeting.start_time && meeting.end_time) {
      const start = new Date(meeting.start_time).getTime();
      const end = new Date(meeting.end_time).getTime();
      return Math.round((end - start) / 60000);
    }
    return 60;
  };

  const handleGenerateAgenda = async () => {
    setIsGenerating(true);
    try {
      const result = await agendaApi.generate({
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        meeting_type: meeting.meeting_type,
        meeting_description: meeting.description || undefined,
        duration_minutes: getDurationMinutes(),
        participants: meeting.participants?.map(p => p.display_name || p.email) || [],
      });
      setEditedItems(result.items);
      setHasChanges(true);
    } catch (err) {
      console.error('Failed to generate agenda:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAgenda = async () => {
    setIsSaving(true);
    try {
      const result = await agendaApi.save({
        meeting_id: meeting.id,
        items: editedItems,
      });
      setAgendaItems(result.items);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save agenda:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItem = (index: number, field: keyof AgendaItemCreate, value: string | number) => {
    const updated = [...editedItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditedItems(updated);
    setHasChanges(true);
  };

  const handleDeleteItem = (index: number) => {
    const updated = editedItems.filter((_, i) => i !== index);
    updated.forEach((item, i) => item.order_index = i);
    setEditedItems(updated);
    setHasChanges(true);
  };

  const handleAddItem = () => {
    setEditedItems([...editedItems, {
      order_index: editedItems.length,
      title: 'Mục mới',
      duration_minutes: 10,
      presenter_name: '',
    }]);
    setHasChanges(true);
  };

  const totalDuration = editedItems.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  const displayItems = hasChanges ? editedItems : agendaItems;

  return (
    <div className="transcript-panel transcript-panel--glass">
      <div className="transcript-header">
        <div className="transcript-title">
          <div className="transcript-title__icon">
            <Calendar size={16} />
          </div>
          <div className="transcript-title__text">
            <div className="transcript-title__label">Chương trình họp</div>
            <div className="transcript-title__sub">
              <Clock size={12} />
              {totalDuration}/{getDurationMinutes()} phút
            </div>
          </div>
        </div>
        <div className="transcript-header__right" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleGenerateAgenda}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Tạo
          </button>
          {hasChanges && (
            <button
              className="btn btn--primary btn--sm"
              onClick={handleSaveAgenda}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Lưu
            </button>
          )}
        </div>
      </div>

      <div className="transcript-content transcript-content--padded">
        {isLoading ? (
          <div className="empty-state empty-state--inline">
            <Loader2 size={20} className="animate-spin" />
            Đang tải...
          </div>
        ) : displayItems.length > 0 ? (
          <>
            {displayItems.map((item, index) => (
              <div key={item.id || index} className="detected-item detected-item--action">
                <div className="detected-item__number">{index + 1}</div>
                <div className="detected-item__content" style={{ flex: 1 }}>
                  <input
                    type="text"
                    className="detected-item__input"
                    value={hasChanges ? editedItems[index]?.title : (item as AgendaItem).title}
                    onChange={e => {
                      if (!hasChanges) {
                        setEditedItems(agendaItems.map(a => ({
                          order_index: a.order_index,
                          title: a.title,
                          duration_minutes: a.duration_minutes,
                          presenter_name: a.presenter_name,
                          description: a.description,
                        })));
                        setHasChanges(true);
                      }
                      handleUpdateItem(index, 'title', e.target.value);
                    }}
                  />
                  <div className="detected-item__meta">
                    <User size={12} />
                    <input
                      type="text"
                      className="detected-item__input detected-item__input--small"
                      placeholder="Người trình bày"
                      value={hasChanges ? editedItems[index]?.presenter_name || '' : (item as AgendaItem).presenter_name || ''}
                      onChange={e => {
                        if (!hasChanges) {
                          setEditedItems(agendaItems.map(a => ({
                            order_index: a.order_index,
                            title: a.title,
                            duration_minutes: a.duration_minutes,
                            presenter_name: a.presenter_name,
                            description: a.description,
                          })));
                          setHasChanges(true);
                        }
                        handleUpdateItem(index, 'presenter_name', e.target.value);
                      }}
                    />
                    <span className="dot"></span>
                    <Clock size={12} />
                    <input
                      type="number"
                      className="detected-item__input detected-item__input--number"
                      value={hasChanges ? editedItems[index]?.duration_minutes : (item as AgendaItem).duration_minutes}
                      onChange={e => {
                        if (!hasChanges) {
                          setEditedItems(agendaItems.map(a => ({
                            order_index: a.order_index,
                            title: a.title,
                            duration_minutes: a.duration_minutes,
                            presenter_name: a.presenter_name,
                            description: a.description,
                          })));
                          setHasChanges(true);
                        }
                        handleUpdateItem(index, 'duration_minutes', parseInt(e.target.value) || 0);
                      }}
                      min={1}
                      style={{ width: '50px' }}
                    />
                    <span>phút</span>
                  </div>
                </div>
                <button
                  className="btn btn--ghost btn--icon btn--sm"
                  onClick={() => handleDeleteItem(index)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button className="btn btn--ghost btn--sm" onClick={handleAddItem} style={{ marginTop: 'var(--space-sm)' }}>
              <Plus size={14} />
              Thêm mục
            </button>
          </>
        ) : (
          <div className="empty-state empty-state--inline">
            <Calendar size={20} />
            <span>Chưa có agenda. Nhấn "AI Tạo" để tự động tạo.</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// REMINDERS PANEL - Similar to AdrPanel
// ============================================
interface ReminderItem {
  id: string;
  type: 'question' | 'risk' | 'request';
  content: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

const RemindersPanel = ({ meetingId }: { meetingId: string }) => {
  const STORAGE_KEY = `minute_reminders_${meetingId}`;
  const [activeTab, setActiveTab] = useState<'question' | 'risk' | 'request'>('question');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const [reminders, setReminders] = useState<ReminderItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [reminders, STORAGE_KEY]);

  const questions = reminders.filter(r => r.type === 'question');
  const risks = reminders.filter(r => r.type === 'risk');
  const requests = reminders.filter(r => r.type === 'request');

  const handleAdd = () => {
    if (!newContent.trim()) return;
    setReminders([...reminders, {
      id: `rem-${Date.now()}`,
      type: activeTab,
      content: newContent.trim(),
      priority: newPriority,
      completed: false,
    }]);
    setNewContent('');
    setShowAddForm(false);
  };

  const handleToggle = (id: string) => {
    setReminders(reminders.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
  };

  const handleDelete = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'badge--error';
      case 'medium': return 'badge--warning';
      default: return 'badge--success';
    }
  };

  const currentItems = activeTab === 'question' ? questions : activeTab === 'risk' ? risks : requests;

  return (
    <div className="detected-panel detected-panel--elevated">
      <div className="detected-tabs detected-tabs--solid">
        <button
          className={`detected-tab ${activeTab === 'question' ? 'detected-tab--active' : ''}`}
          onClick={() => setActiveTab('question')}
        >
          <HelpCircle size={14} />
          Câu hỏi ({questions.length})
        </button>
        <button
          className={`detected-tab ${activeTab === 'risk' ? 'detected-tab--active' : ''}`}
          onClick={() => setActiveTab('risk')}
        >
          <AlertTriangle size={14} />
          Rủi ro ({risks.length})
        </button>
        <button
          className={`detected-tab ${activeTab === 'request' ? 'detected-tab--active' : ''}`}
          onClick={() => setActiveTab('request')}
        >
          <MessageSquare size={14} />
          Yêu cầu ({requests.length})
        </button>
      </div>

      <div className="detected-content detected-content--dense">
        {showAddForm ? (
          <div className="reminder-add-inline">
            <div className="reminder-add-inline__row">
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as any)}
                className="reminder-add-inline__select"
              >
                <option value="high">🔴 Cao</option>
                <option value="medium">🟡 TB</option>
                <option value="low">🟢 Thấp</option>
              </select>
              <input
                type="text"
                className="reminder-add-inline__input"
                placeholder={`Thêm ${activeTab === 'question' ? 'câu hỏi' : activeTab === 'risk' ? 'rủi ro' : 'yêu cầu'}...`}
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
            </div>
            <div className="reminder-add-inline__actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setShowAddForm(false)}>
                Hủy
              </button>
              <button className="btn btn--primary btn--sm" onClick={handleAdd} disabled={!newContent.trim()}>
                <Plus size={14} />
                Thêm
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowAddForm(true)}
            style={{ width: '100%', justifyContent: 'center', marginBottom: 'var(--space-sm)' }}
          >
            <Plus size={14} />
            Thêm {activeTab === 'question' ? 'câu hỏi' : activeTab === 'risk' ? 'rủi ro' : 'yêu cầu'}
          </button>
        )}

        {currentItems.length > 0 ? (
          currentItems.map(item => (
            <div
              key={item.id}
              className={`detected-item detected-item--${activeTab} ${item.completed ? 'detected-item--completed' : ''}`}
            >
              <button className="detected-item__check" onClick={() => handleToggle(item.id)}>
                {item.completed ? <CheckCircle size={16} /> : <Circle size={16} />}
              </button>
              <div className="detected-item__content">
                <div className="detected-item__text">{item.content}</div>
              </div>
              <span className={`badge ${getPriorityBadge(item.priority)}`} style={{ fontSize: '10px' }}>
                {item.priority === 'high' ? 'Cao' : item.priority === 'medium' ? 'TB' : 'Thấp'}
              </span>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={() => handleDelete(item.id)}>
                <X size={14} />
              </button>
            </div>
          ))
        ) : !showAddForm && (
          <div className="empty-state empty-state--inline">
            {activeTab === 'question' && 'Thêm câu hỏi cần hỏi trong họp'}
            {activeTab === 'risk' && 'Thêm rủi ro cần raise trong họp'}
            {activeTab === 'request' && 'Thêm yêu cầu cần đề xuất trong họp'}
          </div>
        )}

        {reminders.length > 0 && (
          <div className="reminder-hint">
            <Sparkles size={12} />
            AI sẽ nhắc bạn {reminders.filter(r => !r.completed).length} điểm trong cuộc họp
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// PREP STATUS PANEL - Quick overview
// ============================================
const PrepStatusPanel = ({ meeting }: { meeting: MeetingWithParticipants }) => {
  const participants = meeting.participants || [];
  const [agendaCount, setAgendaCount] = useState(0);
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const agenda = await agendaApi.listByMeeting(meeting.id);
        setAgendaCount(agenda.items.length);
      } catch { setAgendaCount(0); }
      try {
        const docs = await documentsApi.listByMeeting(meeting.id);
        setDocCount(docs.documents.length);
      } catch { setDocCount(0); }
    };
    loadCounts();
  }, [meeting.id]);

  const startTime = meeting.start_time ? new Date(meeting.start_time) : null;
  const timeUntil = startTime ? Math.round((startTime.getTime() - Date.now()) / 60000) : null;

  return (
    <div className="tool-panel">
      <div className="tool-panel__header">
        <div className="badge badge--ghost badge--pill">
          <CheckSquare size={14} />
          Trạng thái chuẩn bị
        </div>
        {timeUntil !== null && timeUntil > 0 && (
          <span className="meta-chip">
            <Clock size={12} />
            Còn {timeUntil < 60 ? `${timeUntil} phút` : `${Math.round(timeUntil / 60)} giờ`}
          </span>
        )}
      </div>
      <div className="prep-status-grid">
        <div className={`prep-status-item ${agendaCount > 0 ? 'prep-status-item--done' : ''}`}>
          <Calendar size={14} />
          <span>Agenda</span>
          <span className="prep-status-item__count">{agendaCount}</span>
        </div>
        <div className={`prep-status-item ${participants.length > 1 ? 'prep-status-item--done' : ''}`}>
          <Users size={14} />
          <span>Thành viên</span>
          <span className="prep-status-item__count">{participants.length}</span>
        </div>
        <div className={`prep-status-item ${docCount > 0 ? 'prep-status-item--done' : ''}`}>
          <FileText size={14} />
          <span>Tài liệu</span>
          <span className="prep-status-item__count">{docCount}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PARTICIPANTS PANEL - Compact list
// ============================================
const ParticipantsPanel = ({ meeting, onRefresh }: { meeting: MeetingWithParticipants; onRefresh: () => void }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const participants = meeting.participants || [];

  useEffect(() => {
    if (showAddModal) fetchUsers();
  }, [showAddModal, searchQuery]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { usersApi } = await import('../../../../lib/api/users');
      const response = await usersApi.list({ search: searchQuery || undefined });
      const existingIds = new Set(participants.map((p: any) => p.user_id));
      setAvailableUsers(response.users.filter((u: any) => !existingIds.has(u.id)));
    } catch {
      setAvailableUsers([
        { id: 'user-1', email: 'nguyenvana@lpbank.vn', display_name: 'Nguyễn Văn A', department_name: 'PMO' },
        { id: 'user-2', email: 'tranthib@lpbank.vn', display_name: 'Trần Thị B', department_name: 'IT' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddParticipants = async () => {
    if (selectedUsers.size === 0) return;
    setIsLoading(true);
    try {
      const { meetingsApi } = await import('../../../../lib/api/meetings');
      for (const userId of selectedUsers) {
        await meetingsApi.addParticipant(meeting.id, userId, 'attendee');
      }
      setShowAddModal(false);
      setSelectedUsers(new Set());
      onRefresh();
    } catch (err) {
      console.error('Failed to add participants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tool-panel">
      <div className="tool-panel__header">
        <div className="badge badge--ghost badge--pill">
          <Users size={14} />
          Thành viên ({participants.length})
        </div>
        <button className="btn btn--ghost btn--sm" onClick={() => setShowAddModal(true)}>
          <UserPlus size={14} />
        </button>
      </div>
      <div className="tool-panel__list">
        {participants.slice(0, 5).map((p: any) => (
          <div key={p.user_id || p.id} className="participant-compact">
            <div className="participant-compact__avatar">
              {(p.display_name || p.email || '?').charAt(0)}
            </div>
            <div className="participant-compact__info">
              <span className="participant-compact__name">{p.display_name || p.email}</span>
              <span className={`badge badge--${p.role === 'organizer' ? 'accent' : 'neutral'}`} style={{ fontSize: '9px' }}>
                {p.role === 'organizer' ? 'Chủ trì' : p.role === 'chair' ? 'Chủ tọa' : 'Thành viên'}
              </span>
            </div>
          </div>
        ))}
        {participants.length > 5 && (
          <div className="participant-compact participant-compact--more">
            +{participants.length - 5} người khác
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h2 className="modal__title"><UserPlus size={18} /> Thêm thành viên</h2>
              <button className="btn btn--ghost btn--icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body">
              <div style={{ position: 'relative', marginBottom: 'var(--space-md)' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tìm theo tên..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : availableUsers.map(user => (
                  <label key={user.id} className="participant-select-item" style={{ marginBottom: 'var(--space-xs)' }}>
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => {
                        const newSet = new Set(selectedUsers);
                        if (newSet.has(user.id)) newSet.delete(user.id);
                        else newSet.add(user.id);
                        setSelectedUsers(newSet);
                      }}
                    />
                    <div className="participant-compact__avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                      {user.display_name?.charAt(0) || '?'}
                    </div>
                    <span style={{ flex: 1, fontSize: '13px' }}>{user.display_name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowAddModal(false)}>Hủy</button>
              <button className="btn btn--primary" onClick={handleAddParticipants} disabled={selectedUsers.size === 0 || isLoading}>
                <UserPlus size={14} />
                Thêm ({selectedUsers.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// DOCUMENTS PANEL - With drag & drop upload
// ============================================
const DocumentsPanel = ({ meetingId }: { meetingId: string }) => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showSelect, setShowSelect] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadNotification, setUploadNotification] = useState<{ type: 'info' | 'warning' | 'success'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availableDocs, setAvailableDocs] = useState<KnowledgeDocument[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [meetingId]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const result = await knowledgeApi.list({ limit: 20, meeting_id: meetingId });
      setDocuments(result.documents);
      // preload available docs for selection
      const allDocs = await knowledgeApi.list({ limit: 50 });
      setAvailableDocs(allDocs.documents);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Validate file types
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/markdown'];
    const validFiles = files.filter(f => allowedTypes.includes(f.type) || f.name.endsWith('.md') || f.name.endsWith('.txt'));

    if (validFiles.length === 0) {
      setUploadNotification({
        type: 'warning',
        message: 'Định dạng file không được hỗ trợ. Vui lòng chọn PDF, DOCX, XLSX, TXT hoặc MD.'
      });
      setTimeout(() => setUploadNotification(null), 4000);
      return;
    }

    setUploadedFiles(validFiles);

    try {
      for (const file of validFiles) {
        await knowledgeApi.upload(
          {
            title: file.name.replace(/\.[^/.]+$/, ''),
            document_type: 'document',
            source: 'Meeting',
            file_type: (file.name.split('.').pop() || 'pdf'),
            file_size: file.size,
            meeting_id: meetingId,
          },
          file
        );
      }
      setUploadNotification({
        type: 'success',
        message: `Đã upload ${validFiles.length} tài liệu và vector hóa.`,
      });
      loadDocuments();
    } catch (err) {
      console.error('Upload knowledge doc failed:', err);
      setUploadNotification({
        type: 'warning',
        message: 'Upload thất bại, thử lại sau.',
      });
    } finally {
      setTimeout(() => {
        setUploadNotification(null);
        setUploadedFiles([]);
      }, 4000);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pdf')) return '📕';
    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return '📘';
    if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return '📗';
    if (fileName.endsWith('.txt') || fileName.endsWith('.md')) return '📄';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="tool-panel tool-panel--documents">
      <div className="tool-panel__header">
        <div className="badge badge--ghost badge--pill">
          <FileText size={14} />
          Tài liệu ({documents.length})
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            style={{ padding: '6px', width: '32px', height: '32px' }}
            onClick={() => setShowUpload(!showUpload)}
            title={showUpload ? 'Đóng' : 'Tải lên tài liệu'}
          >
            {showUpload ? <X size={14} /> : <Upload size={14} />}
          </button>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            style={{ padding: '6px', width: '32px', height: '32px' }}
            onClick={() => setShowSelect(true)}
            title="Chọn tài liệu có sẵn"
          >
            <Search size={14} />
          </button>
        </div>
      </div>

      {/* Upload Notification */}
      {uploadNotification && (
        <div className={`upload-notification upload-notification--${uploadNotification.type}`}>
          {uploadNotification.type === 'warning' && <AlertTriangle size={14} />}
          {uploadNotification.type === 'info' && <Bell size={14} />}
          {uploadNotification.type === 'success' && <CheckCircle size={14} />}
          <span>{uploadNotification.message}</span>
          <button onClick={() => setUploadNotification(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Drag & Drop Upload Area */}
      {showUpload && (
        <div
          className={`doc-dropzone ${isDragging ? 'doc-dropzone--active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div className="doc-dropzone__content">
            <div className="doc-dropzone__icon">
              <Upload size={24} />
            </div>
            <div className="doc-dropzone__text">
              <span className="doc-dropzone__primary">
                {isDragging ? 'Thả file vào đây' : 'Kéo thả file hoặc click để chọn'}
              </span>
              <span className="doc-dropzone__secondary">
                PDF, DOCX, XLSX, TXT, MD (tối đa 10MB)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Files Preview */}
      {uploadedFiles.length > 0 && (
        <div className="doc-upload-preview">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="doc-upload-preview__item">
              <span className="doc-upload-preview__icon">{getFileIcon(file.name)}</span>
              <div className="doc-upload-preview__info">
                <span className="doc-upload-preview__name">{file.name}</span>
                <span className="doc-upload-preview__size">{formatFileSize(file.size)}</span>
              </div>
              <div className="doc-upload-preview__status">
                <Loader2 size={12} className="animate-spin" />
                <span>Đang chờ...</span>
              </div>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                onClick={() => removeFile(index)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Documents List */}
      <div className="tool-panel__list">
        {isLoading ? (
          <div className="empty-state empty-state--inline">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : documents.length > 0 ? (
          documents.slice(0, 4).map(doc => (
            <div key={doc.id} className="tool-card tool-card--compact">
              <div className="tool-card__icon">
                <FileText size={14} />
              </div>
              <div className="tool-card__body">
                <div className="tool-card__title">{doc.title}</div>
                <div className="tool-card__detail">{doc.file_type.toUpperCase()}</div>
              </div>
              <a href={doc.file_url || '#'} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--icon btn--sm">
                <ExternalLink size={12} />
              </a>
            </div>
          ))
        ) : !showUpload && (
          <div
            className="empty-state empty-state--clickable"
            onClick={() => setShowUpload(true)}
          >
            <Upload size={20} />
            <span>Kéo thả hoặc click để tải lên</span>
          </div>
        )}
      </div>

      {/* Select existing document modal */}
      {showSelect && (
        <div className="upload-modal-overlay" onClick={() => setShowSelect(false)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal__header">
              <div className="upload-modal__header-content">
                <div className="upload-modal__icon">
                  <Search size={20} />
                </div>
                <div>
                  <h2 className="upload-modal__title">Chọn tài liệu có sẵn</h2>
                  <p className="upload-modal__subtitle">Thêm tài liệu đã có trong hệ thống vào cuộc họp</p>
                </div>
              </div>
              <button className="upload-modal__close" onClick={() => setShowSelect(false)} type="button">
                <X size={20} />
              </button>
            </div>
            <div className="upload-modal__body">
              <input
                type="text"
                className="upload-field__input"
                placeholder="Tìm kiếm theo tên..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableDocs
                  .filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((doc) => (
                    <div key={doc.id} className="tool-card tool-card--compact" style={{ justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <FileText size={14} />
                        <div>
                          <div className="tool-card__title">{doc.title}</div>
                          <div className="tool-card__detail" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {doc.source} • {doc.file_type?.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn--primary btn--sm"
                        disabled={isSelecting}
                        onClick={async () => {
                          setIsSelecting(true);
                          try {
                            await knowledgeApi.update(doc.id, { meeting_id: meetingId });
                            setShowSelect(false);
                            loadDocuments();
                          } catch (err) {
                            console.error('Attach doc failed', err);
                          } finally {
                            setIsSelecting(false);
                          }
                        }}
                      >
                        {isSelecting ? <Loader2 size={14} className="animate-spin" /> : 'Thêm vào cuộc họp'}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreMeetTab;
