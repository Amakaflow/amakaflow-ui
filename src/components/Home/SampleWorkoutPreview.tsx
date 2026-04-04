import { useState, useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, Youtube, Loader2, Play, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { View } from '../../app/router';

const DEMO_URL = 'https://youtube.com/watch?v=dQw4w9WgXcQ';

const SAMPLE_EXERCISES = [
  { name: 'Barbell Bench Press', sets: 4, reps: 8, confidence: 92 },
  { name: 'Overhead Press', sets: 3, reps: 10, confidence: 88 },
  { name: 'Incline Dumbbell Press', sets: 3, reps: 12, confidence: 95 },
  { name: 'Tricep Dips', sets: 3, reps: 15, confidence: 85 },
  { name: 'Cable Lateral Raise', sets: 4, reps: 12, confidence: 90 },
];

// Walkthrough steps
type WalkthroughStep = 'idle' | 'typing' | 'processing' | 'result';

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
      : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800';
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {score}% match
    </span>
  );
}

interface SampleWorkoutPreviewProps {
  onNavigate?: (view: View) => void;
}

export function SampleWorkoutPreview({ onNavigate }: SampleWorkoutPreviewProps = {}) {
  const [step, setStep] = useState<WalkthroughStep>('idle');
  const [typedUrl, setTypedUrl] = useState('');
  const [visibleExercises, setVisibleExercises] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearAllTimeouts() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }

  function scheduleTimeout(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }

  function runDemo() {
    clearAllTimeouts();
    setStep('typing');
    setTypedUrl('');
    setVisibleExercises(0);

    // Type out URL character by character
    let i = 0;
    function typeNext() {
      if (i < DEMO_URL.length) {
        const charIdx = i;
        scheduleTimeout(() => {
          setTypedUrl(DEMO_URL.slice(0, charIdx + 1));
          i++;
          typeNext();
        }, 30);
      } else {
        // URL typed — start processing
        scheduleTimeout(() => {
          setStep('processing');
          scheduleTimeout(() => {
            setStep('result');
            // Reveal exercises one by one
            SAMPLE_EXERCISES.forEach((_, idx) => {
              scheduleTimeout(() => setVisibleExercises(idx + 1), idx * 120);
            });
          }, 1500);
        }, 400);
      }
    }
    typeNext();
  }

  // Reset when unmounted
  useEffect(() => () => clearAllTimeouts(), []);

  function handleTryItLive() {
    if (onNavigate) {
      // Navigate to import with a pre-filled URL via query param
      onNavigate('import');
    } else if (typeof window !== 'undefined') {
      // Fallback: navigate via window location
      window.location.href = '/import?url=' + encodeURIComponent(DEMO_URL);
    }
  }

  const isPlaying = step !== 'idle';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold">See what AmakaFlow produces</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Paste a YouTube link and get a structured, ready-to-export workout in seconds.
          </p>
        </div>
        <div className="flex gap-2 sm:ml-4 sm:flex-shrink-0">
          {!isPlaying && (
            <Button
              size="sm"
              variant="outline"
              onClick={runDemo}
              className="gap-1.5 text-xs flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
            >
              <Play className="w-3.5 h-3.5" />
              Watch demo
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleTryItLive}
            className="gap-1.5 text-xs flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Try it live
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4">
        {/* Input side */}
        <div className="flex-1 w-full sm:w-auto">
          <div className="rounded-xl border bg-muted/40 p-4 flex items-center gap-3 min-h-[56px]">
            <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
            {step === 'idle' ? (
              <span className="text-sm text-muted-foreground truncate font-mono">
                {DEMO_URL}
              </span>
            ) : (
              <span className="text-sm text-foreground truncate font-mono">
                {typedUrl}
                {(step === 'typing') && (
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                )}
              </span>
            )}
          </div>

          {/* Step indicators */}
          {isPlaying && (
            <div className="mt-2 flex items-center gap-2">
              {(['typing', 'processing', 'result'] as WalkthroughStep[]).map((s, idx) => {
                const isActive = step === s;
                const isDone =
                  (s === 'typing' && (step === 'processing' || step === 'result')) ||
                  (s === 'processing' && step === 'result');
                return (
                  <div key={s} className="flex items-center gap-1">
                    <div
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isDone
                          ? 'bg-green-500'
                          : isActive
                          ? 'bg-primary animate-pulse'
                          : 'bg-muted-foreground/30'
                      }`}
                    />
                    <span
                      className={`text-xs transition-colors ${
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {s === 'typing' ? '1. Paste URL' : s === 'processing' ? '2. AI parsing' : '3. Structured'}
                    </span>
                    {idx < 2 && <span className="text-muted-foreground/40 text-xs">→</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Arrow */}
        <div className="hidden sm:flex items-center justify-center">
          <ArrowRight className="w-6 h-6 text-primary" />
        </div>
        <div className="flex sm:hidden items-center justify-center w-full">
          <div className="rotate-90">
            <ArrowRight className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Output side */}
        <div className="flex-1 w-full sm:w-auto">
          {step === 'processing' ? (
            <Card className="border-primary/20">
              <CardContent className="px-4 py-8 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing workout structure...</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/20">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-tight">
                    Upper Body Push Day
                  </CardTitle>
                  <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 flex-shrink-0 text-xs">
                    Ready for Garmin
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {SAMPLE_EXERCISES.map((ex, idx) => (
                  <div
                    key={ex.name}
                    className={`flex items-center justify-between gap-2 transition-all duration-300 ${
                      step === 'result' && idx < visibleExercises
                        ? 'opacity-100 translate-y-0'
                        : step === 'idle'
                        ? 'opacity-100'
                        : 'opacity-0 translate-y-1'
                    }`}
                    style={{ transitionDelay: step === 'result' ? `${idx * 40}ms` : '0ms' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-xs truncate">{ex.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {ex.sets}×{ex.reps}
                      </span>
                    </div>
                    <ConfidenceBadge score={ex.confidence} />
                  </div>
                ))}

                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground italic">
                    Every exercise is validated by you before export
                  </span>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 flex-shrink-0">
                    AI-assisted with human verification
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reset link when demo is done */}
      {step === 'result' && (
        <div className="mt-2 text-center">
          <button
            onClick={() => { setStep('idle'); setTypedUrl(''); setVisibleExercises(0); clearAllTimeouts(); }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Reset demo
          </button>
        </div>
      )}
    </div>
  );
}
