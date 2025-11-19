import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { 
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Timer,
  MapPin,
  ExternalLink,
  AlertCircle,
  Activity,
  Eye,
  X,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { getStravaActivities, updateStravaActivity, getStravaAthlete, StravaActivity, StravaTokenExpiredError, StravaUnauthorizedError, initiateStravaOAuth, checkAndRefreshStravaToken } from '../lib/strava-api';
import { useClerkUser } from '../lib/clerk-auth';
import { getLinkedAccounts, isAccountConnected } from '../lib/linked-accounts';

type Step = 'select-activity' | 'add-details' | 'success';

interface StravaEnhanceProps {
  onClose: () => void;
}

export function StravaEnhance({ onClose }: StravaEnhanceProps) {
  const { user: clerkUser } = useClerkUser();
  const profileId = clerkUser?.id || '';
  
  const [currentStep, setCurrentStep] = useState<Step>('select-activity');
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  
  // Enhancement fields
  const [overwriteTitle, setOverwriteTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [highlights, setHighlights] = useState('');
  const [intensity, setIntensity] = useState('');
  const [focus, setFocus] = useState('');
  const [volume, setVolume] = useState('');
  const [notes, setNotes] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  const [showPreview, setShowPreview] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const errorShownRef = useRef(false);
  const isReauthorizingRef = useRef(false);

  // Fetch Strava activities when component mounts
  useEffect(() => {
    const loadActivities = async () => {
      if (!profileId) {
        setLoadingActivities(false);
        return;
      }

      // Reset error shown flag for new profileId
      errorShownRef.current = false;
      isReauthorizingRef.current = false;
      
      // Store return path for after reauthorization
      sessionStorage.setItem('strava_return_path', window.location.pathname + window.location.search);

      try {
        // Get linked accounts to check if Strava is connected
        const linkedAccounts = await getLinkedAccounts(profileId);
        const stravaAccount = linkedAccounts.strava;
        
        if (!stravaAccount.connected) {
          if (!errorShownRef.current) {
            toast.error('Please connect your Strava account first via OAuth in Settings');
            errorShownRef.current = true;
          }
          setLoadingActivities(false);
          return;
        }

        // Check if token is valid and refresh if needed
        // This will automatically refresh the token if it's expired but refresh token is valid
        const tokenValid = await checkAndRefreshStravaToken(profileId);
        
        if (!tokenValid) {
          // Token expired and refresh failed - need reauthorization
          // Check if account is still marked as connected in linked_accounts
          const isConnected = await isAccountConnected(profileId, 'strava');
          
          if (isConnected) {
            // Show refresh modal instead of auto-redirecting
            setShowRefreshModal(true);
            setLoadingActivities(false);
            return;
          } else {
            // Account not connected - user needs to connect first
            if (!errorShownRef.current) {
              toast.error('Please connect your Strava account first via OAuth in Settings');
              errorShownRef.current = true;
            }
            setLoadingActivities(false);
            return;
          }
        }

        // Token is valid - fetch activities
        const fetchedActivities = await getStravaActivities(profileId, 5);
        setActivities(fetchedActivities);
      } catch (error: any) {
        console.error('Failed to load Strava activities:', error);
        
        // Handle token expiration errors
        if (error instanceof StravaTokenExpiredError || error instanceof StravaUnauthorizedError) {
          // Check if account is connected
          try {
            const isConnected = await isAccountConnected(profileId, 'strava');
            
            if (isConnected) {
              // Show refresh modal instead of auto-redirecting
              setShowRefreshModal(true);
            } else {
              // Account not connected
              if (!errorShownRef.current) {
                toast.error('Please connect your Strava account first via OAuth in Settings');
                errorShownRef.current = true;
              }
            }
          } catch (checkError) {
            console.error('Failed to check account connection:', checkError);
            if (!errorShownRef.current) {
              setShowRefreshModal(true);
            }
          }
        } else {
          // Other errors
          if (!errorShownRef.current) {
            if (error.message?.includes('No tokens found')) {
              setShowRefreshModal(true);
            } else {
              toast.error(`Failed to load activities: ${error.message || 'Unknown error'}`);
            }
            errorShownRef.current = true;
          }
        }
      } finally {
        setLoadingActivities(false);
      }
    };

    loadActivities();
  }, [profileId]);

  // Format distance (defaults to miles, will use settings eventually)
  const formatDistance = (meters: number) => {
    // Convert meters to miles (1 mile = 1609.34 meters)
    const miles = meters / 1609.34;
    
    if (miles >= 1) {
      return `${miles.toFixed(2)} mi`;
    } else if (meters >= 100) {
      // For distances less than 1 mile but >= 100m, show in feet
      const feet = meters * 3.28084;
      return `${Math.round(feet)} ft`;
    } else {
      // For very short distances, show in meters
      return `${Math.round(meters)} m`;
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate enhanced description using MyAmaka template
  const generateDescription = () => {
    let description = '🏋️‍♂️ MYAMAKA ACTIVITY ENHANCEMENT\n';
    description += '──────────────────────────────\n\n';

    if (summary.trim()) {
      description += '📌 Summary\n';
      description += summary.trim() + '\n\n';
    }

    if (highlights.trim()) {
      description += '🔥 Key Highlights\n';
      description += highlights.trim() + '\n\n';
    }

    if (intensity) {
      description += '💥 Intensity\n';
      description += intensity + '\n\n';
    }

    if (focus.trim()) {
      description += '🎯 Focus\n';
      description += focus.trim() + '\n\n';
    }

    if (volume.trim()) {
      description += '📊 Estimated Volume\n';
      description += volume.trim() + '\n\n';
    }

    if (uploadedImage) {
      description += '📸 Workout Image:\n';
      description += uploadedImage + '\n\n';
    }

    if (notes.trim()) {
      description += '──────────────────────────────\n';
      description += 'Athlete Notes:\n';
      description += notes.trim() + '\n\n';
    }

    description += '──────────────────────────────\n';
    description += '🤖 Enhanced via MyAmaka\n';
    description += 'Ingest → Enhance → Sync';

    return description;
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      toast.success('Image uploaded');
    };
    reader.readAsDataURL(file);
  };

  // Handle enhance activity
  const handleEnhance = async () => {
    if (!selectedActivity || !profileId) {
      toast.error('Missing activity or user profile');
      return;
    }

    setIsEnhancing(true);

    try {
      // Check if token is valid before attempting to enhance
      const tokenValid = await checkAndRefreshStravaToken(profileId);
      
      if (!tokenValid) {
        // Token expired - check if account is connected and show refresh modal
        const isConnected = await isAccountConnected(profileId, 'strava');
        
        if (isConnected) {
          // Show refresh modal instead of auto-redirecting
          setShowRefreshModal(true);
        } else {
          toast.error('Please connect your Strava account first via OAuth in Settings');
        }
        setIsEnhancing(false);
        return;
      }

      // Generate the enhanced description
      const description = generateDescription();

      // Update the activity on Strava using profileId as userId
      await updateStravaActivity(
        profileId,
        selectedActivity.id,
        {
          overwriteTitle: overwriteTitle,
          newTitle: overwriteTitle ? newTitle : undefined,
          overwriteDescription: true,
          description: description,
        }
      );

      toast.success('Strava activity enhanced!');
      setCurrentStep('success');
    } catch (error: any) {
      console.error('Failed to enhance activity:', error);
      
      // Handle token expiration during enhance
      if (error instanceof StravaTokenExpiredError || error instanceof StravaUnauthorizedError) {
        try {
          const isConnected = await isAccountConnected(profileId, 'strava');
          
          if (isConnected) {
            // Show refresh modal instead of auto-redirecting
            setShowRefreshModal(true);
          } else {
            toast.error('Please connect your Strava account first via OAuth in Settings');
          }
        } catch (checkError) {
          console.error('Failed to check account connection:', checkError);
          setShowRefreshModal(true);
        }
      } else {
        toast.error(`Failed to enhance activity: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  // Navigation
  const goBack = () => {
    if (currentStep === 'add-details') setCurrentStep('select-activity');
  };

  const goNext = () => {
    if (currentStep === 'select-activity' && selectedActivity) {
      setNewTitle(selectedActivity.name);
      setCurrentStep('add-details');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2">Enhance Strava Activity</h2>
          <p className="text-muted-foreground">
            Add MyAmaka's structured formatting to your Strava activity
          </p>
        </div>
        <Badge variant="secondary">
          {currentStep === 'select-activity' && 'Step 1 of 2'}
          {currentStep === 'add-details' && 'Step 2 of 2'}
          {currentStep === 'success' && 'Complete'}
        </Badge>
      </div>

      {/* Progress Steps */}
      {currentStep !== 'success' && (
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-2 rounded ${currentStep === 'select-activity' || currentStep === 'add-details' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex-1 h-2 rounded ${currentStep === 'add-details' ? 'bg-primary' : 'bg-muted'}`} />
        </div>
      )}

      {/* Step 1: Select Strava Activity */}
      {currentStep === 'select-activity' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-600" />
              Select a Strava Activity
            </CardTitle>
            <CardDescription>
              Choose a workout that already exists on Strava
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActivities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground mb-2">No Strava activities found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Make sure your Strava account is connected via OAuth in Settings
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={onClose}>
                    Go Back
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {activities.map(activity => {
                    const hasDescription = !!activity.description && activity.description.trim().length > 0;
                    const hasImages = activity.photos && activity.photos.count > 0;

                    return (
                      <div
                        key={activity.id}
                        onClick={() => setSelectedActivity(activity)}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedActivity?.id === activity.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{activity.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {activity.type}
                              </Badge>
                              {hasImages && (
                                <Badge variant="outline" className="text-xs">
                                  Has images
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(activity.start_date)}
                            </div>
                          </div>
                          {selectedActivity?.id === activity.id && (
                            <Check className="w-5 h-5 text-primary" />
                          )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          {activity.distance > 0 && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span>{formatDistance(activity.distance)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Timer className="w-4 h-4 text-muted-foreground" />
                            <span>{formatTime(activity.moving_time || activity.elapsed_time)}</span>
                          </div>
                        </div>

                        {/* Existing description preview */}
                        {hasDescription && activity.description && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            {activity.description.slice(0, 100)}...
                          </div>
                        )}

                        {hasDescription && (
                          <Alert className="mt-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              This activity already has a description. It will be replaced with MyAmaka formatting.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Add Enhancement Details */}
      {currentStep === 'add-details' && selectedActivity && (
        <div className="space-y-4">
          {/* Selected Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selected Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Activity className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{selectedActivity.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(selectedActivity.date)} • {selectedActivity.type}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Title */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Title</CardTitle>
              <CardDescription>
                {overwriteTitle ? 'Custom title will replace Strava activity name' : 'Keep original Strava activity name'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="overwrite-title" className="text-sm font-medium cursor-pointer">
                  Overwrite Title
                </Label>
                <Switch
                  id="overwrite-title"
                  checked={overwriteTitle}
                  onCheckedChange={setOverwriteTitle}
                />
              </div>
              {overwriteTitle && (
                <div className="space-y-2">
                  <Label htmlFor="new-title">New Title</Label>
                  <Input
                    id="new-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Morning Hyrox Session"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhancement Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enhancement Details</CardTitle>
              <CardDescription>
                Fill in the fields below to create a structured workout description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="space-y-2">
                <Label>Workout Summary</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Describe what you did..."
                  rows={3}
                />
              </div>

              {/* Key Highlights */}
              <div className="space-y-2">
                <Label>Key Highlights</Label>
                <Textarea
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  placeholder="e.g., Tough sled today, New PR, Zone 4 focus"
                  rows={2}
                />
              </div>

              {/* Intensity Rating */}
              <div className="space-y-2">
                <Label>Intensity Rating</Label>
                <Select value={intensity} onValueChange={setIntensity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select intensity..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                    <SelectItem value="Max">Max</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Main Movement / Focus */}
              <div className="space-y-2">
                <Label>Main Movement / Focus</Label>
                <Input
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="e.g., Sled pushes, Endurance running"
                />
              </div>

              {/* Estimated Volume */}
              <div className="space-y-2">
                <Label>Estimated Volume</Label>
                <Input
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  placeholder="e.g., 5k total distance, 200 reps"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or observations..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workout Image (Optional)</CardTitle>
              <CardDescription>
                Upload an image to include in the description
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedImage ? (
                  <div className="relative inline-block">
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded workout" 
                      className="w-32 h-32 object-cover rounded-lg border border-primary"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setUploadedImage(null)}
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground text-center px-2">
                      Upload image
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Screen */}
      {currentStep === 'success' && selectedActivity && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl">Strava Activity Enhanced!</h3>
              <p className="text-muted-foreground">
                Your activity "{selectedActivity.name}" has been enhanced with MyAmaka formatting
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => {
                  window.open(`https://www.strava.com/activities/${selectedActivity.id}`, '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Strava
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onClose}
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      {currentStep !== 'success' && (
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={currentStep === 'select-activity' ? onClose : goBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {currentStep === 'select-activity' ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex gap-2">
            {currentStep === 'add-details' && (
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
            )}
            
            {currentStep === 'select-activity' ? (
              <Button
                onClick={goNext}
                disabled={!selectedActivity}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleEnhance}
                disabled={
                  isEnhancing || 
                  !summary.trim() || 
                  (overwriteTitle && !newTitle.trim())
                }
              >
                {isEnhancing ? 'Enhancing...' : 'Enhance Activity'}
                {!isEnhancing && <Check className="w-4 h-4 ml-2" />}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview Enhancement</DialogTitle>
            <DialogDescription>
              This is how your activity will appear on Strava
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {overwriteTitle && newTitle.trim() && (
                <div>
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <div className="p-3 bg-muted rounded-lg mt-1">
                    {newTitle}
                  </div>
                </div>
              )}
              
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="p-4 bg-muted rounded-lg mt-1 whitespace-pre-wrap text-sm font-mono">
                  {generateDescription()}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Token Refresh Modal */}
      <Dialog open={showRefreshModal} onOpenChange={setShowRefreshModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Strava Token Expired
            </DialogTitle>
            <DialogDescription>
              Your Strava connection needs to be refreshed. Click the button below to reauthorize.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Your Strava access token has expired. Please reauthorize to continue using Strava features.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowRefreshModal(false)}
                className="flex-1"
                disabled={isRefreshing}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!profileId) {
                    toast.error('Please sign in to refresh your Strava connection');
                    return;
                  }

                  setIsRefreshing(true);
                  try {
                    // Store return path for after reauthorization
                    sessionStorage.setItem('strava_return_path', window.location.pathname + window.location.search);
                    sessionStorage.setItem('strava_auto_reauthorize', 'true');
                    
                    const oauthUrl = await initiateStravaOAuth(profileId);
                    window.location.href = oauthUrl;
                    // Don't set isRefreshing to false - we're redirecting
                  } catch (error: any) {
                    setIsRefreshing(false);
                    console.error('Failed to initiate Strava OAuth:', error);
                    toast.error(`Failed to refresh Strava connection: ${error.message || 'Unknown error'}`);
                  }
                }}
                className="flex-1"
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 mr-2" />
                    Refresh Token
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
