'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Spinner,
  Textarea,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { HeaderTools } from '@/components/header-tools';
import { useRouter } from '@clinic/i18n/navigation';
import type { TreatmentProtocol } from '@clinic/db/types';
import {
  createProtocol,
  deleteProtocol,
  setProtocolActive,
  updateProtocol,
} from './protocol-actions';

/**
 * The list of saved protocols, and the small amount of editing that belongs here.
 *
 * Only the descriptive fields are editable on this screen: the name, what it is
 * for, and the principle. The points and the prescription are not, and that is
 * deliberate — editing a point combination needs the point editor and the body
 * chart, which is the treatment page. A protocol is *captured* from a treatment
 * and *renamed* here; re-editing its clinical content means applying it to a
 * treatment and saving that as a new one.
 *
 * Retiring is offered before deleting because it is almost always what is meant.
 */
export function ProtocolsManager({ protocols }: { protocols: TreatmentProtocol[] }) {
  const t = useTranslations('protocols');
  const tc = useTranslations('common');
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<TreatmentProtocol | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [indications, setIndications] = useState('');
  const [principle, setPrinciple] = useState('');

  function openEdit(protocol: TreatmentProtocol) {
    setEditing(protocol);
    setCreating(false);
    setName(protocol.name);
    setDescription(protocol.description ?? '');
    setIndications(protocol.indications ?? '');
    setPrinciple(protocol.treatment_principle ?? '');
    setError(false);
  }

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setName('');
    setDescription('');
    setIndications('');
    setPrinciple('');
    setError(false);
  }

  function close() {
    setEditing(null);
    setCreating(false);
  }

  function save() {
    if (!name.trim()) return;
    setError(false);
    startTransition(async () => {
      const payload = {
        name,
        description,
        indications,
        treatment_principle: principle,
        // An edit here must not silently empty the clinical half. A new protocol
        // starts empty and is filled by applying it and saving from a treatment.
        points_used: editing?.points_used ?? [],
        formula_id: editing?.formula_id ?? null,
        herbs: editing?.herbs ?? [],
        preparation: editing?.preparation ?? '',
        days_supply: editing?.days_supply ?? '',
        dose_amount: editing?.dose_amount ?? '',
        dose_unit: editing?.dose_unit ?? '',
        dose_timing: editing?.dose_timing ?? '',
        doses_per_day: editing?.doses_per_day ?? '',
        is_active: editing?.is_active ?? true,
      };

      const result = editing
        ? await updateProtocol(editing.id, payload)
        : await createProtocol(payload);

      if (!result.ok) {
        setError(true);
        return;
      }
      close();
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  function toggleActive(protocol: TreatmentProtocol) {
    startTransition(async () => {
      await setProtocolActive(protocol.id, !protocol.is_active);
      router.refresh();
    });
  }

  async function remove(protocol: TreatmentProtocol) {
    const confirmed = await confirm({
      title: tc('deleteNamed', { thing: tc('things.protocol') }),
      body: tc('deleteConfirmBody'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteProtocol(protocol.id);
      if (!result.ok) {
        setError(true);
        return;
      }
      toast({ tone: 'success', title: tc('deleted') });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

      {/* The primary action in the page header, where every list keeps it. */}
      <HeaderTools slotId="protocols-header-tools" fallbackClassName="flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('newProtocol')}
        </Button>
      </HeaderTools>

      {protocols.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title={t('emptyTitle')}
          description={t('empty')}
          action={
            <Button type="button" variant="secondary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('newProtocol')}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {protocols.map((protocol) => (
            <li key={protocol.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink-900">{protocol.name}</h3>
                      {!protocol.is_active ? <Badge tone="neutral">{t('retired')}</Badge> : null}
                      {/* What is actually in it, so a protocol can be told apart
                          from another with a similar name without opening it. */}
                      {protocol.points_used.length > 0 ? (
                        <Badge tone="info">
                          {t('pointCount', { count: protocol.points_used.length })}
                        </Badge>
                      ) : null}
                      {protocol.formula_id || protocol.herbs.length > 0 ? (
                        <Badge tone="success">{t('hasPrescription')}</Badge>
                      ) : null}
                    </div>
                    {protocol.indications ? (
                      <p className="mt-0.5 text-sm text-ink-700" dir="auto">
                        {protocol.indications}
                      </p>
                    ) : null}
                    {protocol.description ? (
                      <p className="mt-0.5 text-xs text-ink-600" dir="auto">
                        {protocol.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={tc('edit')}
                      title={tc('edit')}
                      onClick={() => openEdit(protocol)}
                      disabled={isPending}
                      className="rounded-md p-2 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={protocol.is_active ? t('retire') : t('restore')}
                      title={protocol.is_active ? t('retire') : t('restore')}
                      onClick={() => toggleActive(protocol)}
                      disabled={isPending}
                      className="rounded-md p-2 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
                    >
                      {protocol.is_active ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={tc('delete')}
                      title={tc('delete')}
                      onClick={() => remove(protocol)}
                      disabled={isPending}
                      className="rounded-md p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing) || creating} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent
          title={editing ? t('editProtocol') : t('newProtocol')}
          closeLabel={tc('close')}
        >
          <div className="space-y-4">
            {creating ? <Alert tone="info">{t('newProtocolHint')}</Alert> : null}

            <Field label={t('name')} htmlFor="manager_name" required>
              <Input
                id="manager_name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field
              label={t('indications')}
              htmlFor="manager_indications"
              hint={t('indicationsHint')}
            >
              <Textarea
                id="manager_indications"
                rows={2}
                value={indications}
                onChange={(event) => setIndications(event.target.value)}
              />
            </Field>
            <Field label={t('treatmentPrinciple')} htmlFor="manager_principle">
              <Textarea
                id="manager_principle"
                rows={2}
                value={principle}
                onChange={(event) => setPrinciple(event.target.value)}
              />
            </Field>
            <Field label={t('description')} htmlFor="manager_description">
              <Textarea
                id="manager_description"
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close} disabled={isPending}>
                {tc('cancel')}
              </Button>
              <Button type="button" onClick={save} disabled={isPending || !name.trim()}>
                {isPending ? <Spinner /> : null}
                {tc('save')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
