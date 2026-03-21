import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock demo-mode to enable DemoNav rendering
vi.mock('../../lib/demo-mode', () => ({
  isDemoMode: true,
}));

// Mock demo-scenario
vi.mock('../../lib/demo-scenario', () => ({
  getImportScenario: () => 'default',
  setImportScenario: vi.fn(),
  IMPORT_SCENARIO_LABELS: { default: 'Default' },
}));

import { DemoNav } from '../DemoNav';

describe('DemoNav', () => {
  const defaultProps = {
    onNavigate: vi.fn(),
    currentView: 'home',
  };

  beforeEach(() => {
    defaultProps.onNavigate.mockClear();
  });

  it('renders the DEMO button', () => {
    render(<DemoNav {...defaultProps} />);
    expect(screen.getByText('DEMO')).toBeInTheDocument();
  });

  it('opens the panel when DEMO button is clicked', async () => {
    const user = userEvent.setup();
    render(<DemoNav {...defaultProps} />);

    await user.click(screen.getByText('DEMO'));
    expect(screen.getByText('Jump to screen')).toBeInTheDocument();
  });

  it('closes the panel when DEMO button is clicked a second time', async () => {
    const user = userEvent.setup();
    render(<DemoNav {...defaultProps} />);

    // Open
    await user.click(screen.getByText('DEMO'));
    expect(screen.getByText('Jump to screen')).toBeInTheDocument();

    // Close — this is the bug: the panel intercepts the click so the button never fires
    await user.click(screen.getByText('DEMO'));
    expect(screen.queryByText('Jump to screen')).not.toBeInTheDocument();
  });

  it('renders the DEMO button with z-[51] to stay above z-50 panels but below z-[60] overlays', () => {
    render(<DemoNav {...defaultProps} />);
    const button = screen.getByText('DEMO');
    expect(button.className).toContain('z-[51]');
    expect(button.className).not.toContain('z-[60]');
  });

  it('does not render when demo mode is disabled', async () => {
    // Override the mock for this test
    const mod = await import('../../lib/demo-mode');
    Object.defineProperty(mod, 'isDemoMode', { value: false, writable: true });

    const { container } = render(<DemoNav {...defaultProps} />);
    expect(container.innerHTML).toBe('');

    // Restore
    Object.defineProperty(mod, 'isDemoMode', { value: true, writable: true });
  });
});
