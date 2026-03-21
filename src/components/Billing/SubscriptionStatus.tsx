/**
 * SubscriptionStatus — current plan badge for settings page.
 *
 * AMA-1134: Freemium subscription and paywall.
 */

import { Crown, Zap } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import type { Plan, SubscriptionStatus as SubStatus } from './hooks/useBilling';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SubscriptionStatusProps {
  plan: Plan;
  status: SubStatus;
  isPremium: boolean;
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
  coachMessagesUsed?: number;
  coachMessagesLimit?: number;
  onUpgrade?: () => void;
  onManageSubscription?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubscriptionStatusCard({
  plan,
  status,
  isPremium,
  currentPeriodEnd,
  trialEnd,
  coachMessagesUsed = 0,
  coachMessagesLimit = 5,
  onUpgrade,
  onManageSubscription,
}: SubscriptionStatusProps) {
  const isTrialing = status === 'trialing';
  const formattedDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const trialDate = trialEnd
    ? new Date(trialEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card data-testid="subscription-status">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPremium ? (
              <Crown className="h-5 w-5 text-amber-500" />
            ) : (
              <Zap className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle className="text-lg">Subscription</CardTitle>
          </div>
          <PlanBadge plan={plan} status={status} />
        </div>
        <CardDescription>
          {isPremium
            ? isTrialing
              ? `Trial ends ${trialDate || 'soon'}`
              : `Renews ${formattedDate || 'soon'}`
            : 'Free plan with basic features'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage meter for free users */}
        {!isPremium && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">AI Coach messages</span>
              <span>
                {coachMessagesUsed} / {coachMessagesLimit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (coachMessagesUsed / coachMessagesLimit) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        {isPremium ? (
          <Button variant="outline" className="w-full" onClick={onManageSubscription}>
            Manage subscription
          </Button>
        ) : (
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            onClick={onUpgrade}
          >
            Upgrade to Premium
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlanBadge({ plan, status }: { plan: Plan; status: SubStatus }) {
  if (plan === 'premium') {
    if (status === 'trialing') {
      return <Badge className="bg-amber-500 text-white">Trial</Badge>;
    }
    if (status === 'past_due') {
      return <Badge variant="destructive">Past due</Badge>;
    }
    return <Badge className="bg-amber-500 text-white">Premium</Badge>;
  }
  return <Badge variant="secondary">Free</Badge>;
}
