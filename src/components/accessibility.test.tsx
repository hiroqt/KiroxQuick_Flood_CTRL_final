// src/components/accessibility.test.tsx
//
// Accessibility hardening tests (Task 17, Req 11.1–11.5).
//
// These tests verify the programmatic + visual accessibility foundations that
// Task 17 hardens across every map control:
//
//   - Keyboard operability (Req 11.1): each interactive element is a real
//     focusable element, reachable via Tab and activatable via Enter/Space.
//   - Visible focus indicator (Req 11.2): every control carries the
//     `baharoute-focus-ring` class hook, and layout.css defines a focus-visible
//     style plus a dedicated focus-ring color token used to draw a >= 3:1
//     boundary. (The raw CSS is asserted by reading the stylesheet text.)
//   - Accessible labels (Req 11.3): each control exposes an accessible name.
//   - Non-color-alone status (Req 11.4): LayerControl renders "On"/"Off" text;
//     the susceptibility legend carries a hatch pattern + text label per level.
//
// NOTE: Full WCAG 2.1 AA conformance — including measured contrast against
// every real rendered background and behavior with real assistive technology —
// still requires manual AT review and expert verification (design →
// Accessibility strategy). These automated tests cover the programmatic and
// structural guarantees only. The environment is jsdom.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ZoomControls } from './controls/ZoomControls';
import { RecenterControl } from './controls/RecenterControl';
import { LocationControl } from './controls/LocationControl';
import { LayerControl } from './controls/LayerControl';
import { FixtureDataSource } from '../services/FixtureDataSource';
import type { DataLayerMeta } from '../types/layer';
import type { LocationResult } from '../services/geolocation';
import {
  susceptibilityPattern,
  susceptibilityLabel,
} from '../layers/visualMapping';

const FOCUS_RING_CLASS = 'baharoute-focus-ring';

const fixtureLayers: DataLayerMeta[] = new FixtureDataSource().listLayers();

/** A granted-inside-NCR geolocation result so LocationControl activates cleanly. */
const grantedInNcr: RequestLocationFnResult = {
  status: 'granted',
  // Central Metro Manila coordinate (inside the NCR extent).
  lng: 121.0,
  lat: 14.6,
};
type RequestLocationFnResult = LocationResult;

describe('Accessibility hardening — every control has a visible focus ring (Req 11.2)', () => {
  it('ZoomControls: both buttons carry the focus-ring class hook', () => {
    render(<ZoomControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.classList.contains(FOCUS_RING_CLASS)).toBe(true);
    }
  });

  it('RecenterControl: the button carries the focus-ring class hook', () => {
    render(<RecenterControl onRecenter={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.classList.contains(FOCUS_RING_CLASS)).toBe(true);
  });

  it('LocationControl: the button carries the focus-ring class hook', () => {
    render(<LocationControl requestLocation={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.classList.contains(FOCUS_RING_CLASS)).toBe(true);
  });

  it('LayerControl: every layer checkbox carries the focus-ring class hook', () => {
    render(<LayerControl layers={fixtureLayers} onToggle={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const checkbox of checkboxes) {
      expect(checkbox.classList.contains(FOCUS_RING_CLASS)).toBe(true);
    }
  });
});

describe('Accessibility hardening — accessible names (Req 11.3)', () => {
  it('ZoomControls: both buttons have accessible names', () => {
    render(<ZoomControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /zoom in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /zoom out/i }),
    ).toBeInTheDocument();
  });

  it('RecenterControl: the button has an accessible name', () => {
    render(<RecenterControl onRecenter={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /recenter map to metro manila/i }),
    ).toBeInTheDocument();
  });

  it('LocationControl: the button has an accessible name', () => {
    render(<LocationControl requestLocation={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /show my location/i }),
    ).toBeInTheDocument();
  });

  it('LayerControl: every checkbox has an accessible name from its label', () => {
    render(<LayerControl layers={fixtureLayers} onToggle={vi.fn()} />);
    for (const meta of fixtureLayers) {
      // getByRole with a name resolves via the associated <label> text.
      expect(
        screen.getByRole('checkbox', {
          name: new RegExp(escapeRegExp(meta.label), 'i'),
        }),
      ).toBeInTheDocument();
    }
  });
});

describe('Accessibility hardening — keyboard operability (Req 11.1)', () => {
  it('ZoomControls: reachable via Tab and activatable via keyboard', async () => {
    const user = userEvent.setup();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    render(<ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} />);

    await user.tab();
    const zoomIn = screen.getByRole('button', { name: /zoom in/i });
    expect(zoomIn).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    await user.tab();
    const zoomOut = screen.getByRole('button', { name: /zoom out/i });
    expect(zoomOut).toHaveFocus();
    await user.keyboard(' ');
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('RecenterControl: reachable via Tab and activatable via Enter/Space', async () => {
    const user = userEvent.setup();
    const onRecenter = vi.fn();
    render(<RecenterControl onRecenter={onRecenter} />);

    await user.tab();
    const button = screen.getByRole('button');
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onRecenter).toHaveBeenCalledTimes(2);
  });

  it('LocationControl: reachable via Tab and activatable via keyboard', async () => {
    const user = userEvent.setup();
    const requestLocation = vi.fn(async () => grantedInNcr);
    render(<LocationControl requestLocation={requestLocation} />);

    await user.tab();
    const button = screen.getByRole('button');
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(requestLocation).toHaveBeenCalledTimes(1);
  });

  it('LayerControl: a checkbox is reachable via Tab and togglable via keyboard', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<LayerControl layers={fixtureLayers} onToggle={onToggle} />);

    await user.tab();
    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    expect(firstCheckbox).toHaveFocus();

    // Space toggles a focused checkbox.
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('Accessibility hardening — non-color-alone status (Req 11.4)', () => {
  it('LayerControl: renders "On"/"Off" text, not color alone', async () => {
    const user = userEvent.setup();
    // Force a known initial state so we can assert both On and Off text appear.
    const [firstLayer, ...rest] = fixtureLayers;
    render(
      <LayerControl
        layers={fixtureLayers}
        onToggle={vi.fn()}
        initialVisibility={{
          [firstLayer.id]: true,
          ...(rest[0] ? { [rest[0].id]: false } : {}),
        }}
      />,
    );

    // The very first item is On; toggling it flips the text to Off.
    const firstItem = screen.getByTestId(`layer-item-${firstLayer.id}`);
    expect(within(firstItem).getByText('On')).toBeInTheDocument();

    await user.click(within(firstItem).getByRole('checkbox'));
    expect(within(firstItem).getByText('Off')).toBeInTheDocument();
  });

  it('Susceptibility legend: each level has a non-color hatch pattern + text label', () => {
    // The susceptibility status carries a hatch pattern + text label in addition
    // to color, so the level is perceivable without color (Req 11.4).
    for (const level of ['HIGH', 'MODERATE', 'LOW'] as const) {
      const cue = susceptibilityPattern(level);
      expect(cue.pattern).toMatch(/^hatch-(dense|medium|light)$/);
      expect(cue.label.length).toBeGreaterThan(0);
      expect(cue.label).toBe(susceptibilityLabel(level));
    }
    // Patterns are distinct across levels (a real non-color differentiator).
    const patterns = new Set(
      (['HIGH', 'MODERATE', 'LOW'] as const).map(
        (l) => susceptibilityPattern(l).pattern,
      ),
    );
    expect(patterns.size).toBe(3);
  });
});

describe('Accessibility hardening — layout.css defines the focus indicator (Req 11.2)', () => {
  const cssPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../styles/layout.css',
  );
  const css = readFileSync(cssPath, 'utf8');

  it('defines a dedicated focus-ring color token in :root', () => {
    expect(css).toMatch(/--baharoute-focus-ring-color\s*:/);
  });

  it('defines a focus-visible style bound to the focus-ring class hook', () => {
    expect(css).toMatch(/\.baharoute-focus-ring:focus-visible/);
  });

  it('applies the focus-ring token in a focus rule (visible outline)', () => {
    // The focus rule uses the dedicated token to draw the outline.
    expect(css).toMatch(
      /\.baharoute-focus-ring:focus[^}]*var\(--baharoute-focus-ring-color\)/s,
    );
  });

  it('provides a plain :focus fallback for engines without :focus-visible', () => {
    expect(css).toMatch(/\.baharoute-focus-ring:focus\b/);
  });
});

/** Escapes regex-special characters so a label can be matched literally. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
