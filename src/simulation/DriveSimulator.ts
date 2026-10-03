// src/simulation/DriveSimulator.ts
//
// Plays a vehicle along a route at a fixed speed (demo only). Emits one frame
// per animation tick with the position, heading and distance traveled. The
// animation-frame scheduler is injectable so tests can step it manually.

import {
  headingAlong,
  measureRoute,
  pointAlong,
  type LngLat,
  type MeasuredRoute,
} from './routeGeometry';

/** Simulated driving speed: ~30 km/h, a typical Metro Manila average. */
export const SIM_SPEED_MPS = 30 / 3.6;
/** Demo playback multiplier. */
export const SIM_PLAYBACK_RATE = 4;
export const SIM_PLAYBACK_RATE_OPTIONS = [2, 2.5, 3, 4] as const;
export type SimPlaybackRate = (typeof SIM_PLAYBACK_RATE_OPTIONS)[number];

export interface DriveFrame {
  position: LngLat;
  /** Heading in degrees, 0 = north. */
  bearing: number;
  traveledM: number;
  lengthM: number;
}

export interface Scheduler {
  request(cb: (timeMs: number) => void): number;
  cancel(id: number): void;
}

const browserScheduler: Scheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export interface DriveSimulatorOptions {
  route: ReadonlyArray<LngLat>;
  onFrame: (frame: DriveFrame) => void;
  onFinish?: () => void;
  speedMps?: number;
  playbackRate?: number;
  scheduler?: Scheduler;
}

export class DriveSimulator {
  private readonly route: MeasuredRoute;
  private metersPerMs: number;
  private readonly scheduler: Scheduler;
  private frameId: number | null = null;
  private lastTime: number | null = null;

  constructor(private readonly options: DriveSimulatorOptions) {
    this.route = measureRoute(options.route);
    const speed = options.speedMps ?? SIM_SPEED_MPS;
    const rate = options.playbackRate ?? SIM_PLAYBACK_RATE;
    this.metersPerMs = (speed * rate) / 1000;
    this.scheduler = options.scheduler ?? browserScheduler;
  }

  /** Changes playback speed while preserving the current route position. */
  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return;
    this.metersPerMs = ((this.options.speedMps ?? SIM_SPEED_MPS) * rate) / 1000;
  }

  get running(): boolean {
    return this.frameId !== null;
  }

  /**
   * Starts playback, optionally part-way along the route (used when joining a
   * reroute at the vehicle's current position, without a jump).
   */
  start(fromM = 0): void {
    this.stop();
    this.lastTime = null;
    this.traveledM = Math.max(0, Math.min(this.route.length, fromM));
    this.emit(this.traveledM);
    this.frameId = this.scheduler.request(this.tick);
  }

  /** Stops playback without firing onFinish. Safe to call repeatedly. */
  stop(): void {
    if (this.frameId !== null) this.scheduler.cancel(this.frameId);
    this.frameId = null;
    this.paused = false;
  }

  /** Meters traveled so far (frozen while paused). */
  private traveledM = 0;
  private paused = false;
  /** True while paused (e.g. waiting for a reroute decision). */
  get isPaused(): boolean {
    return this.paused;
  }

  /** Freezes the vehicle in place; {@link resume} continues from here. */
  pause(): void {
    if (this.frameId === null) return;
    this.scheduler.cancel(this.frameId);
    this.frameId = null;
    this.paused = true;
  }

  /** Continues after {@link pause} without jumping ahead. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    // Re-anchor the clock so time spent paused doesn't count as distance.
    this.lastTime = null;
    this.frameId = this.scheduler.request(this.tick);
  }

  private readonly tick = (timeMs: number): void => {
    const elapsedMs = this.lastTime === null ? 0 : Math.max(0, timeMs - this.lastTime);
    this.lastTime = timeMs;
    const traveled = Math.min(this.route.length, this.traveledM + elapsedMs * this.metersPerMs);
    this.traveledM = traveled;
    this.emit(traveled);
    // onFrame may have paused or stopped us; don't schedule another frame.
    if (this.paused || this.frameId === null) return;
    if (traveled >= this.route.length) {
      this.frameId = null;
      this.options.onFinish?.();
      return;
    }
    this.frameId = this.scheduler.request(this.tick);
  };

  private emit(traveledM: number): void {
    this.options.onFrame({
      position: pointAlong(this.route, traveledM),
      bearing: headingAlong(this.route, traveledM),
      traveledM,
      lengthM: this.route.length,
    });
  }
}
