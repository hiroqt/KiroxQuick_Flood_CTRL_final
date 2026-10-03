// src/layers/communityReportIcon.ts
//
// Project-owned, deterministic community-report map-marker icons. These replace
// the earlier emoji/text-glyph approach, which rendered unreliably (the 💧 glyph
// fell back to showing only the trailing confirmation number) because the
// Mapbox font stack does not include emoji.
//
// Icons are generated programmatically as RGBA pixel buffers (ImageData-shaped),
// so there is NO dependency on a glyph font, NO remote image URL, and the result
// is identical on every device/DPI. Each icon is a rounded teardrop map-pin with
// a simple white water-wave glyph inside and a strong white border.
//
// One icon per depth color + a muted resolved variant + a small circular badge
// background. Dynamic coloring per-feature via Mapbox SDF is possible, but a
// tiny fixed set of pre-colored variants is simpler, fully deterministic, and
// avoids SDF edge cases — chosen for maintainability.

import {
  COMMUNITY_DEPTH_COLORS,
  COMMUNITY_RESOLVED_COLOR,
} from './reportMarkersLayer';

/** A minimal, Mapbox-compatible image: RGBA pixels + dimensions. */
export interface MarkerImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, `width*height*4` bytes. */
  readonly data: Uint8Array | Uint8ClampedArray;
}

/** Icon id prefix so all community marker images share a namespace. */
export const COMMUNITY_ICON_PREFIX = 'community-report-marker';
/** The confirmation badge background icon id. */
export const COMMUNITY_BADGE_ICON_ID = 'community-report-badge';
/** The invisible/transparent click hit-target icon id. */
export const COMMUNITY_HITBOX_ICON_ID = 'community-report-hitbox';

/** The icon id for a given depth key (or the resolved variant). */
export function communityIconId(depthKey: string): string {
  return `${COMMUNITY_ICON_PREFIX}-${depthKey.toLowerCase()}`;
}

/** The depth → icon-id map used by the symbol layer's icon-image expression. */
export const COMMUNITY_DEPTH_ICON_KEYS = [
  'ANKLE',
  'KNEE',
  'WAIST',
  'ABOVE_WAIST',
  'UNKNOWN',
  'RESOLVED',
] as const;
export type CommunityIconKey = (typeof COMMUNITY_DEPTH_ICON_KEYS)[number];

/** Fill color for an icon key (depth ramp + muted resolved). */
function iconFill(key: CommunityIconKey): string {
  if (key === 'RESOLVED') return COMMUNITY_RESOLVED_COLOR;
  return COMMUNITY_DEPTH_COLORS[key];
}

/** Parses a `#rrggbb` hex to [r,g,b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Draws one teardrop pin icon into an RGBA buffer. The pin is a circle body
 * tapering to a point at the bottom, with a thick white border and a simple
 * white 3-hump water wave across the middle. Pure math (no canvas), so it is
 * deterministic and testable in jsdom.
 *
 * @param size - Icon width in px (height is 1.3× for the teardrop tail).
 * @param fillHex - Pin body fill color.
 */
export function buildPinImage(size: number, fillHex: string): MarkerImage {
  const w = size;
  const h = Math.round(size * 1.3);
  const data = new Uint8ClampedArray(w * h * 4);
  const [fr, fg, fb] = hexToRgb(fillHex);

  const cx = w / 2;
  const cy = w / 2; // circle center near the top
  const r = w / 2 - 1; // body radius (leave 1px margin)
  const border = Math.max(2, Math.round(size * 0.12)); // white border thickness
  const tipY = h - 1; // teardrop tip at the bottom

  const setPx = (x: number, y: number, rr: number, gg: number, bb: number, aa: number): void => {
    const i = (y * w + x) * 4;
    data[i] = rr;
    data[i + 1] = gg;
    data[i + 2] = bb;
    data[i + 3] = aa;
  };

  // Wave band geometry (a thin horizontal zone across the circle middle).
  const waveTop = cy - size * 0.06;
  const waveBot = cy + size * 0.1;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const inCircle = dx * dx + dy * dy <= r * r;

      // Teardrop tail: a downward triangle from the circle to the tip.
      const tailHalfWidth = (1 - (y - cy) / (tipY - cy)) * r;
      const inTail = y >= cy && Math.abs(dx) <= Math.max(0, tailHalfWidth);

      const inside = inCircle || inTail;
      if (!inside) continue;

      // Border: outer ring of the circle (and tail edges) painted white.
      const distEdge = r - Math.sqrt(dx * dx + dy * dy);
      const nearCircleEdge = inCircle && distEdge <= border;
      const nearTailEdge =
        inTail && Math.abs(Math.abs(dx) - Math.max(0, tailHalfWidth)) <= border * 0.8;

      if (nearCircleEdge || nearTailEdge) {
        setPx(x, y, 255, 255, 255, 255);
        continue;
      }

      // Water-wave glyph: three white humps across the mid band.
      if (y >= waveTop && y <= waveBot) {
        const phase = ((x - (cx - r)) / (2 * r)) * Math.PI * 3; // 3 humps
        const humpY = cy + Math.sin(phase) * (size * 0.07);
        if (Math.abs(y - humpY) <= Math.max(1, size * 0.05)) {
          setPx(x, y, 255, 255, 255, 255);
          continue;
        }
      }

      // Body fill.
      setPx(x, y, fr, fg, fb, 255);
    }
  }

  return { width: w, height: h, data };
}

/** Builds the small circular badge-background icon (solid dark disc + white ring). */
export function buildBadgeImage(size = 20): MarkerImage {
  const w = size;
  const h = size;
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 1;
  const ring = Math.max(1.5, size * 0.12);
  // Badge disc color: a strong dark slate so white digits read on top.
  const [br, bg, bb] = hexToRgb('#1f2937');
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      const i = (y * w + x) * 4;
      if (r - d <= ring) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      } else {
        data[i] = br;
        data[i + 1] = bg;
        data[i + 2] = bb;
        data[i + 3] = 255;
      }
    }
  }
  return { width: w, height: h, data };
}

/** A fully transparent square icon used as a forgiving click hit-target. */
export function buildHitboxImage(size = 44): MarkerImage {
  return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
}

/**
 * Images are drawn at 2× resolution: the default pin displays at 32×42 CSS
 * pixels, the badge at 20px, and the forgiving tap target at 48×48px.
 */
export function buildAllCommunityImages(size = 64): Array<{ id: string; image: MarkerImage }> {
  const out: Array<{ id: string; image: MarkerImage }> = [];
  for (const key of COMMUNITY_DEPTH_ICON_KEYS) {
    out.push({ id: communityIconId(key), image: buildPinImage(size, iconFill(key)) });
  }
  out.push({ id: COMMUNITY_BADGE_ICON_ID, image: buildBadgeImage(Math.round(size * 0.625)) });
  out.push({ id: COMMUNITY_HITBOX_ICON_ID, image: buildHitboxImage(Math.round(size * 1.5)) });
  return out;
}

/** The minimal map surface for registering/reusing images (Mapbox-compatible). */
export interface ImageRegistryMap {
  hasImage(id: string): boolean;
  addImage(id: string, image: MarkerImage, options?: { pixelRatio?: number }): void;
}

/**
 * Registers every community marker image with the map, guarded by `hasImage` so
 * a style reload that already restored an image never triggers a duplicate-image
 * exception. Idempotent and safe to call again after `styledata`/`style.load`.
 */
export function registerCommunityImages(map: ImageRegistryMap, size = 64): void {
  for (const { id, image } of buildAllCommunityImages(size)) {
    if (map.hasImage(id)) continue;
    map.addImage(id, image, { pixelRatio: 2 });
  }
}
