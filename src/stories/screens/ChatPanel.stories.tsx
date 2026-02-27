import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { ChatPanel } from '../../components/ChatPanel/ChatPanel';
import { ChatProvider } from '../../context/ChatContext';

const meta: Meta<typeof ChatPanel> = {
  title: 'Screens/ChatPanel',
  component: ChatPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ChatProvider>
        <Story />
      </ChatProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ChatPanel>;

export const Default: Story = {
  name: 'Chat FAB',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8005/feature-flags', () =>
          HttpResponse.json({
            chat_enabled: true,
            chat_beta_period: false,
            chat_beta_access: true,
            chat_voice_enabled: true,
            chat_rate_limit_tier: 'pro',
            chat_functions_enabled: ['get_user_profile', 'search_workouts'],
          })
        ),
        http.get('http://localhost:8005/health', () =>
          HttpResponse.json({ status: 'healthy' })
        ),
      ],
    },
  },
};
