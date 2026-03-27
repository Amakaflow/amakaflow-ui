/**
 * OutlinePulse - Element highlight component that pulses a teal outline
 * on a target element when the AI assistant acts on it.
 * 
 * Targets via CSS selector (e.g., `[data-assistant-target='library-section']`).
 * Auto-fades after ~1.5s (3 pulses).
 */

import React, { useEffect, useState, useRef } from 'react';

interface OutlinePulseProps {
  /** CSS selector to target element (e.g., `[data-assistant-target='library-section']`) */
  target: string | null;
  /** Duration in ms before auto-dismiss (default: 1500ms) */
  duration?: number;
}

interface BoundingRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OutlinePulse({ target, duration = 1500 }: OutlinePulseProps) {
  const [boundingRect, setBoundingRect] = useState<BoundingRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // If target is null, render nothing
    if (target === null) {
      setBoundingRect(null);
      setIsVisible(false);
      return;
    }

    // Find the target element
    const element = document.querySelector(target);
    if (!element) {
      setBoundingRect(null);
      setIsVisible(false);
      return;
    }

    // Get the bounding rect
    const rect = element.getBoundingClientRect();
    setBoundingRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });

    // Show the pulse
    setIsVisible(true);

    // Auto-dismiss after duration
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, duration);

    // Cleanup timeout on unmount or target change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [target, duration]);

  // Don't render if no target or not visible
  if (target === null || !isVisible || !boundingRect) {
    return null;
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: boundingRect.top,
        left: boundingRect.left,
        width: boundingRect.width,
        height: boundingRect.height,
      }}
      role="status"
      aria-live="polite"
      aria-label="Assistant is acting on this element"
    >
      {/* Teal outline pulse overlay */}
      <div
        className="absolute inset-0 rounded-md"
        style={{
          outline: '3px solid #2dd4bf', // teal-400
          outlineOffset: '2px',
          animation: 'outline-pulse 0.5s ease-in-out 3',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
