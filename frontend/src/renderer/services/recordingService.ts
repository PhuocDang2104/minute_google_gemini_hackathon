type RecordingEventHandler = (payload?: any) => void;

class RecordingService {
    private listeners: Record<string, Set<RecordingEventHandler>> = {
        start: new Set(),
        stop: new Set(),
        pause: new Set(),
        resume: new Set(),
    };

    private audioContext: AudioContext | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private chunks: Blob[] = [];

    async startRecording(options: { useSystemAudio?: boolean } = {}): Promise<void> {
        try {
            const streams: MediaStream[] = [];

            // 1. Mic input
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streams.push(micStream);

            // 2. System audio (optional)
            if (options.useSystemAudio) {
                try {
                    // Video is required to get audio in getDisplayMedia
                    const sysStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false,
                        }
                    });

                    // We only need the audio track
                    const audioTracks = sysStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        streams.push(sysStream);
                    } else {
                        console.warn("No system audio track found (did user uncheck 'Share audio'?)");
                    }
                } catch (err) {
                    console.warn("System audio denied or failed:", err);
                    // Proceed with just mic if system fails? 
                    // Or maybe throw to let user know? 
                    // For now, let's proceed but warn.
                }
            }

            // 3. Mix if multiple or just use one
            let finalStream: MediaStream;

            if (streams.length > 1) {
                this.audioContext = new AudioContext();
                const dest = this.audioContext.createMediaStreamDestination();

                streams.forEach(s => {
                    if (s.getAudioTracks().length > 0) {
                        const source = this.audioContext!.createMediaStreamSource(s);
                        source.connect(dest);
                    }
                });
                finalStream = dest.stream;
            } else {
                finalStream = streams[0];
            }

            this.stream = finalStream;
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.chunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                this.cleanup();
            };

            this.mediaRecorder.start(1000); // chunk every 1s
            this.emit('start');
        } catch (error) {
            console.error('Failed to start recording:', error);
            throw error;
        }
    }

    private cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    async stopRecording(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                resolve(new Blob());
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'audio/webm' });
                this.emit('stop', { blob });
                this.cleanup(); // Ensure cleanup happens
                this.mediaRecorder = null;
                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }

    pauseRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            this.emit('pause');
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            this.emit('resume');
        }
    }

    // Event handling
    private emit(event: string, payload?: any) {
        this.listeners[event]?.forEach(cb => cb(payload));
    }

    onRecordingStarted(cb: RecordingEventHandler) {
        this.listeners.start.add(cb);
        return () => this.listeners.start.delete(cb);
    }

    onRecordingStopped(cb: RecordingEventHandler) {
        this.listeners.stop.add(cb);
        return () => this.listeners.stop.delete(cb);
    }

    onRecordingPaused(cb: RecordingEventHandler) {
        this.listeners.pause.add(cb);
        return () => this.listeners.pause.delete(cb);
    }

    onRecordingResumed(cb: RecordingEventHandler) {
        this.listeners.resume.add(cb);
        return () => this.listeners.resume.delete(cb);
    }
}

export const recordingService = new RecordingService();
