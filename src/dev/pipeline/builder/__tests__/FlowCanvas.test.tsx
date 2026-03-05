import { render, screen, fireEvent } from '@testing-library/react';
import { FlowCanvas } from '../FlowCanvas';
import type { FlowStep } from '../../store/runTypes';

const steps: FlowStep[] = ['ingest-youtube', 'map-exercises', 'export-garmin'];

test('renders step labels from registry', () => {
  render(<FlowCanvas steps={steps} activeStepId={null} onRemoveStep={() => {}} onAddParallelGroup={() => {}} />);
  expect(screen.getByText('YouTube')).toBeInTheDocument();
  expect(screen.getByText('Map Exercises')).toBeInTheDocument();
  expect(screen.getByText('Export → Garmin')).toBeInTheDocument();
});

test('remove button calls onRemoveStep with index', () => {
  const onRemove = vi.fn();
  render(<FlowCanvas steps={steps} activeStepId={null} onRemoveStep={onRemove} onAddParallelGroup={() => {}} />);
  const removeButtons = screen.getAllByRole('button', { name: /remove/i });
  fireEvent.click(removeButtons[0]);
  expect(onRemove).toHaveBeenCalledWith(0);
});

test('parallel group renders each branch', () => {
  const stepsWithParallel: FlowStep[] = [
    'ingest-youtube',
    { type: 'parallel', steps: ['export-garmin', 'export-apple'] },
  ];
  render(<FlowCanvas steps={stepsWithParallel} activeStepId={null} onRemoveStep={() => {}} onAddParallelGroup={() => {}} />);
  expect(screen.getByText('Parallel export')).toBeInTheDocument();
  expect(screen.getByText('Export → Garmin')).toBeInTheDocument();
  expect(screen.getByText('Export → Apple Health')).toBeInTheDocument();
});

test('active step id applies highlight class', () => {
  render(<FlowCanvas steps={steps} activeStepId="ingest-youtube" onRemoveStep={() => {}} onAddParallelGroup={() => {}} />);
  const card = screen.getByTestId('flow-step-ingest-youtube');
  expect(card.className).toMatch(/ring-2|border-blue/);
});

test('add parallel group button calls onAddParallelGroup', () => {
  const onAdd = vi.fn();
  render(<FlowCanvas steps={steps} activeStepId={null} onRemoveStep={() => {}} onAddParallelGroup={onAdd} />);
  fireEvent.click(screen.getByText('+ Add parallel group'));
  expect(onAdd).toHaveBeenCalled();
});
