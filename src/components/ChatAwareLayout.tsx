/**
 * ChatAwareLayout - Wrapper that adjusts content when chat panel is open.
 *
 * On desktop (md+), adds right padding to prevent content from being
 * obscured by the chat side panel. Also renders visualization overlays
 * (BorderTrace, FloatingPill) when the AI assistant is working.
 */

import { useChat } from '../context/ChatContext';
import { BorderTrace } from './assistant/BorderTrace';
import { FloatingPill } from './assistant/FloatingPill';

interface ChatAwareLayoutProps {
  children: React.ReactNode;
}

/** No-op stub until OutlinePulse (AMA-635) is built */
function OutlinePulseStub(_props: { target: string }) {
  return null;
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

      {/* AMA-576: Assistant visualization overlays */}
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
    </div>
  );
}
