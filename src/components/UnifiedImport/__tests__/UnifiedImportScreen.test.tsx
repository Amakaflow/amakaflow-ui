import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UnifiedImportScreen } from '../UnifiedImportScreen';

describe('UnifiedImportScreen', () => {
  it('renders four tabs', () => {
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /urls.*media/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^file$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /integrations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /clip queue/i })).toBeInTheDocument();
  });

  it('shows the URL input in the URLs & Media panel by default', () => {
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    expect(screen.getByPlaceholderText(/paste urls/i)).toBeInTheDocument();
  });

  it('switches to File tab panel when clicked', async () => {
    const user = userEvent.setup();
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /^file$/i }));
    // FileImportTab renders a drop zone
    expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
  });

  it('switches to Integrations tab panel when clicked', async () => {
    const user = userEvent.setup();
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /integrations/i }));
    // IntegrationsTab renders integration tiles
    expect(screen.getByText('Notion')).toBeInTheDocument();
  });

  it('clicking Clip Queue tab shows extension placeholder', async () => {
    const user = userEvent.setup();
    render(<UnifiedImportScreen userId="u1" onDone={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: /clip queue/i }));

    expect(await screen.findByText(/clip workouts as you browse/i)).toBeInTheDocument();
  });
});
