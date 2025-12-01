import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { 
  Smartphone, 
  Watch, 
  Loader2, 
  Video, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Play,
  Link,
  X,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkoutStructure, Block, Exercise } from '../types/workout';

type VideoSourceType = 'original' | 'custom' | 'none';

interface StepConfig {
  exerciseId: string;
  exerciseName: string;
  videoSource: VideoSourceType;
  customUrl: string;
  startTimeSec: number;
}

interface FollowAlongSetupProps {
  workout: WorkoutStructure;
  userId: string;
  sourceUrl?: string;
}

// Format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Parse MM:SS to seconds
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return parseInt(timeStr, 10) || 0;
}

export function FollowAlongSetup({ workout, userId, sourceUrl }: FollowAlongSetupProps) {
  const [enabled, setEnabled] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTimestamp, setPreviewTimestamp] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const [sendTarget, setSendTarget] = useState<'ios' | 'watch' | 'both' | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isLoadingDuration, setIsLoadingDuration] = useState(false);

  const MAPPER_API_BASE_URL = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

  // Fetch video duration when sourceUrl changes
  useEffect(() => {
    if (!sourceUrl) return;
    
    const isYouTube = sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be');
    if (!isYouTube) return;

    setIsLoadingDuration(true);
    
    // Try to get duration from the workout provenance or fetch it
    const fetchDuration = async () => {
      try {
        // Check if workout has provenance with duration
        const provenance = (workout as any)?._provenance;
        if (provenance?.video_duration_sec) {
          setVideoDuration(provenance.video_duration_sec);
          return;
        }

        // Otherwise, fetch from ingestor
        const videoId = getYouTubeId(sourceUrl);
        if (videoId) {
          const response = await fetch(
            `${MAPPER_API_BASE_URL.replace('8001', '8004')}/youtube/info?video_id=${videoId}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.duration_sec) {
              setVideoDuration(data.duration_sec);
            }
          }
        }
      } catch (error) {
        console.warn('Could not fetch video duration:', error);
      } finally {
        setIsLoadingDuration(false);
      }
    };

    fetchDuration();
  }, [sourceUrl, workout, MAPPER_API_BASE_URL]);

  // Initialize step configs from workout with timestamps from LLM or estimated
  useEffect(() => {
    if (!workout?.blocks) return;

    const configs: StepConfig[] = [];
    let stepIndex = 0;
    let totalExercises = 0;

    // First count total exercises
    workout.blocks.forEach((block: Block) => {
      totalExercises += block.exercises?.length || 0;
    });

    // Get video duration from provenance or state
    const provenance = (workout as any)?._provenance;
    const durationFromProvenance = provenance?.video_duration_sec;
    const effectiveDuration = videoDuration || durationFromProvenance;
    
    // Calculate fallback time per exercise if no timestamps in data
    const introBuffer = effectiveDuration ? effectiveDuration * 0.05 : 0;
    const usableDuration = effectiveDuration ? effectiveDuration * 0.9 : 0;
    const timePerExercise = totalExercises > 0 ? usableDuration / totalExercises : 0;

    workout.blocks.forEach((block: Block) => {
      block.exercises?.forEach((exercise: Exercise) => {
        // Use video_start_sec from LLM if available, otherwise estimate
        const exerciseAny = exercise as any;
        const llmTimestamp = exerciseAny.video_start_sec;
        const estimatedTime = effectiveDuration 
          ? Math.floor(introBuffer + (stepIndex * timePerExercise))
          : 0;
        
        configs.push({
          exerciseId: exercise.id || `step-${stepIndex}`,
          exerciseName: exercise.name,
          videoSource: sourceUrl ? 'original' : 'none',
          customUrl: '',
          startTimeSec: llmTimestamp ?? estimatedTime,
        });
        stepIndex++;
      });
    });

    setStepConfigs(configs);
    
    // Update video duration from provenance if not already set
    if (!videoDuration && durationFromProvenance) {
      setVideoDuration(durationFromProvenance);
    }
  }, [workout, sourceUrl, videoDuration]);

  const updateStepConfig = (exerciseId: string, updates: Partial<StepConfig>) => {
    setStepConfigs(prev => 
      prev.map(config => 
        config.exerciseId === exerciseId 
          ? { ...config, ...updates }
          : config
      )
    );
  };

  const handlePreview = (url: string, timestamp: number) => {
    setPreviewUrl(url);
    setPreviewTimestamp(timestamp);
  };

  const handleSend = async (target: 'ios' | 'watch' | 'both') => {
    if (!workout || !userId) {
      toast.error('Workout data or user missing');
      return;
    }

    setIsSending(true);
    setSendTarget(target);

    try {
      const saveResponse = await fetch(`${MAPPER_API_BASE_URL}/follow-along/from-workout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          workout,
          sourceUrl: sourceUrl || '',
          stepConfigs: stepConfigs,
        }),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to create follow-along workout');
      }

      const { followAlongWorkoutId, success, message } = await saveResponse.json();
      
      if (!success) {
        throw new Error(message || 'Failed to create follow-along workout');
      }

      if (target === 'ios' || target === 'both') {
        await fetch(
          `${MAPPER_API_BASE_URL}/follow-along/${followAlongWorkoutId}/push/ios-companion`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }
        );
      }

      if (target === 'watch' || target === 'both') {
        await fetch(
          `${MAPPER_API_BASE_URL}/follow-along/${followAlongWorkoutId}/push/apple-watch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }
        );
      }

      const targetName = target === 'ios' 
        ? 'iPhone' 
        : target === 'watch' 
        ? 'Apple Watch' 
        : 'iPhone & Apple Watch';

      toast.success(`Sent to ${targetName}!`, {
        description: 'Open the AmakaFlow app to start your follow-along workout',
      });

    } catch (error: any) {
      console.error('Failed to send follow-along:', error);
      toast.error(`Failed to send: ${error.message}`);
    } finally {
      setIsSending(false);
      setSendTarget(null);
    }
  };

  const exerciseCount = stepConfigs.length;
  const stepsWithVideo = stepConfigs.filter(s => s.videoSource !== 'none').length;
  
  const isYouTubeSource = sourceUrl?.includes('youtube.com') || sourceUrl?.includes('youtu.be');

  return (
    <Card className={enabled ? 'border-primary ring-2 ring-primary/20' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Video className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Follow-Along Mode</CardTitle>
              <CardDescription>
                Send this workout to your phone for guided follow-along
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{enabled ? 'On' : 'Off'}</span>
            <Switch 
              checked={enabled} 
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4 pt-0">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <span className="font-medium">{exerciseCount} exercises</span>
              <span className="text-muted-foreground"> • </span>
              <span className="text-muted-foreground">{stepsWithVideo} with video</span>
              {videoDuration && (
                <>
                  <span className="text-muted-foreground"> • </span>
                  <span className="text-muted-foreground">{formatTime(videoDuration)} total</span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSteps(!showSteps)}
            >
              {showSteps ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide Steps
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Configure Steps
                </>
              )}
            </Button>
          </div>

          {/* Original Video Source */}
          {sourceUrl && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {isYouTubeSource && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                    YouTube
                  </span>
                )}
                <span className="text-sm truncate max-w-[200px]">{sourceUrl}</span>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {isLoadingDuration ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : videoDuration ? (
                <span className="text-sm text-muted-foreground">
                  {formatTime(videoDuration)}
                </span>
              ) : null}
            </div>
          )}

          {/* Per-Step Configuration */}
          {showSteps && (
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-3">
                {stepConfigs.map((config, idx) => (
                  <div
                    key={config.exerciseId}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-sm flex-1">{config.exerciseName}</span>
                      {config.videoSource !== 'none' && videoDuration && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          ~{formatTime(config.startTimeSec)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Select
                        value={config.videoSource}
                        onValueChange={(value: VideoSourceType) =>
                          updateStepConfig(config.exerciseId, { videoSource: value })
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceUrl && (
                            <SelectItem value="original">
                              <div className="flex items-center gap-2">
                                <Video className="w-3 h-3" />
                                {isYouTubeSource ? 'YouTube' : 'Original'}
                              </div>
                            </SelectItem>
                          )}
                          <SelectItem value="custom">
                            <div className="flex items-center gap-2">
                              <Link className="w-3 h-3" />
                              Custom URL
                            </div>
                          </SelectItem>
                          <SelectItem value="none">
                            <div className="flex items-center gap-2">
                              <X className="w-3 h-3" />
                              No Video
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {config.videoSource === 'original' && sourceUrl && (
                        <>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <Input
                              value={formatTime(config.startTimeSec)}
                              onChange={(e) => {
                                const seconds = parseTime(e.target.value);
                                updateStepConfig(config.exerciseId, { startTimeSec: seconds });
                              }}
                              className="w-[70px] h-8 text-sm text-center"
                              placeholder="0:00"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(sourceUrl, config.startTimeSec)}
                            className="h-8"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Preview
                          </Button>
                        </>
                      )}

                      {config.videoSource === 'custom' && (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            placeholder="https://instagram.com/p/..."
                            value={config.customUrl}
                            onChange={(e) =>
                              updateStepConfig(config.exerciseId, { customUrl: e.target.value })
                            }
                            className="text-sm h-8"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(config.customUrl, 0)}
                            disabled={!config.customUrl}
                            className="h-8"
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Send Buttons */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Send to:</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => handleSend('ios')}
                disabled={isSending}
                className="flex-col h-auto py-3"
              >
                {isSending && sendTarget === 'ios' ? (
                  <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                ) : (
                  <Smartphone className="w-5 h-5 mb-1" />
                )}
                <span className="text-xs">iPhone</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSend('watch')}
                disabled={isSending}
                className="flex-col h-auto py-3"
              >
                {isSending && sendTarget === 'watch' ? (
                  <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                ) : (
                  <Watch className="w-5 h-5 mb-1" />
                )}
                <span className="text-xs">Apple Watch</span>
              </Button>
              <Button
                variant="default"
                onClick={() => handleSend('both')}
                disabled={isSending}
                className="flex-col h-auto py-3"
              >
                {isSending && sendTarget === 'both' ? (
                  <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                ) : (
                  <div className="flex gap-1 mb-1">
                    <Smartphone className="w-4 h-4" />
                    <Watch className="w-4 h-4" />
                  </div>
                )}
                <span className="text-xs">Both</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Follow along on your phone—watch is optional
            </p>
          </div>
        </CardContent>
      )}

      {/* Video Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Video</DialogTitle>
            <DialogDescription>
              {previewTimestamp > 0 && `Starting at ${formatTime(previewTimestamp)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewUrl && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {previewUrl.includes('youtube.com') || previewUrl.includes('youtu.be') ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeId(previewUrl)}?start=${previewTimestamp}&autoplay=1`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : previewUrl.includes('instagram.com') ? (
                  <div className="text-center p-8">
                    <p className="text-muted-foreground mb-4">Instagram videos can't be embedded</p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Instagram
                    </a>
                  </div>
                ) : (
                  <video src={previewUrl} controls autoPlay className="w-full h-full" />
                )}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setPreviewUrl(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Helper function to extract YouTube video ID
function getYouTubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : '';
}