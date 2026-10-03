// src/types/provenance.test.ts
import { describe, it, expect } from 'vitest';
import {
  makeProvenance,
  isSyntheticProvenance,
  DATA_ORIGIN_LABEL,
  DATA_ORIGIN_QUALIFIER,
  type DataOrigin,
} from './provenance';

const ORIGINS: DataOrigin[] = [
  'LIVE_RAINFALL',
  'COMMUNITY_REPORT',
  'AI_WEB_EVIDENCE',
  'OFFICIAL',
  'HISTORICAL',
  'DEMO',
];

describe('provenance classification', () => {
  it('provides a label + qualifier for every origin (no blurred categories)', () => {
    for (const origin of ORIGINS) {
      expect(DATA_ORIGIN_LABEL[origin]).toBeTruthy();
      expect(DATA_ORIGIN_QUALIFIER[origin]).toBeTruthy();
    }
  });

  it('defaults isSynthetic to true ONLY for the DEMO origin', () => {
    expect(makeProvenance('DEMO').isSynthetic).toBe(true);
    for (const origin of ORIGINS.filter((o) => o !== 'DEMO')) {
      expect(makeProvenance(origin).isSynthetic).toBe(false);
    }
  });

  it('lets a non-demo origin be explicitly flagged synthetic (e.g. a demo report)', () => {
    const p = makeProvenance('COMMUNITY_REPORT', { isSynthetic: true });
    expect(p.origin).toBe('COMMUNITY_REPORT');
    expect(isSyntheticProvenance(p)).toBe(true);
  });

  it('uses the default label when none is supplied, and keeps overrides', () => {
    expect(makeProvenance('AI_WEB_EVIDENCE').label).toBe(
      DATA_ORIGIN_LABEL.AI_WEB_EVIDENCE,
    );
    expect(makeProvenance('AI_WEB_EVIDENCE', { label: 'Custom' }).label).toBe('Custom');
  });

  it('carries optional source/time metadata through unchanged', () => {
    const p = makeProvenance('AI_WEB_EVIDENCE', {
      sourceName: 'GMA',
      sourceUrl: 'https://example.test/x',
      publishedAt: '2026-01-03T00:00:00.000Z',
    });
    expect(p.sourceName).toBe('GMA');
    expect(p.sourceUrl).toBe('https://example.test/x');
    expect(p.publishedAt).toBe('2026-01-03T00:00:00.000Z');
  });
});
