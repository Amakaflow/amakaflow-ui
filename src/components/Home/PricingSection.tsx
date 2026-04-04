import { Check, Zap, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

interface PricingTier {
  name: string;
  price: string;
  priceNote?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  icon: React.ReactNode;
  features: string[];
  highlight?: boolean;
  comingSoon?: boolean;
}

const TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    priceNote: 'forever during beta',
    badge: 'Current Plan',
    badgeVariant: 'default',
    icon: <Zap className="w-5 h-5 text-primary" />,
    highlight: true,
    features: [
      'Import & structure workouts',
      'Export to 1 device',
      'AI coach (limited queries)',
      'YouTube & image import',
      'Workout history',
    ],
  },
  {
    name: 'Pro',
    price: '$9',
    priceNote: 'per month',
    badge: 'Coming Soon',
    badgeVariant: 'secondary',
    icon: <Zap className="w-5 h-5 text-amber-500" />,
    comingSoon: true,
    features: [
      'Unlimited exports',
      'All supported devices',
      'Full AI coach access',
      'Priority support',
      'Advanced analytics',
    ],
  },
  {
    name: 'Team',
    price: '$29',
    priceNote: 'per month',
    badge: 'Coming Soon',
    badgeVariant: 'secondary',
    icon: <Users className="w-5 h-5 text-blue-500" />,
    comingSoon: true,
    features: [
      'Everything in Pro',
      'Multi-user (up to 10)',
      'Bulk workout exports',
      'Team management',
      'Shared workout library',
    ],
  },
];

export function PricingSection() {
  return (
    <div>
      {/* Hero badge */}
      <div className="flex flex-col items-center text-center mb-6">
        <Badge className="mb-3 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-sm px-3 py-1">
          Free During Beta
        </Badge>
        <h2 className="text-lg font-semibold">Simple, transparent pricing</h2>
        <p className="text-sm text-muted-foreground mt-1">
          No credit card required — everything free while we're in beta
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <Card
            key={tier.name}
            className={
              tier.highlight
                ? 'border-primary/40 ring-1 ring-primary/20 relative'
                : 'opacity-80'
            }
          >
            {tier.badge && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <Badge variant={tier.badgeVariant} className="text-xs whitespace-nowrap">
                  {tier.badge}
                </Badge>
              </div>
            )}
            <CardHeader className="pb-3 pt-6">
              <div className="flex items-center gap-2 mb-1">
                {tier.icon}
                <CardTitle className="text-base">{tier.name}</CardTitle>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{tier.price}</span>
                {tier.priceNote && (
                  <span className="text-xs text-muted-foreground">{tier.priceNote}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-5">
              {tier.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-snug">{feature}</span>
                </div>
              ))}
              {tier.comingSoon && (
                <p className="text-xs text-muted-foreground italic pt-1">
                  Join waitlist when available
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        No credit card required during beta. Paid plans announced before launch.
      </p>
    </div>
  );
}
