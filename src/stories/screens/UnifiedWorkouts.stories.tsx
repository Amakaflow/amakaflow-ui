import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { UnifiedWorkouts } from '../../components/UnifiedWorkouts';

const SAMPLE_WORKOUTS = [
  {
    id: 'workout-1',
    userId: 'user_storybook',
    title: 'Hyrox Session',
    sport: 'HYROX',
    sourceType: 'manual' as const,
    devicePlatform: undefined,
    createdAt: '2026-02-20T08:00:00Z',
    updatedAt: '2026-02-20T08:00:00Z',
    structure: {
      title: 'Hyrox Session',
      blocks: [
        {
          label: 'Main Set',
          structure: 'for time (cap: 35 min)',
          time_work_sec: 2100,
          rest_between_sec: null,
          default_reps_range: null,
          default_sets: null,
          exercises: [
            { name: '1000m SkiErg', sets: 1, reps: null, distance_m: 1000, type: 'HIIT', rest_sec: null },
            { name: '50m Sled Push', sets: 1, reps: null, distance_m: 50, type: 'Strength', rest_sec: null },
          ],
          supersets: [],
        },
      ],
    },
    tags: ['hyrox', 'competition'],
  },
  {
    id: 'workout-2',
    userId: 'user_storybook',
    title: 'Upper Body Strength',
    sport: 'STRENGTH',
    sourceType: 'manual' as const,
    devicePlatform: 'apple',
    createdAt: '2026-02-18T09:30:00Z',
    updatedAt: '2026-02-18T09:30:00Z',
    structure: {
      title: 'Upper Body Strength',
      blocks: [
        {
          label: 'Push',
          structure: '5x5',
          rest_between_sec: 90,
          default_reps_range: null,
          default_sets: null,
          time_work_sec: null,
          exercises: [
            { name: 'Bench Press', sets: 5, reps: 5, load: '80kg', type: 'Strength', rest_sec: 90 },
            { name: 'Overhead Press', sets: 4, reps: 8, load: '50kg', type: 'Strength', rest_sec: 90 },
          ],
          supersets: [],
        },
      ],
    },
    tags: ['strength'],
  },
  {
    id: 'workout-3',
    userId: 'user_storybook',
    title: '5K Easy Run',
    sport: 'RUNNING',
    sourceType: 'manual' as const,
    devicePlatform: 'garmin',
    createdAt: '2026-02-15T07:00:00Z',
    updatedAt: '2026-02-15T07:00:00Z',
    structure: {
      title: '5K Easy Run',
      blocks: [],
    },
    tags: ['running', 'easy'],
  },
];

const meta: Meta<typeof UnifiedWorkouts> = {
  title: 'Screens/UnifiedWorkouts',
  component: UnifiedWorkouts,
  parameters: { layout: 'fullscreen' },
  args: {
    profileId: 'user_storybook',
    onEditWorkout: (item) => console.log('Edit workout', item),
    onLoadWorkout: (item) => console.log('Load workout', item),
    onDeleteWorkout: (id) => console.log('Delete workout', id),
    onBulkDeleteWorkouts: async (ids) => console.log('Bulk delete', ids),
  },
};

export default meta;
type Story = StoryObj<typeof UnifiedWorkouts>;

export const Default: Story = {
  name: 'With workouts',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8004/workouts', () =>
          HttpResponse.json({ workouts: SAMPLE_WORKOUTS, total: SAMPLE_WORKOUTS.length })
        ),
      ],
    },
  },
};

export const Empty: Story = {
  name: 'Empty state',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8004/workouts', () =>
          HttpResponse.json({ workouts: [], total: 0 })
        ),
      ],
    },
  },
};

export const Loading: Story = {
  name: 'Loading state',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8004/workouts', async () => {
          await new Promise((r) => setTimeout(r, 60000)); // never resolves during story
          return HttpResponse.json({ workouts: [], total: 0 });
        }),
      ],
    },
  },
};
