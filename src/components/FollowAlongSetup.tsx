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
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkoutStructure, Block, Exercise } from '../types/workout';

type VideoSourceType = 'original' | 'custom' | 'none';

interface StepConfig {
  exerciseId: string;
  exerciseName: string;
  videoSource: VideoSourceType;
  customUrl: string;
}

interface FollowAlongSetupProps {
  workout: WorkoutStructure;
  userId: string;
  sourceUrl?: string;
}

export function FollowAlongSetup({ workout, userId, sourceUrl }: FollowAlongSetupProps) {
  const [enabled, setEnabled] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendTarget, setSendTarget] = useState<'ios' | 'watch' | 'both' | null>(null);

  const MAPPER_API_BASE_URL = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

  // Initialize step configs from workout
  useEffect(() => {
    if (!workout?.blocks) return;

    const configs: StepConfig[] = [];
    let stepIndex = 0;

    workout.blocks.forEach((block: Block) => {
      block.exercises?.forEach((exercise: Exercise) => {
        configs.push({
          exerciseId: exercise.id || `step-${stepIndex}`,
          exerciseName: exercise.name,
          videoSource: sourceUrl ? 'original' : 'none',
          customUrl: '',
        });
        stepIndex++;
      });
    });

    setStepConfigs(configs);
  }, [workout, sourceUrl]);

  const updateStepConfig = (exerciseId: string, updates: Partial<StepConfig>) => {
    setStepConfigs(prev => 
      prev.map(config => 
        config.exerciseId === exerciseId 
          ? { ...config, ...updates }
          : config
      )
    );
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
          stepConfigs: stepConfigs, // Send step configurations
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

  const getVideoSourceLabel = (source: VideoSourceType) => {
    switch (source) {
      case 'original':
        return isYouTubeSource ? 'YouTube Video' : 'Original Video';
      case 'custom':
        return 'Custom URL';
      case 'none':
        return 'No Video';
    }
  };

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
                <span className="text-sm truncate max-w-[250px]">{sourceUrl}</span>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Per-Step Configuration */}
          {showSteps && (
            <ScrollArea className="h-[300px] pr-4">
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
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={config.videoSource}
                        onValueChange={(value: VideoSourceType) =>
                          updateStepConfig(config.exerciseId, { videoSource: value })
                        }
                      >
                        <SelectTrigger className="w-[160px]">
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

                      {config.videoSource === 'custom' && (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            placeholder="https://instagram.com/p/..."
                            value={config.customUrl}
                            onChange={(e) =>
                              updateStepConfig(config.exerciseId, { customUrl: e.target.value })
                            }
                            className="text-sm h-9"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewUrl(config.customUrl)}
                            disabled={!config.customUrl}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {config.videoSource === 'original' && sourceUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewUrl(sourceUrl)}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Preview
                        </Button>
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
              Verify this is the correct video for the exercise
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewUrl && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {previewUrl.includes('youtube.com') || previewUrl.includes('youtu.be') ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeId(previewUrl)}`}
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
                  <video src={previewUrl} controls className="w-full h-full" />
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