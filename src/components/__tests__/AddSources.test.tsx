import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    const instagramTabs = screen.getAllByText(/Instagram/i);
    expect(instagramTabs.length).toBeGreaterThan(0);
    const youtubeTabs = screen.getAllByText(/YouTube/i);
    expect(youtubeTabs.length).toBeGreaterThan(0);
  });

  it('should have generate button', () => {
    render(<AddSources {...defaultProps} />);
    expect(screen.getByText(/Generate Structure/i)).toBeInTheDocument();
  });
});

