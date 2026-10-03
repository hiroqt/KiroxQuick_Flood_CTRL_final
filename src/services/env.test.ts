import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';

describe('loadConfig', () => {
  it('sets hasTileKey=true and trims a non-empty key', () => {
    const config = loadConfig({ VITE_MAPBOX_ACCESS_TOKEN: '  abc123  ' });
    expect(config.hasTileKey).toBe(true);
    expect(config.tileKey).toBe('abc123');
  });

  it('sets hasTileKey=false when the key is undefined and does not throw', () => {
    const config = loadConfig({});
    expect(config.hasTileKey).toBe(false);
    expect(config.tileKey).toBeUndefined();
  });

  it('sets hasTileKey=false for an empty-string key', () => {
    const config = loadConfig({ VITE_MAPBOX_ACCESS_TOKEN: '' });
    expect(config.hasTileKey).toBe(false);
    expect(config.tileKey).toBeUndefined();
  });

  it('sets hasTileKey=false for a whitespace-only key', () => {
    const config = loadConfig({ VITE_MAPBOX_ACCESS_TOKEN: '   \t\n ' });
    expect(config.hasTileKey).toBe(false);
    expect(config.tileKey).toBeUndefined();
  });

  it('does not throw when reading from an env with no key present', () => {
    expect(() => loadConfig({})).not.toThrow();
  });

  it('defaults to reading import.meta.env without throwing', () => {
    // No key is set in the test env; the loader must degrade gracefully.
    expect(() => loadConfig()).not.toThrow();
    expect(typeof loadConfig().hasTileKey).toBe('boolean');
  });

  it('demoMode defaults to false when VITE_DEMO_MODE is absent', () => {
    expect(loadConfig({}).demoMode).toBe(false);
    expect(loadConfig({ VITE_MAPBOX_ACCESS_TOKEN: 'abc' }).demoMode).toBe(false);
  });

  it('demoMode is true ONLY for the exact string "true"', () => {
    expect(loadConfig({ VITE_DEMO_MODE: 'true' }).demoMode).toBe(true);
    expect(loadConfig({ VITE_DEMO_MODE: ' true ' }).demoMode).toBe(true);
    expect(loadConfig({ VITE_DEMO_MODE: 'TRUE' }).demoMode).toBe(false);
    expect(loadConfig({ VITE_DEMO_MODE: '1' }).demoMode).toBe(false);
    expect(loadConfig({ VITE_DEMO_MODE: 'yes' }).demoMode).toBe(false);
  });
});
