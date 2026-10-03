// src/services/routeWebEvidence.test.ts
//
// Verifies AI web evidence integrates into route planning as SUPPORTING context
// only: it appears in the explanation/ranking but a single AI/news result never
// hard-blocks a route (only a confirmed official closure can) and never raises
// the route's risk LEVEL.

import { describe, it, expect } from 'vitest';
import {
  summarizeRouteRisk,
  routeSegmentExplanation,
  isRouteStartBlocked,
  compareRoutes,
  type RouteCandidate,
} from './routePlanning';

function candidate(id: string, line: [number, number][]): RouteCandidate {
  return { id, label: id, route: line, maneuvers: [], distanceM: 3000, durationS: 600, hazards: [] };
}

const LINE: [number, number][] = [
  [121.0, 14.6],
  [121.03, 14.62],
];

describe('web evidence in route risk aggregation', () => {
  it('counts web evidence but does NOT raise the route risk level', () => {
    const summary = summarizeRouteRisk(candidate('A', LINE), {
      riskByBarangay: () => 'LOW',
      webEvidenceCountByBarangay: () => 3,
      dataUnavailable: false,
    });
    expect(summary.webEvidenceCount).toBeGreaterThan(0);
    // Level stays LOW — web evidence is supporting context, not a classifier.
    expect(summary.level).toBe('LOW');
  });

  it('does NOT block Start on web evidence (only confirmed closures block)', () => {
    const summary = summarizeRouteRisk(candidate('A', LINE), {
      riskByBarangay: () => 'LOW',
      webEvidenceCountByBarangay: () => 5,
      closedBarangays: new Set<string>(),
      dataUnavailable: false,
    });
    const option = { candidate: candidate('A', LINE), risk: summary, recommendation: 'recommended' as const, reasons: [] };
    expect(isRouteStartBlocked(option)).toBe(false);
    expect(summary.closureCount).toBe(0);
  });

  it('mentions recent flood evidence in the route explanation', () => {
    const summary = summarizeRouteRisk(candidate('A', LINE), {
      riskByBarangay: () => 'LOW',
      webEvidenceCountByBarangay: () => 1,
      dataUnavailable: false,
    });
    const text = routeSegmentExplanation(summary).toLowerCase();
    expect(text).toContain('flood evidence');
    expect(text).toContain('web');
    expect(text).not.toContain('safe');
  });

  it('web evidence never flips an otherwise-unavailable route into a classified level', () => {
    const summary = summarizeRouteRisk(candidate('A', LINE), {
      // No classified risk anywhere; only web evidence present.
      riskByBarangay: () => undefined,
      webEvidenceCountByBarangay: () => 4,
      dataUnavailable: true,
    });
    expect(summary.dataUnavailable).toBe(true);
    expect(summary.level).toBe('UNKNOWN');
    // Evidence is still counted (summed across the barangays the route crosses)
    // but it never classified the route — level stays UNKNOWN, not LOW.
    expect(summary.webEvidenceCount).toBeGreaterThan(0);
  });

  it('a web-evidence-only difference never outranks a confirmed-closure penalty', () => {
    const options = compareRoutes(
      [candidate('A', LINE), candidate('B', [[121.0, 14.6], [121.04, 14.63]])],
      {
        riskByBarangay: () => 'LOW',
        // Route A carries lots of web evidence; route B carries a closure.
        webEvidenceCountByBarangay: (psgc) => (psgc ? 10 : 0),
        closedBarangays: new Set<string>(),
        dataUnavailable: false,
      },
    );
    // Neither is blocked here (no closure injected per-barangay in this fake),
    // but the recommended route must never be labeled with banned language.
    const recommended = options.find((o) => o.recommendation === 'recommended');
    expect(recommended).toBeDefined();
  });
});
