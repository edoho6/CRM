'use client';

import { createContext, useContext } from 'react';

/**
 * What is being prescribed right now, published by the dispensing panel for the
 * comparison to read.
 *
 * The two live in different components by design — the panel is built by the
 * page and handed to the form as an element, so the form stays a pure form —
 * which means the herbs being typed into one have no natural way to reach the
 * other. A context bridges them without either importing the other: the panel
 * calls `publish` whenever its selection changes, and the form keeps the latest
 * value beside the points it already holds.
 *
 * Lines carry a `key` separately from their `name`. The name is whatever the
 * catalogue shows in the current language; the key is the pinyin (or the typed
 * name for an off-catalogue herb), which is the same on both sides of the
 * comparison. A diff on display names would call Huang Qi and חואנג צ'י two
 * different herbs. The `herbId` travels too, for the chip that opens the
 * herb's card — a herb typed by name has none.
 */

export interface PrescriptionLine {
  /** Stable across languages: the pinyin, or the typed name lower-cased. */
  key: string;
  name: string;
  quantity: number | null;
  /** The catalogue row, when the line came from one. */
  herbId?: string | null;
}

/**
 * How the prescription is taken: the form it comes in, how much of it there
 * is, and the daily dose — the three figures a patient asks about, put beside
 * the herbs rather than left in the prescription's own dialog.
 */
export interface PrescriptionMeta {
  preparation: string | null;
  total: number | null;
  unit: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  dosesPerDay: number | null;
  doseTiming: string | null;
}

export interface CurrentPrescription {
  formula: string | null;
  /** The catalogue formula, when one was chosen. */
  formulaId?: string | null;
  herbs: PrescriptionLine[];
  meta?: PrescriptionMeta | null;
  /** True while the lines are only chosen in the panel and not yet recorded. */
  draft: boolean;
}

interface CurrentPrescriptionContextValue {
  publish: (prescription: CurrentPrescription | null) => void;
}

const CurrentPrescriptionContext = createContext<CurrentPrescriptionContextValue | null>(null);

export const CurrentPrescriptionProvider = CurrentPrescriptionContext.Provider;

const noop = () => {};

/**
 * The panel's side of the bridge. A no-op when there is no provider, so the
 * panel still works on a page that has no comparison to feed.
 */
export function useCurrentPrescriptionPublisher(): CurrentPrescriptionContextValue['publish'] {
  return useContext(CurrentPrescriptionContext)?.publish ?? noop;
}

// `prescriptionKey` lives in ./prescription-key so the server page can call
// it too; it is re-exported here for the panels that already import it.
export { prescriptionKey } from './prescription-key';
