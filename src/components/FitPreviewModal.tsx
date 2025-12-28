import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Repeat, Timer, Dumbbell, Eye, Loader2, PlayCircle, Coffee } from 'lucide-react';
import { WorkoutStructure, ValidationResponse } from '../types/workout';
import { applyValidationMappings } from '../lib/workout-utils';
import { API_URLS } from '../lib/config';

interface FitPreviewModalProps {
  workout: WorkoutStructure;
  validation?: ValidationResponse | null;
  trigger?: React.ReactNode;
  useLapButton?: boolean;
}

// Backend preview step format
interface BackendPreviewStep {
  type: 'exercise' | 'rest' | 'repeat' | 'warmup';
  display_name: string;
  original_name?: string;
  category_id?: number;
  category_name?: string;
  duration_type?: string;
  duration_display?: string;
  reps?: number | string;
  sets?: number;
  rest_seconds?: number;
  repeat_count?: number;
  duration_step?: number; // For repeat steps - which step to repeat from
  intensity?: string;     // AMA-94: 'warmup' or 'active'
  is_warmup_set?: boolean; // AMA-94: Flag for warm-up sets (exercise-specific)
}

// Group flat steps into nested structure like Garmin Connect shows
interface GroupedStep {
  type: 'single' | 'repeat-group';
  step?: BackendPreviewStep;  // For single steps
  repeatCount?: number;       // For repeat groups (e.g., 4 for "4 Sets")
  children?: BackendPreviewStep[];  // Steps inside the repeat group
}

function groupStepsForDisplay(steps: BackendPreviewStep[]): GroupedStep[] {
  const grouped: GroupedStep[] = [];
  let i = 0;

  while (i < steps.length) {
    const step = steps[i];

    // Look ahead for repeat step
    // Pattern: exercise, [rest], repeat -> group them together
    if (step.type === 'exercise' || step.type === 'warmup') {
      const children: BackendPreviewStep[] = [step];
      let j = i + 1;

      // Collect rest steps until we hit a repeat or another exercise
      while (j < steps.length && steps[j].type === 'rest') {
        children.push(steps[j]);
        j++;
      }

      // Check if next step is a repeat
      if (j < steps.length && steps[j].type === 'repeat') {
        const repeatStep = steps[j];
        // repeat_count is the TOTAL number of sets (confirmed by analyzing Garmin activity FIT files)
        const totalSets = repeatStep.repeat_count || 1;
        grouped.push({
          type: 'repeat-group',
          repeatCount: totalSets,
          children: children,
        });
        i = j + 1; // Skip past the repeat step
      } else {
        // No repeat, just add as single steps
        children.forEach(child => {
          grouped.push({ type: 'single', step: child });
        });
        i = j;
      }
    } else if (step.type === 'repeat') {
      // Orphan repeat step (shouldn't happen but handle it)
      grouped.push({ type: 'single', step });
      i++;
    } else {
      // Rest or other step not following an exercise
      grouped.push({ type: 'single', step });
      i++;
    }
  }

  return grouped;
}

export function FitPreviewModal({ workout, validation, trigger, useLapButton = false }: FitPreviewModalProps) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<BackendPreviewStep[]>([]);
  const [sportType, setSportType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group steps for Garmin-style display
  const groupedSteps = groupStepsForDisplay(steps);

  // Fetch preview steps and sport type from backend when modal opens
  useEffect(() => {
    if (!open || !workout) return;

    const fetchPreviewData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use centralized API config
        const MAPPER_API_BASE_URL = API_URLS.MAPPER;
        // Apply validation mappings to use user-confirmed Garmin names
        const mappedWorkout = applyValidationMappings(workout, validation);

        // Fetch both preview steps and metadata in parallel
        const [stepsRes, metadataRes] = await Promise.all([
          fetch(`${MAPPER_API_BASE_URL}/map/preview-steps?use_lap_button=${useLapButton}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks_json: mappedWorkout }),
          }),
          fetch(`${MAPPER_API_BASE_URL}/map/fit-metadata?use_lap_button=${useLapButton}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks_json: mappedWorkout }),
          })
        ]);

        if (!stepsRes.ok) {
          throw new Error('Failed to fetch preview');
        }

        const stepsData = await stepsRes.json();
        setSteps(stepsData.steps || []);

        // Get sport type from metadata
        if (metadataRes.ok) {
          const metadata = await metadataRes.json();
          setSportType(metadata.detected_sport || null);
        }
      } catch (err) {
        console.error('Failed to fetch preview data:', err);
        setError('Failed to load preview');
        // Fallback to empty
        setSteps([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [open, workout, validation, useLapButton]);

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Eye className="w-4 h-4 mr-2" />
      Preview on Watch
    </Button>
  );

  // Filter to only exercise steps for counting
  const exerciseSteps = steps.filter(s => s.type === 'exercise');
  const totalSets = exerciseSteps.reduce((sum, s) => sum + (s.sets || 1), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Garmin Watch Preview</DialogTitle>
          <DialogDescription>
            How this workout will appear on your Garmin watch
          </DialogDescription>
        </DialogHeader>

        {/* Watch-like display */}
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '24px', padding: '20px' }}>
          <div style={{ border: '2px solid #333', borderRadius: '16px', padding: '16px', backgroundColor: '#000' }}>
            {/* Workout title and sport type */}
            <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                {workout?.title || 'Workout'}
              </div>
              {sportType && (
                <span style={{
                  backgroundColor: sportType === 'cardio' ? '#dc2626' :
                                   sportType === 'running' ? '#16a34a' : '#6366f1',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}>
                  {sportType}
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#60a5fa' }} />
                <span>Loading preview...</span>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', color: '#ef4444', padding: '32px 0' }}>
                {error}
              </div>
            ) : groupedSteps.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '32px 0' }}>
                No steps found
              </div>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {groupedSteps.map((group, groupIdx) => {
                  // Repeat group - container with children (like Garmin Connect)
                  if (group.type === 'repeat-group') {
                    return (
                      <div key={groupIdx} style={{
                        border: '1px solid #22c55e',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        overflow: 'hidden'
                      }}>
                        {/* Repeat header */}
                        <div style={{
                          backgroundColor: 'rgba(34, 197, 94, 0.2)',
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderBottom: '1px solid #22c55e'
                        }}>
                          <Repeat style={{ width: '14px', height: '14px', color: '#4ade80' }} />
                          <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: 600 }}>
                            {group.repeatCount} Sets
                          </span>
                        </div>
                        {/* Children steps inside repeat */}
                        <div style={{ padding: '8px 8px 0 8px' }}>
                          {group.children?.map((step, childIdx) => (
                            <div key={childIdx}>
                              {step.type === 'exercise' && (
                                <div style={{
                                  borderLeft: step.is_warmup_set ? '3px solid #f59e0b' : '3px solid #3b82f6',
                                  paddingLeft: '12px',
                                  marginBottom: '8px',
                                  backgroundColor: step.is_warmup_set ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                  borderRadius: '0 8px 8px 0',
                                  padding: '6px 8px 6px 12px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Dumbbell style={{ width: '14px', height: '14px', color: step.is_warmup_set ? '#f59e0b' : '#60a5fa' }} />
                                    <span style={{ color: step.is_warmup_set ? '#fbbf24' : '#93c5fd', fontSize: '13px', fontWeight: 500 }}>{step.display_name}</span>
                                  </div>
                                  {step.duration_display && (
                                    <div style={{ marginTop: '4px', marginLeft: '22px' }}>
                                      <span style={{
                                        backgroundColor: step.is_warmup_set ? '#78350f' :
                                                       step.duration_type === 'distance' ? '#059669' :
                                                       step.duration_type === 'time' ? '#7c3aed' :
                                                       step.duration_type === 'lap_button' ? '#78350f' : '#1d4ed8',
                                        color: step.is_warmup_set || step.duration_type === 'lap_button' ? '#fbbf24' : 'white',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '10px'
                                      }}>
                                        {step.duration_display}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {step.type === 'rest' && (
                                <div style={{
                                  borderLeft: '3px solid #6b7280',
                                  paddingLeft: '12px',
                                  marginBottom: '8px',
                                  backgroundColor: 'rgba(107, 114, 128, 0.1)',
                                  borderRadius: '0 8px 8px 0',
                                  padding: '4px 8px 4px 12px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Coffee style={{ width: '12px', height: '12px', color: '#9ca3af' }} />
                                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>Rest</span>
                                    <span style={{
                                      backgroundColor: step.duration_type === 'lap_button' ? '#78350f' : '#374151',
                                      color: step.duration_type === 'lap_button' ? '#fbbf24' : '#9ca3af',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '10px'
                                    }}>
                                      {step.duration_display || 'Lap Button'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // Single step (not in a repeat group)
                  const step = group.step!;

                  // Warmup step
                  if (step.type === 'warmup') {
                    return (
                      <div key={groupIdx} style={{
                        borderLeft: '3px solid #f59e0b',
                        paddingLeft: '12px',
                        marginBottom: '8px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderRadius: '0 8px 8px 0',
                        padding: '6px 8px 6px 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PlayCircle style={{ width: '14px', height: '14px', color: '#f59e0b' }} />
                          <span style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 500 }}>Warmup</span>
                          {step.duration_display && (
                            <span style={{
                              backgroundColor: '#78350f',
                              color: '#fbbf24',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              marginLeft: 'auto'
                            }}>
                              {step.duration_display}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Rest step (standalone, not in repeat)
                  if (step.type === 'rest') {
                    return (
                      <div key={groupIdx} style={{
                        borderLeft: '3px solid #6b7280',
                        paddingLeft: '12px',
                        marginBottom: '8px',
                        backgroundColor: 'rgba(107, 114, 128, 0.1)',
                        borderRadius: '0 8px 8px 0',
                        padding: '4px 8px 4px 12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Coffee style={{ width: '12px', height: '12px', color: '#9ca3af' }} />
                          <span style={{ color: '#9ca3af', fontSize: '12px' }}>Rest</span>
                          <span style={{
                            backgroundColor: step.duration_type === 'lap_button' ? '#78350f' : '#374151',
                            color: step.duration_type === 'lap_button' ? '#fbbf24' : '#9ca3af',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px'
                          }}>
                            {step.duration_display || 'Lap Button'}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Exercise step (standalone, not in repeat)
                  // AMA-94: Use amber styling for warm-up sets
                  return (
                    <div key={groupIdx} style={{
                      borderLeft: step.is_warmup_set ? '3px solid #f59e0b' : '3px solid #3b82f6',
                      paddingLeft: '12px',
                      marginBottom: '8px',
                      backgroundColor: step.is_warmup_set ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '0 8px 8px 0',
                      padding: '6px 8px 6px 12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Dumbbell style={{ width: '14px', height: '14px', color: step.is_warmup_set ? '#f59e0b' : '#60a5fa' }} />
                        <span style={{ color: step.is_warmup_set ? '#fbbf24' : '#93c5fd', fontSize: '13px', fontWeight: 500 }}>{step.display_name}</span>
                      </div>
                      {step.duration_display && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginLeft: '22px', fontSize: '11px' }}>
                          <span style={{
                            backgroundColor: step.is_warmup_set ? '#78350f' :
                                           step.duration_type === 'distance' ? '#059669' :
                                           step.duration_type === 'time' ? '#7c3aed' :
                                           step.duration_type === 'lap_button' ? '#78350f' : '#1d4ed8',
                            color: step.is_warmup_set || step.duration_type === 'lap_button' ? '#fbbf24' : 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px'
                          }}>
                            {step.duration_display}
                          </span>
                          {step.category_name && (
                            <span style={{
                              backgroundColor: '#374151',
                              color: '#9ca3af',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '9px'
                            }}>
                              {step.category_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              {steps.length} step{steps.length !== 1 ? 's' : ''}
              {' \u2022 '}{exerciseSteps.length} exercise{exerciseSteps.length !== 1 ? 's' : ''}
              {totalSets > exerciseSteps.length && ` \u2022 ${totalSets} total sets`}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground pt-2">
          <div className="flex items-center gap-1">
            <PlayCircle className="w-3 h-3 text-amber-500" />
            <span>Warmup</span>
          </div>
          <div className="flex items-center gap-1">
            <Dumbbell className="w-3 h-3 text-amber-500" />
            <span>Warm-Up Set</span>
          </div>
          <div className="flex items-center gap-1">
            <Dumbbell className="w-3 h-3 text-blue-500" />
            <span>Exercise</span>
          </div>
          <div className="flex items-center gap-1">
            <Coffee className="w-3 h-3 text-gray-500" />
            <span>Rest</span>
          </div>
          <div className="flex items-center gap-1">
            <Repeat className="w-3 h-3 text-green-500" />
            <span>Repeat</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FitPreviewModal;
