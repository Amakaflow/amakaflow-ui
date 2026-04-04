import { ArrowRight, CheckCircle, Youtube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

const SAMPLE_EXERCISES = [
  { name: 'Barbell Bench Press', sets: 4, reps: 8, confidence: 92 },
  { name: 'Overhead Press', sets: 3, reps: 10, confidence: 88 },
  { name: 'Incline Dumbbell Press', sets: 3, reps: 12, confidence: 95 },
  { name: 'Tricep Dips', sets: 3, reps: 15, confidence: 85 },
  { name: 'Cable Lateral Raise', sets: 4, reps: 12, confidence: 90 },
];

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

export function SampleWorkoutPreview() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">See what AmakaFlow produces</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Paste a YouTube link and get a structured, ready-to-export workout in seconds.
      </p>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Input side */}
        <div className="flex-1 w-full sm:w-auto">
          <div className="rounded-xl border bg-muted/40 p-4 flex items-center gap-3">
            <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate font-mono">
              https://youtube.com/watch?v=dQw4w9WgXcQ
            </span>
          </div>
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
              {SAMPLE_EXERCISES.map((ex) => (
                <div key={ex.name} className="flex items-center justify-between gap-2">
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
        </div>
      </div>
    </div>
  );
}
