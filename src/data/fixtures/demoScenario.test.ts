// src/data/fixtures/demoScenario.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildDemoScenario,
  demoCommunityReports,
  demoConfirmedClosures,
  demoFloodEvidence,
  DEMO_SCENARIO_SOURCE,
} from './demoScenario';
import { loadOfficialConfirmations } from './officialConfirmations';
import { resolveBarangayForPoint } from '../../services/reportResolution';

describe('demo scenario fixtures are clearly synthetic', () => {
  it('demo community reports stay UNCONFIRMED and are labeled demo', () => {
    const reports = demoCommunityReports();
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) {
      expect(r.metadata.verificationStatus).toBe('UNCONFIRMED');
      expect(r.metadata.source).toBe(DEMO_SCENARIO_SOURCE);
    }
  });

  it('demo flood evidence is synthetic and carries DEMO provenance', () => {
    const evidence = demoFloodEvidence();
    expect(evidence.length).toBeGreaterThan(0);
    for (const e of evidence) {
      expect(e.isSynthetic).toBe(true);
      expect(e.provenance.origin).toBe('DEMO');
      // A demo news item is never OFFICIAL confidence.
      expect(e.confidence).not.toBe('OFFICIAL');
    }
  });

  it('a demo report resolves to a real NCR barangay (so it demonstrates end to end)', () => {
    const r = demoCommunityReports()[0];
    const psgc = resolveBarangayForPoint(r.metadata.location.lng, r.metadata.location.lat);
    expect(psgc).not.toBeNull();
  });
});

describe('demo confirmed closure uses the OFFICIAL path only (never rainfall/reports)', () => {
  it('demo closures pass the official-confirmation validation and are labeled demo', () => {
    const closures = demoConfirmedClosures();
    expect(closures.length).toBeGreaterThan(0);
    for (const c of closures) {
      expect(c.notPassable).toBe(true);
      expect(c.source).toBe(DEMO_SCENARIO_SOURCE);
    }
    // They flow through the SAME validated official provider — not auto-produced
    // by rainfall or community reports.
    const validated = loadOfficialConfirmations(closures);
    expect(validated).toHaveLength(closures.length);
  });
});

describe('buildDemoScenario bundle', () => {
  it('provides every demo category with recent timestamps', () => {
    const bundle = buildDemoScenario(Date.now());
    expect(bundle.communityReports.length).toBeGreaterThan(0);
    expect(bundle.floodEvidence.length).toBeGreaterThan(0);
    expect(bundle.confirmedClosures.length).toBeGreaterThan(0);
    expect(bundle.reroute.isSynthetic).toBe(true);
  });
});
