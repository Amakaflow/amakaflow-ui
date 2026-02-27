import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddSources } from '../../components/AddSources';

const meta: Meta<typeof AddSources> = {
  title: 'Screens/AddSources',
  component: AddSources,
  parameters: { layout: 'fullscreen' },
  args: {
    onGenerate: (sources) => console.log('Generate from sources', sources),
    onLoadTemplate: () => console.log('Load template'),
    onCreateNew: () => console.log('Create new'),
    loading: false,
    progress: null as string | null,
    onCancel: () => console.log('Cancel'),
  },
};

export default meta;
type Story = StoryObj<typeof AddSources>;

export const Default: Story = {
  name: 'Default',
};

export const LoadingState: Story = {
  name: 'Processing / Loading',
  args: {
    loading: true,
    progress: 'Analyzing workout content...',
  },
};
