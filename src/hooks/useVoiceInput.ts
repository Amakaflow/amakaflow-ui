/**
 * useVoiceInput — React hook for voice input with Deepgram primary, Web Speech API fallback.
 *
 * State machine: idle -> requesting -> recording -> processing -> idle
 *                                         |
 *                                         v
 *                                       error
 *
 * Features:
 * - MediaRecorder with audio/webm;codecs=opus
 * - 30-minute safety cap — not a real limit anyone hits in practice. Matches
 *   the Telegram voice-note UX where recording feels unbounded from the
 *   user's perspective.
 * - Live `recordingDurationMs` output so consumers can render an elapsed
 *   m:ss counter (counting up, not down)
 * - Fallback to Web Speech API on Deepgram failure
 * - Feature detection for unsupported browsers
 *
 * AMA-1320: Web max was previously 60s, which cut off power users describing
 * full workout sessions. Bumped to 1800s (30 min) per David's direction —
 * "it should be the same as when I'm recording a message on Telegram". The
 * cap still exists as a backstop (prevents runaway tabs, backend request-
 * timeout blowouts, Deepgram upload size issues) but is not user-facing.
 * Surfaced live duration so the UI can show an elapsed m:ss counter.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio, type TranscriptionResult } from '../lib/voice-api';

export type VoiceInputState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';

export interface UseVoiceInputReturn {
  state: VoiceInputState;
  transcript: string;
  confidence: number;
  error: string | null;
  isSupported: boolean;
  /** Elapsed milliseconds of the current recording. 0 when not recording. */
  recordingDurationMs: number;
  /** Configured max duration (safety backstop, not a user-facing limit in practice). */
  maxDurationMs: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  clearTranscript: () => void;
}

interface UseVoiceInputOptions {
  maxDurationMs?: number;
  onTranscript?: (text: string, confidence: number) => void;
  language?: string;
}

// 30-minute safety cap. Chosen to be long enough that no real user ever
// experiences it as a limit (matches Telegram voice-note UX per David's
// direction on AMA-1320), short enough that a stuck tab or forgotten
// recording can't run indefinitely. Still catches backend request-timeout
// and Deepgram upload-size edge cases without making them the user's
// problem.
const DEFAULT_MAX_DURATION_MS = 1_800_000; // 30 minutes
const MIN_CONFIDENCE_THRESHOLD = 0.5;
const DURATION_TICK_MS = 100; // 10 Hz — smooth elapsed-time display without burning CPU

// Check if the browser supports the required APIs
function checkBrowserSupport(): boolean {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

// Check if Web Speech API is available
function checkWebSpeechSupport(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

/**
 * Fallback transcription using Web Speech API
 */
async function transcribeWithWebSpeech(language: string): Promise<{ text: string; confidence: number }> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error('Web Speech API not supported'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let resolved = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (resolved) return;
      resolved = true;
      const result = event.results[0];
      if (result) {
        resolve({
          text: result[0].transcript,
          confidence: result[0].confidence,
        });
      } else {
        reject(new Error('No speech detected'));
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (resolved) return;
      resolved = true;
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      if (!resolved) {
        resolved = true;
        reject(new Error('No speech detected'));
      }
    };

    recognition.start();

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        recognition.stop();
        reject(new Error('Speech recognition timeout'));
      }
    }, 10_000);
  });
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { maxDurationMs = DEFAULT_MAX_DURATION_MS, onTranscript, language = 'en-US' } = options;

  const [state, setState] = useState<VoiceInputState>('idle');
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSupported = checkBrowserSupport();
  const hasWebSpeech = checkWebSpeechSupport();

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Abort any in-flight transcription requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const processTranscription = useCallback(
    async (audioBlob: Blob) => {
      // Guard against unmounted component
      if (!isMountedRef.current) return;

      setState('processing');
      setError(null);

      // Create abort controller for this transcription request
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      let result: TranscriptionResult | null = null;
      let usedFallback = false;

      // Try Deepgram first
      try {
        result = await transcribeAudio(audioBlob, { language, signal });
        if (!isMountedRef.current) return; // Check after async operation

        if (result.success && result.confidence >= MIN_CONFIDENCE_THRESHOLD) {
          setTranscript(result.text);
          setConfidence(result.confidence);
          onTranscript?.(result.text, result.confidence);
          setState('idle');
          return;
        }
      } catch (err) {
        // Don't log abort errors as warnings
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.warn('Deepgram transcription failed, trying Web Speech API fallback:', err);
      }

      // Guard against unmounted component after catch
      if (!isMountedRef.current) return;

      // Fall back to Web Speech API if Deepgram failed or low confidence
      if (hasWebSpeech) {
        try {
          usedFallback = true;
          const fallbackResult = await transcribeWithWebSpeech(language);
          if (!isMountedRef.current) return; // Check after async operation

          setTranscript(fallbackResult.text);
          setConfidence(fallbackResult.confidence);
          onTranscript?.(fallbackResult.text, fallbackResult.confidence);
          setState('idle');
          return;
        } catch (fallbackErr) {
          console.warn('Web Speech API fallback also failed:', fallbackErr);
        }
      }

      // Guard against unmounted component
      if (!isMountedRef.current) return;

      // If Deepgram returned low confidence but didn't error, use that result
      if (result && result.success) {
        setTranscript(result.text);
        setConfidence(result.confidence);
        onTranscript?.(result.text, result.confidence);
        setState('idle');
        return;
      }

      // All options exhausted
      const errorMessage = usedFallback
        ? 'Voice transcription failed. Please try again or type your message.'
        : 'Voice transcription failed. Please check your network connection and try again.';
      setError(errorMessage);
      setState('error');
    },
    [language, onTranscript, hasWebSpeech],
  );

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Voice input is not supported in this browser');
      setState('error');
      return;
    }

    setState('requesting');
    setError(null);
    setTranscript('');
    setConfidence(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Prefer webm/opus, fall back to webm or whatever is supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanup();

        if (audioBlob.size > 0) {
          processTranscription(audioBlob);
        } else {
          setError('No audio recorded. Please try again.');
          setState('error');
        }
      };

      mediaRecorder.onerror = () => {
        cleanup();
        setError('Recording error. Please try again.');
        setState('error');
      };

      // Start recording
      mediaRecorder.start();
      setState('recording');

      // Start live elapsed-time tracking so the UI can render an "m:ss"
      // counter. Uses wall-clock time so it stays accurate even if the tick
      // interval drifts under browser tab-throttling conditions.
      recordingStartedAtRef.current = Date.now();
      setRecordingDurationMs(0);
      durationIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - recordingStartedAtRef.current;
        setRecordingDurationMs(elapsed);
      }, DURATION_TICK_MS);

      // Set max duration timeout
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, maxDurationMs);
    } catch (err) {
      cleanup();
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access in your browser settings.'
          : 'Failed to access microphone. Please check your device settings.';
      setError(message);
      setState('error');
    }
  }, [isSupported, maxDurationMs, cleanup, processTranscription]);

  const stopRecording = useCallback(() => {
    // Stop ticking the duration immediately so the final rendered value is
    // the moment the user pressed stop, not whenever the MediaRecorder.onstop
    // handler finally fires.
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    // Abort any in-flight transcription request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      // Remove the onstop handler to prevent processing
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setRecordingDurationMs(0);
    setState('idle');
    setError(null);
  }, [cleanup]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setConfidence(0);
    setError(null);
    setRecordingDurationMs(0);
    if (state === 'error') {
      setState('idle');
    }
  }, [state]);

  return {
    state,
    transcript,
    confidence,
    error,
    isSupported,
    recordingDurationMs,
    maxDurationMs,
    startRecording,
    stopRecording,
    cancelRecording,
    clearTranscript,
  };
}
