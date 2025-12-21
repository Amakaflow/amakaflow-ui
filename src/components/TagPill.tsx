/**
 * TagPill - Displays a tag as a colored pill/badge
 */

import React from 'react';
import { X } from 'lucide-react';
import { cn } from './ui/utils';

interface TagPillProps {
  name: string;
  color?: string;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

// Default colors for tags without a custom color
const DEFAULT_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#64748b', // slate
];

// Get a consistent color based on tag name
function getDefaultColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

// Determine if text should be light or dark based on background
function getTextColor(bgColor: string): string {
  // Convert hex to RGB
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function TagPill({
  name,
  color,
  onRemove,
  onClick,
  size = 'sm',
  className,
}: TagPillProps) {
  const bgColor = color || getDefaultColor(name);
  const textColor = getTextColor(bgColor);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium transition-opacity',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
      onClick={onClick}
    >
      <span className="truncate max-w-[120px]">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        </button>
      )}
    </span>
  );
}

export default TagPill;
