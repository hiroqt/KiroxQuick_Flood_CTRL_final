// src/services/floodEvidenceStore.ts
//
// A small runtime store that holds the current AI Flood Evidence and enforces
// strict LIVE/DEMO separation. It is the single source of truth the map layer
// and evidence UI read from, so the demo badge and counts stay honest:
//
//   - Live evidence (from the GDELT agent) is always real (isSynthetic=false).
//   - Demo evidence is injected ONLY when demoMode is true, and every demo item
//     is isSynthetic=true (badged DEMO).
//   - When demoMode is false, no synthetic item is ever returned or counted.
//
// The store owns no rendering and no network; it is fed by the agent/controller.

import type { FloodEvidence } from '../types/evidence';
import { buildDemoScenario } from '../data/fixtures/demoScenario';

/** A snapshot of evidence plus agent availability for the UI. */
export interface EvidenceSnapshot {
  /** All evidence to display (live + demo-when-enabled), newest-ish first. */
  readonly evidence: readonly FloodEvidence[];
  /** True when the GDELT agent is unavailable (failed, no cache). */
  readonly agentUnavailable: boolean;
  /** True when demo items are currently included. */
  readonly demoMode: boolean;
}

export class FloodEvidenceStore {
  private live: readonly FloodEvidence[] = [];
  private agentUnavailable = false;
  private readonly listeners = new Set<(s: EvidenceSnapshot) => void>();

  constructor(private demoMode: boolean = false) {}

  /** Replaces the LIVE evidence set (from the agent). Demo items are separate. */
  setLiveEvidence(evidence: readonly FloodEvidence[]): void {
    // Defensive: live evidence must never be synthetic.
    this.live = evidence.filter((e) => e.isSynthetic !== true);
    this.emit();
  }

  /** Flags whether the discovery agent is currently unavailable. */
  setAgentUnavailable(unavailable: boolean): void {
    this.agentUnavailable = unavailable;
    this.emit();
  }

  /** Toggles demo mode at runtime (e.g. a dev toggle). */
  setDemoMode(on: boolean): void {
    if (this.demoMode === on) return;
    this.demoMode = on;
    this.emit();
  }

  /** True when demo items are included. */
  isDemoMode(): boolean {
    return this.demoMode;
  }

  /**
   * The current combined evidence. Demo items are appended ONLY when demoMode is
   * true; otherwise exactly the live set is returned. Synthetic items can never
   * leak when demoMode is false.
   */
  evidence(nowMs: number = Date.now()): readonly FloodEvidence[] {
    if (!this.demoMode) return this.live;
    const demo = buildDemoScenario(nowMs).floodEvidence;
    return [...this.live, ...demo];
  }

  /** A full snapshot for subscribers. */
  snapshot(nowMs: number = Date.now()): EvidenceSnapshot {
    return {
      evidence: this.evidence(nowMs),
      agentUnavailable: this.agentUnavailable,
      demoMode: this.demoMode,
    };
  }

  /** Subscribes to snapshot changes; immediately invoked. Returns unsubscribe. */
  subscribe(listener: (s: EvidenceSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

/**
 * Counts evidence resolving to a given barangay PSGC, excluding STALE items from
 * the "active" count (STALE is surfaced separately, never silently LOW). Pure.
 */
export function activeEvidenceCountFor(
  evidence: readonly FloodEvidence[],
  psgc: string,
): number {
  let n = 0;
  for (const e of evidence) {
    if (e.psgc === psgc && e.status === 'ACTIVE') n += 1;
  }
  return n;
}
