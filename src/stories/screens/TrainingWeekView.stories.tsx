import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrainingWeekView } from '../../components/Calendar/TrainingWeekView';

const meta: Meta<typeof TrainingWeekView> = {
  title: 'Screens/TrainingWeekView',
  component: TrainingWeekView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="dark bg-background text-foreground min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TrainingWeekView>;

export const Default: Story = {
  name: 'Plan view (default)',
};

export const DarkMode: Story = {
  name: 'Dark mode week view',
  decorators: [
    (Story) => (
      <div className="dark bg-background text-foreground min-h-screen">
        <Story />
      </div>
    ),
  ],
};
