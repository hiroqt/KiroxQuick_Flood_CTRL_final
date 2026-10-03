// src/components/controls/ZoomControls.test.tsx
//
// Verifies the ZoomControls presentation component (Req 5.4, 5.5, 11.1–11.3):
// - zoom-in / zoom-out buttons have accessible names and are keyboard-operable;
// - clicking and keyboard-activating each button invokes the matching callback;
// - repeatedly activating (as would happen at min/max zoom) does not throw — the
//   control just forwards to the clamped MapManager methods (Req 5.5);
// - each button meets the ≥44×44 CSS px Touch_Target sizing intent (Req 5.4).

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ZoomControls, MIN_TOUCH_TARGET_PX } from './ZoomControls';

describe('ZoomControls', () => {
  it('renders zoom-in and zoom-out buttons with accessible names', () => {
    render(<ZoomControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
  });

  it('calls onZoomIn / onZoomOut when the buttons are clicked', async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

    render(<ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} />);

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('calls the callbacks on keyboard activation (Tab + Enter/Space)', async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

    render(<ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} />);

    // Tab to the first button (zoom-in) and activate with Enter.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    // Tab to the second button (zoom-out) and activate with Space.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('does not throw when activated repeatedly (simulating min/max limits)', async () => {
    const user = userEvent.setup();
    // Clamped MapManager methods: safe to call any number of times, never throw.
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

    render(<ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} />);

    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });

    await expect(
      (async () => {
        for (let i = 0; i < 5; i++) {
          await user.click(zoomIn);
          await user.click(zoomOut);
        }
      })(),
    ).resolves.toBeUndefined();

    expect(onZoomIn).toHaveBeenCalledTimes(5);
    expect(onZoomOut).toHaveBeenCalledTimes(5);
  });

  it('sizes each button to at least the minimum touch target (Req 5.4)', () => {
    render(<ZoomControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);

    for (const name of ['Zoom in', 'Zoom out']) {
      const button = screen.getByRole('button', { name });
      expect(button.style.minWidth).toBe(`${MIN_TOUCH_TARGET_PX}px`);
      expect(button.style.minHeight).toBe(`${MIN_TOUCH_TARGET_PX}px`);
      expect(MIN_TOUCH_TARGET_PX).toBeGreaterThanOrEqual(44);
    }
  });

  it('marks each button with a visible focus-ring class hook (Req 11.2)', () => {
    render(<ZoomControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveClass(
      'baharoute-focus-ring',
    );
    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveClass(
      'baharoute-focus-ring',
    );
  });
});
