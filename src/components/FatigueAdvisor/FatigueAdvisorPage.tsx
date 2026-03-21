/**
 * FatigueAdvisorPage — main page component for the body fatigue advisor.
 *
 * AMA-1114: Input question + structured response display.
 * Users can type a question or tap a muscle group from the body map.
 */

import { useState, useRef, useEffect } from 'react';
import { FatigueResponse } from './FatigueResponse';
import { BodyMapSelector } from './BodyMapSelector';
import { useFatigueAdvisor } from './hooks/useFatigueAdvisor';
import type { FatigueAdvice } from './hooks/useFatigueAdvisor';

// =============================================================================
// Loading Skeleton
// =============================================================================

function LoadingSkeleton() {
  return (
    <div data-testid="fatigue-loading" className="flex flex-col gap-3 animate-pulse">
      <div className="rounded-xl border border-border/40 bg-card p-4">
        <div className="h-4 w-24 rounded bg-muted/50 mb-2" />
        <div className="h-3 w-full rounded bg-muted/30 mb-1" />
        <div className="h-3 w-3/4 rounded bg-muted/30" />
      </div>
      <div className="rounded-xl border border-border/40 bg-card p-4">
        <div className="h-4 w-32 rounded bg-muted/50 mb-2" />
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded bg-muted/30" />
          <div className="h-3 w-5/6 rounded bg-muted/30" />
          <div className="h-3 w-4/5 rounded bg-muted/30" />
        </div>
      </div>
      <div className="rounded-xl border border-border/40 bg-card p-4">
        <div className="h-4 w-40 rounded bg-muted/50 mb-2" />
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded bg-muted/30" />
          <div className="h-3 w-4/5 rounded bg-muted/30" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

interface FatigueAdvisorPageProps {
  /** Pre-populate with advice (for previews/screenshots) */
  initialAdvice?: FatigueAdvice | null;
  /** Pre-populate the question */
  initialQuestion?: string;
  /** Show the body map selector */
  showBodyMap?: boolean;
  /** Demo mode for the hook */
  demoMode?: boolean;
}

export function FatigueAdvisorPage({
  initialAdvice = null,
  initialQuestion = '',
  showBodyMap = true,
  demoMode = true,
}: FatigueAdvisorPageProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const { advice: hookAdvice, isLoading, error, askQuestion, reset, lastQuestion } = useFatigueAdvisor({ demoMode });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use initial advice if provided, otherwise use hook advice
  const advice = initialAdvice ?? hookAdvice;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || isLoading) return;
    await askQuestion(question.trim());
  };

  const handleBodyMapSelect = (template: string) => {
    setQuestion(template);
    // Auto-focus the input so user can edit or submit
    inputRef.current?.focus();
  };

  const handleReset = () => {
    setQuestion('');
    reset();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div data-testid="fatigue-advisor-page" className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-bold">
          F
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Fatigue Advisor</h2>
          <p className="text-xs text-muted-foreground">Ask about muscle fatigue, get targeted advice</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 max-w-lg mx-auto">
          {/* Body Map (when no advice shown) */}
          {showBodyMap && !advice && !isLoading && (
            <BodyMapSelector onSelect={handleBodyMapSelect} />
          )}

          {/* Last Question Display */}
          {(lastQuestion || initialQuestion) && (advice || isLoading) && (
            <div data-testid="fatigue-question-display" className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Your question:</p>
              <p className="text-sm text-foreground">{lastQuestion || initialQuestion}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && <LoadingSkeleton />}

          {/* Error State */}
          {error && (
            <div data-testid="fatigue-error" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={handleReset}
                className="mt-2 text-xs text-red-400 underline hover:text-red-300"
              >
                Try again
              </button>
            </div>
          )}

          {/* Response */}
          {advice && !isLoading && <FatigueResponse advice={advice} />}

          {/* Ask Another */}
          {advice && !isLoading && (
            <button
              data-testid="fatigue-ask-another"
              onClick={handleReset}
              className="self-center rounded-lg border border-border/40 bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              Ask another question
            </button>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border/40 p-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-lg mx-auto">
          <textarea
            ref={inputRef}
            data-testid="fatigue-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            placeholder="Describe your muscle fatigue..."
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            data-testid="fatigue-submit"
            disabled={!question.trim() || isLoading}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              question.trim() && !isLoading
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:opacity-90'
                : 'bg-muted/30 text-muted-foreground cursor-not-allowed'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
