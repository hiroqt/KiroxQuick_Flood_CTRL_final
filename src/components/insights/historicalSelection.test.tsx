import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
