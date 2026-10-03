// src/layers/reportMarkersLayer.test.ts
//
// Guards the runtime community-report marker refresh used by the dynamic
// "report flooding" flow. A newly submitted report must appear in the layer's
// GeoJSON without reinstalling the layer, and must never read as confirmed.

import { describe, it, expect, vi } from 'vitest';
import {
  updateCommunityReportsSource,
  communityReportsToGeoJSON,
  communityDepthColor,
  buildCommunityReportsLayer,
  buildCommunityReportsBadgeLayer,
  buildOfficialClosuresLayer,
  installReportMarkers,
  installReportPopups,
  COMMUNITY_REPORTS_LAYER_ID,
  type ReportPopupMap,
  setCommunityReportsVisibility,
  COMMUNITY_REPORTS_SOURCE_ID,
  COMMUNITY_REPORTS_BADGE_LAYER_ID,
  COMMUNITY_REPORTS_HITBOX_LAYER_ID,
  COMMUNITY_DEPTH_COLORS,
  COMMUNITY_RESOLVED_COLOR,
  type PointSourceUpdateMap,
  type UpdatableGeoJSONSource,
  type PointLayerMapAdapter,
} from './reportMarkersLayer';
import { LayerRegistry, type MapLayerAdapter, type MapLayerSpec } from './LayerRegistry';
import { communityIconId } from './communityReportIcon';
import type { CommunityReport } from '../types/report';
import { buildCommunityReport, resolveReport } from '../services/reportLifecycle';

/** A real NCR point (Manila) so the report resolves to a barangay. */
const report: CommunityReport = {
  id: 'user-report-1',
  state: 'ORANGE',
  passable: false,
  metadata: {
    location: { lng: 120.982, lat: 14.598 },
    source: 'DEMO — community report (fixture)',
    dataType: 'COMMUNITY_REPORT',
    updatedAt: 1_700_000_000,
    verificationStatus: 'UNCONFIRMED',
  },
};

describe('updateCommunityReportsSource', () => {
  it('replaces the community-reports source data via setData', () => {
    const setData = vi.fn();
    const source: UpdatableGeoJSONSource = { setData };
    const map: PointSourceUpdateMap = {
      getSource: (id) => (id === COMMUNITY_REPORTS_SOURCE_ID ? source : undefined),
    };

    updateCommunityReportsSource(map, [report]);

    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenCalledWith(communityReportsToGeoJSON([report]));
  });

  it('is a no-op when the source is not installed yet', () => {
    const map: PointSourceUpdateMap = { getSource: () => undefined };
    expect(() => updateCommunityReportsSource(map, [report])).not.toThrow();
  });

  it('projects the report as a point feature carrying its reported state', () => {
    const fc = communityReportsToGeoJSON([report]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [120.982, 14.598],
    });
    expect(fc.features[0].properties?.state).toBe('ORANGE');
  });
});

// --- Community Report V2 realism-pass marker tests --------------------------

const NOW = 1_900_000_000;
/** A community report at a real NCR point with given conditions. */
function rpt(id: string, depth: Parameters<typeof buildCommunityReport>[3]['depth'], pass: Parameters<typeof buildCommunityReport>[3]['passability']): CommunityReport {
  return buildCommunityReport(id, 120.982, 14.598, { depth, passability: pass }, 'DEMO', NOW);
}

describe('communityDepthColor (depth → marker color)', () => {
  it('ramps cool→hot by depth and uses neutral amber for unknown', () => {
    expect(communityDepthColor('ANKLE', false)).toBe(COMMUNITY_DEPTH_COLORS.ANKLE);
    expect(communityDepthColor('KNEE', false)).toBe(COMMUNITY_DEPTH_COLORS.KNEE);
    expect(communityDepthColor('WAIST', false)).toBe(COMMUNITY_DEPTH_COLORS.WAIST);
    expect(communityDepthColor('ABOVE_WAIST', false)).toBe(COMMUNITY_DEPTH_COLORS.ABOVE_WAIST);
    expect(communityDepthColor('UNKNOWN', false)).toBe(COMMUNITY_DEPTH_COLORS.UNKNOWN);
    expect(communityDepthColor(undefined, false)).toBe(COMMUNITY_DEPTH_COLORS.UNKNOWN);
  });

  it('resolved overrides depth → muted grey', () => {
    expect(communityDepthColor('WAIST', true)).toBe(COMMUNITY_RESOLVED_COLOR);
  });
});

describe('community marker GeoJSON display props (SVG-icon approach)', () => {
  it('depth drives depthColor + iconKey; resolved reports are muted + RESOLVED key', () => {
    const active = communityReportsToGeoJSON([rpt('a', 'WAIST', 'NOT_PASSABLE')]).features[0];
    expect(active.properties?.depthColor).toBe(COMMUNITY_DEPTH_COLORS.WAIST);
    expect(active.properties?.iconKey).toBe('WAIST');
    expect(active.properties?.stage).not.toBe('RESOLVED');

    const resolved = communityReportsToGeoJSON([
      resolveReport(rpt('r', 'KNEE', 'HIGH_CLEARANCE_ONLY'), NOW),
    ]).features[0];
    expect(resolved.properties?.depthColor).toBe(COMMUNITY_RESOLVED_COLOR);
    expect(resolved.properties?.iconKey).toBe('RESOLVED');
    expect(resolved.properties?.stage).toBe('RESOLVED');
  });

  it('carries NO emoji marker text; badge text is digits only and empty when 0', () => {
    const zero = communityReportsToGeoJSON([rpt('z', 'KNEE', 'PASSABLE')]).features[0];
    // No leftover emoji/text-glyph properties.
    expect(zero.properties?.marker).toBeUndefined();
    expect(zero.properties?.resolvedMark).toBeUndefined();
    // Badge text is empty (hidden by the layer filter) when there are no confirmations.
    expect(zero.properties?.badgeText).toBe('');

    const confirmed: CommunityReport = { ...rpt('c', 'KNEE', 'PASSABLE'), confirmationCount: 3 };
    expect(communityReportsToGeoJSON([confirmed]).features[0].properties?.badgeText).toBe('3');

    const many: CommunityReport = { ...rpt('m', 'KNEE', 'PASSABLE'), confirmationCount: 42 };
    expect(communityReportsToGeoJSON([many]).features[0].properties?.badgeText).toBe('9+');
  });
});

describe('community vs official marker distinction (SVG icon vs solid circle)', () => {
  it('community uses a registered ICON image (no text glyph); official is a solid circle', () => {
    const community = buildCommunityReportsLayer();
    const official = buildOfficialClosuresLayer();
    expect(community.type).toBe('symbol');
    expect(official.type).toBe('circle');
    // Community draws a project-owned icon image, NOT a text/emoji glyph.
    expect((community.layout as Record<string, unknown>)['icon-image']).toBeDefined();
    expect((community.layout as Record<string, unknown>)['text-field']).toBeUndefined();
    // Official remains a bold solid closure color (never shared with community).
    const officialColor = (official.paint as Record<string, unknown>)['circle-color'];
    expect(officialColor).not.toBe(COMMUNITY_DEPTH_COLORS.WAIST);
  });
});

// --- Install flow: image registration + companion layers + visibility -------

/** A fake map adapter capturing images, sources, layers, and layout props. */
function makeInstallFakeMap() {
  const images = new Set<string>();
  const sources = new Set<string>();
  const layers: string[] = [];
  const layoutProps: Array<{ id: string; name: string; value: unknown }> = [];
  const map = {
    hasImage: (id: string) => images.has(id),
    addImage: (id: string) => images.add(id),
    addSource: (id: string) => sources.add(id),
    addLayer: (layer: MapLayerSpec) => {
      layers.push(layer.id);
    },
    getLayer: (id: string) => (layers.includes(id) ? { id } : undefined),
    setLayoutProperty: (id: string, name: string, value: unknown) =>
      layoutProps.push({ id, name, value }),
  };
  return { map, images, sources, layers, layoutProps };
}

/** A registry over a minimal adapter that records visibility toggles. */
function makeRegistry() {
  const stack: string[] = [];
  const layout: Array<{ id: string; name: string; value: unknown }> = [];
  const adapter: MapLayerAdapter = {
    addLayer: (layer: MapLayerSpec) => {
      stack.push(layer.id);
    },
    removeLayer: () => {},
    setLayoutProperty: (id, name, value) => layout.push({ id, name, value }),
    getLayer: (id) => (stack.includes(id) ? { id } : undefined),
  };
  return { registry: new LayerRegistry(adapter), layout };
}

const installReport = buildCommunityReport('inst', 120.982, 14.598, { depth: 'KNEE', passability: 'PASSABLE' }, 'DEMO');

describe('installReportMarkers (SVG icons + companion layers)', () => {
  it('registers the project icon images and adds badge + hitbox companion layers', () => {
    const { map, images, layers } = makeInstallFakeMap();
    const { registry } = makeRegistry();
    installReportMarkers(map as unknown as PointLayerMapAdapter, registry, [installReport], []);
    // The depth + resolved pin icons are registered as project-owned images.
    expect(images.has(communityIconId('KNEE'))).toBe(true);
    expect(images.has(communityIconId('RESOLVED'))).toBe(true);
    // Companion layers were added directly on the map.
    expect(layers).toContain(COMMUNITY_REPORTS_BADGE_LAYER_ID);
    expect(layers).toContain(COMMUNITY_REPORTS_HITBOX_LAYER_ID);
  });
});

describe('setCommunityReportsVisibility fans out to companion layers', () => {
  it('toggles the hitbox + badge visibility together with the base pin', () => {
    const { map, layers, layoutProps } = makeInstallFakeMap();
    // Pretend the companions already exist on the map.
    layers.push(COMMUNITY_REPORTS_HITBOX_LAYER_ID, COMMUNITY_REPORTS_BADGE_LAYER_ID);
    const { registry } = makeRegistry();
    setCommunityReportsVisibility(map as never, registry, true);
    const toggled = layoutProps.filter((p) => p.name === 'visibility').map((p) => p.id);
    expect(toggled).toContain(COMMUNITY_REPORTS_HITBOX_LAYER_ID);
    expect(toggled).toContain(COMMUNITY_REPORTS_BADGE_LAYER_ID);
    expect(layoutProps.every((p) => p.value === 'visible')).toBe(true);
  });
});

describe('badge layer only renders when there is a confirmation count', () => {
  it('filters out features whose badgeText is empty', () => {
    const badge = buildCommunityReportsBadgeLayer();
    // The filter keeps only features with a non-empty badgeText.
    expect(badge.filter).toEqual(['!=', ['get', 'badgeText'], '']);
    expect((badge.layout as Record<string, unknown>)['text-field']).toEqual(['get', 'badgeText']);
  });
});

describe('style-reload safety: re-registering images never duplicates', () => {
  it('a second registerCommunityImages pass (reload) adds no new images', () => {
    const { map, images } = makeInstallFakeMap();
    const { registry } = makeRegistry();
    installReportMarkers(map as unknown as PointLayerMapAdapter, registry, [installReport], []);
    const countAfterInstall = images.size;
    // Simulate a style reload re-registration.
    installReportMarkers(map as unknown as PointLayerMapAdapter, registry, [installReport], []);
    expect(images.size).toBe(countAfterInstall);
  });
});



describe('community marker clicks', () => {
  it('opens the same report details from the pin, badge, and tap target and removes listeners', () => {
    const handlers = new Map<string, Parameters<ReportPopupMap['on']>[2]>();
    const off = vi.fn();
    const canvas = { style: { cursor: '' } };
    const map: ReportPopupMap = {
      on: (event, layer, handler) => { handlers.set(`${event}:${layer}`, handler); },
      off, getCanvas: () => canvas,
    };
    const renderPopup = vi.fn();
    const uninstall = installReportPopups(map, renderPopup);
    const feature = communityReportsToGeoJSON([rpt('selected', 'WAIST', 'NOT_PASSABLE')]).features[0];
    const event = { features: [feature], lngLat: { lng: 120.982, lat: 14.598 } };
    for (const layer of [COMMUNITY_REPORTS_LAYER_ID, COMMUNITY_REPORTS_BADGE_LAYER_ID, COMMUNITY_REPORTS_HITBOX_LAYER_ID]) {
      handlers.get(`click:${layer}`)!(event);
      expect(renderPopup).toHaveBeenLastCalledWith(expect.objectContaining({
        id: 'selected', kind: 'community', severity: 'SEVERE', depth: 'WAIST',
        passability: 'NOT_PASSABLE', updatedAt: NOW, source: 'DEMO',
      }), event.lngLat);
    }
    handlers.get(`mouseenter:${COMMUNITY_REPORTS_LAYER_ID}`)!(event);
    expect(canvas.style.cursor).toBe('pointer');
    uninstall();
    expect(off).toHaveBeenCalledTimes(handlers.size);
  });
});
