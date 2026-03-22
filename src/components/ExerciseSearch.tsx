import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Search, Dumbbell, Loader2, Sparkles } from 'lucide-react';
import { DeviceId } from '../lib/devices';
import { API_URLS } from '../lib/config';

type Props = {
  onSelect: (exerciseName: string) => void;
  onClose: () => void;
  device: DeviceId;
};

interface ExerciseResult {
  id: string;
  name: string;
  aliases: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  category: string | null;
  movement_pattern: string | null;
  difficulty: string | null;
  rank: number;
}

// Equipment display labels
const EQUIPMENT_ICONS: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'BW',
  kettlebell: 'KB',
  resistance_band: 'Band',
  smith_machine: 'Smith',
  pull_up_bar: 'Bar',
  bench: 'Bench',
  medicine_ball: 'Med Ball',
  sled: 'Sled',
};

// Muscle group display labels
const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  lats: 'Lats',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  anterior_deltoid: 'Front Delts',
  lateral_deltoid: 'Side Delts',
  posterior_deltoid: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  core: 'Core',
  abs: 'Abs',
  obliques: 'Obliques',
  calves: 'Calves',
  traps: 'Traps',
  rhomboids: 'Rhomboids',
  forearms: 'Forearms',
  lower_back: 'Lower Back',
  shoulders: 'Shoulders',
  adductors: 'Adductors',
};

export function ExerciseSearch({ onSelect, onClose, device }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search — 150ms delay, hits local DB (< 50ms response)
  const searchExercises = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URLS.MAPPER}/exercises/search?q=${encodeURIComponent(query)}&limit=15`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err: any) {
      console.warn('Exercise search failed:', err);
      setError('Search temporarily unavailable');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!search || search.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      searchExercises(search);
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search, searchExercises]);

  // LLM fallback for unknown exercises
  const classifyExercise = async (name: string) => {
    try {
      setClassifying(true);
      const response = await fetch(`${API_URLS.MAPPER}/exercises/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_name: name }),
      });

      if (response.ok) {
        // Exercise was classified and cached — just select it
        onSelect(name);
      } else {
        // Even if classification fails, let user add it as custom
        onSelect(name);
      }
    } catch {
      onSelect(name);
    } finally {
      setClassifying(false);
    }
  };

  const formatMuscle = (m: string) => MUSCLE_LABELS[m] || m.replace(/_/g, ' ');
  const formatEquipment = (e: string) => EQUIPMENT_ICONS[e] || e.replace(/_/g, ' ');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
          <DialogDescription>
            Search from 800+ exercises. Results appear instantly as you type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises... (e.g., bench, squat, RDL)"
              className="pl-10"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Results */}
          <ScrollArea className="h-[400px]">
            <div data-assistant-target="exercise-search-results" className="space-y-2 pr-4">
              {search.length < 2 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Start typing to search</p>
                  <p className="text-sm mt-1">Search by name, muscle group, or equipment</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No exercises found for "{search}"</p>
                  <p className="text-sm mt-1">We can learn this exercise for you</p>
                </div>
              ) : (
                results.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => onSelect(exercise.name)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{exercise.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {exercise.category && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {exercise.category}
                            </span>
                          )}
                          {exercise.difficulty && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              exercise.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                              exercise.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {exercise.difficulty}
                            </span>
                          )}
                        </div>
                        {exercise.primary_muscles.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {exercise.primary_muscles.slice(0, 3).map((muscle, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {formatMuscle(muscle)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {exercise.equipment.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {exercise.equipment.slice(0, 3).map((eq, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {formatEquipment(eq)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* LLM Fallback — "Not found? We'll learn this exercise" */}
          {search.length >= 2 && results.length === 0 && !loading && (
            <div className="space-y-2">
              <Button
                onClick={() => classifyExercise(search)}
                variant="outline"
                className="w-full"
                disabled={classifying}
              >
                {classifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Learning "{search}"...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Not found? We'll learn "{search}"
                  </>
                )}
              </Button>
              <Button
                onClick={() => onSelect(search)}
                variant="ghost"
                className="w-full text-muted-foreground"
              >
                Or add "{search}" as custom exercise
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
