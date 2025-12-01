import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  ArrowRight,
  Sparkles,
  Watch,
  Bike
} from 'lucide-react';
import { ValidationResponse, ValidationResult, WorkoutStructure } from '../types/workout';
import { DeviceId, getDeviceById } from '../lib/devices';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { EnhancedMapping } from './EnhancedMapping';
import { toast } from 'sonner';

interface ValidateMapProps {
  validation: ValidationResponse;
  workout: WorkoutStructure;
  onReValidate: (workout: WorkoutStructure) => void;
  onProcess: (workout: WorkoutStructure) => void;
  loading: boolean;
  selectedDevice: DeviceId;
}

export function ValidateMap({ 
  validation, 
  workout,
  onReValidate, 
  onProcess,
  loading,
  selectedDevice
}: ValidateMapProps) {
  const [localValidation, setLocalValidation] = useState(validation);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [confirmedMappings, setConfirmedMappings] = useState<Set<string>>(new Set());

  const handleApplyMapping = (exerciseName: string, newMapping: string) => {
    // Update the local validation state
    const updatedValidation = { ...localValidation };
    
    // Find and update the exercise in all categories
    const updateExercise = (exercises: ValidationResult[]) => {
      return exercises.map(ex => 
        ex.original_name === exerciseName 
          ? { ...ex, mapped_to: newMapping, confidence: 0.95, status: 'valid' as const }
          : ex
      );
    };

    updatedValidation.validated_exercises = updateExercise(updatedValidation.validated_exercises);
    updatedValidation.needs_review = updateExercise(updatedValidation.needs_review);
    updatedValidation.unmapped_exercises = updateExercise(updatedValidation.unmapped_exercises);

    // Track which exercise was just updated for visual feedback
    const prevMappedTo = [
      ...updatedValidation.validated_exercises,
      ...updatedValidation.needs_review,
      ...updatedValidation.unmapped_exercises
    ].find(ex => ex.original_name === exerciseName)?.mapped_to;

    // Move updated exercise to validated - remove from both needs_review AND unmapped_exercises
    // First, check if exercise exists in needs_review
    const exerciseInNeedsReview = updatedValidation.needs_review.find(
      ex => ex.original_name === exerciseName
    );
    
    // Then check if exercise exists in unmapped_exercises
    const exerciseInUnmapped = updatedValidation.unmapped_exercises.find(
      ex => ex.original_name === exerciseName
    );
    
    // Use whichever one we find, prioritizing needs_review
    const movedExercise = exerciseInNeedsReview || exerciseInUnmapped;

    if (movedExercise) {
      updatedValidation.validated_exercises.push({
        ...movedExercise,
        mapped_to: newMapping,
        confidence: 0.95,
        status: 'valid'
      });
      // Remove from BOTH arrays to ensure no duplicates
      updatedValidation.needs_review = updatedValidation.needs_review.filter(
        ex => ex.original_name !== exerciseName
      );
      updatedValidation.unmapped_exercises = updatedValidation.unmapped_exercises.filter(
        ex => ex.original_name !== exerciseName
      );
      // Update can_proceed: true only if no unmapped exercises remain
      // Note: We still need to check for unconfirmed mappings separately in canExport
      updatedValidation.can_proceed = updatedValidation.unmapped_exercises.length === 0;
    }

    setLocalValidation(updatedValidation);
    
    // Mark as recently updated for visual feedback
    setRecentlyUpdated(new Set([...recentlyUpdated, exerciseName]));
    
    // Clear the "recently updated" flag after animation completes (3 seconds)
    setTimeout(() => {
      setRecentlyUpdated(prev => {
        const next = new Set(prev);
        next.delete(exerciseName);
        return next;
      });
    }, 3000);
    
    // Show toast with before/after info
    if (prevMappedTo && prevMappedTo !== newMapping) {
      toast.success(`Mapping updated: "${exerciseName}" → "${newMapping}"`, {
        description: `Previously mapped to: ${prevMappedTo}`,
        duration: 4000,
      });
    } else {
      toast.success(`Mapping applied: "${exerciseName}" → "${newMapping}"`, {
        duration: 3000,
      });
    }
  };

  const handleAcceptMapping = (exerciseName: string) => {
    // Add to confirmed mappings
    const updatedConfirmed = new Set([...confirmedMappings, exerciseName]);
    setConfirmedMappings(updatedConfirmed);
    
    // Move confirmed exercise from needs_review to validated_exercises
    const updatedValidation = { ...localValidation };
    
    // Find the exercise in needs_review (prioritize this)
    let confirmedExercise = updatedValidation.needs_review.find(
      ex => ex.original_name === exerciseName
    );
    
    // If not in needs_review, check unmapped_exercises
    if (!confirmedExercise) {
      confirmedExercise = updatedValidation.unmapped_exercises.find(
        ex => ex.original_name === exerciseName
      );
    }
    
    if (confirmedExercise) {
      // Remove from needs_review
      updatedValidation.needs_review = updatedValidation.needs_review.filter(
        ex => ex.original_name !== exerciseName
      );
      
      // Also remove from unmapped_exercises to prevent it appearing there
      updatedValidation.unmapped_exercises = updatedValidation.unmapped_exercises.filter(
        ex => ex.original_name !== exerciseName
      );
      
      // Add to validated_exercises with confirmed status
      updatedValidation.validated_exercises.push({
        ...confirmedExercise,
        mapped_to: confirmedExercise.mapped_to || confirmedExercise.original_name, // Ensure mapped_to is set
        status: 'valid' as const,
        confidence: Math.max(confirmedExercise.confidence, 0.95)
      });
      
      // Update can_proceed: true only if no unmapped exercises remain
      // Note: Unconfirmed mappings are checked separately in canExport logic
      updatedValidation.can_proceed = updatedValidation.unmapped_exercises.length === 0;
      
      setLocalValidation(updatedValidation);
    }
    
    toast.success(`Confirmed mapping for ${exerciseName}`, {
      duration: 2000,
    });
  };

  // Apply mapped names from validation to workout structure
  const applyMappedNamesToWorkout = (workoutToUpdate: WorkoutStructure): WorkoutStructure => {
    // Create a map of original_name -> mapped_to for all confirmed mappings
    const nameMapping = new Map<string, string>();
    // Also store original names for notes (only for Garmin)
    const originalNames = new Map<string, string>();
    
    // Get all confirmed mappings from validated_exercises and needs_review
    [...localValidation.validated_exercises, ...localValidation.needs_review].forEach(ex => {
      if (confirmedMappings.has(ex.original_name) && ex.mapped_to && ex.mapped_to !== ex.original_name) {
        nameMapping.set(ex.original_name, ex.mapped_to);
        originalNames.set(ex.mapped_to, ex.original_name); // Store reverse mapping for notes
      }
    });
    
    // If no mappings, return original workout
    if (nameMapping.size === 0) {
      return workoutToUpdate;
    }
    
    // Check if we're exporting to Garmin (need to add original names to notes)
    const isGarmin = selectedDevice === 'garmin';
    
    // Deep clone the workout to avoid mutating the original
    const updatedWorkout: WorkoutStructure = {
      ...workoutToUpdate,
      blocks: workoutToUpdate.blocks.map(block => ({
        ...block,
        exercises: (block.exercises || []).map(exercise => {
          const mappedName = nameMapping.get(exercise.name);
          if (mappedName) {
            // Update exercise name to mapped name
            const updatedExercise = { ...exercise, name: mappedName };
            
            // For Garmin, add original name to notes
            if (isGarmin) {
              const originalName = originalNames.get(mappedName) || exercise.name;
              // Preserve existing notes, add original name
              if (updatedExercise.notes) {
                updatedExercise.notes = `${updatedExercise.notes} (Original: ${originalName})`;
              } else {
                updatedExercise.notes = `Original: ${originalName}`;
              }
            }
            
            return updatedExercise;
          }
          return exercise;
        }),
        // Also handle supersets if they exist
        supersets: block.supersets?.map(superset => ({
          ...superset,
          exercises: superset.exercises.map(exercise => {
            const mappedName = nameMapping.get(exercise.name);
            if (mappedName) {
              // Update exercise name to mapped name
              const updatedExercise = { ...exercise, name: mappedName };
              
              // For Garmin, add original name to notes
              if (isGarmin) {
                const originalName = originalNames.get(mappedName) || exercise.name;
                // Preserve existing notes, add original name
                if (updatedExercise.notes) {
                  updatedExercise.notes = `${updatedExercise.notes} (Original: ${originalName})`;
                } else {
                  updatedExercise.notes = `Original: ${originalName}`;
                }
              }
              
              return updatedExercise;
            }
            return exercise;
          })
        })) || []
      }))
    };
    
    return updatedWorkout;
  };

  const handleConfirmAll = () => {
    const allMappedExercises = new Set<string>();
    
    // Get all exercises that have mappings (from both validated_exercises and needs_review)
    [...localValidation.validated_exercises, ...localValidation.needs_review].forEach(ex => {
      if (ex.mapped_to && ex.mapped_to !== ex.original_name) {
        allMappedExercises.add(ex.original_name);
      }
    });
    
    const unconfirmed = [...allMappedExercises].filter(name => !confirmedMappings.has(name));
    
    if (unconfirmed.length === 0) {
      toast.info('All mappings are already confirmed');
      return;
    }
    
    // Update confirmed mappings
    const updatedConfirmed = new Set([...confirmedMappings, ...allMappedExercises]);
    setConfirmedMappings(updatedConfirmed);
    
    // Also update localValidation to move confirmed exercises from needs_review to validated_exercises
    const updatedValidation = { ...localValidation };
    
    // Move all confirmed exercises from needs_review to validated_exercises
    const exercisesToMove = updatedValidation.needs_review.filter(
      ex => updatedConfirmed.has(ex.original_name) && ex.mapped_to && ex.mapped_to !== ex.original_name
    );
    
    // Remove from needs_review
    updatedValidation.needs_review = updatedValidation.needs_review.filter(
      ex => !updatedConfirmed.has(ex.original_name) || !ex.mapped_to || ex.mapped_to === ex.original_name
    );
    
    // Remove from unmapped_exercises if they're there
    updatedValidation.unmapped_exercises = updatedValidation.unmapped_exercises.filter(
      ex => !updatedConfirmed.has(ex.original_name)
    );
    
    // Add to validated_exercises (avoid duplicates)
    exercisesToMove.forEach(ex => {
      if (!updatedValidation.validated_exercises.some(e => e.original_name === ex.original_name)) {
        updatedValidation.validated_exercises.push({
          ...ex,
          mapped_to: ex.mapped_to || ex.original_name,
          status: 'valid' as const,
          confidence: Math.max(ex.confidence, 0.95)
        });
      }
    });
    
    // Update can_proceed: true if no unmapped exercises remain
    updatedValidation.can_proceed = updatedValidation.unmapped_exercises.length === 0;
    
    setLocalValidation(updatedValidation);
    
    toast.success(`Confirmed ${unconfirmed.length} mapping(s)`, {
      duration: 3000,
    });
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <Badge className="bg-green-500">🟢 {(confidence * 100).toFixed(0)}%</Badge>;
    } else if (confidence >= 0.7) {
      return <Badge className="bg-orange-500">🟠 {(confidence * 100).toFixed(0)}%</Badge>;
    } else {
      return <Badge variant="destructive">🔴 {(confidence * 100).toFixed(0)}%</Badge>;
    }
  };

  // Filter out exercises that appear in both needs_review and unmapped (show them only in needs_review)
  // Also filter out exercises that are already confirmed (in validated_exercises)
  // Ensure unmapped exercises don't have a mapped_to value (clear any pre-set mappings)
  const uniqueUnmappedExercises = localValidation.unmapped_exercises
    .filter(result => 
      !localValidation.needs_review.some(ex => ex.original_name === result.original_name) &&
      !localValidation.validated_exercises.some(ex => ex.original_name === result.original_name) &&
      !confirmedMappings.has(result.original_name)
    )
    .map(result => ({
      ...result,
      mapped_to: undefined, // Ensure unmapped exercises don't have pre-set mappings
      status: 'unmapped' as const
    }));

  // Get exercises that need review but haven't been confirmed
  const unconfirmedNeedsReview = localValidation.needs_review.filter(
    result => {
      const hasMapping = result.mapped_to && result.mapped_to !== result.original_name;
      const isConfirmed = confirmedMappings.has(result.original_name);
      return hasMapping && !isConfirmed;
    }
  );

  // Get exercises in validated_exercises that have mappings but haven't been confirmed
  // These are exercises that were auto-validated but still need user confirmation
  const unconfirmedValidated = localValidation.validated_exercises.filter(
    result => {
      const hasMapping = result.mapped_to && result.mapped_to !== result.original_name;
      const isConfirmed = confirmedMappings.has(result.original_name);
      return hasMapping && !isConfirmed;
    }
  );

  // Check if export should be disabled
  const hasUnmapped = uniqueUnmappedExercises.length > 0;
  const hasUnconfirmedMappings = unconfirmedNeedsReview.length > 0 || unconfirmedValidated.length > 0;
  
  // Export should be disabled if:
  // 1. There are unmapped exercises, OR
  // 2. There are unconfirmed mappings (in either needs_review OR validated_exercises)
  // IMPORTANT: We check our own state, not just localValidation.can_proceed,
  // because can_proceed from API doesn't account for confirmation status
  // If all exercises are mapped and confirmed, we can export regardless of can_proceed
  const finalCanExport = !hasUnmapped && !hasUnconfirmedMappings;

  // Get reason why export is disabled
  const getExportDisabledReason = () => {
    if (hasUnmapped) {
      return `Cannot export: ${uniqueUnmappedExercises.length} exercise(s) need to be mapped`;
    }
    if (hasUnconfirmedMappings) {
      const totalUnconfirmed = unconfirmedNeedsReview.length + unconfirmedValidated.length;
      return `Cannot export: ${totalUnconfirmed} mapping(s) need to be confirmed`;
    }
    return '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Validate & Map</h2>
        <p className="text-muted-foreground">
          Review mapping confidence and fix any issues before export
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl mb-1">{localValidation.total_exercises}</div>
              <div className="text-sm text-muted-foreground">Total Exercises</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl mb-1 text-green-600">
                {localValidation.validated_exercises.length}
              </div>
              <div className="text-sm text-muted-foreground">Validated</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl mb-1 text-orange-600">
                {unconfirmedNeedsReview.length}
              </div>
              <div className="text-sm text-muted-foreground">Needs Review</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl mb-1 text-red-600">
                {uniqueUnmappedExercises.length}
              </div>
              <div className="text-sm text-muted-foreground">Unmapped</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Alert */}
      {!localValidation.can_proceed && uniqueUnmappedExercises.length > 0 && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <div>Cannot automatically proceed</div>
                <div className="text-sm text-muted-foreground">
                  You have {uniqueUnmappedExercises.length} unmapped exercise(s) that need attention
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm All Button - Show if there are any unconfirmed mappings */}
      {(unconfirmedNeedsReview.length > 0 || unconfirmedValidated.length > 0) && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Confirm All Mappings</div>
                <div className="text-sm text-muted-foreground">
                  Confirm all mapped exercises at once
                </div>
              </div>
              <Button onClick={handleConfirmAll} variant="default">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Tabs */}
      <Tabs defaultValue="needs-review" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="validated" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Validated ({localValidation.validated_exercises.length})
          </TabsTrigger>
          <TabsTrigger value="needs-review" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Needs Review ({unconfirmedNeedsReview.length})
          </TabsTrigger>
          <TabsTrigger value="unmapped" className="gap-2">
            <XCircle className="w-4 h-4" />
            Unmapped ({uniqueUnmappedExercises.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="validated" className="space-y-3">
          {localValidation.validated_exercises.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No validated exercises yet
              </CardContent>
            </Card>
          ) : (
            localValidation.validated_exercises.map((result, idx) => (
              <EnhancedMapping
                key={`validated-${result.original_name}-${idx}`}
                result={result}
                onApplyMapping={handleApplyMapping}
                onAcceptMapping={handleAcceptMapping}
                isRecentlyUpdated={recentlyUpdated.has(result.original_name)}
                isConfirmed={confirmedMappings.has(result.original_name)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="needs-review" className="space-y-3">
          {unconfirmedNeedsReview.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No exercises need review
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-yellow-900 dark:text-yellow-100">
                        Review Required
                      </div>
                      <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        These exercises have suggested mappings but need your confirmation. Review each one and click "Confirm" to accept the mapping, or "Change Mapping" to select a different exercise.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {unconfirmedNeedsReview.map((result, idx) => (
                <EnhancedMapping
                  key={`review-${result.original_name}-${idx}`}
                  result={result}
                  onApplyMapping={handleApplyMapping}
                  onAcceptMapping={handleAcceptMapping}
                  isRecentlyUpdated={recentlyUpdated.has(result.original_name)}
                  isConfirmed={confirmedMappings.has(result.original_name)}
                />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="unmapped" className="space-y-3">
          {uniqueUnmappedExercises.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No unmapped exercises
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-red-900 dark:text-red-100">
                        Action Required
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                        These exercises are not mapped yet. Click "Find & Select Mapping" to see AI suggestions, or search for alternatives. You must map all exercises before exporting.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {uniqueUnmappedExercises.map((result, idx) => (
                <EnhancedMapping
                  key={`unmapped-${result.original_name}-${idx}`}
                  result={result}
                  onApplyMapping={handleApplyMapping}
                  onAcceptMapping={handleAcceptMapping}
                  isRecentlyUpdated={recentlyUpdated.has(result.original_name)}
                  isConfirmed={confirmedMappings.has(result.original_name)}
                />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Target Device Info */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            {selectedDevice === 'zwift' ? (
              <Bike className="w-6 h-6 text-primary" />
            ) : (
              <Watch className="w-6 h-6 text-primary" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Target Device:</span>
                <Badge>
                  {getDeviceById(selectedDevice)?.name || selectedDevice}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Validation checked against {getDeviceById(selectedDevice)?.name || selectedDevice} exercise library
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end pb-32 mb-4">
        <Button
          variant="outline"
          onClick={() => onReValidate(workout)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Re-Validate
        </Button>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={() => {
              // Apply mapped names to workout before processing
              const workoutWithMappedNames = applyMappedNamesToWorkout(workout);
              onProcess(workoutWithMappedNames);
            }}
            disabled={loading || !finalCanExport}
            variant={finalCanExport ? 'default' : 'secondary'}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            Export to {getDeviceById(selectedDevice)?.name || selectedDevice}
          </Button>
          {!finalCanExport && !loading && (
            <p className="text-xs text-muted-foreground text-right">
              {getExportDisabledReason()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}