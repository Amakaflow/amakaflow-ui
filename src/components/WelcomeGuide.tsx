import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Youtube, 
  Image as ImageIcon, 
  Bot,
  FileText,
  ShieldCheck,
  Download,
  X,
  Play
} from 'lucide-react';

interface WelcomeGuideProps {
  onGetStarted: () => void;
  onDismiss?: () => void;
}

export function WelcomeGuide({ onGetStarted, onDismiss }: WelcomeGuideProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const steps = [
    {
      number: 1,
      icon: <Youtube className="w-5 h-5" />,
      title: 'Add Sources',
      description: 'Import workout content from YouTube videos, images, or text descriptions',
      examples: ['YouTube Video', 'Workout Image', 'AI Text Description']
    },
    {
      number: 2,
      icon: <FileText className="w-5 h-5" />,
      title: 'Structure Workout',
      description: 'Review and edit the automatically generated workout structure with exercises, sets, reps, and rest periods',
      examples: ['Edit exercise names', 'Adjust sets and reps', 'Select target device']
    },
    {
      number: 3,
      icon: <ShieldCheck className="w-5 h-5" />,
      title: 'Validate & Map',
      description: 'Review exercise mappings, confirm suggestions, or search for alternatives to ensure accuracy',
      examples: ['Confirm AI suggestions', 'Map exercises to device library', 'Review confidence scores']
    },
    {
      number: 4,
      icon: <Download className="w-5 h-5" />,
      title: 'Publish & Export',
      description: 'Export your workout to your fitness device (Garmin, Apple Watch, Zwift) or save for later',
      examples: ['Download Garmin YAML', 'Export to Apple Watch', 'Save to history']
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-primary/50 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl mb-2">Welcome to AmakaFlow</CardTitle>
              <CardDescription className="text-base">
                Transform workout content into structured training for your fitness devices
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Follow these simple steps to create and export your workouts:
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              {steps.map((step, idx) => (
                <Card key={step.number} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                          {step.number}
                        </div>
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span className="text-muted-foreground">{step.icon}</span>
                          {step.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3">
                      {step.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {step.examples.map((example, exIdx) => (
                        <Badge key={exIdx} variant="outline" className="text-xs">
                          {example}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={onGetStarted} size="lg" className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Get Started
              </Button>
              <Button 
                variant="outline"
                onClick={handleDismiss}
                size="lg"
              >
                Skip for now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

