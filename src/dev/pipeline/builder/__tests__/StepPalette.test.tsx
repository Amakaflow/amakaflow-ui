import { render, screen, fireEvent } from '@testing-library/react';
import { StepPalette } from '../StepPalette';

test('renders all step groups', () => {
  render(<StepPalette collapsed={false} onToggleCollapse={() => {}} onAddStep={() => {}} />);
  expect(screen.getByText('Ingestion')).toBeInTheDocument();
  expect(screen.getByText('Mapping')).toBeInTheDocument();
  expect(screen.getByText('Export')).toBeInTheDocument();
  expect(screen.getByText('Utilities')).toBeInTheDocument();
});

test('clicking a step calls onAddStep with step id', () => {
  const onAddStep = vi.fn();
  render(<StepPalette collapsed={false} onToggleCollapse={() => {}} onAddStep={onAddStep} />);
  fireEvent.click(screen.getByText('YouTube'));
  expect(onAddStep).toHaveBeenCalledWith('ingest-youtube');
});

test('collapsed mode hides step labels', () => {
  render(<StepPalette collapsed={true} onToggleCollapse={() => {}} onAddStep={() => {}} />);
  expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
});

test('toggle button calls onToggleCollapse', () => {
  const onToggle = vi.fn();
  render(<StepPalette collapsed={false} onToggleCollapse={onToggle} onAddStep={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /collapse/i }));
  expect(onToggle).toHaveBeenCalled();
});
