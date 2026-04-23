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

// Track which plan Protect was asked to gate on, so we can assert it.
const protectCalls: Array<{ plan?: string; hasChildren: boolean }> = [];
// Toggle: simulate signed-in vs signed-out user.
let mockSignedIn = true;
// Toggle: simulate has-pro-plan vs not.
let mockHasPro = true;

vi.mock('@clerk/clerk-react', () => ({
  PricingTable: () => <div data-testid="clerk-pricing-table">[PricingTable]</div>,
  SignedIn: ({ children }: { children: ReactNode }) => (mockSignedIn ? <>{children}</> : null),
  SignedOut: ({ children }: { children: ReactNode }) => (mockSignedIn ? null : <>{children}</>),
  RedirectToSignIn: () => <div data-testid="redirect-sign-in" />,
  Protect: ({ plan, children, fallback }: { plan?: string; children: ReactNode; fallback?: ReactNode }) => {
    protectCalls.push({ plan, hasChildren: !!children });
    return mockHasPro ? <>{children}</> : <>{fallback}</>;
  },
}));

// Import AFTER the mock is registered.
import { PaywallPage, ProPlanGate } from '../PaywallPage';


describe('PaywallPage', () => {
  beforeEach(() => {
    protectCalls.length = 0;
    mockSignedIn = true;
    mockHasPro = true;
  });

  it('renders the hero copy + Clerk PricingTable when signed in', () => {
    render(
      <MemoryRouter>
        <PaywallPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/changes when your body does/i)).toBeInTheDocument();
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
    protectCalls.length = 0;
    mockSignedIn = true;
    mockHasPro = true;
  });

  it('delegates plan check to Clerk Protect with plan="pro"', () => {
    render(
      <MemoryRouter>
        <ProPlanGate>
          <div data-testid="gated">secret</div>
        </ProPlanGate>
      </MemoryRouter>,
    );
    expect(protectCalls).toHaveLength(1);
    expect(protectCalls[0].plan).toBe('pro');
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
