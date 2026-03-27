import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { cn } from '../ui/utils';
import { Image, Film, Dumbbell } from 'lucide-react';
import type { CarouselSlide, CarouselPost } from './fixtures/carousel-demo';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CarouselSlideSelectorProps {
  post: CarouselPost;
  /** Initially selected slide indices. Defaults to all selected. */
  initialSelected?: number[];
  /** Called when the user clicks "Continue with selected". */
  onContinue: (selectedSlides: CarouselSlide[]) => void;
  onCancel?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function exerciseCountLabel(count: number): string {
  return count === 1 ? '1 exercise' : `${count} exercises`;
}

function slideTypeIcon(type: CarouselSlide['slideType']) {
  return type === 'video'
    ? <Film className="w-4 h-4 text-muted-foreground" aria-label="Video slide" />
    : <Image className="w-4 h-4 text-muted-foreground" aria-label="Image slide" />;
}

// ── Slide card ───────────────────────────────────────────────────────────────

function SlideCard({
  slide,
  total,
  selected,
  onToggle,
}: {
  slide: CarouselSlide;
  total: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const exerciseNames = slide.exercises.map(e => e.name);

  return (
    <Card
      className={cn(
        'transition-colors cursor-pointer',
        selected ? 'border-primary ring-1 ring-primary/30' : 'border-border opacity-70',
      )}
      onClick={onToggle}
      data-testid={`slide-card-${slide.slideIndex}`}
    >
      <CardContent className="p-4 flex items-start gap-3">
        {/* Checkbox */}
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select slide ${slide.slideIndex + 1}`}
          className="mt-0.5 shrink-0"
        />

        {/* Thumbnail placeholder or exercise list */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {slide.slideIndex + 1}/{total}
            </span>
            {slideTypeIcon(slide.slideType)}
            <Badge variant="secondary" className="text-xs">
              <Dumbbell className="w-3 h-3 mr-1" />
              {exerciseCountLabel(slide.exercises.length)}
            </Badge>
          </div>

          {slide.caption && (
            <p className="text-xs text-muted-foreground mb-1 truncate">{slide.caption}</p>
          )}

          {/* Exercise list preview */}
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {exerciseNames.slice(0, 3).map((name) => (
              <li key={name} className="truncate">- {name}</li>
            ))}
            {exerciseNames.length > 3 && (
              <li className="italic">+ {exerciseNames.length - 3} more</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function CarouselSlideSelector({
  post,
  initialSelected,
  onContinue,
  onCancel,
}: CarouselSlideSelectorProps) {
  const allIndices = useMemo(() => post.slides.map((_, i) => i), [post.slides]);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialSelected ?? allIndices),
  );

  const toggleSlide = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allIndices));
  const deselectAll = () => setSelected(new Set());

  const selectedSlides = useMemo(
    () => post.slides.filter((_, i) => selected.has(i)),
    [post.slides, selected],
  );

  const totalExercises = useMemo(
    () => selectedSlides.reduce((sum, s) => sum + s.exercises.length, 0),
    [selectedSlides],
  );

  return (
    <div className="space-y-4" data-testid="carousel-slide-selector">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Carousel Slides</h2>
        <p className="text-sm text-muted-foreground">
          {post.username} &middot; {post.slideCount} slides detected
        </p>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={selectAll} data-testid="select-all-btn">
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={deselectAll} data-testid="deselect-all-btn">
          Deselect All
        </Button>
        <span className="ml-auto text-sm text-muted-foreground" data-testid="selected-count">
          {selected.size} of {post.slideCount} slides selected
          {selected.size > 0 && ` (${totalExercises} exercises)`}
        </span>
      </div>

      {/* Slide cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {post.slides.map((slide) => (
          <SlideCard
            key={slide.slideIndex}
            slide={slide}
            total={post.slideCount}
            selected={selected.has(slide.slideIndex)}
            onToggle={() => toggleSlide(slide.slideIndex)}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-2 border-t">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          className="ml-auto"
          disabled={selected.size === 0}
          onClick={() => onContinue(selectedSlides)}
          data-testid="continue-btn"
        >
          Continue with {selected.size} slide{selected.size !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}
