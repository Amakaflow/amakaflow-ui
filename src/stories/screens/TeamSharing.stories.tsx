import type { Meta, StoryObj } from '@storybook/react-vite';
import { TeamSharing } from '../../components/TeamSharing';
import type { WorkoutStructure } from '../../types/workout';

const mockUser = {
  name: 'Alex Rivera',
  email: 'alex@example.com',
  subscription: 'Pro',
};

const mockWorkout: WorkoutStructure = {
  title: 'Push Day',
  source: 'manual',
  blocks: [
    {
      id: 'block-1',
      label: 'Main Set',
      structure: 'sets',
      exercises: [
        { name: 'Bench Press', sets: 5, reps: 5 } as any,
        { name: 'Overhead Press', sets: 4, reps: 8 } as any,
      ],
    },
  ],
};

const meta: Meta<typeof TeamSharing> = {
  title: 'Screens/TeamSharing',
  component: TeamSharing,
  parameters: { layout: 'fullscreen' },
  args: {
    user: mockUser,
  },
};

export default meta;
type Story = StoryObj<typeof TeamSharing>;

export const Default: Story = {
  name: 'With workout loaded',
  args: {
    currentWorkout: mockWorkout,
  },
};

export const NoWorkout: Story = {
  name: 'No workout selected',
  args: {
    currentWorkout: null,
  },
};
