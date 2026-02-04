import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { recordingService } from '../services/recordingService';

export enum RecordingStatus {
    IDLE = 'idle',
    STARTING = 'starting',
    RECORDING = 'recording',
    STOPPING = 'stopping',
    PROCESSING_TRANSCRIPTS = 'processing',
    SAVING = 'saving',
    COMPLETED = 'completed',
    ERROR = 'error'
}

interface RecordingState {
    isRecording: boolean;
    isPaused: boolean;
    isActive: boolean;
    status: RecordingStatus;
    statusMessage?: string;
}

interface RecordingStateContextType extends RecordingState {
    setStatus: (status: RecordingStatus, message?: string) => void;
    isStopping: boolean;
    isProcessing: boolean;
    isSaving: boolean;
}

const RecordingStateContext = createContext<RecordingStateContextType | null>(null);

export const useRecordingState = () => {
    const context = useContext(RecordingStateContext);
    if (!context) {
        throw new Error('useRecordingState must be used within a RecordingStateProvider');
    }
    return context;
};

export function RecordingStateProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<RecordingState>({
        isRecording: false,
        isPaused: false,
        isActive: false,
        status: RecordingStatus.IDLE,
        statusMessage: undefined,
    });

    const setStatus = useCallback((status: RecordingStatus, message?: string) => {
        setState(prev => ({ ...prev, status, statusMessage: message }));
    }, []);

    useEffect(() => {
        const unsubStarted = recordingService.onRecordingStarted(() => {
            setState(prev => ({
                ...prev,
                isRecording: true,
                isPaused: false,
                isActive: true,
                status: RecordingStatus.RECORDING,
            }));
        });

        const unsubStopped = recordingService.onRecordingStopped(() => {
            setState(prev => ({
                ...prev,
                isRecording: false,
                isPaused: false,
                isActive: false,
                status: RecordingStatus.IDLE,
            }));
        });

        const unsubPaused = recordingService.onRecordingPaused(() => {
            setState(prev => ({ ...prev, isPaused: true, isActive: false }));
        });

        const unsubResumed = recordingService.onRecordingResumed(() => {
            setState(prev => ({ ...prev, isPaused: false, isActive: true }));
        });

        return () => {
            unsubStarted();
            unsubStopped();
            unsubPaused();
            unsubResumed();
        };
    }, []);

    const value = useMemo(() => ({
        ...state,
        setStatus,
        isStopping: state.status === RecordingStatus.STOPPING,
        isProcessing: state.status === RecordingStatus.PROCESSING_TRANSCRIPTS,
        isSaving: state.status === RecordingStatus.SAVING,
    }), [state, setStatus]);

    return (
        <RecordingStateContext.Provider value={value}>
            {children}
        </RecordingStateContext.Provider>
    );
}
