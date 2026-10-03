import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import type { AppConfig } from './types/config';
import type { MapManagerLike } from './components/MapView';

const KEY_PRESENT: AppConfig = { tileKey: 'test-key-123', hasTileKey: true, demoMode: false };
const KEY_ABSENT: AppConfig = { hasTileKey: false, demoMode: false };

/** A fake MapManager so MapView can mount without a real WebGL map. */
function makeFakeManager() {
  const init = vi.fn();
  const destroy = vi.fn();
  const manager: MapManagerLike = { init, destroy };
  return { manager, init, destroy };
}

describe('App shell', () => {
  it('renders the BahaRoute heading', () => {
    render(<App config={KEY_PRESENT} mapViewProps={{ createMapManager: () => makeFakeManager().manager }} />);
    expect(screen.getByRole('heading', { name: /baharoute/i })).toBeInTheDocument();
  });

  it('renders the ConfigIncomplete overlay and does NOT mount the map when the tile key is absent', () => {
    const { init } = makeFakeManager();

    render(<App config={KEY_ABSENT} mapViewProps={{ createMapManager: () => makeFakeManager().manager }} />);

    // Heading still renders.
    expect(screen.getByRole('heading', { name: /baharoute/i })).toBeInTheDocument();
    // Config-incomplete is now rendered via the ConfigIncomplete overlay
    // component (role="alert" + its testid), not an inline message.
    const configIncomplete = screen.getByTestId('config-incomplete');
    expect(configIncomplete).toBeInTheDocument();
    expect(configIncomplete).toHaveAttribute('role', 'alert');
    expect(screen.getByText(/map configuration is incomplete/i)).toBeInTheDocument();
    // No map container is mounted → no tile request happens.
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    // MapManager.init was never called.
    expect(init).not.toHaveBeenCalled();
  });

  it('renders MapView, the controls, and initializes the map when the tile key is present', () => {
    const { manager, init } = makeFakeManager();

    render(<App config={KEY_PRESENT} mapViewProps={{ createMapManager: () => manager }} />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('map-controls')).toBeInTheDocument();
    expect(screen.queryByTestId('config-incomplete')).not.toBeInTheDocument();
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('uses the injected loadConfig when no config prop is given', () => {
    const { manager, init } = makeFakeManager();
    const loadConfig = vi.fn(() => KEY_PRESENT);

    render(<App loadConfig={loadConfig} mapViewProps={{ createMapManager: () => manager }} />);

    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
  });
});
