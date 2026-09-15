import { useTranslations } from 'next-intl';
import { catalogueSources, type CatalogueTextRow } from '@clinic/domain';
import { ExternalLink } from '@/components/external-link';

/**
 * "The facts were gathered from: Bara · American Dragon" — one small line
 * under a catalogue entry whose text was written from the two references
 * (migration 57). Nothing when the row carries no sources: an entry a
 * practitioner wrote is theirs and says nothing here.
 */
export function SourcesLine({
  row,
  className = '',
}: {
  row: CatalogueTextRow;
  className?: string;
}) {
  const t = useTranslations('reference.sources');
  const tc = useTranslations('common');
  const sources = catalogueSources(row);
  if (sources.length === 0) return null;
  return (
    <p className={`text-xs leading-relaxed text-ink-600 ${className}`.trim()}>
      {t('title')}{' '}
      {sources.map((source, index) => (
        <span key={`${source.name}-${source.url}`}>
          {index > 0 ? ' · ' : ''}
          <ExternalLink
            href={source.url}
            newTabLabel={tc('opensInNewTab')}
            className="underline-offset-2 hover:underline"
          >
            {source.name === 'bara'
              ? t('bara')
              : source.name === 'americandragon'
                ? t('americandragon')
                : source.name}
          </ExternalLink>
        </span>
      ))}
    </p>
  );
}
