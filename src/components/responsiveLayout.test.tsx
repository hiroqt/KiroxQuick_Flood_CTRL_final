// src/components/responsiveLayout.test.tsx
//
// Task 16 — Responsive layout verification.
//
// jsdom cannot evaluate real media queries or perform layout, so these tests
// assert the *structural intent* of the responsive strategy (design →
// "Responsive layout strategy", Req 10):
//
//   1. The controls container carries the `baharoute-controls` layout class
//      (placement is driven by CSS, not hardcoded inline positioning), while
//      keeping its data-testid="map-controls" so existing MapView/App tests
//      stay green.
//   2. src/styles/layout.css declares the 768px breakpoint media query,
//      env(safe-area-inset-*) padding, and >= 44px touch sizing — the three
//      pillars of Req 10.1–10.4. The raw CSS text is read from disk with
//      fs.readFileSync (vitest runs `css: false`, so a CSS import yields "").

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapView, type MapManagerLike } from './MapView';
import type { AppConfig } from '../types/config';

const CONFIG: AppConfig = { tileKey: 'test-key-123', hasTileKey: true };

/**
 * The raw layout.css text, read from disk (resolved from the workspace root
 * where vitest runs, i.e. process.cwd()). A Vite `?raw`
 * import would be cleaner but vitest runs with `css: false`, which yields an
 * empty string for CSS imports; reading the file directly is reliable.
 */
const LAYOUT_CSS = readFileSync(
  resolve(process.cwd(), 'src/styles/layout.css'),
  'utf8',
);

/** Minimal fake manager that never exposes a real (integrable) map. */
function makeFakeManager(): MapManagerLike {
  return {
    init: vi.fn(),
    destroy: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    recenter: vi.fn(),
    getMap: vi.fn(() => null),
  };
}

describe('responsive layout — controls container', () => {
  it('drives placement via the baharoute-controls layout class (not inline positioning)', () => {
    render(<MapView config={CONFIG} createMapManager={makeFakeManager} />);

    const controls = screen.getByTestId('map-controls');
    // The layout class is present so CSS can position it.
    expect(controls).toHaveClass('baharoute-controls');
    // Placement is no longer hardcoded inline: no inline right/top/left/bottom.
    expect(controls.style.right).toBe('');
    expect(controls.style.top).toBe('');
  });
});

describe('responsive layout — layout.css contract', () => {
  it('defines the 768px breakpoint media query (Req 10.1 / 10.2)', () => {
    expect(LAYOUT_CSS).toMatch(/@media/);
    expect(LAYOUT_CSS).toMatch(/768px/);
    // The breakpoint is expressed as a width media query.
    expect(LAYOUT_CSS).toMatch(/@media\s*\(min-width:\s*768px\)/);
  });

  it('uses env(safe-area-inset-*) so no control renders in a notch (Req 10.3)', () => {
    expect(LAYOUT_CSS).toMatch(/safe-area-inset/);
    expect(LAYOUT_CSS).toMatch(/env\(safe-area-inset-top/);
    expect(LAYOUT_CSS).toMatch(/env\(safe-area-inset-bottom/);
  });

  it('enforces a >= 44px minimum touch target (Req 10.4)', () => {
    expect(LAYOUT_CSS).toMatch(/44px/);
    expect(LAYOUT_CSS).toMatch(/min-(width|height)\s*:\s*var\(--baharoute-touch-target\)/);
  });

  it('anchors mobile controls to the lower two-thirds via a max-height token (Req 10.1)', () => {
    // Mobile-first default constrains the cluster to the lower portion of the
    // viewport and anchors it to the bottom.
    expect(LAYOUT_CSS).toMatch(/--baharoute-controls-max-height:\s*66vh/);
    expect(LAYOUT_CSS).toMatch(/--baharoute-controls-top:\s*auto/);
  });

  it('switches placement tokens at the 768px media query (design custom-property token set)', () => {
    // The desktop media query re-defines the placement tokens (top-right).
    const mediaBlock = LAYOUT_CSS.slice(
      LAYOUT_CSS.indexOf('@media (min-width: 768px)'),
    );
    expect(mediaBlock).toMatch(/--baharoute-controls-top:\s*var\(--baharoute-control-inset\)/);
    expect(mediaBlock).toMatch(/--baharoute-controls-bottom:\s*auto/);
  });
});
