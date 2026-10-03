import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrivingHud } from './DrivingHud';
import { computeNavState } from '../../simulation/navigation';
import { PITX_TO_MOA_DISTANCE_M, PITX_TO_MOA_MANEUVERS } from '../../data/fixtures/pitxToMoaRoute';
import { PITX_TO_MOA_HAZARDS } from '../../data/fixtures/driveHazards';

function setup(traveled: number) {
  const props = {
    nav: computeNavState(
      traveled,
      PITX_TO_MOA_DISTANCE_M,
      PITX_TO_MOA_MANEUVERS,
      PITX_TO_MOA_HAZARDS,
      10,
    ),
    camera: 'driver' as const,
    radius: 250 as const,
    onCameraChange: vi.fn(),
    onRadiusChange: vi.fn(),
    onStop: vi.fn(),
  };
  render(<DrivingHud {...props} />);
  return props;
}

describe('DrivingHud', () => {
  it('shows the next turn, trip progress, and no hazard when none is near', () => {
    setup(0);
    expect(screen.getByText('Turn left onto Quirino Avenue')).toBeInTheDocument();
    expect(screen.getByText(/ETA/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('labels a hazard ahead with state text and the demo/unconfirmed source', () => {
    setup(PITX_TO_MOA_HAZARDS[0].atM - 400);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('Reported Flooding ahead');
    expect(chip).toHaveTextContent('400 m');
    expect(chip).toHaveTextContent('DEMO — unconfirmed');
    expect(chip.textContent ?? '').not.toMatch(/safe|clear/i);
  });

  it('exposes camera + radius options and Stop as accessible buttons', async () => {
    const user = userEvent.setup();
    const props = setup(0);
    expect(screen.getByRole('button', { name: 'Driver' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Follow' }));
    expect(props.onCameraChange).toHaveBeenCalledWith('follow');
    await user.click(screen.getByRole('button', { name: '3D radius 600 meters' }));
    expect(props.onRadiusChange).toHaveBeenCalledWith(600);
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(props.onStop).toHaveBeenCalled();
  });
});

it('exposes the flood voice toggle and unsupported-browser status', async () => {
  const onVoiceToggle = vi.fn();
  const props = {
    nav: computeNavState(0, 5000, [], [], 10),
    camera: 'driver' as const,
    radius: 250 as const,
    onCameraChange: vi.fn(),
    onRadiusChange: vi.fn(),
    onStop: vi.fn(),
    onVoiceToggle,
  };
  const { rerender } = render(<DrivingHud {...props} voiceStatus="ready" />);
  const toggle = screen.getByRole('button', { name: 'Mute flood voice alerts' });
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(toggle);
  expect(onVoiceToggle).toHaveBeenCalledOnce();
  rerender(<DrivingHud {...props} voiceStatus="unavailable" />);
  expect(screen.getByRole('button', { name: 'Enable flood voice alerts' })).toBeDisabled();
  expect(screen.getByText('Voice unavailable')).toBeInTheDocument();
});

it.each(['passable', 'not-passable'] as const)('labels simulated %s floods explicitly', (passability) => {
  render(<DrivingHud
    nav={computeNavState(0, 1000, [], [{ id: 'demo', atM: 300, state: passability === 'passable' ? 'YELLOW' : 'RED', street: 'Test Road', passability }], 10)}
    camera="driver" radius={250} onCameraChange={vi.fn()} onRadiusChange={vi.fn()} onStop={vi.fn()}
  />);
  expect(screen.getByRole('status')).toHaveTextContent(`Demo flood — ${passability === 'passable' ? 'passable' : 'not passable'}`);
  expect(screen.getByRole('status')).toHaveTextContent('DEMO');
});

it('keeps the flood warning visible alongside route risk content', () => {
  render(<DrivingHud nav={computeNavState(0, 1500, [], [{ id: 'f', atM: 800, state: 'RED', street: 'Test Road' }], 10)}
    camera="driver" radius={250} onCameraChange={vi.fn()} onRadiusChange={vi.fn()} onStop={vi.fn()}>
    <div>Route risk summary</div>
  </DrivingHud>);
  expect(screen.getByRole('status')).toHaveTextContent('Reported Flooding ahead');
  expect(screen.getByText('Route risk summary')).toBeInTheDocument();
});
