import type { Meta, StoryObj } from '@storybook/react-vite';
import { CoachChat } from '../../components/CoachChat/CoachChat';

const meta: Meta<typeof CoachChat> = {
  title: 'Screens/CoachChat',
  component: CoachChat,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', background: 'hsl(224 71% 4%)' }} className="dark">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CoachChat>;

export const Default: Story = {
  name: 'Coach Chat (Demo Conversation)',
};
