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
  /** Live recording duration in ms. When provided, the button renders a countdown label. */
  recordingDurationMs?: number;
  /** Max recording duration in ms. Used with recordingDurationMs to compute remaining time. */
  maxDurationMs?: number;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}

/**
 * Format remaining time as "m:ss". Caller passes remaining ms.
 * Returns "0:00" for anything ≤ 0 so the display doesn't flicker negative.
 */
function formatRemaining(remainingMs: number): string {
  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clamped / 1000);
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

  // Countdown: show remaining time while recording. Turns amber at <30s,
  // red at <10s, to warn the user before the hard cutoff fires.
  const showCountdown =
    isRecording && recordingDurationMs !== undefined && maxDurationMs !== undefined;
  const remainingMs =
    showCountdown && maxDurationMs !== undefined && recordingDurationMs !== undefined
      ? maxDurationMs - recordingDurationMs
      : 0;
  const remainingLabel = showCountdown ? formatRemaining(remainingMs) : '';
  const countdownUrgency =
    remainingMs <= 10_000 ? 'urgent' : remainingMs <= 30_000 ? 'warning' : 'normal';

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

      {/* AMA-1320: countdown while recording so users know how much time
          they have before the hard cutoff fires. Silent cutoffs felt like
          the feature was broken. */}
      {showCountdown && (
        <span
          className={cn(
            'text-[11px] font-mono tabular-nums select-none',
            countdownUrgency === 'urgent' && 'text-red-500 font-semibold',
            countdownUrgency === 'warning' && 'text-amber-500',
            countdownUrgency === 'normal' && 'text-muted-foreground',
          )}
          data-testid="chat-voice-countdown"
          aria-live="polite"
          aria-label={`${remainingLabel} remaining`}
        >
          {remainingLabel}
        </span>
      )}
    </div>
  );
}
