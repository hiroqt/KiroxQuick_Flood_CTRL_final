// src/components/overlays/HistoricalEvidencePopup.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HistoricalEvidencePopup } from './HistoricalEvidencePopup';

describe('HistoricalEvidencePopup', () => {
  it('always shows the HISTORICAL badge + "not current conditions" framing, never LIVE/CURRENT', () => {
    render(
      <HistoricalEvidencePopup
        title="EDSA-Muñoz waist-deep, impassable"
        city="Quezon City"
        eventLabel="Typhoon Carina / Enhanced Habagat — 2024"
        eventDate="2024-07-24"
        publicationDate="2024-07-24"
        floodCondition="Waist-deep, standstill traffic"
        reportedDepth="Waist-deep"
        passability="IMPASSABLE"
        sourceName="GMA News"
        sourceUrl={null}
        locationPrecision="EXACT"
      />,
    );
    expect(screen.getByTestId('historical-badge')).toHaveTextContent('HISTORICAL');
    const note = screen.getByTestId('historical-record-note').textContent?.toLowerCase() ?? '';
    expect(note).toContain('does not represent current flood conditions');
    expect(note).toContain('not current conditions');
    // Must never present as live/current/real-time.
    const whole = screen.getByTestId('historical-evidence-popup').textContent?.toLowerCase() ?? '';
    expect(whole).not.toContain('live');
    expect(whole).not.toContain('real-time');
    expect(whole).not.toContain('currently flooded');
  });

  it('keeps event date and publication date distinct', () => {
    render(
      <HistoricalEvidencePopup
        title="Marikina River reaches 21.5m during Ondoy"
        eventDate="2009-09-26"
        publicationDate="2022-07-10"
        sourceName="Philippine Daily Inquirer"
        sourceUrl={null}
        locationPrecision="HIGH"
      />,
    );
    expect(screen.getByTestId('historical-event-date')).toHaveTextContent('2009-09-26');
    expect(screen.getByTestId('historical-pub-date')).toHaveTextContent('2022-07-10');
  });

  it('shows "Source link unavailable in research dataset" when URL is missing', () => {
    render(
      <HistoricalEvidencePopup
        title="España Boulevard rendered entirely impassable"
        sourceName="GMA News"
        sourceUrl={null}
        locationPrecision="EXACT"
      />,
    );
    expect(screen.getByTestId('historical-source')).toHaveTextContent(
      /Source link unavailable in research dataset/i,
    );
    // No fabricated link rendered.
    expect(screen.queryByTestId('historical-source-link')).toBeNull();
  });

  it('shows the precision value', () => {
    render(
      <HistoricalEvidencePopup
        title="x"
        sourceName="NDRRMC"
        sourceUrl={null}
        locationPrecision="CITY_ONLY"
      />,
    );
    expect(screen.getByTestId('historical-precision')).toHaveTextContent('City only');
  });
});
