/**
 * Paywall page — shown when a user lands on gated routes without an active
 * Pro subscription. Uses Clerk's native `<PricingTable />` which renders the
 * plans configured in the Clerk dashboard and handles Stripe Checkout.
 *
 * AMA-1590 / AMA-MVP-08. Paired with the `require_pro_plan` backend guard
 * and the `<ProPlanGate />` route wrapper below.
 */
import { PricingTable, Protect, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import './PaywallPage.css';

export function PaywallPage() {
  return (
    <>
      <SignedOut>
        {/* Users must be signed in before they can subscribe. */}
        <RedirectToSignIn redirectUrl="/paywall" />
      </SignedOut>
      <SignedIn>
        <main className="paywall-root" role="main" aria-labelledby="paywall-heading">
          <header className="paywall-hero">
            <h1 id="paywall-heading">
              One plan for your runs, lifts, and conditioning —
              <br />
              that actually changes when your body does.
            </h1>
            <p className="paywall-subhead">
              Written to your watch every morning. $24/month, 7-day free trial.
            </p>
          </header>
          <section aria-label="Pricing" className="paywall-pricing">
            <PricingTable />
          </section>
        </main>
      </SignedIn>
    </>
  );
}

/**
 * Route-level guard: wrap any gated page tree with this component.
 *
 * If the user has the `pro` plan → renders children.
 * Otherwise → renders the paywall inline (no redirect — keeps URL so the
 * user can upgrade and continue without re-navigating).
 *
 * Usage:
 *   <Route path="/today" element={
 *     <ProPlanGate>
 *       <TodayScreen />
 *     </ProPlanGate>
 *   } />
 */
export function ProPlanGate({ children }: { children: ReactNode }) {
  return (
    <Protect
      plan="pro"
      fallback={<PaywallPage />}
    >
      {children}
    </Protect>
  );
}

export default PaywallPage;
