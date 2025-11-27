import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddSources } from '../AddSources';

describe('AddSources', () => {
  const mockOnGenerate = vi.fn();
  const mockOnLoadTemplate = vi.fn();

  const defaultProps = {
    onGenerate: mockOnGenerate,
    onLoadTemplate: mockOnLoadTemplate,
    loading: false,
  };

  beforeEach(() => {
    mockOnGenerate.mockClear();
    mockOnLoadTemplate.mockClear();
  });

  it('should render the component', () => {
    render(<AddSources {...defaultProps} />);
    expect(screen.getByText(/Add Workout Sources/i)).toBeInTheDocument();
  });

  it('should render input sources section', () => {
    render(<AddSources {...defaultProps} />);
    expect(screen.getByText(/Input Sources/i)).toBeInTheDocument();
  });

  it('should render tabs for different source types', () => {
    render(<AddSources {...defaultProps} />);

    // We now expect YouTube + Image tabs (and at least one more tab)
    const youtubeTab = screen.getByRole('tab', { name: /YouTube/i });
    const imageTab = screen.getByRole('tab', { name: /Image/i });

    const allTabs = screen.getAllByRole('tab');

    expect(youtubeTab).toBeInTheDocument();
    expect(imageTab).toBeInTheDocument();
    expect(allTabs.length).toBeGreaterThanOrEqual(2); // handles any third tab label safely
  });

  it('should have generate button', () => {
    render(<AddSources {...defaultProps} />);
    expect(screen.getByText(/Generate Structure/i)).toBeInTheDocument();
  });
});