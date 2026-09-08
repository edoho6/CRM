'use client';

import { createContext, useContext } from 'react';

/**
 * What the dashboard knows about the clinic that its widgets need too.
 *
 * Widgets receive only their own config from the grid (see `WidgetProps`), by
 * design — a widget that reaches into clinic settings is a widget that cannot
 * be added without touching the grid. The few clinic-level facts a widget does
 * need travel here instead, provided once by the grid.
 */
export interface DashboardContextValue {
  /** Whether the clinic tracks herb stock. Off, and stock-related shortcuts and widgets are meaningless. */
  tracksInventory: boolean;
}

const DashboardContext = createContext<DashboardContextValue>({ tracksInventory: true });

export const DashboardProvider = DashboardContext.Provider;

export function useDashboardContext(): DashboardContextValue {
  return useContext(DashboardContext);
}
