import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { FollowAlongSetup } from '../../components/FollowAlongSetup';

const MOCK_WORKOUT = {
  title: 'Hyrox Follow-Along Session',
  source: 'manual',
  blocks: [
    {
      label: 'Warm Up',
      structure: 'circuit' as const,
      time_work_sec: null,
      rest_between_sec: 30,
      default_reps_range: null,
      default_sets: null,
      exercises: [
        { name: '400m Run', sets: 1, reps: null, duration_sec: 120, type: 'HIIT', rest_sec: 30 },
        { name: 'Hip Circles', sets: 2, reps: 10, type: 'Strength', rest_sec: 30 },
      ],
      supersets: [],
    },
    {
      label: 'Main Set',
      structure: 'for time (cap: 35 min)' as const,
      time_work_sec: 2100,
      rest_between_sec: null,
      default_reps_range: null,
      default_sets: null,
      exercises: [
        { name: '1000m SkiErg', sets: 1, reps: null, distance_m: 1000, type: 'HIIT', rest_sec: null },
        { name: '50m Sled Push', sets: 1, reps: null, distance_m: 50, type: 'Strength', rest_sec: null },
        { name: '50m Sled Pull', sets: 1, reps: null, distance_m: 50, type: 'Strength', rest_sec: null },
        { name: '80m Burpee Broad Jump', sets: 1, reps: null, distance_m: 80, type: 'HIIT', rest_sec: null },
        { name: '1000m Rowing', sets: 1, reps: null, distance_m: 1000, type: 'HIIT', rest_sec: null },
        { name: '200m Farmers Carry', sets: 1, reps: null, distance_m: 200, type: 'Strength', rest_sec: null },
        { name: '100m Sandbag Lunges', sets: 1, reps: null, distance_m: 100, type: 'Strength', rest_sec: null },
        { name: '100 Wall Balls', sets: 1, reps: 100, type: 'HIIT', rest_sec: null },
      ],
      supersets: [],
    },
  ],
};

const meta: Meta<typeof FollowAlongSetup> = {
  title: 'Screens/FollowAlongSetup',
  component: FollowAlongSetup,
  parameters: { layout: 'fullscreen' },
  args: {
    workout: MOCK_WORKOUT as any,
    userId: 'user_storybook',
    sourceUrl: 'https://www.instagram.com/p/example123/',
  },
};

export default meta;
type Story = StoryObj<typeof FollowAlongSetup>;

export const Default: Story = {
  name: 'Follow-along setup',
  parameters: {
    msw: {
      handlers: [
        http.post('http://localhost:8004/follow-along/setup', () =>
          HttpResponse.json({ success: true })
        ),
        http.post('http://localhost:8001/follow-along/create', () =>
          HttpResponse.json({ success: true, id: 'fa-new-1' })
        ),
      ],
    },
  },
};
