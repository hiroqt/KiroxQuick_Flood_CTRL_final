// src/services/communityReportV2.test.ts
//
// Community Report V2 Phase 1 — controller lifecycle actions + risk-semantics
// guards (confirm / update / resolve) through the real BarangayRiskController
// store (no parallel store). Uses a dry (zero-rain) fetch so risk is driven
// only by the reports under test.

import { describe, it, expect, vi } from 'vitest';
import { BarangayRiskController } from './barangayRiskController';
import type { FetchLike } from './rainfallService';
import { buildCommunityReport, type ReportConditions } from './reportLifecycle';
import { aggregateReportsByBarangay } from './reportResolution';
import { ncrBarangayInfos } from '../data/geojson/ncrBarangays';
import { communityReportFixtures } from '../data/fixtures/communityReports';

const dryFetch: FetchLike = vi.fn(async (url: string) => {
  const n = new URL(url).searchParams.get('latitude')!.split(',').length;
  return {
    ok: true,
    status: 200,
    json: async () => Array.from({ length: n }, () => ({ current: { interval: 900, precipitation: 0 } })),
  };
});

const SEVERE: ReportConditions = { depth: 'WAIST', passability: 'NOT_PASSABLE' };

/** A report placed at a barangay centroid so it resolves to that barangay. */
function reportAtBarangay(idx: number, id: string, conditions = SEVERE, now = Math.floor(Date.now() / 1000)) {
  const b = ncrBarangayInfos[idx];
  const [lng, lat] = b.centroid;
  return { report: buildCommunityReport(id, lng, lat, conditions, 'DEMO', now), psgc: b.psgc };
}

describe('confirmReport (controller)', () => {
  it('increments confirmationCount and sets lastConfirmedAt without creating a closure', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const { report, psgc } = reportAtBarangay(0, 'c1');
    controller.addReport(report);

    const now = Math.floor(Date.now() / 1000);
    const updated = controller.confirmReport('c1', now);
    expect(updated?.confirmationCount).toBe(1);
    expect(updated?.lastConfirmedAt).toBe(now);

    // Still only a community report; never an official closure.
    expect(controller.reportById('c1')?.metadata.verificationStatus).toBe('UNCONFIRMED');
    expect(controller.assessmentFor(psgc)?.currentRisk).not.toBe('CONFIRMED_NOT_PASSABLE');
  });

  it('confirming multiple times keeps incrementing and never reaches official closure', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const { report, psgc } = reportAtBarangay(0, 'c2');
    controller.addReport(report);
    for (let i = 0; i < 5; i += 1) controller.confirmReport('c2');
    expect(controller.reportById('c2')?.confirmationCount).toBe(5);
    expect(controller.assessmentFor(psgc)?.currentRisk).not.toBe('CONFIRMED_NOT_PASSABLE');
  });

  it('returns undefined for an unknown id', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    expect(controller.confirmReport('nope')).toBeUndefined();
  });
});

describe('updateReportConditions (controller)', () => {
  it('updates conditions in place keeping the same id (no duplicate)', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const { report } = reportAtBarangay(0, 'u1', { depth: 'ANKLE', passability: 'PASSABLE' });
    controller.addReport(report);
    const before = controller.communityReports().length;

    controller.updateReportConditions('u1', { depth: 'WAIST', passability: 'NOT_PASSABLE' });

    expect(controller.communityReports().length).toBe(before); // no duplicate
    const r = controller.reportById('u1');
    expect(r?.state).toBe('RED');
    expect(r?.depth).toBe('WAIST');
    expect(r?.metadata.verificationStatus).toBe('UNCONFIRMED');
  });
});

describe('resolveReport (controller)', () => {
  it('a resolved report no longer contributes to active risk but remains renderable', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const { report, psgc } = reportAtBarangay(1, 'res1');
    controller.addReport(report);
    // Active SEVERE report escalates to REPORTED_FLOODING.
    expect(controller.assessmentFor(psgc)?.currentRisk).toBe('REPORTED_FLOODING');

    controller.resolveReport('res1');
    // No longer escalates risk.
    expect(controller.assessmentFor(psgc)?.currentRisk).not.toBe('REPORTED_FLOODING');
    // Still present (viewable as a historical community observation).
    const r = controller.reportById('res1');
    expect(r).toBeDefined();
    expect(r?.lifecycle).toBe('RESOLVED');
  });
});

describe('risk semantics — community data cannot exceed REPORTED_FLOODING', () => {
  it('even a SEVERE + NOT_PASSABLE community report caps at REPORTED_FLOODING', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const { report, psgc } = reportAtBarangay(2, 'cap1');
    controller.addReport(report);
    const level = controller.assessmentFor(psgc)?.currentRisk;
    expect(level).toBe('REPORTED_FLOODING');
    expect(level).not.toBe('CONFIRMED_NOT_PASSABLE');
  });

  it('a community NOT_PASSABLE report NEVER becomes an official closure, even after confirmations', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const { report, psgc } = reportAtBarangay(2, 'np1', { depth: 'ABOVE_WAIST', passability: 'NOT_PASSABLE' });
    controller.addReport(report);
    controller.confirmReport('np1');
    controller.confirmReport('np1');
    expect(controller.assessmentFor(psgc)?.currentRisk).not.toBe('CONFIRMED_NOT_PASSABLE');
    expect(controller.reportById('np1')?.metadata.verificationStatus).toBe('UNCONFIRMED');
  });

  it('HIGH_CLEARANCE_ONLY stays distinct from PASSABLE and NOT_PASSABLE on the stored report', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const { report: hc } = reportAtBarangay(0, 'hc', { depth: 'UNKNOWN', passability: 'HIGH_CLEARANCE_ONLY' });
    const { report: np } = reportAtBarangay(1, 'np', { depth: 'UNKNOWN', passability: 'NOT_PASSABLE' });
    const { report: ps } = reportAtBarangay(2, 'ps', { depth: 'UNKNOWN', passability: 'PASSABLE' });
    controller.addReport(hc);
    controller.addReport(np);
    controller.addReport(ps);
    expect(controller.reportById('hc')?.passability).toBe('HIGH_CLEARANCE_ONLY');
    expect(controller.reportById('np')?.passability).toBe('NOT_PASSABLE');
    expect(controller.reportById('ps')?.passability).toBe('PASSABLE');
  });
});

describe('realistic demo fixtures (provenance + non-escalating resolved)', () => {
  it('every demo report is clearly synthetic (DEMO source) and UNCONFIRMED', () => {
    for (const r of communityReportFixtures) {
      expect(r.metadata.source.toUpperCase()).toContain('DEMO');
      expect(r.metadata.verificationStatus).toBe('UNCONFIRMED');
      expect(r.metadata.dataType).toBe('COMMUNITY_REPORT');
    }
  });

  it('includes a varied set with confirmations and exactly one RESOLVED report', () => {
    const resolved = communityReportFixtures.filter((r) => r.lifecycle === 'RESOLVED');
    expect(resolved).toHaveLength(1);
    // At least one report carries confirmations (realistic feed).
    expect(communityReportFixtures.some((r) => (r.confirmationCount ?? 0) > 0)).toBe(true);
  });

  it('the RESOLVED demo report does NOT contribute to current risk aggregation', () => {
    const resolved = communityReportFixtures.find((r) => r.lifecycle === 'RESOLVED')!;
    const map = aggregateReportsByBarangay([resolved], Math.floor(Date.now() / 1000));
    expect(map.size).toBe(0);
  });
});

describe('backward compatibility — V1 reports without lifecycle fields', () => {
  it('demo fixtures still aggregate active reports correctly', () => {
    const map = aggregateReportsByBarangay(communityReportFixtures, Math.floor(Date.now() / 1000));
    // Active A/B/C bucket by barangay; the RESOLVED D is excluded.
    expect(map.size).toBeGreaterThanOrEqual(1);
  });

  it('a V1-shaped report (no lifecycle) is treated as ACTIVE and can escalate', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const b = ncrBarangayInfos[3];
    const [lng, lat] = b.centroid;
    controller.addReport({
      id: 'v1',
      state: 'RED',
      metadata: {
        location: { lng, lat },
        source: 'DEMO',
        dataType: 'COMMUNITY_REPORT',
        updatedAt: Math.floor(Date.now() / 1000),
        verificationStatus: 'UNCONFIRMED',
      },
    });
    expect(controller.assessmentFor(b.psgc)?.currentRisk).toBe('REPORTED_FLOODING');
  });
});

// --- Full lifecycle walkthrough mirroring the 8 manual QA scenarios ---------
describe('Community Report V2 — end-to-end lifecycle (controller truth)', () => {
  it('runs create → confirm → re-read → update → resolve, honoring risk + id invariants', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const b = ncrBarangayInfos[4];
    const [lng, lat] = b.centroid;
    const now = 1_900_000_000;

    // 1. Create report (KNEE + HIGH_CLEARANCE_ONLY → MODERATE/ORANGE, ACTIVE).
    const created = buildCommunityReport(
      'e2e',
      lng,
      lat,
      { depth: 'KNEE', passability: 'HIGH_CLEARANCE_ONLY' },
      'DEMO',
      now,
    );
    controller.addReport(created);
    expect(controller.reportById('e2e')?.confirmationCount).toBe(0);
    expect(controller.reportById('e2e')?.lifecycle).toBe('ACTIVE');

    // 3. Confirm flooding once → count increments, lastConfirmedAt set.
    const confirmed = controller.confirmReport('e2e', now + 60);
    expect(confirmed?.confirmationCount).toBe(1);
    expect(confirmed?.lastConfirmedAt).toBe(now + 60);

    // 4. Re-read the same report → the increased count persists in the store.
    expect(controller.reportById('e2e')?.confirmationCount).toBe(1);

    // 5. Conditions changed → SAME id, no duplicate, fields re-derived.
    const beforeCount = controller.communityReports().length;
    controller.updateReportConditions('e2e', { depth: 'WAIST', passability: 'NOT_PASSABLE' }, now + 120);
    expect(controller.communityReports().length).toBe(beforeCount); // same id, no dup
    expect(controller.reportById('e2e')?.state).toBe('RED');
    // Confirmation count is preserved across a conditions update.
    expect(controller.reportById('e2e')?.confirmationCount).toBe(1);
    // 7a. While ACTIVE + RED, the barangay reads REPORTED_FLOODING.
    expect(controller.assessmentFor(b.psgc)?.currentRisk).toBe('REPORTED_FLOODING');

    // 6. Flood cleared → RESOLVED, still present (renderable), id unchanged.
    const resolved = controller.resolveReport('e2e', now + 180);
    expect(resolved?.lifecycle).toBe('RESOLVED');
    expect(controller.reportById('e2e')).toBeDefined();

    // 7b. Resolved report no longer changes current risk.
    expect(controller.assessmentFor(b.psgc)?.currentRisk).not.toBe('REPORTED_FLOODING');
    // ...and never reaches an official closure at any point.
    expect(controller.assessmentFor(b.psgc)?.currentRisk).not.toBe('CONFIRMED_NOT_PASSABLE');
  });

  it('confirm acts on ONLY the selected report (scenario 3 isolation)', () => {
    const controller = new BarangayRiskController({ fetchImpl: dryFetch });
    const a = reportAtBarangay(5, 'iso-a');
    const c = reportAtBarangay(6, 'iso-b');
    controller.addReport(a.report);
    controller.addReport(c.report);
    controller.confirmReport('iso-a');
    expect(controller.reportById('iso-a')?.confirmationCount).toBe(1);
    expect(controller.reportById('iso-b')?.confirmationCount).toBe(0);
  });
});
