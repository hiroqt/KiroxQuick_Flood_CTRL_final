import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RerouteOffer } from './RerouteOffer';
import { findRerouteOffer } from '../../simulation/reroute';
import { measureRoute } from '../../simulation/routeGeometry';
import { PITX_TO_MOA_REROUTES } from '../../data/fixtures/floodReroutes';
import { PITX_TO_MOA_HAZARDS } from '../../data/fixtures/driveHazards';
import { PITX_TO_MOA_ROUTE } from '../../data/fixtures/pitxToMoaRoute';

describe('RerouteOffer', () => {
  const [hazard] = PITX_TO_MOA_HAZARDS;
  const m = hazard.atM - 1000;
  const offer = findRerouteOffer(
    measureRoute(PITX_TO_MOA_ROUTE),
    m,
    hazard.id,
    PITX_TO_MOA_REROUTES,
    new Set(),
    10,
  )!;

  function renderOffer(isRetry = false) {
    const onReroute = vi.fn();
    const onKeep = vi.fn();
    const onReview = vi.fn();
    render(
      <RerouteOffer
        offer={{ ...offer, isRetry }}
        hazard={hazard}
        toHazardM={1000}
        onReroute={onReroute}
        onKeep={onKeep}
        onReview={onReview}
      />,
    );
    return { onReroute, onKeep, onReview };
  }

  it('presents two labeled route options with honest wording', async () => {
    const user = userEvent.setup();
    const { onReroute, onKeep, onReview } = renderOffer();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Reported Flooding ahead');
    expect(dialog).toHaveTextContent('unconfirmed');
    expect(dialog).not.toHaveTextContent('missed');
    // Honest wording: never "safe"/"clear"/"no risk".
    expect(dialog.textContent ?? '').not.toMatch(/\bsafe\b|\bclear\b|no risk/i);
    // Risk-aware wording: a lower-risk alternative vs. the recommended route.
    expect(dialog).toHaveTextContent('Fastest available flood-avoiding route');
    expect(dialog).toHaveTextContent('Back to route selection');

    await user.click(screen.getByRole('button', { name: /Fastest available flood-avoiding route/ }));
    expect(onReroute).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Back to route selection/ }));
    expect(onReview).toHaveBeenCalledOnce();
    expect(onKeep).not.toHaveBeenCalled();
  });

  it('tells the driver when an earlier alternative was missed', () => {
    renderOffer(true);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Earlier alternative missed. New alternative available.',
    );
  });
});

it('shows continue-or-reroute choices only for a passable flood', async () => {
  const keep = vi.fn();
  const reroute = vi.fn();
  const hazard = { id: 'passable', state: 'YELLOW' as const, atM: 500, street: 'Demo Road', passability: 'passable' as const };
  const { rerender } = render(<RerouteOffer hazard={hazard} toHazardM={900} onReroute={reroute} onKeep={keep} onRetry={vi.fn()} status="searching" />);
  expect(screen.getByRole('button', { name: /Continue on passable route/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Continue on passable route/ }));
  expect(keep).toHaveBeenCalledOnce();
  rerender(<RerouteOffer hazard={{ ...hazard, state: 'RED', passability: 'not-passable' }} toHazardM={800} onReroute={reroute} onKeep={keep} onRetry={vi.fn()} status="unavailable" />);
  expect(screen.queryByRole('button', { name: /Continue on passable route/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Find alternative routes/ })).toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Simulation keeps moving');
});
