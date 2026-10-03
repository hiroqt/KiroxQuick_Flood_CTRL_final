// src/services/floodEvidenceAgent.ts
//
// The AI Flood Evidence Agent (MVP). It turns raw GDELT articles into
// normalized {@link FloodEvidence}, geocodes each to NCR where possible, maps
// the coordinate to a barangay (reusing the existing point-in-polygon
// resolver), deduplicates, and assigns a DETERMINISTIC confidence.
//
// IMPORTANT boundaries (product constitution):
//   - The AI/agent NEVER decides the final BahaRoute current-risk class. It
//     produces evidence + a transparent, rule-based confidence only.
//   - AI/news/community evidence can NEVER become a CONFIRMED_CLOSURE. There is
//     no path from here to the OfficialStatus provider.
//   - If geocoding fails, the evidence is KEPT, marked location-unresolved, and
//     NOT assigned to a barangay (so it cannot affect barangay risk).
//   - "Extraction" here is deterministic keyword/location parsing — not an LLM
//     call — so there is no secret key and no network beyond GDELT. The
//     interface accepts an injectable extractor so a server-side LLM proxy can
//     be slotted in later WITHOUT exposing keys in the browser.

import type { GdeltArticle } from './gdeltService';
import { parseSeenDate } from './gdeltService';
import { resolveBarangayForPoint } from './reportResolution';
import { isWithinNCR } from './ncrPlaces';
import { ncrCityInfos } from '../data/geojson/ncrCityContext';
import { NCR_PLACES } from './ncrPlaces';
import { barangayInfoByPsgc } from '../data/geojson/ncrBarangays';
import { makeProvenance } from '../types/provenance';
import {
  type FloodEvidence,
  type FloodEventType,
  type EvidenceSourceType,
  type CorroborationSignal,
  assignEvidenceConfidence,
  evidenceStatusFor,
} from '../types/evidence';

/** A geocode result: a coordinate inside NCR plus optional city label. */
export interface GeocodeHit {
  readonly coordinates: readonly [number, number];
  readonly city?: string;
}

/**
 * A pluggable forward-geocoder: location text → NCR coordinate or null. The
 * default is a LOCAL gazetteer (no network, no key). A real Mapbox forward
 * geocoder can be injected here; callers must gate its output with
 * {@link isWithinNCR} (done inside {@link resolveLocation}).
 */
export type ForwardGeocoder = (locationText: string) => GeocodeHit | null;

/** Normalizes text for case/diacritic-insensitive matching. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * The default local gazetteer geocoder. Matches a known NCR LGU or curated
 * landmark name mentioned in the text and returns its label point. No network,
 * no API key. Returns null when nothing recognizable is mentioned — in which
 * case the evidence stays location-unresolved (never force-assigned).
 */
export const localGazetteerGeocoder: ForwardGeocoder = (locationText) => {
  const hay = norm(locationText);
  if (hay.length === 0) return null;

  // Prefer specific landmarks first (more precise), then LGUs.
  for (const place of NCR_PLACES) {
    if (place.kind !== 'landmark') continue;
    if (hay.includes(norm(place.name))) {
      return { coordinates: place.coord, city: place.area };
    }
  }
  for (const city of ncrCityInfos) {
    if (hay.includes(norm(city.name))) {
      return { coordinates: city.labelPoint, city: city.name };
    }
  }
  return null;
};

/**
 * Resolves location text to an NCR coordinate using the supplied geocoder,
 * gating the result with {@link isWithinNCR}. Returns null when unresolved or
 * out of NCR scope — the agent then keeps the evidence as location-unresolved.
 */
export function resolveLocation(
  locationText: string,
  geocoder: ForwardGeocoder,
): GeocodeHit | null {
  const hit = geocoder(locationText);
  if (!hit) return null;
  const [lng, lat] = hit.coordinates;
  if (!isWithinNCR(lng, lat)) return null;
  return hit;
}

/**
 * Deterministically classifies the flood event type from a headline/summary.
 * Order matters: more specific/severe phrasings win. This is explainable and
 * testable — no model inference.
 */
export function classifyEventType(text: string): FloodEventType {
  const t = norm(text);
  if (/(road\s+clos|impassable|not passable|closed to traffic)/.test(t)) {
    return 'ROAD_CLOSED';
  }
  if (/(road\s+flood|street\s+flood|highway\s+flood|flooded road)/.test(t)) {
    return 'ROAD_FLOODED';
  }
  if (/(advisory|warning|alert|watch)/.test(t)) return 'FLOOD_ADVISORY';
  if (/(flood|baha|submerged|inundat)/.test(t)) return 'FLOODING';
  if (/(heavy rain|downpour|torrential|monsoon|habagat)/.test(t)) {
    return 'HEAVY_RAIN';
  }
  // Default: it matched the flood query, so treat as generic flooding.
  return 'FLOODING';
}

/**
 * Infers the source type from the article domain. Philippine official/government
 * domains map to OFFICIAL; everything else that is a news domain is NEWS. GDELT
 * does not surface community posts, so COMMUNITY is reserved for other inputs
 * (e.g. demo fixtures or a future community feed).
 */
export function inferSourceType(domain: string): EvidenceSourceType {
  const d = norm(domain);
  if (/\.gov(\.ph)?$/.test(d) || d.includes('pagasa') || d.includes('ndrrmc')) {
    return 'OFFICIAL';
  }
  return 'NEWS';
}

/** Options for {@link buildEvidenceFromArticles}. */
export interface BuildEvidenceOptions {
  /** Forward geocoder. Defaults to the local gazetteer (no network/key). */
  readonly geocoder?: ForwardGeocoder;
  /** Reference time (epoch ms) for TTL/staleness. Defaults to wall clock. */
  readonly now?: number;
}

/** A short, neutral area key for corroboration (barangay PSGC or city). */
function areaKeyFor(psgc: string | undefined, city: string | undefined): string | null {
  if (psgc) return `b:${psgc}`;
  if (city && city.trim().length > 0) return `c:${norm(city)}`;
  return null;
}

/**
 * Normalizes GDELT articles into deduplicated, geocoded, confidence-assigned
 * {@link FloodEvidence}. Pure given its inputs (geocoder + now injectable).
 *
 * Steps per spec: classify event → infer source → geocode (gated to NCR) →
 * resolve barangay via point-in-polygon → dedup by URL → assign deterministic
 * confidence from the corroboration rule → set ACTIVE/STALE by TTL.
 */
export function buildEvidenceFromArticles(
  articles: readonly GdeltArticle[],
  opts: BuildEvidenceOptions = {},
): FloodEvidence[] {
  const geocoder = opts.geocoder ?? localGazetteerGeocoder;
  const now = opts.now ?? Date.now();

  // 1) Dedup raw articles by canonical URL (keep the first/newest occurrence).
  const seenUrls = new Set<string>();
  const unique: GdeltArticle[] = [];
  for (const a of articles) {
    const key = a.url.trim().toLowerCase();
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);
    unique.push(a);
  }

  // 2) Pre-pass: geocode + classify so we can compute corroboration signals.
  interface Draft {
    article: GdeltArticle;
    eventType: FloodEventType;
    sourceType: EvidenceSourceType;
    publishedAtMs: number | null;
    hit: GeocodeHit | null;
    psgc: string | undefined;
    barangay: string | undefined;
  }
  const drafts: Draft[] = unique.map((article) => {
    const text = article.title;
    const eventType = classifyEventType(text);
    const sourceType = inferSourceType(article.domain);
    const publishedAtMs = parseSeenDate(article.seendate);
    const hit = resolveLocation(text, geocoder);
    let psgc: string | undefined;
    let barangay: string | undefined;
    if (hit) {
      const [lng, lat] = hit.coordinates;
      const resolved = resolveBarangayForPoint(lng, lat);
      if (resolved) {
        psgc = resolved;
        barangay = barangayInfoByPsgc.get(resolved)?.name;
      }
    }
    return { article, eventType, sourceType, publishedAtMs, hit, psgc, barangay };
  });

  // 3) Corroboration signals (independence by domain, area by PSGC/city).
  const signals: CorroborationSignal[] = drafts.map((d) => ({
    sourceKey: norm(d.article.domain) || norm(d.article.url),
    sourceType: d.sourceType,
    areaKey: areaKeyFor(d.psgc, d.hit?.city),
    publishedAtMs: d.publishedAtMs,
  }));

  // 4) Assemble normalized evidence.
  return drafts.map((d, i) => {
    const confidence = assignEvidenceConfidence(signals[i], signals);
    const status = evidenceStatusFor(d.sourceType, d.publishedAtMs, now);
    const locationUnresolved = d.hit === null;
    const publishedIso =
      d.publishedAtMs !== null ? new Date(d.publishedAtMs).toISOString() : undefined;

    return {
      id: `gdelt:${d.article.url}`,
      eventType: d.eventType,
      locationText: d.hit?.city ?? deriveLocationText(d.article.title),
      city: d.hit?.city,
      barangay: d.barangay,
      psgc: d.psgc,
      coordinates: d.hit?.coordinates,
      locationUnresolved,
      summary: d.article.title,
      sourceName: d.article.domain || hostOf(d.article.url),
      sourceUrl: d.article.url,
      sourceType: d.sourceType,
      confidence,
      publishedAt: publishedIso,
      observedAt: publishedIso,
      status,
      isSynthetic: false,
      provenance: makeProvenance('AI_WEB_EVIDENCE', {
        sourceName: d.article.domain || hostOf(d.article.url),
        sourceUrl: d.article.url,
        publishedAt: publishedIso,
        observedAt: publishedIso,
        isSynthetic: false,
      }),
    } satisfies FloodEvidence;
  });
}

/** Best-effort hostname for a URL (no throw). */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown source';
  }
}

/** A short fallback location descriptor when geocoding did not resolve. */
function deriveLocationText(title: string): string {
  return title.length > 60 ? `${title.slice(0, 57)}…` : title;
}

/**
 * Convenience: evidence that resolved to a specific barangay PSGC. Used by the
 * UI and route integration to count only location-resolved evidence per area.
 */
export function evidenceByBarangay(
  evidence: readonly FloodEvidence[],
): Map<string, FloodEvidence[]> {
  const out = new Map<string, FloodEvidence[]>();
  for (const e of evidence) {
    if (!e.psgc) continue;
    const list = out.get(e.psgc) ?? [];
    list.push(e);
    out.set(e.psgc, list);
  }
  return out;
}
