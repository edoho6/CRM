import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@clinic/domain';
import type { Herb } from '@clinic/db/types';
import { herbBotanicalName, herbChineseName, herbPrimaryName } from '@/lib/display';
import { referenceImageFor } from './herb-reference-image';
import type { HerbGalleryEntry } from './herb-gallery';

type GalleryHerb = Pick<
  Herb,
  | 'id'
  | 'pinyin_name'
  | 'chinese_name'
  | 'english_name'
  | 'hebrew_name'
  | 'botanical_name'
  | 'image_url'
  | 'image_attribution'
>;

/**
 * Every herb that has a photograph — the clinic's own or the catalogue's —
 * as the light list the gallery searches. A few hundred rows of names and
 * one path each; fetched once per page so the comparison box can offer any
 * herb, not only the ones on the page being read.
 */
export async function loadHerbGalleryEntries(
  supabase: SupabaseClient,
  locale: string,
): Promise<HerbGalleryEntry[]> {
  const { data } = await supabase
    .from('herbs')
    .select('id, pinyin_name, chinese_name, english_name, hebrew_name, botanical_name, image_url, image_attribution')
    .order('pinyin_name', { ascending: true })
    .limit(2000)
    .returns<GalleryHerb[]>();

  const entries: HerbGalleryEntry[] = [];
  for (const herb of data ?? []) {
    const reference = herb.image_url ? null : referenceImageFor(herb);
    const src = herb.image_url ?? reference?.src;
    if (!src) continue;
    const chinese = herbChineseName(herb);
    const botanical = herbBotanicalName(herb);
    entries.push({
      id: herb.id,
      name: herbPrimaryName(herb, locale as Locale),
      secondary: chinese || botanical || null,
      keywords: [
        herb.pinyin_name,
        herb.chinese_name,
        herb.english_name,
        herb.hebrew_name,
        herb.botanical_name,
      ]
        .filter(Boolean)
        .join(' '),
      src,
      form: herb.image_url ? 'clinic' : reference!.form,
      credit:
        !herb.image_url && reference
          ? {
              author: reference.author,
              source: reference.source,
              licence: reference.licence,
              licenceUrl: reference.licenceUrl,
              page: reference.page,
            }
          : null,
    });
  }
  return entries;
}
