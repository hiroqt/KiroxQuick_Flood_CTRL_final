// src/components/overlays/ReportForm.tsx
//
// Community Report V2 — Phase 1 report form. Shown after the user taps a map
// point in "report flooding" mode. Collects structured conditions (severity,
// water depth, passability) + an optional note, then hands a ReportConditions
// object back to the parent, which creates an UNCONFIRMED community report.
//
// Presentation only: it maps to BahaRoute's existing flood states/metadata and
// never asserts official/confirmed status. Mobile-friendly (compact option
// groups, large tap targets, native radios for accessibility).

import { useState } from 'react';
import type { ReportDepth, ReportPassability } from '../../types/report';
import type { ReportConditions } from '../../services/reportLifecycle';

export interface ReportFormProps {
  /** Called with the collected conditions when the user submits. */
  onSubmit: (conditions: ReportConditions) => void;
  /** Called when the user cancels the form. */
  onCancel: () => void;
  className?: string;
}

const DEPTH_OPTIONS: readonly ReportDepth[] = ['ANKLE', 'KNEE', 'WAIST', 'ABOVE_WAIST', 'UNKNOWN'];
const PASSABILITY_OPTIONS: readonly ReportPassability[] = [
  'PASSABLE',
  'HIGH_CLEARANCE_ONLY',
  'NOT_PASSABLE',
  'UNKNOWN',
];

/** Short, tap-friendly chip labels for the form (fuller labels live elsewhere). */
const DEPTH_CHIP_LABELS: Record<ReportDepth, string> = {
  ANKLE: 'Ankle',
  KNEE: 'Knee',
  WAIST: 'Waist',
  ABOVE_WAIST: 'Above waist',
  UNKNOWN: 'Not sure',
};
const PASSABILITY_CHIP_LABELS: Record<ReportPassability, string> = {
  PASSABLE: 'Passable',
  HIGH_CLEARANCE_ONLY: 'High-clearance only',
  NOT_PASSABLE: 'Not passable',
  UNKNOWN: 'Not sure',
};

/** A labeled radio-group of options rendered as compact chips. */
function ChipGroup<T extends string>({
  legend,
  name,
  options,
  value,
  labelFor,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  labelFor: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="baharoute-report-form__group">
      <legend className="baharoute-report-form__legend">{legend}</legend>
      <div className="baharoute-report-form__chips" role="radiogroup" aria-label={legend}>
        {options.map((opt) => {
          const id = `baharoute-rf-${name}-${opt}`;
          const selected = value === opt;
          return (
            <label
              key={opt}
              htmlFor={id}
              className={`baharoute-report-form__chip${selected ? ' baharoute-report-form__chip--selected' : ''}`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                className="baharoute-visually-hidden"
                checked={selected}
                onChange={() => onChange(opt)}
              />
              {labelFor(opt)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ReportForm({ onSubmit, onCancel, className }: ReportFormProps) {
  // Severity is NO LONGER asked of the user — it is derived from the observable
  // depth + passability (see reportLifecycle.deriveSeverity).
  const [depth, setDepth] = useState<ReportDepth>('UNKNOWN');
  const [passability, setPassability] = useState<ReportPassability>('UNKNOWN');
  const [note, setNote] = useState('');

  const submit = (): void => {
    onSubmit({ depth, passability, note: note.trim() || undefined });
  };

  return (
    <section
      className={['baharoute-report-form', className].filter(Boolean).join(' ')}
      aria-label="Report flooding"
      data-testid="report-form"
    >
      <h2 className="baharoute-report-form__title">Report flooding</h2>
      <p className="baharoute-report-form__eyebrow">Community report · Unverified</p>

      <ChipGroup
        legend="How deep is the water?"
        name="depth"
        options={DEPTH_OPTIONS}
        value={depth}
        labelFor={(d) => DEPTH_CHIP_LABELS[d]}
        onChange={setDepth}
      />
      <ChipGroup
        legend="Can vehicles pass?"
        name="passability"
        options={PASSABILITY_OPTIONS}
        value={passability}
        labelFor={(p) => PASSABILITY_CHIP_LABELS[p]}
        onChange={setPassability}
      />

      <label className="baharoute-report-form__note-label" htmlFor="baharoute-rf-note">
        Add a note (optional)
      </label>
      <textarea
        id="baharoute-rf-note"
        className="baharoute-report-form__note"
        data-testid="report-form-note"
        value={note}
        maxLength={200}
        rows={2}
        placeholder="e.g. water still rising near the intersection"
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="baharoute-report-form__actions">
        <button
          type="button"
          className="baharoute-report-form__cancel baharoute-focus-ring"
          onClick={onCancel}
          data-testid="report-form-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="baharoute-report-form__submit baharoute-focus-ring"
          onClick={submit}
          data-testid="report-form-submit"
        >
          Submit report
        </button>
      </div>
    </section>
  );
}

export default ReportForm;
