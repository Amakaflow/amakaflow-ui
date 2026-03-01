import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UnifiedImportScreen } from '../UnifiedImportScreen';

describe('UnifiedImportScreen', () => {
  it('renders three tabs', () => {
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /urls.*media/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^file$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /integrations/i })).toBeInTheDocument();
  });

  it('shows URLs & Media panel content by default', () => {
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    // The placeholder content specific to this panel
    expect(screen.getByText(/urls.*media.*coming soon/i)).toBeInTheDocument();
  });

  it('switches to File tab panel when clicked', async () => {
    const user = userEvent.setup();
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /^file$/i }));
    expect(screen.getByText(/file import.*coming soon/i)).toBeInTheDocument();
  });

  it('switches to Integrations tab panel when clicked', async () => {
    const user = userEvent.setup();
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /integrations/i }));
    expect(screen.getByText(/integrations.*coming soon/i)).toBeInTheDocument();
  });
});
