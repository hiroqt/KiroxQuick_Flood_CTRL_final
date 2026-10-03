// src/types/evidence.test.ts
import { describe, it, expect } from 'vitest';
import {
  assignEvidenceConfidence,
  evidenceStatusFor,
  withinWindow,
  evidenceCanContributeToClosure,
  EVIDENCE_TTL_SECONDS,
  OFFICIAL_EVIDENCE_TTL_SECONDS,
  CORROBORATION_WINDOW_MS,
  type CorroborationSignal,
  type FloodEvidence,
} from './evidence';
import { makeProvenance } from './provenance';

const T0 = Date.UTC(2026, 0, 3, 12, 0, 0);

function signal(over: Partial<CorroborationSignal> = {}): CorroborationSignal {
  return {
    sourceKey: 'news-a.example',
    sourceType: 'NEWS',
    areaKey: 'b:PH1',
    publishedAtMs: T0,
    ...over,
  };
}

describe('deterministic evidence confidence rules', () => {
  it('a single NEWS source → UNVERIFIED', () => {
    const s = signal();
    expect(assignEvidenceConfidence(s, [s])).toBe('UNVERIFIED');
  });

  it('a single COMMUNITY source → UNVERIFIED', () => {
    const s = signal({ sourceType: 'COMMUNITY' });
    expect(assignEvidenceConfidence(s, [s])).toBe('UNVERIFIED');
  });

  it('any OFFICIAL source → OFFICIAL', () => {
    const s = signal({ sourceType: 'OFFICIAL' });
    expect(assignEvidenceConfidence(s, [s])).toBe('OFFICIAL');
  });

  it('two INDEPENDENT sources, same area and window → CORROBORATED', () => {
    const a = signal({ sourceKey: 'news-a.example' });
    const b = signal({ sourceKey: 'news-b.example' });
    expect(assignEvidenceConfidence(a, [a, b])).toBe('CORROBORATED');
  });

  it('two reports from the SAME source do NOT corroborate', () => {
    const a = signal({ sourceKey: 'news-a.example' });
    const b = signal({ sourceKey: 'news-a.example' });
    expect(assignEvidenceConfidence(a, [a, b])).toBe('UNVERIFIED');
  });

  it('different areas do NOT corroborate', () => {
    const a = signal({ sourceKey: 'news-a.example', areaKey: 'b:PH1' });
    const b = signal({ sourceKey: 'news-b.example', areaKey: 'b:PH2' });
    expect(assignEvidenceConfidence(a, [a, b])).toBe('UNVERIFIED');
  });

  it('an unresolved area (null) cannot corroborate', () => {
    const a = signal({ sourceKey: 'news-a.example', areaKey: null });
    const b = signal({ sourceKey: 'news-b.example', areaKey: null });
    expect(assignEvidenceConfidence(a, [a, b])).toBe('UNVERIFIED');
  });

  it('outside the time window → not corroborated', () => {
    const a = signal({ sourceKey: 'news-a.example', publishedAtMs: T0 });
    const b = signal({
      sourceKey: 'news-b.example',
      publishedAtMs: T0 + CORROBORATION_WINDOW_MS + 1,
    });
    expect(assignEvidenceConfidence(a, [a, b])).toBe('UNVERIFIED');
  });
});

describe('withinWindow', () => {
  it('is true within the window and false outside / with missing times', () => {
    expect(withinWindow(T0, T0 + CORROBORATION_WINDOW_MS)).toBe(true);
    expect(withinWindow(T0, T0 + CORROBORATION_WINDOW_MS + 1)).toBe(false);
    expect(withinWindow(null, T0)).toBe(false);
    expect(withinWindow(T0, null)).toBe(false);
  });
});

describe('evidence TTL / staleness (ACTIVE → STALE, never LOW)', () => {
  it('fresh news within TTL is ACTIVE', () => {
    expect(evidenceStatusFor('NEWS', T0 - (EVIDENCE_TTL_SECONDS - 60) * 1000, T0)).toBe(
      'ACTIVE',
    );
  });

  it('news older than TTL is STALE', () => {
    expect(evidenceStatusFor('NEWS', T0 - (EVIDENCE_TTL_SECONDS + 60) * 1000, T0)).toBe(
      'STALE',
    );
  });

  it('official evidence uses the longer 6h TTL', () => {
    const justInside = T0 - (OFFICIAL_EVIDENCE_TTL_SECONDS - 60) * 1000;
    const justOutside = T0 - (OFFICIAL_EVIDENCE_TTL_SECONDS + 60) * 1000;
    expect(evidenceStatusFor('OFFICIAL', justInside, T0)).toBe('ACTIVE');
    expect(evidenceStatusFor('OFFICIAL', justOutside, T0)).toBe('STALE');
  });

  it('a missing timestamp is STALE (never silently ACTIVE/LOW)', () => {
    expect(evidenceStatusFor('NEWS', null, T0)).toBe('STALE');
  });
});

describe('evidence can NEVER auto-produce a confirmed closure', () => {
  function evidence(over: Partial<FloodEvidence>): FloodEvidence {
    return {
      id: 'e1',
      eventType: 'FLOODING',
      locationText: 'Manila',
      locationUnresolved: false,
      summary: 's',
      sourceName: 'x',
      sourceUrl: 'https://x.test',
      sourceType: 'NEWS',
      confidence: 'UNVERIFIED',
      status: 'ACTIVE',
      isSynthetic: false,
      provenance: makeProvenance('AI_WEB_EVIDENCE'),
      ...over,
    };
  }

  it('CORROBORATED news does NOT qualify as a closure contributor', () => {
    expect(
      evidenceCanContributeToClosure(
        evidence({ sourceType: 'NEWS', confidence: 'CORROBORATED' }),
      ),
    ).toBe(false);
  });

  it('community evidence does NOT qualify', () => {
    expect(
      evidenceCanContributeToClosure(
        evidence({ sourceType: 'COMMUNITY', confidence: 'UNVERIFIED' }),
      ),
    ).toBe(false);
  });

  it('only genuinely OFFICIAL-sourced OFFICIAL-confidence evidence qualifies (still not sufficient alone)', () => {
    expect(
      evidenceCanContributeToClosure(
        evidence({ sourceType: 'OFFICIAL', confidence: 'OFFICIAL' }),
      ),
    ).toBe(true);
  });
});
