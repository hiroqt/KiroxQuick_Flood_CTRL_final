import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';
vi.mock('./NcrScene', () => ({ NcrScene: () => <div data-testid="scene" /> }));
afterEach(() => vi.useRealTimers());
describe('Landing page map handoff', () => {
  it('assembles before entering the map and prevents repeated clicks', async () => {
    vi.useFakeTimers();
    const enter = vi.fn();
    render(<LandingPage onEnter={enter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explore the flood map' }));
    expect(screen.getByRole('status')).toHaveTextContent('Connecting Metro Manila');
    expect(screen.getByRole('button', { name: 'Putting NCR together…' })).toBeDisabled();
    expect(enter).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2400);
    });
    expect(enter).toHaveBeenCalledTimes(1);
  });
  it('cancels pending navigation when unmounted', () => {
    vi.useFakeTimers();
    const enter = vi.fn();
    const { unmount } = render(<LandingPage onEnter={enter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open map' }));
    unmount();
    vi.advanceTimersByTime(3000);
    expect(enter).not.toHaveBeenCalled();
  });
});
