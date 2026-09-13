'use client';

import { useTranslations } from 'next-intl';
import { Activity, Pill, TestTube, Thermometer, type LucideIcon } from 'lucide-react';
import { Alert, Badge, Collapsible, cn } from '@clinic/ui';
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
 *
 * Everything folds. Only the overview opens by itself: a drug's label runs to
 * pages, and a reader who wants the interactions is one click from them,
 * while a reader who wants to know what the thing is gets that at once. The
 * entry's standing — its status, what was checked, where the Hebrew came
 * from — sits with the sources at the end, not over the text.
 */

const KIND_ICONS: Record<MedKind, LucideIcon> = {
  condition: Activity,
  symptom: Thermometer,
  drug: Pill,
  lab_test: TestTube,
};

/** The order the sections read in, per kind; a section the entry lacks is skipped. */
const SECTION_ORDER: Record<MedKind, readonly string[]> = {
  condition: ['overview', 'symptoms', 'causes', 'diagnosis', 'treatment', 'urgent', 'self_care'],
  symptom: ['overview', 'possible_causes', 'urgent', 'self_care'],
  drug: ['what_for', 'how_to_take', 'side_effects', 'who_cannot', 'interactions', 'pregnancy'],
  lab_test: ['overview', 'what_for', 'procedure', 'preparation', 'risks', 'results', 'more'],
};

/** Sections that warn rather than describe: a different edge, the same voice. */
const WARNING_SECTIONS = new Set(['urgent', 'who_cannot']);

const SOURCE_KEYS = new Set(['wikidata', 'medlineplus', 'genetics', 'fda', 'rxnorm', 'nhs', 'israel', 'wikipedia-he', 'wikipedia-en']);
const ID_KEYS = new Set(['icd10', 'icd10cm', 'mesh', 'doid', 'atc', 'rxcui', 'unii', 'omim', 'orphanet', 'loinc', 'medlineplus', 'nhs']);

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

  const fromWikipedia = entry.hebrew_meta?.model === 'wikipedia-he' ? (entry.hebrew_meta.source ?? null) : null;
  const hebrewNote =
    entry.status === 'verified'
      ? t('hebrewNote.verified')
      : sectionsHe
        ? fromWikipedia
          ? t('hebrewNote.wikipedia')
          : entry.hebrew_meta?.model === 'manual'
            ? t('hebrewNote.manual')
            : t('hebrewNote.auto')
        : entry.summary_he
          ? t('hebrewNote.wikidata')
          : t('hebrewNote.none');

  // What was checked, in words: the identity across sources, the second
  // reading of the Hebrew, the numbers. Only what actually ran is shown.
  const checks: string[] = [];
  if (entry.cross_check?.identity_confirmed && entry.cross_check.identity?.length) {
    checks.push(t('checks.identity', { codes: entry.cross_check.identity.map((code) => code.replace(':', ' ')).join(', ') }));
  }
  if (entry.hebrew_meta?.review) checks.push(entry.hebrew_meta.review.faithful ? t('checks.reviewOk') : t('checks.reviewFailed'));
  if (entry.hebrew_meta?.numbers) checks.push(entry.hebrew_meta.numbers.ok ? t('checks.numbersOk') : t('checks.numbersFailed'));

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

  // The summary is the overview's first sentences: with an overview on the
  // page it would be read twice. It stays only where it is the sole Hebrew
  // (the sections still English) or the sole text at all.
  const showSummaryHe = Boolean(entry.summary_he) && !sectionsHe;
  const showSummaryEn = !showSummaryHe && Boolean(entry.summary_en) && !shown;
  // The overview opens by itself; a drug has none, and its "what it is for" is the same first step.
  const openKey = sectionKeys.includes('overview') ? 'overview' : sectionKeys[0];

  // What a reviewer said, in words, with the note: shown at the top when the
  // entry is flagged (a reader must not miss it) and with the sources otherwise.
  const verdict =
    entry.reviewed_at && (entry.status === 'verified' || entry.status === 'flagged')
      ? t(entry.status === 'verified' ? 'review.verifiedBy' : 'review.flaggedBy', {
          name: entry.reviewed_by_name ?? t('review.someone'),
          date: formatDate(new Date(entry.reviewed_at)),
        })
      : null;

  return (
    <div className="space-y-5">
      {entry.status === 'flagged' ? (
        <Alert tone="warning" title={t('status.flagged')}>
          {verdict ? <span className="block">{verdict}</span> : null}
          {entry.review_note ? <span className="block">{entry.review_note}</span> : null}
        </Alert>
      ) : null}
      <div className="space-y-2">
        {showSummaryHe ? (
          <p className="text-base text-ink-900">{entry.summary_he}</p>
        ) : showSummaryEn ? (
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

      {entry.image ? <MedicinePicture image={entry.image} name={entry.name_he ?? entry.name_en} /> : null}

      {sectionKeys.length > 0 ? (
        <div className="space-y-2">
          {sectionKeys.map((key) => {
            const text = shown?.[key];
            if (!text) return null;
            const warning = WARNING_SECTIONS.has(key);
            return (
              <Collapsible
                key={key}
                titleAs={headingLevel}
                title={t(`sections.${key}` as never)}
                defaultOpen={key === openKey}
                className={cn(warning && 'border-s-4 border-s-amber-400')}
              >
                <p
                  className={cn('whitespace-pre-wrap text-sm text-ink-800', shownIsEnglish && 'text-start')}
                  dir={shownIsEnglish ? 'ltr' : undefined}
                >
                  {text}
                </p>
              </Collapsible>
            );
          })}
        </div>
      ) : null}

      {groupKeys.length > 0 ? (
        <Collapsible titleAs={headingLevel} title={t('links.title')} badge={<Badge tone="muted">{links.length}</Badge>}>
          <div className="space-y-2">
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
          </div>
        </Collapsible>
      ) : null}

      {entry.israel ? <IsraeliProducts israel={entry.israel} headingLevel={headingLevel} /> : null}

      {entry.quotes?.length ? (
        <Collapsible titleAs={headingLevel} title={t('quotes.title')} badge={<Badge tone="muted">{entry.quotes.length}</Badge>}>
          <p className="mb-2 text-xs text-ink-600">{t('quotes.hint')}</p>
          <div className="space-y-1.5">
            {entry.quotes.map((quote, index) => (
              <Quote key={`${quote.source}-${quote.field}-${index}`} quote={quote} sourceLabel={sourceName(quote.source, t)} fieldLabel={t(`sections.${quote.field}` as never)} />
            ))}
          </div>
        </Collapsible>
      ) : null}

      {/* The entry's standing lives with its sources: the status on the shut
          row, and inside, where the Hebrew came from and what was checked. */}
      <Collapsible titleAs={headingLevel} title={t('sources.title')} badge={<MedicineStatusBadge entry={entry} />}>
        <div className="space-y-3">
          <div className="space-y-1 text-xs text-ink-600">
            {verdict && entry.status === 'verified' ? <p className="text-ink-800">{verdict}</p> : null}
            <p>{hebrewNote}</p>
            {checks.length ? (
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {checks.map((line) => (
                  <li key={line} dir="auto">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {basis.length > 0 ? <SourceList sources={basis} label={t('sources.basis')} nameOf={(source) => sourceName(source, t)} /> : null}
          {furtherReading.length > 0 ? (
            <SourceList sources={furtherReading} label={t('sources.furtherReading')} nameOf={(source) => sourceName(source, t)} />
          ) : null}
        </div>
      </Collapsible>

      {nhs ? <NhsAttribution url={nhs.url} /> : null}
      {fromWikipedia ? <WikipediaAttribution source={fromWikipedia} /> : null}

      <Alert tone="warning" title={t('disclaimer.title')}>
        <span className="block">{t('disclaimer.body')}</span>
        {/* A normal range belongs to the laboratory that ran the test, not to
            a reference book; the entry says where to read it instead. */}
        {entry.kind === 'lab_test' ? <span className="mt-1 block">{t('labTest.ranges')}</span> : null}
        {entry.kind === 'drug' ? (
          <ExternalLink href={MOH_DRUG_REGISTRY} newTabLabel={tc('opensInNewTab')} className="mt-1 underline-offset-2 hover:underline">
            {t('disclaimer.registry')}
          </ExternalLink>
        ) : null}
      </Alert>
    </div>
  );
}

/**
 * The entry's picture — an illustration, a micrograph, an X-ray from
 * Wikimedia Commons, chosen by the pipeline and looked at by a person —
 * with the credit its licence asks for, always, and a link to the file.
 * Shown as it is, scaled only, so a share-alike licence binds nothing.
 */
function MedicinePicture({ image, name }: { image: NonNullable<MedEntry['image']>; name: string }) {
  const t = useTranslations('medicine');
  const tc = useTranslations('common');
  return (
    <figure className="rounded-lg border border-ink-200 bg-white p-2">
      <img src={image.file} alt={t('image.alt', { name })} loading="lazy" className="mx-auto max-h-64 w-auto max-w-full rounded-md" />
      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-600">
        {image.author ? <span dir="auto">{t('image.author', { author: image.author })}</span> : null}
        <span>{t('sources.licence', { licence: image.licence })}</span>
        {image.page ? (
          <ExternalLink href={image.page} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
            {image.source}
          </ExternalLink>
        ) : (
          <span>{image.source}</span>
        )}
      </figcaption>
    </figure>
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
        {/* The source's own words keep the source's direction: the American and
            British texts read left to right, the Hebrew article right to left. */}
        <p dir={quote.lang === 'he' ? undefined : 'ltr'} className="whitespace-pre-wrap text-start text-sm text-ink-800">
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
 * What is on the shelf here: the products of this substance registered in
 * Israel, under the names a patient says, and the leaflet in Hebrew. It sits
 * above the sources because it is the part a clinic in Israel acts on, and
 * it carries no text from the leaflet itself — only the link to it.
 */
function IsraeliProducts({ israel, headingLevel }: { israel: NonNullable<MedEntry['israel']>; headingLevel: 'h2' | 'h3' }) {
  const t = useTranslations('medicine');
  const tc = useTranslations('common');
  return (
    <Collapsible titleAs={headingLevel} title={t('israel.title')} badge={<Badge tone="muted">{israel.products.length}</Badge>}>
      <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white">
        {israel.products.map((product) => (
          <li key={product.registration} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 text-sm">
            <span className="font-medium text-ink-900">{product.name_he}</span>
            <span className="text-xs text-ink-500" dir="ltr">
              {product.name_en}
            </span>
            {product.dosage_form ? <span className="text-xs text-ink-600">{product.dosage_form}</span> : null}
            <span className="ms-auto flex items-center gap-1.5">
              {product.in_basket ? <Badge tone="success">{t('israel.inBasket')}</Badge> : null}
              <Badge tone={product.prescription ? 'neutral' : 'muted'}>{product.prescription ? t('israel.prescription') : t('israel.otc')}</Badge>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
        <span>{t('israel.source')}</span>
        {israel.leaflet ? (
          <ExternalLink href={israel.leaflet.url} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
            {t('israel.leaflet', { language: israel.leaflet.language })}
          </ExternalLink>
        ) : null}
        <ExternalLink href="https://israeldrugs.health.gov.il/" newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
          {t('israel.registry')}
        </ExternalLink>
      </p>
    </Collapsible>
  );
}

/**
 * What a share-alike licence asks of a page that shows the text: name the
 * article, link to it, name the licence — and say that this entry's Hebrew
 * is under the same licence, which is the part that matters to a reader who
 * wants to reuse it.
 */
function WikipediaAttribution({ source }: { source: NonNullable<NonNullable<MedEntry['hebrew_meta']>['source']> }) {
  const t = useTranslations('medicine');
  const tc = useTranslations('common');
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm">
      <p className="text-ink-800">{t('wikipedia.attribution', { licence: source.licence })}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-600">
        <ExternalLink href={source.url} newTabLabel={tc('opensInNewTab')} className="underline-offset-2 hover:underline">
          {source.title}
        </ExternalLink>
        {source.revised_at ? <span>· {t('wikipedia.revised', { date: formatDate(new Date(source.revised_at)) })}</span> : null}
      </p>
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
