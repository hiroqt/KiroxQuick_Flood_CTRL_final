// src/components/trip/RouteComparePanel.test.tsx
//
// The COMPARE step: route cards show ETA/distance/flood-risk/reports/closures +
// "Why this route?", the recommended route is preselected, Start is the only
// way forward, and a route is never labeled "safe".

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RouteComparePanel, recommendationLabel } from './RouteComparePanel';
import { compareRoutes, planRoutes } from '../../services/routePlanning';
import * as resolution from '../../services/reportResolution';
import { PITX_TO_MOA_ROUTE } from '../../data/fixtures/pitxToMoaRoute';

beforeEach(() => { vi.spyOn(resolution, 'resolveBarangayForPoint').mockReturnValue('test-barangay'); });
afterEach(() => vi.restoreAllMocks());

const PITX = PITX_TO_MOA_ROUTE[0];
const MOA = PITX_TO_MOA_ROUTE[PITX_TO_MOA_ROUTE.length - 1];

async function demoOptions() {
  return compareRoutes(await planRoutes(PITX, MOA), { dataUnavailable: false, riskByBarangay: () => 'LOW' });
}

describe('recommendationLabel', () => {
  it('maps recommendation keys to commuter-facing labels (never "safe")', () => {
    expect(recommendationLabel('recommended')).toBe('Recommended');
    expect(recommendationLabel('lowerRiskAlternative')).toBe('Lower-risk alternative');
    expect(recommendationLabel('higherFloodExposure')).toBe('Higher flood exposure');
    expect(recommendationLabel('unavailable')).toBe('Current information unavailable');
    for (const rec of ['recommended', 'lowerRiskAlternative', 'higherFloodExposure', 'alternative', 'unavailable'] as const) {
      expect(recommendationLabel(rec).toLowerCase()).not.toMatch(/\bsafe\b/);
    }
  });
});

describe('RouteComparePanel', () => {
  it('visibly identifies the chosen route and starts that route after selection', async () => {
    const options = await demoOptions();
    const onStart = vi.fn();
    render(<RouteComparePanel options={options} onStart={onStart} onBack={vi.fn()} />);
    const user = userEvent.setup();
    expect(screen.getByTestId('selected-route-status')).toHaveTextContent(options[0].candidate.label);
    await user.click(screen.getByTestId(`route-card-${options[1].candidate.id}`));
    expect(screen.getByTestId('selected-route-status')).toHaveTextContent(options[1].candidate.label);
    expect(screen.getByTestId(`route-card-${options[1].candidate.id}`)).toHaveTextContent('✓ Selected');
    expect(screen.getByTestId(`route-card-${options[0].candidate.id}`)).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByTestId('start-route-button'));
    expect(onStart).toHaveBeenCalledWith(options[1]);
  });

  it('explains when a second distinct route is unavailable', async () => {
    render(<RouteComparePanel options={(await demoOptions()).slice(0, 1)} onStart={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('route-alternative-unavailable')).toBeInTheDocument();
  });

  it('renders a card per route with flood-risk, reports and closures', async () => {
    const options = await demoOptions();
    render(<RouteComparePanel options={options} onStart={vi.fn()} onBack={vi.fn()} />);
    for (const o of options) {
      expect(screen.getByTestId(`route-card-${o.candidate.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`route-risk-${o.candidate.id}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Confirmed closures').length).toBe(options.length);
    expect(screen.getAllByText('Higher-risk segments').length).toBe(options.length);
  });

  it('preselects the first (recommended) option and Starts it', async () => {
    const options = await demoOptions();
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<RouteComparePanel options={options} onStart={onStart} onBack={vi.fn()} />);
    await user.click(screen.getByTestId('start-route-button'));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0].candidate.id).toBe(options[0].candidate.id);
  });

  it('lets the user select a different route before starting', async () => {
    const options = await demoOptions();
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<RouteComparePanel options={options} onStart={onStart} onBack={vi.fn()} />);
    const second = options[1];
    await user.click(screen.getByTestId(`route-card-${second.candidate.id}`));
    await user.click(screen.getByTestId('start-route-button'));
    expect(onStart.mock.calls[0][0].candidate.id).toBe(second.candidate.id);
  });

  it('renders a "Why this route?" section', async () => {
    render(<RouteComparePanel options={await demoOptions()} onStart={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getAllByText('Why this route?').length).toBeGreaterThan(0);
  });

  it('invokes onBack from the back button', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<RouteComparePanel options={await demoOptions()} onStart={vi.fn()} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: /back to search/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('RouteComparePanel — travel mode + preference controls', () => {
  it('shows Drive/Bike/Walk with Drive active by default and fires onModeChange', async () => {
    const options = await demoOptions();
    const onModeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RouteComparePanel
        options={options}
        onStart={vi.fn()}
        onBack={vi.fn()}
        onModeChange={onModeChange}
      />,
    );
    expect(screen.getByTestId('travel-mode-group')).toBeInTheDocument();
    expect(screen.getByTestId('travel-mode-drive')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByTestId('travel-mode-bike'));
    expect(onModeChange).toHaveBeenCalledWith('bike');
  });

  it('shows route-preference controls (Lower flood exposure default) and fires onPreferenceChange', async () => {
    const options = await demoOptions();
    const onPreferenceChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RouteComparePanel
        options={options}
        onStart={vi.fn()}
        onBack={vi.fn()}
        preference="lowerFloodExposure"
        onPreferenceChange={onPreferenceChange}
      />,
    );
    expect(
      screen.getByTestId('route-preference-lowerFloodExposure'),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByTestId('route-preference-faster'));
    expect(onPreferenceChange).toHaveBeenCalledWith('faster');
  });

  it('shows a Finding routes… state while finding', () => {
    render(<RouteComparePanel options={[]} onStart={vi.fn()} onBack={vi.fn()} finding />);
    expect(screen.getByTestId('routes-finding')).toBeInTheDocument();
  });

  it('shows "No route available for this travel mode." when empty and not finding', () => {
    render(<RouteComparePanel options={[]} onStart={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('routes-empty')).toBeInTheDocument();
  });
});

describe('RouteComparePanel — confirmed closure blocks Start', () => {
  /** Options where the (only) route passes a confirmed closure. */
  async function closedOptions() {
    const candidate = (await planRoutes(PITX, MOA))[0];
    const closed = new Set<string>();
    compareRoutes([candidate], {
      riskByBarangay: (psgc) => {
        closed.add(psgc);
        return 'LOW';
      },
    });
    return compareRoutes([candidate], { closedBarangays: closed });
  }

  it('disables Start + shows a closure note when the selected route is closed', async () => {
    const options = await closedOptions();
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<RouteComparePanel options={options} onStart={onStart} onBack={vi.fn()} />);
    await user.click(screen.getByTestId(`route-card-${options[0].candidate.id}`));
    expect(screen.getByTestId('start-blocked-note')).toBeInTheDocument();
    const startBtn = screen.getByTestId('start-route-button') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
    await user.click(startBtn);
    expect(onStart).not.toHaveBeenCalled();
    expect(
      screen.getByTestId(`route-closure-${options[0].candidate.id}`),
    ).toBeInTheDocument();
  });
});


it('selects Route B as an unlabeled fallback when no validated default qualifies', async () => {
  const candidates = await planRoutes(PITX, MOA);
  const options = compareRoutes(candidates, { dataUnavailable: true });
  const routeB = options.find((o) => o.candidate.id === 'pitx-moa-lowrisk')!;
  const onStart = vi.fn();
  render(<RouteComparePanel options={options} onStart={onStart} onBack={vi.fn()} />);
  expect(screen.queryByTestId('default-route-unavailable')).not.toBeInTheDocument();
  expect(screen.getByTestId('selected-route-status')).toHaveTextContent(routeB.candidate.label);
  expect(screen.getByTestId(`route-card-${routeB.candidate.id}`)).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByTestId(`route-badge-${routeB.candidate.id}`)).not.toHaveTextContent('Recommended');
  expect(screen.queryByText(/default/i)).not.toBeInTheDocument();
  expect(screen.getByTestId('start-route-button')).toBeEnabled();
  await userEvent.setup().click(screen.getByTestId('start-route-button'));
  expect(onStart).toHaveBeenCalledWith(routeB);
});

it('keeps a fallback Route B blocked when it has a confirmed closure', async () => {
  const options = compareRoutes(await planRoutes(PITX, MOA), {
    closedBarangays: new Set(['test-barangay']),
  });
  render(<RouteComparePanel options={options} onStart={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByTestId('route-card-pitx-moa-lowrisk')).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByTestId('start-route-button')).toBeDisabled();
  expect(screen.getByTestId('start-blocked-note')).toBeInTheDocument();
});


it('selects recommended Route A before Route B, including when it becomes available later', async () => {
  const candidates = (await planRoutes(PITX, MOA)).map((candidate) => ({
    ...candidate,
    hazards: [],
    durationS: candidate.id === 'pitx-moa-primary' ? 300 : 900,
  }));
  const unknown = compareRoutes(candidates, { dataUnavailable: true });
  const verified = compareRoutes(candidates, { riskByBarangay: () => 'LOW' });
  const routeA = verified.find((o) => o.candidate.id === 'pitx-moa-primary')!;
  expect(routeA.recommendation).toBe('recommended');
  const onStart = vi.fn();
  const { rerender } = render(<RouteComparePanel options={unknown} onStart={onStart} onBack={vi.fn()} />);
  expect(screen.getByTestId('route-card-pitx-moa-lowrisk')).toHaveAttribute('aria-checked', 'true');
  // Recommendation selection is independent of the cards' display order.
  rerender(<RouteComparePanel options={[...verified].reverse()} onStart={onStart} onBack={vi.fn()} />);
  expect(screen.getByTestId('route-card-pitx-moa-primary')).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByTestId('route-card-pitx-moa-lowrisk')).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByTestId('selected-route-status')).toHaveTextContent(routeA.candidate.label);
  await userEvent.setup().click(screen.getByTestId('start-route-button'));
  expect(onStart).toHaveBeenCalledWith(routeA);
});


it('shows the decision trade-offs when different roads have the same LOW flood assessment', async () => {
  const candidates = (await planRoutes(PITX, MOA)).map((candidate) => ({ ...candidate, hazards: [] }));
  const options = compareRoutes(candidates, { riskByBarangay: () => 'LOW' });
  render(<RouteComparePanel options={options} onStart={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByTestId('same-flood-assessment')).toHaveTextContent('no measured flood advantage');
  for (const option of options.slice(1)) {
    expect(screen.getByTestId(`route-tradeoff-${option.candidate.id}`)).toHaveTextContent('shared road corridor');
    expect(screen.getByTestId(`route-tradeoff-${option.candidate.id}`)).toHaveTextContent('different roads');
  }
});


it('displays A, B, C even when ranking is C, B, A, while keeping C selected', async () => {
  const candidates = (await planRoutes(PITX, MOA)).map((candidate) => ({
    ...candidate, hazards: [], durationS: candidate.id === 'pitx-moa-longer' ? 300 : 900,
  }));
  const ranked = compareRoutes(candidates, { riskByBarangay: () => 'LOW' });
  const routeC = ranked.find((o) => o.candidate.id === 'pitx-moa-longer')!;
  const routeB = ranked.find((o) => o.candidate.id === 'pitx-moa-lowrisk')!;
  const routeA = ranked.find((o) => o.candidate.id === 'pitx-moa-primary')!;
  render(<RouteComparePanel options={[routeC, routeB, routeA]} onStart={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getAllByRole('radio').map((card) => card.getAttribute('data-testid'))).toEqual([
    'route-card-pitx-moa-primary', 'route-card-pitx-moa-lowrisk', 'route-card-pitx-moa-longer',
  ]);
  expect(screen.getByTestId('route-card-pitx-moa-longer')).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByTestId('route-tradeoff-pitx-moa-primary')).toHaveTextContent(`Compared with ${routeC.candidate.label}`);
});

it('puts the opposite demo conditions in different route cards', async () => {
  render(<RouteComparePanel options={await demoOptions()} onStart={vi.fn()} onBack={vi.fn()} />);
  const routeA = screen.getByTestId('route-card-pitx-moa-primary');
  const routeB = screen.getByTestId('route-card-pitx-moa-lowrisk');
  const routeC = screen.getByTestId('route-card-pitx-moa-longer');
  expect(routeA).toHaveTextContent('DEMO — simulated flood: Not passable');
  expect(routeB).toHaveTextContent('DEMO — simulated flood: Passable');
  expect(routeC).not.toHaveTextContent('DEMO — simulated flood');
});
