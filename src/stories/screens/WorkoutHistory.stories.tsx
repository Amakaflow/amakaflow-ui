import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkoutHistory } from '../../components/WorkoutHistory';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

const makeItem = (
  id: string,
  title: string,
  device: WorkoutHistoryItem['device'],
  createdAt: string,
): WorkoutHistoryItem => ({
  id,
  workout: {
    title,
    source: 'manual',
    blocks: [
      {
        id: 'b1',
        label: 'Main Set',
        structure: 'sets',
        exercises: [
          { name: 'Squat', sets: 4, reps: 8 } as any,
          { name: 'Deadlift', sets: 3, reps: 5 } as any,
        ],
      },
    ],
  },
  sources: ['manual'],
  device,
  createdAt,
  updatedAt: createdAt,
});

const mockHistory: WorkoutHistoryItem[] = [
  makeItem('hist-1', 'Push Day', 'garmin', '2026-02-25T08:00:00Z'),
  makeItem('hist-2', 'Pull Day', 'apple', '2026-02-23T09:30:00Z'),
  makeItem('hist-3', 'Leg Day', 'garmin', '2026-02-21T07:00:00Z'),
];

const meta: Meta<typeof WorkoutHistory> = {
  title: 'Screens/WorkoutHistory',
  component: WorkoutHistory,
  parameters: { layout: 'fullscreen' },
  args: {
    onLoadWorkout: (item) => console.log('Load workout', item.id),
    onEditWorkout: (item) => console.log('Edit workout', item.id),
    onUpdateWorkout: async (item) => console.log('Update workout', item.id),
    onDeleteWorkout: (id) => console.log('Delete workout', id),
    onBulkDeleteWorkouts: async (ids) => console.log('Bulk delete', ids),
    onEnhanceStrava: (item) => console.log('Enhance strava', item.id),
  },
};

export default meta;
type Story = StoryObj<typeof WorkoutHistory>;

export const WithHistory: Story = {
  name: 'History with workouts',
  args: {
    history: mockHistory,
  },
};

export const EmptyState: Story = {
  name: 'Empty history',
  args: {
    history: [],
  },
};
