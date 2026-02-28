import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { ExerciseHistory } from '../../components/ExerciseHistory';

// ExerciseHistory uses useExercisesWithHistory hook which fetches from
// MAPPER API (http://localhost:8001/progression/exercises)

const MOCK_EXERCISES_WITH_HISTORY = {
  exercises: [
    {
      id: 'bench-press',
      name: 'Bench Press',
      sessionCount: 24,
      lastPerformed: '2026-02-24T09:00:00Z',
      bestEstimated1Rm: 95,
      maxWeightLifted: 82.5,
      totalSets: 120,
    },
    {
      id: 'squat',
      name: 'Squat',
      sessionCount: 20,
      lastPerformed: '2026-02-21T09:00:00Z',
      bestEstimated1Rm: 130,
      maxWeightLifted: 110,
      totalSets: 100,
    },
    {
      id: 'deadlift',
      name: 'Deadlift',
      sessionCount: 18,
      lastPerformed: '2026-02-19T09:00:00Z',
      bestEstimated1Rm: 155,
      maxWeightLifted: 140,
      totalSets: 72,
    },
    {
      id: 'overhead-press',
      name: 'Overhead Press',
      sessionCount: 16,
      lastPerformed: '2026-02-17T09:00:00Z',
      bestEstimated1Rm: 65,
      maxWeightLifted: 57.5,
      totalSets: 80,
    },
    {
      id: 'barbell-row',
      name: 'Barbell Row',
      sessionCount: 14,
      lastPerformed: '2026-02-19T09:00:00Z',
      bestEstimated1Rm: 85,
      maxWeightLifted: 75,
      totalSets: 70,
    },
  ],
  total: 5,
};

const MOCK_EXERCISE_DETAIL = {
  exerciseId: 'bench-press',
  exerciseName: 'Bench Press',
  sessions: [
    {
      id: 'session-1',
      date: '2026-02-24T09:00:00Z',
      sets: [
        { setNumber: 1, weight: 80, reps: 5, estimated1Rm: 90.7, sessionTotalVolume: null },
        { setNumber: 2, weight: 80, reps: 5, estimated1Rm: 90.7, sessionTotalVolume: null },
        { setNumber: 3, weight: 82.5, reps: 3, estimated1Rm: 88.5, sessionTotalVolume: null },
      ],
      totalVolume: 1192.5,
      maxWeight: 82.5,
      maxEstimated1Rm: 90.7,
    },
    {
      id: 'session-2',
      date: '2026-02-17T09:00:00Z',
      sets: [
        { setNumber: 1, weight: 77.5, reps: 5, estimated1Rm: 87.8, sessionTotalVolume: null },
        { setNumber: 2, weight: 77.5, reps: 5, estimated1Rm: 87.8, sessionTotalVolume: null },
        { setNumber: 3, weight: 77.5, reps: 5, estimated1Rm: 87.8, sessionTotalVolume: null },
      ],
      totalVolume: 1162.5,
      maxWeight: 77.5,
      maxEstimated1Rm: 87.8,
    },
    {
      id: 'session-3',
      date: '2026-02-10T09:00:00Z',
      sets: [
        { setNumber: 1, weight: 75, reps: 5, estimated1Rm: 85.0, sessionTotalVolume: null },
        { setNumber: 2, weight: 75, reps: 5, estimated1Rm: 85.0, sessionTotalVolume: null },
        { setNumber: 3, weight: 75, reps: 5, estimated1Rm: 85.0, sessionTotalVolume: null },
      ],
      totalVolume: 1125,
      maxWeight: 75,
      maxEstimated1Rm: 85.0,
    },
  ],
  total: 3,
  hasMore: false,
};

const meta: Meta<typeof ExerciseHistory> = {
  title: 'Screens/ExerciseHistory',
  component: ExerciseHistory,
  parameters: { layout: 'fullscreen' },
  args: {
    user: {
      id: 'user_storybook',
      name: 'David Andrews',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ExerciseHistory>;

export const Default: Story = {
  name: 'Exercise history & PRs',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8001/progression/exercises', () =>
          HttpResponse.json(MOCK_EXERCISES_WITH_HISTORY)
        ),
        http.get('http://localhost:8001/progression/exercises/:id/history', () =>
          HttpResponse.json(MOCK_EXERCISE_DETAIL)
        ),
        http.get('http://localhost:8001/progression/exercises/:id/last-weight', () =>
          HttpResponse.json({ weight: 80, unit: 'kg', date: '2026-02-24T09:00:00Z' })
        ),
      ],
    },
  },
};

export const NoHistory: Story = {
  name: 'No exercise data',
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:8001/progression/exercises', () =>
          HttpResponse.json({ exercises: [], total: 0 })
        ),
      ],
    },
  },
};
