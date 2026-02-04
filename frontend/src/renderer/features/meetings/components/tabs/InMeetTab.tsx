import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Edit3,
  FileText,
  Link as LinkIcon,
  Mic,
  Sparkles,
  User,
  Wand2,
  X,
} from 'lucide-react';
import type { MeetingWithParticipants } from '../../../../shared/dto/meeting';
import { actionItems, decisions, formatDuration, risks } from '../../../../store/mockData';
import { API_URL, USE_API } from '../../../../config/env';
import { sessionsApi, diarizationApi } from '../../../../lib/api';
import { RecordingControls } from '../RecordingControls';

type WsStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disabled';
interface InMeetTabProps {
  meeting: MeetingWithParticipants;
  joinPlatform: 'gomeet' | 'gmeet';
  streamSessionId: string;
  initialAudioIngestToken?: string;
  onRefresh: () => void;
  onEndMeeting: () => void;
}

type TopicSegmentState = {
  topic_id?: string;
  title?: string;
  start_t?: number;
  end_t?: number;
};

type RecapItem = {
  id: string;
  t: string;
  text: string;
  topic?: string;
};

type AdrAction = {
  id: string;
  description: string;
  owner?: string;
  deadline?: string;
  priority?: string;
  detail?: string;
};

type AdrDecision = {
  id: string;
  description: string;
  confirmedBy?: string;
  detail?: string;
};

type AdrRisk = {
  id: string;
  description: string;
  severity?: string;
  owner?: string;
  detail?: string;
};

const normalizeAdrActions = (items: any[]): AdrAction[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => ({
    id: String(item?.id || item?.task || `action-${idx}`),
    description: String(item?.task || item?.source_text || 'Action item'),
    owner: item?.owner ? String(item.owner) : undefined,
    deadline: item?.due_date ? String(item.due_date) : undefined,
    priority: item?.priority ? String(item.priority) : undefined,
    detail: item?.source_text
      ? String(item.source_text)
      : item?.sourceText
        ? String(item.sourceText)
        : item?.detail
          ? String(item.detail)
          : undefined,
  }));
};

const normalizeAdrDecisions = (items: any[]): AdrDecision[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => ({
    id: String(item?.id || item?.title || `decision-${idx}`),
    description: String(item?.title || item?.source_text || 'Decision'),
    confirmedBy: item?.confirmed_by ? String(item.confirmed_by) : undefined,
    detail: item?.rationale
      ? String(item.rationale)
      : item?.source_text
        ? String(item.source_text)
        : item?.sourceText
          ? String(item.sourceText)
          : undefined,
  }));
};

const normalizeAdrRisks = (items: any[]): AdrRisk[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => ({
    id: String(item?.id || item?.desc || `risk-${idx}`),
    description: String(item?.desc || item?.source_text || 'Risk'),
    severity: item?.severity ? String(item.severity) : undefined,
    owner: item?.owner ? String(item.owner) : undefined,
    detail: item?.mitigation
      ? String(item.mitigation)
      : item?.source_text
        ? String(item.source_text)
        : item?.sourceText
          ? String(item.sourceText)
          : undefined,
  }));
};

const formatAdrDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export const InMeetTab = ({
  meeting,
  joinPlatform,
  streamSessionId,
  initialAudioIngestToken,
}: InMeetTabProps) => {
  const [feedStatus, setFeedStatus] = useState<WsStatus>(USE_API ? 'idle' : 'disabled');
  const [lastTranscriptAt, setLastTranscriptAt] = useState<number | null>(null);
  const [livePartial, setLivePartial] = useState<{
    speaker: string;
    text: string;
    time: number;
  } | null>(null);
  const [liveFinal, setLiveFinal] = useState<{
    speaker: string;
    text: string;
    time: number;
  } | null>(null);
  const [finalTranscript, setFinalTranscript] = useState<
    { id: string; speaker: string; text: string; time: number }[]
  >([]);
  const [liveRecap, setLiveRecap] = useState<string | null>(null);
  const [semanticIntent, setSemanticIntent] = useState('NO_INTENT');
  const [currentTopicId, setCurrentTopicId] = useState('T0');
  const [topicSegments, setTopicSegments] = useState<TopicSegmentState[]>([]);
  const [recapItems, setRecapItems] = useState<RecapItem[]>([]);
  const [diarizationSegments, setDiarizationSegments] = useState<
    { speaker: string; start: number; end: number; confidence?: number }[]
  >([]);
  const [liveActions, setLiveActions] = useState<AdrAction[]>([]);
  const [liveDecisions, setLiveDecisions] = useState<AdrDecision[]>([]);
  const [liveRisks, setLiveRisks] = useState<AdrRisk[]>([]);
  const [hasLiveAdr, setHasLiveAdr] = useState(false);
  const [audioIngestToken, setAudioIngestToken] = useState<string | null>(
    initialAudioIngestToken || null,
  );
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'transcript' | 'insights'>('transcript');

  const feedRef = useRef<WebSocket | null>(null);
  const partialClearRef = useRef<number | null>(null);
  const finalClearRef = useRef<number | null>(null);
  const lastFinalTimeRef = useRef(0);
  const wsBase = useMemo(() => {
    if (API_URL.startsWith('https://')) return API_URL.replace(/^https:/i, 'wss:').replace(/\/$/, '');
    if (API_URL.startsWith('http://')) return API_URL.replace(/^http:/i, 'ws:').replace(/\/$/, '');
    return API_URL.replace(/\/$/, '');
  }, []);
  const sessionIdForStream = streamSessionId || meeting.id;
  const feedEndpoint = useMemo(() => `${wsBase}/api/v1/ws/frontend/${sessionIdForStream}`, [wsBase, sessionIdForStream]);

  useEffect(() => {
    if (!USE_API || !sessionIdForStream) return;
    let stop = false;
    const fetchDiarization = async () => {
      try {
        const res = await diarizationApi.list(sessionIdForStream);
        if (!stop && Array.isArray(res?.segments)) {
          setDiarizationSegments(res.segments);
        }
      } catch (_err) {
        // swallow polling errors
      }
    };
    fetchDiarization();
    const id = window.setInterval(fetchDiarization, 7000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [sessionIdForStream]);

  const actions = useMemo<AdrAction[]>(() => {
    const scoped = actionItems.filter(a => a.meetingId === meeting.id).slice(0, 4);
    const source = scoped.length > 0 ? scoped : actionItems.slice(0, 3);
    return source.map(item => ({
      id: item.id,
      description: item.description,
      owner: item.owner.displayName,
      deadline: item.deadline.toISOString(),
      priority: item.priority,
      detail: item.sourceText,
    }));
  }, [meeting.id]);

  const meetingDecisions = useMemo<AdrDecision[]>(() => {
    const scoped = decisions.filter(d => d.meetingId === meeting.id).slice(0, 3);
    const source = scoped.length > 0 ? scoped : decisions.slice(0, 2);
    return source.map(item => ({
      id: item.id,
      description: item.description,
      confirmedBy: item.confirmedBy.displayName,
      detail: item.rationale,
    }));
  }, [meeting.id]);

  const meetingRisks = useMemo<AdrRisk[]>(() => {
    const scoped = risks.filter(r => r.meetingId === meeting.id).slice(0, 3);
    const source = scoped.length > 0 ? scoped : risks.slice(0, 2);
    return source.map(item => ({
      id: item.id,
      description: item.description,
      severity: item.severity,
      owner: item.owner.displayName,
      detail: item.mitigation,
    }));
  }, [meeting.id]);

  const resolvedActions = hasLiveAdr ? liveActions : actions;
  const resolvedDecisions = hasLiveAdr ? liveDecisions : meetingDecisions;
  const resolvedRisks = hasLiveAdr ? liveRisks : meetingRisks;

  const currentTopicTitle = useMemo(() => {
    const match = topicSegments.find(seg => seg.topic_id === currentTopicId);
    return match?.title || currentTopicId || 'T0';
  }, [currentTopicId, topicSegments]);

  const topicLog = useMemo(() => {
    return topicSegments.slice(-3).map((seg, idx) => ({
      id: `${seg.topic_id || 'topic'}-${idx}`,
      time: formatDuration(Math.max(0, Math.floor(Number(seg.start_t || 0)))),
      text: seg.title || seg.topic_id || 'Topic',
    }));
  }, [topicSegments]);

  useEffect(() => {
    if (initialAudioIngestToken) {
      setAudioIngestToken(initialAudioIngestToken);
    }
  }, [initialAudioIngestToken]);

  useEffect(() => {
    if (!USE_API) {
      setFeedStatus('disabled');
      return;
    }
    setFeedStatus('connecting');
    const socket = new WebSocket(feedEndpoint);
    feedRef.current = socket;

    socket.onopen = () => {
      setFeedStatus('connected');
    };
    socket.onclose = () => {
      setFeedStatus(USE_API ? 'idle' : 'disabled');
    };
    socket.onerror = evt => {
      console.error('Frontend WS error', evt);
      setFeedStatus('error');
    };
    socket.onmessage = event => {
      const raw = typeof event.data === 'string' ? event.data : '';
      try {
        const data = JSON.parse(raw);
        if (data?.event === 'transcript_event') {
          const p = data.payload || {};
          setLastTranscriptAt(Date.now());
          const text = (p.chunk || '').trim();
          const isFinal = p.is_final !== false;
          const speaker = p.speaker || 'SPEAKER_01';
          const time = p.time_start || 0;
          if (text) {
            if (isFinal) {
              setLiveFinal({ speaker, text, time });
              setLivePartial(null);
              if (finalClearRef.current) {
                window.clearTimeout(finalClearRef.current);
              }
              finalClearRef.current = window.setTimeout(() => {
                setLiveFinal(null);
              }, 5000);
            } else {
              setLivePartial({ speaker, text, time });
              if (partialClearRef.current) {
                window.clearTimeout(partialClearRef.current);
              }
              partialClearRef.current = window.setTimeout(() => {
                setLivePartial(null);
              }, 1200);
            }
          }
          if (isFinal && text) {
            lastFinalTimeRef.current = Number(time) || 0;
            setFinalTranscript(prev =>
              [...prev, { id: String(data.seq || Date.now()), speaker, text, time }].slice(-120),
            );
          }
        } else if (data?.event === 'state') {
          const p = data.payload || {};
          const intentLabel =
            typeof p.intent_payload?.label === 'string'
              ? p.intent_payload.label
              : typeof p.semantic_intent_label === 'string'
                ? p.semantic_intent_label
                : undefined;
          if (intentLabel) {
            setSemanticIntent(intentLabel || 'NO_INTENT');
          }

          const topicId =
            typeof p.topic?.topic_id === 'string'
              ? p.topic.topic_id
              : typeof p.current_topic_id === 'string'
                ? p.current_topic_id
                : undefined;
          if (topicId) {
            setCurrentTopicId(topicId);
          }
          if (Array.isArray(p.topic_segments)) {
            setTopicSegments(p.topic_segments);
          }
          const recapValue =
            typeof p.recap === 'string'
              ? p.recap
              : typeof p.live_recap === 'string'
                ? p.live_recap
                : '';
          if (recapValue && recapValue.trim()) {
            const recapText = recapValue.trim();
            setLiveRecap(recapText);
            setRecapItems(prev => {
              if (prev.length && prev[prev.length - 1].text === recapText) {
                return prev;
              }
              const nextTopicId =
                (typeof p.topic?.topic_id === 'string' && p.topic.topic_id) ||
                (typeof p.current_topic_id === 'string' && p.current_topic_id) ||
                currentTopicId ||
                'T0';
              const nextSegments = Array.isArray(p.topic_segments) ? p.topic_segments : topicSegments;
              const topicTitle =
                nextSegments.find((seg: TopicSegmentState) => seg.topic_id === nextTopicId)?.title || nextTopicId;
              const timeLabel = formatDuration(Math.max(0, Math.floor(lastFinalTimeRef.current || 0)));
              const entry: RecapItem = {
                id: `${Date.now()}`,
                t: timeLabel,
                text: recapText,
                topic: topicTitle,
              };
              return [...prev, entry].slice(-5);
            });
          }
          if (Array.isArray(p.actions) || Array.isArray(p.decisions) || Array.isArray(p.risks)) {
            setHasLiveAdr(true);
          }
          if (Array.isArray(p.actions)) {
            setLiveActions(normalizeAdrActions(p.actions));
          }
          if (Array.isArray(p.decisions)) {
            setLiveDecisions(normalizeAdrDecisions(p.decisions));
          }
          if (Array.isArray(p.risks)) {
            setLiveRisks(normalizeAdrRisks(p.risks));
          }
        }
      } catch (_e) {
        /* ignore */
      }
    };

    return () => {
      socket.close();
      feedRef.current = null;
      if (partialClearRef.current) {
        window.clearTimeout(partialClearRef.current);
      }
      if (finalClearRef.current) {
        window.clearTimeout(finalClearRef.current);
      }
    };
  }, [feedEndpoint]);

  const handleFetchAudioToken = async () => {
    if (!USE_API) return;
    setIsTokenLoading(true);
    setTokenError(null);
    try {
      const platform = joinPlatform === 'gomeet' ? 'vnpt_gomeet' : undefined;
      const res = await sessionsApi.registerSource(sessionIdForStream, platform);
      setAudioIngestToken(res.audio_ingest_token);
    } catch (err) {
      console.error('Failed to register source:', err);
      setTokenError('Không lấy được audio_ingest_token. Kiểm tra backend /api/v1/sessions/{id}/sources.');
    } finally {
      setIsTokenLoading(false);
    }
  };

  return (
    <div className="inmeet-tab">
      <div style={{ marginBottom: 16 }}>
        <RecordingControls />
      </div>
      <div className="inmeet-toggle" role="tablist" aria-label="In-meeting panels">
        <button
          type="button"
          className={`inmeet-toggle__btn ${activePanel === 'transcript' ? 'is-active' : ''}`}
          onClick={() => setActivePanel('transcript')}
          aria-pressed={activePanel === 'transcript'}
        >
          Live Transcript
        </button>
        <button
          type="button"
          className={`inmeet-toggle__btn ${activePanel === 'insights' ? 'is-active' : ''}`}
          onClick={() => setActivePanel('insights')}
          aria-pressed={activePanel === 'insights'}
        >
          Recap & Insights
        </button>
      </div>

      <div className="inmeet-grid inmeet-grid--single">
        <div className="inmeet-column inmeet-column--main">
          {activePanel === 'transcript' ? (
            <LiveTranscriptPanel
              livePartial={livePartial}
              liveFinal={liveFinal}
              finalTranscriptCount={finalTranscript.length}
              finalTranscript={finalTranscript}
              diarizationSegments={diarizationSegments}
              joinPlatform={joinPlatform}
              feedStatus={feedStatus}
              lastTranscriptAt={lastTranscriptAt}
              audioIngestToken={audioIngestToken}
              tokenError={tokenError}
              isTokenLoading={isTokenLoading}
              onFetchAudioToken={handleFetchAudioToken}
            />
          ) : (
            <div className="inmeet-insights">
              <LiveSignalPanel
                liveRecap={liveRecap}
                semanticIntent={semanticIntent}
                currentTopicTitle={currentTopicTitle}
                topicLog={topicLog}
              />
              <LiveRecapPanel recapItems={recapItems} currentTopicTitle={currentTopicTitle} />
              <AdrPanel
                actions={resolvedActions}
                decisions={resolvedDecisions}
                risks={resolvedRisks}
              />
              <ToolSuggestionsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TranscriptPanelProps {
  livePartial: { speaker: string; text: string; time: number } | null;
  liveFinal: { speaker: string; text: string; time: number } | null;
  finalTranscriptCount: number;
  finalTranscript: { id: string; speaker: string; text: string; time: number }[];
  diarizationSegments: { speaker: string; start: number; end: number; confidence?: number }[];
  joinPlatform: 'gomeet' | 'gmeet';
  feedStatus: WsStatus;
  lastTranscriptAt: number | null;
  audioIngestToken: string | null;
  tokenError: string | null;
  isTokenLoading: boolean;
  onFetchAudioToken: () => void;
}

const AudioStreamIndicator = ({
  feedStatus,
  lastTranscriptAt,
}: {
  feedStatus: WsStatus;
  lastTranscriptAt: number | null;
}) => {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1500);
    return () => window.clearInterval(id);
  }, []);

  const status = useMemo(() => {
    if (feedStatus === 'error') {
      return { tone: 'error', label: 'WS lỗi', hint: 'Frontend channel không phản hồi' };
    }
    if (feedStatus === 'connecting' || feedStatus === 'idle') {
      return { tone: 'idle', label: 'Đang kết nối...', hint: 'Đợi bắt tay WebSocket' };
    }
    if (feedStatus === 'disabled') {
      return { tone: 'idle', label: 'API tắt', hint: 'USE_API=false' };
    }
    if (!lastTranscriptAt) {
      return { tone: 'idle', label: 'Chưa nhận audio', hint: 'Chờ frame đầu tiên' };
    }
    const delta = tick - lastTranscriptAt;
    if (delta < 6000) {
      return { tone: 'live', label: 'Đang nhận audio', hint: 'Frame realtime từ WS' };
    }
    if (delta < 15000) {
      return { tone: 'warn', label: 'Tạm ngưng luồng', hint: 'Chưa thấy frame mới' };
    }
    return { tone: 'idle', label: 'Không có audio', hint: 'Kiểm tra GoMeet/Meet' };
  }, [feedStatus, lastTranscriptAt, tick]);

  return (
    <div className={`audio-indicator audio-indicator--${status.tone}`} title={status.hint}>
      <div className="audio-indicator__pulse">
        <span className="audio-indicator__wave"></span>
        <span className="audio-indicator__wave audio-indicator__wave--delay"></span>
        <span className="audio-indicator__core"></span>
      </div>
      <div className="audio-indicator__labels">
        <div className="audio-indicator__title">Audio stream</div>
        <div className="audio-indicator__status">{status.label}</div>
      </div>
    </div>
  );
};

const LiveTranscriptPanel = ({
  livePartial,
  liveFinal,
  finalTranscriptCount,
  finalTranscript,
  diarizationSegments,
  joinPlatform,
  feedStatus,
  lastTranscriptAt,
  audioIngestToken,
  tokenError,
  isTokenLoading,
  onFetchAudioToken,
}: TranscriptPanelProps) => {
  const speakerPalette = useMemo(
    () => ['#5b8def', '#e66b6b', '#5cc28a', '#f0a35a', '#9c6ade', '#4fb3d4'],
    [],
  );
  const speakerColors = useMemo(() => {
    const map: Record<string, string> = {};
    let idx = 0;
    finalTranscript.forEach(item => {
      if (!map[item.speaker]) {
        map[item.speaker] = speakerPalette[idx % speakerPalette.length];
        idx += 1;
      }
    });
    if (livePartial?.speaker && !map[livePartial.speaker]) {
      map[livePartial.speaker] = speakerPalette[idx % speakerPalette.length];
    }
    if (liveFinal?.speaker && !map[liveFinal.speaker]) {
      map[liveFinal.speaker] = speakerPalette[(idx + 1) % speakerPalette.length];
    }
    return map;
  }, [finalTranscript, liveFinal, livePartial, speakerPalette]);

  const recentFinal = useMemo(() => finalTranscript.slice(-10).reverse(), [finalTranscript]);
  const recentDiarization = useMemo(() => diarizationSegments.slice(-8).reverse(), [diarizationSegments]);
  const lastFrameLabel = useMemo(() => {
    if (feedStatus === 'error') return 'Frontend WS lỗi - thử kết nối lại';
    if (feedStatus === 'connecting' || feedStatus === 'idle') return 'Đang chờ bắt tay WebSocket';
    if (feedStatus === 'disabled') return 'Realtime WS đang tắt (USE_API=false)';
    if (!lastTranscriptAt) return 'Chưa nhận frame audio nào';
    return `Frame cuối: ${new Date(lastTranscriptAt).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  }, [feedStatus, lastTranscriptAt]);
  const partialText = livePartial?.text || 'Đang lắng nghe...';
  const finalText = liveFinal?.text || 'Chưa có final transcript.';

  return (
    <div className="transcript-panel transcript-panel--glass">
      <div className="transcript-grid transcript-grid--single">
        <div className="transcript-col transcript-col--main">
          <div className="transcript-header">
            <div className="transcript-title">
              <div className="transcript-title__icon">
                <Mic size={16} />
              </div>
              <div className="transcript-title__text">
                <div className="transcript-title__label">Live Transcript</div>
                <div className="transcript-title__meta">
                  <div className="transcript-title__sub">
                    <Clock size={12} />
                    Context cửa sổ 60s
                  </div>
                  <AudioStreamIndicator feedStatus={feedStatus} lastTranscriptAt={lastTranscriptAt} />
                </div>
              </div>
            </div>
          </div>

          <div className="transcript-setup">
            <div className="transcript-setup__meta">
              <div className="transcript-setup__label">Audio ingest</div>
              <div className="transcript-setup__status">
                <span className={`pill ${audioIngestToken ? 'pill--success' : 'pill--ghost'}`}>
                  {audioIngestToken ? 'Token sẵn sàng' : 'Chưa có token'}
                </span>
                {tokenError && <span className="pill pill--error">{tokenError}</span>}
              </div>
            </div>
            <div className="transcript-setup__actions">
              {!audioIngestToken && (
                <button
                  className="btn btn--primary btn--sm"
                  onClick={onFetchAudioToken}
                  disabled={isTokenLoading || !USE_API}
                >
                  {isTokenLoading ? 'Đang lấy token...' : 'Tạo token'}
                </button>
              )}
            </div>
            {joinPlatform === 'gomeet' && (
              <div className="form-hint" style={{ marginTop: 6 }}>
                GoMeet sẽ tự mở WebSocket và stream audio khi bạn bật mic.
              </div>
            )}
            {audioIngestToken && (
              <div className="transcript-setup__token" title={audioIngestToken}>
                token: {audioIngestToken}
              </div>
            )}
          </div>

          <div className="transcript-content transcript-content--padded">
            <div className="transcript-live-card">
              <div className="transcript-live-card__header">
                <div className="transcript-live-card__title">
                  <div className="pill pill--live pill--solid">
                    <span className="live-dot"></span>
                    SmartVoice API ...
                  </div>
                  <span className="pill pill--ghost">Realtime transcript</span>
                </div>
                <div className="transcript-live-card__meta">
                  <span className="transcript-live-card__count">Final đã lưu: {finalTranscriptCount}</span>
                </div>
              </div>
              <div className="transcript-live-group">
                <div className={`transcript-live-line ${livePartial ? '' : 'transcript-live-line--idle'}`}>
                  <div className="transcript-live-line__header">
                    <span className="transcript-live-line__tag">Partial</span>
                    <div className="transcript-live-line__meta">
                      <span style={{ color: livePartial ? speakerColors[livePartial.speaker] : undefined }}>
                        {livePartial ? livePartial.speaker : '—'}
                      </span>
                      {livePartial && <span>{formatDuration(livePartial.time || 0)}</span>}
                    </div>
                  </div>
                  <div className="transcript-live-line__text">{partialText}</div>
                </div>
                <div className={`transcript-live-line transcript-live-line--final ${liveFinal ? '' : 'transcript-live-line--idle'}`}>
                  <div className="transcript-live-line__header">
                    <span className="transcript-live-line__tag">Last final transcript</span>
                    <div className="transcript-live-line__meta">
                      <span style={{ color: liveFinal ? speakerColors[liveFinal.speaker] : undefined }}>
                        {liveFinal ? liveFinal.speaker : '—'}
                      </span>
                      {liveFinal && <span>{formatDuration(liveFinal.time || 0)}</span>}
                    </div>
                  </div>
                  <div className="transcript-live-line__text">{finalText}</div>
                </div>
              </div>
            </div>

            <div className="transcript-live-card" style={{ marginTop: 12 }}>
              <div className="transcript-live-card__header">
                <div className="transcript-live-card__title">
                  <div className="pill pill--ghost">Diarization timeline</div>
                  <span className="pill pill--accent">async</span>
                </div>
              </div>
              <div className="topic-log">
                {recentDiarization.length === 0 ? (
                  <div className="empty-state empty-state--inline">Chưa có segment nào.</div>
                ) : (
                  recentDiarization.map((item, idx) => (
                    <div key={`${item.speaker}-${idx}`} className="topic-log__item">
                      <span
                        className="topic-log__time"
                        style={{
                          color: speakerColors[item.speaker] || undefined,
                          minWidth: 90,
                        }}
                      >
                        {item.speaker}
                      </span>
                      <span className="topic-log__text">
                        [{formatDuration(item.start || 0)} - {formatDuration(item.end || 0)}]{' '}
                        conf={(item.confidence ?? 1).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="transcript-mini-status">
              <span className={`pill ws-chip ws-chip--${feedStatus}`}>
                Frontend WS · {feedStatus}
              </span>
              <span className="transcript-mini-status__meta">{lastFrameLabel}</span>
            </div>

            <div className="transcript-live-card">
              <div className="transcript-live-card__section">
                <div className="live-signal-label">Recent utterances</div>
                <div className="topic-log">
                  {recentFinal.length === 0 ? (
                    <div className="empty-state empty-state--inline">Chưa có câu final nào.</div>
                  ) : (
                    recentFinal.map(item => (
                      <div key={item.id} className="topic-log__item">
                        <span
                          className="topic-log__time"
                          style={{ color: speakerColors[item.speaker] || undefined, minWidth: 80 }}
                        >
                          {item.speaker}
                        </span>
                        <span className="topic-log__text">
                          [{formatDuration(item.time || 0)}] {item.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LiveSignalPanel = ({
  liveRecap,
  semanticIntent,
  currentTopicTitle,
  topicLog,
}: {
  liveRecap: string | null;
  semanticIntent: string;
  currentTopicTitle: string;
  topicLog: { id: string; time: string; text: string }[];
}) => {
  return (
    <div className="live-signal-card live-signal-card--stack">
      <div className="live-signal-card__header">
        <div className="badge badge--ghost badge--pill">
          <Sparkles size={14} />
          Live recap | Semantic Router
        </div>
        <span className="meta-chip">SmartBot VNPT</span>
      </div>

      <div className="live-signal-card__section live-signal-card__chat">
        <div className="live-signal-label">Recap</div>
        <div className="live-signal-bubble">
          <div className="live-signal-bubble__content">
            <p>{liveRecap || 'Chưa có recap.'}</p>
          </div>
        </div>
      </div>

      <div className="live-signal-card__section live-signal-card__inline">
        <div>
          <div className="live-signal-label">Intent</div>
          <div className="pill pill--live">{semanticIntent || 'NO_INTENT'}</div>
        </div>
        <div>
          <div className="live-signal-label">Topic</div>
          <div className="pill">{currentTopicTitle || 'T0'}</div>
        </div>
      </div>

      <div className="live-signal-card__section">
        <div className="live-signal-label">Topic log (3-5 phút)</div>
        <div className="topic-log">
          {topicLog.length === 0 ? (
            <div className="empty-state empty-state--inline">Chưa có topic log.</div>
          ) : (
            topicLog.map(item => (
              <div key={item.id} className="topic-log__item">
                <span className="topic-log__time">{item.time}</span>
                <span className="topic-log__text">{item.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const LiveRecapPanel = ({
  recapItems,
  currentTopicTitle,
}: {
  recapItems: RecapItem[];
  currentTopicTitle: string;
}) => {
  const topicLabel = currentTopicTitle || 'T0';

  return (
    <div className="recap-panel">
      <div className="recap-panel__header">
        <div className="badge badge--ghost badge--pill">
          <Sparkles size={14} />
          Current Recap
        </div>
        <span className="meta-chip">
          <Calendar size={12} />
          Topic: {topicLabel}
        </span>
      </div>
      <div className="recap-list">
        {recapItems.length === 0 ? (
          <div className="empty-state empty-state--inline">Chưa có recap.</div>
        ) : (
          recapItems.map(item => (
            <div key={item.id} className="recap-item">
              <div className="recap-item__time">{item.t}</div>
              <div className="recap-item__body">
                <div className="recap-item__topic">{item.topic || topicLabel}</div>
                <p>{item.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AdrPanel = ({
  actions,
  decisions: decisionItems,
  risks: riskItems,
}: {
  actions: AdrAction[];
  decisions: AdrDecision[];
  risks: AdrRisk[];
}) => {
  const [activeTab, setActiveTab] = useState<'actions' | 'decisions' | 'risks'>('actions');

  return (
    <div className="detected-panel detected-panel--elevated">
      <div className="detected-tabs detected-tabs--solid">
        <button
          className={`detected-tab ${activeTab === 'actions' ? 'detected-tab--active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          <CheckSquare size={14} />
          Actions ({actions.length})
        </button>
        <button
          className={`detected-tab ${activeTab === 'decisions' ? 'detected-tab--active' : ''}`}
          onClick={() => setActiveTab('decisions')}
        >
          <FileText size={14} />
          Decisions ({decisionItems.length})
        </button>
        <button
          className={`detected-tab ${activeTab === 'risks' ? 'detected-tab--active' : ''}`}
          onClick={() => setActiveTab('risks')}
        >
          <AlertTriangle size={14} />
          Risks ({riskItems.length})
        </button>
      </div>

      <div className="detected-content detected-content--dense">
        {activeTab === 'actions' && (
          actions.length > 0 ? (
            actions.map(item => (
              <div key={item.id} className="detected-item detected-item--action">
                <div className="detected-item__content">
                  <div className="detected-item__text">{item.description}</div>
                  {item.detail && <div className="detected-item__detail">{item.detail}</div>}
                  <div className="detected-item__meta">
                    <User size={12} />
                    {item.owner || 'Chưa gán'}
                    <span className="dot"></span>
                    <Clock size={12} />
                    {formatAdrDate(item.deadline)}
                  </div>
                </div>
                <div className="detected-item__actions">
                  <button className="btn btn--success btn--icon btn--sm">
                    <Check size={14} />
                  </button>
                  <button className="btn btn--ghost btn--icon btn--sm">
                    <Edit3 size={14} />
                  </button>
                  <button className="btn btn--ghost btn--icon btn--sm">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state empty-state--inline">Chưa có action nào.</div>
          )
        )}

        {activeTab === 'decisions' && (
          decisionItems.length > 0 ? (
            decisionItems.map(item => (
              <div key={item.id} className="detected-item detected-item--decision">
                <div className="detected-item__content">
                  <div className="detected-item__text">{item.description}</div>
                  {item.detail && <div className="detected-item__detail">{item.detail}</div>}
                  <div className="detected-item__meta">
                    <Check size={12} />
                    Xác nhận bởi {item.confirmedBy || 'SmartBot'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state empty-state--inline">Chưa có quyết định.</div>
          )
        )}

        {activeTab === 'risks' && (
          riskItems.length > 0 ? (
            riskItems.map(item => (
              <div
                key={item.id}
                className={`detected-item detected-item--risk detected-item--${item.severity || 'medium'}`}
              >
                <div className="detected-item__content">
                  <div className="detected-item__text">{item.description}</div>
                  {item.detail && <div className="detected-item__detail">{item.detail}</div>}
                  <span className={`badge badge--${item.severity === 'high' ? 'error' : 'warning'}`}>
                    {item.severity || 'medium'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state empty-state--inline">Chưa có rủi ro.</div>
          )
        )}
      </div>
    </div>
  );
};

const ToolSuggestionsPanel = () => {
  const suggestions = [
    {
      id: 'ts1',
      type: 'task',
      title: 'Tạo task Jira: Penetration Test follow-up',
      detail: 'Owner: Hoàng Thị E · Due: 12/12 · Priority: High',
      actionLabel: 'Tạo task',
    },
    {
      id: 'ts2',
      type: 'schedule',
      title: 'Đặt lịch follow-up performance review',
      detail: '30 phút, tuần này, mời PMO + Core Banking',
      actionLabel: 'Đặt lịch',
    },
    {
      id: 'ts3',
      type: 'doc',
      title: 'Mở tài liệu: NHNN Circular 09/2020',
      detail: 'Trang 12: Data retention policy',
      actionLabel: 'Mở tài liệu',
    },
  ];

  return (
    <div className="tool-panel">
      <div className="tool-panel__header">
        <div className="badge badge--ghost badge--pill">
          <Wand2 size={14} />
          Tool suggestions
        </div>
        <span className="meta-chip">
          <LinkIcon size={12} />
          Planner / Calendar / Docs
        </span>
      </div>
      <div className="tool-panel__list">
        {suggestions.map(s => (
          <div key={s.id} className="tool-card">
            <div className="tool-card__icon">
              {s.type === 'task' && <CheckSquare size={14} />}
              {s.type === 'schedule' && <Calendar size={14} />}
              {s.type === 'doc' && <FileText size={14} />}
            </div>
            <div className="tool-card__body">
              <div className="tool-card__title">{s.title}</div>
              <div className="tool-card__detail">{s.detail}</div>
            </div>
            <div className="tool-card__actions">
              <button className="btn btn--primary btn--sm">{s.actionLabel}</button>
              <button className="btn btn--ghost btn--icon btn--sm">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InMeetTab;
