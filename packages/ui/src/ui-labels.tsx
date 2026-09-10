'use client';

import * as React from 'react';

/**
 * Words the shared kit needs but must not own.
 *
 * The kit has no translations: every component takes its labels as props.
 * That works for a dialog's close button, and stops working for a control
 * that appears inside a primitive used from forty places — the table size
 * switch in `TableWrapper` would need every one of those forty to pass the
 * same four strings. So the app mounts this once, in its root layout, and the
 * control reads what it needs. A control whose labels are missing renders
 * nothing rather than an unlabelled button.
 */
export interface UiLabels {
  tableSize?: {
    title: string;
    compact: string;
    regular: string;
    large: string;
  };
}

const UiLabelsContext = React.createContext<UiLabels>({});

export function UiLabelsProvider({
  labels,
  children,
}: {
  labels: UiLabels;
  children: React.ReactNode;
}) {
  return <UiLabelsContext.Provider value={labels}>{children}</UiLabelsContext.Provider>;
}

export function useUiLabels(): UiLabels {
  return React.useContext(UiLabelsContext);
}
