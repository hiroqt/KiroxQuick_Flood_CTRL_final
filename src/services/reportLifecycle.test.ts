// src/services/reportLifecycle.test.ts
import { describe, it, expect } from 'vitest';
import type { CommunityReport } from '../types/report';
import {
  buildCommunityReport,
  confirmReport,
  updateReportConditions,
  resolveReport,
  deriveSeverity,
  severityToFloodState,
  passabilityToPassable,
  passabilityLabel,
  reportLifecycleStage,
  reportLifecycleStageLabel,
  type ReportConditions,
} from './reportLifecycle';
import { REPORT_TTL_SECONDS } from './reportResolution';

const NOW = 1_900_000_000;

const CONDITIONS: ReportConditions = {
  depth: 'KNEE',
  passability: 'HIGH_CLEARANCE_ONLY',
  note: 'Water still rising near intersection',
};

describe('deriveSeverity (observable inputs → severity, documented mapping)', () => {
  it('derives from depth (worst wins)', () => {
    expect(deriveSeverity('ABOVE_WAIST', 'UNKNOWN')).toBe('SEVERE');
    expect(deriveSeverity('WAIST', 'UNKNOWN')).toBe('SEVERE');
    expect(deriveSeverity('KNEE', 'UNKNOWN')).toBe('MODERATE');
    expect(deriveSeverity('ANKLE', 'UNKNOWN')).toBe('MINOR');
  });

  it('derives from passability when depth is unknown', () => {
    expect(deriveSeverity('UNKNOWN', 'NOT_PASSABLE')).toBe('SEVERE');
    expect(deriveSeverity('UNKNOWN', 'HIGH_CLEARANCE_ONLY')).toBe('MODERATE');
    expect(deriveSeverity('UNKNOWN', 'PASSABLE')).toBe('MINOR');
  });

  it('takes the worst of depth and passability', () => {
    expect(deriveSeverity('ANKLE', 'NOT_PASSABLE')).toBe('SEVERE');
    expect(deriveSeverity('KNEE', 'PASSABLE')).toBe('MODERATE');
  });

  it('is UNSURE (GRAY, excluded from risk) when nothing is observable', () => {
    expect(deriveSeverity('UNKNOWN', 'UNKNOWN')).toBe('UNSURE');
    expect(severityToFloodState('UNSURE')).toBe('GRAY');
  });
});

describe('report form → model mapping (severity derived, not entered)', () => {
  it('builds an UNCONFIRMED, ACTIVE report with derived severity', () => {
    const r = buildCommunityReport('r1', 121, 14.6, CONDITIONS, 'DEMO source', NOW);
    expect(r.metadata.verificationStatus).toBe('UNCONFIRMED');
    expect(r.lifecycle).toBe('ACTIVE');
    expect(r.confirmationCount).toBe(0);
    // KNEE + HIGH_CLEARANCE_ONLY → both MODERATE → ORANGE.
    expect(r.severity).toBe('MODERATE');
    expect(r.state).toBe('ORANGE');
    expect(r.depth).toBe('KNEE');
    expect(r.passability).toBe('HIGH_CLEARANCE_ONLY');
    expect(r.metadata.description).toBe('Water still rising near intersection');
  });
});

describe('passability (HIGH_CLEARANCE_ONLY stays distinct)', () => {
  it('keeps four distinct labels', () => {
    expect(passabilityLabel('PASSABLE')).toBe('Passable');
    expect(passabilityLabel('HIGH_CLEARANCE_ONLY')).toBe('High-clearance vehicles only');
    expect(passabilityLabel('NOT_PASSABLE')).toBe('Not passable');
    expect(passabilityLabel('UNKNOWN')).toBe('Passability unknown');
  });

  it('the lossy boolean maps HIGH_CLEARANCE_ONLY and NOT_PASSABLE to not-passable, PASSABLE to true, UNKNOWN to undefined', () => {
    expect(passabilityToPassable('PASSABLE')).toBe(true);
    expect(passabilityToPassable('HIGH_CLEARANCE_ONLY')).toBe(false);
    expect(passabilityToPassable('NOT_PASSABLE')).toBe(false);
    expect(passabilityToPassable('UNKNOWN')).toBeUndefined();
  });

  it('the STRUCTURED field distinguishes high-clearance from not-passable even though the boolean cannot', () => {
    const hc = buildCommunityReport('hc', 121, 14.6, { depth: 'UNKNOWN', passability: 'HIGH_CLEARANCE_ONLY' }, 'DEMO', NOW);
    const np = buildCommunityReport('np', 121, 14.6, { depth: 'UNKNOWN', passability: 'NOT_PASSABLE' }, 'DEMO', NOW);
    // Boolean collapses both to false...
    expect(hc.passable).toBe(false);
    expect(np.passable).toBe(false);
    // ...but the authoritative structured field keeps them distinct.
    expect(hc.passability).toBe('HIGH_CLEARANCE_ONLY');
    expect(np.passability).toBe('NOT_PASSABLE');
  });
});

describe('confirmReport', () => {
  const base = buildCommunityReport('r1', 121, 14.6, CONDITIONS, 'DEMO', NOW);

  it('increments confirmationCount and sets lastConfirmedAt, staying UNCONFIRMED', () => {
    const c1 = confirmReport(base, NOW + 60);
    expect(c1.confirmationCount).toBe(1);
    expect(c1.lastConfirmedAt).toBe(NOW + 60);
    expect(c1.metadata.verificationStatus).toBe('UNCONFIRMED');
    const c2 = confirmReport(c1, NOW + 120);
    expect(c2.confirmationCount).toBe(2);
    expect(c2.lastConfirmedAt).toBe(NOW + 120);
  });
});

describe('updateReportConditions', () => {
  const base = buildCommunityReport('r1', 121, 14.6, CONDITIONS, 'DEMO', NOW);

  it('updates fields + updatedAt, keeps the same id, re-derives severity', () => {
    const updated = updateReportConditions(
      base,
      { depth: 'WAIST', passability: 'NOT_PASSABLE', note: 'worse now' },
      NOW + 300,
    );
    expect(updated.id).toBe('r1');
    expect(updated.severity).toBe('SEVERE');
    expect(updated.state).toBe('RED');
    expect(updated.depth).toBe('WAIST');
    expect(updated.metadata.updatedAt).toBe(NOW + 300);
    expect(updated.metadata.description).toBe('worse now');
    expect(updated.lifecycle).toBe('ACTIVE');
  });
});

describe('resolveReport', () => {
  const base = buildCommunityReport('r1', 121, 14.6, CONDITIONS, 'DEMO', NOW);

  it('marks RESOLVED with resolvedAt, keeping the id', () => {
    const r = resolveReport(base, NOW + 500);
    expect(r.id).toBe('r1');
    expect(r.lifecycle).toBe('RESOLVED');
    expect(r.resolvedAt).toBe(NOW + 500);
  });
});

describe('reportLifecycleStage (5-stage presentation)', () => {
  function at(ageSeconds: number, over: Partial<CommunityReport> = {}): CommunityReport {
    return { ...buildCommunityReport('r', 121, 14.6, CONDITIONS, 'DEMO', NOW - ageSeconds), ...over };
  }

  it('RESOLVED overrides any age', () => {
    expect(reportLifecycleStage(at(10, { lifecycle: 'RESOLVED' }), NOW)).toBe('RESOLVED');
  });

  it('buckets by age into FRESH/STALE', () => {
    expect(reportLifecycleStage(at(10), NOW)).toBe('FRESH');
    expect(reportLifecycleStage(at(REPORT_TTL_SECONDS + 100), NOW)).toBe('STALE');
  });

  it('labels are human and never claim verification', () => {
    for (const s of ['FRESH', 'RECENT', 'AGING', 'STALE', 'RESOLVED'] as const) {
      const label = reportLifecycleStageLabel(s).toLowerCase();
      expect(label).not.toContain('confirmed');
      expect(label).not.toContain('official');
    }
  });
});
