/**
 * AMA-1180: Follow-along merge player for multi-source workouts.
 *
 * When blocks from different video sources are merged into a workout,
 * this player shows the current block's video segment and can switch
 * between video sources per block.
 */

import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { PlatformIcon } from './PlatformIcon';
import {
  PLATFORM_BADGE_COLORS,
  PLATFORM_LABELS,
  type SourcePlatform,
  type VideoSegment,
} from './fixtures/multi-source-demo';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MergedBlock {
  id: string;
  label: string;
  sourcePlatform: SourcePlatform;
  sourceUrl: string;
  videoSegment?: VideoSegment;
  exercises: Array<{
    name: string;
    sets?: number;
    reps?: number | string;
    duration_sec?: number;
  }>;
}

interface FollowAlongMergePlayerProps {
  workoutTitle: string;
  blocks: MergedBlock[];
  onClose?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FollowAlongMergePlayer({
  workoutTitle,
  blocks,
  onClose,
}: FollowAlongMergePlayerProps) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentBlock = blocks[currentBlockIndex];
  const hasPrev = currentBlockIndex > 0;
  const hasNext = currentBlockIndex < blocks.length - 1;

  // Group blocks by source for the timeline
  const sourceTimeline = useMemo(() => {
    return blocks.map((block, idx) => ({
      ...block,
      index: idx,
      isCurrent: idx === currentBlockIndex,
    }));
  }, [blocks, currentBlockIndex]);

  if (!currentBlock) return null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4" data-testid="follow-along-player">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{workoutTitle}</h2>
          <p className="text-sm text-muted-foreground">
            Block {currentBlockIndex + 1} of {blocks.length}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Video area placeholder */}
      <Card className="overflow-hidden">
        <div className="aspect-video bg-zinc-900 flex items-center justify-center relative">
          {/* Platform badge overlay */}
          <div className="absolute top-3 left-3">
            <Badge
              className={cn(
                'gap-1.5 px-2.5 py-1',
                PLATFORM_BADGE_COLORS[currentBlock.sourcePlatform]
              )}
            >
              <PlatformIcon
                platform={currentBlock.sourcePlatform}
                className="w-3.5 h-3.5"
              />
              {PLATFORM_LABELS[currentBlock.sourcePlatform]}
            </Badge>
          </div>

          {/* Timestamp overlay */}
          {currentBlock.videoSegment && (
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="font-mono text-xs">
                {formatTime(currentBlock.videoSegment.startSec)} -{' '}
                {formatTime(currentBlock.videoSegment.endSec)}
              </Badge>
            </div>
          )}

          {/* Center play button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </button>

          {/* Block label overlay */}
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-white text-sm font-medium drop-shadow-lg">
              {currentBlock.label}
            </p>
          </div>
        </div>
      </Card>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => setCurrentBlockIndex(i => i - 1)}
          className="gap-1"
        >
          <SkipBack className="w-4 h-4" />
          Prev
        </Button>

        <Button
          size="sm"
          onClick={() => setIsPlaying(!isPlaying)}
          className="gap-1 min-w-[80px]"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Play
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => setCurrentBlockIndex(i => i + 1)}
          className="gap-1"
        >
          Next
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      {/* Open in source app */}
      <div className="flex justify-center">
        <a
          href={currentBlock.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Open in {PLATFORM_LABELS[currentBlock.sourcePlatform]}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Current block exercises */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">{currentBlock.label}</p>
          <div className="space-y-1">
            {currentBlock.exercises.map((ex, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm py-1"
              >
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                  {i + 1}
                </div>
                <span className="flex-1">{ex.name}</span>
                <span className="text-muted-foreground text-xs">
                  {ex.sets && ex.reps && `${ex.sets}x${ex.reps}`}
                  {ex.duration_sec && !ex.reps && `${ex.duration_sec}s`}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Block timeline with source indicators */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Workout Timeline</p>
        <div
          className="flex gap-1 overflow-x-auto pb-2 snap-x snap-mandatory touch-pan-x"
          data-testid="block-timeline"
        >
          {sourceTimeline.map(block => (
            <button
              key={block.id}
              onClick={() => setCurrentBlockIndex(block.index)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-md border text-xs shrink-0 min-w-[80px] snap-start transition-colors',
                block.isCurrent
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <PlatformIcon
                platform={block.sourcePlatform}
                className="w-4 h-4"
              />
              <span className="truncate max-w-[70px]">{block.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Swipe hint on mobile */}
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground sm:hidden">
        <ChevronLeft className="w-3 h-3" />
        Swipe to browse blocks
        <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  );
}
