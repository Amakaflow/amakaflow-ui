/**
 * WorkoutPreviewCard - Hover preview card showing workout details
 */

import React from 'react';
import { Clock, Dumbbell, Star, Play, Edit, Download, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './ui/hover-card';
import { Badge } from './ui/badge';
import { TagPill } from './TagPill';
import type { UnifiedWorkout } from '../types/unified-workout';
import { CATEGORY_DISPLAY_NAMES } from '../types/unified-workout';

interface WorkoutPreviewCardProps {
  workout: UnifiedWorkout;
  children: React.ReactNode;
  onStart?: () => void;
  onEdit?: () => void;
  onExport?: () => void;
  onFavorite?: () => void;
  availableTags?: { name: string; color?: string }[];
}

// Format duration from seconds
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

// Format date relative to now
function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return 'Unknown';
  }
}

export function WorkoutPreviewCard({
  workout,
  children,
  onStart,
  onEdit,
  onExport,
  onFavorite,
  availableTags = [],
}: WorkoutPreviewCardProps) {
  const isVideo = workout._original.type === 'follow-along';
  const exerciseNames = workout.exerciseNames.slice(0, 5);
  const remainingCount = workout.exerciseNames.length - 5;

  return (
    <HoverCard openDelay={400} closeDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" side="right" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm line-clamp-2">{workout.title}</h4>
              {workout.isFavorite && (
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
              )}
            </div>
            {workout.creator && (
              <p className="text-xs text-muted-foreground">by {workout.creator}</p>
            )}
          </div>

          {/* Thumbnail for video */}
          {isVideo && workout.thumbnailUrl && (
            <div className="w-full aspect-video rounded-md overflow-hidden bg-muted">
              <img
                src={workout.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(workout.durationSec)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Dumbbell className="w-3.5 h-3.5" />
              <span>{workout.exerciseCount} exercises</span>
            </div>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {CATEGORY_DISPLAY_NAMES[workout.category]}
            </Badge>
          </div>

          {/* Usage stats */}
          {(workout.timesCompleted > 0 || workout.lastUsedAt) && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              {workout.timesCompleted > 0 && (
                <span>Completed {workout.timesCompleted} time{workout.timesCompleted !== 1 ? 's' : ''}</span>
              )}
              {workout.timesCompleted > 0 && workout.lastUsedAt && ' • '}
              {workout.lastUsedAt && (
                <span>Last used {formatDate(workout.lastUsedAt)}</span>
              )}
            </div>
          )}

          {/* Exercise list */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Exercises:</p>
            <ul className="text-xs space-y-0.5">
              {exerciseNames.map((name, i) => (
                <li key={i} className="truncate text-muted-foreground">
                  • {name}
                </li>
              ))}
              {remainingCount > 0 && (
                <li className="text-muted-foreground/60">
                  +{remainingCount} more...
                </li>
              )}
            </ul>
          </div>

          {/* Tags */}
          {workout.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {workout.tags.slice(0, 4).map((tagName) => {
                const tag = availableTags.find((t) => t.name === tagName);
                return (
                  <TagPill key={tagName} name={tagName} color={tag?.color} size="sm" />
                );
              })}
              {workout.tags.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{workout.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Quick actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            {onStart && !isVideo && (
              <Button size="sm" variant="default" onClick={onStart} className="gap-1 flex-1">
                <Play className="w-3.5 h-3.5" />
                Start
              </Button>
            )}
            {isVideo && workout.sourceUrl && (
              <Button
                size="sm"
                variant="default"
                onClick={() => window.open(workout.sourceUrl, '_blank')}
                className="gap-1 flex-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Watch
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit} className="gap-1">
                <Edit className="w-3.5 h-3.5" />
              </Button>
            )}
            {onFavorite && (
              <Button size="sm" variant="outline" onClick={onFavorite} className="gap-1">
                <Star className={`w-3.5 h-3.5 ${workout.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
            )}
            {onExport && (
              <Button size="sm" variant="outline" onClick={onExport} className="gap-1">
                <Download className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default WorkoutPreviewCard;
