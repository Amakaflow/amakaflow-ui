import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Repeat, Timer, Dumbbell, Smartphone, Loader2, PlayCircle, Coffee } from 'lucide-react';
import { WorkoutStructure, ValidationResponse } from '../types/workout';
import { applyValidationMappings } from '../lib/workout-utils';
import { API_URLS } from '../lib/config';

interface iOSPreviewModalProps {
  workout: WorkoutStructure;
  validation?: ValidationResponse | null;
  trigger?: React.ReactNode;
}

// Backend preview step format (same as FIT preview)
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
  duration_step?: number;
  intensity?: string;
  is_warmup_set?: boolean;
}

// Group flat steps into nested structure for display
interface GroupedStep {
  type: 'single' | 'repeat-group';
  step?: BackendPreviewStep;
  repeatCount?: number;
  children?: BackendPreviewStep[];
}

function groupStepsForDisplay(steps: BackendPreviewStep[]): GroupedStep[] {
  const grouped: GroupedStep[] = [];
  let i = 0;

  while (i < steps.length) {
    const step = steps[i];

    if (step.type === 'exercise' || step.type === 'warmup') {
      const children: BackendPreviewStep[] = [step];
      let j = i + 1;

      while (j < steps.length && steps[j].type === 'rest') {
        children.push(steps[j]);
        j++;
      }

      if (j < steps.length && steps[j].type === 'repeat') {
        const repeatStep = steps[j];
        const totalSets = repeatStep.repeat_count || 1;
        grouped.push({
          type: 'repeat-group',
          repeatCount: totalSets,
          children: children,
        });
        i = j + 1;
      } else {
        children.forEach(child => {
          grouped.push({ type: 'single', step: child });
        });
        i = j;
      }
    } else if (step.type === 'repeat') {
      grouped.push({ type: 'single', step });
      i++;
    } else {
      grouped.push({ type: 'single', step });
      i++;
    }
  }

  return grouped;
}

export function IOSPreviewModal({ workout, validation, trigger }: iOSPreviewModalProps) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<BackendPreviewStep[]>([]);
  const [sportType, setSportType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedSteps = groupStepsForDisplay(steps);

  useEffect(() => {
    if (!open || !workout) return;

    const fetchPreviewData = async () => {
      setLoading(true);
      setError(null);

      try {
        const MAPPER_API_BASE_URL = API_URLS.MAPPER;
        const mappedWorkout = applyValidationMappings(workout, validation);

        // Fetch preview steps - use same endpoint as Garmin
        const [stepsRes, metadataRes] = await Promise.all([
          fetch(`${MAPPER_API_BASE_URL}/map/preview-steps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks_json: mappedWorkout }),
          }),
          fetch(`${MAPPER_API_BASE_URL}/map/fit-metadata`, {
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

        if (metadataRes.ok) {
          const metadata = await metadataRes.json();
          setSportType(metadata.detected_sport || null);
        }
      } catch (err) {
        console.error('Failed to fetch preview data:', err);
        setError('Failed to load preview');
        setSteps([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [open, workout, validation]);

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Smartphone className="w-4 h-4 mr-2" />
      Preview on iPhone
    </Button>
  );

  const exerciseSteps = steps.filter(s => s.type === 'exercise');
  const totalSets = exerciseSteps.reduce((sum, s) => sum + (s.sets || 1), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>iOS Companion Preview</DialogTitle>
          <DialogDescription>
            How this workout will appear on the AmakaFlow iOS app
          </DialogDescription>
        </DialogHeader>

        {/* iPhone-like display with Dynamic Island */}
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '48px',
          padding: '12px',
          maxWidth: '320px',
          margin: '0 auto'
        }}>
          {/* Dynamic Island */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '8px',
            paddingTop: '4px'
          }}>
            <div style={{
              width: '100px',
              height: '28px',
              backgroundColor: '#000',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Camera dot */}
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#1a1a1a',
                borderRadius: '50%',
                marginLeft: '40px'
              }} />
            </div>
          </div>

          {/* Phone screen */}
          <div style={{
            backgroundColor: '#000',
            borderRadius: '36px',
            padding: '16px',
            minHeight: '420px'
          }}>
            {/* App header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #222'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
                  {workout?.title || 'Workout'}
                </div>
                {sportType && (
                  <span style={{
                    backgroundColor: sportType === 'cardio' ? '#ff453a' :
                                     sportType === 'strength' ? '#5e5ce6' : '#30d158',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'capitalize'
                  }}>
                    {sportType}
                  </span>
                )}
              </div>
            </div>

            {/* Steps section header */}
            <div style={{
              fontSize: '13px',
              color: '#8e8e93',
              marginBottom: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Workout Steps
            </div>

            {loading ? (
              <div style={{
                textAlign: 'center',
                color: '#8e8e93',
                padding: '48px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#30d158' }} />
                <span style={{ fontSize: '14px' }}>Loading preview...</span>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', color: '#ff453a', padding: '48px 0', fontSize: '14px' }}>
                {error}
              </div>
            ) : groupedSteps.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8e8e93', padding: '48px 0', fontSize: '14px' }}>
                No steps found
              </div>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {groupedSteps.map((group, groupIdx) => {
                  // Repeat group
                  if (group.type === 'repeat-group') {
                    return (
                      <div key={groupIdx} style={{
                        backgroundColor: '#1c1c1e',
                        borderRadius: '14px',
                        marginBottom: '10px',
                        overflow: 'hidden'
                      }}>
                        {/* Repeat header */}
                        <div style={{
                          backgroundColor: 'rgba(48, 209, 88, 0.15)',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderBottom: '1px solid rgba(48, 209, 88, 0.2)'
                        }}>
                          <Repeat style={{ width: '16px', height: '16px', color: '#30d158' }} />
                          <span style={{ color: '#30d158', fontSize: '14px', fontWeight: 600 }}>
                            {group.repeatCount} Sets
                          </span>
                        </div>
                        {/* Children steps */}
                        <div style={{ padding: '10px' }}>
                          {group.children?.map((step, childIdx) => (
                            <div key={childIdx}>
                              {step.type === 'exercise' && (
                                <div style={{
                                  backgroundColor: step.is_warmup_set ? 'rgba(255, 159, 10, 0.1)' : 'rgba(10, 132, 255, 0.1)',
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  marginBottom: '8px',
                                  borderLeft: step.is_warmup_set ? '3px solid #ff9f0a' : '3px solid #0a84ff'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Dumbbell style={{
                                      width: '16px',
                                      height: '16px',
                                      color: step.is_warmup_set ? '#ff9f0a' : '#0a84ff'
                                    }} />
                                    <span style={{
                                      color: step.is_warmup_set ? '#ffcc00' : '#64d2ff',
                                      fontSize: '14px',
                                      fontWeight: 500
                                    }}>
                                      {step.display_name}
                                    </span>
                                  </div>
                                  {step.duration_display && (
                                    <div style={{ marginTop: '6px', marginLeft: '26px' }}>
                                      <span style={{
                                        backgroundColor: step.is_warmup_set ? '#663d00' :
                                                       step.duration_type === 'distance' ? '#00664d' :
                                                       step.duration_type === 'time' ? '#5e2e99' : '#003d99',
                                        color: step.is_warmup_set ? '#ffcc00' : 'white',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                      }}>
                                        {step.duration_display}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {step.type === 'rest' && (
                                <div style={{
                                  backgroundColor: 'rgba(142, 142, 147, 0.1)',
                                  borderRadius: '10px',
                                  padding: '8px 12px',
                                  marginBottom: '8px',
                                  borderLeft: '3px solid #8e8e93'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Coffee style={{ width: '14px', height: '14px', color: '#8e8e93' }} />
                                    <span style={{ color: '#8e8e93', fontSize: '13px' }}>Rest</span>
                                    <span style={{
                                      backgroundColor: '#2c2c2e',
                                      color: '#8e8e93',
                                      padding: '3px 10px',
                                      borderRadius: '8px',
                                      fontSize: '12px'
                                    }}>
                                      {step.duration_display || 'Until ready'}
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

                  // Single step
                  const step = group.step!;

                  // Warmup step
                  if (step.type === 'warmup') {
                    return (
                      <div key={groupIdx} style={{
                        backgroundColor: 'rgba(255, 159, 10, 0.1)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        marginBottom: '10px',
                        borderLeft: '3px solid #ff9f0a'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <PlayCircle style={{ width: '16px', height: '16px', color: '#ff9f0a' }} />
                          <span style={{ color: '#ffcc00', fontSize: '14px', fontWeight: 500 }}>Warmup</span>
                          {step.duration_display && (
                            <span style={{
                              backgroundColor: '#663d00',
                              color: '#ffcc00',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              marginLeft: 'auto'
                            }}>
                              {step.duration_display}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Rest step (standalone)
                  if (step.type === 'rest') {
                    return (
                      <div key={groupIdx} style={{
                        backgroundColor: 'rgba(142, 142, 147, 0.1)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        marginBottom: '10px',
                        borderLeft: '3px solid #8e8e93'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Coffee style={{ width: '14px', height: '14px', color: '#8e8e93' }} />
                          <span style={{ color: '#8e8e93', fontSize: '13px' }}>Rest</span>
                          <span style={{
                            backgroundColor: '#2c2c2e',
                            color: '#8e8e93',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}>
                            {step.duration_display || 'Until ready'}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Exercise step (standalone)
                  return (
                    <div key={groupIdx} style={{
                      backgroundColor: step.is_warmup_set ? 'rgba(255, 159, 10, 0.1)' : 'rgba(10, 132, 255, 0.1)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      marginBottom: '10px',
                      borderLeft: step.is_warmup_set ? '3px solid #ff9f0a' : '3px solid #0a84ff'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Dumbbell style={{
                          width: '16px',
                          height: '16px',
                          color: step.is_warmup_set ? '#ff9f0a' : '#0a84ff'
                        }} />
                        <span style={{
                          color: step.is_warmup_set ? '#ffcc00' : '#64d2ff',
                          fontSize: '14px',
                          fontWeight: 500
                        }}>
                          {step.display_name}
                        </span>
                      </div>
                      {step.duration_display && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '6px',
                          marginLeft: '26px'
                        }}>
                          <span style={{
                            backgroundColor: step.is_warmup_set ? '#663d00' :
                                           step.duration_type === 'distance' ? '#00664d' :
                                           step.duration_type === 'time' ? '#5e2e99' : '#003d99',
                            color: step.is_warmup_set ? '#ffcc00' : 'white',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}>
                            {step.duration_display}
                          </span>
                          {step.category_name && (
                            <span style={{
                              backgroundColor: '#2c2c2e',
                              color: '#8e8e93',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '11px'
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

            {/* Footer stats */}
            <div style={{
              textAlign: 'center',
              fontSize: '13px',
              color: '#8e8e93',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid #222'
            }}>
              {steps.length} step{steps.length !== 1 ? 's' : ''}
              {' \u2022 '}{exerciseSteps.length} exercise{exerciseSteps.length !== 1 ? 's' : ''}
              {totalSets > exerciseSteps.length && ` \u2022 ${totalSets} total sets`}
            </div>
          </div>

          {/* iPhone home indicator */}
          <div style={{
            width: '120px',
            height: '5px',
            backgroundColor: '#fff',
            borderRadius: '3px',
            margin: '12px auto 4px auto',
            opacity: 0.3
          }} />
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

export default IOSPreviewModal;
