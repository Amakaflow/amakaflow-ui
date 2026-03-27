import type { Meta, StoryObj } from '@storybook/react-vite';
import { WelcomeGuide } from '../../components/WelcomeGuide';

const meta: Meta<typeof WelcomeGuide> = {
  title: 'Screens/WelcomeGuide',
  component: WelcomeGuide,
  parameters: { layout: 'fullscreen' },
  args: {
    onGetStarted: () => console.log('Get started'),
  },
};

export default meta;
type Story = StoryObj<typeof WelcomeGuide>;

export const Default: Story = {
  name: 'Onboarding welcome',
};
