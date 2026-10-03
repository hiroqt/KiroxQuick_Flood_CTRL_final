// src/components/overlays/ConfigIncomplete.tsx
//
// An accessible message shown when the Tile_Provider API key is missing at
// startup: the app shell still renders, this explains that configuration is
// incomplete and how to supply the key (Req 17.4; design → Components table:
// ConfigIncomplete, "Missing-key handling"). Purely presentational — deciding
// whether the key is present and gating tile requests is the parent's job; this
// component only renders the message. Kept drop-in compatible with the inline
// message currently in App.tsx so App can be rewired later (Task 15.2 / 18).

export interface ConfigIncompleteProps {
  /**
   * The environment variable name the user must set. Defaults to the
   * Tile_Provider key documented in .env.example. Passed in (not hardcoded to a
   * value) so no secret is embedded.
   */
  envVarName?: string;
  className?: string;
}

/**
 * Renders a `role="alert"` region explaining that map configuration is
 * incomplete and pointing the user to the example environment file. Contains no
 * secret values — only the variable name and setup guidance.
 */
export function ConfigIncomplete({
  envVarName = 'VITE_MAPBOX_ACCESS_TOKEN',
  className,
}: ConfigIncompleteProps = {}) {
  return (
    <section
      role="alert"
      className={['baharoute-config-incomplete', className]
        .filter(Boolean)
        .join(' ')}
      data-testid="config-incomplete"
    >
      <h2>Map configuration is incomplete</h2>
      <p>
        The map cannot load because the tile provider API key has not been
        configured. Set the required environment variable{' '}
        <code>{envVarName}</code> (see <code>.env.example</code>) and reload to
        view the map.
      </p>
    </section>
  );
}

export default ConfigIncomplete;
