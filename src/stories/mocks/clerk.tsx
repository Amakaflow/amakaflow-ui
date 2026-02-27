/**
 * Mock for @clerk/clerk-react used in Storybook.
 * Replaces the real Clerk module via Vite alias so all screens
 * render as if a real user is signed in — no ClerkProvider needed.
 */
import React from 'react';

const MOCK_USER = {
  id: 'user_storybook',
  firstName: 'David',
  lastName: 'Andrews',
  fullName: 'David Andrews',
  username: 'davidandrews',
  primaryEmailAddress: {
    emailAddress: 'david@amakaflow.com',
    id: 'email_storybook',
  },
  emailAddresses: [{ emailAddress: 'david@amakaflow.com', id: 'email_storybook' }],
  imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david',
  publicMetadata: {},
  unsafeMetadata: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
};

export const useUser = () => ({
  isLoaded: true,
  isSignedIn: true,
  user: MOCK_USER as any,
});

export const useAuth = () => ({
  isLoaded: true,
  isSignedIn: true,
  userId: MOCK_USER.id,
  sessionId: 'sess_storybook',
  getToken: async () => 'mock-jwt-token-storybook',
  signOut: async () => {},
});

export const useClerk = () => ({
  signOut: async () => {},
  openSignIn: () => {},
  openSignUp: () => {},
  user: MOCK_USER as any,
});

export const useOrganization = () => ({
  isLoaded: true,
  organization: null,
});

export const useSession = () => ({
  isLoaded: true,
  isSignedIn: true,
  session: { id: 'sess_storybook', user: MOCK_USER },
});

// Components
export const SignedIn = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SignedOut = (_: { children: React.ReactNode }) => null;
export const SignInButton = ({ children }: { children?: React.ReactNode }) =>
  children ? <>{children}</> : <button>Sign in</button>;
export const SignUpButton = ({ children }: { children?: React.ReactNode }) =>
  children ? <>{children}</> : <button>Sign up</button>;
export const UserButton = () => (
  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium">
    DA
  </div>
);
export const ClerkProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
