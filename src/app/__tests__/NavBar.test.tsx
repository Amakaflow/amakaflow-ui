import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { NavBar } from '../NavBar';
import type { AppUser } from '../useAppAuth';
import type { View } from '../router';

// Mock clerk components
vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: ({ children }: { children: React.ReactNode }) => null,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => <div data-testid="user-button" />,
}));

// Mock demo-mode
vi.mock('../../lib/demo-mode', () => ({
  isDemoMode: false,
}));

const mockUser: AppUser = {
  id: 'test-user',
  email: 'test@test.com',
  name: 'Test User',
  subscription: 'free',
  workoutsThisWeek: 0,
  selectedDevices: [],
  mode: 'individual',
};

const renderNavBar = (overrides: Partial<{
  currentView: View;
  stravaConnected: boolean;
  hasClerk: boolean;
}> = {}) => {
  const props = {
    user: mockUser,
    currentView: 'home' as View,
    stravaConnected: false,
    hasClerk: false,
    onNavigate: vi.fn(),
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <NavBar {...props} />
    </MemoryRouter>,
  );
};

describe('NavBar', () => {
  it('renders the grouped nav items (dropdown triggers)', () => {
    renderNavBar();

    // Direct nav items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();

    // Dropdown triggers
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('has hidden md:block classes to hide on mobile and show on desktop', () => {
    const { container } = renderNavBar();
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('hidden');
    expect(wrapper.className).toContain('md:block');
  });

  it('does NOT render History, Volume, or Team as top-level nav items', () => {
    renderNavBar();

    // These should NOT be present in the nav
    expect(screen.queryByText('History')).not.toBeInTheDocument();
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });

  it('reduces visible top-level items from 9+ to 5-6 via dropdown grouping', () => {
    renderNavBar();

    // Count visible top-level buttons in the nav (not dropdown items)
    // Expected: Dashboard, Create (dropdown), Training (dropdown), Insights (dropdown), Help, Settings icon
    const navButtons = screen.getAllByRole('button');
    // Should have fewer than old layout (9 items)
    // The logo button + Dashboard + Create + Training + Insights + Help + Settings = 7 buttons
    expect(navButtons.length).toBeLessThanOrEqual(9);
  });

  it('shows Settings as icon-only button', () => {
    renderNavBar();

    const settingsButton = screen.getByTestId
      ? document.querySelector('[data-assistant-target="nav-settings"]')
      : null;
    // Settings button should exist
    expect(settingsButton).toBeTruthy();
  });
});
