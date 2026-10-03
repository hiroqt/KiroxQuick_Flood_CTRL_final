// src/layers/communityReportIcon.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  buildPinImage,
  buildBadgeImage,
  buildHitboxImage,
  buildAllCommunityImages,
  registerCommunityImages,
  communityIconId,
  COMMUNITY_BADGE_ICON_ID,
  COMMUNITY_HITBOX_ICON_ID,
  COMMUNITY_DEPTH_ICON_KEYS,
  type ImageRegistryMap,
} from './communityReportIcon';

describe('community report icon generation (deterministic, no emoji/font)', () => {
  it('builds an RGBA pin image with correct buffer size and some opaque pixels', () => {
    const img = buildPinImage(28, '#ef8a3c');
    expect(img.width).toBe(28);
    expect(img.height).toBe(Math.round(28 * 1.3));
    expect(img.data.length).toBe(img.width * img.height * 4);
    // The pin body must have painted (opaque) pixels.
    let opaque = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) opaque += 1;
    expect(opaque).toBeGreaterThan(0);
  });

  it('builds a badge image and a fully transparent hitbox image', () => {
    const badge = buildBadgeImage(20);
    expect(badge.data.length).toBe(20 * 20 * 4);
    const hit = buildHitboxImage(44);
    // Hitbox is fully transparent (every alpha byte is 0).
    let maxAlpha = 0;
    for (let i = 3; i < hit.data.length; i += 4) maxAlpha = Math.max(maxAlpha, hit.data[i]);
    expect(maxAlpha).toBe(0);
  });

  it('produces one image per depth key + resolved, plus badge + hitbox', () => {
    const all = buildAllCommunityImages(28);
    const ids = all.map((a) => a.id);
    for (const key of COMMUNITY_DEPTH_ICON_KEYS) {
      expect(ids).toContain(communityIconId(key));
    }
    expect(ids).toContain(COMMUNITY_BADGE_ICON_ID);
    expect(ids).toContain(COMMUNITY_HITBOX_ICON_ID);
  });
});

describe('registerCommunityImages (hasImage-guarded, idempotent)', () => {
  function fakeMap() {
    const images = new Set<string>();
    const addImage = vi.fn((id: string) => images.add(id));
    const hasImage = vi.fn((id: string) => images.has(id));
    const map: ImageRegistryMap = { addImage: addImage as unknown as ImageRegistryMap['addImage'], hasImage };
    return { map, images, addImage, hasImage };
  }

  it('registers every image once', () => {
    const { map, addImage } = fakeMap();
    registerCommunityImages(map);
    const expected = buildAllCommunityImages().length;
    expect(addImage).toHaveBeenCalledTimes(expected);
  });

  it('does NOT re-add images that already exist (style-reload safe)', () => {
    const { map, addImage } = fakeMap();
    registerCommunityImages(map); // first registration
    const firstCount = addImage.mock.calls.length;
    registerCommunityImages(map); // simulate a style reload re-register
    // No duplicate addImage calls on the second pass.
    expect(addImage.mock.calls.length).toBe(firstCount);
  });

  it('registers with pixelRatio 2 for crisp high-DPI rendering', () => {
    const { map, addImage } = fakeMap();
    registerCommunityImages(map);
    const opts = (addImage.mock.calls[0] as unknown[])[2] as { pixelRatio?: number };
    expect(opts?.pixelRatio).toBe(2);
  });
});
