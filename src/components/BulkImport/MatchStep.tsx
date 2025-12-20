/**
 * MatchStep Component
 *
 * Step 3 of bulk import: Exercise matching.
 * Matches imported exercise names to Garmin exercise database.
 * Shows confidence scores and allows user to confirm/change matches.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useBulkImport } from '../../context/BulkImportContext';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';
import { bulkImportApi, ExerciseSearchResult } from '../../lib/bulk-import-api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { ExerciseMatch, ExerciseMatchStatus } from '../../types/bulk-import';

// State for exercise search
interface ExerciseSearchState {
  query: string;
  results: ExerciseSearchResult[];
  isLoading: boolean;
}

interface MatchStepProps {
  userId: string;
}

// Status config for visual styling
const statusConfig: Record<ExerciseMatchStatus, { icon: typeof CheckCircle; label: string; color: string; bg: string }> = {
  matched: { icon: CheckCircle, label: 'Matched', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  needs_review: { icon: AlertTriangle, label: 'Review', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  unmapped: { icon: XCircle, label: 'No Match', color: 'text-red-400', bg: 'bg-red-500/10' },
  new: { icon: Plus, label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

// Confidence color helper
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 90) return 'text-emerald-400';
  if (confidence >= 70) return 'text-amber-400';
  if (confidence >= 50) return 'text-orange-400';
  return 'text-red-400';
};

export function MatchStep({ userId }: MatchStepProps) {
  const { state, dispatch, goNext } = useBulkImport();
  const { matchExercises, updateExerciseMatch, generatePreview } = useBulkImportApi({ userId });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ExerciseMatchStatus | 'all'>('all');
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());

  // Per-exercise search state
  const [exerciseSearches, setExerciseSearches] = useState<Record<string, ExerciseSearchState>>({});
  const searchTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Trigger matching on mount if not already done
  useEffect(() => {
    if (state.matches.exercises.length === 0 && !state.loading) {
      matchExercises();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(searchTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  // Handle exercise search with debounce
  const handleExerciseSearch = useCallback((exerciseId: string, query: string) => {
    // Update search query immediately
    setExerciseSearches(prev => ({
      ...prev,
      [exerciseId]: {
        query,
        results: prev[exerciseId]?.results || [],
        isLoading: query.length >= 2,
      },
    }));

    // Clear existing timeout
    if (searchTimeoutRef.current[exerciseId]) {
      clearTimeout(searchTimeoutRef.current[exerciseId]);
    }

    // Don't search for very short queries
    if (query.length < 2) {
      setExerciseSearches(prev => ({
        ...prev,
        [exerciseId]: { query, results: [], isLoading: false },
      }));
      return;
    }

    // Debounce the API call
    searchTimeoutRef.current[exerciseId] = setTimeout(async () => {
      try {
        const response = await bulkImportApi.searchExercises(query, 10);
        setExerciseSearches(prev => ({
          ...prev,
          [exerciseId]: {
            query,
            results: response.results,
            isLoading: false,
          },
        }));
      } catch (error) {
        console.error('Exercise search failed:', error);
        setExerciseSearches(prev => ({
          ...prev,
          [exerciseId]: {
            query,
            results: [],
            isLoading: false,
          },
        }));
      }
    }, 300);
  }, []);

  // Filter exercises
  const filteredExercises = useMemo(() => {
    return state.matches.exercises.filter(exercise => {
      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!exercise.originalName.toLowerCase().includes(query) &&
            !exercise.matchedGarminName?.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Filter by status
      if (filterStatus !== 'all' && exercise.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [state.matches.exercises, searchQuery, filterStatus]);

  // Count by status
  const statusCounts = useMemo(() => {
    const counts: Record<ExerciseMatchStatus | 'all', number> = {
      all: state.matches.exercises.length,
      matched: 0,
      needs_review: 0,
      unmapped: 0,
      new: 0,
    };
    state.matches.exercises.forEach(e => {
      counts[e.status]++;
    });
    return counts;
  }, [state.matches.exercises]);

  // Toggle exercise expansion
  const toggleExpanded = useCallback((id: string) => {
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select a suggestion
  const handleSelectSuggestion = useCallback((exerciseId: string, garminName: string) => {
    updateExerciseMatch(exerciseId, garminName);
    setExpandedExercises(prev => {
      const next = new Set(prev);
      next.delete(exerciseId);
      return next;
    });
  }, [updateExerciseMatch]);

  // Mark as new exercise
  const handleMarkAsNew = useCallback((exerciseId: string) => {
    dispatch({
      type: 'UPDATE_EXERCISE_MATCH',
      id: exerciseId,
      updates: {
        status: 'new',
        matchedGarminName: null,
        userSelection: undefined,
      },
    });
    dispatch({ type: 'ADD_NEW_EXERCISE', exerciseName: exerciseId });
  }, [dispatch]);

  // Accept all high-confidence matches
  const handleAcceptAll = useCallback(() => {
    state.matches.exercises.forEach(exercise => {
      if (exercise.status === 'needs_review' && exercise.confidence >= 70 && exercise.matchedGarminName) {
        dispatch({
          type: 'UPDATE_EXERCISE_MATCH',
          id: exercise.id,
          updates: {
            status: 'matched',
            userSelection: exercise.matchedGarminName,
          },
        });
      }
    });
  }, [state.matches.exercises, dispatch]);

  // Check if can proceed
  const canProceed = useMemo(() => {
    return state.matches.exercises.every(
      e => e.status === 'matched' || e.status === 'new'
    );
  }, [state.matches.exercises]);

  // Handle proceed
  const handleProceed = useCallback(async () => {
    await generatePreview();
  }, [generatePreview]);

  // Loading state
  if (state.loading && state.matches.exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-medium mb-2">Matching Exercises</h3>
        <p className="text-muted-foreground max-w-md">
          Finding matches in the Garmin exercise database...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['matched', 'needs_review', 'unmapped', 'new'] as const).map(status => {
          const config = statusConfig[status];
          const count = statusCounts[status];
          const IconComponent = config.icon;

          return (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                filterStatus === status
                  ? 'border-primary bg-primary/5'
                  : 'border-white/10 hover:border-white/20 hover:bg-white/5'
              )}
            >
              <IconComponent className={cn('w-5 h-5', config.color)} />
              <span className="text-2xl font-bold">{count}</span>
              <span className="text-xs text-muted-foreground">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Accept All Banner */}
      {statusCounts.needs_review > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <p className="font-medium text-amber-400">
                {statusCounts.needs_review} exercise{statusCounts.needs_review !== 1 ? 's' : ''} need review
              </p>
              <p className="text-sm text-amber-400/70">
                Accept suggested matches or select alternatives
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAcceptAll}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Accept All Suggestions
          </Button>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(value) => setFilterStatus(value as ExerciseMatchStatus | 'all')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({statusCounts.all})</SelectItem>
            <SelectItem value="matched">Matched ({statusCounts.matched})</SelectItem>
            <SelectItem value="needs_review">Review ({statusCounts.needs_review})</SelectItem>
            <SelectItem value="unmapped">No Match ({statusCounts.unmapped})</SelectItem>
            <SelectItem value="new">New ({statusCounts.new})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exercise List */}
      <div className="space-y-2">
        {filteredExercises.map(exercise => {
          const config = statusConfig[exercise.status];
          const IconComponent = config.icon;
          const isExpanded = expandedExercises.has(exercise.id);

          return (
            <div
              key={exercise.id}
              className={cn(
                'rounded-xl border transition-all',
                exercise.status === 'matched' ? 'border-white/10 bg-white/[0.02]' : 'border-white/10 bg-white/5'
              )}
            >
              {/* Main Row */}
              <button
                onClick={() => toggleExpanded(exercise.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                {/* Expand Icon */}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}

                {/* Status Icon */}
                <div className={cn('p-1.5 rounded-lg', config.bg)}>
                  <IconComponent className={cn('w-4 h-4', config.color)} />
                </div>

                {/* Exercise Names */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{exercise.originalName}</span>
                    {exercise.occurrenceCount > 1 && (
                      <Badge variant="secondary" className="text-[10px]">
                        ×{exercise.occurrenceCount}
                      </Badge>
                    )}
                  </div>
                  {exercise.matchedGarminName && (
                    <p className="text-sm text-muted-foreground truncate">
                      → {exercise.matchedGarminName}
                    </p>
                  )}
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2">
                  {exercise.status !== 'new' && (
                    <span className={cn('text-sm font-medium', getConfidenceColor(exercise.confidence))}>
                      {exercise.confidence}%
                    </span>
                  )}
                  <Badge variant="secondary" className={cn('text-xs', config.bg, config.color)}>
                    {config.label}
                  </Badge>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-white/5">
                  <div className="pt-4 space-y-4">
                    {/* Search for exercises */}
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Search Garmin exercises:</p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Type to search (e.g., 'run', 'squat')..."
                          value={exerciseSearches[exercise.id]?.query || ''}
                          onChange={(e) => handleExerciseSearch(exercise.id, e.target.value)}
                          className="pl-10"
                        />
                        {exerciseSearches[exercise.id]?.isLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {/* Search Results */}
                      {exerciseSearches[exercise.id]?.results.length > 0 && (
                        <div className="grid gap-1 max-h-48 overflow-y-auto">
                          {exerciseSearches[exercise.id].results.map((result, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                handleSelectSuggestion(exercise.id, result.name);
                                // Clear search after selection
                                setExerciseSearches(prev => ({
                                  ...prev,
                                  [exercise.id]: { query: '', results: [], isLoading: false },
                                }));
                              }}
                              className={cn(
                                'flex items-center justify-between p-2 rounded-lg border transition-all text-left text-sm',
                                exercise.userSelection === result.name
                                  ? 'border-primary bg-primary/10'
                                  : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {exercise.userSelection === result.name ? (
                                  <CheckCircle className="w-3 h-3 text-primary" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border-2 border-white/20" />
                                )}
                                <span>{result.name}</span>
                              </div>
                              <span className={cn('text-xs', getConfidenceColor(result.score))}>
                                {Math.round(result.score)}%
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* No results message */}
                      {exerciseSearches[exercise.id]?.query.length >= 2 &&
                        !exerciseSearches[exercise.id]?.isLoading &&
                        exerciseSearches[exercise.id]?.results.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2">
                          No matching exercises found for &quot;{exerciseSearches[exercise.id]?.query}&quot;
                        </p>
                      )}
                    </div>

                    {/* Suggestions */}
                    {exercise.suggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Suggested matches:</p>
                        <div className="grid gap-2">
                          {exercise.suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSelectSuggestion(exercise.id, suggestion.name)}
                              className={cn(
                                'flex items-center justify-between p-3 rounded-lg border transition-all text-left',
                                exercise.userSelection === suggestion.name
                                  ? 'border-primary bg-primary/10'
                                  : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {exercise.userSelection === suggestion.name ? (
                                  <CheckCircle className="w-4 h-4 text-primary" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                                )}
                                <span className="font-medium">{suggestion.name}</span>
                              </div>
                              <span className={cn('text-sm font-medium', getConfidenceColor(suggestion.confidence * 100))}>
                                {Math.round(suggestion.confidence * 100)}%
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Create New Option */}
                    <button
                      onClick={() => handleMarkAsNew(exercise.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left',
                        exercise.status === 'new'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {exercise.status === 'new' ? (
                          <CheckCircle className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">Create as new exercise</span>
                      </div>
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-400">
                        New
                      </Badge>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredExercises.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Search className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No exercises match your search</p>
        </div>
      )}

      {/* Proceed Button */}
      <Button
        onClick={handleProceed}
        disabled={!canProceed || state.loading}
        className="w-full h-12 text-base"
        size="lg"
      >
        {state.loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating Preview...
          </>
        ) : canProceed ? (
          <>
            <CheckCircle className="w-5 h-5 mr-2" />
            Continue to Preview
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5 mr-2" />
            Resolve All Exercises to Continue
          </>
        )}
      </Button>
    </div>
  );
}

export default MatchStep;
