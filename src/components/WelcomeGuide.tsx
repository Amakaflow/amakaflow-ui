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
  Play,
  Monitor,
  ArrowDownToLine,
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

            {/* Compact trust signals */}
            <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
              {/* Device icons row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Works with:</span>
                {[
                  { emoji: '⌚', label: 'Garmin' },
                  { emoji: '🍎', label: 'Apple Watch' },
                  { emoji: '🚴', label: 'Zwift' },
                  { emoji: '▶️', label: 'YouTube' },
                  { emoji: '📸', label: 'Instagram' },
                ].map((d) => (
                  <span key={d.label} title={d.label} className="text-lg leading-none" aria-label={d.label}>
                    {d.emoji}
                  </span>
                ))}
              </div>
              {/* One-liner stat */}
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                AI-assisted with human verification
                <span className="text-muted-foreground/40">•</span>
                <Monitor className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                6 platforms
                <span className="text-muted-foreground/40">•</span>
                <ArrowDownToLine className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                Import from YouTube, Instagram &amp; more
              </p>
              {/* Founder quote */}
              <blockquote className="border-l-2 border-primary pl-2.5">
                <p className="text-xs text-muted-foreground italic">
                  "I built this because I was tired of manually copying workouts."
                </p>
                <footer className="text-xs font-medium mt-0.5">— David, Founder</footer>
              </blockquote>
            </div>

            <div className="flex gap-3 pt-2">
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

