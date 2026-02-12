/**
 * useStreamingPipeline — Generic React hook for consuming pipeline SSE streams.
 *
 * Tracks stages, content deltas, preview data, streaming state, and errors.
 * Supports AbortController cancellation and content buffering.
 */

import { useState, useCallback, useRef } from 'react';
import { streamPipeline } from '../lib/pipeline-api';
import type { PipelineStage, PipelineStageEvent, PipelinePreview, PipelineSSEEvent } from '../types/pipeline';

export interface UseStreamingPipelineReturn {
  start: (endpoint: string, body: Record<string, unknown>) => void;
  cancel: () => void;
  currentStage: PipelineStageEvent | null;
  completedStages: PipelineStage[];
  content: string;
  preview: PipelinePreview | null;
  isStreaming: boolean;
  error: string | null;
}

export function useStreamingPipeline(): UseStreamingPipelineReturn {
  const [currentStage, setCurrentStage] = useState<PipelineStageEvent | null>(null);
  const [completedStages, setCompletedStages] = useState<PipelineStage[]>([]);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<PipelinePreview | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const contentBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const flushContentBuffer = useCallback(() => {
    if (contentBufferRef.current) {
      setContent((prev) => prev + contentBufferRef.current);
      contentBufferRef.current = '';
    }
    flushTimerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (contentBufferRef.current) {
      setContent((prev) => prev + contentBufferRef.current);
      contentBufferRef.current = '';
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    (endpoint: string, body: Record<string, unknown>) => {
      // Cancel any existing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // Reset state
      setCurrentStage(null);
      setCompletedStages([]);
      setContent('');
      setPreview(null);
      setError(null);
      setIsStreaming(true);
      retryCountRef.current = 0;

      const executeStream = () => {
        streamPipeline({
          endpoint,
          body,
          signal: controller.signal,
          onEvent: (event: PipelineSSEEvent) => {
            switch (event.event) {
              case 'stage': {
                const stageData = event.data;
                setCurrentStage((prev) => {
                  // Move previous stage to completed when transitioning
                  if (prev && prev.stage !== stageData.stage) {
                    setCompletedStages((cs) =>
                      cs.includes(prev.stage) ? cs : [...cs, prev.stage]
                    );
                  }
                  return stageData;
                });
                break;
              }
              case 'content_delta': {
                if (event.data.text) {
                  contentBufferRef.current += event.data.text;
                  if (!flushTimerRef.current) {
                    flushTimerRef.current = setTimeout(flushContentBuffer, 80);
                  }
                }
                break;
              }
              case 'preview': {
                setPreview(event.data);
                break;
              }
              case 'error': {
                setError(event.data.message || 'An error occurred');
                setIsStreaming(false);
                abortRef.current = null;
                break;
              }
            }
          },
          onError: (err: Error) => {
            if (err.name === 'AbortError') return;

            if (retryCountRef.current < maxRetries) {
              retryCountRef.current++;
              const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 8000);
              setTimeout(executeStream, delay);
              return;
            }

            setError(err.message);
            setIsStreaming(false);
            abortRef.current = null;
          },
          onComplete: () => {
            // Flush remaining content
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            if (contentBufferRef.current) {
              setContent((prev) => prev + contentBufferRef.current);
              contentBufferRef.current = '';
            }
            setIsStreaming(false);
            abortRef.current = null;
          },
        });
      };

      executeStream();
    },
    [flushContentBuffer],
  );

  return {
    start,
    cancel,
    currentStage,
    completedStages,
    content,
    preview,
    isStreaming,
    error,
  };
}
