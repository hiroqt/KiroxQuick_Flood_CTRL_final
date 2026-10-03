// src/layers/susceptibilityPopup.test.ts
//
// Unit tests for the susceptibility click/tap popup WIRING (Task 10.2;
// Req 13.3, 13.1, 13.2).
//
// These exercise the pure mapping and the registration helper against a FAKE
// map + fake features — no WebGL map is required (test env is jsdom). A small
// render test mounts <FloodPopup> with the mapped props to assert the
// historical-exposure disclaimer appears and no banned "safe"/score language is
// present.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  SUSCEPTIBILITY_AREA_FALLBACK,
  installSusceptibilityPopup,
  susceptibilityFeatureToPopupProps,
  type LngLatLike,
  type RenderSusceptibilityPopup,
  type SusceptibilityFeatureLike,
  type SusceptibilityLayerClickEvent,
  type SusceptibilityMapEvent,
  type SusceptibilityPopupMap,
} from './susceptibilityPopup';
import { SUSCEPTIBILITY_FILL_LAYER_ID } from './floodSusceptibilityLayer';
import { FloodPopup } from '../components/overlays/FloodPopup';

// ---------------------------------------------------------------------------
// Fake map: records on/off registrations and lets tests emit events.
// ---------------------------------------------------------------------------

interface OnCall {
  event: SusceptibilityMapEvent;
  layerId: string;
  handler: (event: SusceptibilityLayerClickEvent) => void;
}

class FakeMap implements SusceptibilityPopupMap {
  readonly onCalls: OnCall[] = [];
  readonly offCalls: OnCall[] = [];
  readonly canvasStyle = { cursor: '' };

  on(
    event: SusceptibilityMapEvent,
    layerId: string,
    handler: (event: SusceptibilityLayerClickEvent) => void,
  ): void {
    this.onCalls.push({ event, layerId, handler });
  }

  off(
    event: SusceptibilityMapEvent,
    layerId: string,
    handler: (event: SusceptibilityLayerClickEvent) => void,
  ): void {
    this.offCalls.push({ event, layerId, handler });
  }

  getCanvas(): { style: { cursor: string } } {
    return { style: this.canvasStyle };
  }

  /** Test helper: emit an event to every handler registered for it. */
  emit(event: SusceptibilityMapEvent, payload: SusceptibilityLayerClickEvent) {
    for (const call of this.onCalls) {
      if (call.event === event && call.layerId === SUSCEPTIBILITY_FILL_LAYER_ID) {
        call.handler(payload);
      }
    }
  }
}

const LNG_LAT: LngLatLike = { lng: 121.05, lat: 14.6 };

function susceptibilityFeature(
  properties: Record<string, unknown> | null,
  id?: string | number,
): SusceptibilityFeatureLike {
  return { id, properties };
}

// ---------------------------------------------------------------------------
// susceptibilityFeatureToPopupProps
// ---------------------------------------------------------------------------

describe('susceptibilityFeatureToPopupProps', () => {
  it('maps level, source, updatedAt and area (from name) to FloodPopup props', () => {
    const feature = susceptibilityFeature(
      {
        level: 'HIGH',
        source: 'DEMO — modeled susceptibility (fixture)',
        updatedAt: 1_700_000_000,
        name: 'Marikina River corridor',
      },
      'demo-susceptibility-marikina-corridor',
    );

    const props = susceptibilityFeatureToPopupProps(feature);

    expect(props.dataType).toBe('SUSCEPTIBILITY');
    expect(props.level).toBe('HIGH');
    expect(props.source).toBe('DEMO — modeled susceptibility (fixture)');
    expect(props.updatedAt).toBe(1_700_000_000);
    expect(props.area).toBe('Marikina River corridor');
    // Susceptibility popups never carry a Flood_State.
    expect(props.state).toBeUndefined();
  });

  it('falls back to the feature id for area when no name is present', () => {
    const feature = susceptibilityFeature(
      { level: 'MODERATE', source: 'DEMO', updatedAt: 1_700_000_000 },
      'demo-susceptibility-pasig-river',
    );

    const props = susceptibilityFeatureToPopupProps(feature);

    expect(props.area).toBe('demo-susceptibility-pasig-river');
    expect(props.level).toBe('MODERATE');
  });

  it('uses a stable fallback area when neither name nor id is available', () => {
    const props = susceptibilityFeatureToPopupProps(
      susceptibilityFeature({ level: 'LOW', source: 'DEMO', updatedAt: 1 }),
    );

    expect(props.area).toBe(SUSCEPTIBILITY_AREA_FALLBACK);
  });

  it('drops an invalid level and defaults missing source/updatedAt', () => {
    const props = susceptibilityFeatureToPopupProps(
      susceptibilityFeature({ level: 'EXTREME' }, 'x'),
    );

    expect(props.level).toBeUndefined();
    expect(props.source).toBe('');
    expect(props.updatedAt).toBe(0);
    expect(props.dataType).toBe('SUSCEPTIBILITY');
  });
});

// ---------------------------------------------------------------------------
// installSusceptibilityPopup
// ---------------------------------------------------------------------------

describe('installSusceptibilityPopup', () => {
  it('registers a click handler on the susceptibility fill layer', () => {
    const map = new FakeMap();
    const renderPopup: RenderSusceptibilityPopup = vi.fn();

    installSusceptibilityPopup(map, renderPopup);

    const clickCall = map.onCalls.find((c) => c.event === 'click');
    expect(clickCall).toBeDefined();
    expect(clickCall?.layerId).toBe(SUSCEPTIBILITY_FILL_LAYER_ID);
  });

  it('invokes renderPopup with the mapped props and lngLat on click', () => {
    const map = new FakeMap();
    const renderPopup = vi.fn<RenderSusceptibilityPopup>();

    installSusceptibilityPopup(map, renderPopup);

    map.emit('click', {
      features: [
        susceptibilityFeature(
          { level: 'HIGH', source: 'DEMO', updatedAt: 1_700_000_000, name: 'Corridor' },
          'demo-1',
        ),
      ],
      lngLat: LNG_LAT,
    });

    expect(renderPopup).toHaveBeenCalledTimes(1);
    const [props, lngLat] = renderPopup.mock.calls[0];
    expect(props).toMatchObject({
      area: 'Corridor',
      dataType: 'SUSCEPTIBILITY',
      level: 'HIGH',
      source: 'DEMO',
      updatedAt: 1_700_000_000,
    });
    expect(lngLat).toEqual(LNG_LAT);
  });

  it('does not render a popup when the click carries no feature', () => {
    const map = new FakeMap();
    const renderPopup = vi.fn();

    installSusceptibilityPopup(map, renderPopup);
    map.emit('click', { features: [], lngLat: LNG_LAT });

    expect(renderPopup).not.toHaveBeenCalled();
  });

  it('toggles a pointer cursor on mouseenter/leave', () => {
    const map = new FakeMap();
    installSusceptibilityPopup(map, vi.fn());

    map.emit('mouseenter', { lngLat: LNG_LAT });
    expect(map.canvasStyle.cursor).toBe('pointer');

    map.emit('mouseleave', { lngLat: LNG_LAT });
    expect(map.canvasStyle.cursor).toBe('');
  });

  it('removes every handler it registered when uninstalled', () => {
    const map = new FakeMap();
    const uninstall = installSusceptibilityPopup(map, vi.fn());

    uninstall();

    const offEvents = map.offCalls.map((c) => c.event).sort();
    expect(offEvents).toEqual(['click', 'mouseenter', 'mouseleave']);
    for (const call of map.offCalls) {
      expect(call.layerId).toBe(SUSCEPTIBILITY_FILL_LAYER_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// Render test: FloodPopup with the mapped props shows the disclaimer and no
// banned safety language (Req 13.1, 13.2, 13.3).
// ---------------------------------------------------------------------------

describe('FloodPopup rendered from mapped susceptibility props', () => {
  it('shows all required fields and the historical-exposure disclaimer', () => {
    const props = susceptibilityFeatureToPopupProps(
      susceptibilityFeature(
        {
          level: 'HIGH',
          source: 'DEMO — modeled susceptibility (fixture)',
          updatedAt: 1_700_000_000,
          name: 'Marikina River corridor',
        },
        'demo-1',
      ),
    );

    render(<FloodPopup {...props} />);

    expect(screen.getByTestId('flood-popup-area')).toHaveTextContent(
      'Marikina River corridor',
    );
    expect(screen.getByTestId('flood-popup-data-type')).toHaveTextContent(
      'Susceptibility',
    );
    expect(screen.getByTestId('flood-popup-susceptibility')).toHaveTextContent(
      /high/i,
    );
    expect(screen.getByTestId('flood-popup-source')).toHaveTextContent('DEMO');
    expect(screen.getByTestId('flood-popup-updated')).not.toBeEmptyDOMElement();

    // Historical-exposure disclaimer (Req 13.3).
    expect(screen.getByTestId('disclaimer')).toHaveTextContent(
      /does not confirm current flooding/i,
    );
  });

  it('contains no banned "safe"/"clear"/"no risk"/score language', () => {
    const props = susceptibilityFeatureToPopupProps(
      susceptibilityFeature(
        { level: 'LOW', source: 'DEMO', updatedAt: 1_700_000_000 },
        'demo-2',
      ),
    );

    const { container } = render(<FloodPopup {...props} />);
    const text = (container.textContent ?? '').toLowerCase();

    expect(text).not.toMatch(/\bsafe\b/);
    expect(text).not.toMatch(/\bclear\b/);
    expect(text).not.toMatch(/no risk/);
    // No numeric safety score.
    expect(text).not.toMatch(/score/);
  });
});
