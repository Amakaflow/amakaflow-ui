/**
 * PricingPage — side-by-side Free vs Premium comparison.
 *
 * AMA-1134: Freemium subscription and paywall.
 */

import { Check, X, Zap, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

// ---------------------------------------------------------------------------
// Feature comparison data
// ---------------------------------------------------------------------------

interface FeatureRow {
  name: string;
  free: string | boolean;
  premium: string | boolean;
}

const FEATURES: FeatureRow[] = [
  { name: 'Platform connections', free: '2', premium: 'Unlimited' },
  { name: 'Session creation', free: 'Manual', premium: 'Manual + AI auto-create' },
  { name: 'Calendar view', free: true, premium: true },
  { name: 'AI Coach messages', free: '5 / month', premium: 'Unlimited' },
  { name: 'Garmin push sync', free: 'Basic', premium: 'Full auto-sync' },
  { name: 'AI weekly planning', free: false, premium: true },
  { name: 'Auto-sync (Strava/Garmin)', free: false, premium: true },
  { name: 'Shoe comparison', free: false, premium: true },
  { name: 'Body fatigue advisor', free: false, premium: true },
  { name: 'Priority support', free: false, premium: true },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-4 w-4 text-green-500" />
    ) : (
      <X className="h-4 w-4 text-muted-foreground/40" />
    );
  }
  return <span className="text-sm">{value}</span>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PricingPageProps {
  currentPlan?: 'free' | 'premium';
  onUpgrade?: () => void;
  onManageSubscription?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PricingPage({
  currentPlan = 'free',
  onUpgrade,
  onManageSubscription,
}: PricingPageProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8" data-testid="pricing-page">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
        <p className="text-muted-foreground text-lg">
          Get the most out of your training with AmakaFlow Premium
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free tier */}
        <Card className={currentPlan === 'free' ? 'ring-2 ring-primary' : ''}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-xl">Free</CardTitle>
              {currentPlan === 'free' && <Badge variant="secondary">Current</Badge>}
            </div>
            <CardDescription>Get started with the basics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted-foreground ml-1">/ month</span>
            </div>
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{f.name}</span>
                  <FeatureValue value={f.free} />
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>
              {currentPlan === 'free' ? 'Current plan' : 'Downgrade'}
            </Button>
          </CardFooter>
        </Card>

        {/* Premium tier */}
        <Card className="ring-2 ring-amber-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
            Recommended
          </div>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-xl">Premium</CardTitle>
              {currentPlan === 'premium' && <Badge className="bg-amber-500">Current</Badge>}
            </div>
            <CardDescription>Unlock all AI-powered features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <span className="text-4xl font-bold">$14</span>
              <span className="text-muted-foreground ml-1">/ month</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              7-day free trial included
            </p>
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f.name} className="flex items-center justify-between text-sm">
                  <span>{f.name}</span>
                  <FeatureValue value={f.premium} />
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {currentPlan === 'premium' ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={onManageSubscription}
              >
                Manage subscription
              </Button>
            ) : (
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={onUpgrade}
                data-testid="upgrade-button"
              >
                Start free trial
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* FAQ / reassurance */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>Cancel anytime. No questions asked.</p>
        <p>Your data stays yours -- even after downgrading.</p>
      </div>
    </div>
  );
}
