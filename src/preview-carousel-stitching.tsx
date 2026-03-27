/**
 * AMA-1181: Standalone preview for carousel slide selector + block assignment.
 * Served at /carousel-stitching-preview.html during dev.
 */

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { CarouselSlideSelector } from './components/Import/CarouselSlideSelector';
import { CarouselBlockAssignment, type MergedWorkoutPreview } from './components/Import/CarouselBlockAssignment';
import { MOCK_CAROUSEL_POST, type CarouselSlide } from './components/Import/fixtures/carousel-demo';

type DemoPhase = 'select' | 'assign' | 'done';

function CarouselStitchingDemo() {
  const [phase, setPhase] = useState<DemoPhase>('select');
  const [selectedSlides, setSelectedSlides] = useState<CarouselSlide[]>([]);
  const [merged, setMerged] = useState<MergedWorkoutPreview | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Phase indicator */}
        <div className="mb-6 flex items-center gap-3">
          <span className={`text-sm px-2 py-1 rounded ${phase === 'select' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            1. Select Slides
          </span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className={`text-sm px-2 py-1 rounded ${phase === 'assign' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            2. Arrange Blocks
          </span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className={`text-sm px-2 py-1 rounded ${phase === 'done' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            3. Done
          </span>
        </div>

        {phase === 'select' && (
          <CarouselSlideSelector
            post={MOCK_CAROUSEL_POST}
            onContinue={(slides) => {
              setSelectedSlides(slides);
              setPhase('assign');
            }}
          />
        )}

        {phase === 'assign' && (
          <CarouselBlockAssignment
            selectedSlides={selectedSlides}
            workoutTitle="Morning Mobility Flow"
            onConfirm={(m) => {
              setMerged(m);
              setPhase('done');
            }}
            onBack={() => setPhase('select')}
          />
        )}

        {phase === 'done' && merged && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Workout Merged</h2>
            <div className="p-4 border rounded-md bg-muted/30">
              <p className="font-medium">{merged.title}</p>
              <p className="text-sm text-muted-foreground">
                {merged.blocks.length} blocks, {merged.totalExercises} exercises
              </p>
              <ul className="mt-3 space-y-1">
                {merged.blocks.map((b, i) => (
                  <li key={b.slideIndex} className="text-sm">
                    {i + 1}. <strong>{b.blockLabel}</strong> ({b.exercises.length} exercises)
                    <ul className="ml-4 text-xs text-muted-foreground">
                      {b.exercises.map((ex) => (
                        <li key={ex.name}>- {ex.name}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
            <button
              className="text-sm text-primary underline"
              onClick={() => {
                setPhase('select');
                setSelectedSlides([]);
                setMerged(null);
              }}
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<CarouselStitchingDemo />);
