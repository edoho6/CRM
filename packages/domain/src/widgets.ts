import type { ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { Locale, MembershipRole } from './enums';

/**
 * Contract for the modular dashboard.
 *
 * The whole point of this file is that adding a new widget type later (a report
 * chart, a revenue tile, a waiting-list panel) means writing a component and
 * calling `registerWidget()`. It must never require touching the grid, the
 * persistence layer, or the dashboard page itself.
 *
 * Layout model: an *ordered list* of widgets, each with a size. The grid is a CSS
 * grid that flows in reading order, so there are no coordinates to mirror for
 * Hebrew and nothing that can overlap — the browser lays it out.
 */

export const WIDGET_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

/** One widget placed on a user's dashboard, as persisted in `dashboard_layouts.layout`. */
export interface DashboardWidgetInstance<TConfig = unknown> {
  /** Stable instance id (a user may add two "note" widgets). */
  id: string;
  /** Matches `WidgetDefinition.type` in the registry. */
  type: string;
  /** Column span preset; position is the array order. */
  size: WidgetSize;
  /** Widget-specific settings, validated by `WidgetDefinition.configSchema`. */
  config?: TConfig;
}

/** The full persisted dashboard for one user, in display order. */
export type DashboardLayout = DashboardWidgetInstance[];

/** Props every widget component receives from the grid host. */
export interface WidgetProps<TConfig = unknown> {
  instanceId: string;
  config: TConfig;
  /** Persisted (debounced) by the dashboard host — widgets never write to the DB directly. */
  onConfigChange: (config: TConfig) => void;
  /** True while the user is in dashboard edit mode (drag handles visible). */
  isEditing: boolean;
  /** Current size, so a widget can choose a compact or full presentation. */
  size: WidgetSize;
}

export interface WidgetDefinition<TConfig = unknown> {
  /** Unique registry key, e.g. `upcoming-appointments`. Persisted in the layout JSON. */
  type: string;
  /** Shown in the "add widget" panel, in the user's language. */
  displayName: Record<Locale, string>;
  description?: Record<Locale, string>;
  /** Lucide icon name, resolved by the UI layer so this package stays icon-library agnostic. */
  icon?: string;
  defaultSize: WidgetSize;
  /** Sizes the widget looks right at. Defaults to all four. */
  allowedSizes?: readonly WidgetSize[];
  defaultConfig: TConfig;
  /** Validates `config` before it is persisted or handed to the component. */
  configSchema?: ZodType<TConfig>;
  component: ComponentType<WidgetProps<TConfig>>;
  /** Reserved for Milestone 7 (roles/permissions) — filters the registry per user. */
  requiredRoles?: readonly MembershipRole[];
  /** When true the widget can only be added to a dashboard once. */
  singleton?: boolean;
}

/**
 * Heterogeneous registry storage type. Individual widgets stay strongly typed via
 * `defineWidget()`; the registry itself has to erase the config generic to hold them together.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWidgetDefinition = WidgetDefinition<any>;

/** Identity helper that preserves the config generic when declaring a widget. */
export function defineWidget<TConfig>(definition: WidgetDefinition<TConfig>): WidgetDefinition<TConfig> {
  return definition;
}
