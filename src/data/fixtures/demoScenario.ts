// src/data/fixtures/demoScenario.ts
//
// ⚠️ SYNTHETIC / DEMO DATA — NOT LIVE ⚠️
//
// Explicitly-labeled synthetic fixtures for the hackathon demo. EVERY item here
// is flagged synthetic so the UI badges it "DEMO" and it is NEVER counted as
// live/authoritative data. These are surfaced ONLY when Demo Mode is enabled
// (AppConfig.demoMode === true); when disabled, none of these appear.
//
// Hard rules preserved:
//   - A demo community report is still an UNVERIFIED community report.
//   - A demo flood evidence item is still unofficial web evidence.
//   - A demo confirmed closure uses the official-confirmation path but is
//     clearly labeled DEMO/manual (it does NOT come from rainfall or reports).
//   - Demo data never masquerades as live data.

import type { CommunityReport } from '../../types/report';
import type { OfficialStatus } from '../../types/risk';
import type { FloodEvidence } from '../../types/evidence';
import { makeProvenance } from '../../types/provenance';

/** Source label making the synthetic nature explicit on every demo item. */
export const DEMO_SCENARIO_SOURCE = 'DEMO — synthetic scenario (not live data)';

/** A stable reference time for demo items (kept recent-looking at runtime). */
function demoRecent(secondsAgo: number, now: number): number {
  return now - secondsAgo;
}

/**
 * A synthetic community report near España/Sampaloc, Manila. It is UNVERIFIED
 * (like all community reports) AND synthetic (badged DEMO). `now` injectable so
 * it always reads as a recent report in the demo.
 */
export function demoCommunityReports(now: number = Math.floor(Date.now() / 1000)): CommunityReport[] {
  return [
    {
      id: 'demo-report-espana',
      state: 'ORANGE',
      passable: true,
      metadata: {
        location: { lng: 120.9942, lat: 14.6095 }, // España Blvd, Sampaloc
        source: DEMO_SCENARIO_SOURCE,
        dataType: 'COMMUNITY_REPORT',
        updatedAt: demoRecent(5 * 60, now), // ~5 min ago
        verificationStatus: 'UNCONFIRMED',
        severity: 'Knee-deep (reported)',
        description: 'DEMO: flooding reported along the avenue (synthetic).',
      },
    },
  ];
}

/**
 * A synthetic AI web-evidence item (unofficial news-style) near Marikina. It is
 * clearly synthetic and carries DEMO provenance; CORROBORATED-at-most, and never
 * a confirmed closure.
 */
export function demoFloodEvidence(now: number = Date.now()): FloodEvidence[] {
  const publishedAt = new Date(now - 20 * 60 * 1000).toISOString(); // ~20 min ago
  return [
    {
      id: 'demo-evidence-marikina',
      eventType: 'ROAD_FLOODED',
      locationText: 'Marikina',
      city: 'Marikina',
      barangay: undefined,
      psgc: undefined,
      coordinates: [121.0966, 14.6349], // Marikina Sports Center
      locationUnresolved: false,
      summary: 'DEMO: Local outlet reports road flooding near the riverbanks (synthetic).',
      sourceName: 'demo-news.example',
      sourceUrl: 'https://demo-news.example/flood-marikina',
      sourceType: 'NEWS',
      confidence: 'UNVERIFIED',
      publishedAt,
      observedAt: publishedAt,
      status: 'ACTIVE',
      isSynthetic: true,
      provenance: makeProvenance('DEMO', {
        label: 'Web evidence (demo)',
        sourceName: 'demo-news.example',
        sourceUrl: 'https://demo-news.example/flood-marikina',
        publishedAt,
        observedAt: publishedAt,
        isSynthetic: true,
      }),
    },
  ];
}

/**
 * A synthetic confirmed closure. It uses the official-confirmation shape (the
 * ONLY path to CONFIRMED_NOT_PASSABLE) but is clearly labeled DEMO/manual — it
 * is NOT produced by rainfall or community reports. The PSGC is a real NCR
 * barangay so the closure demonstrates end-to-end.
 */
export function demoConfirmedClosures(now: number = Math.floor(Date.now() / 1000)): OfficialStatus[] {
  return [
    {
      psgc: 'PH1307402001', // a Marikina barangay (demo)
      notPassable: true,
      source: DEMO_SCENARIO_SOURCE,
      confirmedAt: demoRecent(15 * 60, now),
      note: 'DEMO: confirmed closure for the demo reroute scenario (synthetic).',
    },
  ];
}

/** A labeled reroute scenario descriptor for the demo narrative. */
export interface DemoRerouteScenario {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly isSynthetic: true;
}

/** The synthetic reroute scenario shown in Demo Mode. */
export const demoRerouteScenario: DemoRerouteScenario = {
  id: 'demo-reroute-marikina',
  label: 'Demo reroute',
  description:
    'DEMO: a confirmed closure forces a reroute around the affected segment (synthetic).',
  isSynthetic: true,
};

/**
 * The full synthetic demo bundle, assembled fresh so timestamps read recent.
 * Consumers must only use this when AppConfig.demoMode is true.
 */
export interface DemoScenarioBundle {
  readonly communityReports: readonly CommunityReport[];
  readonly floodEvidence: readonly FloodEvidence[];
  readonly confirmedClosures: readonly OfficialStatus[];
  readonly reroute: DemoRerouteScenario;
}

/** Builds the complete demo bundle with recent-looking timestamps. */
export function buildDemoScenario(nowMs: number = Date.now()): DemoScenarioBundle {
  const nowSec = Math.floor(nowMs / 1000);
  return {
    communityReports: demoCommunityReports(nowSec),
    floodEvidence: demoFloodEvidence(nowMs),
    confirmedClosures: demoConfirmedClosures(nowSec),
    reroute: demoRerouteScenario,
  };
}
