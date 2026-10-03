// src/data/fixtures/communityReports.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE, NOT REAL OBSERVATIONS ⚠️
// Synthetic community (non-authoritative) flood reports for development/demo
// only. These are INVENTED demo points, not real community submissions, and are
// always marked UNCONFIRMED (Req 14.3, 14.4, 15.1, 15.2, 15.4). Location text is
// coarse/area-level and the source label makes the synthetic nature explicit —
// nothing here asserts that a specific real road is currently flooded.
//
// Community Report V2 realism pass: the set is varied (depth, passability,
// confirmation counts, freshness, and one RESOLVED report) so the demo reads
// like a believable community feed WITHOUT fabricating real-world flood claims.

import type { CommunityReport } from '../../types/report';
import { buildCommunityReport, resolveReport } from '../../services/reportLifecycle';

/** Demo source marker attached to every community-report fixture (Req 15.4). */
export const COMMUNITY_REPORTS_DEMO_SOURCE = 'DEMO — synthetic community report (not real)';

/** Marks this module's contents as demo/fixture data (Req 15.2). */
export const COMMUNITY_REPORTS_IS_DEMO = true;

/**
 * Builds the synthetic demo report set relative to `nowSec` so freshness reads
 * believably in a live demo (fresh/recent/aging). All reports are UNCONFIRMED
 * and carry the DEMO source. Confirmation counts are applied by stamping the
 * lifecycle fields directly (no real confirmations occurred).
 *
 * @param nowSec - Reference time (epoch seconds). Defaults to wall clock.
 */
export function buildCommunityReportFixtures(
  nowSec: number = Math.floor(Date.now() / 1000),
): CommunityReport[] {
  const mins = (m: number): number => nowSec - m * 60;

  // Demo Report A — near a major QC intersection: knee-deep, high-clearance
  // only, several confirmations, fresh.
  const a: CommunityReport = {
    ...buildCommunityReport(
      'demo-community-a',
      121.0509,
      14.6239, // area near Quezon Ave / EDSA (coarse, demo)
      { depth: 'KNEE', passability: 'HIGH_CLEARANCE_ONLY', note: 'DEMO: water near the intersection (synthetic).' },
      COMMUNITY_REPORTS_DEMO_SOURCE,
      mins(6),
    ),
    confirmationCount: 3,
    lastConfirmedAt: mins(2),
  };

  // Demo Report B — ankle-deep, passable, one confirmation, recent.
  const b: CommunityReport = {
    ...buildCommunityReport(
      'demo-community-b',
      120.9842,
      14.5995, // Manila area (coarse, demo)
      { depth: 'ANKLE', passability: 'PASSABLE' },
      COMMUNITY_REPORTS_DEMO_SOURCE,
      mins(35),
    ),
    confirmationCount: 1,
    lastConfirmedAt: mins(20),
  };

  // Demo Report C — waist-deep, not passable, many confirmations, aging.
  const c: CommunityReport = {
    ...buildCommunityReport(
      'demo-community-c',
      121.0699,
      14.6507, // Marikina-ward area (coarse, demo)
      { depth: 'WAIST', passability: 'NOT_PASSABLE', note: 'DEMO: road reported impassable (synthetic).' },
      COMMUNITY_REPORTS_DEMO_SOURCE,
      mins(140),
    ),
    confirmationCount: 5,
    lastConfirmedAt: mins(50),
  };

  // Demo Report D — previously knee-deep, now RESOLVED (cleared recently).
  const d: CommunityReport = resolveReport(
    buildCommunityReport(
      'demo-community-d',
      121.0244,
      14.5547, // Makati area (coarse, demo)
      { depth: 'KNEE', passability: 'HIGH_CLEARANCE_ONLY' },
      COMMUNITY_REPORTS_DEMO_SOURCE,
      mins(90),
    ),
    mins(12),
  );

  return [a, b, c, d];
}

/**
 * Demo community reports. All carry dataType 'COMMUNITY_REPORT' and
 * verificationStatus 'UNCONFIRMED' (Req 14.1, 14.3). Built once at module load.
 */
export const communityReportFixtures: CommunityReport[] = buildCommunityReportFixtures();
