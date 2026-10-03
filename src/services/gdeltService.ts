// src/services/gdeltService.ts
//
// GDELT DOC 2.0 discovery source for the AI Flood Evidence Agent (MVP first
// external source). GDELT is a free, key-less, public research API, so it can
// be called directly from the browser — no secret key is involved (see
// docs/API-key handling in the final report). This module ONLY fetches and
// NORMALIZES raw article metadata into a stable shape; extraction, geocoding,
// confidence, and dedup live in floodEvidenceAgent.ts.
//
// Design mirrors the existing rainfallService resilience contract:
//   - injectable FetchLike (no network in tests),
//   - single-flight (shared in-flight promise),
//   - cache + TTL (reuse a recent batch instead of re-fetching),
//   - capped exponential backoff on consecutive failures,
//   - NEVER throws to callers; a failure yields an empty batch, not an error.

import type { FetchLike } from './rainfallService';

/** GDELT DOC 2.0 ArtList endpoint (JSON). No API key required. */
export const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

/**
 * Default flood query scoped to the Philippines. GDELT indexes `sourcecountry`
 * and location mentions; this keeps the batch small and relevant. The agent
 * further filters to NCR via geocoding/point-in-polygon downstream.
 */
export const GDELT_DEFAULT_QUERY =
  '(flood OR flooding OR "baha" OR "road closed" OR "impassable") sourcecountry:philippines';

/** GDELT poll interval (ms). Lightweight per spec: every 15 minutes. */
export const GDELT_POLL_INTERVAL_MS = 15 * 60 * 1000;

/** How long a successful batch is reused before a refetch (ms). */
export const GDELT_FRESH_TTL_MS = 10 * 60 * 1000;

/** Base + ceiling for capped exponential backoff across failures (ms). */
export const GDELT_BACKOFF_BASE_MS = 60 * 1000;
export const GDELT_BACKOFF_MAX_MS = 30 * 60 * 1000;

/** Max articles requested per batch (keep the payload small). */
export const GDELT_MAX_RECORDS = 50;

/** One raw GDELT article as we consume it (only the fields we use). */
export interface GdeltArticle {
  readonly url: string;
  readonly title: string;
  readonly domain: string;
  /** Raw `seendate` as returned, e.g. "20260103T124500Z". */
  readonly seendate: string;
  readonly language?: string;
  readonly sourcecountry?: string;
}

/** The outcome of one fetch: the articles plus whether the call succeeded. */
export interface GdeltFetchResult {
  readonly articles: readonly GdeltArticle[];
  readonly ok: boolean;
}

/** The raw JSON shape GDELT returns (subset). */
interface GdeltRawResponse {
  articles?: Array<{
    url?: unknown;
    title?: unknown;
    domain?: unknown;
    seendate?: unknown;
    language?: unknown;
    sourcecountry?: unknown;
  }>;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Parses a GDELT `seendate` ("YYYYMMDDTHHMMSSZ") into epoch ms, or null when it
 * is missing/unparseable. Never throws.
 */
export function parseSeenDate(seendate: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Normalizes a raw GDELT response body into clean {@link GdeltArticle}s.
 * Articles without a usable url+title are dropped. Pure and total; never throws
 * (callers hand it already-parsed JSON of unknown shape).
 */
export function normalizeGdeltResponse(body: unknown): GdeltArticle[] {
  const raw = (body ?? {}) as GdeltRawResponse;
  const list = Array.isArray(raw.articles) ? raw.articles : [];
  const out: GdeltArticle[] = [];
  for (const a of list) {
    const url = str(a?.url).trim();
    const title = str(a?.title).trim();
    if (url.length === 0 || title.length === 0) continue;
    out.push({
      url,
      title,
      domain: str(a?.domain).trim(),
      seendate: str(a?.seendate).trim(),
      language: str(a?.language).trim() || undefined,
      sourcecountry: str(a?.sourcecountry).trim() || undefined,
    });
  }
  return out;
}

/** Builds the GDELT DOC ArtList request URL for a query. */
export function buildGdeltUrl(query: string, maxRecords = GDELT_MAX_RECORDS): string {
  const params = new URLSearchParams({
    query,
    mode: 'ArtList',
    format: 'json',
    maxrecords: String(maxRecords),
    sort: 'datedesc',
  });
  return `${GDELT_DOC_API}?${params.toString()}`;
}

/**
 * Fetches one batch of recent flood articles from GDELT. Returns
 * `{ articles, ok }`; on ANY failure (no fetch impl, non-OK status, bad body,
 * network/abort) it returns `{ articles: [], ok: false }` and NEVER throws, so
 * the agent degrades to "evidence agent unavailable" without breaking the app.
 */
export async function fetchGdeltArticles(
  query: string = GDELT_DEFAULT_QUERY,
  fetchImpl?: FetchLike,
  opts: { signal?: AbortSignal; maxRecords?: number } = {},
): Promise<GdeltFetchResult> {
  const impl = fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (!impl) return { articles: [], ok: false };
  try {
    const res = await impl(buildGdeltUrl(query, opts.maxRecords), {
      signal: opts.signal,
    });
    if (!res.ok) return { articles: [], ok: false };
    const body = await res.json();
    return { articles: normalizeGdeltResponse(body), ok: true };
  } catch {
    return { articles: [], ok: false };
  }
}

/**
 * A stateful, resilient GDELT fetcher: caches the last successful batch, reuses
 * it within {@link GDELT_FRESH_TTL_MS}, dedupes concurrent refreshes into one
 * in-flight promise, and applies capped exponential backoff after failures.
 * Mirrors the RainfallService resilience contract and never throws.
 */
export class GdeltService {
  private cache: readonly GdeltArticle[] = [];
  private lastSuccessAt: number | null = null;
  private lastAttemptAt = 0;
  private consecutiveFailures = 0;
  private inFlight: Promise<GdeltFetchResult> | null = null;
  /** True once at least one fetch has FAILED with no prior success. */
  private unavailable = false;

  constructor(
    private readonly query: string = GDELT_DEFAULT_QUERY,
    private readonly fetchImpl?: FetchLike,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** The last successfully fetched articles (empty until first success). */
  articles(): readonly GdeltArticle[] {
    return this.cache;
  }

  /** Epoch ms of the last successful fetch, or null. */
  lastUpdated(): number | null {
    return this.lastSuccessAt;
  }

  /**
   * True when the agent is currently unavailable: at least one fetch failed and
   * there is no cached batch to fall back on. The UI uses this to show
   * "Evidence agent unavailable" without failing the map.
   */
  isUnavailable(): boolean {
    return this.unavailable && this.cache.length === 0;
  }

  private isFresh(): boolean {
    return (
      this.lastSuccessAt !== null &&
      this.now() - this.lastAttemptAt < GDELT_FRESH_TTL_MS
    );
  }

  private backoffUntil(): number {
    if (this.consecutiveFailures === 0) return 0;
    const delay = Math.min(
      GDELT_BACKOFF_MAX_MS,
      GDELT_BACKOFF_BASE_MS * 2 ** (this.consecutiveFailures - 1),
    );
    return this.lastAttemptAt + delay;
  }

  /**
   * Ensures a reasonably fresh batch without forcing a request: reuses the
   * cache when fresh, otherwise refreshes (respecting backoff).
   */
  async ensureFresh(signal?: AbortSignal): Promise<readonly GdeltArticle[]> {
    if (this.isFresh()) return this.cache;
    if (this.now() < this.backoffUntil()) return this.cache;
    await this.refresh(signal);
    return this.cache;
  }

  /**
   * Forces one refresh. Single-flight: concurrent callers share ONE promise. On
   * success the cache + timestamp update and backoff resets; on failure the
   * previous cache is retained and the failure count grows. Never throws.
   */
  async refresh(signal?: AbortSignal): Promise<GdeltFetchResult> {
    if (this.inFlight) return this.inFlight;
    const run = this.runRefresh(signal);
    this.inFlight = run;
    try {
      return await run;
    } finally {
      if (this.inFlight === run) this.inFlight = null;
    }
  }

  private async runRefresh(signal?: AbortSignal): Promise<GdeltFetchResult> {
    this.lastAttemptAt = this.now();
    const result = await fetchGdeltArticles(this.query, this.fetchImpl, { signal });
    if (result.ok) {
      this.cache = result.articles;
      this.lastSuccessAt = this.now();
      this.consecutiveFailures = 0;
      this.unavailable = false;
    } else {
      this.consecutiveFailures += 1;
      if (this.lastSuccessAt === null) this.unavailable = true;
    }
    return result;
  }
}
