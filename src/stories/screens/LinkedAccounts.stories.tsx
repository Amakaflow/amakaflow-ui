import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { LinkedAccounts } from '../../components/LinkedAccounts';

// LinkedAccounts reads from Supabase (linked_accounts table) via linked-accounts lib.
// MSW intercepts the Supabase REST API calls.

// Mock Supabase REST response shape for linked accounts
const CONNECTED_ACCOUNTS_ROW = {
  id: 'la-1',
  user_id: 'user_storybook',
  provider: 'strava',
  connected: true,
  username: 'alex.runner',
  athlete_id: '12345678',
  connected_at: '2026-01-15T10:00:00Z',
  last_sync_at: '2026-02-25T08:00:00Z',
  expires_at: '2027-01-15T10:00:00Z',
  permissions: ['activity:read', 'profile:read_all'],
};

const meta: Meta<typeof LinkedAccounts> = {
  title: 'Screens/LinkedAccounts',
  component: LinkedAccounts,
  parameters: { layout: 'fullscreen' },
  args: {
    onAccountsChange: () => console.log('Accounts changed'),
  },
};

export default meta;
type Story = StoryObj<typeof LinkedAccounts>;

export const WithAccounts: Story = {
  name: 'Connected accounts',
  parameters: {
    msw: {
      handlers: [
        // Supabase REST API — linked_accounts table
        http.get(/supabase.*linked_accounts/, () =>
          HttpResponse.json([CONNECTED_ACCOUNTS_ROW])
        ),
        // Strava OAuth URL
        http.get('http://localhost:8006/strava/auth-url', () =>
          HttpResponse.json({ url: 'https://www.strava.com/oauth/authorize?client_id=demo' })
        ),
      ],
    },
  },
};

export const NoAccounts: Story = {
  name: 'No accounts linked',
  parameters: {
    msw: {
      handlers: [
        // Supabase REST API — empty result
        http.get(/supabase.*linked_accounts/, () =>
          HttpResponse.json([])
        ),
        http.get('http://localhost:8006/strava/auth-url', () =>
          HttpResponse.json({ url: 'https://www.strava.com/oauth/authorize?client_id=demo' })
        ),
      ],
    },
  },
};
