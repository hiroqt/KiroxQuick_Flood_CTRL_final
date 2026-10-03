// src/services/floodEvidenceStore.test.ts
import { describe, it, expect } from 'vitest';
import { FloodEvidenceStore, activeEvidenceCountFor } from './floodEvidenceStore';
import type { FloodEvidence } from '../types/evidence';
import { makeProvenance } from '../types/provenance';

function live(over: Partial<FloodEvidence> = {}): FloodEvidence {
  return {
    id: 'live-1',
    eventType: 'FLOODING',
    locationText: 'Manila',
    psgc: 'PH1',
    coordinates: [121, 14.6],
    locationUnresolved: false,
    summary: 'live summary',
    sourceName: 'news.example',
    sourceUrl: 'https://news.example/1',
    sourceType: 'NEWS',
    confidence: 'UNVERIFIED',
    status: 'ACTIVE',
    isSynthetic: false,
    provenance: makeProvenance('AI_WEB_EVIDENCE'),
    ...over,
  };
}

describe('live/demo separation', () => {
  it('hides ALL synthetic items when demoMode is false', () => {
    const store = new FloodEvidenceStore(false);
    store.setLiveEvidence([live()]);
    const out = store.evidence();
    expect(out.every((e) => e.isSynthetic === false)).toBe(true);
    expect(out).toHaveLength(1);
  });

  it('includes clearly-labeled demo items ONLY when demoMode is true', () => {
    const store = new FloodEvidenceStore(true);
    store.setLiveEvidence([live()]);
    const out = store.evidence();
    const demo = out.filter((e) => e.isSynthetic === true);
    expect(demo.length).toBeGreaterThan(0);
    // Every demo item is flagged synthetic (never masquerades as live).
    expect(demo.every((e) => e.isSynthetic === true)).toBe(true);
  });

  it('demo data disappears when demoMode is toggled off', () => {
    const store = new FloodEvidenceStore(true);
    expect(store.evidence().some((e) => e.isSynthetic)).toBe(true);
    store.setDemoMode(false);
    expect(store.evidence().some((e) => e.isSynthetic)).toBe(false);
  });

  it('never counts synthetic data as live (setLiveEvidence drops synthetic)', () => {
    const store = new FloodEvidenceStore(false);
    // Attempt to sneak a synthetic item into the LIVE set.
    store.setLiveEvidence([live({ isSynthetic: true, id: 'sneaky' })]);
    expect(store.evidence()).toHaveLength(0);
  });

  it('surfaces agent availability in the snapshot', () => {
    const store = new FloodEvidenceStore(false);
    store.setAgentUnavailable(true);
    expect(store.snapshot().agentUnavailable).toBe(true);
  });
});

describe('activeEvidenceCountFor', () => {
  it('counts only ACTIVE items resolving to the given barangay', () => {
    const items: FloodEvidence[] = [
      live({ id: 'a', psgc: 'PH1', status: 'ACTIVE' }),
      live({ id: 'b', psgc: 'PH1', status: 'STALE' }),
      live({ id: 'c', psgc: 'PH2', status: 'ACTIVE' }),
    ];
    expect(activeEvidenceCountFor(items, 'PH1')).toBe(1);
    expect(activeEvidenceCountFor(items, 'PH2')).toBe(1);
    expect(activeEvidenceCountFor(items, 'PH3')).toBe(0);
  });
});
