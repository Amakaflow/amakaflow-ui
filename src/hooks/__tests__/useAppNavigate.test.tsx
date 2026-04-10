import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAppNavigate } from '../useAppNavigate';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>;
}

describe('useAppNavigate', () => {
  it('returns currentView based on current path', () => {
    const { result } = renderHook(() => useAppNavigate(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/workouts']}>{children}</MemoryRouter>
      ),
    });
    expect(result.current.currentView).toBe('workouts');
  });

  it('defaults to home view for root path', () => {
    const { result } = renderHook(() => useAppNavigate(), { wrapper });
    expect(result.current.currentView).toBeDefined();
  });

  it('navigateTo changes location', () => {
    const { result } = renderHook(() => useAppNavigate(), { wrapper });

    act(() => {
      result.current.navigateTo('workouts');
    });

    expect(result.current.currentView).toBe('workouts');
  });

  it('setCurrentView is an alias for navigateTo', () => {
    const { result } = renderHook(() => useAppNavigate(), { wrapper });
    expect(result.current.setCurrentView).toBe(result.current.navigateTo);
  });

  it('exposes location object', () => {
    const { result } = renderHook(() => useAppNavigate(), { wrapper });
    expect(result.current.location).toBeDefined();
    expect(result.current.location.pathname).toBe('/');
  });
});
