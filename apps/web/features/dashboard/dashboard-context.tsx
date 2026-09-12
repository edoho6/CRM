'use client';

import { createContext, useContext, useMemo } from 'react';

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
   * When the page was rendered, as the server saw it (ISO). A widget that
   * decides "overdue" or "today" reads its clock from here, so its first
   * paint in the browser matches the HTML it hydrates: Date.now() at render
   * split the tree whenever a task fell due between the two renders.
   */
  renderedAt: string;
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
  renderedAt: '',
  initialData: {},
});

export const DashboardProvider = DashboardContext.Provider;

export function useDashboardContext(): DashboardContextValue {
  return useContext(DashboardContext);
}

/** The page's clock: the render instant, or now where no page provided one. */
export function useRenderedAt(): Date {
  const { renderedAt } = useContext(DashboardContext);
  return useMemo(() => (renderedAt ? new Date(renderedAt) : new Date()), [renderedAt]);
}

/** The server's answer for this widget type, if the page had one. */
export function useWidgetInitialData<T>(type: string): T | undefined {
  return useContext(DashboardContext).initialData[type] as T | undefined;
}
