'use client';

import { useTranslations } from 'next-intl';
import { Activity, Pill, Thermometer, type LucideIcon } from 'lucide-react';
import { Alert, Badge, cn } from '@clinic/ui';
import { formatDate } from '@clinic/i18n';
import type { MedEntry, MedLinkedEntry, MedQuote, MedSource } from '@clinic/db/types';
import { MED_STATUS_TONES, statusTone, type MedKind } from '@clinic/domain';
import { ExternalLink } from '@/components/external-link';
import { ReferenceChip } from '@/features/reference/reference-context';

/**
 * The body of a Western medicine entry — a condition, a symptom or a drug —
 * shared by the entry page and the card that opens over a treatment record.
 *
 * Two layers of text, kept apart on purpose. The Hebrew sections are ours,
 * written from the sources and labelled as such until a person approves the
 * entry. The English quotes below them are the sources' own words, verbatim,
 * with their date and licence: that is where a dose or a side effect is
 * checked, and why a dose is never paraphrased into the Hebrew.
 */

const KIND_ICONS: Record<MedKind, LucideIcon> = {
  condition: Activity,
  symptom: Thermometer,
  drug: Pill,
};

/** The order the sections read in, per kind; a section the entry lacks is skipped. */
const SECTION_ORDER: Record<MedKind, readonly string[]> = {
  condition: ['overview', 'symptoms', 'causes', 'diagnosis', 'treatment', 'urgent', 'self_care'],
  symptom: ['overview', 'possible_causes', 'urgent', 'self_care'],
  drug: ['what_for', 'how_to_take', 'side_effects', 'who_cannot', 'interactions', 'pregnancy'],
};

/** Sections that warn rather than describe: a different edge, the same voice. */
const WARNING_SECTIONS = new Set(['urgent', 'who_cannot']);

const SOURCE_KEYS = new Set(['wikidata', 'medlineplus', 'fda', 'nhs', 'wikipedia-he', 'wikipedia-en']);
const ID_KEYS = new Set(['icd10', 'icd10cm', 'mesh', 'doid', 'atc', 'rxcui', 'medlineplus', 'nhs']);

/** Where the Israeli leaflet is found; the reference links there and copies nothing from it. */
const MOH_DRUG_REGISTRY = 'https://israeldrugs.health.gov.il/';

export function MedicineKindIcon({ kind, className }: { kind: MedKind; className?: string }) {
  const Icon = KIND_ICONS[kind];
  return <Icon className={className} aria-hidden />;
}

/** The entry's standing: one source, agreed by two, or approved by a person. */
export function MedicineStatusBadge({ entry }: { entry: Pick<MedEntry, 'status' | 'cross_check'> }) {
  const t = useTranslations('medicine');
  const sources = entry.cross_check?.sources ?? 1;
  const label =
    entry.status === 'verified'
      ? t('status.verified')
      : entry.status === 'cross_checked'
        ? t('status.cross_checked', { count: sources })
        : t('status.draft');
  return (
    <Badge tone={statusTone(MED_STATUS_TONES, entry.status)} title={t(`statusHint.${entry.status}`)}>
      {label}
    </Badge>
  );
}

function Heading({ level, children, className }: { level: 'h2' | 'h3'; children: React.ReactNode; className?: string }) {
  const Tag = level;
  return <Tag className={cn('text-base font-semibold text-ink-900', className)}>{children}</Tag>;
}

function sourceName(source: string, t: ReturnType<typeof useTranslations<'medicine'>>): string {
  return SOURCE_KEYS.has(source) ? t(`sources.names.${source}` as never) : source;
}

function idLabel(key: string, t: ReturnType<typeof useTranslations<'medicine'>>): string {
  return ID_KEYS.has(key) ? t(`ids.${key}` as never) : key;
}

/**
 * The body knows nothing of where it is shown: the page puts it under its
 * header, the dialog adds its own "full page" link after it. That keeps Next
 * navigation out of this file, so the body renders under plain React — the
 * test feeds it the whole seed corpus that way.
 */
export function MedicineBody({
  entry,
  links,
  headingLevel = 'h2',
}: {
  entry: MedEntry;
  links: MedLinkedEntry[];
  /** h2 under the page's own h1; h3 inside the dialog, whose title is an h2. */
  headingLevel?: 'h2' | 'h3';
}) {
  const t = useTranslations('medicine');
  const tc = useTranslations('common');

  const sectionsHe = entry.sections?.he ?? null;
  const sectionsEn = entry.sections?.en ?? null;
  const shown = sectionsHe ?? sectionsEn;
  const shownIsEnglish = !sectionsHe && Boolean(sectionsEn);
  const order = SECTION_ORDER[entry.kind];
  const sectionKeys = shown ? [...order.filter((key) => shown[key]), ...Object.keys(shown).filter((key) => !order.includes(key))] : [];

  const hebrewNote =
    entry.status === 'verified'
      ? t('hebrewNote.verified')
      : sectionsHe
        ? entry.hebrew_meta?.model === 'manual'
          ? t('hebrewNote.manual')
          : t('hebrewNote.auto')
        : entry.summary_he
          ? t('hebrewNote.wikidata')
          : t('hebrewNote.none');

  const identifiers = Object.entries(entry.identifiers ?? {}).filter(([, value]) => value);
  const basis = (entry.sources ?? []).filter((source) => source.role === 'basis');
  const furtherReading = (entry.sources ?? []).filter((source) => source.role === 'further_reading');
  const nhs = basis.find((source) => source.source === 'nhs') ?? null;

  // Links grouped by what they say, in a fixed order, so a drug reads
  // "treats…" before "side effects…" on every page.
  const groups = new Map<string, MedLinkedEntry[]>();
  for (const link of links) {
    const key = `${link.relation}_${link.direction}`;
    groups.set(key, [...(groups.get(key) ?? []), link]);
  }
  const groupOrder = ['treats_out', 'treats_in', 'symptom_of_in', 'symptom_of_out', 'side_effect_out', 'side_effect_in', 'class_out', 'class_in', 'related_out', 'related_in'];
  const groupKeys = [...groupOrder.filter((key) => groups.has(key)), ...[...groups.keys()].filter((key) => !groupOrder.includes(key))];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <MedicineStatusBadge entry={entry} />
          <span className="text-xs text-ink-600">{hebrewNote}</span>
        </div>
        {entry.summary_he ? (
          <p className="text-base text-ink-900">{entry.summary_he}</p>
        ) : entry.summary_en ? (
          <p className="text-base text-ink-900" dir="ltr">
            {entry.summary_en}
          </p>
        ) : null}
        {entry.aliases_he?.length ? (
          <p className="text-sm text-ink-700">
            <span className="text-ink-600">{t('fields.aliases')}: </span>
            {entry.aliases_he.join(', ')}
          </p>
        ) : null}
        {identifiers.length ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-ink-600">{t('fields.identifiers')}:</span>
            {identifiers.map(([key, value]) => (
              <span key={key} dir="ltr" className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-ink-800">
                {idLabel(key, t)} {value}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {sectionKeys.length > 0 ? (
        <div className="space-y-4">
          {sectionKeys.map((key) => {
            const text = shown?.[key];
            if (!text) return null;
            const warning = WARNING_SECTIONS.has(key);
            return (
              <section key={key} className={cn(warning && 'border-s-4 border-amber-400 ps-3')}>
                <Heading level={headingLevel} className="mb-1">
                  {t(`sections.${key}` as never)}
                </Heading>
                <p
                  className={cn('whitespace-pre-wrap text-sm text-ink-800', shownIsEnglish && 'text-start')}
                  dir={shownIsEnglish ? 'ltr' : undefined}
                >
                  {text}
                </p>
              </section>
            );
          })}
        </div>
      ) : null}

      {groupKeys.length > 0 ? (
        <section className="space-y-2">
          <Heading level={headingLevel}>{t('links.title')}</Heading>
          {groupKeys.map((key) => (
            <div key={key}>
              <p className="text-xs font-medium text-ink-600">{t(`links.${key}` as never)}</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {groups.get(key)!.map((link) => (
                  <li key={`${key}-${link.entry.id}`} className="inline-flex items-center gap-1 text-sm">
                    <MedicineKindIcon kind={link.entry.kind} className="h-3.5 w-3.5 text-sky-800" />
                    <ReferenceChip
                      target={{ kind: 'medicine', id: link.entry.id, slug: link.entry.slug, label: link.entry.name_he ?? link.entry.name_en }}
                      className="font-medium text-ink-900"
                    >
                      {link.entry.name_he ?? link.entry.name_en}
                    </ReferenceChip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {entry.quotes?.length ? (
        <section className="space-y-2">
          <Heading level={headingLevel}>{t('quotes.title')}</Heading>
          <p className="text-xs text-ink-600">{t('quotes.hint')}</p>
          <div className="space-y-1.5">
            {entry.quotes.map((quote, index) => (
              <Quote key={`${quote.source}-${quote.field}-${index}`} quote={quote} sourceLabel={sourceName(quote.source, t)} fieldLabel={t(`sections.${quote.field}` as never)} />
            ))}
          </div>
        </section>
      ) : null}

      {basis.length > 0 || furtherReading.length > 0 ? (
        <section className="space-y-2">
          <Heading level={headingLevel}>{t('sources.title')}</Heading>
          {basis.length > 0 ? <SourceList sources={basis} label={t('sources.basis')} nameOf={(source) => sourceName(source, t)} /> : null}
          {furtherReading.length > 0 ? (
            <SourceList sources={furtherReading} label={t('sources.furtherReading')} nameOf={(source) => sourceName(source, t)} />
          ) : null}
        </section>
      ) : null}

      {nhs ? <NhsAttribution url={nhs.url} /> : null}

      <Alert tone="warning" title={t('disclaimer.title')}>
        <span className="block">{t('disclaimer.body')}</span>
        {entry.kind === 'drug' ? (
          <ExternalLink href={MOH_DRUG_REGISTRY} newTabLabel={tc('opensInNewTab')} className="mt-1 underline-offset-2 hover:underline">
            {t('disclaimer.registry')}
          </ExternalLink>
        ) : null}
      </Alert>
    </div>
  );
}

/** One passage from a source, folded until asked for; the text is theirs, so it reads left to right. */
function Quote({ quote, sourceLabel, fieldLabel }: { quote: MedQuote; sourceLabel: string; fieldLabel: string }) {
  const t = useTranslations('medicine');
  const tc = useTranslations('common');
  return (
    <details className="rounded-lg border border-ink-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm text-ink-800">
        <span className="font-medium">{sourceLabel}</span>
        <span className="text-ink-600"> · {fieldLabel}</span>
        {quote.source_reviewed_at ? (
          <span className="text-ink-600"> · {t('quotes.reviewed', { date: formatDate(new Date(quote.source_reviewed_at)) })}</span>
        ) : null}
      </summary>
      <div className="border-t border-ink-100 px-3 py-2">
        <p dir="ltr" className="whitespace-pre-wrap text-start text-sm text-ink-800">
          {quote.text}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
          <span>{t('sources.licence', { licence: quote.licence })}</span>
          {quote.retrieved_at ? <span>· {t('quotes.retrieved', { date: formatDate(new Date(quote.retrieved_at)) })}</span> : null}
          {quote.url ? (
            <ExternalLink href={quote.url} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
              {t('sources.open')}
            </ExternalLink>
          ) : null}
        </p>
      </div>
    </details>
  );
}

function SourceList({ sources, label, nameOf }: { sources: MedSource[]; label: string; nameOf: (source: string) => string }) {
  const t = useTranslations('medicine');
  const tc = useTranslations('common');
  return (
    <div>
      <p className="text-xs font-medium text-ink-600">{label}</p>
      <ul className="space-y-1 text-sm">
        {sources.map((source, index) => (
          <li key={`${source.source}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <ExternalLink href={source.url} newTabLabel={tc('opensInNewTab')} className="font-medium text-ink-900 underline-offset-2 hover:underline">
              {nameOf(source.source)}
            </ExternalLink>
            {source.title && source.title !== nameOf(source.source) ? (
              <span className="text-ink-700" dir="auto">
                {source.title}
              </span>
            ) : null}
            <span className="text-xs text-ink-600">
              {t('sources.licence', { licence: source.licence })}
              {source.retrieved_at ? ` · ${t('quotes.retrieved', { date: formatDate(new Date(source.retrieved_at)) })}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the NHS website's licence asks of every page that shows its text: its
 * logo and a link back to the page. The logo file is the NHS's own, placed
 * under public/medicine by hand from their brand site — never redrawn — and
 * until it is there the words and the link stand alone.
 */
function NhsAttribution({ url }: { url: string }) {
  const t = useTranslations('medicine');
  const tc = useTranslations('common');
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm">
      <img
        src="/medicine/nhs-logo.svg"
        alt="NHS"
        width={60}
        height={24}
        className="h-6 w-auto"
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
      <span className="text-ink-800">{t('nhs.attribution')}</span>
      <ExternalLink href={url} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
        {t('nhs.link')}
      </ExternalLink>
    </div>
  );
}
