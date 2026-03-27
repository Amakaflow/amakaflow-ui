import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkoutTemplates } from '../../components/WorkoutTemplates';
import type { WorkoutStructure } from '../../types/workout';

const meta: Meta<typeof WorkoutTemplates> = {
  title: 'Screens/WorkoutTemplates',
  component: WorkoutTemplates,
  parameters: { layout: 'fullscreen' },
  args: {
    onSelectTemplate: (workout: WorkoutStructure) => console.log('Select template', workout.title),
    onSelectHistory: (workout: WorkoutStructure) => console.log('Select history', workout.title),
  },
};

export default meta;
type Story = StoryObj<typeof WorkoutTemplates>;

export const Default: Story = {
  name: 'Template picker',
};
