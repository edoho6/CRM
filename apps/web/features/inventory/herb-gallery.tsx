'use client';

import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Images, Plus, X } from 'lucide-react';
import { Button, Combobox, Dialog, DialogContent, cn, type ComboboxValue } from '@clinic/ui';
import { ZoomFrame } from '@/features/encounters/zoom-frame';
import { HerbMonographSheet } from './herb-monograph-sheet';

/**
 * The catalogue's photographs, large and side by side.
 *
 * A thumbnail in the list opens its herb at full size with the same zoom
 * frame the tongue photographs use — wheel, drag, +/−, double-click to
 * reset. From there, or from the "compare photographs" button over the
 * list, up to six herbs sit beside one another in a window that takes the
 * whole screen, each picked by name from a search box that knows every herb
 * with a photograph, not only the page on screen: "does Bai Shao look like
 * Chi Shao" is asked across the catalogue. The pictures can be put in any
 * order, and a herb's name opens its monograph over the comparison.
 *
 * The provider carries that list once per page; thumbnails and the button
 * reach it through context, so the server-rendered rows stay rows.
 */
export const MAX_COMPARED = 6;

export interface HerbGalleryEntry {
  id: string;
  /** The herb's primary name in the page's language. */
  name: string;
  /** Chinese characters and the botanical name — shown beside the name in the list. */
  secondary: string | null;
  /** Every other name, for the search box. */
  keywords: string;
  src: string;
  /** The catalogue's photograph shows the dried material or the living plant. */
  form: 'material' | 'plant' | 'clinic';
  credit: { author: string; source: string; licence: string; licenceUrl: string; page: string } | null;
}

interface GalleryState {
  entries: HerbGalleryEntry[];
  open: (id: string) => void;
  openCompare: () => void;
}

const GalleryContext = createContext<GalleryState | null>(null);

export function HerbGalleryProvider({
  entries,
  children,
}: {
  entries: HerbGalleryEntry[];
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState<string[] | null>(null);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const open = useCallback((id: string) => setShown([id]), []);
  const openCompare = useCallback(() => setShown([]), []);
  const value = useMemo(() => ({ entries, open, openCompare }), [entries, open, openCompare]);

  return (
    <GalleryContext.Provider value={value}>
      {children}
      <Dialog open={shown !== null} onOpenChange={(isOpen) => !isOpen && setShown(null)}>
        {shown !== null ? (
          <GalleryContent
            shown={shown}
            byId={byId}
            entries={entries}
            onChange={setShown}
          />
        ) : null}
      </Dialog>
    </GalleryContext.Provider>
  );
}

function useGallery(): GalleryState | null {
  return useContext(GalleryContext);
}

/** For a picture outside the list (the monograph's card): null where no provider is mounted. */
export function useHerbGallery(): { open: (id: string) => void } | null {
  const gallery = useGallery();
  return gallery ? { open: gallery.open } : null;
}

/**
 * The thumbnail in a list row: a button that opens the photograph large.
 * Falls back to a plain picture where no provider is mounted.
 */
export function HerbThumb({
  herbId,
  src,
  alt,
  className,
}: {
  herbId: string;
  src: string;
  alt: string;
  className?: string;
}) {
  const t = useTranslations('inventory.image');
  const gallery = useGallery();
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={gallery ? '' : alt}
      loading="lazy"
      className={cn('h-12 w-12 shrink-0 rounded-lg border border-ink-100 object-cover', className)}
    />
  );
  if (!gallery) return image;
  return (
    <button
      type="button"
      onClick={() => gallery.open(herbId)}
      aria-label={t('openLarge', { name: alt })}
      title={t('openLarge', { name: alt })}
      className="shrink-0 rounded-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-100"
    >
      {image}
    </button>
  );
}

/** "Compare photographs" — opens the gallery empty, with the search box. */
export function HerbCompareButton({ className }: { className?: string }) {
  const t = useTranslations('inventory.image');
  const gallery = useGallery();
  if (!gallery || gallery.entries.length === 0) return null;
  return (
    <Button type="button" variant="secondary" onClick={gallery.openCompare} className={className}>
      <Images className="h-4 w-4" aria-hidden />
      {t('compare')}
    </Button>
  );
}

const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40';

function GalleryContent({
  shown,
  byId,
  entries,
  onChange,
}: {
  shown: string[];
  byId: Map<string, HerbGalleryEntry>;
  entries: HerbGalleryEntry[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations('inventory.image');
  const tc = useTranslations('common');
  const [pick, setPick] = useState<ComboboxValue | null>(null);
  const [monograph, setMonograph] = useState<HerbGalleryEntry | null>(null);

  const herbs = shown.map((id) => byId.get(id)).filter((entry): entry is HerbGalleryEntry => Boolean(entry));
  const full = herbs.length >= MAX_COMPARED;
  const options = useMemo(
    () =>
      entries
        .filter((entry) => !shown.includes(entry.id))
        .map((entry) => ({
          id: entry.id,
          label: entry.name,
          secondary: entry.secondary,
          keywords: entry.keywords,
        })),
    [entries, shown],
  );

  /** Moves one picture a step towards the start (−1) or the end (+1) of the row. */
  const move = (id: string, step: -1 | 1) => {
    const from = shown.indexOf(id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= shown.length) return;
    const next = [...shown];
    next.splice(from, 1);
    next.splice(to, 0, id);
    onChange(next);
  };

  const zoomLabels = { zoomIn: t('zoomIn'), zoomOut: t('zoomOut'), hint: t('zoomHint') };
  const title =
    herbs.length === 0
      ? t('compare')
      : herbs.length === 1
        ? herbs[0]!.name
        : t('comparing', { count: herbs.length });

  return (
    <DialogContent
      title={title}
      closeLabel={tc('close')}
      // The whole screen, less a rim: side by side is the point, and six
      // pictures in a card the width of a form would each be a stamp.
      className="sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none"
    >
      <div className="flex flex-col gap-3 sm:h-full">
        {/* The search box first: it is how a comparison is built, and on a
            phone it must not be a screen of pictures away. */}
        <div className="flex shrink-0 flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xl">
            {/* The box's name is spoken, not drawn: the caption under it says
                the same thing to the eye, with the room the sheet has. */}
            <p className="mb-1 text-xs font-medium text-ink-600">
              {full ? t('compareFull', { max: MAX_COMPARED }) : t('addHerb')}
            </p>
            <Combobox
              id="herb-gallery-pick"
              label={full ? t('compareFull', { max: MAX_COMPARED }) : t('addHerb')}
              options={options}
              value={pick}
              disabled={full}
              placeholder={t('addHerbPlaceholder')}
              onChange={(next) => {
                setPick(null);
                if (next?.id) onChange([...shown, next.id]);
              }}
            />
          </div>
          {herbs.length === 1 && !full ? (
            <p className="flex items-center gap-1.5 pb-2.5 text-xs text-ink-600">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('addAnotherHint')}
            </p>
          ) : null}
        </div>

        {herbs.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-600">{t('compareHint', { max: MAX_COMPARED })}</p>
        ) : (
          <div
            // One column per picture from `sm` up, whatever their number; a
            // phone stacks them and scrolls.
            style={{ '--cols': herbs.length } as CSSProperties}
            className="grid grid-cols-1 gap-3 sm:min-h-0 sm:flex-1 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
          >
            {herbs.map((herb, index) => (
              <figure key={herb.id} className="flex min-w-0 flex-col sm:min-h-0">
                <ZoomFrame
                  src={herb.src}
                  alt={herb.name}
                  fit="contain"
                  labels={zoomLabels}
                  className="h-[55vh] w-full rounded-lg border border-ink-200 bg-ink-50 sm:h-auto sm:min-h-0 sm:flex-1"
                />
                <figcaption className="mt-1.5 flex shrink-0 items-start justify-between gap-2 text-xs text-ink-600">
                  <span className="min-w-0">
                    {/* The name is the door to the monograph: what the
                        picture shows, in words, without leaving the comparison. */}
                    <button
                      type="button"
                      data-herb-name
                      onClick={() => setMonograph(herb)}
                      title={t('openMonograph', { name: herb.name })}
                      className="block max-w-full truncate rounded text-start text-sm font-semibold text-jade-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {herb.name}
                    </button>
                    {herb.secondary ? <span className="block truncate">{herb.secondary}</span> : null}
                    <span className="block">
                      {herb.form === 'clinic'
                        ? t('clinicPhoto')
                        : t(herb.form === 'material' ? 'referenceMaterialNote' : 'referencePlantNote')}
                    </span>
                    {/* The credit is a condition of the licence, not decoration. */}
                    {herb.credit ? (
                      <span className="block">
                        <a
                          href={herb.credit.page}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          {t('referenceCredit', {
                            author: herb.credit.author,
                            source: herb.credit.source,
                            licence: herb.credit.licence,
                          })}
                        </a>
                        {' · '}
                        <a
                          href={herb.credit.licenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-2 hover:underline"
                          dir="ltr"
                        >
                          {herb.credit.licence}
                        </a>
                      </span>
                    ) : null}
                  </span>
                  {herbs.length > 1 ? (
                    <span className="flex shrink-0 items-center">
                      {/* The arrows mean "towards the start" and "towards the
                          end" of the row, and are mirrored for Hebrew. */}
                      <button
                        type="button"
                        data-move="earlier"
                        disabled={index === 0}
                        onClick={() => move(herb.id, -1)}
                        aria-label={t('moveEarlier', { name: herb.name })}
                        title={t('moveEarlier', { name: herb.name })}
                        className={ICON_BUTTON}
                      >
                        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                      </button>
                      <button
                        type="button"
                        data-move="later"
                        disabled={index === herbs.length - 1}
                        onClick={() => move(herb.id, 1)}
                        aria-label={t('moveLater', { name: herb.name })}
                        title={t('moveLater', { name: herb.name })}
                        className={ICON_BUTTON}
                      >
                        <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(shown.filter((id) => id !== herb.id))}
                        aria-label={t('removeFromCompare', { name: herb.name })}
                        title={t('removeFromCompare', { name: herb.name })}
                        className={ICON_BUTTON}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      <HerbMonographSheet
        herbId={monograph?.id ?? null}
        fallbackName={monograph?.name ?? ''}
        onClose={() => setMonograph(null)}
      />
    </DialogContent>
  );
}
