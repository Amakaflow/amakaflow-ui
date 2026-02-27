import type { Meta, StoryObj } from '@storybook/react-vite';
import { UserSettings } from '../../components/UserSettings';

const mockUser = {
  id: 'user_storybook',
  name: 'David Andrews',
  email: 'david@amakaflow.com',
  subscription: 'Pro',
  selectedDevices: ['apple_watch'] as any[],
  billingDate: new Date('2026-03-15'),
};

const meta: Meta<typeof UserSettings> = {
  title: 'Screens/UserSettings',
  component: UserSettings,
  parameters: { layout: 'fullscreen' },
  args: {
    user: mockUser,
    onBack: () => console.log('Back'),
    onAccountsChange: () => console.log('Accounts changed'),
    onAccountDeleted: () => console.log('Account deleted'),
    onUserUpdate: (updates) => console.log('User update', updates),
    onNavigateToMobileCompanion: () => console.log('Navigate to mobile companion'),
  },
};

export default meta;
type Story = StoryObj<typeof UserSettings>;

export const Default: Story = {
  name: 'General tab',
};

export const FreeUser: Story = {
  name: 'Free plan user',
  args: {
    user: { ...mockUser, subscription: 'Free', selectedDevices: [] },
  },
};
