/**
 * Tests for UpgradeModal component.
 * AMA-1134: Freemium subscription and paywall.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpgradeModal } from '../UpgradeModal';

describe('UpgradeModal', () => {
  it('renders when open', () => {
    render(
      <UpgradeModal open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <UpgradeModal open={false} onOpenChange={vi.fn()} />
    );
    expect(screen.queryByTestId('upgrade-modal')).not.toBeInTheDocument();
  });

  it('shows feature-specific title when feature is provided', () => {
    render(
      <UpgradeModal
        open={true}
        onOpenChange={vi.fn()}
        feature="fatigue_advisor"
      />
    );
    expect(screen.getByText('Unlock Body Fatigue Advisor')).toBeInTheDocument();
  });

  it('shows generic title when no feature', () => {
    render(
      <UpgradeModal open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument();
  });

  it('shows $14/month price', () => {
    render(
      <UpgradeModal open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('$14')).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
  });

  it('calls onUpgrade when clicking start trial', () => {
    const onUpgrade = vi.fn();
    render(
      <UpgradeModal open={true} onOpenChange={vi.fn()} onUpgrade={onUpgrade} />
    );
    fireEvent.click(screen.getByTestId('upgrade-confirm-button'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when clicking "Maybe later"', () => {
    const onOpenChange = vi.fn();
    render(
      <UpgradeModal open={true} onOpenChange={onOpenChange} />
    );
    fireEvent.click(screen.getByText('Maybe later'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows benefit list items', () => {
    render(
      <UpgradeModal open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('Unlimited AI coach conversations')).toBeInTheDocument();
    expect(screen.getByText('AI weekly planning and auto-sync')).toBeInTheDocument();
  });

  it('shows 7-day trial mention', () => {
    render(
      <UpgradeModal open={true} onOpenChange={vi.fn()} />
    );
    expect(screen.getByText('Start with a 7-day free trial')).toBeInTheDocument();
  });
});
