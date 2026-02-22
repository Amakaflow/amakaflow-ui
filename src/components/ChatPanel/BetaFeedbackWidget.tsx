/**
 * BetaFeedbackWidget - Floating feedback button for beta users.
 *
 * Expands to a form with thumbs up/down and optional text feedback.
 * Submits to the chat_feedback table.
 * Part of AMA-437: Feature Flags & Beta Rollout Configuration
 */

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useClerkUser } from '../../lib/clerk-auth';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import type { FeedbackSentiment } from '../../types/feature-flags';

interface BetaFeedbackWidgetProps {
  /** Current chat session ID for context */
  sessionId?: string;
  /** ID of the last message for targeted feedback */
  messageId?: string;
}

export function BetaFeedbackWidget({ sessionId, messageId }: BetaFeedbackWidgetProps) {
  const { user } = useClerkUser();
  const [isExpanded, setIsExpanded] = useState(false);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !sentiment) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('chat_feedback').insert({
        user_id: user.id,
        session_id: sessionId || null,
        message_id: messageId || null,
        sentiment,
        feedback_text: feedbackText.trim() || null,
        feature: 'beta_general',
        metadata: {
          submitted_at: new Date().toISOString(),
          user_agent: navigator.userAgent,
        },
      });

      if (error) {
        console.error('Failed to submit feedback:', error);
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        setIsExpanded(false);
        setSubmitted(false);
        setSentiment(null);
        setFeedbackText('');
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, sentiment, feedbackText, sessionId, messageId]);

  const handleQuickFeedback = useCallback(async (quickSentiment: FeedbackSentiment) => {
    if (!user?.id) return;

    setSentiment(quickSentiment);
    setIsSubmitting(true);
    try {
      await supabase.from('chat_feedback').insert({
        user_id: user.id,
        session_id: sessionId || null,
        message_id: messageId || null,
        sentiment: quickSentiment,
        feature: 'beta_quick',
        metadata: {
          submitted_at: new Date().toISOString(),
        },
      });

      setSubmitted(true);
      setTimeout(() => {
        setIsExpanded(false);
        setSubmitted(false);
        setSentiment(null);
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, sessionId, messageId]);

  if (!user) return null;

  return (
    <div className="absolute bottom-16 right-4 z-10" data-testid="beta-feedback-widget">
      {!isExpanded ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="gap-1.5 rounded-full border-primary/20 bg-primary/5 text-xs hover:bg-primary/10"
          data-testid="feedback-expand-button"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>Feedback</span>
        </Button>
      ) : (
        <div className="w-64 rounded-lg border bg-card p-3 shadow-lg" data-testid="feedback-form">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {submitted ? 'Thanks for your feedback!' : 'How was your experience?'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => {
                setIsExpanded(false);
                setSentiment(null);
                setFeedbackText('');
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {submitted ? (
            <div className="flex items-center justify-center py-4 text-primary">
              <ThumbsUp className="h-6 w-6" />
            </div>
          ) : (
            <>
              {/* Quick sentiment buttons */}
              <div className="mb-3 flex justify-center gap-4">
                <button
                  onClick={() => handleQuickFeedback('positive')}
                  disabled={isSubmitting}
                  className={`rounded-full p-2 transition-colors ${
                    sentiment === 'positive'
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-muted hover:bg-green-500/10 hover:text-green-600'
                  }`}
                  aria-label="Positive feedback"
                  data-testid="feedback-thumbs-up"
                >
                  <ThumbsUp className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleQuickFeedback('negative')}
                  disabled={isSubmitting}
                  className={`rounded-full p-2 transition-colors ${
                    sentiment === 'negative'
                      ? 'bg-red-500/20 text-red-600'
                      : 'bg-muted hover:bg-red-500/10 hover:text-red-600'
                  }`}
                  aria-label="Negative feedback"
                  data-testid="feedback-thumbs-down"
                >
                  <ThumbsDown className="h-5 w-5" />
                </button>
              </div>

              {/* Optional text feedback */}
              <div className="space-y-2">
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us more (optional)..."
                  className="h-16 w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                  data-testid="feedback-textarea"
                />
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleSubmit}
                  disabled={!sentiment || isSubmitting}
                  data-testid="feedback-submit"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Submit</span>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
