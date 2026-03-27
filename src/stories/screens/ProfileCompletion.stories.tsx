import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProfileCompletion } from '../../components/ProfileCompletion';

// ProfileCompletion uses the User type from types/auth and Clerk for user data.
// In Storybook, Clerk is mocked, so this renders as a static visual.

const mockUser = {
  id: 'user_storybook',
  email: 'david@amakaflow.com',
  name: 'David Andrews',
  subscription: 'pro' as const,
  workoutsThisWeek: 2,
  selectedDevices: [] as any[],
  billingDate: new Date('2026-03-15'),
};

const meta: Meta<typeof ProfileCompletion> = {
  title: 'Screens/ProfileCompletion',
  component: ProfileCompletion,
  parameters: { layout: 'fullscreen' },
  args: {
    user: mockUser,
    onComplete: (updatedUser) => console.log('Profile complete', updatedUser),
  },
};

export default meta;
type Story = StoryObj<typeof ProfileCompletion>;

export const Default: Story = {
  name: 'Profile completion',
};
