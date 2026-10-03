import type { DriveHazard } from '../data/fixtures/driveHazards';
import type { DriveFrame } from '../simulation/DriveSimulator';
import type { MeasuredRoute } from '../simulation/routeGeometry';
import { nearbyFloods, FLOOD_ALERT_RADIUS_M } from '../simulation/floodProximity';

export const FLOOD_VOICE_RADIUS_M = FLOOD_ALERT_RADIUS_M;
export type FloodVoiceStatus = 'ready' | 'muted' | 'unavailable' | 'error';

/** Browser speech adapter; injectable so proximity and playback can be tested. */
export interface FloodSpeech {
  speak(text: string, onError: () => void): void;
  cancel(): void;
}

function browserSpeech(): FloodSpeech | null {
  if (
    typeof window === 'undefined' ||
    !window.speechSynthesis ||
    typeof window.SpeechSynthesisUtterance !== 'function'
  )
    return null;
  return {
    speak(text, onError) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-PH';
      utterance.rate = 0.95;
      utterance.onerror = (event) => {
        if (event.error !== 'canceled' && event.error !== 'interrupted') onError();
      };
      window.speechSynthesis.speak(utterance);
    },
    cancel: () => window.speechSynthesis.cancel(),
  };
}

/** One announcement per approaching hazard per trip, independent of HUD rounding. */
export class FloodVoiceAgent {
  private speech: FloodSpeech | null = null;
  private enabled = false;
  private warned = new Set<string>();
  private generation = 0;

  constructor(
    private readonly onStatus: (status: FloodVoiceStatus) => void,
    private readonly getSpeech: () => FloodSpeech | null = browserSpeech,
  ) {}

  /** Called from the Start/voice button gesture to activate browser audio. */
  start(): void {
    this.stop();
    this.warned.clear();
    this.speech = this.getSpeech();
    if (!this.speech) {
      this.onStatus('unavailable');
      return;
    }
    this.enabled = true;
    this.onStatus('ready');
    this.say('Flood voice alerts on. I will warn you about flood reports ahead within 900 meters.');
  }

  setEnabled(enabled: boolean): void {
    if (enabled) {
      if (!this.speech) this.speech = this.getSpeech();
      if (!this.speech) {
        this.onStatus('unavailable');
        return;
      }
      this.enabled = true;
      this.onStatus('ready');
      this.say('Flood voice alerts on.');
    } else {
      this.stop();
      this.onStatus('muted');
    }
  }

  /** Stop pending speech on reroute, mute, trip completion, or unmount. */
  cancelPending(): void {
    this.generation += 1;
    this.speech?.cancel();
  }

  stop(): void {
    this.enabled = false;
    this.cancelPending();
  }

  update(frame: DriveFrame, route: MeasuredRoute, hazards: ReadonlyArray<DriveHazard>): void {
    if (!this.enabled || !this.speech) return;
    const nearby = nearbyFloods(frame.traveledM, route, hazards, frame.position);
    if (nearby.some(({ hazard }) => !this.warned.has(hazard.id))) this.cancelPending();
    for (const { hazard, distance } of nearby) {
      if (this.warned.has(hazard.id)) continue;
      this.warned.add(hazard.id);
      const condition =
        hazard.passability
          ? `${hazard.isDemo === false ? 'Reported flood' : 'Simulated flood'}, ${hazard.passability === 'passable' ? 'passable' : 'not passable'}`
          : hazard.state === 'RED'
          ? 'Flooding reported'
          : hazard.state === 'ORANGE'
            ? 'Likely flooding'
            : 'Possible flooding';
      const location =
        distance < 15
          ? 'immediately ahead'
          : `about ${Math.round(distance / 10) * 10} meters ahead`;
      this.say(
        `${hazard.isDemo === false ? 'Flood alert.' : 'Demo alert, unconfirmed.'} ${condition} on ${hazard.street}, ${location}. ${hazard.passability === 'passable' ? 'Choose whether to continue or reroute.' : 'Choose a flood-avoiding alternative route.'}`,
      );
    }
  }

  private say(text: string): void {
    if (!this.enabled || !this.speech) return;
    const generation = this.generation;
    try {
      this.speech?.speak(text, () => {
        if (generation !== this.generation) return;
        this.stop();
        this.warned.clear();
        this.onStatus('error');
      });
    } catch {
      this.stop();
      this.warned.clear();
      this.onStatus('error');
    }
  }
}
