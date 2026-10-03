import { HISTORICAL_EVIDENCE_LAYER_ID } from './historicalEvidenceLayer';
import type { BarangayLayerClickEvent, BarangayPopupMap } from './barangayPopup';

/** Connect archive markers to the same selection used by the evidence list. */
export function installHistoricalEvidenceSelection(
  map: BarangayPopupMap,
  onSelect: (id: string) => void,
): () => void {
  const onClick = (event: BarangayLayerClickEvent): void => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === 'string' && id) onSelect(id);
  };
  const onEnter = (): void => {
    const canvas = map.getCanvas?.();
    if (canvas) canvas.style.cursor = 'pointer';
  };
  const onLeave = (): void => {
    const canvas = map.getCanvas?.();
    if (canvas) canvas.style.cursor = '';
  };
  map.on('click', HISTORICAL_EVIDENCE_LAYER_ID, onClick);
  map.on('mouseenter', HISTORICAL_EVIDENCE_LAYER_ID, onEnter);
  map.on('mouseleave', HISTORICAL_EVIDENCE_LAYER_ID, onLeave);
  return () => {
    map.off('click', HISTORICAL_EVIDENCE_LAYER_ID, onClick);
    map.off('mouseenter', HISTORICAL_EVIDENCE_LAYER_ID, onEnter);
    map.off('mouseleave', HISTORICAL_EVIDENCE_LAYER_ID, onLeave);
  };
}
