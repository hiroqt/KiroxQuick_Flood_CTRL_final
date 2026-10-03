import { describe, expect, it, vi } from 'vitest';
import { FloodVoiceAgent, type FloodSpeech } from './floodVoiceAgent';
import { measureRoute, pointAlong } from '../simulation/routeGeometry';
import type { DriveHazard } from '../data/fixtures/driveHazards';

const route = measureRoute([
  [120.98, 14.5],
  [120.98, 14.53],
]);
const hazards: DriveHazard[] = [
  { id: 'one', atM: 2000, state: 'RED', street: 'Roxas Boulevard' },
  { id: 'two', atM: 3000, state: 'YELLOW', street: 'EDSA' },
];
const frame = (traveledM: number) => ({
  traveledM,
  lengthM: route.length,
  position: pointAlong(route, traveledM),
  bearing: 0,
});
function setup() {
  const speech: FloodSpeech = { speak: vi.fn(), cancel: vi.fn() };
  const status = vi.fn();
  const agent = new FloodVoiceAgent(status, () => speech);
  agent.start();
  vi.mocked(speech.speak).mockClear();
  return { agent, speech, status };
}

describe('FloodVoiceAgent', () => {
  it('warns at the 900m radius and only once per hazard per trip', () => {
    const { agent, speech } = setup();
    agent.update(frame(1099), route, hazards);
    expect(speech.speak).not.toHaveBeenCalled();
    agent.update(frame(1100.01), route, hazards);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(vi.mocked(speech.speak).mock.calls[0][0]).toContain(
      'Demo alert, unconfirmed. Flooding reported on Roxas Boulevard, about 900 meters ahead.',
    );
    agent.update(frame(1500), route, hazards);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    agent.update(frame(2101), route, hazards);
    expect(speech.speak).toHaveBeenCalledTimes(2);
    expect(vi.mocked(speech.speak).mock.calls[1][0]).toContain('Possible flooding on EDSA');
  });

  it('uses geographic radius even when the route bends more than 900m ahead', () => {
    const bent = measureRoute([
      [120.98, 14.5],
      [120.99, 14.5],
      [120.99, 14.505],
      [120.98, 14.505],
    ]);
    const { agent, speech } = setup();
    agent.update(
      { position: bent.points[0], traveledM: 0, lengthM: bent.length, bearing: 90 },
      bent,
      [{ ...hazards[0], atM: bent.length }],
    );
    expect(speech.speak).toHaveBeenCalledTimes(1);
  });

  it('ignores passed hazards and cancels speech on mute, stop, and reroute', () => {
    const { agent, speech } = setup();
    agent.update(frame(2001), route, [hazards[0]]);
    expect(speech.speak).not.toHaveBeenCalled();
    agent.setEnabled(false);
    agent.update(frame(1500), route, hazards);
    expect(speech.speak).not.toHaveBeenCalled();
    agent.setEnabled(true);
    vi.mocked(speech.speak).mockClear();
    agent.update(frame(1500), route, hazards);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    agent.cancelPending();
    agent.stop();
    agent.update(frame(2200), route, hazards);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.cancel).toHaveBeenCalled();
    agent.start();
    vi.mocked(speech.speak).mockClear();
    agent.update(frame(1500), route, hazards);
    expect(speech.speak).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported speech and playback errors without breaking navigation', () => {
    const status = vi.fn();
    const unsupported = new FloodVoiceAgent(status, () => null);
    unsupported.start();
    unsupported.update(frame(1500), route, hazards);
    expect(status).toHaveBeenLastCalledWith('unavailable');
    const { agent, speech, status: playbackStatus } = setup();
    agent.update(frame(1500), route, hazards);
    vi.mocked(speech.speak).mock.calls[0][1]();
    expect(playbackStatus).toHaveBeenLastCalledWith('error');
    expect(speech.cancel).toHaveBeenCalled();
  });
});
