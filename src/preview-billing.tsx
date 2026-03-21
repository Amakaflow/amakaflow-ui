/**
 * Standalone preview entry point for Billing components.
 * Served at /billing-preview.html during dev.
 *
 * AMA-1134: Renders pricing page, upgrade modal, and subscription status
 * for Playwright screenshots.
 *
 * Modes (via ?mode= query param):
 * - pricing: Full pricing page comparison (default)
 * - upgrade-modal: Upgrade modal dialog
 * - subscription-free: Subscription status card (free plan)
 * - subscription-premium: Subscription status card (premium plan)
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { PricingPage } from './components/Billing/PricingPage';
import { UpgradeModal } from './components/Billing/UpgradeModal';
import { SubscriptionStatusCard } from './components/Billing/SubscriptionStatus';

function getMode(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') || 'pricing';
}

function BillingPreview() {
  const mode = getMode();
  const [upgradeOpen, setUpgradeOpen] = useState(true);

  if (mode === 'upgrade-modal') {
    return (
      <div className="min-h-screen bg-background p-8">
        <UpgradeModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          feature="fatigue_advisor"
          onUpgrade={() => alert('Starting checkout...')}
        />
        {!upgradeOpen && (
          <div className="flex items-center justify-center h-64">
            <button
              className="text-primary underline"
              onClick={() => setUpgradeOpen(true)}
            >
              Re-open modal
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'subscription-free') {
    return (
      <div className="min-h-screen bg-background p-8 max-w-md mx-auto">
        <SubscriptionStatusCard
          plan="free"
          status="active"
          isPremium={false}
          coachMessagesUsed={3}
          coachMessagesLimit={5}
          onUpgrade={() => alert('Starting checkout...')}
        />
      </div>
    );
  }

  if (mode === 'subscription-premium') {
    return (
      <div className="min-h-screen bg-background p-8 max-w-md mx-auto">
        <SubscriptionStatusCard
          plan="premium"
          status="active"
          isPremium={true}
          currentPeriodEnd="2026-04-21T00:00:00Z"
          onManageSubscription={() => alert('Opening portal...')}
        />
      </div>
    );
  }

  // Default: pricing page
  return (
    <div className="min-h-screen bg-background">
      <PricingPage
        currentPlan="free"
        onUpgrade={() => alert('Starting checkout...')}
      />
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<BillingPreview />);
}
