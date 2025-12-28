import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Search, Dumbbell, Loader2 } from 'lucide-react';
import { DeviceId } from '../lib/devices';
import { API_URLS } from '../lib/config';

type Props = {
  onSelect: (exerciseName: string) => void;
  onClose: () => void;
  device: DeviceId;
};

interface WgerExercise {
  id: number;
  name: string;
  description_plain: string;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  image_urls: string[];
  source: string;
}

// Mock exercise library - fallback if API fails
const EXERCISE_LIBRARY: Record<DeviceId, Array<{ name: string; category: string; confidence: number }>> = {
  garmin: [
    { name: 'Barbell Back Squat', category: 'Strength', confidence: 0.95 },
    { name: 'Deadlift', category: 'Strength', confidence: 0.95 },
    { name: 'Bench Press', category: 'Strength', confidence: 0.95 },
    { name: 'Pull-ups', category: 'Strength', confidence: 0.90 },
    { name: 'Overhead Press', category: 'Strength', confidence: 0.90 },
    { name: 'Romanian Deadlift', category: 'Strength', confidence: 0.85 },
    { name: 'Lunges', category: 'Strength', confidence: 0.85 },
    { name: 'Dumbbell Row', category: 'Strength', confidence: 0.85 },
    { name: 'Bicep Curl', category: 'Strength', confidence: 0.80 },
    { name: 'Tricep Extension', category: 'Strength', confidence: 0.80 },
    { name: 'Leg Press', category: 'Strength', confidence: 0.80 },
    { name: 'Lat Pulldown', category: 'Strength', confidence: 0.80 },
    { name: 'Running', category: 'Cardio', confidence: 0.95 },
    { name: 'Cycling', category: 'Cardio', confidence: 0.95 },
    { name: 'Rowing', category: 'Cardio', confidence: 0.90 },
    { name: 'Jump Rope', category: 'Cardio', confidence: 0.85 },
    { name: 'Box Jumps', category: 'Plyometric', confidence: 0.80 },
    { name: 'Burpees', category: 'Plyometric', confidence: 0.80 },
    { name: 'Plank', category: 'Core', confidence: 0.90 },
    { name: 'Russian Twists', category: 'Core', confidence: 0.85 },
  ],
  apple: [
    { name: 'Push-ups', category: 'Strength', confidence: 0.90 },
    { name: 'Squats', category: 'Strength', confidence: 0.90 },
    { name: 'Lunges', category: 'Strength', confidence: 0.85 },
    { name: 'Plank', category: 'Core', confidence: 0.90 },
    { name: 'Running', category: 'Cardio', confidence: 0.95 },
    { name: 'Walking', category: 'Cardio', confidence: 0.95 },
    { name: 'Cycling', category: 'Cardio', confidence: 0.95 },
    { name: 'Swimming', category: 'Cardio', confidence: 0.90 },
    { name: 'HIIT', category: 'Cardio', confidence: 0.85 },
    { name: 'Yoga', category: 'Flexibility', confidence: 0.90 },
    { name: 'Stretching', category: 'Flexibility', confidence: 0.85 },
    { name: 'Jump Rope', category: 'Cardio', confidence: 0.85 },
    { name: 'Burpees', category: 'Plyometric', confidence: 0.80 },
    { name: 'Mountain Climbers', category: 'Plyometric', confidence: 0.80 },
  ],
  zwift: [
    { name: 'Cycling - Endurance', category: 'Cycling', confidence: 0.95 },
    { name: 'Cycling - Tempo', category: 'Cycling', confidence: 0.95 },
    { name: 'Cycling - Threshold', category: 'Cycling', confidence: 0.95 },
    { name: 'Cycling - VO2 Max', category: 'Cycling', confidence: 0.95 },
    { name: 'Cycling - Sprint', category: 'Cycling', confidence: 0.95 },
    { name: 'Running - Easy', category: 'Running', confidence: 0.90 },
    { name: 'Running - Tempo', category: 'Running', confidence: 0.90 },
    { name: 'Running - Interval', category: 'Running', confidence: 0.90 },
    { name: 'Recovery Ride', category: 'Cycling', confidence: 0.85 },
    { name: 'Hill Climb', category: 'Cycling', confidence: 0.85 },
  ]
};

export function ExerciseSearch({ onSelect, onClose, device }: Props) {
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState<WgerExercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<WgerExercise[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch exercises from WGER API
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        setLoading(true);
        // Use centralized API config
        const API_BASE_URL = API_URLS.INGESTOR;
        const response = await fetch(`${API_BASE_URL}/exercises/wger`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch exercises: ${response.statusText}`);
        }
        
        const data = await response.json();
        setExercises(data.exercises || []);
        setError(null);
      } catch (err: any) {
        console.warn('Failed to fetch WGER exercises, using fallback:', err);
        setError('Using limited exercise library');
        // Fallback to mock data
        const mockExercises: WgerExercise[] = EXERCISE_LIBRARY[device].map((ex, idx) => ({
          id: idx,
          name: ex.name,
          description_plain: '',
          category: ex.category,
          primary_muscles: [],
          secondary_muscles: [],
          equipment: [],
          image_urls: [],
          source: 'mock'
        }));
        setExercises(mockExercises);
      } finally {
        setLoading(false);
      }
    };

    fetchExercises();
  }, [device]);

  // Filter exercises
  useEffect(() => {
    let results = exercises;

    // Filter by category
    if (selectedCategory) {
      results = results.filter(e => e.category === selectedCategory);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.description_plain.toLowerCase().includes(searchLower) ||
        e.primary_muscles.some(m => m.toLowerCase().includes(searchLower)) ||
        e.equipment.some(eq => eq.toLowerCase().includes(searchLower))
      );
    }

    setFilteredExercises(results);
  }, [search, selectedCategory, exercises]);

  const categories = [...new Set(exercises.map(e => e.category).filter(Boolean))] as string[];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
          <DialogDescription>
            Search and select an exercise from the WGER exercise database, or create a custom exercise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={selectedCategory === null ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                size="sm"
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading exercises...</span>
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Results */}
          {!loading && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {filteredExercises.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No exercises found</p>
                    <p className="text-sm">Try a different search term</p>
                  </div>
                ) : (
                  filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      onClick={() => onSelect(exercise.name)}
                      className="w-full text-left p-3 border rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{exercise.name}</p>
                          {exercise.category && (
                            <p className="text-sm text-muted-foreground">{exercise.category}</p>
                          )}
                          {exercise.primary_muscles.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {exercise.primary_muscles.slice(0, 3).map((muscle, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {muscle}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {exercise.source === 'wger' && (
                          <Badge variant="outline" className="text-xs">
                            WGER
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {/* Custom Exercise */}
          {search && filteredExercises.length === 0 && (
            <Button
              onClick={() => onSelect(search)}
              variant="outline"
              className="w-full"
            >
              Add "{search}" as custom exercise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
