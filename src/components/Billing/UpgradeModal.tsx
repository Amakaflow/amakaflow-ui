/**
 * UpgradeModal — triggered when a free user hits a premium feature.
 *
 * AMA-1134: Freemium subscription and paywall.
 */

import { Crown, Sparkles, Shield, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  onUpgrade?: () => void;
}

// ---------------------------------------------------------------------------
// Feature display names
// ---------------------------------------------------------------------------

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  ai_weekly_planning: {
    label: 'AI Weekly Planning',
    description: 'Let AI create optimized weekly training plans based on your goals and recovery.',
  },
  unlimited_coach: {
    label: 'Unlimited AI Coach',
    description: 'Get unlimited conversations with your AI training coach.',
  },
  auto_sync: {
    label: 'Auto-Sync',
    description: 'Automatically sync workouts from Strava and Garmin without manual triggers.',
  },
  shoe_comparison: {
    label: 'Shoe Comparison',
    description: 'Compare shoe performance metrics across your runs.',
  },
  fatigue_advisor: {
    label: 'Body Fatigue Advisor',
    description: 'Get AI-powered fatigue analysis and recovery recommendations.',
  },
  unlimited_connections: {
    label: 'Unlimited Connections',
    description: 'Connect unlimited platforms like Strava, Garmin, and more.',
  },
  priority_support: {
    label: 'Priority Support',
    description: 'Get faster responses from our support team.',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
  onUpgrade,
}: UpgradeModalProps) {
  const featureInfo = feature ? FEATURE_LABELS[feature] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="upgrade-modal">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Crown className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-center text-xl">
            {featureInfo ? `Unlock ${featureInfo.label}` : 'Upgrade to Premium'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {featureInfo
              ? featureInfo.description
              : 'Get unlimited access to all AI-powered training features.'}
          </DialogDescription>
        </DialogHeader>

        {/* Benefits list */}
        <div className="space-y-3 py-4">
          <BenefitRow
            icon={<Sparkles className="h-4 w-4 text-amber-500" />}
            text="Unlimited AI coach conversations"
          />
          <BenefitRow
            icon={<Zap className="h-4 w-4 text-amber-500" />}
            text="AI weekly planning and auto-sync"
          />
          <BenefitRow
            icon={<Shield className="h-4 w-4 text-amber-500" />}
            text="Body fatigue advisor and shoe comparison"
          />
        </div>

        {/* Price */}
        <div className="text-center py-2">
          <span className="text-3xl font-bold">$14</span>
          <span className="text-muted-foreground">/month</span>
          <p className="text-sm text-muted-foreground mt-1">
            Start with a 7-day free trial
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            onClick={onUpgrade}
            data-testid="upgrade-confirm-button"
          >
            Start free trial
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex-shrink-0">{icon}</div>
      <span>{text}</span>
    </div>
  );
}
