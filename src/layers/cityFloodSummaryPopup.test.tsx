// src/layers/cityFloodSummaryPopup.test.tsx
//
// Tests for the per-city SUMMARY popup wiring: mapping a clicked city feature to
// FloodPopup props (susceptibility variant) and a compliance wording sweep of
// the rendered popup. A city click must show Area (city name), Data type
// (Susceptibility), Susceptibility level, Source, Dataset date, and the
// historical-exposure disclaimer — and must NEVER contain green / "safe" /
// "clear" / "no risk" / a numeric safety score.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  citySummaryFeatureToPopupProps,
  installCityFloodSummaryPopup,
  CITY_SUMMARY_AREA_FALLBACK,
  type CitySummaryLayerClickEvent,
  type CitySummaryMapEvent,
  type CitySummaryPopupMap,
} from './cityFloodSummaryPopup';
import { CITY_SUMMARY_FILL_LAYER_ID } from './cityFloodSummaryLayer';
import { CITY_SUSCEPTIBILITY_DEMO_SOURCE } from '../data/fixtures/cityFloodSusceptibility';
import { FloodPopup } from '../components/overlays/FloodPopup';

/** Banned safety/current wording that must never appear in the popup. */
const BANNED = ['safe', 'no risk', 'clear', 'passable', 'green', 'score'];

// ---------------------------------------------------------------------------
// Feature → popup props mapping
// ---------------------------------------------------------------------------

describe('citySummaryFeatureToPopupProps', () => {
  it('maps a city feature to SUSCEPTIBILITY popup props with city name as area', () => {
    const props = citySummaryFeatureToPopupProps({
      id: 'marikina',
      properties: {
        level: 'HIGH',
        cityName: 'Marikina',
        source: CITY_SUSCEPTIBILITY_DEMO_SOURCE,
        updatedAt: 1_700_000_000,
        dataType: 'SUSCEPTIBILITY',
      },
    });

    expect(props.dataType).toBe('SUSCEPTIBILITY');
    expect(props.area).toBe('Marikina');
    expect(props.level).toBe('HIGH');
    expect(props.source).toBe(CITY_SUSCEPTIBILITY_DEMO_SOURCE);
    expect(props.updatedAt).toBe(1_700_000_000);
    // Never a flood state on a susceptibility popup.
    expect(props.state).toBeUndefined();
  });

  it('falls back to a stable area label and drops an invalid level', () => {
    const props = citySummaryFeatureToPopupProps({ properties: {} });
    expect(props.area).toBe(CITY_SUMMARY_AREA_FALLBACK);
    expect(props.level).toBeUndefined();
    expect(props.updatedAt).toBe(0);
    expect(props.source).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Rendered popup: fields + disclaimer + wording sweep
// ---------------------------------------------------------------------------

describe('rendered city SUMMARY popup', () => {
  it('shows area/level/source/date and the historical-exposure disclaimer, with no banned wording', () => {
    const props = citySummaryFeatureToPopupProps({
      id: 'manila',
      properties: {
        level: 'MODERATE',
        cityName: 'Manila',
        source: CITY_SUSCEPTIBILITY_DEMO_SOURCE,
        updatedAt: 1_700_000_000,
        dataType: 'SUSCEPTIBILITY',
      },
    });

    render(<FloodPopup {...props} />);

    expect(screen.getByTestId('flood-popup-area').textContent).toBe('Manila');
    expect(screen.getByTestId('flood-popup-data-type').textContent).toBe(
      'Susceptibility',
    );
    expect(screen.getByTestId('flood-popup-susceptibility').textContent).toBe(
      'Moderate',
    );
    expect(screen.getByTestId('flood-popup-source').textContent).toBe(
      CITY_SUSCEPTIBILITY_DEMO_SOURCE,
    );

    // The susceptibility disclaimer frames it as modeled/historical exposure
    // that does not confirm current flooding.
    const disclaimer = screen.getByTestId('disclaimer').textContent ?? '';
    expect(disclaimer.toLowerCase()).toContain('does not confirm current flooding');

    // Wording sweep over the entire rendered popup.
    const popupText = (
      screen.getByTestId('flood-popup').textContent ?? ''
    ).toLowerCase();
    for (const banned of BANNED) {
      expect(popupText).not.toContain(banned);
    }
    // No numeric percentage safety score.
    expect(popupText).not.toMatch(/\d+\s*%/);
  });
});

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

/** A fake popup map recording layer-scoped on/off registrations. */
class FakePopupMap implements CitySummaryPopupMap {
  readonly handlers = new Map<
    string,
    (event: CitySummaryLayerClickEvent) => void
  >();

  on(
    event: CitySummaryMapEvent,
    layerId: string,
    handler: (event: CitySummaryLayerClickEvent) => void,
  ): void {
    this.handlers.set(`${event}:${layerId}`, handler);
  }

  off(event: CitySummaryMapEvent, layerId: string): void {
    this.handlers.delete(`${event}:${layerId}`);
  }

  getCanvas(): { style: { cursor: string } } {
    return { style: { cursor: '' } };
  }
}

describe('installCityFloodSummaryPopup wiring', () => {
  it('registers a click handler on the city fill layer and renders props on click', () => {
    const map = new FakePopupMap();
    const renderPopup = vi.fn();

    const uninstall = installCityFloodSummaryPopup(map, renderPopup);

    const clickHandler = map.handlers.get(`click:${CITY_SUMMARY_FILL_LAYER_ID}`);
    expect(clickHandler).toBeDefined();

    clickHandler!({
      features: [
        {
          id: 'taguig',
          properties: {
            level: 'MODERATE',
            cityName: 'Taguig',
            source: CITY_SUSCEPTIBILITY_DEMO_SOURCE,
            updatedAt: 1_700_000_000,
          },
        },
      ],
      lngLat: { lng: 121.05, lat: 14.52 },
    });

    expect(renderPopup).toHaveBeenCalledTimes(1);
    const [popupProps] = renderPopup.mock.calls[0];
    expect(popupProps.dataType).toBe('SUSCEPTIBILITY');
    expect(popupProps.area).toBe('Taguig');
    expect(popupProps.level).toBe('MODERATE');

    // Teardown removes every handler this installed.
    uninstall();
    expect(map.handlers.size).toBe(0);
  });

  it('ignores clicks that carry no features', () => {
    const map = new FakePopupMap();
    const renderPopup = vi.fn();
    installCityFloodSummaryPopup(map, renderPopup);

    const clickHandler = map.handlers.get(`click:${CITY_SUMMARY_FILL_LAYER_ID}`);
    clickHandler!({ features: [], lngLat: { lng: 121, lat: 14.5 } });

    expect(renderPopup).not.toHaveBeenCalled();
  });
});
