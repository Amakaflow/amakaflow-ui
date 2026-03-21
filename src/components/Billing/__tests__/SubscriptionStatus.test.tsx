/**
 * Tests for SubscriptionStatusCard component.
 * AMA-1134: Freemium subscription and paywall.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubscriptionStatusCard } from '../SubscriptionStatus';

describe('SubscriptionStatusCard', () => {
  it('renders with free plan', () => {
    render(
      <SubscriptionStatusCard
        plan="free"
        status="active"
        isPremium={false}
      />
    );
    expect(screen.getByTestId('subscription-status')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows usage meter for free users', () => {
    render(
      <SubscriptionStatusCard
        plan="free"
        status="active"
        isPremium={false}
        coachMessagesUsed={3}
        coachMessagesLimit={5}
      />
    );
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('shows upgrade button for free users', () => {
    const onUpgrade = vi.fn();
    render(
      <SubscriptionStatusCard
        plan="free"
        status="active"
        isPremium={false}
        onUpgrade={onUpgrade}
      />
    );
    fireEvent.click(screen.getByText('Upgrade to Premium'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('shows Premium badge for premium users', () => {
    render(
      <SubscriptionStatusCard
        plan="premium"
        status="active"
        isPremium={true}
      />
    );
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('shows Trial badge for trialing users', () => {
    render(
      <SubscriptionStatusCard
        plan="premium"
        status="trialing"
        isPremium={true}
        trialEnd="2026-03-28T00:00:00Z"
      />
    );
    expect(screen.getByText('Trial')).toBeInTheDocument();
  });

  it('shows manage subscription button for premium users', () => {
    const onManage = vi.fn();
    render(
      <SubscriptionStatusCard
        plan="premium"
        status="active"
        isPremium={true}
        onManageSubscription={onManage}
      />
    );
    fireEvent.click(screen.getByText('Manage subscription'));
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it('does not show usage meter for premium users', () => {
    render(
      <SubscriptionStatusCard
        plan="premium"
        status="active"
        isPremium={true}
      />
    );
    expect(screen.queryByText('AI Coach messages')).not.toBeInTheDocument();
  });

  it('shows Past due badge for past_due status', () => {
    render(
      <SubscriptionStatusCard
        plan="premium"
        status="past_due"
        isPremium={false}
      />
    );
    expect(screen.getByText('Past due')).toBeInTheDocument();
  });

  it('shows renewal date for premium users', () => {
    render(
      <SubscriptionStatusCard
        plan="premium"
        status="active"
        isPremium={true}
        currentPeriodEnd="2026-04-21T00:00:00Z"
      />
    );
    expect(screen.getByText(/Renews/)).toBeInTheDocument();
  });
});
