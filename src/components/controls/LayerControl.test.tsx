// src/components/controls/LayerControl.test.tsx
//
// Verifies the LayerControl presentation component (Req 9.1, 9.3, 9.4, 9.5,
// 11.1–11.4):
// - given the seven fixture layers, renders one labeled toggle per layer with
//   its text label, all through the same toggle interaction (Req 9.1, 9.4);
// - toggling a layer calls onToggle(id, newVisible) and updates the checkbox
//   state, and does not throw (Req 9.2);
// - an empty layers array renders with no error and no toggles (Req 9.3);
// - each toggle is keyboard-operable, has an accessible name, and conveys its
//   on/off state via the native checkbox + text — not color alone
//   (Req 9.5, 11.1–11.4).

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LayerControl } from './LayerControl';
import { FixtureDataSource } from '../../services/FixtureDataSource';
import type { DataLayerMeta } from '../../types/layer';

const fixtureLayers: DataLayerMeta[] = new FixtureDataSource().listLayers();

/** Escapes regex-special characters so a label can be matched literally. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('LayerControl', () => {
  it('renders one labeled toggle per fixture layer', () => {
    render(<LayerControl layers={fixtureLayers} onToggle={vi.fn()} />);

    // One checkbox per layer, no more, no fewer.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(fixtureLayers.length);
    expect(fixtureLayers.length).toBe(8);

    // Each layer surfaces its human text label and a checkbox named by it.
    for (const meta of fixtureLayers) {
      expect(screen.getByText(meta.label)).toBeInTheDocument();
      // The checkbox's accessible name is derived from its associated label
      // text (which includes the state suffix), so match the label as a
      // substring rather than the whole name.
      expect(
        screen.getByRole('checkbox', {
          name: new RegExp(escapeRegExp(meta.label)),
        }),
      ).toBeInTheDocument();
    }
  });

  it('seeds each checkbox from the layer defaultVisible', () => {
    render(<LayerControl layers={fixtureLayers} onToggle={vi.fn()} />);

    for (const meta of fixtureLayers) {
      const checkbox = screen.getByTestId(`layer-checkbox-${meta.id}`);
      expect((checkbox as HTMLInputElement).checked).toBe(meta.defaultVisible);
    }
  });

  it('calls onToggle with (id, newVisible) and updates the checkbox state', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<LayerControl layers={fixtureLayers} onToggle={onToggle} />);

    const target = fixtureLayers[0];
    const checkbox = screen.getByTestId(
      `layer-checkbox-${target.id}`,
    ) as HTMLInputElement;
    const before = checkbox.checked;

    await user.click(checkbox);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(target.id, !before);
    expect(checkbox.checked).toBe(!before);

    // Toggling back flips again and reports the new value.
    await user.click(checkbox);
    expect(onToggle).toHaveBeenLastCalledWith(target.id, before);
    expect(checkbox.checked).toBe(before);
  });

  it('does not throw when toggled repeatedly', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<LayerControl layers={fixtureLayers} onToggle={onToggle} />);

    const checkbox = screen.getByTestId(`layer-checkbox-${fixtureLayers[0].id}`);

    await expect(
      (async () => {
        for (let i = 0; i < 5; i++) {
          await user.click(checkbox);
        }
      })(),
    ).resolves.toBeUndefined();

    expect(onToggle).toHaveBeenCalledTimes(5);
  });

  it('is keyboard-operable: Tab to a toggle and activate with Space', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<LayerControl layers={fixtureLayers} onToggle={onToggle} />);

    const first = screen.getByTestId(
      `layer-checkbox-${fixtureLayers[0].id}`,
    ) as HTMLInputElement;
    const before = first.checked;

    await user.tab();
    expect(first).toHaveFocus();

    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith(fixtureLayers[0].id, !before);
    expect(first.checked).toBe(!before);
  });

  it('conveys on/off state with non-color text in addition to the checkbox', async () => {
    const user = userEvent.setup();
    render(<LayerControl layers={fixtureLayers} onToggle={vi.fn()} />);

    const target = fixtureLayers[0];
    const checkbox = screen.getByTestId(
      `layer-checkbox-${target.id}`,
    ) as HTMLInputElement;
    const stateText = screen.getByTestId(`layer-state-${target.id}`);

    expect(stateText).toHaveTextContent(checkbox.checked ? 'On' : 'Off');

    await user.click(checkbox);
    expect(stateText).toHaveTextContent(checkbox.checked ? 'On' : 'Off');
  });

  it('renders every layer through the same toggle interaction (uniform entries)', () => {
    render(<LayerControl layers={fixtureLayers} onToggle={vi.fn()} />);

    // Every entry is a checkbox inside a labeled list item — no special-cased
    // control for any single layer (Req 9.4).
    for (const meta of fixtureLayers) {
      const item = screen.getByTestId(`layer-item-${meta.id}`);
      expect(
        within(item).getByRole('checkbox'),
      ).toBeInTheDocument();
    }
  });

  it('renders an empty list with no error and no toggles when layers is empty', () => {
    render(<LayerControl layers={[]} onToggle={vi.fn()} />);

    // Container present.
    expect(screen.getByTestId('layer-control')).toBeInTheDocument();
    // No toggles.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    // No error/alert state.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // A subtle empty note, not an error.
    expect(screen.getByTestId('layer-control-empty')).toBeInTheDocument();
  });

  it('honors an initialVisibility override over defaultVisible', () => {
    const target = fixtureLayers[0];
    render(
      <LayerControl
        layers={fixtureLayers}
        onToggle={vi.fn()}
        initialVisibility={{ [target.id]: !target.defaultVisible }}
      />,
    );

    const checkbox = screen.getByTestId(
      `layer-checkbox-${target.id}`,
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(!target.defaultVisible);
  });
});
