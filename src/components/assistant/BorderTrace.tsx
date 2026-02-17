/**
 * BorderTrace - Ambient glow component that traces the perimeter of the main area.
 * Shows a glowing teal line with a comet-tail effect when the AI assistant is working.
 */

import React from 'react';

interface BorderTraceProps {
  /** Whether the assistant is active/working */
  active?: boolean;
}

export function BorderTrace({ active = false }: BorderTraceProps) {
  return (
    <div
      className={`
        absolute inset-0 rounded-xl
        pointer-events-none
        transition-opacity duration-500 ease-in-out
        ${active ? 'opacity-100' : 'opacity-0'}
      `}
      style={{
        background: `conic-gradient(
          from var(--border-trace-angle, 0deg),
          transparent 0deg,
          rgba(45, 212, 191, 0.8) 30deg,
          rgba(45, 212, 191, 1) 60deg,
          rgba(45, 212, 191, 0.8) 90deg,
          transparent 120deg,
          transparent 240deg,
          rgba(45, 212, 191, 0.8) 270deg,
          rgba(45, 212, 191, 1) 300deg,
          rgba(45, 212, 191, 0.8) 330deg,
          transparent 360deg
        )`,
        animation: active ? 'border-trace-spin 3s linear infinite' : 'none',
      }}
      aria-hidden="true"
    />
  );
}
