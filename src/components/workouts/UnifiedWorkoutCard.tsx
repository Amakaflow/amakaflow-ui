/**
 * UnifiedWorkoutCard - Display card for unified workouts
 *
 * Contextually displays workout information based on source type,
 * with quick actions for view, sync, and delete.
 */

import React, { useState, useCallback } from 'react';
import {
  Dumbbell,
  Clock,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  Play,
  Eye,
  Video,
  Smartphone,
  Youtube,
  Instagram,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';

import type { UnifiedWorkout, VideoPlatform, DevicePlatform } from '../../types/unified-workout';
import {
  CATEGORY_DISPLAY_NAMES,
  VIDEO_PLATFORM_DISPLAY_NAMES,
  DEVICE_PLATFORM_DISPLAY_NAMES,
  isHistoryWorkout,
  isFollowAlongWorkout,
} from '../../types/unified-workout';
import { formatDuration, getRelativeTime } from '../../lib/unified-workouts';

// =============================================================================
// Types
// =============================================================================

interface UnifiedWorkoutCardProps {
  workout: UnifiedWorkout;
  onView?: (workout: UnifiedWorkout) => void;
  onSync?: (workout: UnifiedWorkout) => void;
  onDelete?: (workout: UnifiedWorkout) => void;
  onFollowAlong?: (workout: UnifiedWorkout) => void;
  className?: string;
}

// =============================================================================
// Helper Components
// =============================================================================

function getVideoPlatformIcon(platform: VideoPlatform) {
  switch (platform) {
    case 'youtube':
      return <Youtube className="h-4 w-4 text-red-500" />;
    case 'instagram':
      return <Instagram className="h-4 w-4 text-pink-500" />;
    case 'tiktok':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
        </svg>
      );
    default:
      return <Video className="h-4 w-4 text-muted-foreground" />;
  }
}

function getDevicePlatformIcon(platform: DevicePlatform) {
  switch (platform) {
    case 'garmin':
      return (
        <span className="text-xs font-bold text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
          G
        </span>
      );
    case 'apple':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      );
    case 'android-companion':
      return (
        <span className="text-xs font-bold text-green-500 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
          A
        </span>
      );
    case 'strava':
      return <span className="text-xs font-bold text-orange-500">S</span>;
    default:
      return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'run':
      return '🏃';
    case 'strength':
      return '💪';
    case 'hiit':
      return '🔥';
    case 'cardio':
      return '❤️';
    case 'cycling':
      return '🚴';
    case 'yoga':
      return '🧘';
    case 'mobility':
      return '🤸';
    case 'swimming':
      return '🏊';
    case 'walking':
      return '🚶';
    default:
      return '🏋️';
  }
}

function SyncStatusIndicator({ workout }: { workout: UnifiedWorkout }) {
  const { syncStatus } = workout;
  const syncedPlatforms: string[] = [];

  if (syncStatus.garmin?.synced) syncedPlatforms.push('Garmin');
  if (syncStatus.apple?.synced) syncedPlatforms.push('iOS');
  if (syncStatus.android?.synced) syncedPlatforms.push('Android');
  if (syncStatus.strava?.synced) syncedPlatforms.push('Strava');
  if (syncStatus.ios?.synced && !syncStatus.apple?.synced) syncedPlatforms.push('iOS');

  if (syncedPlatforms.length === 0) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Circle className="h-3 w-3" />
        <span className="text-xs">Not synced</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" />
      <span className="text-xs">{syncedPlatforms.join(', ')}</span>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function UnifiedWorkoutCard({
  workout,
  onView,
  onSync,
  onDelete,
  onFollowAlong,
  className,
}: UnifiedWorkoutCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(workout);
    } finally {
      setIsDeleting(false);
    }
  }, [workout, onDelete]);

  const isVideo = workout.sourceType === 'video';
  const hasThumbnail = !!workout.thumbnailUrl;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:shadow-md',
        isDeleting && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <CardContent className="p-0">
        <div className="flex">
          {/* Thumbnail (for video workouts) */}
          {isVideo && hasThumbnail && (
            <div className="relative w-32 h-24 flex-shrink-0 bg-muted">
              <img
                src={workout.thumbnailUrl}
                alt={workout.title}
                className="w-full h-full object-cover"
              />
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-8 w-8 text-white" />
              </div>
              {/* Video platform badge */}
              {workout.videoPlatform && (
                <div className="absolute top-1 left-1">
                  {getVideoPlatformIcon(workout.videoPlatform)}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-3 min-w-0">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h3 className="font-medium text-sm leading-tight truncate">{workout.title}</h3>

                {/* Source and category badges */}
                <div className="flex items-center gap-1.5 mt-1">
                  {/* Category badge */}
                  <span className="text-sm">{getCategoryIcon(workout.category)}</span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {CATEGORY_DISPLAY_NAMES[workout.category]}
                  </Badge>

                  {/* Source badge */}
                  {workout.sourceType === 'device' && workout.devicePlatform && (
                    <div className="flex items-center">
                      {getDevicePlatformIcon(workout.devicePlatform)}
                    </div>
                  )}
                  {workout.sourceType === 'video' && workout.videoPlatform && !hasThumbnail && (
                    <div className="flex items-center">
                      {getVideoPlatformIcon(workout.videoPlatform)}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onView && (
                    <DropdownMenuItem onClick={() => onView(workout)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View details
                    </DropdownMenuItem>
                  )}
                  {isVideo && onFollowAlong && (
                    <DropdownMenuItem onClick={() => onFollowAlong(workout)}>
                      <Play className="h-4 w-4 mr-2" />
                      Follow along
                    </DropdownMenuItem>
                  )}
                  {workout.sourceUrl && (
                    <DropdownMenuItem asChild>
                      <a href={workout.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open source
                      </a>
                    </DropdownMenuItem>
                  )}
                  {onSync && (
                    <DropdownMenuItem onClick={() => onSync(workout)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync to device
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {/* Duration */}
              {workout.durationSec > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(workout.durationSec)}</span>
                </div>
              )}

              {/* Exercise count */}
              {workout.exerciseCount > 0 && (
                <div className="flex items-center gap-1">
                  <Dumbbell className="h-3 w-3" />
                  <span>{workout.exerciseCount} exercises</span>
                </div>
              )}

              {/* Relative time */}
              <span>{getRelativeTime(workout.createdAt)}</span>
            </div>

            {/* Sync status */}
            <div className="mt-2">
              <SyncStatusIndicator workout={workout} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Skeleton Component for Loading State
// =============================================================================

export function UnifiedWorkoutCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          <div className="flex-1 p-3">
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            <div className="flex items-center gap-1.5 mt-2">
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
              <div className="h-5 w-12 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <div className="h-3 w-12 bg-muted rounded animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              <div className="h-3 w-10 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
