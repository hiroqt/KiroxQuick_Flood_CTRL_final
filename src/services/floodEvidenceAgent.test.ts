// src/services/floodEvidenceAgent.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildEvidenceFromArticles,
  classifyEventType,
  inferSourceType,
  resolveLocation,
  localGazetteerGeocoder,
  evidenceByBarangay,
  type ForwardGeocoder,
} from './floodEvidenceAgent';
import type { GdeltArticle } from './gdeltService';
import { resolveBarangayForPoint } from './reportResolution';

function article(over: Partial<GdeltArticle> = {}): GdeltArticle {
  return {
    url: 'https://news.example/1',
    title: 'Flooding reported along Marikina riverbanks',
    domain: 'news.example',
    seendate: '20260103T120000Z',
    ...over,
  };
}

describe('classifyEventType (deterministic, no LLM)', () => {
  it('classifies road closure, road flooding, advisory, heavy rain, generic flood', () => {
    expect(classifyEventType('EDSA road closed due to flood')).toBe('ROAD_CLOSED');
    expect(classifyEventType('Highway flooded in Pasig')).toBe('ROAD_FLOODED');
    expect(classifyEventType('PAGASA flood advisory issued')).toBe('FLOOD_ADVISORY');
    expect(classifyEventType('Heavy rain / habagat soaks Metro')).toBe('HEAVY_RAIN');
    expect(classifyEventType('Baha reported in several areas')).toBe('FLOODING');
  });
});

describe('inferSourceType', () => {
  it('maps .gov / PAGASA / NDRRMC domains to OFFICIAL, else NEWS', () => {
    expect(inferSourceType('ndrrmc.gov.ph')).toBe('OFFICIAL');
    expect(inferSourceType('bagong.pagasa.dost.gov.ph')).toBe('OFFICIAL');
    expect(inferSourceType('gmanews.tv')).toBe('NEWS');
  });
});

describe('geocoding + point-in-polygon assignment', () => {
  it('resolves a known NCR landmark/LGU and maps it to a barangay (PIP)', () => {
    const hit = resolveLocation('Flooding near Marikina Sports Center', localGazetteerGeocoder);
    expect(hit).not.toBeNull();
    const [lng, lat] = hit!.coordinates;
    // The coordinate must resolve to an actual NCR barangay via point-in-polygon.
    expect(resolveBarangayForPoint(lng, lat)).not.toBeNull();
  });

  it('keeps evidence but marks it unresolved when geocoding fails', () => {
    const evidence = buildEvidenceFromArticles([
      article({ title: 'Flooding somewhere unrecognizable xyzzy' }),
    ]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].locationUnresolved).toBe(true);
    expect(evidence[0].psgc).toBeUndefined();
    expect(evidence[0].coordinates).toBeUndefined();
  });

  it('rejects coordinates outside NCR (never force-assigns)', () => {
    const cebu: ForwardGeocoder = () => ({ coordinates: [123.885, 10.315], city: 'Cebu' });
    expect(resolveLocation('Flooding in Cebu', cebu)).toBeNull();
  });

  it('does not assign a barangay to location-unresolved evidence', () => {
    const evidence = buildEvidenceFromArticles([
      article({ title: 'General flooding advisory xyzzy', url: 'https://news.example/u' }),
    ]);
    expect(evidenceByBarangay(evidence).size).toBe(0);
  });
});

describe('deduplication', () => {
  it('dedupes articles by URL', () => {
    const evidence = buildEvidenceFromArticles([
      article({ url: 'https://news.example/dup', title: 'Flooding in Marikina' }),
      article({ url: 'https://news.example/dup', title: 'Flooding in Marikina (repost)' }),
    ]);
    expect(evidence).toHaveLength(1);
  });
});

describe('corroboration via the agent', () => {
  it('two independent domains, same area → CORROBORATED', () => {
    const now = Date.UTC(2026, 0, 3, 12, 30, 0);
    const evidence = buildEvidenceFromArticles(
      [
        article({ url: 'https://a.example/1', domain: 'a.example', title: 'Flooding in Marikina', seendate: '20260103T120000Z' }),
        article({ url: 'https://b.example/2', domain: 'b.example', title: 'Flooding in Marikina', seendate: '20260103T121000Z' }),
      ],
      { now },
    );
    expect(evidence).toHaveLength(2);
    expect(evidence.every((e) => e.confidence === 'CORROBORATED')).toBe(true);
  });

  it('a single news item stays UNVERIFIED and is never a closure', () => {
    const evidence = buildEvidenceFromArticles([
      article({ url: 'https://a.example/solo', domain: 'a.example', title: 'Flooding in Marikina' }),
    ]);
    expect(evidence[0].confidence).toBe('UNVERIFIED');
    expect(evidence[0].sourceType).toBe('NEWS');
  });
});

describe('provenance + timestamps on built evidence', () => {
  it('every evidence item is AI_WEB_EVIDENCE provenance, non-synthetic, with a timestamp', () => {
    const evidence = buildEvidenceFromArticles([article()]);
    expect(evidence[0].provenance.origin).toBe('AI_WEB_EVIDENCE');
    expect(evidence[0].isSynthetic).toBe(false);
    expect(evidence[0].publishedAt).toBe(new Date(Date.UTC(2026, 0, 3, 12, 0, 0)).toISOString());
  });
});
