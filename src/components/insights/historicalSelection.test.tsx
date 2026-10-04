import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoricalEvidencePanel } from './HistoricalEvidencePanel';
import { HistoricalExplorePanel } from './HistoricalExplorePanel';
import { historicalFloodEvidence } from '../../data/historical/historicalFloodEvidence';
import { historicalRiskRecords } from '../../data/historical/ncrHistoricalFloodRisk';

describe('historical panel selection', () => {
  it('moves the selected card and record details when another marker is selected', () => {
    const [first, second] = historicalFloodEvidence;
    const { rerender } = render(
      <HistoricalEvidencePanel evidence={historicalFloodEvidence} selectedId={first.id} />,
    );
    expect(screen.getByTestId(`historical-item-${first.id}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('historical-selected-record')).toHaveTextContent(first.title);
    rerender(<HistoricalEvidencePanel evidence={historicalFloodEvidence} selectedId={second.id} />);
    expect(screen.getByTestId(`historical-item-${first.id}`)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId(`historical-item-${second.id}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('historical-selected-record')).toHaveTextContent(second.title);
    rerender(<HistoricalEvidencePanel evidence={historicalFloodEvidence} selectedId={null} />);
    expect(screen.queryByTestId('historical-selected-record')).toBeNull();
  });

  it('keeps selected details visible when list filters exclude the record', async () => {
    const user = userEvent.setup();
    const first = historicalFloodEvidence[0];
    render(<HistoricalEvidencePanel evidence={historicalFloodEvidence} selectedId={first.id} />);
    await user.selectOptions(screen.getByTestId('historical-filter-precision'), 'UNRESOLVED');
    expect(screen.queryByTestId(`historical-item-${first.id}`)).toBeNull();
    expect(screen.getByTestId('historical-selected-record')).toHaveTextContent(first.title);
  });

  it('opens details for the barangay selected by the panel filter', async () => {
    const user = userEvent.setup();
    const record = historicalRiskRecords[0];
    const open = vi.fn();
    render(
      <HistoricalExplorePanel
        filter={{
          view: 'barangay',
          cityPsgc: record.cityPsgc,
          barangayPsgc: record.psgc,
          risk: 'all',
        }}
        onFilterChange={vi.fn()}
        onOpenBarangay={open}
      />,
    );
    expect(screen.getByTestId('historical-selected-area')).toHaveTextContent(record.name);
    await user.click(screen.getByRole('button', { name: 'View historical details' }));
    expect(open).toHaveBeenCalledWith(record.psgc);
  });

  it('renders drag handle and collapses to reopen button when dragged down', async () => {
    const user = userEvent.setup();
    render(<HistoricalEvidencePanel evidence={historicalFloodEvidence} />);
    const dragHandle = screen.getByTestId('historical-panel-drag-handle');
    expect(dragHandle).toBeInTheDocument();

    const panel = screen.getByTestId('historical-evidence-panel');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ height: 400 } as DOMRect);
    Object.defineProperty(dragHandle, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(dragHandle, 'hasPointerCapture', { value: () => false });

    const pointer = (type: string, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientY });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        pointerType: { value: 'touch' },
      });
      fireEvent(dragHandle, event);
    };

    pointer('pointerdown', 100);
    pointer('pointermove', 450);
    pointer('pointerup', 450);

    const reopenBtn = screen.getByTestId('historical-panel-reopen');
    expect(reopenBtn).toBeInTheDocument();
    expect(screen.queryByTestId('historical-evidence-panel')).toBeNull();

    await user.click(reopenBtn);
    expect(screen.getByTestId('historical-evidence-panel')).toBeInTheDocument();
  });
});
