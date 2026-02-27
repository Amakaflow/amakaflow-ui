import type { Meta, StoryObj } from '@storybook/react-vite';
import { ViewWorkout } from '../../components/ViewWorkout';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

const mockHistoryItem: WorkoutHistoryItem = {
  id: 'hist-001',
  workout: {
    title: 'Push Day',
    source: 'manual',
    blocks: [
      {
        id: 'block-1',
        label: 'Warm Up',
        structure: 'circuit',
        exercises: [
          { name: 'Jumping Jacks', sets: 2, reps: 20 } as any,
        ],
      },
      {
        id: 'block-2',
        label: 'Main Set',
        structure: 'sets',
        exercises: [
          { name: 'Bench Press', sets: 5, reps: 5 } as any,
          { name: 'Overhead Press', sets: 4, reps: 8 } as any,
        ],
      },
    ],
  },
  sources: ['manual'],
  device: 'garmin',
  createdAt: '2026-02-20T10:00:00Z',
  updatedAt: '2026-02-20T10:00:00Z',
};

const emptyHistoryItem: WorkoutHistoryItem = {
  id: 'hist-002',
  workout: {
    title: 'Empty Workout',
    source: 'manual',
    blocks: [],
  },
  sources: ['manual'],
  device: 'apple',
  createdAt: '2026-02-21T10:00:00Z',
  updatedAt: '2026-02-21T10:00:00Z',
};

const meta: Meta<typeof ViewWorkout> = {
  title: 'Screens/ViewWorkout',
  component: ViewWorkout,
  parameters: { layout: 'fullscreen' },
  args: {
    onClose: () => console.log('Close'),
    onEdit: () => console.log('Edit'),
  },
};

export default meta;
type Story = StoryObj<typeof ViewWorkout>;

export const WithBlocks: Story = {
  name: 'Saved workout view',
  args: {
    workout: mockHistoryItem,
  },
};

export const NoBlocks: Story = {
  name: 'No blocks',
  args: {
    workout: emptyHistoryItem,
  },
};
