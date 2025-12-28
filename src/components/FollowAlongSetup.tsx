import { useState, useEffect } from 'react';
import { API_URLS } from '../lib/config';
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
  Clock,
  Volume2,
  VolumeX,
  Dumbbell
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkoutStructure, Block, Exercise } from '../types/workout';
import Lottie from 'lottie-react';

// Simple embedded exercise animation (a pulsing dumbbell icon)
// This avoids external CDN dependencies and works offline
const EXERCISE_ANIMATION_DATA = {
  "v": "5.7.4",
  "fr": 30,
  "ip": 0,
  "op": 60,
  "w": 200,
  "h": 200,
  "nm": "Exercise",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "Dumbbell",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 0, "k": [100, 100, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": {
          "a": 1,
          "k": [
            { "t": 0, "s": [100, 100, 100], "e": [110, 110, 100] },
            { "t": 15, "s": [110, 110, 100], "e": [100, 100, 100] },
            { "t": 30, "s": [100, 100, 100], "e": [110, 110, 100] },
            { "t": 45, "s": [110, 110, 100], "e": [100, 100, 100] },
            { "t": 60, "s": [100, 100, 100] }
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ty": "rc",
              "d": 1,
              "s": { "a": 0, "k": [80, 20] },
              "p": { "a": 0, "k": [0, 0] },
              "r": { "a": 0, "k": 5 }
            },
            {
              "ty": "rc",
              "d": 1,
              "s": { "a": 0, "k": [20, 50] },
              "p": { "a": 0, "k": [-40, 0] },
              "r": { "a": 0, "k": 5 }
            },
            {
              "ty": "rc",
              "d": 1,
              "s": { "a": 0, "k": [20, 50] },
              "p": { "a": 0, "k": [40, 0] },
              "r": { "a": 0, "k": 5 }
            },
            {
              "ty": "fl",
              "c": { "a": 0, "k": [0.2, 0.5, 0.9, 1] },
              "o": { "a": 0, "k": 100 }
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ],
          "nm": "Dumbbell Shape"
        }
      ],
      "ip": 0,
      "op": 60,
      "st": 0
    }
  ]
};

type VideoSourceType = 'original' | 'custom' | 'none';
type VoiceContentType = 'name' | 'name-reps' | 'name-notes';

interface StepConfig {
  exerciseId: string;
  exerciseName: string;
  videoSource: VideoSourceType;
  customUrl: string;
  startTimeSec: number;
}

interface VoiceSettings {
  enabled: boolean;
  content: VoiceContentType;
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

// Build speech text based on exercise and content setting
function buildSpeechText(exercise: Exercise, content: VoiceContentType): string {
  const name = exercise.name;
  
  switch (content) {
    case 'name':
      return name;
    case 'name-reps':
      const repsInfo = exercise.reps 
        ? `${exercise.sets || 3} sets of ${exercise.reps} reps`
        : exercise.duration_sec
        ? `${exercise.sets || 1} sets of ${exercise.duration_sec} seconds`
        : '';
      return repsInfo ? `${name}. ${repsInfo}` : name;
    case 'name-notes':
      const notes = exercise.notes ? `. ${exercise.notes}` : '';
      return `${name}${notes}`;
    default:
      return name;
  }
}

// Speak text using Web Speech API
function speakText(text: string): void {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to use a good English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Google'))
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  } else {
    toast.error('Speech synthesis not supported in this browser');
  }
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
  
  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    content: 'name-reps',
  });
  
  // Lottie animation data (embedded, no fetch needed)
  const [animationPreviewExercise, setAnimationPreviewExercise] = useState<string | null>(null);
  const exerciseAnimation = EXERCISE_ANIMATION_DATA;

  // Use centralized API config
  const MAPPER_API_BASE_URL = API_URLS.MAPPER;

  // Load voices when component mounts (needed for some browsers)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Chrome needs this to load voices
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

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

    // First count total exercises (including those in supersets)
    workout.blocks.forEach((block: Block) => {
      totalExercises += block.exercises?.length || 0;
      // Also count exercises in supersets
      const supersets = (block as any).supersets || [];
      supersets.forEach((superset: any) => {
        totalExercises += superset.exercises?.length || 0;
      });
    });

    // Get video duration from provenance or state
    const provenance = (workout as any)?._provenance;
    const durationFromProvenance = provenance?.video_duration_sec;
    const effectiveDuration = videoDuration || durationFromProvenance;
    
    // Calculate fallback time per exercise if no timestamps in data
    const introBuffer = effectiveDuration ? effectiveDuration * 0.05 : 0;
    const usableDuration = effectiveDuration ? effectiveDuration * 0.9 : 0;
    const timePerExercise = totalExercises > 0 ? usableDuration / totalExercises : 0;

    // Helper to add exercise to configs
    const addExercise = (exercise: Exercise) => {
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
    };

    workout.blocks.forEach((block: Block) => {
      // Handle regular exercises
      block.exercises?.forEach((exercise: Exercise) => {
        addExercise(exercise);
      });
      
      // Handle exercises in supersets
      const supersets = (block as any).supersets || [];
      supersets.forEach((superset: any) => {
        superset.exercises?.forEach((exercise: Exercise) => {
          addExercise(exercise);
        });
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

  // Preview voice for a specific exercise
  const handleVoicePreview = (exercise: Exercise) => {
    const text = buildSpeechText(exercise, voiceSettings.content);
    speakText(text);
  };

  // Preview voice for first exercise
  const handleVoicePreviewFirst = () => {
    if (workout?.blocks?.[0]?.exercises?.[0]) {
      handleVoicePreview(workout.blocks[0].exercises[0]);
    }
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
          voiceSettings: voiceSettings,
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

          {/* Voice Guidance Settings */}
          <div className="p-3 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {voiceSettings.enabled ? (
                  <Volume2 className="w-4 h-4 text-primary" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
                <Label className="text-sm font-medium">Voice Guidance</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={voiceSettings.enabled}
                  onCheckedChange={(checked) => 
                    setVoiceSettings(prev => ({ ...prev, enabled: checked }))
                  }
                />
              </div>
            </div>
            
            {voiceSettings.enabled && (
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-sm text-muted-foreground">Announce:</Label>
                <Select
                  value={voiceSettings.content}
                  onValueChange={(value: VoiceContentType) =>
                    setVoiceSettings(prev => ({ ...prev, content: value }))
                  }
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Exercise name only</SelectItem>
                    <SelectItem value="name-reps">Name + sets/reps</SelectItem>
                    <SelectItem value="name-notes">Name + notes</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVoicePreviewFirst}
                  className="h-8"
                >
                  <Volume2 className="w-3 h-3 mr-1" />
                  Preview
                </Button>
              </div>
            )}
          </div>

          {/* Original Video Source - only show if it's a valid URL */}
          {sourceUrl && (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2 overflow-hidden">
                {isYouTubeSource && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded flex-shrink-0">
                    YouTube
                  </span>
                )}
                <span className="text-sm truncate max-w-[250px]" title={sourceUrl}>{sourceUrl}</span>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex-shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {isLoadingDuration ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
              ) : videoDuration ? (
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {formatTime(videoDuration)}
                </span>
              ) : null}
            </div>
          )}

          {/* Per-Step Configuration */}
          {showSteps && (
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-3">
                {stepConfigs.map((config, idx) => {
                  // Find the actual exercise for voice preview (check both exercises and supersets)
                  let exercise: Exercise | undefined;
                  let exerciseIdx = 0;
                  for (const block of workout.blocks) {
                    // Check regular exercises
                    for (const ex of block.exercises || []) {
                      if (exerciseIdx === idx) {
                        exercise = ex;
                        break;
                      }
                      exerciseIdx++;
                    }
                    if (exercise) break;
                    
                    // Check supersets
                    const supersets = (block as any).supersets || [];
                    for (const superset of supersets) {
                      for (const ex of superset.exercises || []) {
                        if (exerciseIdx === idx) {
                          exercise = ex;
                          break;
                        }
                        exerciseIdx++;
                      }
                      if (exercise) break;
                    }
                    if (exercise) break;
                  }

                  return (
                    <div
                      key={config.exerciseId}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                          {idx + 1}
                        </div>
                        <span className="font-medium text-sm flex-1">{config.exerciseName}</span>
                        {voiceSettings.enabled && exercise && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVoicePreview(exercise!)}
                            className="h-6 w-6 p-0"
                            title="Preview voice"
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        )}
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

                        {config.videoSource === 'none' && exerciseAnimation && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAnimationPreviewExercise(config.exerciseName)}
                            className="h-8"
                          >
                            <Dumbbell className="w-3 h-3 mr-1" />
                            Preview Animation
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      {/* Animation Preview Dialog */}
      <Dialog open={!!animationPreviewExercise} onOpenChange={() => setAnimationPreviewExercise(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{animationPreviewExercise}</DialogTitle>
            <DialogDescription>
              Placeholder animation (will be enhanced with exercise-specific videos later)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-square bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg overflow-hidden flex items-center justify-center p-8">
              {exerciseAnimation && (
                <Lottie 
                  animationData={exerciseAnimation} 
                  loop={true}
                  className="w-full h-full"
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              This generic animation will play during the exercise. 
              You can add specific exercise videos later.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setAnimationPreviewExercise(null)}>Close</Button>
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