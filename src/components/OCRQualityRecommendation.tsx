import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Sparkles, Eye, Info, X } from 'lucide-react';
import { useState } from 'react';
import { setImageProcessingMethod } from '../lib/preferences';
import { useNavigate } from 'react-router-dom';

interface OCRQualityRecommendationProps {
  qualityScore: number;
  onDismiss?: () => void;
  onNavigateToSettings?: () => void;
}

export function OCRQualityRecommendation({ qualityScore, onDismiss, onNavigateToSettings }: OCRQualityRecommendationProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const handleSwitchToVision = () => {
    setImageProcessingMethod('vision');
    // Reload page to apply changes
    window.location.reload();
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
      <Info className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="flex items-center justify-between">
        <span>OCR Quality: {qualityScore}% - Consider Using Vision API</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          This image appears too complex for OCR. The <strong>AI Vision Model</strong> typically provides better accuracy for:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <div className="font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4" />
              OCR Works Best For:
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
              <li>Clear, high-contrast text</li>
              <li>Simple layouts</li>
              <li>Standard fonts</li>
              <li>Plain backgrounds</li>
              <li>Printed documents</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <div className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Vision API Works Best For:
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
              <li>Complex layouts</li>
              <li>Stylized fonts</li>
              <li>Colored text on backgrounds</li>
              <li>Instagram/social media images</li>
              <li>Handwritten or stylized text</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleSwitchToVision}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Switch to Vision API
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onNavigateToSettings || (() => {
              // Fallback: try to navigate via custom event
              window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'settings' } }));
            })}
          >
            Go to Settings
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

