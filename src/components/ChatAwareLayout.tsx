/**
 * ChatAwareLayout - Wrapper that adjusts content when chat panel is open.
 *
 * On desktop (md+), adds right padding to prevent content from being
 * obscured by the chat side panel. Also renders visualization overlays
 * (BorderTrace, FloatingPill) when the AI assistant is working.
 *
 * Overlays are extracted into AssistantOverlays so that streaming-token
 * state mutations only re-render the lightweight overlay tree, not all
 * page children.
 */

import { useChat } from '../context/ChatContext';
import { BorderTrace } from './assistant/BorderTrace';
import { FloatingPill } from './assistant/FloatingPill';

interface ChatAwareLayoutProps {
  children: React.ReactNode;
}

// TODO(AMA-635): Replace stub with real OutlinePulse import
function OutlinePulseStub(_props: { target: string }) {
  return null;
}

/** Subscribes to ChatContext independently so children don't re-render on every state change. */
function AssistantOverlays() {
  const { state } = useChat();

  return (
    <>
      <BorderTrace active={state.assistantWorking} />
      <FloatingPill
        visible={state.assistantWorking}
        label={state.currentStepLabel ?? 'Processing...'}
        currentStep={state.stepCount.current}
        totalSteps={state.stepCount.total}
      />
      {/* OutlinePulse — swap stub for real import when AMA-635 is complete */}
      {state.activeVisualization?.target && (
        <OutlinePulseStub target={state.activeVisualization.target} />
      )}
    </>
  );
}

export function ChatAwareLayout({ children }: ChatAwareLayoutProps) {
  const { state } = useChat();

  return (
    <div
      className={`relative min-h-screen bg-background transition-all duration-300 overflow-x-hidden ${
        state.isOpen ? 'md:pr-[380px]' : ''
      }`}
      style={{ scrollbarGutter: 'stable' }}
    >
      {children}
      <AssistantOverlays />
    </div>
  );
}
