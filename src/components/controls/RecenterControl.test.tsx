// src/components/controls/RecenterControl.test.tsx
//
// Behavior + accessibility tests for RecenterControl (Task 13.2, Req 7.1–7.3,
// Req 11.1–11.3). The control delegates the actual recenter animation (≤1000 ms)
// to MapManager.recenter via the injected onRecenter callback, so these tests
// verify:
//   - clicking activates onRecenter
//   - keyboard activation (Enter / Space) activates onRecenter (Req 11.1)
//   - the button has an accessible name and is focusable (Req 11.2, 11.3)
//   - repeated activation is safe / does not throw (no-op-safe, Req 7.3)
// The environment is jsdom.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecenterControl } from './RecenterControl';

describe('RecenterControl', () => {
  it('calls onRecenter when clicked with the mouse', async () => {
    const user = userEvent.setup();
    const onRecenter = vi.fn();

    render(<RecenterControl onRecenter={onRecenter} />);

    await user.click(screen.getByRole('button'));

    expect(onRecenter).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible name and is keyboard-focusable', async () => {
    const user = userEvent.setup();
    render(<RecenterControl onRecenter={vi.fn()} />);

    // Accessible name via aria-label (Req 11.3).
    const button = screen.getByRole('button', {
      name: /recenter map to metro manila/i,
    });
    expect(button).toBeInTheDocument();

    // Reachable by keyboard navigation and receives focus (Req 11.1, 11.2).
    await user.tab();
    expect(button).toHaveFocus();
  });

  it('activates onRecenter via the keyboard (Enter and Space)', async () => {
    const user = userEvent.setup();
    const onRecenter = vi.fn();

    render(<RecenterControl onRecenter={onRecenter} />);

    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    // Both Enter and Space activate a native button.
    expect(onRecenter).toHaveBeenCalledTimes(2);
  });

  it('supports a custom accessible label', () => {
    render(
      <RecenterControl onRecenter={vi.fn()} label="Return to NCR view" />,
    );

    expect(
      screen.getByRole('button', { name: /return to ncr view/i }),
    ).toBeInTheDocument();
  });

  it('does not throw on repeated activation (no-op-safe when already framed)', async () => {
    const user = userEvent.setup();
    // Simulates MapManager.recenter, which is a no-op-safe fitBounds: calling it
    // repeatedly (even when already framed) must not throw (Req 7.3).
    const onRecenter = vi.fn(() => {
      /* no-op recenter, safe to call any number of times */
    });

    render(<RecenterControl onRecenter={onRecenter} />);
    const button = screen.getByRole('button');

    await expect(
      (async () => {
        await user.click(button);
        await user.click(button);
        await user.click(button);
      })(),
    ).resolves.not.toThrow();

    expect(onRecenter).toHaveBeenCalledTimes(3);
  });

  it('does not identify the control by color alone (has a text label)', () => {
    render(<RecenterControl onRecenter={vi.fn()} />);
    // A visible text label backs the icon so the control is perceivable without
    // relying on color (Req 11.4).
    expect(screen.getByText('Recenter')).toBeInTheDocument();
  });
});
