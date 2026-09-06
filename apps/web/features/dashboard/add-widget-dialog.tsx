'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogTrigger, EmptyState } from '@clinic/ui';
import type { AnyWidgetDefinition, DashboardLayout } from '@clinic/domain/widgets';
import type { Locale } from '@clinic/domain';
import { listWidgetDefinitions } from './widgets';

/**
 * "Add widget" panel.
 *
 * The list is the registry itself, so a newly registered widget appears here with
 * no change to this file. Singleton widgets already on the dashboard are shown
 * disabled rather than hidden, so the user can see the option exists.
 */
export function AddWidgetDialog({
  layout,
  onAdd,
}: {
  layout: DashboardLayout;
  onAdd: (definition: AnyWidgetDefinition) => void;
}) {
  const t = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  const definitions = useMemo(() => listWidgetDefinitions(), []);
  const usedTypes = useMemo(() => new Set(layout.map((item) => item.type)), [layout]);

  const available = definitions.filter(
    (definition) => !(definition.singleton && usedTypes.has(definition.type)),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="h-4 w-4" />
          {t('addWidget')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addWidgetTitle')}>
        {definitions.length === 0 ? (
          <EmptyState title={t('emptyTitle')} />
        ) : (
          <ul className="space-y-2">
            {definitions.map((definition) => {
              const isUsed = Boolean(definition.singleton) && usedTypes.has(definition.type);
              return (
                <li key={definition.type}>
                  <button
                    type="button"
                    disabled={isUsed}
                    onClick={() => {
                      onAdd(definition);
                      setOpen(false);
                    }}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-start transition-colors hover:border-jade-300 hover:bg-jade-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-200 disabled:hover:bg-transparent"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">
                        {definition.displayName[locale] ?? definition.type}
                      </span>
                      {isUsed ? (
                        <span className="shrink-0 text-xs text-ink-400">{t('alreadyAdded')}</span>
                      ) : null}
                    </span>
                    {definition.description?.[locale] ? (
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {definition.description[locale]}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {available.length === 0 && definitions.length > 0 ? (
          <p className="mt-3 text-center text-xs text-ink-500">{t('allWidgetsAdded')}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
