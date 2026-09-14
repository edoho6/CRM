import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { listChats, loadChatMessages } from '@/features/library/chats';
import { LibraryNav } from '@/features/library/library-nav';
import { LibraryWorkspace } from '@/features/library/library-workspace';
import { isLibraryConfigured } from '@/features/library/voyage';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('library', 'title');

/**
 * The library as a chat. The page brings the practitioner's conversations
 * with it, and the one named in the address (`?chat=`) with its messages,
 * so the first paint is the conversation and not a spinner; the rest is
 * the client's.
 */
export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ chat?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const scope = await getClinicScope();
  if (!scope) return null;
  const t = await getTranslations('library');

  const configured = isLibraryConfigured();
  const chats = configured ? await listChats() : null;
  const list = chats?.ok ? chats.data : [];
  const wanted = (await searchParams).chat;
  const initialChatId = typeof wanted === 'string' && list.some((chat) => chat.id === wanted) ? wanted : null;
  const messages = initialChatId ? await loadChatMessages(initialChatId) : null;

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<LibraryNav current="chat" />} />
      <PageBody width="wide">
        <LibraryWorkspace
          configured={configured}
          chats={list}
          initialChatId={initialChatId}
          initialMessages={messages?.ok ? messages.data : []}
          examples={[t('examples.a'), t('examples.b'), t('examples.c')]}
        />
      </PageBody>
    </>
  );
}
