import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Info,
  Mic,
  Play,
  RefreshCw,
  StopCircle,
} from 'lucide-react';
import { sessionsApi } from '../../../lib/api/sessions';
import { API_URL, USE_API } from '../../../config/env';

type CaptureStatus = 'idle' | 'starting' | 'streaming' | 'error';

const TARGET_SAMPLE_RATE = 16000;
const DEFAULT_FRAME_MS = 250;
const MIN_FRAME_MS = 250;
const MAX_FRAME_MS = 1000;

const MeetingCapture = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState(() => searchParams.get('session') || meetingId || '');
  const [audioToken, setAudioToken] = useState(() => searchParams.get('token') || '');
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>('Chọn Chrome Tab và tick "Share tab audio" khi bấm Start.');
  const [framesSent, setFramesSent] = useState(0);
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [frameMs, setFrameMs] = useState(DEFAULT_FRAME_MS);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const pendingRef = useRef<number[]>([]);
  const startAckRef = useRef(false);
  const frameMsRef = useRef(DEFAULT_FRAME_MS);
  const frameSamplesRef = useRef(Math.round((TARGET_SAMPLE_RATE * DEFAULT_FRAME_MS) / 1000));

  const applyFrameMs = (nextMs: number) => {
    const clamped = Math.min(Math.max(Math.round(nextMs), MIN_FRAME_MS), MAX_FRAME_MS);
    frameMsRef.current = clamped;
    frameSamplesRef.current = Math.max(1, Math.round((TARGET_SAMPLE_RATE * clamped) / 1000));
    setFrameMs(clamped);
    return clamped;
  };

  const wsBase = useMemo(() => {
    if (API_URL.startsWith('https://')) return API_URL.replace(/^https:/i, 'wss:').replace(/\/$/, '');
    if (API_URL.startsWith('http://')) return API_URL.replace(/^http:/i, 'ws:').replace(/\/$/, '');
    return API_URL.replace(/\/$/, '');
  }, []);
  const audioWsUrl = useMemo(() => {
    if (!sessionId) return '';
    return `${wsBase}/api/v1/ws/audio/${sessionId}`;
  }, [sessionId, wsBase]);

  const fetchToken = async () => {
    if (!sessionId) {
      setError('Cần session_id để lấy audio_ingest_token.');
      return;
    }
    if (!USE_API) {
      setError('USE_API=false: không gọi được backend để lấy token.');
      return;
    }
    setIsFetchingToken(true);
    setError(null);
    try {
      const res = await sessionsApi.registerSource(sessionId);
      setAudioToken(res.audio_ingest_token);
      setInfo(`Token mới lấy từ backend (TTL ${res.token_ttl_seconds}s).`);
    } catch (err) {
      console.error('Failed to fetch audio_ingest_token', err);
      setError('Không lấy được audio_ingest_token. Kiểm tra backend /sessions/{id}/sources.');
    } finally {
      setIsFetchingToken(false);
    }
  };

  const stopCapture = (message?: string) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => { });
      ctxRef.current = null;
    }
    if (mediaRef.current) {
      mediaRef.current.getTracks().forEach(t => t.stop());
      mediaRef.current = null;
    }
    pendingRef.current = [];
    startAckRef.current = false;
    setStatus(message ? 'error' : 'idle');
    setError(message || null);
  };

  useEffect(() => {
    return () => stopCapture();
  }, []);

  const startCapture = async () => {
    if (!sessionId || !audioToken) {
      setError('Cần session_id và audio_ingest_token.');
      return;
    }
    if (!USE_API) {
      setError('USE_API=false: không thể mở WS audio ingest.');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Browser không hỗ trợ getDisplayMedia.');
      return;
    }

    stopCapture();
    applyFrameMs(DEFAULT_FRAME_MS);
    startAckRef.current = false;
    setStatus('starting');
    setError(null);
    setInfo('Hãy chọn Chrome Tab và tick "Share tab audio".');
    setFramesSent(0);
    setLastFrameAt(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
        },
      });
    } catch (_err) {
      setStatus('error');
      setError('Không mở được picker chia sẻ (hãy thử lại và chọn Chrome Tab).');
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      stopCapture('You didn’t tick Share tab audio. Stop and Start again.');
      return;
    }

    mediaRef.current = stream;

    const wsUrl = `${audioWsUrl}?token=${audioToken}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    const startAudioPipeline = async () => {
      try {
        const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
        ctxRef.current = ctx;
        await ctx.resume();
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        pendingRef.current = [];

        processor.onaudioprocess = event => {
          if (!startAckRef.current) return;
          const input = event.inputBuffer.getChannelData(0);
          const pending = pendingRef.current;
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pending.push(s * 0x7fff);
          }
          while (pending.length >= frameSamplesRef.current) {
            const frameSamples = frameSamplesRef.current;
            const frame = pending.splice(0, frameSamples);
            const buf = new ArrayBuffer(frameSamples * 2);
            const view = new DataView(buf);
            for (let i = 0; i < frameSamples; i++) {
              view.setInt16(i * 2, frame[i], true);
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(buf);
              setFramesSent(prev => prev + 1);
              setLastFrameAt(Date.now());
            }
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        audioTracks[0].onended = () => stopCapture('Tab audio stream đã dừng.');
        setStatus('streaming');
        setInfo(`Đang stream 16kHz mono PCM S16LE (${frameMsRef.current}ms/frame) lên minute-recorder (batch ASR 1 phút).`);
      } catch (err) {
        console.error('AudioContext init failed', err);
        stopCapture('Không khởi tạo được AudioContext để lấy audio tab.');
      }
    };

    ws.onmessage = evt => {
      if (typeof evt.data !== 'string') return;
      try {
        const data = JSON.parse(evt.data);
        if (data?.event === 'audio_start_ack') {
          if (!startAckRef.current) {
            startAckRef.current = true;
            setInfo('Audio start đã được backend xác nhận.');
            startAudioPipeline();
          }
          return;
        }
        if (data?.event === 'error') {
          const message = data?.message ? String(data.message) : 'WS audio ingest lỗi.';
          stopCapture(message);
          return;
        }
        if (data?.event === 'stt_disabled') {
          setInfo('STT đang tắt ở backend.');
          return;
        }
        if (data?.event === 'throttle') {
          const suggested = Number(data?.suggested_frame_ms);
          if (Number.isFinite(suggested) && suggested > 0) {
            const applied = applyFrameMs(suggested);
            setInfo(`Backend báo throttle, tăng frame lên ${applied}ms để giảm nghẽn.`);
          } else {
            setInfo('Backend báo throttle, giảm tốc độ gửi audio.');
          }
        }
      } catch (_err) {
        // ignore non-JSON messages
      }
    };

    ws.onopen = () => {
      const startMsg = {
        type: 'start',
        platform: 'browser_tab',
        platform_meeting_ref: meetingId || sessionId || undefined,
        audio: { codec: 'PCM_S16LE', sample_rate_hz: TARGET_SAMPLE_RATE, channels: 1 },
        language_code: 'vi-VN',
        frame_ms: frameMsRef.current,
        stream_id: `tab_${Date.now()}`,
        client_ts_ms: Date.now(),
      };
      ws.send(JSON.stringify(startMsg));
      setInfo('Đã gửi start, chờ backend xác nhận audio_start_ack...');
    };

    ws.onerror = evt => {
      console.error('Audio WS error', evt);
      stopCapture('WS audio ingest lỗi. Kiểm tra token/session.');
    };
    ws.onclose = evt => {
      const reason = evt.reason ? `, reason: ${evt.reason}` : '';
      stopCapture(`WS audio đã đóng (code ${evt.code}${reason}).`);
    };
  };

  const statusLabel = () => {
    switch (status) {
      case 'starting':
        return 'Đang chuẩn bị...';
      case 'streaming':
        return 'Đang stream';
      case 'error':
        return 'Lỗi';
      default:
        return 'Sẵn sàng';
    }
  };

  return (
    <div className="capture-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Minute Capture</h1>
          <p className="page-header__subtitle">
            Lấy audio từ Chrome Tab (Google Meet / Teams web / Zoom web) và stream tới minute-recorder (batch ASR).
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--ghost" onClick={() => navigate(meetingId ? `/app/meetings/${meetingId}/detail` : '/app/meetings')}>
            <ArrowLeft size={16} />
            Quay lại cuộc họp
          </button>
        </div>
      </div>

      <div className="capture-grid">
        <div className="capture-card">
          <div className="capture-card__header">
            <div className={`capture-status capture-status--${status}`}>
              {status === 'streaming' ? <Activity size={16} /> : <Mic size={16} />}
              <span>{statusLabel()}</span>
            </div>
            {lastFrameAt && (
              <div className="pill pill--ghost">
                Frame cuối: {new Date(lastFrameAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>

          <div className="capture-form">
            <label className="form-label">Session ID</label>
            <input
              type="text"
              className="form-input"
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              placeholder="session_id (trùng với meeting hoặc session realtime)"
            />
          </div>
          <div className="capture-form">
            <label className="form-label">audio_ingest_token</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="form-input"
                value={audioToken}
                onChange={e => setAudioToken(e.target.value)}
                placeholder="Token từ /sessions/{id}/sources"
              />
              <button className="btn btn--secondary" onClick={fetchToken} disabled={isFetchingToken}>
                {isFetchingToken ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Lấy token
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert--error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {info && !error && (
            <div className="alert alert--info">
              <Info size={16} />
              {info}
            </div>
          )}

          <div className="capture-actions">
            <button className="btn btn--primary" onClick={startCapture} disabled={status === 'streaming'}>
              <Play size={16} />
              Start
            </button>
            <button className="btn btn--error" onClick={() => stopCapture()} disabled={status === 'idle'}>
              <StopCircle size={16} />
              Stop
            </button>
            <div className="capture-metrics">
              <span className="pill pill--ghost">Frames: {framesSent}</span>
              <span className="pill pill--ghost">Frame: {frameMs}ms</span>
              <span className="pill pill--ghost">Sample rate: 16kHz mono PCM_S16LE</span>
            </div>
          </div>
        </div>

        <div className="capture-card capture-card--secondary">
          <div className="capture-card__header">
            <CheckCircle size={16} />
            Checklist chia sẻ Chrome Tab
          </div>
          <ol className="capture-steps">
            <li>Mở tab họp (Google Meet / Teams web / Zoom web) ở Chrome.</li>
            <li>Mở trang Minute Capture ở tab khác (tab này).</li>
            <li>Bấm Start → chọn &quot;Chrome Tab&quot; trong picker.</li>
            <li>Tick &quot;Share tab audio&quot; trước khi bấm Share.</li>
            <li>Khi muốn dừng, bấm Stop hoặc Stop sharing ở thanh Chrome.</li>
          </ol>
          <div className="capture-note">
            <AlertCircle size={14} />
            Nếu stream không có audio track, Minute sẽ báo: &quot;You didn’t tick Share tab audio. Stop and Start again.&quot;
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingCapture;
