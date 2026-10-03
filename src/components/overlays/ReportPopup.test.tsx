// src/components/overlays/ReportPopup.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReportPopup } from './ReportPopup';

describe('ReportPopup — community card (realism pass)', () => {
  it('renders depth + passability headline and confirmation count', () => {
    render(
      <ReportPopup
        kind="community"
        id="r1"
        updatedAt={Math.floor(Date.now() / 1000) - 60}
        source="DEMO"
        depth="KNEE"
        passability="HIGH_CLEARANCE_ONLY"
        lifecycle="ACTIVE"
        confirmationCount={3}
        lastConfirmedAt={Math.floor(Date.now() / 1000) - 30}
        note="Water still rising near the intersection"
      />,
    );
    expect(screen.getByTestId('report-headline')).toHaveTextContent(/knee-deep flooding/i);
    expect(screen.getByTestId('report-pass')).toHaveTextContent(/high-clearance/i);
    expect(screen.getByTestId('report-confirmations')).toHaveTextContent('3 community confirmations');
    expect(screen.getByTestId('report-note')).toHaveTextContent(/water still rising/i);
    // Trust line never implies official/verified/safe.
    const trust = screen.getByTestId('report-trust').textContent?.toLowerCase() ?? '';
    expect(trust).toContain('community information');
    expect(trust).toContain('not been officially verified');
    expect(trust).not.toContain('verified community');
    expect(trust).not.toContain('safe');
  });

  it('shows explicit empty states for no confirmations and no note', () => {
    render(
      <ReportPopup
        kind="community"
        id="r2"
        updatedAt={Math.floor(Date.now() / 1000) - 60}
        source="DEMO"
        depth="ANKLE"
        passability="PASSABLE"
        lifecycle="ACTIVE"
        confirmationCount={0}
      />,
    );
    expect(screen.getByTestId('report-confirmations')).toHaveTextContent('No confirmations yet');
    expect(screen.getByTestId('report-confirmed-time')).toHaveTextContent('No recent confirmation');
    expect(screen.getByTestId('report-note')).toHaveTextContent('No note provided');
  });

  it('renders the RESOLVED variant stating it no longer affects risk, with no actions', () => {
    render(
      <ReportPopup
        kind="community"
        id="r3"
        updatedAt={Math.floor(Date.now() / 1000) - 600}
        source="DEMO"
        depth="KNEE"
        passability="HIGH_CLEARANCE_ONLY"
        lifecycle="RESOLVED"
        confirmationCount={2}
        onConfirm={() => {}}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByTestId('report-popup')).toHaveAttribute('data-lifecycle', 'RESOLVED');
    expect(screen.getByTestId('report-resolved-note')).toHaveTextContent(
      /no longer contributing to current flood risk/i,
    );
    // Resolved reports expose no lifecycle actions.
    expect(screen.queryByTestId('report-actions')).toBeNull();
  });

  it('official closures keep their distinct label and show no community actions', () => {
    render(
      <ReportPopup
        kind="official"
        updatedAt={Math.floor(Date.now() / 1000)}
        source="MMDA"
        barangay="Barangay 1"
        note="Road impassable"
      />,
    );
    expect(screen.getByTestId('report-popup')).toHaveAttribute('data-kind', 'official');
    expect(screen.getByTestId('report-status')).toHaveTextContent('Official confirmation');
    expect(screen.queryByTestId('report-actions')).toBeNull();
  });
});
