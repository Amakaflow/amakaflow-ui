import { render, screen } from '@testing-library/react';
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
  return render(<NavBar {...props} />);
};

describe('NavBar', () => {
  it('renders the 7 primary nav items', () => {
    renderNavBar();

    // The primary nav items: Import, Create with AI, Calendar, My Workouts, Programs, Analytics, Settings
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Create with AI')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('My Workouts')).toBeInTheDocument();
    expect(screen.getByText('Programs')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does NOT render History, Volume, or Team as top-level nav items', () => {
    renderNavBar();

    // These should NOT be present in the nav
    expect(screen.queryByText('History')).not.toBeInTheDocument();
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });
});
