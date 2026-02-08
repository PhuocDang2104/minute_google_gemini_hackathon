import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, Mic, ScreenShare, Video, X } from 'lucide-react';
import { InMeetTab } from '../../../features/meetings/components/tabs/InMeetTab';
import { meetingsApi } from '../../../lib/api/meetings';
import { sessionsApi } from '../../../lib/api/sessions';
import type { MeetingWithParticipants } from '../../../shared/dto/meeting';
import { useChatContext } from '../../../contexts/ChatContext';
import { API_URL, USE_API } from '../../../config/env';

const TARGET_SAMPLE_RATE = 16000;
const DEFAULT_FRAME_MS = 250;
const RECORDING_TIMESLICE_MS = 1500;

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (_err) {
    return null;
  }
};

const MeetingDock = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionFromQuery = searchParams.get('session');
  const linkFromQuery = searchParams.get('link');
  const platformFromQuery = searchParams.get('platform');
  const tokenFromQuery = searchParams.get('token') || '';

  const [meeting, setMeeting] = useState<MeetingWithParticipants | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinLink, setJoinLink] = useState('');
  const [joinPlatform, setJoinPlatform] = useState<'gomeet' | 'gmeet'>('gomeet');
  const [streamSessionId, setStreamSessionId] = useState<string>(sessionFromQuery || meetingId || '');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'starting' | 'streaming' | 'error'>('idle');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioInfo, setAudioInfo] = useState<string | null>(null);
  const [audioToken, setAudioToken] = useState('');
  const [isAudioTokenLoading, setIsAudioTokenLoading] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'saving' | 'saved' | 'error'>('idle');
  const [recordingInfo, setRecordingInfo] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioWsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioPendingRef = useRef<number[]>([]);
  const audioStartAckRef = useRef(false);
  const autoPreviewRef = useRef(false);
  const frameSamplesRef = useRef(Math.round((TARGET_SAMPLE_RATE * DEFAULT_FRAME_MS) / 1000));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const uploadInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const { setOverride, clearOverride } = useChatContext();

  const wsBase = useMemo(() => {
    if (API_URL.startsWith('https://')) return API_URL.replace(/^https:/i, 'wss:').replace(/\/$/, '');
    if (API_URL.startsWith('http://')) return API_URL.replace(/^http:/i, 'ws:').replace(/\/$/, '');
    return API_URL.replace(/\/$/, '');
  }, []);

  const audioWsUrl = useMemo(() => {
    if (!streamSessionId) return '';
    return `${wsBase}/api/v1/ws/audio/${streamSessionId}`;
  }, [streamSessionId, wsBase]);

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await meetingsApi.get(meetingId);
      setMeeting(data);
      setJoinLink(linkFromQuery || data.teams_link || '');
      setStreamSessionId(prev => prev || sessionFromQuery || data.id);
    } catch (err) {
      console.error('Failed to fetch meeting for dock view:', err);
      setError('Không thể tải cuộc họp (dock view).');
    } finally {
      setIsLoading(false);
    }
  }, [linkFromQuery, meetingId, sessionFromQuery]);

  const uploadSessionRecording = useCallback(
    async (blob: Blob) => {
      if (!meetingId || uploadInFlightRef.current || blob.size === 0) return;
      uploadInFlightRef.current = true;
      setRecordingState('saving');
      setRecordingError(null);
      setRecordingInfo('Đang lưu recording lên backend...');
      try {
        const file = new File([blob], `meeting-${meetingId}-${Date.now()}.webm`, {
          type: blob.type || 'video/webm',
        });
        await meetingsApi.uploadVideo(meetingId, file);
        await fetchMeeting();
        if (mountedRef.current) {
          setRecordingState('saved');
          setRecordingInfo('Đã lưu recording. Post-meet đã có video.');
        }
      } catch (err) {
        console.error('Failed to upload live recording:', err);
        if (mountedRef.current) {
          setRecordingState('error');
          setRecordingError('Không lưu được recording lên backend.');
        }
      } finally {
        uploadInFlightRef.current = false;
      }
    },
    [fetchMeeting, meetingId],
  );

  const stopSessionRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const startSessionRecording = useCallback(
    (stream: MediaStream) => {
      if (!meetingId || meeting?.recording_url) return;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;
      if (typeof MediaRecorder === 'undefined') {
        setRecordingState('error');
        setRecordingError('Trình duyệt không hỗ trợ MediaRecorder.');
        return;
      }

      try {
        const mimeCandidates = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];
        let mimeType = '';
        for (const candidate of mimeCandidates) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recordingChunksRef.current = [];
        recorder.ondataavailable = evt => {
          if (evt.data && evt.data.size > 0) {
            recordingChunksRef.current.push(evt.data);
          }
        };
        recorder.onstop = () => {
          const parts = recordingChunksRef.current;
          recordingChunksRef.current = [];
          mediaRecorderRef.current = null;
          if (parts.length === 0) {
            setRecordingState('idle');
            setRecordingInfo(null);
            return;
          }
          const blob = new Blob(parts, { type: recorder.mimeType || 'video/webm' });
          void uploadSessionRecording(blob);
        };
        recorder.onerror = evt => {
          console.error('MediaRecorder error:', evt);
          setRecordingState('error');
          setRecordingError('Lỗi ghi lại phiên họp trên trình duyệt.');
        };
        recorder.start(RECORDING_TIMESLICE_MS);
        mediaRecorderRef.current = recorder;
        setRecordingState('recording');
        setRecordingError(null);
        setRecordingInfo('Đang live record (video + audio) song song minute ASR.');
      } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
        setRecordingState('error');
        setRecordingError('Không khởi tạo được recorder cho phiên họp.');
      }
    },
    [meeting?.recording_url, meetingId, uploadSessionRecording],
  );

  const stopAudioCapture = useCallback((message?: string) => {
    if (audioWsRef.current) {
      audioWsRef.current.onclose = null;
      audioWsRef.current.onerror = null;
      audioWsRef.current.onmessage = null;
      audioWsRef.current.close();
      audioWsRef.current = null;
    }
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current.onaudioprocess = null;
      audioProcessorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    audioPendingRef.current = [];
    audioStartAckRef.current = false;
    setAudioStatus(message ? 'error' : 'idle');
    setAudioError(message || null);
    if (!message) {
      setAudioInfo(null);
    }
  }, []);

  const stopPreview = useCallback((message?: string) => {
    stopSessionRecording();
    setPreviewStream(prev => {
      if (prev) {
        prev.getTracks().forEach(track => track.stop());
      }
      return null;
    });
    stopAudioCapture(message);
  }, [stopAudioCapture, stopSessionRecording]);

  useEffect(() => {
    if (platformFromQuery === 'gmeet') {
      setJoinPlatform('gmeet');
    }
  }, [platformFromQuery]);

  useEffect(() => {
    setAudioToken(tokenFromQuery);
  }, [tokenFromQuery]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    document.body.classList.add('sidecar-mode');
    return () => document.body.classList.remove('sidecar-mode');
  }, []);

  useEffect(() => {
    const videoEl = previewVideoRef.current;
    if (!videoEl) return;
    if (previewStream) {
      videoEl.srcObject = previewStream;
      const playPromise = videoEl.play();
      if (playPromise) {
        playPromise.catch(() => undefined);
      }
    } else {
      videoEl.srcObject = null;
    }
  }, [previewStream]);

  useEffect(() => {
    if (!previewStream) return;
    const track = previewStream.getVideoTracks()[0];
    if (!track) return;
    const handleEnded = () => {
      stopPreview('Đã dừng chia sẻ tab.');
    };
    track.addEventListener('ended', handleEnded);
    return () => {
      track.removeEventListener('ended', handleEnded);
    };
  }, [previewStream, stopPreview]);

  useEffect(() => {
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }
      stopSessionRecording();
    };
  }, [previewStream, stopSessionRecording]);

  useEffect(() => {
    return () => {
      stopSessionRecording();
      stopAudioCapture();
    };
  }, [stopAudioCapture, stopSessionRecording]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  useEffect(() => {
    if (!meeting?.recording_url) return;
    setRecordingState('saved');
    setRecordingError(null);
    setRecordingInfo('Recording final đã có trên post-meet.');
  }, [meeting?.recording_url]);

  useEffect(() => {
    if (!meeting) return;
    setOverride({
      scope: 'meeting',
      meetingId: meeting.id,
      phase: 'in',
      title: meeting.title,
    });
  }, [meeting?.id, meeting?.title, setOverride]);

  useEffect(() => {
    return () => clearOverride();
  }, [clearOverride]);

  const ensureAudioToken = useCallback(async () => {
    if (audioToken) {
      const payload = decodeJwtPayload(audioToken);
      const tokenSessionId = typeof payload?.session_id === 'string' ? payload.session_id : null;
      if (!tokenSessionId || tokenSessionId === streamSessionId) {
        return audioToken;
      }
      setAudioInfo('Token audio không khớp session hiện tại, đang lấy token mới...');
    }
    if (!streamSessionId) {
      setAudioStatus('error');
      setAudioError('Thiếu session_id để capture audio.');
      return '';
    }
    if (!USE_API) {
      setAudioStatus('error');
      setAudioError('USE_API=false: không thể lấy audio_ingest_token.');
      return '';
    }
    setIsAudioTokenLoading(true);
    setAudioError(null);
    try {
      const res = await sessionsApi.registerSource(streamSessionId);
      setAudioToken(res.audio_ingest_token);
      setAudioInfo(`Token audio mới (TTL ${res.token_ttl_seconds}s).`);
      return res.audio_ingest_token;
    } catch (err) {
      console.error('Failed to fetch audio_ingest_token', err);
      setAudioStatus('error');
      setAudioError('Không lấy được audio_ingest_token. Kiểm tra backend /sessions/{id}/sources.');
      return '';
    } finally {
      setIsAudioTokenLoading(false);
    }
  }, [audioToken, streamSessionId]);

  const startAudioCapture = useCallback(async (stream: MediaStream) => {
    if (joinPlatform !== 'gmeet') return;
    if (!streamSessionId) {
      setAudioStatus('error');
      setAudioError('Thiếu session_id để capture audio.');
      return;
    }
    if (!USE_API) {
      setAudioStatus('error');
      setAudioError('USE_API=false: không thể mở WS audio ingest.');
      return;
    }

    const token = await ensureAudioToken();
    if (!token) return;

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      setAudioStatus('error');
      setAudioError('Chưa bật "Share tab audio". Hãy chọn lại tab và tick audio.');
      return;
    }

    stopAudioCapture();
    setAudioStatus('starting');
    setAudioError(null);
    setAudioInfo('Đang kết nối audio ingest...');
    audioStartAckRef.current = false;

    const wsUrl = `${audioWsUrl}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    audioWsRef.current = ws;

    const startAudioPipeline = async () => {
      try {
        const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
        audioCtxRef.current = ctx;
        await ctx.resume();
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        audioProcessorRef.current = processor;
        audioPendingRef.current = [];

        processor.onaudioprocess = event => {
          if (!audioStartAckRef.current) return;
          const input = event.inputBuffer.getChannelData(0);
          const pending = audioPendingRef.current;
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
            }
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        audioTracks[0].onended = () => stopAudioCapture('Tab audio đã dừng.');
        setAudioStatus('streaming');
        setAudioInfo('Đang stream audio tab vào batch recorder (ASR mỗi 30 giây).');
      } catch (err) {
        console.error('AudioContext init failed', err);
        stopAudioCapture('Không khởi tạo được AudioContext để lấy audio tab.');
      }
    };

    ws.onmessage = evt => {
      if (typeof evt.data !== 'string') return;
      try {
        const data = JSON.parse(evt.data);
        if (data?.event === 'audio_start_ack') {
          if (!audioStartAckRef.current) {
            audioStartAckRef.current = true;
            setAudioInfo('Audio start đã được backend xác nhận.');
            startAudioPipeline();
          }
          return;
        }
        if (data?.event === 'error') {
          const message = data?.message ? String(data.message) : 'WS audio ingest lỗi.';
          stopAudioCapture(message);
          return;
        }
      } catch (_err) {
        // ignore non-JSON messages
      }
    };

    ws.onopen = () => {
      const startMsg = {
        type: 'start',
        platform: 'browser_tab',
        platform_meeting_ref: meetingId || streamSessionId || undefined,
        audio: { codec: 'PCM_S16LE', sample_rate_hz: TARGET_SAMPLE_RATE, channels: 1 },
        language_code: 'vi-VN',
        frame_ms: DEFAULT_FRAME_MS,
        stream_id: `tab_${Date.now()}`,
        client_ts_ms: Date.now(),
      };
      ws.send(JSON.stringify(startMsg));
      setAudioInfo('Đã gửi start, chờ backend xác nhận...');
    };

    ws.onerror = evt => {
      console.error('Audio WS error', evt);
      stopAudioCapture('WS audio ingest lỗi. Kiểm tra token/session.');
    };

    ws.onclose = evt => {
      const reason = evt.reason ? `, reason: ${evt.reason}` : '';
      stopAudioCapture(`WS audio đã đóng (code ${evt.code}${reason}).`);
    };
  }, [audioWsUrl, ensureAudioToken, joinPlatform, meetingId, streamSessionId, stopAudioCapture]);

  const handleEndMeeting = async () => {
    if (!meetingId) return;
    try {
      stopPreview();
      await meetingsApi.updatePhase(meetingId, 'post');
      await fetchMeeting();
    } catch (err) {
      console.error('Failed to end meeting:', err);
      setError('Không kết thúc được cuộc họp.');
    }
  };

  const handleOpenJoinLink = () => {
    if (!joinLink) return;
    window.open(joinLink, '_blank', 'noopener,noreferrer');
  };

  const handleStopPreview = useCallback(() => {
    stopPreview();
  }, [stopPreview]);

  const handleSelectPreview = useCallback(async () => {
    setPreviewError(null);
    setAudioError(null);
    setAudioInfo(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setPreviewError('Trình duyệt không hỗ trợ chia sẻ màn hình.');
      return;
    }
    setIsPreviewLoading(true);
    try {
      const shouldCaptureAudio = joinPlatform === 'gmeet';
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: shouldCaptureAudio ? { channelCount: 1, sampleRate: TARGET_SAMPLE_RATE } : false,
      });
      setPreviewStream(prev => {
        if (prev) {
          prev.getTracks().forEach(track => track.stop());
        }
        return stream;
      });
      startSessionRecording(stream);
      if (shouldCaptureAudio) {
        await startAudioCapture(stream);
      } else {
        stopAudioCapture();
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'NotAllowedError') {
        setPreviewError('Bạn đã hủy chọn tab.');
      } else {
        setPreviewError('Không thể lấy nội dung tab/màn hình.');
      }
    } finally {
      setIsPreviewLoading(false);
    }
  }, [joinPlatform, startAudioCapture, startSessionRecording, stopAudioCapture]);

  useEffect(() => {
    if (autoPreviewRef.current) return;
    if (joinPlatform !== 'gmeet') return;
    if (!streamSessionId) return;
    if (previewStream || isPreviewLoading) return;
    autoPreviewRef.current = true;
    handleSelectPreview();
  }, [handleSelectPreview, isPreviewLoading, joinPlatform, previewStream, streamSessionId]);

  if (isLoading) {
    return (
      <div className="meeting-detail-loading">
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
        <p>Đang mở Dock in-meeting...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="empty-state">
        <AlertCircle className="empty-state__icon" />
        <h3 className="empty-state__title">{error || 'Không tìm thấy cuộc họp'}</h3>
        <button className="btn btn--secondary" onClick={() => navigate('/app/meetings')}>
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const previewTitle = joinPlatform === 'gmeet'
    ? 'Chọn tab chia sẻ (kèm âm thanh)'
    : 'Chọn tab chia sẻ';
  const previewLabel = joinPlatform === 'gmeet'
    ? 'Chọn tab + âm thanh'
    : 'Chọn tab';
  const previewSwitchLabel = joinPlatform === 'gmeet'
    ? 'Đổi tab + âm thanh'
    : 'Đổi tab';
  const previewActionLabel = previewStream ? previewSwitchLabel : previewLabel;
  const previewHint = joinPlatform === 'gmeet'
    ? 'Bấm “Chọn tab + âm thanh” và tick "Share tab audio" trong Chrome.'
    : 'Bấm “Chọn tab” để mở hộp thoại chọn Tab / Window / Screen.';
  const audioStatusLabel = joinPlatform === 'gmeet'
    ? (audioInfo || (audioStatus === 'streaming'
        ? 'Đang capture audio tab'
        : audioStatus === 'starting'
        ? 'Đang kết nối audio ingest...'
        : audioStatus === 'error'
        ? 'Capture audio gặp lỗi'
        : isAudioTokenLoading
        ? 'Đang lấy audio token...'
        : 'Sẵn sàng capture audio'))
    : '';
  const recordingStatusLabel =
    recordingState === 'recording'
      ? 'Đang live record'
      : recordingState === 'saving'
      ? 'Đang lưu recording'
      : recordingState === 'saved'
      ? 'Recording đã lưu'
      : recordingState === 'error'
      ? 'Live record gặp lỗi'
      : 'Live record chưa bật';

  return (
    <div className="sidecar-dock">
      <div className="sidecar-preview">
        <div className="sidecar-preview__card">
          <div className="sidecar-preview__header">
            <div className="sidecar-preview__title">
              <ScreenShare size={16} />
              {previewTitle}
            </div>
            <div className="sidecar-preview__actions">
              <button className="btn btn--secondary btn--sm" onClick={handleSelectPreview} disabled={isPreviewLoading}>
                {isPreviewLoading ? 'Đang mở...' : previewActionLabel}
              </button>
              {previewStream && (
                <button className="btn btn--ghost btn--sm" onClick={handleStopPreview}>
                  <X size={14} />
                  Dừng xem
                </button>
              )}
            </div>
          </div>
          <div className="sidecar-preview__body">
            {previewStream ? (
              <div className="sidecar-preview__content">
                <video ref={previewVideoRef} className="sidecar-preview__video" autoPlay muted playsInline />
                {joinPlatform === 'gmeet' && (
                  <div className="sidecar-preview__note">
                    <Mic size={14} />
                    <span>{audioStatusLabel}</span>
                    {audioError && <span className="sidecar-preview__error">{audioError}</span>}
                  </div>
                )}
                <div className="sidecar-preview__note">
                  <Video size={14} />
                  <span>{recordingStatusLabel}</span>
                  {recordingError && <span className="sidecar-preview__error">{recordingError}</span>}
                  {!recordingError && recordingInfo && (
                    <span className="sidecar-preview__hint">{recordingInfo}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="sidecar-preview__placeholder">
                <p>Chưa có tab nào được chọn.</p>
                <span className="sidecar-preview__hint">{previewHint}</span>
                {previewError && <span className="sidecar-preview__error">{previewError}</span>}
                {!previewError && audioError && <span className="sidecar-preview__error">{audioError}</span>}
                {!previewError && !audioError && recordingError && (
                  <span className="sidecar-preview__error">{recordingError}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sidecar-page">
        <div className="sidecar-header">
          <div className="sidecar-header__left">
            <div className="sidecar-header__info">
              <div className="sidecar-header__eyebrow">Dock in-meeting</div>
              <h2 className="sidecar-header__title">{meeting.title}</h2>
            </div>
          </div>
          <div className="sidecar-header__actions">
            <button className="btn btn--secondary" onClick={handleSelectPreview} disabled={isPreviewLoading}>
              <ScreenShare size={14} />
              {isPreviewLoading ? 'Đang mở...' : previewActionLabel}
            </button>
            {previewStream && (
              <button className="btn btn--ghost" onClick={handleStopPreview}>
                <X size={14} />
                Dừng xem
              </button>
            )}
            {joinLink && (
              <button className="btn btn--primary" onClick={handleOpenJoinLink}>
                <Video size={14} />
                Mở link họp
              </button>
            )}
          </div>
        </div>

        <div className="sidecar-body">
          <InMeetTab
            meeting={meeting}
            joinPlatform={joinPlatform}
            streamSessionId={streamSessionId || meeting.id}
            initialAudioIngestToken={audioToken || undefined}
            onRefresh={fetchMeeting}
            onEndMeeting={handleEndMeeting}
          />
        </div>
      </div>
    </div>
  );
};

export default MeetingDock;
