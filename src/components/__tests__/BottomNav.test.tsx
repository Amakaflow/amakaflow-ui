import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomNav } from '../BottomNav';
import type { View } from '../../app/router';

describe('BottomNav', () => {
  const onNavigate = vi.fn();

  beforeEach(() => {
    onNavigate.mockClear();
  });

  it('renders all 5 tab buttons', () => {
    render(<BottomNav currentView="home" onNavigate={onNavigate} />);

    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Workouts')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar')).toBeInTheDocument();
    expect(screen.getByLabelText('Analytics')).toBeInTheDocument();
    expect(screen.getByLabelText('More')).toBeInTheDocument();
  });

  it('highlights the active tab with aria-current="page"', () => {
    render(<BottomNav currentView="workouts" onNavigate={onNavigate} />);

    expect(screen.getByLabelText('Workouts')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Home')).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate with the correct view when a tab is clicked', () => {
    render(<BottomNav currentView="home" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Calendar'));
    expect(onNavigate).toHaveBeenCalledWith('calendar');

    fireEvent.click(screen.getByLabelText('Analytics'));
    expect(onNavigate).toHaveBeenCalledWith('analytics');
  });

  it('highlights Home tab for related views (import, workflow, create-ai)', () => {
    const { rerender } = render(<BottomNav currentView="import" onNavigate={onNavigate} />);
    expect(screen.getByLabelText('Home')).toHaveAttribute('aria-current', 'page');

    rerender(<BottomNav currentView="workflow" onNavigate={onNavigate} />);
    expect(screen.getByLabelText('Home')).toHaveAttribute('aria-current', 'page');

    rerender(<BottomNav currentView="create-ai" onNavigate={onNavigate} />);
    expect(screen.getByLabelText('Home')).toHaveAttribute('aria-current', 'page');
  });

  it('highlights More tab for settings, help, programs, and other secondary views', () => {
    const secondaryViews: View[] = ['settings', 'help', 'programs'];
    for (const view of secondaryViews) {
      const { unmount } = render(<BottomNav currentView={view} onNavigate={onNavigate} />);
      expect(screen.getByLabelText('More')).toHaveAttribute('aria-current', 'page');
      unmount();
    }
  });

  it('uses z-[45] to sit between z-40 and z-50 layers', () => {
    render(<BottomNav currentView="home" onNavigate={onNavigate} />);
    const nav = screen.getByTestId('bottom-nav');
    expect(nav.className).toContain('z-[45]');
  });

  it('has md:hidden class to hide on desktop viewports', () => {
    render(<BottomNav currentView="home" onNavigate={onNavigate} />);
    const nav = screen.getByTestId('bottom-nav');
    expect(nav.className).toContain('md:hidden');
  });

  it('is fixed to the bottom of the viewport', () => {
    render(<BottomNav currentView="home" onNavigate={onNavigate} />);
    const nav = screen.getByTestId('bottom-nav');
    expect(nav.className).toContain('fixed');
    expect(nav.className).toContain('bottom-0');
  });
});
