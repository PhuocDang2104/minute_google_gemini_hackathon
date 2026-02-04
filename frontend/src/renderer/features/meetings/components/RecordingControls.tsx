import { useState, useCallback } from 'react';
import { Mic, Square, Pause, Play } from 'lucide-react';
import Button from '../../../components/ui/button';
import { useRecordingState } from '../../../contexts/RecordingStateContext';
import { recordingService } from '../../../services/recordingService';

export const RecordingControls = () => {
    const { isRecording, isPaused, status } = useRecordingState();
    const [duration, setDuration] = useState(0);

    // Simple timer (mock)
    // In real implementation, sync with recordingService's duration

    const [includeSystemAudio, setIncludeSystemAudio] = useState(false);

    const handleStart = useCallback(() => {
        recordingService.startRecording({ useSystemAudio: includeSystemAudio });
    }, [includeSystemAudio]);

    const handleStop = useCallback(() => {
        recordingService.stopRecording().then(blob => {
            console.log('Recording stopped, blob size:', blob.size);
        });
    }, []);

    const handlePause = useCallback(() => recordingService.pauseRecording(), []);
    const handleResume = useCallback(() => recordingService.resumeRecording(), []);

    return (
        <div className="recording-controls" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)'
        }}>
            {!isRecording ? (
                <>
                    <Button onClick={handleStart} variant="primary" style={{ borderRadius: '50%', width: 50, height: 50, padding: 0 }}>
                        <Mic size={24} />
                    </Button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={includeSystemAudio}
                            onChange={e => setIncludeSystemAudio(e.target.checked)}
                            style={{ width: 16, height: 16 }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>Thu âm hệ thống</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cần share tab/screen</span>
                        </div>
                    </label>
                </>
            ) : (
                <>
                    <div className="recording-timer" style={{
                        fontFamily: 'monospace',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--error)'
                    }}>
                        Rec ●
                    </div>

                    {isPaused ? (
                        <Button onClick={handleResume} style={{ borderRadius: '50%', width: 40, height: 40, padding: 0 }}>
                            <Play size={20} />
                        </Button>
                    ) : (
                        <Button onClick={handlePause} style={{ borderRadius: '50%', width: 40, height: 40, padding: 0 }}>
                            <Pause size={20} />
                        </Button>
                    )}

                    <Button onClick={handleStop} style={{ borderRadius: '50%', width: 40, height: 40, padding: 0, background: 'var(--error)', color: 'white' }}>
                        <Square size={20} />
                    </Button>
                </>
            )}
        </div>
    );
};
