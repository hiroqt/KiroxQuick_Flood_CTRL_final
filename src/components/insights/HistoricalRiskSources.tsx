import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Source and methodology disclosure for the static Historical Flood Risk layer. */
export function HistoricalRiskSources() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className="baharoute-explore__sources baharoute-focus-ring"
        onClick={() => setOpen(true)} data-testid="historical-sources-open">
        Sources
      </button>
      {open && createPortal((
        <div className="baharoute-historical-sources-backdrop" data-testid="historical-sources-backdrop"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="baharoute-historical-sources" role="dialog" aria-modal="true"
            aria-labelledby="historical-sources-title" data-testid="historical-sources-dialog">
            <header className="baharoute-historical-sources__header">
              <div>
                <p className="baharoute-explore__summary-sub">Historical Flood Risk</p>
                <h2 id="historical-sources-title">Data sources and method</h2>
              </div>
              <button ref={closeRef} type="button" className="baharoute-icon-button baharoute-focus-ring"
                aria-label="Close sources" data-testid="historical-sources-close" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="baharoute-historical-sources__content">
              <h3>Flood hazard data</h3>
              <p><a href="https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps" target="_blank" rel="noreferrer">bettergovph / project-noah-hazard-maps</a>, Flood/5yr, 25yr, and 100yr Metro Manila shapefiles. The source is derived from UP Phil-LiDAR 1 terrain data collected around 2014–2017.</p>
              <h3>Barangay boundaries</h3>
              <p>App barangay boundaries from NAMRIA and PSA PSGC. Hazard measurements are joined to barangays by PSGC code.</p>
              <h3>Processing</h3>
              <p>Hazard polygons are projected to UTM zone 51N, rasterized to a 10 m grid with High taking priority in overlaps, and summarized by barangay. Low, Medium, and High exposed areas and percentages are retained. The runtime map uses the 100-year return period.</p>
              <h3>Classification</h3>
              <ul>
                <li><strong>High:</strong> high exposure exceeds 25%, or medium plus high exceeds 50%.</li>
                <li><strong>Moderate:</strong> medium exposure exceeds 25%, or total exposure exceeds 50%.</li>
                <li><strong>Low:</strong> some exposure, below the Moderate thresholds.</li>
                <li><strong>Unknown:</strong> no mapped hazard coverage; it does not mean flood-free.</li>
              </ul>
              <h3>Coverage and limitations</h3>
              <p>The dataset covers 1,710 NCR barangays across 17 LGUs. The terrain data predates newer drainage and development; 10 m rasterization quantizes area, and modeled susceptibility does not indicate current flooding.</p>
              <h3>Attribution and license</h3>
              <p>Flood hazard data © Project NOAH and contributors via bettergovph archive, licensed under ODbL. Boundaries © PSA (PSGC) and NAMRIA. See the <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License</a> and project attribution in LICENSE-DATA.md.</p>
            </div>
          </section>
        </div>
      ), document.body)}
    </>
  );
}

export default HistoricalRiskSources;
