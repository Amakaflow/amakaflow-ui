import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { MobileChatDrawer } from '../../components/ChatPanel/MobileChatDrawer';
import { ChatProvider } from '../../context/ChatContext';

// MobileChatDrawer has no props — it reads state from ChatContext

const meta: Meta<typeof MobileChatDrawer> = {
  title: 'Screens/MobileChatDrawer',
  component: MobileChatDrawer,
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
type Story = StoryObj<typeof MobileChatDrawer>;

export const Default: Story = {
  name: 'Mobile chat drawer',
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
