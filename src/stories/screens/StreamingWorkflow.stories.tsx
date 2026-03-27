import type { Meta, StoryObj } from '@storybook/react-vite';
import { StreamingWorkflow, SAVE_STAGE_CONFIG, SAVE_STAGES } from '../../components/StreamingWorkflow';
import type { PipelinePreview } from '../../types/pipeline';

const mockPreview: PipelinePreview = {
  preview_id: 'preview-001',
  workout: {
    name: 'Push Day',
    exercises: [
      { name: 'Bench Press', sets: 5, reps: 5 },
      { name: 'Overhead Press', sets: 4, reps: 8 },
      { name: 'Tricep Pushdown', sets: 3, reps: 12 },
    ],
    exercise_count: 3,
    block_count: 1,
  },
};

const meta: Meta<typeof StreamingWorkflow> = {
  title: 'Screens/StreamingWorkflow',
  component: StreamingWorkflow,
  parameters: { layout: 'fullscreen' },
  args: {
    onSave: () => console.log('Save'),
    onRetry: () => console.log('Retry'),
  },
};

export default meta;
type Story = StoryObj<typeof StreamingWorkflow>;

export const Streaming: Story = {
  name: 'Processing in progress',
  args: {
    isStreaming: true,
    currentStage: { stage: 'analyzing', message: 'Analyzing your request...' },
    completedStages: [],
    preview: null,
    error: null,
  },
};

export const Done: Story = {
  name: 'Complete — save ready',
  args: {
    isStreaming: false,
    currentStage: { stage: 'complete', message: 'Done!' },
    completedStages: ['analyzing', 'creating'],
    preview: mockPreview,
    error: null,
  },
};

export const WithError: Story = {
  name: 'Error state',
  args: {
    isStreaming: false,
    currentStage: null,
    completedStages: [],
    preview: null,
    error: 'Could not process video. Please try again.',
  },
};
