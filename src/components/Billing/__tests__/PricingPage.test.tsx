/**
 * Tests for PricingPage component.
 * AMA-1134: Freemium subscription and paywall.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Clerk's PricingTable — it requires ClerkProvider which isn't available in unit tests
vi.mock('@clerk/clerk-react', () => ({
  PricingTable: () => <div data-testid="clerk-pricing-table" />,
}));

import { PricingPage } from '../PricingPage';

describe('PricingPage', () => {
  it('renders both plan cards', () => {
    render(<PricingPage />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('shows $0 for free and $14 for premium', () => {
    render(<PricingPage />);
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$14')).toBeInTheDocument();
  });

  it('shows feature comparison rows', () => {
    render(<PricingPage />);
    // Features appear in both free and premium columns
    expect(screen.getAllByText('AI Coach messages').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI weekly planning').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Body fatigue advisor').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Current badge on free plan when currentPlan is free', () => {
    render(<PricingPage currentPlan="free" />);
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('shows Current badge on premium plan when currentPlan is premium', () => {
    render(<PricingPage currentPlan="premium" />);
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('calls onUpgrade when clicking upgrade button', () => {
    const onUpgrade = vi.fn();
    render(<PricingPage currentPlan="free" onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByTestId('upgrade-button'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('shows "Start free trial" button for free users', () => {
    render(<PricingPage currentPlan="free" />);
    expect(screen.getByText('Start free trial')).toBeInTheDocument();
  });

  it('shows "Manage subscription" button for premium users', () => {
    const onManage = vi.fn();
    render(<PricingPage currentPlan="premium" onManageSubscription={onManage} />);
    expect(screen.getByText('Manage subscription')).toBeInTheDocument();
  });

  it('includes 7-day trial mention', () => {
    render(<PricingPage />);
    expect(screen.getByText('7-day free trial included')).toBeInTheDocument();
  });

  it('has correct test id', () => {
    render(<PricingPage />);
    expect(screen.getByTestId('pricing-page')).toBeInTheDocument();
  });
});
