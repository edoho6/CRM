'use client';

import type { AnyWidgetDefinition, WidgetDefinition } from '@clinic/domain/widgets';

/**
 * The widget registry.
 *
 * This is the extensibility seam for the whole dashboard: a new widget is a
 * component plus a `registerWidget()` call. Nothing in the grid, the persistence
 * layer or the dashboard page needs to change to accommodate it.
 */

const registry = new Map<string, AnyWidgetDefinition>();

export function registerWidget<TConfig>(definition: WidgetDefinition<TConfig>): void {
  if (registry.has(definition.type)) {
    // Overwriting silently would make a duplicated type impossible to notice in dev,
    // while throwing would break fast refresh. Warn and keep the first registration.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[dashboard] Widget type "${definition.type}" is already registered.`);
    }
    return;
  }
  registry.set(definition.type, definition as AnyWidgetDefinition);
}

export function getWidgetDefinition(type: string): AnyWidgetDefinition | undefined {
  return registry.get(type);
}

export function listWidgetDefinitions(): AnyWidgetDefinition[] {
  return Array.from(registry.values());
}

export function isWidgetRegistered(type: string): boolean {
  return registry.has(type);
}
