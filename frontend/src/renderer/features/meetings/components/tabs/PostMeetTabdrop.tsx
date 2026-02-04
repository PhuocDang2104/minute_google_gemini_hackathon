import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { MeetingWithParticipants } from '../../../../shared/dto/meeting';
import { minutesApi, type MeetingMinutes } from '../../../../lib/api/minutes';
import { itemsApi, type ActionItem, type DecisionItem, type RiskItem } from '../../../../lib/api/items';
import { transcriptsApi } from '../../../../lib/api/transcripts';
import { meetingsApi } from '../../../../lib/api/meetings';

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
});

interface PostMeetTabProps {
  meeting: MeetingWithParticipants;
  onRefresh: () => void;
}

interface Chapter {
  id: string;
  title: string;
  level: number;
}

export const PostMeetTab = ({ meeting }: PostMeetTabProps) => {
  return (
    <div className="postmeet-tab">
      <SummarySection meeting={meeting} />
      <StatsSection meetingId={meeting.id} />
      <div className="postmeet-grid">
        <ActionItemsSection meetingId={meeting.id} />
        <DecisionsSection meetingId={meeting.id} />
      </div>
      <RisksSection meetingId={meeting.id} />
      <HighlightsSection meeting={meeting} />
      <TasksSyncSection meeting={meeting} />
      <DistributionSection meeting={meeting} />
    </div>
  );
};

// ------------------ Summary Section ------------------
const SummarySection = ({ meeting }: { meeting: MeetingWithParticipants }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [hideSensitive, setHideSensitive] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showChapters, setShowChapters] = useState(true);
  const [enableDiarization, setEnableDiarization] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLatestMinutes();
  }, [meeting.id]);

  useEffect(() => {
    if (minutes?.minutes_markdown) {
      extractChapters(minutes.minutes_markdown);
    }
  }, [minutes]);

  const extractChapters = (markdown: string) => {
    const lines = markdown.split('\n');
    const extracted: Chapter[] = [];
    lines.forEach((line, idx) => {
      if (line.startsWith('## ')) {
        extracted.push({ id: `chapter-${idx}`, title: line.replace('## ', ''), level: 2 });
      } else if (line.startsWith('### ')) {
        extracted.push({ id: `chapter-${idx}`, title: line.replace('### ', ''), level: 3 });
      }
    });
    setChapters(extracted);
  };

  const loadLatestMinutes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const latest = await minutesApi.getLatest(meeting.id);
      setMinutes(latest);
    } catch (err) {
      console.error('Failed to load minutes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMinutes = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // 1. Check for Transcript
      try {
        const transcriptList = await transcriptsApi.list(meeting.id);
        if (!transcriptList.chunks || transcriptList.chunks.length === 0) {
          console.log('No transcripts found. Triggering inference...');
          await meetingsApi.triggerInference(meeting.id, enableDiarization);
        }
      } catch (infErr) {
        console.error('Auto-transcript generation failed:', infErr);
        // We'll proceed but it might result in empty minutes
      }

      // 2. Generate Minutes
      const generated = await minutesApi.generate({
        meeting_id: meeting.id,
        include_transcript: true,
        include_actions: true,
        include_decisions: true,
        include_risks: true,
        format: 'markdown',
      });
      setMinutes(generated);
    } catch (err) {
      console.error('Failed to generate minutes via API:', err);
      setError('Không thể tạo biên bản từ AI. Thử lại sau khi hệ thống sẵn sàng.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToJira = () => {
    if (!minutes) {
      alert('Vui lòng tạo biên bản trước khi thêm vào Jira.');
      return;
    }
    alert('Đã gửi yêu cầu thêm vào Jira (demo).');
  };

  const handleCopySummary = () => {
    const content = minutes?.minutes_markdown || minutes?.executive_summary || '';
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(minutes?.minutes_markdown || minutes?.executive_summary || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!minutes) return;
    try {
      await minutesApi.update(minutes.id, {
        minutes_markdown: editContent,
        executive_summary: editContent.split('\n\n')[0] || editContent.substring(0, 500),
      });
      setMinutes({ ...minutes, minutes_markdown: editContent });
      setIsEditing(false);
    } catch (err) {
      setMinutes({ ...minutes, minutes_markdown: editContent });
      setIsEditing(false);
    }
  };

  const handleApprove = async () => {
    if (!minutes) return;
    const newStatus = minutes.status === 'draft' ? 'reviewed' : 'approved';
    try {
      await minutesApi.update(minutes.id, { status: newStatus });
      setMinutes({ ...minutes, status: newStatus });
    } catch {
      setMinutes({ ...minutes, status: newStatus });
    }
  };

  const handleReject = async () => {
    if (!minutes) return;
    try {
      await minutesApi.update(minutes.id, { status: 'draft' });
      setMinutes({ ...minutes, status: 'draft' });
    } catch {
      setMinutes({ ...minutes, status: 'draft' });
    }
  };

  const renderMarkdownToHtml = (markdown: string) => {
    try {
      const raw = marked.parse(markdown || '', { gfm: true, breaks: true, headerIds: false, mangle: false }) as string;
      const sanitized = DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] });
      return addChapterAnchors(sanitized);
    } catch (err) {
      console.error('Markdown render failed', err);
      return markdown;
    }
  };

  const handleExport = () => {
    if (!minutes) {
      alert('Vui lòng tạo biên bản trước khi export');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Không thể mở cửa sổ in. Vui lòng cho phép popup.');
      return;
    }
    const meetingDate = new Date(meeting.start_time).toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Biên bản cuộc họp - ${meeting.title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #0b63d1; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #0b63d1; font-size: 22px; margin-bottom: 8px; }
          .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; padding: 12px; background: #f5f6fa; border-radius: 8px; }
          .meta-item { flex: 1 1 200px; font-size: 13px; }
          .meta-label { color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-value { font-weight: 600; color: #111; }
          .section h2 { color: #0b63d1; font-size: 16px; margin: 16px 0 8px; }
          .content { white-space: pre-wrap; font-size: 14px; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          .stamp { margin-top: 12px; display: inline-block; padding: 8px 12px; border: 2px solid #0b63d1; color: #0b63d1; font-weight: 700; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BIÊN BẢN CUỘC HỌP</h1>
          <div>${meeting.title}</div>
          ${minutes.status === 'approved' ? '<div class="stamp">ĐÃ PHÊ DUYỆT</div>' : ''}
        </div>
        <div class="meta">
          <div class="meta-item"><div class="meta-label">Ngày họp</div><div class="meta-value">${meetingDate}</div></div>
          <div class="meta-item"><div class="meta-label">Thời gian</div><div class="meta-value">${new Date(meeting.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(meeting.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div></div>
          <div class="meta-item"><div class="meta-label">Địa điểm</div><div class="meta-value">${meeting.location || 'Online'}</div></div>
          <div class="meta-item"><div class="meta-label">Phiên bản</div><div class="meta-value">v${minutes.version} - ${minutes.status}</div></div>
        </div>
        <div class="section">
          <h2>NỘI DUNG CUỘC HỌP</h2>
          <div class="content">${renderMarkdownToHtml(minutes.minutes_markdown || minutes.executive_summary || 'Không có nội dung')}</div>
        </div>
        <div class="footer">
          <p>Biên bản được tạo bởi Minute AI</p>
          <p>Ngày xuất: ${new Date().toLocaleString('vi-VN')}</p>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const scrollToChapter = (title: string) => {
    if (contentRef.current) {
      const element = contentRef.current.querySelector(`[data-chapter="${title}"]`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const maskSensitiveContent = (content: string) => {
    if (!hideSensitive) return content;
    content = content.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email ẩn]');
    content = content.replace(/(\+84|0)\d{9,10}/g, '[SĐT ẩn]');
    content = content.replace(/\b[A-Z]{2,3}-\d{3,6}\b/g, '[ID ẩn]');
    return content;
  };

  const renderApprovalActions = () => {
    if (!minutes) return null;
    if (minutes.status === 'draft') {
      return <button className="btn btn--info btn--sm" onClick={handleApprove}>Chuyển Review</button>;
    }
    if (minutes.status === 'reviewed') {
      return (
        <>
          <button className="btn btn--success btn--sm" onClick={handleApprove}>Phê duyệt</button>
          <button className="btn btn--ghost btn--sm" onClick={handleReject}>Trả về nháp</button>
        </>
      );
    }
    return <span className="badge badge--success">Đã phê duyệt</span>;
  };

  return (
    <div className="summary-section summary-section--with-chapters">
      {chapters.length > 0 && showChapters && (
        <div className="chapters-sidebar">
          <div className="chapters-sidebar__header">
            <span>Mục lục</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowChapters(false)}>Ẩn</button>
          </div>
          <div className="chapters-sidebar__list">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                className={`chapters-sidebar__item chapters-sidebar__item--level-${chapter.level}`}
                onClick={() => scrollToChapter(chapter.title)}
              >
                {chapter.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="summary-main">
        <div className="summary-header">
          <div className="summary-header__left">
            <h3>Biên bản cuộc họp (AI Generated)</h3>
            {!showChapters && chapters.length > 0 && (
              <button className="btn btn--ghost btn--sm" onClick={() => setShowChapters(true)}>Mục lục</button>
            )}
          </div>
          <div className="summary-actions">
            {!minutes && (
              <label className="flex items-center space-x-1 cursor-pointer mr-2">
                <input
                  type="checkbox"
                  checked={enableDiarization}
                  onChange={(e) => setEnableDiarization(e.target.checked)}
                  className="form-checkbox h-3 w-3 text-blue-600 rounded"
                />
                <span className="text-xs text-gray-600">Diarization</span>
              </label>
            )}
            <button className="btn btn--accent btn--sm" onClick={handleGenerateMinutes} disabled={isGenerating || isLoading}>
              {minutes ? 'Tạo lại' : 'AI tạo biên bản'}
            </button>
            <button className="btn btn--secondary btn--sm" onClick={handleAddToJira} disabled={isLoading || isGenerating}>
              Thêm vào Jira
            </button>
            {minutes && !isEditing && (
              <>
                <button className="btn btn--secondary btn--sm" onClick={handleStartEdit}>Chỉnh sửa</button>
                <button className="btn btn--secondary btn--sm" onClick={handleCopySummary}>
                  {copied ? 'Đã copy' : 'Copy'}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setHideSensitive((prev) => !prev)}>
                  {hideSensitive ? 'Hiện đầy đủ' : 'Ẩn nhạy cảm'}
                </button>
                <button className="btn btn--primary btn--sm" onClick={handleExport}>Xuất PDF/In</button>
                {renderApprovalActions()}
              </>
            )}
            {isEditing && (
              <>
                <button className="btn btn--primary btn--sm" onClick={handleSaveEdit}>Lưu</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>Hủy</button>
              </>
            )}
            <button className="btn btn--ghost btn--icon btn--sm" onClick={loadLatestMinutes} disabled={isLoading}>
              Làm mới
            </button>
          </div>
        </div>

        <div className="summary-content" ref={contentRef}>
          {isLoading ? (
            <div className="section-loading">
              <div className="spinner" />
              <span>Đang tải biên bản...</span>
            </div>
          ) : isGenerating ? (
            <div className="generating-state">
              <div className="generating-dots"><span></span><span></span><span></span></div>
              <h4>AI đang tạo biên bản...</h4>
              <p>Đang phân tích transcript, action items, decisions và risks</p>
            </div>
          ) : isEditing ? (
            <div className="edit-mode">
              <textarea
                className="minutes-editor"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Nhập nội dung biên bản..."
                rows={20}
              />
              <p className="edit-hint">
                Hỗ trợ Markdown. Chỉnh wording, owner, deadline, ẩn chi tiết nhạy cảm nếu cần.
              </p>
            </div>
          ) : minutes ? (
            <div className="minutes-display">
              <div className="minutes-meta">
                <span className={`badge badge--${minutes.status === 'approved' ? 'success' : minutes.status === 'reviewed' ? 'info' : 'warning'}`}>
                  {minutes.status === 'approved' ? 'Đã duyệt' : minutes.status === 'reviewed' ? 'Đang review' : 'Bản nháp'}
                </span>
                <span className="minutes-version">Phiên bản {minutes.version}</span>
                {minutes.generated_at && (
                  <span className="minutes-date">{new Date(minutes.generated_at).toLocaleString('vi-VN')}</span>
                )}
                {hideSensitive && <span className="badge badge--warning">Đang ẩn thông tin nhạy cảm</span>}
              </div>
              <div
                className="minutes-content markdown-body"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownToHtml(
                    maskSensitiveContent(minutes.minutes_markdown || minutes.executive_summary || '')
                  ),
                }}
              />
            </div>
          ) : (
            <div className="empty-minutes">
              <h4>Chưa có biên bản</h4>
              <p>Nhấn "AI tạo biên bản" để Minute AI tự động tạo biên bản dựa trên nội dung cuộc họp</p>
              <button className="btn btn--accent" onClick={handleGenerateMinutes} disabled={isGenerating}>
                AI tạo biên bản ngay
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="error-toast">
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const addChapterAnchors = (html: string): string => {
  return html
    .replace(/<h2>(.*?)<\/h2>/gim, '<h2 data-chapter="$1">$1</h2>')
    .replace(/<h3>(.*?)<\/h3>/gim, '<h3 data-chapter="$1">$1</h3>');
};

// ------------------ Stats Section ------------------
const StatsSection = ({ meetingId }: { meetingId: string }) => {
  const [stats, setStats] = useState({ actions: 0, decisions: 0, risks: 0, duration: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [meetingId]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [actions, decisions, risks] = await Promise.all([
        itemsApi.listActions(meetingId).catch(() => ({ items: [], total: 0 })),
        itemsApi.listDecisions(meetingId).catch(() => ({ items: [], total: 0 })),
        itemsApi.listRisks(meetingId).catch(() => ({ items: [], total: 0 })),
      ]);
      setStats({
        actions: actions.total || 0,
        decisions: decisions.total || 0,
        risks: risks.total || 0,
        duration: 0,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="postmeet-stats">
        <div className="stat-card">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="postmeet-stats">
      <div className="stat-card stat-card--accent">
        <div className="stat-card__content">
          <span className="stat-card__value">{stats.actions}</span>
          <span className="stat-card__label">Action Items</span>
        </div>
      </div>
      <div className="stat-card stat-card--success">
        <div className="stat-card__content">
          <span className="stat-card__value">{stats.decisions}</span>
          <span className="stat-card__label">Quyết định</span>
        </div>
      </div>
      <div className="stat-card stat-card--warning">
        <div className="stat-card__content">
          <span className="stat-card__value">{stats.risks}</span>
          <span className="stat-card__label">Rủi ro</span>
        </div>
      </div>
      <div className="stat-card stat-card--info">
        <div className="stat-card__content">
          <span className="stat-card__value">{stats.duration || '--'}</span>
          <span className="stat-card__label">Phút</span>
        </div>
      </div>
    </div>
  );
};

// ------------------ Action Items ------------------
const ActionItemsSection = ({ meetingId }: { meetingId: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActions();
  }, [meetingId]);

  const loadActions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await itemsApi.listActions(meetingId);
      setActions(result.items || []);
    } catch (err) {
      console.error('Failed to load actions:', err);
      setError('Không thể tải action items');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  return (
    <div className="card">
      <div className="card__header">
        <h3>Action Items</h3>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          style={{ padding: '6px', width: '32px', height: '32px' }}
          onClick={loadActions}
          title="Làm mới"
        >
          Làm mới
        </button>
      </div>
      <div className="card__body">
        {isLoading ? (
          <div className="section-loading">Đang tải...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : actions.length === 0 ? (
          <div className="empty-state-mini">
            <p>Chưa có action items</p>
          </div>
        ) : (
          <div className="action-list">
            {actions.map(action => (
              <div key={action.id} className="action-row">
                <div className={`action-checkbox ${action.status === 'completed' ? 'action-checkbox--checked' : ''}`}>
                  {action.status === 'completed' && <span>✓</span>}
                </div>
                <div className="action-content">
                  <div className="action-text">{action.description}</div>
                  <div className="action-meta">
                    <span className={`badge badge--${action.priority === 'critical' ? 'error' : action.priority === 'high' ? 'warning' : 'neutral'}`}>
                      {action.priority}
                    </span>
                    {action.owner_name && (
                      <span className="action-meta-item">
                        {action.owner_name}
                      </span>
                    )}
                    {action.deadline && (
                      <span className="action-meta-item">
                        {formatDate(action.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`badge badge--${action.status === 'completed' ? 'success' : action.status === 'confirmed' ? 'info' : 'neutral'}`}>
                  {action.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------ Decisions ------------------
const DecisionsSection = ({ meetingId }: { meetingId: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDecisions();
  }, [meetingId]);

  const loadDecisions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await itemsApi.listDecisions(meetingId);
      setDecisions(result.items || []);
    } catch (err) {
      console.error('Failed to load decisions:', err);
      setError('Không thể tải quyết định');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card__header">
        <h3>Quyết định</h3>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          style={{ padding: '6px', width: '32px', height: '32px' }}
          onClick={loadDecisions}
          title="Làm mới"
        >
          Làm mới
        </button>
      </div>
      <div className="card__body">
        {isLoading ? (
          <div className="section-loading">Đang tải...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : decisions.length === 0 ? (
          <div className="empty-state-mini">
            <p>Chưa có quyết định</p>
          </div>
        ) : (
          <div className="decision-list">
            {decisions.map((dec, index) => (
              <div key={dec.id} className="decision-item">
                <div className="decision-header">
                  <span className="badge badge--success">QĐ-{String(index + 1).padStart(3, '0')}</span>
                  {dec.confirmed_by && (
                    <span className="decision-confirmer">
                      Đã xác nhận: {dec.confirmed_by}
                    </span>
                  )}
                </div>
                <div className="decision-text">{dec.description}</div>
                {dec.rationale && (
                  <div className="decision-rationale">{dec.rationale}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------ Risks ------------------
const RisksSection = ({ meetingId }: { meetingId: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRisks();
  }, [meetingId]);

  const loadRisks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await itemsApi.listRisks(meetingId);
      setRisks(result.items || []);
    } catch (err) {
      console.error('Failed to load risks:', err);
      setError('Không thể tải rủi ro');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card__header">
        <h3>Rủi ro đã nhận diện</h3>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          style={{ padding: '6px', width: '32px', height: '32px' }}
          onClick={loadRisks}
          title="Làm mới"
        >
          Làm mới
        </button>
      </div>
      <div className="card__body">
        {isLoading ? (
          <div className="section-loading">Đang tải...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : risks.length === 0 ? (
          <div className="empty-state-mini">
            <p>Chưa có rủi ro nào</p>
          </div>
        ) : (
          <div className="risk-grid">
            {risks.map((risk, index) => (
              <div key={risk.id} className={`risk-card risk-card--${risk.severity}`}>
                <div className="risk-header">
                  <span className="risk-id">R-{String(index + 1).padStart(3, '0')}</span>
                  <span className={`badge badge--${risk.severity === 'critical' || risk.severity === 'high' ? 'error' : 'warning'}`}>
                    {risk.severity}
                  </span>
                </div>
                <div className="risk-text">{risk.description}</div>
                {risk.mitigation && (
                  <div className="risk-mitigation">
                    <strong>Mitigation:</strong> {risk.mitigation}
                  </div>
                )}
                <span className={`badge badge--${risk.status === 'mitigated' ? 'success' : 'info'}`}>
                  {risk.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------ Highlights ------------------
const HighlightsSection = ({ meeting }: { meeting: MeetingWithParticipants }) => {
  const [selectedClip, setSelectedClip] = useState<number | null>(null);

  const mockHighlights = [
    { id: 1, title: 'Quyết định kiến trúc microservices', startTime: '05:23', endTime: '08:45', type: 'decision' },
    { id: 2, title: 'Phân công code review module auth', startTime: '12:10', endTime: '14:30', type: 'action' },
    { id: 3, title: 'Thảo luận về vendor delay risk', startTime: '18:45', endTime: '22:15', type: 'risk' },
    { id: 4, title: 'Phê duyệt budget cloud infrastructure', startTime: '28:00', endTime: '31:20', type: 'decision' },
    { id: 5, title: 'Timeline hoàn thành UAT', startTime: '35:50', endTime: '38:10', type: 'action' },
  ];

  const mockChapters = [
    { id: 1, title: 'Mở đầu & Review tiến độ', startTime: '00:00', duration: '5:23' },
    { id: 2, title: 'Thảo luận kiến trúc hệ thống', startTime: '05:23', duration: '6:47' },
    { id: 3, title: 'Phân công công việc', startTime: '12:10', duration: '6:35' },
    { id: 4, title: 'Đánh giá rủi ro', startTime: '18:45', duration: '9:15' },
    { id: 5, title: 'Budget & Resources', startTime: '28:00', duration: '7:50' },
    { id: 6, title: 'Timeline & Next steps', startTime: '35:50', duration: '4:20' },
  ];

  return (
    <div className="highlights-section">
      <div className="highlights-grid">
        <div className="card">
          <div className="card__header">
            <h3>Highlights (Video)</h3>
          </div>
          <div className="card__body">
            <div className="video-preview">
              <div className="video-preview__placeholder">
                <p>Xem trước video (placeholder)</p>
                {selectedClip !== null && (
                  <span className="badge badge--accent">
                    Đang xem: {mockHighlights.find(h => h.id === selectedClip)?.title}
                  </span>
                )}
              </div>
              <div className="video-preview__controls">
                <button className="btn btn--ghost btn--sm">Play/Pause</button>
                <div className="video-preview__timeline">
                  <div className="video-preview__progress" style={{ width: '35%' }}></div>
                </div>
                <span className="video-preview__time">14:32 / 40:10</span>
              </div>
            </div>

            <div className="highlight-clips">
              <h4>Candidate Clips ({mockHighlights.length})</h4>
              <div className="highlight-clips__list">
                {mockHighlights.map((clip) => (
                  <div
                    key={clip.id}
                    className={`highlight-clip ${selectedClip === clip.id ? 'highlight-clip--active' : ''}`}
                    onClick={() => setSelectedClip(clip.id)}
                  >
                    <div className="highlight-clip__thumbnail">{clip.type.toUpperCase()}</div>
                    <div className="highlight-clip__info">
                      <div className="highlight-clip__title">{clip.title}</div>
                      <div className="highlight-clip__time">
                        {clip.startTime} - {clip.endTime}
                      </div>
                    </div>
                    <span className={`badge badge--${clip.type === 'decision' ? 'success' : clip.type === 'action' ? 'info' : 'warning'}`}>
                      {clip.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <h3>Chapters</h3>
          </div>
          <div className="card__body">
            <div className="chapter-list">
              {mockChapters.map((chapter, idx) => (
                <div key={chapter.id} className="chapter-item">
                  <div className="chapter-item__number">{idx + 1}</div>
                  <div className="chapter-item__info">
                    <div className="chapter-item__title">{chapter.title}</div>
                    <div className="chapter-item__meta">
                      {chapter.startTime} ({chapter.duration})
                    </div>
                  </div>
                  <button className="btn btn--ghost btn--sm">Xem</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ------------------ Tasks & Sync ------------------
const TasksSyncSection = ({ meeting }: { meeting: MeetingWithParticipants }) => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [syncTarget, setSyncTarget] = useState<'planner' | 'jira' | 'loffice'>('planner');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ owner: string; deadline: string; priority: string }>({
    owner: '', deadline: '', priority: ''
  });

  useEffect(() => {
    loadActions();
  }, [meeting.id]);

  const loadActions = async () => {
    setIsLoading(true);
    try {
      const result = await itemsApi.listActions(meeting.id);
      setActions(result.items || []);
    } catch (err) {
      console.error('Failed to load actions:', err);
      setActions([
        { id: '1', meeting_id: meeting.id, description: 'Hoàn thành code review module authentication', owner_name: 'Nguyễn Văn A', deadline: '2024-12-15', priority: 'high', status: 'pending' },
        { id: '2', meeting_id: meeting.id, description: 'Chuẩn bị tài liệu UAT', owner_name: 'Trần Thị B', deadline: '2024-12-20', priority: 'medium', status: 'pending' },
      ] as ActionItem[]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    const next = new Set(selectedTasks);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTasks(next);
  };

  const selectAll = () => setSelectedTasks(new Set(actions.map(a => a.id)));
  const deselectAll = () => setSelectedTasks(new Set());

  const startEditTask = (action: ActionItem) => {
    setEditingTask(action.id);
    setEditForm({
      owner: action.owner_name || '',
      deadline: action.deadline?.split('T')[0] || '',
      priority: action.priority || 'medium',
    });
  };

  const saveEditTask = (actionId: string) => {
    setActions(prev => prev.map(a =>
      a.id === actionId
        ? { ...a, owner_name: editForm.owner, deadline: editForm.deadline, priority: editForm.priority }
        : a
    ));
    setEditingTask(null);
  };

  const handleSync = async () => {
    if (selectedTasks.size === 0) {
      alert('Vui lòng chọn ít nhất một task để đồng bộ');
      return;
    }
    setIsSyncing(true);
    for (const taskId of selectedTasks) {
      await new Promise(resolve => setTimeout(resolve, 400));
      setSyncResults(prev => ({ ...prev, [taskId]: 'synced' }));
    }
    setIsSyncing(false);
    setSelectedTasks(new Set());
  };

  return (
    <div className="tasks-sync-section">
      <div className="card">
        <div className="card__header">
          <h3>Đồng bộ Tasks ra hệ thống ngoài</h3>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <select
              className="form-select"
              value={syncTarget}
              onChange={(e) => setSyncTarget(e.target.value as any)}
              style={{ minWidth: '150px' }}
            >
              <option value="planner">Microsoft Planner</option>
              <option value="jira">Jira</option>
              <option value="loffice">LOffice Work</option>
            </select>
            <button
              className="btn btn--primary"
              onClick={handleSync}
              disabled={isSyncing || selectedTasks.size === 0}
            >
              {isSyncing ? 'Đang đồng bộ...' : `Sync ${selectedTasks.size} task`}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h3>Action Items ({actions.length}) {selectedTasks.size > 0 && <span className="badge badge--accent">{selectedTasks.size} đã chọn</span>}</h3>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn--ghost btn--sm" onClick={selectAll}>Chọn tất cả</button>
            <button className="btn btn--ghost btn--sm" onClick={deselectAll}>Bỏ chọn</button>
            <button
              className="btn btn--ghost btn--icon btn--sm"
              style={{ padding: '6px', width: '32px', height: '32px' }}
              onClick={loadActions}
            >
              Làm mới
            </button>
          </div>
        </div>
        <div className="card__body">
          {isLoading ? (
            <div className="section-loading">Đang tải...</div>
          ) : actions.length === 0 ? (
            <div className="empty-state-mini">
              <p>Chưa có action items</p>
            </div>
          ) : (
            <div className="tasks-list">
              {actions.map(action => {
                const isEditingRow = editingTask === action.id;
                const isSynced = syncResults[action.id] === 'synced';
                return (
                  <div
                    key={action.id}
                    className={`task-row ${selectedTasks.has(action.id) ? 'task-row--selected' : ''} ${isSynced ? 'task-row--synced' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTasks.has(action.id)}
                      onChange={() => toggleTask(action.id)}
                      style={{ accentColor: 'var(--accent)' }}
                    />

                    <div className="task-row__content">
                      <div className="task-row__description">{action.description}</div>

                      {isEditingRow ? (
                        <div className="task-row__edit-form">
                          <input
                            type="text"
                            className="form-input form-input--sm"
                            placeholder="Owner"
                            value={editForm.owner}
                            onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                          />
                          <input
                            type="date"
                            className="form-input form-input--sm"
                            value={editForm.deadline}
                            onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                          />
                          <select
                            className="form-select form-select--sm"
                            value={editForm.priority}
                            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                          <button className="btn btn--primary btn--sm" onClick={() => saveEditTask(action.id)}>Lưu</button>
                          <button className="btn btn--ghost btn--sm" onClick={() => setEditingTask(null)}>Hủy</button>
                        </div>
                      ) : (
                        <div className="task-row__meta">
                          <span className={`badge badge--${action.priority === 'critical' || action.priority === 'high' ? 'error' : action.priority === 'medium' ? 'warning' : 'neutral'}`}>
                            {action.priority}
                          </span>
                          {action.owner_name && (
                            <span className="task-row__meta-item">
                              {action.owner_name}
                            </span>
                          )}
                          {action.deadline && (
                            <span className="task-row__meta-item">
                              {new Date(action.deadline).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="task-row__actions">
                      {isSynced ? (
                        <span className="badge badge--success">Đã sync</span>
                      ) : (
                        <button
                          className="btn btn--ghost btn--icon btn--sm"
                          onClick={() => startEditTask(action)}
                          title="Chỉnh sửa"
                        >
                          Sửa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------ Distribution ------------------
const DistributionSection = ({ meeting }: { meeting: MeetingWithParticipants }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionLogs, setDistributionLogs] = useState<any[]>([]);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const participants = meeting.participants || [];

  useEffect(() => {
    loadData();
  }, [meeting.id]);

  useEffect(() => {
    if (minutes && meeting) {
      const startDate = new Date(meeting.start_time);
      setEmailSubject(`[Minute] Biên bản cuộc họp: ${meeting.title} - ${startDate.toLocaleDateString('vi-VN')}`);
      setEmailBody(generateEmailBody());
    }
  }, [minutes, meeting]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [latestMinutes, logs] = await Promise.all([
        minutesApi.getLatest(meeting.id),
        minutesApi.getDistributionLogs(meeting.id).catch(() => ({ logs: [], total: 0 })),
      ]);
      setMinutes(latestMinutes);
      setDistributionLogs(logs.logs || []);
    } catch (err) {
      console.error('Failed to load distribution data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateEmailBody = () => {
    const startDate = new Date(meeting.start_time);
    const summary = minutes?.executive_summary || 'Đang cập nhật...';
    const status = minutes?.status === 'approved' ? 'ĐÃ PHÊ DUYỆT' : 'Bản nháp';
    return `Kính gửi Quý đồng nghiệp,

Biên bản cuộc họp "${meeting.title}" đã được hoàn thành. (${status})

Thời gian: ${startDate.toLocaleDateString('vi-VN')} - ${startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
Địa điểm: ${meeting.location || 'Online'}

TÓM TẮT:
${summary}

Vui lòng xem chi tiết biên bản đính kèm hoặc truy cập Minute để xem đầy đủ.

Trân trọng,
Minute AI Assistant`;
  };

  const handleOpenEmailModal = () => {
    if (!minutes) {
      alert('Vui lòng tạo biên bản trước khi gửi email');
      return;
    }
    if (minutes.status !== 'approved') {
      const confirmSend = window.confirm('Biên bản chưa được phê duyệt. Bạn vẫn muốn gửi?');
      if (!confirmSend) return;
    }
    setSelectedRecipients(participants.map((p: any) => p.user_id || p.email).filter(Boolean));
    setSendSuccess(false);
    setShowEmailModal(true);
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSendEmail = async () => {
    if (selectedRecipients.length === 0) {
      alert('Vui lòng chọn ít nhất một người nhận');
      return;
    }
    setIsDistributing(true);
    try {
      await minutesApi.distribute({
        minutes_id: minutes!.id,
        meeting_id: meeting.id,
        channels: ['email'],
        recipients: selectedRecipients,
      });
      setSendSuccess(true);
      await loadData();
      setTimeout(() => {
        setShowEmailModal(false);
        setSendSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to distribute:', err);
      alert('Không thể gửi email. Vui lòng thử lại.');
    } finally {
      setIsDistributing(false);
    }
  };

  const distributedEmails = new Set(distributionLogs.map(log => log.recipient_email).filter(Boolean));

  return (
    <>
      <div className="card">
        <div className="card__header">
          <h3>Phân phối biên bản</h3>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {minutes?.status === 'approved' && (
              <span className="badge badge--success">Đã phê duyệt - Sẵn sàng gửi</span>
            )}
            <button
              className="btn btn--primary btn--sm"
              onClick={handleOpenEmailModal}
              disabled={!minutes || isDistributing}
            >
              Gửi Email
            </button>
          </div>
        </div>
        <div className="card__body">
          {isLoading ? (
            <div className="section-loading">Đang tải...</div>
          ) : (
            <>
              {!minutes && (
                <div className="empty-hint" style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                  <p>Tạo biên bản để gửi cho attendees</p>
                </div>
              )}

              {minutes && (
                <>
                  <div className="distribution-list">
                    {participants.slice(0, 10).map((p: any, idx: number) => {
                      const email = p.email;
                      const isDistributed = email && distributedEmails.has(email);
                      return (
                        <div key={p.user_id || p.email || idx} className="distribution-item">
                          <div className="distribution-avatar">
                            {(p.display_name || p.email || '?').charAt(0)}
                          </div>
                          <div className="distribution-info">
                            <div className="distribution-name">{p.display_name || p.email || 'Thành viên'}</div>
                            <div className="distribution-email">{p.email}</div>
                          </div>
                          <span className={`badge badge--${isDistributed ? 'success' : 'neutral'}`}>
                            {isDistributed ? 'Đã gửi' : 'Chưa gửi'}
                          </span>
                        </div>
                      );
                    })}
                    {participants.length > 10 && (
                      <div className="text-muted" style={{ fontSize: '13px', padding: 'var(--space-sm)' }}>
                        + {participants.length - 10} người khác
                      </div>
                    )}
                  </div>

                  {distributionLogs.length > 0 && (
                    <div className="distribution-logs">
                      <h4>Lịch sử gửi</h4>
                      {distributionLogs.slice(0, 5).map(log => (
                        <div key={log.id} className="distribution-log-item">
                          <span>{log.recipient_email}</span>
                          <span className="badge badge--neutral" style={{ fontSize: '10px' }}>{log.channel}</span>
                          <span className="text-muted" style={{ fontSize: '11px' }}>
                            {new Date(log.sent_at).toLocaleString('vi-VN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showEmailModal && (
        <div className="modal-overlay" onClick={() => !isDistributing && setShowEmailModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '720px',
              maxHeight: '90vh',
              overflow: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            }}
          >
            <div className="modal__header">
              <h2 className="modal__title">Gửi biên bản qua Email</h2>
              <button
                className="btn btn--ghost btn--icon"
                onClick={() => setShowEmailModal(false)}
                disabled={isDistributing}
              >
                Đóng
              </button>
            </div>

            {sendSuccess ? (
              <div className="modal__body" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
                <h3 style={{ color: 'var(--success)', marginBottom: 'var(--space-sm)' }}>Gửi thành công!</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  Đã gửi biên bản đến {selectedRecipients.length} người nhận
                </p>
              </div>
            ) : (
              <>
                <div className="modal__body">
                  <div className="form-group">
                    <label className="form-label">
                      Người nhận ({selectedRecipients.length}/{participants.length})
                    </label>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => setSelectedRecipients(participants.map((p: any) => p.user_id || p.email).filter(Boolean))}>
                        Chọn tất cả
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setSelectedRecipients([])}>
                        Bỏ chọn tất cả
                      </button>
                    </div>
                    <div className="recipients-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 'var(--space-sm)',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      padding: 'var(--space-sm)',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)'
                    }}>
                      {participants.map((p: any, idx: number) => {
                        const id = p.user_id || p.email;
                        const isSelected = selectedRecipients.includes(id);
                        const isDistributed = distributedEmails.has(p.email);
                        return (
                          <label
                            key={id || idx}
                            className="recipient-checkbox"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-sm)',
                              padding: 'var(--space-sm)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRecipient(id)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.display_name || p.email || 'Thành viên'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.email}
                              </div>
                            </div>
                            {isDistributed && (
                              <span className="badge badge--success" style={{ fontSize: '9px', padding: '2px 6px' }}>
                                Đã gửi
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tiêu đề email</label>
                    <input
                      type="text"
                      className="form-input"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nội dung email (xem trước)</label>
                    <textarea
                      className="form-input"
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      rows={10}
                      style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.5 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Đính kèm</label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      padding: 'var(--space-sm)',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)'
                    }}>
                      <span>Biên bản cuộc họp - {meeting.title}.pdf</span>
                      {minutes?.status === 'approved' && (
                        <span className="badge badge--success" style={{ marginLeft: 'auto' }}>
                          Đã duyệt
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal__footer">
                  <button
                    className="btn btn--secondary"
                    onClick={() => setShowEmailModal(false)}
                    disabled={isDistributing}
                  >
                    Hủy
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={handleSendEmail}
                    disabled={isDistributing || selectedRecipients.length === 0}
                  >
                    {isDistributing ? 'Đang gửi...' : `Gửi đến ${selectedRecipients.length} người`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PostMeetTab;
