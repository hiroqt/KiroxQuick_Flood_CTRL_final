// src/data/fixtures/floodReports.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE ⚠️
// Sample authoritative-style current/recent flood reports for development only.
// These are invented demo points, not real reports from any agency, and must
// not be presented as authoritative or verified (Req 15.1, 15.2, 15.4).

import type { FloodReport } from '../../types/flood';

/** Demo source marker attached to every report fixture (Req 15.4). */
export const FLOOD_REPORTS_DEMO_SOURCE = 'DEMO — current/recent report (fixture)';

/** Marks this module's contents as demo/fixture data (Req 15.2). */
export const FLOOD_REPORTS_IS_DEMO = true;

/** A recent-ish epoch (seconds) so GREEN passable demo reads as recent. */
const RECENT = 1_700_000_000;

/**
 * Demo flood reports covering RED / ORANGE / YELLOW / GREEN with appropriate
 * passable flags. GREEN carries passable === true (Recently Reported Passable).
 */
export const floodReportFixtures: FloodReport[] = [
  {
    id: 'demo-report-red-marikina',
    state: 'RED',
    passable: false,
    metadata: {
      location: { lng: 121.101, lat: 14.648 },
      source: FLOOD_REPORTS_DEMO_SOURCE,
      dataType: 'REPORT',
      updatedAt: RECENT,
      verificationStatus: 'VERIFIED',
      severity: 'reported flooding',
      depth: 0.9,
      description: 'DEMO: reported flooding near Marikina riverbanks. Not authoritative.',
    },
  },
  {
    id: 'demo-report-orange-pasig',
    state: 'ORANGE',
    passable: false,
    metadata: {
      location: { lng: 121.078, lat: 14.576 },
      source: FLOOD_REPORTS_DEMO_SOURCE,
      dataType: 'REPORT',
      updatedAt: RECENT,
      verificationStatus: 'VERIFIED',
      severity: 'elevated flood exposure',
      depth: 0.4,
      description: 'DEMO: elevated flood exposure reported in Pasig. Not authoritative.',
    },
  },
  {
    id: 'demo-report-yellow-espana',
    state: 'YELLOW',
    metadata: {
      location: { lng: 120.994, lat: 14.61 },
      source: FLOOD_REPORTS_DEMO_SOURCE,
      dataType: 'REPORT',
      updatedAt: RECENT,
      verificationStatus: 'VERIFIED',
      severity: 'caution',
      description: 'DEMO: caution — minor ponding reported along España. Not authoritative.',
    },
  },
  {
    id: 'demo-report-green-makati',
    state: 'GREEN',
    passable: true,
    metadata: {
      location: { lng: 121.028, lat: 14.556 },
      source: FLOOD_REPORTS_DEMO_SOURCE,
      dataType: 'REPORT',
      updatedAt: RECENT,
      verificationStatus: 'VERIFIED',
      severity: 'recently reported passable',
      description: 'DEMO: recently reported passable in Makati. Not authoritative.',
    },
  },
];
