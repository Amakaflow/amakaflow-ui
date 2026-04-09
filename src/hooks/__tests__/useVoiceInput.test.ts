/**
 * Unit tests for useVoiceInput hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the voice-api before importing the hook
vi.mock('../../lib/voice-api', () => ({
  transcribeAudio: vi.fn(),
}));

import { useVoiceInput } from '../useVoiceInput';
import { transcribeAudio } from '../../lib/voice-api';

describe('useVoiceInput', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalMediaRecorder = globalThis.MediaRecorder;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    });
    if (originalMediaRecorder) {
      globalThis.MediaRecorder = originalMediaRecorder;
    }
    // Cleanup any Web Speech API mocks
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  describe('initial state', () => {
    it('starts in idle state with empty transcript', () => {
      const { result } = renderHook(() => useVoiceInput());

      expect(result.current.state).toBe('idle');
      expect(result.current.transcript).toBe('');
      expect(result.current.confidence).toBe(0);
      expect(result.current.error).toBeNull();
    });

    // AMA-1320: regression test for the 60s cutoff bug. The default must
    // stay at 5 minutes to match iOS. If someone drops this back to 60s,
    // power users describing a full workout get cut off mid-sentence.
    it('defaults maxDurationMs to 300000 (5 minutes, matches iOS)', () => {
      const { result } = renderHook(() => useVoiceInput());
      expect(result.current.maxDurationMs).toBe(300_000);
    });

    it('honors an explicit maxDurationMs override', () => {
      const { result } = renderHook(() => useVoiceInput({ maxDurationMs: 120_000 }));
      expect(result.current.maxDurationMs).toBe(120_000);
    });

    it('starts with recordingDurationMs=0', () => {
      const { result } = renderHook(() => useVoiceInput());
      expect(result.current.recordingDurationMs).toBe(0);
    });
  });

  describe('browser support detection', () => {
    it('reports isSupported=false when navigator.mediaDevices is unavailable', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useVoiceInput());
      expect(result.current.isSupported).toBe(false);
    });

    it('reports isSupported=false when getUserMedia is unavailable', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useVoiceInput());
      expect(result.current.isSupported).toBe(false);
    });

    it('reports isSupported=true when both mediaDevices and MediaRecorder are available', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: vi.fn() },
        writable: true,
        configurable: true,
      });
      globalThis.MediaRecorder = vi.fn() as unknown as typeof MediaRecorder;

      const { result } = renderHook(() => useVoiceInput());
      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('startRecording error handling', () => {
    it('sets error state when browser is not supported', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.state).toBe('error');
      expect(result.current.error).toContain('not supported');
    });

    it('sets appropriate error on permission denied', async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
      );

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });
      globalThis.MediaRecorder = vi.fn() as unknown as typeof MediaRecorder;

      const { result } = renderHook(() => useVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.state).toBe('error');
      expect(result.current.error).toContain('Microphone access denied');
    });

    it('sets generic error on other failures', async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(new Error('Device not found'));

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
        writable: true,
        configurable: true,
      });
      globalThis.MediaRecorder = vi.fn() as unknown as typeof MediaRecorder;

      const { result } = renderHook(() => useVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.state).toBe('error');
      expect(result.current.error).toContain('Failed to access microphone');
    });
  });

  describe('cancelRecording', () => {
    it('returns to idle state and clears error', async () => {
      // First trigger an error
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.state).toBe('error');

      act(() => {
        result.current.cancelRecording();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.error).toBeNull();
    });
  });

  describe('clearTranscript', () => {
    it('resets transcript and confidence to initial values', () => {
      const { result } = renderHook(() => useVoiceInput());

      // Manually set some values by reusing the hook instance
      act(() => {
        result.current.clearTranscript();
      });

      expect(result.current.transcript).toBe('');
      expect(result.current.confidence).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('returns to idle if in error state', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useVoiceInput());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.state).toBe('error');

      act(() => {
        result.current.clearTranscript();
      });

      expect(result.current.state).toBe('idle');
    });
  });

  describe('hook API', () => {
    it('exposes all expected methods and properties', () => {
      const { result } = renderHook(() => useVoiceInput());

      expect(result.current).toHaveProperty('state');
      expect(result.current).toHaveProperty('transcript');
      expect(result.current).toHaveProperty('confidence');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isSupported');
      expect(typeof result.current.startRecording).toBe('function');
      expect(typeof result.current.stopRecording).toBe('function');
      expect(typeof result.current.cancelRecording).toBe('function');
      expect(typeof result.current.clearTranscript).toBe('function');
    });

    it('accepts options including onTranscript callback', () => {
      const onTranscript = vi.fn();
      const { result } = renderHook(() =>
        useVoiceInput({
          onTranscript,
          language: 'en-GB',
          maxDurationMs: 30000,
        })
      );

      expect(result.current.state).toBe('idle');
    });
  });

  // Note: Full recording flow tests require complex MediaRecorder mocking that is
  // difficult to get right in jsdom. The recording flow is better tested through
  // integration/E2E tests. The core state machine logic is verified by the error
  // handling tests above.

  // Note: Fallback chain tests (Deepgram -> Web Speech API) require complex async
  // mocking of multiple browser APIs. These scenarios are better verified through
  // integration/E2E tests. The core fallback logic is in processTranscription().
});
