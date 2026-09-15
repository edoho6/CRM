'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Button, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { approveReference, type ReferenceKind } from './review-actions';

/**
 * One click that says "a practitioner read this and it is right". It sits
 * beside the "needs review" badge and replaces it; the row remembers who
 * and when, and the page shows that line instead of the warning.
 */
export function ApproveButton({ kind, id }: { kind: ReferenceKind; id: string }) {
  const t = useTranslations('inventory.review');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const approve = () =>
    startTransition(async () => {
      const result = await approveReference(kind, id);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      toast({ tone: 'success', title: t('approved') });
      router.refresh();
    });

  return (
    <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={approve}>
      <Check className="h-4 w-4" />
      {t('approve')}
    </Button>
  );
}
