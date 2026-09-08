'use client';

import { useTranslations } from 'next-intl';

/**
 * `today-appointments` → `todayAppointments`: the key a widget type lives under
 * in the `widgets` namespace of the message catalogue.
 */
export function widgetMessageKey(type: string): string {
  return type.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/**
 * A widget's name and description, from the catalogue.
 *
 * These used to be declared twice — once as `displayName` in every
 * `registerWidget()` call and once under `widgets.*.name` in the catalogue —
 * and the two copies did not agree: the catalogue had no name for the tasks
 * widget, and three widgets kept their description only in code. One source
 * now, and it is the one the message-parity test already checks.
 *
 * A type with no entry falls back to the type itself, as the add-widget panel
 * always did, so a widget registered without strings is visible rather than
 * blank.
 */
export function useWidgetLabels() {
  const t = useTranslations('widgets');
  type Key = Parameters<typeof t>[0];

  return {
    name(type: string): string {
      const key = `${widgetMessageKey(type)}.name` as Key;
      return t.has(key) ? t(key) : type;
    },
    description(type: string): string | null {
      const key = `${widgetMessageKey(type)}.description` as Key;
      return t.has(key) ? t(key) : null;
    },
  };
}
