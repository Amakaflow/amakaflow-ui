import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Loader2, Link, Youtube, Instagram, Plus, Trash2, GripVertical, CheckCircle, AlertCircle, ExternalLink, Sparkles, X, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  detectVideoUrl,
  fetchOEmbed,
  checkVideoCache,
  saveVideoToCache,
  supportsAutoExtraction,
  getPlatformDisplayName,
  type VideoPlatform,
  type OEmbedData,
  type CachedVideo,
  type WorkoutStep,
} from '../lib/video-api';
import { searchExercises, type ExerciseLibraryItem } from '../lib/exercise-library';
import { ingestFollowAlong, createFollowAlongManual } from '../lib/follow-along-api';
import type { FollowAlongWorkout } from '../types/follow-along';

type IngestStep = 'url' | 'detecting' | 'preview' | 'manual-entry' | 'extracting' | 'cached';

interface ExerciseEntry {
  id: string;
  label: string;
  duration_sec: number;
  target_reps?: number;
  notes?: string;
}

interface VideoIngestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onWorkoutCreated: (workout: FollowAlongWorkout) => void;
  initialUrl?: string;
}

export function VideoIngestDialog({ open, onOpenChange, userId, onWorkoutCreated, initialUrl }: VideoIngestDialogProps) {
  const [step, setStep] = useState<IngestStep>('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState<VideoPlatform | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [normalizedUrl, setNormalizedUrl] = useState<string | null>(null);
  const [oembedData, setOembedData] = useState<OEmbedData | null>(null);
  const [cachedVideo, setCachedVideo] = useState<CachedVideo | null>(null);

  // Manual entry state
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExerciseLibraryItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Assist state
  interface AiSuggestion {
    id: string;
    label: string;
    duration_sec?: number;
    target_reps?: number;
    notes?: string;
    accepted: boolean;
  }
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Parse Description state
  const [descriptionText, setDescriptionText] = useState('');
  const [showDescriptionParser, setShowDescriptionParser] = useState(false);
  const [parsedSuggestions, setParsedSuggestions] = useState<AiSuggestion[]>([]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('url');
      setVideoUrl('');
      setPlatform(null);
      setVideoId(null);
      setNormalizedUrl(null);
      setOembedData(null);
      setCachedVideo(null);
      setWorkoutTitle('');
      setExercises([]);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
      setError(null);
      setAiSuggestions([]);
      setShowAiSuggestions(false);
      setAiError(null);
      setDescriptionText('');
      setShowDescriptionParser(false);
      setParsedSuggestions([]);
    }
  }, [open]);

  // Set initial URL when dialog opens with one
  useEffect(() => {
    if (open && initialUrl && videoUrl === '') {
      setVideoUrl(initialUrl);
    }
  }, [open, initialUrl]);

  // Exercise search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const results = searchExercises(searchQuery, 8);
      setSearchResults(results);
      setShowSearch(true);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  }, [searchQuery]);

  // Helper to ensure URLs have a protocol
  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  // Client-side platform detection (fallback when API unavailable)
  const detectPlatformFromUrl = (url: string): VideoPlatform => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) return 'tiktok';
    if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) return 'instagram';
    return 'unknown';
  };

  const handleDetectUrl = useCallback(async () => {
    if (!videoUrl.trim()) {
      toast.error('Please enter a video URL');
      return;
    }

    // Normalize URL to ensure it has https://
    const normalizedVideoUrl = normalizeUrl(videoUrl);
    setVideoUrl(normalizedVideoUrl);

    setIsLoading(true);
    setError(null);
    setStep('detecting');

    // First do client-side detection as fallback
    const clientPlatform = detectPlatformFromUrl(normalizedVideoUrl);

    if (clientPlatform === 'unknown') {
      setError('Could not detect video platform. Supported: YouTube, TikTok, Instagram');
      setStep('url');
      setIsLoading(false);
      return;
    }

    // Set platform from client-side detection
    setPlatform(clientPlatform);
    setNormalizedUrl(normalizedVideoUrl);

    try {
      // Try to check cache first (non-blocking)
      try {
        const cacheResult = await checkVideoCache(normalizedVideoUrl);
        if (cacheResult.cached && cacheResult.cache_entry) {
          setCachedVideo(cacheResult.cache_entry);
          setVideoId(cacheResult.cache_entry.video_id);
          setNormalizedUrl(cacheResult.cache_entry.normalized_url);

          // If cache has workout data, show cached step
          if (cacheResult.cache_entry.workout_data?.exercises?.length > 0) {
            setStep('cached');
            setIsLoading(false);
            return;
          }
        }
      } catch (cacheErr) {
        console.warn('Cache check failed, continuing without cache:', cacheErr);
      }

      // Try to get more info from backend API
      try {
        const detectResult = await detectVideoUrl(normalizedVideoUrl);
        if (detectResult.video_id) {
          setVideoId(detectResult.video_id);
        }
        if (detectResult.normalized_url) {
          setNormalizedUrl(detectResult.normalized_url);
        }
      } catch (detectErr) {
        console.warn('Backend detection failed, using client-side detection:', detectErr);
      }

      // Check if auto-extraction is supported
      if (supportsAutoExtraction(clientPlatform)) {
        // Use existing auto-extraction flow
        setStep('extracting');
        const result = await ingestFollowAlong(normalizedVideoUrl, userId);
        onWorkoutCreated(result.followAlongWorkout);
        toast.success('Workout extracted successfully!');
        onOpenChange(false);
      } else {
        // Instagram - fetch oEmbed and show manual entry
        setStep('preview');
        try {
          const oembed = await fetchOEmbed(normalizedVideoUrl, clientPlatform);
          setOembedData(oembed);

          // Pre-fill title from oEmbed
          if (oembed.title) {
            setWorkoutTitle(oembed.title);
          } else if (oembed.author_name) {
            setWorkoutTitle(`Workout by ${oembed.author_name}`);
          }
        } catch {
          // oEmbed failed (common for Instagram without auth)
          // Continue with manual entry anyway
          setWorkoutTitle('Instagram Workout');
        }
        setStep('manual-entry');
      }
    } catch (err: any) {
      console.error('Video processing error:', err);

      // For Instagram, still allow manual entry even if everything fails
      if (clientPlatform === 'instagram') {
        setWorkoutTitle('Instagram Workout');
        setStep('manual-entry');
        setIsLoading(false);
        return;
      }

      setError(err.message || 'Failed to process video URL');
      setStep('url');
    } finally {
      setIsLoading(false);
    }
  }, [videoUrl, userId, onWorkoutCreated, onOpenChange]);

  const handleUseCachedWorkout = useCallback(async () => {
    if (!cachedVideo?.workout_data) return;

    setIsLoading(true);
    try {
      // Create follow-along workout from cached data
      const result = await ingestFollowAlong(cachedVideo.source_url, userId);
      onWorkoutCreated(result.followAlongWorkout);
      toast.success('Workout loaded from cache!');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to use cached workout:', err);
      // Fall back to manual entry
      setStep('manual-entry');
      setWorkoutTitle(cachedVideo.workout_data.title || 'Cached Workout');
    } finally {
      setIsLoading(false);
    }
  }, [cachedVideo, userId, onWorkoutCreated, onOpenChange]);

  const handleAddExercise = useCallback((exercise?: ExerciseLibraryItem) => {
    const newExercise: ExerciseEntry = {
      id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: exercise?.name || '',
      duration_sec: 30,
    };
    setExercises((prev) => [...prev, newExercise]);
    setSearchQuery('');
    setShowSearch(false);
  }, []);

  const handleRemoveExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  }, []);

  const handleUpdateExercise = useCallback((id: string, field: keyof ExerciseEntry, value: any) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  }, []);

  // AI Assist - try to extract exercises and let user review
  const handleTryAiAssist = useCallback(async () => {
    setIsLoadingAi(true);
    setAiError(null);
    setShowAiSuggestions(true);

    try {
      // Call the ingestor to try extracting (even for Instagram)
      const result = await ingestFollowAlong(videoUrl, userId);
      const workout = result.followAlongWorkout;

      if (workout?.steps && workout.steps.length > 0) {
        // Convert to suggestions format
        const suggestions: AiSuggestion[] = workout.steps.map((step: any, i: number) => ({
          id: `ai_${Date.now()}_${i}`,
          label: step.label || step.name || `Exercise ${i + 1}`,
          duration_sec: step.durationSec || step.duration_sec || 30,
          target_reps: step.targetReps || step.target_reps,
          notes: step.notes,
          accepted: false, // Default to NOT accepted - user opts in to keep good ones
        }));
        setAiSuggestions(suggestions);

        // Also grab title if we don't have one
        if (!workoutTitle && workout.title) {
          setWorkoutTitle(workout.title);
        }

        toast.success(`AI found ${suggestions.length} exercises - review below`);
      } else {
        setAiError('AI could not find any exercises in this video');
      }
    } catch (err: any) {
      console.error('AI assist failed:', err);
      setAiError(err.message || 'AI extraction failed - please add exercises manually');
    } finally {
      setIsLoadingAi(false);
    }
  }, [videoUrl, userId, workoutTitle]);

  // Toggle a suggestion's accepted state
  const handleToggleSuggestion = useCallback((id: string) => {
    setAiSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, accepted: !s.accepted } : s))
    );
  }, []);

  // Add all accepted suggestions to exercises
  const handleAcceptSuggestions = useCallback(() => {
    const accepted = aiSuggestions.filter((s) => s.accepted);
    if (accepted.length === 0) {
      toast.error('No exercises selected');
      return;
    }

    // Convert to ExerciseEntry format and add to exercises
    const newExercises: ExerciseEntry[] = accepted.map((s) => ({
      id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: s.label,
      duration_sec: s.duration_sec || 30,
      target_reps: s.target_reps,
      notes: s.notes,
    }));

    setExercises((prev) => [...prev, ...newExercises]);
    setShowAiSuggestions(false);
    setAiSuggestions([]);
    toast.success(`Added ${accepted.length} exercises`);
  }, [aiSuggestions]);

  // Dismiss AI suggestions
  const handleDismissSuggestions = useCallback(() => {
    setShowAiSuggestions(false);
    setAiSuggestions([]);
    setAiError(null);
  }, []);

  // Parse description text to extract exercises
  const parseDescriptionForExercises = useCallback((text: string): AiSuggestion[] => {
    if (!text.trim()) return [];

    const exercises: AiSuggestion[] = [];
    const lines = text.split('\n');

    // Patterns to match exercise lines:
    // 1. "1. Exercise Name" or "1) Exercise Name" or "1: Exercise Name"
    // 2. "• Exercise Name" or "- Exercise Name" or "→ Exercise Name"
    // 3. Lines starting with emoji + Exercise
    const numberedPattern = /^\s*(\d+)\s*[.):]\s*(.+)/;
    const bulletPattern = /^\s*[•\-→>]\s*(.+)/;
    const emojiNumberPattern = /^\s*[\u{1F1E0}-\u{1F9FF}]?\s*(\d+)\s*[.):]\s*(.+)/u;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let exerciseName: string | null = null;

      // Try numbered pattern first
      const numberedMatch = trimmed.match(numberedPattern);
      if (numberedMatch) {
        exerciseName = numberedMatch[2].trim();
      } else {
        // Try bullet pattern
        const bulletMatch = trimmed.match(bulletPattern);
        if (bulletMatch) {
          exerciseName = bulletMatch[1].trim();
        } else {
          // Try emoji number pattern
          const emojiMatch = trimmed.match(emojiNumberPattern);
          if (emojiMatch) {
            exerciseName = emojiMatch[2].trim();
          }
        }
      }

      if (exerciseName && exerciseName.length > 2) {
        // Clean up the exercise name - remove trailing arrows, brackets, etc.
        exerciseName = exerciseName
          .replace(/→.*$/, '') // Remove "→ Supported" type suffixes
          .replace(/\s*\([^)]*\)\s*$/, '') // Remove trailing parentheses
          .replace(/\s*-\s*(Easy|Hard|Moderate|Dynamic|Static|Supported|Loaded)\s*$/i, '') // Remove difficulty hints
          .trim();

        if (exerciseName.length > 2) {
          exercises.push({
            id: `parsed_${Date.now()}_${exercises.length}`,
            label: exerciseName,
            duration_sec: 30,
            accepted: true, // Default to accepted since user explicitly pasted this
          });
        }
      }
    }

    return exercises;
  }, []);

  // Handle description parse
  const handleParseDescription = useCallback(() => {
    const parsed = parseDescriptionForExercises(descriptionText);
    if (parsed.length === 0) {
      toast.error('No exercises found. Try text with numbered items like "1. Exercise Name"');
      return;
    }
    setParsedSuggestions(parsed);
    toast.success(`Found ${parsed.length} exercises`);
  }, [descriptionText, parseDescriptionForExercises]);

  // Toggle a parsed suggestion's accepted state
  const handleToggleParsedSuggestion = useCallback((id: string) => {
    setParsedSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, accepted: !s.accepted } : s))
    );
  }, []);

  // Add parsed suggestions to exercises
  const handleAcceptParsedSuggestions = useCallback(() => {
    const accepted = parsedSuggestions.filter((s) => s.accepted);
    if (accepted.length === 0) {
      toast.error('No exercises selected');
      return;
    }

    const newExercises: ExerciseEntry[] = accepted.map((s) => ({
      id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: s.label,
      duration_sec: s.duration_sec || 30,
      target_reps: s.target_reps,
      notes: s.notes,
    }));

    setExercises((prev) => [...prev, ...newExercises]);
    setShowDescriptionParser(false);
    setParsedSuggestions([]);
    setDescriptionText('');
    toast.success(`Added ${accepted.length} exercises`);
  }, [parsedSuggestions]);

  // Dismiss description parser
  const handleDismissDescriptionParser = useCallback(() => {
    setShowDescriptionParser(false);
    setParsedSuggestions([]);
    setDescriptionText('');
  }, []);

  const handleSaveManualWorkout = useCallback(async () => {
    if (!workoutTitle.trim()) {
      toast.error('Please enter a workout title');
      return;
    }

    if (exercises.length === 0) {
      toast.error('Please add at least one exercise');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare workout data for cache
      const workoutData = {
        title: workoutTitle,
        exercises: exercises.map((ex) => ({
          label: ex.label,
          duration_sec: ex.duration_sec,
          target_reps: ex.target_reps,
          notes: ex.notes,
        })),
        source_link: normalizedUrl || videoUrl,
      };

      // Save to cache (non-blocking, for future lookups)
      saveVideoToCache({
        url: videoUrl,
        workout_data: workoutData,
        oembed_data: oembedData ? oembedData : undefined,
        processing_method: oembedData?.success ? 'manual_with_oembed' : 'manual_no_oembed',
        ingested_by: userId,
      }).catch((err) => console.warn('Cache save failed (non-blocking):', err));

      // Create the follow-along workout directly with manual data (no AI extraction)
      const result = await createFollowAlongManual({
        sourceUrl: normalizedUrl || videoUrl,
        userId,
        title: workoutTitle,
        steps: exercises.map((ex) => ({
          label: ex.label,
          durationSec: ex.duration_sec,
          targetReps: ex.target_reps,
          notes: ex.notes,
        })),
        source: platform || undefined,
        thumbnailUrl: oembedData?.thumbnail_url || undefined,
      });

      onWorkoutCreated(result.followAlongWorkout);
      toast.success('Workout created successfully!');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to save workout:', err);
      setError(err.message || 'Failed to save workout');
    } finally {
      setIsLoading(false);
    }
  }, [workoutTitle, exercises, videoUrl, normalizedUrl, oembedData, platform, userId, onWorkoutCreated, onOpenChange]);

  const renderPlatformBadge = () => {
    if (!platform || platform === 'unknown') return null;

    const Icon = platform === 'youtube' ? Youtube : platform === 'instagram' ? Instagram : Link;
    const color =
      platform === 'youtube'
        ? 'bg-red-100 text-red-800'
        : platform === 'instagram'
          ? 'bg-pink-100 text-pink-800'
          : 'bg-gray-100 text-gray-800';

    return (
      <Badge className={`${color} gap-1`}>
        <Icon className="h-3 w-3" />
        {getPlatformDisplayName(platform)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add Video Workout
            {renderPlatformBadge()}
          </DialogTitle>
          <DialogDescription>
            {step === 'url' && 'Paste a workout video URL from Instagram, YouTube, or TikTok'}
            {step === 'detecting' && 'Detecting video platform...'}
            {step === 'extracting' && 'Extracting workout using AI...'}
            {step === 'cached' && 'This video is already in our cache!'}
            {step === 'manual-entry' && 'Add exercises manually for this Instagram video'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* URL Input Step */}
        {step === 'url' && (
          <div className="space-y-4">
            <Input
              placeholder="https://instagram.com/reel/... or youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDetectUrl()}
            />
            <Button onClick={handleDetectUrl} disabled={isLoading || !videoUrl.trim()} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        )}

        {/* Detecting Step */}
        {step === 'detecting' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Detecting video platform...</p>
          </div>
        )}

        {/* Extracting Step (YouTube/TikTok) */}
        {step === 'extracting' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Extracting workout with AI...</p>
            <p className="text-xs text-muted-foreground">This may take a moment</p>
          </div>
        )}

        {/* Cached Step */}
        {step === 'cached' && cachedVideo && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                {cachedVideo.oembed_data?.thumbnail_url && (
                  <img
                    src={cachedVideo.oembed_data.thumbnail_url}
                    alt="Video thumbnail"
                    className="w-full aspect-video object-cover rounded-lg mb-4"
                  />
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Found in cache</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {cachedVideo.workout_data?.title || 'Untitled Workout'}
                  </p>
                  {cachedVideo.workout_data?.exercises && (
                    <p className="text-xs text-muted-foreground">
                      {cachedVideo.workout_data.exercises.length} exercises
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-2">
              <Button onClick={handleUseCachedWorkout} disabled={isLoading} className="flex-1">
                Use Cached Workout
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('manual-entry')}
                className="flex-1"
              >
                Enter Manually
              </Button>
            </div>
          </div>
        )}

        {/* Manual Entry Step (Instagram) */}
        {step === 'manual-entry' && (
          <div className="space-y-4">
            {/* oEmbed Preview OR Video Link */}
            {oembedData?.success && oembedData.thumbnail_url ? (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={oembedData.thumbnail_url}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
                {oembedData.author_name && (
                  <div className="absolute bottom-2 left-2 right-2">
                    <Badge variant="secondary" className="text-xs">
                      {oembedData.author_name}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Watch the video to see exercises</p>
                      <p className="text-xs text-muted-foreground">
                        Open the video in a new tab and add the exercises you see below
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(videoUrl, '_blank')}
                      className="gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Video
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Assist Section */}
            {!showAiSuggestions ? (
              <Card className="border-dashed bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        AI Assist (Experimental)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Try AI extraction - results may vary. You can review and edit.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTryAiAssist}
                      disabled={isLoadingAi}
                      className="gap-1"
                    >
                      {isLoadingAi ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Trying...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          Try AI
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      AI Suggestions
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismissSuggestions}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {isLoadingAi && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    </div>
                  )}

                  {aiError && (
                    <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                      {aiError}
                    </div>
                  )}

                  {aiSuggestions.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Click to toggle ({aiSuggestions.filter(s => s.accepted).length}/{aiSuggestions.length} selected)
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setAiSuggestions(prev => prev.map(s => ({ ...s, accepted: false })))}
                          >
                            Reject All
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setAiSuggestions(prev => prev.map(s => ({ ...s, accepted: true })))}
                          >
                            Select All
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {aiSuggestions.map((suggestion, i) => (
                          <button
                            key={suggestion.id}
                            onClick={() => handleToggleSuggestion(suggestion.id)}
                            className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm transition-colors ${
                              suggestion.accepted
                                ? 'bg-green-100 dark:bg-green-900/30 border border-green-300'
                                : 'bg-red-100 dark:bg-red-900/30 border border-red-300 line-through opacity-60'
                            }`}
                          >
                            {suggestion.accepted ? (
                              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                            <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                            <span className="flex-1 truncate">{suggestion.label}</span>
                            {suggestion.duration_sec && (
                              <span className="text-xs text-muted-foreground">
                                {suggestion.duration_sec}s
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAcceptSuggestions}
                          disabled={aiSuggestions.filter(s => s.accepted).length === 0}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Add {aiSuggestions.filter(s => s.accepted).length} Selected
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDismissSuggestions}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Parse Description Section */}
            {!showDescriptionParser ? (
              <Card className="border-dashed bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Parse Description
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Paste the video caption to extract exercises
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDescriptionParser(true)}
                      className="gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Paste Text
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Parse Description
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismissDescriptionParser}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {parsedSuggestions.length === 0 ? (
                    <>
                      <textarea
                        className="w-full h-32 p-3 text-sm border rounded-lg resize-none bg-background"
                        placeholder={`Paste the video description/caption here...

Example:
1. Side-Lying Foam Roller IR
2. Frog Pose IR Alternating
3. Kneeling W Squat`}
                        value={descriptionText}
                        onChange={(e) => setDescriptionText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleParseDescription}
                          disabled={!descriptionText.trim()}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Parse Exercises
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDismissDescriptionParser}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Click to toggle ({parsedSuggestions.filter(s => s.accepted).length}/{parsedSuggestions.length} selected)
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setParsedSuggestions(prev => prev.map(s => ({ ...s, accepted: false })))}
                          >
                            Reject All
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setParsedSuggestions(prev => prev.map(s => ({ ...s, accepted: true })))}
                          >
                            Select All
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {parsedSuggestions.map((suggestion, i) => (
                          <button
                            key={suggestion.id}
                            onClick={() => handleToggleParsedSuggestion(suggestion.id)}
                            className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm transition-colors ${
                              suggestion.accepted
                                ? 'bg-green-100 dark:bg-green-900/30 border border-green-300'
                                : 'bg-red-100 dark:bg-red-900/30 border border-red-300 line-through opacity-60'
                            }`}
                          >
                            {suggestion.accepted ? (
                              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                            <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                            <span className="flex-1 truncate">{suggestion.label}</span>
                            {suggestion.duration_sec && (
                              <span className="text-xs text-muted-foreground">
                                {suggestion.duration_sec}s
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAcceptParsedSuggestions}
                          disabled={parsedSuggestions.filter(s => s.accepted).length === 0}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Add {parsedSuggestions.filter(s => s.accepted).length} Selected
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setParsedSuggestions([]);
                            // Keep description text so user can edit and re-parse
                          }}
                        >
                          Re-edit
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Workout Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Workout Title</label>
              <Input
                placeholder="e.g., 10-Minute Core Workout"
                value={workoutTitle}
                onChange={(e) => setWorkoutTitle(e.target.value)}
              />
            </div>

            {/* Exercise List */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Exercises</label>

              {exercises.length > 0 && (
                <div className="space-y-2">
                  {exercises.map((exercise, index) => (
                    <div
                      key={exercise.id}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                      <Input
                        placeholder="Exercise name"
                        value={exercise.label}
                        onChange={(e) => handleUpdateExercise(exercise.id, 'label', e.target.value)}
                        className="flex-1 h-8"
                      />
                      <Input
                        type="number"
                        placeholder="sec"
                        value={exercise.duration_sec}
                        onChange={(e) =>
                          handleUpdateExercise(exercise.id, 'duration_sec', parseInt(e.target.value) || 0)
                        }
                        className="w-16 h-8"
                      />
                      <span className="text-xs text-muted-foreground">sec</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleRemoveExercise(exercise.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Exercise */}
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search or type exercise name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        handleAddExercise({ name: searchQuery } as ExerciseLibraryItem);
                      } else {
                        handleAddExercise();
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Search Results Dropdown */}
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 py-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                        onClick={() => handleAddExercise(result)}
                      >
                        <span>{result.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.category}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('url');
                  setExercises([]);
                  setWorkoutTitle('');
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSaveManualWorkout}
                disabled={isLoading || !workoutTitle.trim() || exercises.length === 0}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Workout'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
