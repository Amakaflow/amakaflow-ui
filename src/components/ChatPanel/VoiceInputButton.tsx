/**
 * VoiceInputButton — Mic button with visual states for voice input.
 *
 * States:
 * - idle: Gray mic icon
 * - recording: Pulsing red dot with "Listening..." tooltip
 * - processing: Spinner with "Transcribing..." tooltip
 * - error: Red mic with error tooltip
 * - unsupported: Hidden or disabled with tooltip
 */

import { Mic, MicOff, Loader2, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import type { VoiceInputState } from '../../hooks/useVoiceInput';

interface VoiceInputButtonProps {
  state: VoiceInputState;
  isSupported: boolean;
  error: string | null;
  confidence: number;
  disabled?: boolean;
  /** Live recording duration in ms. When provided, the button renders an elapsed-time counter. */
  recordingDurationMs?: number;
  /**
   * Max recording duration in ms. Accepted for API symmetry with `useVoiceInput`
   * but not currently rendered — the elapsed counter counts up rather than
   * down because AMA-1320's 30-minute cap is a safety backstop, not a
   * user-facing limit.
   */
  maxDurationMs?: number;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}

/**
 * Format elapsed time as "m:ss". Caller passes elapsed ms.
 * Returns "0:00" for anything ≤ 0 so the display doesn't flicker negative.
 */
function formatElapsed(elapsedMs: number): string {
  const clamped = Math.max(0, elapsedMs);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getTooltip(
  state: VoiceInputState,
  isSupported: boolean,
  error: string | null,
  confidence: number,
): string {
  if (!isSupported) {
    return 'Voice input is not supported in this browser';
  }

  switch (state) {
    case 'idle':
      return 'Click to start voice input';
    case 'requesting':
      return 'Requesting microphone access...';
    case 'recording':
      return 'Listening... Click to stop';
    case 'processing':
      return 'Transcribing...';
    case 'error':
      return error || 'Voice input error';
    default:
      return 'Voice input';
  }
}

export function VoiceInputButton({
  state,
  isSupported,
  error,
  confidence,
  disabled = false,
  recordingDurationMs,
  maxDurationMs,
  onStart,
  onStop,
  onCancel,
}: VoiceInputButtonProps) {
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing' || state === 'requesting';
  const isError = state === 'error';
  const isDisabled = disabled || !isSupported || isProcessing;

  // AMA-1320: Show an elapsed-time counter (counting up) next to the mic
  // while recording, like Telegram voice notes. The 30-minute cap in
  // useVoiceInput is a safety backstop, not a user-facing limit, so we
  // deliberately do NOT show remaining time or warning colors — that would
  // imply a practical limit users should worry about. `maxDurationMs` is
  // accepted in props for API symmetry with the hook but intentionally
  // unused in rendering.
  void maxDurationMs;
  const showElapsed = isRecording && recordingDurationMs !== undefined;
  const elapsedLabel = showElapsed ? formatElapsed(recordingDurationMs ?? 0) : '';

  const handleClick = () => {
    if (isRecording) {
      onStop();
    } else if (state === 'idle' || state === 'error') {
      onStart();
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isRecording) {
      onCancel();
    }
  };

  const tooltip = getTooltip(state, isSupported, error, confidence);

  // Don't render if unsupported (graceful degradation)
  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-9 w-9 shrink-0 relative',
          isRecording && 'text-red-500 hover:text-red-600',
          isError && 'text-red-500',
        )}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        disabled={isDisabled}
        title={tooltip}
        aria-label={tooltip}
        data-testid="chat-voice-button"
        data-state={state}
      >
        {/* Recording indicator - pulsing dot */}
        {isRecording && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}

        {/* Icon based on state */}
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isRecording ? (
          <Square className="w-3 h-3 fill-current" />
        ) : isError ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>

      {/* AMA-1320: elapsed-time counter while recording. Counts UP, not down
          — the 30-min cap in useVoiceInput is a safety backstop, not a
          user-facing limit (Telegram-style voice note UX). No warning
          colors because there's no meaningful cutoff to warn about. */}
      {showElapsed && (
        <span
          className="text-[11px] font-mono tabular-nums select-none text-muted-foreground"
          data-testid="chat-voice-elapsed"
          aria-live="polite"
          aria-label={`Recording, ${elapsedLabel} elapsed`}
        >
          {elapsedLabel}
        </span>
      )}
    </div>
  );
}
