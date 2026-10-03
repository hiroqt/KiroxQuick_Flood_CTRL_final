// src/data/fixtures/evacuationCenters.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE ⚠️
// Sample evacuation centers for development only. These are invented demo
// points, not an official list of evacuation facilities, and must not be
// presented as authoritative (Req 15.1, 15.2, 15.4, 16.2).

import type { EvacuationCenter } from '../../types/evacuation';

/** Demo marker attached to evacuation-center fixtures (Req 15.4). */
export const EVACUATION_CENTERS_DEMO_SOURCE = 'DEMO — evacuation center (fixture)';

/** Marks this module's contents as demo/fixture data (Req 15.2). */
export const EVACUATION_CENTERS_IS_DEMO = true;

/**
 * Demo evacuation centers within the NCR. Each carries at least location,
 * name, and description (Req 16.2). Descriptions clearly label them as demo.
 */
export const evacuationCenterFixtures: EvacuationCenter[] = [
  {
    id: 'demo-evac-quezon-city',
    name: 'DEMO Evacuation Center — Quezon City (fixture)',
    location: { lng: 121.05, lat: 14.676 },
    description: 'DEMO: sample evacuation site in Quezon City. Not an authoritative facility list.',
  },
  {
    id: 'demo-evac-marikina',
    name: 'DEMO Evacuation Center — Marikina (fixture)',
    location: { lng: 121.102, lat: 14.65 },
    description: 'DEMO: sample evacuation site in Marikina. Not an authoritative facility list.',
  },
  {
    id: 'demo-evac-manila',
    name: 'DEMO Evacuation Center — Manila (fixture)',
    location: { lng: 120.984, lat: 14.599 },
    description: 'DEMO: sample evacuation site in Manila. Not an authoritative facility list.',
  },
];
