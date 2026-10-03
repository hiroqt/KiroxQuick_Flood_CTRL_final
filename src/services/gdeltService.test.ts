// src/services/gdeltService.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  normalizeGdeltResponse,
  parseSeenDate,
  buildGdeltUrl,
  fetchGdeltArticles,
  GdeltService,
  GDELT_DOC_API,
} from './gdeltService';
import type { FetchLike } from './rainfallService';

/** A FetchLike that returns the given body with ok=true. */
function okFetch(body: unknown): FetchLike {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
}

/** A FetchLike that fails (non-OK). */
function failFetch(): FetchLike {
  return vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
}

describe('normalizeGdeltResponse', () => {
  it('keeps articles with url+title and drops malformed ones', () => {
    const out = normalizeGdeltResponse({
      articles: [
        { url: 'https://a.test/1', title: 'Flood in Manila', domain: 'a.test', seendate: '20260103T120000Z' },
        { url: '', title: 'no url' },
        { url: 'https://b.test/2', title: '' },
        { title: 'no url field' },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://a.test/1');
    expect(out[0].domain).toBe('a.test');
  });

  it('never throws on a non-object / empty body', () => {
    expect(normalizeGdeltResponse(null)).toEqual([]);
    expect(normalizeGdeltResponse(undefined)).toEqual([]);
    expect(normalizeGdeltResponse({})).toEqual([]);
    expect(normalizeGdeltResponse({ articles: 'nope' })).toEqual([]);
  });
});

describe('parseSeenDate', () => {
  it('parses the GDELT YYYYMMDDTHHMMSSZ format to epoch ms', () => {
    expect(parseSeenDate('20260103T120000Z')).toBe(Date.UTC(2026, 0, 3, 12, 0, 0));
  });
  it('returns null for a malformed date', () => {
    expect(parseSeenDate('not-a-date')).toBeNull();
    expect(parseSeenDate('')).toBeNull();
  });
});

describe('buildGdeltUrl', () => {
  it('targets the DOC ArtList JSON endpoint', () => {
    const url = buildGdeltUrl('flood');
    expect(url.startsWith(GDELT_DOC_API)).toBe(true);
    expect(url).toContain('mode=ArtList');
    expect(url).toContain('format=json');
  });
});

describe('fetchGdeltArticles fallback (never throws)', () => {
  it('returns ok=false and [] when the fetch fails', async () => {
    const r = await fetchGdeltArticles('flood', failFetch());
    expect(r.ok).toBe(false);
    expect(r.articles).toEqual([]);
  });

  it('returns ok=false when no fetch impl is available (no network)', async () => {
    const original = globalThis.fetch;
    // Remove the global so the fallback has nothing to call — must not hit the
    // network and must resolve to ok=false.
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      const r = await fetchGdeltArticles('flood', undefined);
      expect(r.ok).toBe(false);
      expect(r.articles).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('returns ok=true with normalized articles on success', async () => {
    const r = await fetchGdeltArticles(
      'flood',
      okFetch({ articles: [{ url: 'https://a.test/1', title: 'Flooding' }] }),
    );
    expect(r.ok).toBe(true);
    expect(r.articles).toHaveLength(1);
  });
});

describe('GdeltService resilience (single-flight, cache, availability)', () => {
  it('dedupes concurrent refreshes into one fetch', async () => {
    const fetchImpl = okFetch({ articles: [{ url: 'https://a.test/1', title: 'Flood' }] });
    const svc = new GdeltService('flood', fetchImpl);
    await Promise.all([svc.refresh(), svc.refresh(), svc.refresh()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(svc.articles()).toHaveLength(1);
  });

  it('reuses the cache within the fresh TTL (no second fetch)', async () => {
    let clock = 1_000_000;
    const fetchImpl = okFetch({ articles: [{ url: 'https://a.test/1', title: 'Flood' }] });
    const svc = new GdeltService('flood', fetchImpl, () => clock);
    await svc.ensureFresh();
    clock += 60_000; // within GDELT_FRESH_TTL_MS (10 min)
    await svc.ensureFresh();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('is unavailable after a failure with no prior success, and recovers', async () => {
    const svc = new GdeltService('flood', failFetch());
    await svc.refresh();
    expect(svc.isUnavailable()).toBe(true);

    const good = new GdeltService(
      'flood',
      okFetch({ articles: [{ url: 'https://a.test/1', title: 'Flood' }] }),
    );
    await good.refresh();
    expect(good.isUnavailable()).toBe(false);
  });

  it('retains the previous cache when a later refresh fails (not unavailable)', async () => {
    let fail = false;
    const fetchImpl: FetchLike = vi.fn(async () =>
      fail
        ? { ok: false, status: 503, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ articles: [{ url: 'https://a.test/1', title: 'Flood' }] }) },
    );
    let clock = 0;
    const svc = new GdeltService('flood', fetchImpl, () => clock);
    await svc.refresh();
    expect(svc.articles()).toHaveLength(1);
    fail = true;
    clock += 11 * 60 * 1000; // past fresh TTL so a new attempt runs
    await svc.refresh();
    // Cache retained; not flagged unavailable because we have prior data.
    expect(svc.articles()).toHaveLength(1);
    expect(svc.isUnavailable()).toBe(false);
  });
});
