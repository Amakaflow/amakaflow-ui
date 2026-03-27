import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Youtube, Image, Sparkles, Plus, Trash2, Loader2, Upload, X, Eye, Sparkles as VisionIcon, XCircle, Copy, Check, Music2, Video, Instagram, ImageIcon } from 'lucide-react';
import { Source, SourceType, WorkoutStructure } from '../types/workout';
import { Textarea } from './ui/textarea';
import { WorkoutTemplates } from './WorkoutTemplates';
import { getImageProcessingMethod } from '../lib/preferences';
import { getInstagramAutoExtract } from '../lib/preferences';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { VideoIngestDialog } from './VideoIngestDialog';
import { useClerkUser } from '../lib/clerk-auth';
import { isDemoMode, DEMO_USER } from '../lib/demo-mode';
import type { FollowAlongWorkout } from '../types/follow-along';
import { toast } from 'sonner';

// Helper to detect video platform from URL
type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'pinterest' | 'unknown';

function detectVideoPlatform(url: string): VideoPlatform {
  if (!url) return 'unknown';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) return 'instagram';
  if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it')) return 'pinterest';
  return 'unknown';
}

interface AddSourcesProps {
  onGenerate: (sources: Source[]) => void;
  onLoadTemplate: (workout: WorkoutStructure) => void;
  onCreateNew?: () => void;
  loading: boolean;
  progress?: string | null;
  onCancel?: () => void;
}

// Video input section component with platform auto-detection
interface VideoInputSectionProps {
  currentInput: string;
  setCurrentInput: (value: string) => void;
  onAddSource: () => void;
}

function VideoInputSection({ currentInput, setCurrentInput, onAddSource }: VideoInputSectionProps) {
  const detectedPlatform = detectVideoPlatform(currentInput);

  const getPlatformInfo = () => {
    switch (detectedPlatform) {
      case 'youtube':
        return {
          icon: <Youtube className="w-4 h-4 text-red-600" />,
          name: 'YouTube',
          method: 'Transcript + AI Exercise Extraction',
          detail: 'OpenAI GPT-4o-mini or Claude 3.5 Sonnet',
          badge: 'AI-Powered',
          badgeColor: 'bg-blue-600',
          alertColor: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
          alertIconColor: 'text-blue-600 dark:text-blue-400',
          alertTextColor: 'text-blue-800 dark:text-blue-200',
          steps: [
            { label: 'Step 1', text: 'Transcripts extracted using youtube-transcript.io' },
            { label: 'Step 2', text: 'Exercises extracted from transcript using AI' },
          ],
          alertText: 'Free Tier: 25 transcripts per month. See Settings → General → YouTube Ingestion for more info.',
        };
      case 'tiktok':
        return {
          icon: <Music2 className="w-4 h-4 text-pink-600" />,
          name: 'TikTok',
          method: 'Vision AI Exercise Detection',
          detail: 'OpenAI GPT-4o-mini analyzes video frames',
          badge: 'AI Vision',
          badgeColor: 'bg-pink-600',
          alertColor: 'bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800',
          alertIconColor: 'text-pink-600 dark:text-pink-400',
          alertTextColor: 'text-pink-800 dark:text-pink-200',
          steps: [
            { label: 'Step 1', text: 'Video downloaded and frames extracted' },
            { label: 'Step 2', text: 'GPT-4o Vision analyzes frames to identify exercises' },
          ],
          alertText: 'Processing may take 20-30 seconds as video frames are analyzed.',
        };
      case 'instagram': {
        const isAutoExtract = getInstagramAutoExtract();
        return isAutoExtract
          ? {
              icon: <Instagram className="w-4 h-4 text-purple-600" />,
              name: 'Instagram',
              method: 'Apify Transcript + AI Exercise Extraction',
              detail: 'Reel transcript extracted via Apify, parsed by GPT-4o-mini',
              badge: 'AI-Powered',
              badgeColor: 'bg-purple-600',
              alertColor: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
              alertIconColor: 'text-purple-600 dark:text-purple-400',
              alertTextColor: 'text-purple-800 dark:text-purple-200',
              steps: [
                { label: 'Step 1', text: 'Reel transcript and metadata fetched via Apify' },
                { label: 'Step 2', text: 'Exercises extracted from transcript using AI' },
              ],
              alertText: 'Requires Apify API token. Pro/Trainer tier only.',
            }
          : {
              icon: <Instagram className="w-4 h-4 text-purple-600" />,
              name: 'Instagram',
              method: 'oEmbed Preview + Manual Exercise Entry',
              detail: 'Add exercises manually with autocomplete',
              badge: 'Semi-Manual',
              badgeColor: 'bg-purple-600',
              alertColor: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
              alertIconColor: 'text-purple-600 dark:text-purple-400',
              alertTextColor: 'text-purple-800 dark:text-purple-200',
              steps: [
                { label: 'Step 1', text: 'Video thumbnail and metadata fetched via oEmbed' },
                { label: 'Step 2', text: 'You add exercises manually with autocomplete suggestions' },
              ],
              alertText: 'Instagram videos require manual exercise entry. Upgrade to Pro for AI-powered extraction.',
            };
      }
      case 'pinterest':
        return {
          icon: <ImageIcon className="w-4 h-4 text-red-500" />,
          name: 'Pinterest',
          method: 'Vision AI Workout Extraction',
          detail: 'GPT-4o-mini extracts exercises from infographic images',
          badge: 'AI Vision',
          badgeColor: 'bg-red-500',
          alertColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
          alertIconColor: 'text-red-500 dark:text-red-400',
          alertTextColor: 'text-red-800 dark:text-red-200',
          steps: [
            { label: 'Step 1', text: 'Image downloaded from Pinterest pin or board' },
            { label: 'Step 2', text: 'GPT-4o Vision analyzes workout infographic to extract exercises' },
          ],
          alertText: 'Works best with workout infographics. Boards process up to 20 pins automatically.',
        };
      default:
        return null;
    }
  };

  const platformInfo = getPlatformInfo();

  return (
    <>
      {/* Platform detection indicator */}
      {platformInfo ? (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            {platformInfo.icon}
            <div>
              <p className="text-sm font-medium">
                {platformInfo.name}: {platformInfo.method}
              </p>
              <p className="text-xs text-muted-foreground">
                {platformInfo.detail}
              </p>
            </div>
          </div>
          <Badge variant="default" className={platformInfo.badgeColor}>{platformInfo.badge}</Badge>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Paste a video URL to get started
              </p>
              <p className="text-xs text-muted-foreground">
                Supports YouTube, TikTok, Instagram, and Pinterest
              </p>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            <Badge variant="outline" className="text-xs"><Youtube className="w-3 h-3 mr-1" />YouTube</Badge>
            <Badge variant="outline" className="text-xs"><Music2 className="w-3 h-3 mr-1" />TikTok</Badge>
            <Badge variant="outline" className="text-xs"><Instagram className="w-3 h-3 mr-1" />Instagram</Badge>
            <Badge variant="outline" className="text-xs"><ImageIcon className="w-3 h-3 mr-1" />Pinterest</Badge>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Video URL</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Paste YouTube, TikTok, Instagram, or Pinterest URL..."
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddSource()}
          />
          <Button onClick={onAddSource} disabled={detectedPlatform === 'unknown' && !currentInput}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {platformInfo && (
          <>
            <div className="space-y-1">
              {platformInfo.steps.map((step, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  <strong>{step.label}:</strong> {step.text}
                </p>
              ))}
            </div>

            <Alert className={platformInfo.alertColor}>
              <Info className={`h-4 w-4 ${platformInfo.alertIconColor}`} />
              <AlertDescription className={`text-xs ${platformInfo.alertTextColor}`}>
                {platformInfo.alertText}
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </>
  );
}

// Universal AI prompt component for copying (collapsible)
function AIPromptCopyButton() {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const prompt = `WORKOUT FORMAT RULES — USE EXACTLY THIS FORMAT EVERY TIME

Your job is to generate workout plans in the exact text format below, with no extra commentary, no explanations, and no deviations.

OUTPUT FORMAT (MUST MATCH EXACTLY)

Title: [Workout Name]

Block: [Block Name]
- Exercise Name | sets×reps | type:type | note:optional notes

FORMAT RULES

1. Title must use: Title: [Workout Name]

2. Every section must start with: Block: [Block Name]
   Examples: Warm-Up, Main Strength, Conditioning, Finisher, Cool-Down

3. Exercises must start with "- " or "•" (either is acceptable)

4. Exercise line format: Exercise Name | sets×reps | type:type | note:optional notes
   Examples:
   - 3×8 = 3 sets of 8 reps
   - 4×6–8 = 4 sets of 6–8 reps
   - 3×AMRAP = as many reps as possible
   - If no sets/reps: omit it → Exercise Name | type:warmup

5. Valid types:
   - strength
   - warmup
   - cooldown
   - cardio
   - amrap

6. Use ONLY real exercise names. Examples: Bench Press, Pull-Ups, Wall Balls, Deadlift
   Do NOT generate placeholders like "Exercise 1", "Set 1", "Do 20 steps," etc.

7. NEVER add extra explanations before or after the workout. The output must be only the formatted workout.

RESPONSE STYLE REQUIREMENT
- No bullet points outside exercises
- No code fences unless shown above
- No chatty text
- No intros, no outros
- Only output the formatted workout

EXAMPLE OUTPUT

Title: Lower Body Strength

Block: Warm-Up
- Leg swings | type:warmup
- Bodyweight squats | type:warmup

Block: Main Strength
- Back Squat | 4×6–8 | type:strength | note:Heavy, focus on depth
- Romanian Deadlift | 3×8 | type:strength
- Walking Lunges | 3×10 | type:strength

Block: Cool-Down
- Hip flexor stretch | type:cooldown

TEST REQUESTS YOU CAN USE
- Generate a Lower Body workout
- Create an Abs workout
- Make an Upper Body Strength workout
- Give me a Full Body workout
- Create a Cardio workout

FINAL RULE
Always follow the exact format above. No exceptions.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Copy className="w-3 h-3" />
            {isOpen ? 'Hide Prompt' : 'Show Prompt to Copy'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Step 1: Copy this prompt</p>
          <div className="relative">
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap">
              {prompt}
            </pre>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="absolute top-2 right-2"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Prompt
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Step 2: Paste into your AI tool and ask for a workout</p>
          <div className="bg-muted/50 p-2 rounded text-xs space-y-1">
            <p className="font-medium">Try saying:</p>
            <ul className="list-disc list-inside ml-2 space-y-0.5 text-muted-foreground">
              <li>"Generate a Lower Body workout"</li>
              <li>"Create an Abs workout"</li>
              <li>"Make an Upper Body Strength workout"</li>
              <li>"Give me a Full Body workout"</li>
            </ul>
          </div>
        </div>
        
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Step 3: Copy the workout and paste it above</p>
          <p className="text-xs text-muted-foreground">
            The AI will generate a workout in the correct format. Just copy it and paste it in the text area above, then click "Add Description".
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AddSources({ onGenerate, onLoadTemplate, onCreateNew, loading, progress, onCancel }: AddSourcesProps) {
  const { user: clerkUser } = useClerkUser();
  const user = isDemoMode ? DEMO_USER : clerkUser;
  const [sources, setSources] = useState<Source[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [activeTab, setActiveTab] = useState<string>('video');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageMethod, setImageMethod] = useState<'ocr' | 'vision'>(getImageProcessingMethod());

  // VideoIngestDialog state for Instagram URLs
  const [showVideoIngestDialog, setShowVideoIngestDialog] = useState(false);
  const [pendingInstagramUrl, setPendingInstagramUrl] = useState<string | null>(null);

  // Listen for preference changes
  useEffect(() => {
    const checkMethod = () => {
      setImageMethod(getImageProcessingMethod());
    };
    // Check on mount and when tab changes to image
    checkMethod();
    const interval = setInterval(checkMethod, 1000); // Check every second for preference changes
    return () => clearInterval(interval);
  }, [activeTab]);

  const addSource = () => {
    if (!currentInput.trim() && !uploadedImage) return;

    let content: string;
    let sourceType: SourceType;

    if (activeTab === 'video') {
      // Handle unified video tab - detect platform from URL
      const platform = detectVideoPlatform(currentInput.trim());
      if (platform === 'unknown') {
        // Not a recognized video URL
        return;
      }

      // Instagram manual mode: open VideoIngestDialog for semi-manual entry
      // Instagram auto-extract (Apify): add to sources list like YouTube/TikTok
      if (platform === 'instagram' && !getInstagramAutoExtract()) {
        setPendingInstagramUrl(currentInput.trim());
        setShowVideoIngestDialog(true);
        setCurrentInput('');
        return;
      }

      content = currentInput.trim();
      sourceType = platform;
      setCurrentInput('');
    } else if (activeTab === 'image') {
      if (currentInput.trim()) {
        // Check if it's a video URL - redirect to video tab
        const platform = detectVideoPlatform(currentInput.trim());
        if (platform !== 'unknown') {
          setActiveTab('video');
          return;
        }
        // Use URL for image
        content = currentInput.trim();
        setCurrentInput('');
      } else if (uploadedImage) {
        // For file uploads, create a blob URL to store
        content = URL.createObjectURL(uploadedImage);
        setUploadedImage(null);
        setImagePreview(null);
      } else {
        return;
      }
      sourceType = 'image';
    } else {
      // ai-text
      content = currentInput.trim();
      sourceType = 'ai-text';
      setCurrentInput('');
      setUploadedImage(null);
      setImagePreview(null);
    }

    const newSource: Source = {
      id: Date.now().toString(),
      type: sourceType,
      content,
      timestamp: new Date()
    };

    setSources([...sources, newSource]);
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setCurrentInput('');
    setUploadedImage(null);
    setImagePreview(null);
  };

  // Handle Instagram workout created from VideoIngestDialog
  const handleInstagramWorkoutCreated = (workout: FollowAlongWorkout) => {
    toast.success('Instagram workout created!', {
      description: `"${workout.name}" has been saved to your Follow-Along Workouts.`,
    });
    setShowVideoIngestDialog(false);
    setPendingInstagramUrl(null);
  };

  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const clearImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const removeSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
  };

  const handleGenerate = () => {
    if (sources.length > 0) {
      onGenerate(sources);
    }
  };

  const getSourceIcon = (type: SourceType) => {
    switch (type) {
      case 'youtube': return <Youtube className="w-4 h-4 text-red-600" />;
      case 'tiktok': return <Music2 className="w-4 h-4 text-pink-600" />;
      case 'instagram': return <Instagram className="w-4 h-4 text-purple-600" />;
      case 'pinterest': return <ImageIcon className="w-4 h-4 text-red-500" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'ai-text': return <Sparkles className="w-4 h-4" />;
      default: return <Video className="w-4 h-4" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="mb-2">Add Workout Sources</h2>
          <p className="text-muted-foreground">
            Transform workout content from YouTube, TikTok, images, or AI text into structured blocks that sync with your watches
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Input Sources</CardTitle>
            <CardDescription>
              Add links or content from various platforms to build your workout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="video">
                  <Video className="w-4 h-4 mr-2" />
                  Video
                </TabsTrigger>
                <TabsTrigger value="image">
                  <Image className="w-4 h-4 mr-2" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="ai-text">
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="video" className="space-y-4">
                <VideoInputSection
                  currentInput={currentInput}
                  setCurrentInput={setCurrentInput}
                  onAddSource={addSource}
                />
              </TabsContent>

              <TabsContent value="image" className="space-y-4">
                {/* Show current processing method */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    {imageMethod === 'vision' ? (
                      <VisionIcon className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      Processing Method: {imageMethod === 'vision' ? 'AI Vision Model' : 'OCR'}
                    </span>
                  </div>
                  <Badge variant={imageMethod === 'vision' ? 'default' : 'secondary'} className={imageMethod === 'vision' ? 'bg-blue-600 hover:bg-blue-700' : ''}>
                    {imageMethod === 'vision' ? 'Premium' : 'Free'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Change processing method in <span className="font-medium">Settings → General</span>
                </p>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSource()}
                    />
                    <Button onClick={addSource}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Or upload from file below
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Upload Image File</Label>
                  <div
                    className={`relative flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                      isDragging 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-muted/50 hover:bg-muted'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    {imagePreview ? (
                      <div className="relative w-full p-4">
                        <img
                          src={imagePreview}
                          alt="Uploaded workout"
                          className="max-h-[300px] mx-auto rounded-lg object-contain"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearImage();
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                        <div className="mt-3 text-center text-sm text-muted-foreground">
                          {uploadedImage?.name}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center p-8">
                        <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                        <div className="text-center">
                          <p className="mb-1">
                            Drag & drop an image here
                          </p>
                          <p className="text-sm text-muted-foreground">
                            or click to browse files
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Supports: JPG, PNG, GIF, WebP
                          </p>
                        </div>
                      </div>
                    )}
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                    />
                  </div>
                  {uploadedImage && (
                    <Button onClick={addSource} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Image
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="ai-text" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Workout Description</Label>
                    <Badge variant="outline" className="text-xs">Accepts: Canonical format, Free-form text, or JSON</Badge>
                  </div>
                  <Textarea
                    placeholder="Paste your workout text here (canonical format, free-form, or JSON), or use the AI prompt below to generate one..."
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    rows={4}
                  />
                  <Button onClick={addSource} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Description
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    💡 Tip: You can always paste canonical format text here (Title:, Block:, exercises) - it will be automatically detected and parsed.
                  </p>
                </div>
                
                <Card className="bg-muted/30 border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">💡 AI Tool Prompt</CardTitle>
                      <Badge variant="outline" className="text-xs">Universal</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Copy this prompt to ChatGPT, Grok, DeepSeek, or any AI tool for perfect workout formatting
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AIPromptCopyButton />
                    
                    <div className="pt-2 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        💾 Use Pre-Made GPT (Easiest)
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      </p>
                      <div className="bg-background/50 p-2 rounded text-xs space-y-2">
                        <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200 dark:border-green-800">
                          <p className="font-medium text-foreground mb-1">✅ Quick Start:</p>
                          <ol className="list-decimal list-inside ml-2 space-y-0.5 text-muted-foreground text-xs">
                            <li>Click: <a href="https://chatgpt.com/g/g-6923bf09941081919d29cb2c964c3a00-canonical-workout-builder" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Canonical Workout Builder GPT</a></li>
                            <li>Click <strong>"Use"</strong> → Ask: <span className="italic">"Create a full body workout"</span></li>
                            <li>Copy the output → Paste above → Click "Add Description"</li>
                          </ol>
                        </div>
                        
                        <div className="pt-2 border-t">
                          <p className="font-medium text-foreground mb-1 text-xs">🔧 Want to create your own?</p>
                          <p className="text-muted-foreground text-xs mb-1">Go to <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">chat.openai.com</a> → Explore GPTs → Create GPT</p>
                          <p className="text-muted-foreground text-xs">In the chat box, say: <span className="italic">"Create a GPT that outputs workouts in canonical format with Title, Block, and exercises"</span></p>
                          <p className="text-muted-foreground text-xs mt-1">Or paste the full prompt from above into the Configure → Instructions field.</p>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      This prompt ensures AI tools generate workouts in the correct format that will parse perfectly every time.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {sources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Added Sources ({sources.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="mt-0.5">
                      {getSourceIcon(source.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-muted-foreground capitalize mb-1">
                        {source.type.replace('-', ' ')}
                      </div>
                      <div className="text-sm break-all">
                        {source.content}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSource(source.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={sources.length === 0 || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {progress || 'Generating Structure...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Structure
                </>
              )}
            </Button>
            {loading && onCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                className="w-full"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
            {loading && progress && (
              <p className="text-xs text-muted-foreground text-center">{progress}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right sidebar - Templates & History */}
      <div className="lg:col-span-1 space-y-4">
        {/* Create New Workout Button */}
        {onCreateNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create New Workout</CardTitle>
              <CardDescription>
                Start with a blank workout and build it manually
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={onCreateNew}
                className="w-full"
                variant="default"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Workout
              </Button>
            </CardContent>
          </Card>
        )}
        
        <WorkoutTemplates
          onSelectTemplate={onLoadTemplate}
          onSelectHistory={onLoadTemplate}
        />
      </div>

      {/* VideoIngestDialog for Instagram URLs */}
      {user && (
        <VideoIngestDialog
          open={showVideoIngestDialog}
          onOpenChange={(open) => {
            setShowVideoIngestDialog(open);
            if (!open) setPendingInstagramUrl(null);
          }}
          userId={user.id}
          onWorkoutCreated={handleInstagramWorkoutCreated}
          initialUrl={pendingInstagramUrl || undefined}
        />
      )}
    </div>
  );
}