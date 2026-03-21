import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { StructureWorkout } from '../../components/StructureWorkout';

const MOCK_WORKOUT = {
  title: 'Upper Body Strength',
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
        { name: 'Arm Circles', sets: 2, reps: 10, type: 'Strength', rest_sec: 30 },
        { name: 'Band Pull-Apart', sets: 2, reps: 15, type: 'Strength', rest_sec: 30 },
      ],
      supersets: [],
    },
    {
      label: 'Push',
      structure: '5x5' as const,
      time_work_sec: null,
      rest_between_sec: 90,
      default_reps_range: null,
      default_sets: null,
      exercises: [
        { name: 'Bench Press', sets: 5, reps: 5, load: '80kg', type: 'Strength', rest_sec: 90 },
        { name: 'Overhead Press', sets: 4, reps: 8, load: '50kg', type: 'Strength', rest_sec: 90 },
        { name: 'Dips', sets: 3, reps: 12, type: 'Strength', rest_sec: 60 },
      ],
      supersets: [],
    },
    {
      label: 'Pull',
      structure: '4x8' as const,
      time_work_sec: null,
      rest_between_sec: 90,
      default_reps_range: null,
      default_sets: null,
      exercises: [
        { name: 'Pull-Ups', sets: 4, reps: 8, type: 'Strength', rest_sec: 90 },
        { name: 'Barbell Row', sets: 4, reps: 8, load: '70kg', type: 'Strength', rest_sec: 90 },
      ],
      supersets: [],
    },
  ],
};

const MSW_MAP_HANDLER = http.post('http://localhost:8001/map', () =>
  HttpResponse.json({
    mappings: [
      { source_name: 'Bench Press', device_name: 'Bench Press', confidence: 0.99 },
      { source_name: 'Overhead Press', device_name: 'Overhead Press', confidence: 0.97 },
      { source_name: 'Dips', device_name: 'Dips', confidence: 0.95 },
      { source_name: 'Pull-Ups', device_name: 'Pull Ups', confidence: 0.98 },
      { source_name: 'Barbell Row', device_name: 'Barbell Row', confidence: 0.96 },
    ],
  })
);

const meta: Meta<typeof StructureWorkout> = {
  title: 'Screens/StructureWorkout',
  component: StructureWorkout,
  parameters: { layout: 'fullscreen' },
  args: {
    workout: MOCK_WORKOUT as any,
    onWorkoutChange: (w) => console.log('Workout changed', w),
    onAutoMap: () => console.log('Auto map'),
    onValidate: () => console.log('Validate'),
    onSave: () => console.log('Save'),
    isEditingFromHistory: false,
    isCreatingFromScratch: false,
    loading: false,
    selectedDevice: 'garmin' as any,
    onDeviceChange: (d) => console.log('Device changed', d),
    userSelectedDevices: ['garmin'] as any[],
    onNavigateToSettings: () => console.log('Navigate to settings'),
  },
};

export default meta;
type Story = StoryObj<typeof StructureWorkout>;

export const Default: Story = {
  name: 'Structure editor',
  parameters: {
    msw: {
      handlers: [MSW_MAP_HANDLER],
    },
  },
};

export const FromScratch: Story = {
  name: 'New from scratch',
  args: {
    workout: {
      title: 'New Workout',
      source: 'manual',
      blocks: [],
    } as any,
    isCreatingFromScratch: true,
    loading: false,
  },
  parameters: {
    msw: {
      handlers: [MSW_MAP_HANDLER],
    },
  },
};

export const Loading: Story = {
  name: 'Auto-mapping in progress',
  args: {
    loading: true,
  },
  parameters: {
    test: { skip: true },
    msw: {
      handlers: [
        http.post('http://localhost:8001/map', async () => {
          await new Promise((r) => setTimeout(r, 60000));
          return HttpResponse.json({ mappings: [] });
        }),
      ],
    },
  },
};
