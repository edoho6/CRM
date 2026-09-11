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

/** Per widget type, the data the page already fetched for it on the server. */
export type DashboardInitialData = Readonly<Record<string, unknown>>;

export interface DashboardContextValue {
  /** Whether the clinic tracks herb stock. Off, and stock-related shortcuts and widgets are meaningless. */
  tracksInventory: boolean;
  /** The clinic's zone: "today" and "this month" are its, not the server's. */
  timeZone: string;
  /**
   * What the page computed before the first paint, keyed by widget type. A
   * widget that finds itself here renders at once and skips its first fetch;
   * one that does not loads in the browser as it always did.
   */
  initialData: DashboardInitialData;
}

export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';

const DashboardContext = createContext<DashboardContextValue>({
  tracksInventory: true,
  timeZone: DEFAULT_TIME_ZONE,
  initialData: {},
});

export const DashboardProvider = DashboardContext.Provider;

export function useDashboardContext(): DashboardContextValue {
  return useContext(DashboardContext);
}

/** The server's answer for this widget type, if the page had one. */
export function useWidgetInitialData<T>(type: string): T | undefined {
  return useContext(DashboardContext).initialData[type] as T | undefined;
}
