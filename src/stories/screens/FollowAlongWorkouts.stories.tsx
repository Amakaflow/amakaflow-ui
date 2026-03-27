import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { FollowAlongWorkouts } from '../../components/FollowAlongWorkouts';

// FollowAlongWorkouts fetches from MAPPER API (http://localhost:8001/follow-along)
const SAMPLE_FOLLOW_ALONG = [
  {
    id: 'fa-1',
    title: 'Hyrox Full Session',
    sport: 'HYROX',
    source_url: 'https://www.instagram.com/p/example1/',
    thumbnail_url: null,
    created_at: '2026-02-20T08:00:00Z',
    workout: {
      title: 'Hyrox Full Session',
      source: 'instagram',
      blocks: [
        {
          label: 'Main Set',
          structure: 'for time (cap: 35 min)',
          exercises: [
            { name: '1000m SkiErg', sets: 1, reps: null, distance_m: 1000, type: 'HIIT' },
            { name: '50m Sled Push', sets: 1, reps: null, distance_m: 50, type: 'Strength' },
          ],
          supersets: [],
        },
      ],
    },
  },
  {
    id: 'fa-2',
    title: 'Upper Body Circuit',
    sport: 'STRENGTH',
    source_url: 'https://www.instagram.com/p/example2/',
    thumbnail_url: null,
    created_at: '2026-02-18T09:00:00Z',
    workout: {
      title: 'Upper Body Circuit',
      source: 'instagram',
      blocks: [
        {
          label: 'Circuit',
          structure: '3 rounds',
          exercises: [
            { name: 'Push-Ups', sets: 3, reps: 20, type: 'Strength' },
            { name: 'Dumbbell Row', sets: 3, reps: 12, load: '20kg', type: 'Strength' },
          ],
          supersets: [],
        },
      ],
    },
  },
  {
    id: 'fa-3',
    title: '5K Interval Run',
    sport: 'RUNNING',
    source_url: null,
    thumbnail_url: null,
    created_at: '2026-02-15T07:00:00Z',
    workout: {
      title: '5K Interval Run',
      source: 'manual',
      blocks: [
        {
          label: 'Intervals',
          structure: '5x1km',
          exercises: [
            { name: '1km Run', sets: 5, reps: null, distance_m: 1000, type: 'HIIT' },
          ],
          supersets: [],
        },
      ],
    },
  },
];

const meta: Meta<typeof FollowAlongWorkouts> = {
  title: 'Screens/FollowAlongWorkouts',
  component: FollowAlongWorkouts,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof FollowAlongWorkouts>;

export const Default: Story = {
  name: 'Follow-along workouts list',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8001/follow-along', () =>
          HttpResponse.json({ workouts: SAMPLE_FOLLOW_ALONG, total: SAMPLE_FOLLOW_ALONG.length })
        ),
        http.delete('http://localhost:8001/follow-along/:id', () =>
          HttpResponse.json({ success: true })
        ),
      ],
    },
  },
};

export const Empty: Story = {
  name: 'No follow-along workouts',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8001/follow-along', () =>
          HttpResponse.json({ workouts: [], total: 0 })
        ),
      ],
    },
  },
};
