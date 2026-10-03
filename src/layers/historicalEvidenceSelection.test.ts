import { describe, expect, it, vi } from 'vitest';
import { installHistoricalEvidenceSelection } from './historicalEvidenceSelection';
import { HISTORICAL_EVIDENCE_LAYER_ID } from './historicalEvidenceLayer';
import type { BarangayLayerClickEvent, BarangayPopupMap } from './barangayPopup';

describe('historical evidence selection', () => {
  it('selects the marker record, ignores missing IDs, and removes its handlers', () => {
    const handlers = new Map<string, (event: BarangayLayerClickEvent) => void>();
    const canvas = { style: { cursor: '' } };
    const map: BarangayPopupMap = {
      on: vi.fn((event, _layer, handler) => handlers.set(event, handler)),
      off: vi.fn(),
      getCanvas: () => canvas,
    };
    const select = vi.fn();
    const uninstall = installHistoricalEvidenceSelection(map, select);
    const event = { features: [{ properties: { id: 'record-1' } }], lngLat: { lng: 121, lat: 14 } };
    handlers.get('click')!(event);
    expect(select).toHaveBeenCalledWith('record-1');
    handlers.get('click')!({ ...event, features: [] });
    expect(select).toHaveBeenCalledTimes(1);
    handlers.get('mouseenter')!(event);
    expect(canvas.style.cursor).toBe('pointer');
    handlers.get('mouseleave')!(event);
    expect(canvas.style.cursor).toBe('');
    uninstall();
    for (const [name, handler] of handlers) {
      expect(map.off).toHaveBeenCalledWith(name, HISTORICAL_EVIDENCE_LAYER_ID, handler);
    }
  });
});
