/**
 * Tests for the paywall surface (AMA-1590 / AMA-MVP-08).
 *
 * We mock @clerk/clerk-react so tests run without a live Clerk session —
 * the SignedIn/SignedOut/PricingTable/Protect primitives get stand-ins
 * that render deterministically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Capture the plan slug the `condition` closure asks about, so we can assert
// the gate really is checking for the `pro` plan.
const protectPlanChecks: string[] = [];
// Toggle: simulate signed-in vs signed-out user.
let mockSignedIn = true;
// Toggle: simulate has-pro-plan vs not.
let mockHasPro = true;

type ClerkHas = (options: { plan?: string; role?: string; permission?: string }) => boolean;
type ClerkProtectProps = {
  condition?: (has: ClerkHas) => boolean;
  children?: ReactNode;
  fallback?: ReactNode;
};

vi.mock('@clerk/clerk-react', () => ({
  PricingTable: () => <div data-testid="clerk-pricing-table">[PricingTable]</div>,
  SignedIn: ({ children }: { children: ReactNode }) => (mockSignedIn ? <>{children}</> : null),
  SignedOut: ({ children }: { children: ReactNode }) => (mockSignedIn ? null : <>{children}</>),
  RedirectToSignIn: () => <div data-testid="redirect-sign-in" />,
  Protect: ({ condition, children, fallback }: ClerkProtectProps) => {
    // Run the caller's condition with a `has` that records which plan is
    // being checked and answers based on the mockHasPro toggle.
    const has: ClerkHas = ({ plan }) => {
      if (plan) protectPlanChecks.push(plan);
      return mockHasPro;
    };
    const allowed = condition ? condition(has) : true;
    return allowed ? <>{children}</> : <>{fallback}</>;
  },
}));

// Import AFTER the mock is registered.
import { PaywallPage, ProPlanGate } from '../PaywallPage';


describe('PaywallPage', () => {
  beforeEach(() => {
    protectPlanChecks.length = 0;
    mockSignedIn = true;
    mockHasPro = true;
  });

  it('renders the hero copy + Clerk PricingTable when signed in', () => {
    render(
      <MemoryRouter>
        <PaywallPage />
      </MemoryRouter>,
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    // AMA-1590 spec copy — must match exactly (no editorializing like "actually").
    expect(heading.textContent).toMatch(
      /One plan for your runs, lifts, and conditioning — that changes when your body does\.?\s*Written to your watch every morning\./i,
    );
    expect(heading.textContent).not.toMatch(/actually/i);
    expect(screen.getByText(/\$24\/month, 7-day free trial/i)).toBeInTheDocument();
    expect(screen.getByTestId('clerk-pricing-table')).toBeInTheDocument();
  });

  it('redirects to sign-in if the visitor is not authenticated', () => {
    mockSignedIn = false;
    render(
      <MemoryRouter>
        <PaywallPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('redirect-sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-pricing-table')).toBeNull();
  });
});


describe('ProPlanGate', () => {
  beforeEach(() => {
    protectPlanChecks.length = 0;
    mockSignedIn = true;
    mockHasPro = true;
  });

  it('delegates the plan check to Clerk Protect with plan="pro"', () => {
    render(
      <MemoryRouter>
        <ProPlanGate>
          <div data-testid="gated">secret</div>
        </ProPlanGate>
      </MemoryRouter>,
    );
    // Asserts the gate actually calls has({plan: 'pro'}), not just that Protect rendered.
    expect(protectPlanChecks).toContain('pro');
  });

  it('renders children when the user has the pro plan', () => {
    mockHasPro = true;
    render(
      <MemoryRouter>
        <ProPlanGate>
          <div data-testid="gated">secret</div>
        </ProPlanGate>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('gated')).toBeInTheDocument();
  });

  it('renders the paywall fallback when the user is not on the pro plan', () => {
    mockHasPro = false;
    render(
      <MemoryRouter>
        <ProPlanGate>
          <div data-testid="gated">secret</div>
        </ProPlanGate>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('gated')).toBeNull();
    expect(screen.getByTestId('clerk-pricing-table')).toBeInTheDocument();
  });
});
