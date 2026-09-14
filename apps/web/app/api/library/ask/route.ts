import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIBRARY_DISCLAIMER_HE, LIBRARY_LIMITS, chatTitleFrom } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { askLibrary, type AskResult, type StageListener } from '@/features/library/ask';
import { LibraryUnavailableError } from '@/features/library/claude';
import { streamReply } from '@/features/library/stream';
import { isLibraryConfigured } from '@/features/library/voyage';

/**
 * The library's one endpoint: a question in, an answer with its citations
 * and the disclaimer out — every reply carries the disclaimer, whatever
 * its status, so the page can print it without a case of its own.
 *
 * A route handler rather than a server action for two reasons: the JSON
 * shape is the contract (a field called `disclaimer`, always there), and
 * two model calls in a row need more than a serverless function's default
 * time. Same-origin only: the page's own fetch, with the session cookie.
 *
 * Two shapes of reply, by the Accept header. Plain JSON is the contract.
 * `application/x-ndjson` is the same reply streamed: one line per stage
 * as the answer is searched for, written and checked, then a `done` line
 * carrying the whole reply — the answer's text is never sent before the
 * checks have passed it, so nothing the checks would strike is ever shown.
 *
 * The exchange is then kept in the practitioner's conversation (see
 * `keep`), and the reply names the conversation it went into.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  question: z.string().trim().min(1).max(LIBRARY_LIMITS.questionChars),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(LIBRARY_LIMITS.historyChars) }))
    .max(LIBRARY_LIMITS.historyTurns * 2)
    .default([]),
  /** The conversation to continue. None for a new one: it is opened with the first answer. */
  chatId: z.string().uuid().optional(),
});

const NO_STORE = { 'cache-control': 'no-store' };

export interface KeptResult extends AskResult {
  /** The conversation the exchange was written to; null when nothing was written. */
  chatId: string | null;
}

function errorReply(error: unknown): KeptResult & { error: string } {
  // A short code, never the question and never a provider's message body.
  const code = error instanceof LibraryUnavailableError ? error.message : 'error';
  return { status: 'error', answer: '', citations: [], retrieved: [], disclaimer: LIBRARY_DISCLAIMER_HE, error: code, chatId: null };
}

/**
 * Writes the question and its answer into the conversation — after the
 * answer, never before: a question refused for an identifying detail is
 * not written at all (the refusal is shown once and forgotten), and a
 * failure leaves nothing half-written. A new conversation is opened here,
 * on its first answer, named after the question. The policies make every
 * row the practitioner's own; a write that fails leaves the reply as it
 * is, with no conversation named.
 */
async function keep(
  supabase: SupabaseClient,
  ids: { userId: string; clinicId: string },
  chatId: string | undefined,
  question: string,
  result: AskResult,
): Promise<string | null> {
  if (result.status === 'refused_pii' || result.status === 'error') return chatId ?? null;
  let id = chatId ?? null;
  if (!id) {
    const { data } = await supabase
      .from('library_chats')
      .insert({ clinic_id: ids.clinicId, user_id: ids.userId, title: chatTitleFrom(question) || '…' })
      .select('id')
      .single<{ id: string }>();
    id = data?.id ?? null;
    if (!id) return null;
  }
  const base = { chat_id: id, clinic_id: ids.clinicId, user_id: ids.userId };
  const { error } = await supabase.from('library_messages').insert([
    { ...base, role: 'user', status: null, content: question },
    { ...base, role: 'assistant', status: result.status, content: result.answer },
  ]);
  if (error) return chatId ?? null;
  await supabase.from('library_chats').update({ last_message_at: new Date().toISOString() }).eq('id', id);
  return id;
}

export async function POST(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const scope = await getClinicScope();
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isLibraryConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // A conversation named by the caller must be theirs: the policies answer with nothing otherwise.
  const { chatId } = parsed.data;
  if (chatId) {
    const { data } = await scope.supabase.from('library_chats').select('id').eq('id', chatId).maybeSingle<{ id: string }>();
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const ids = { userId: scope.context.membership.user_id, clinicId: scope.context.clinic.id };
  const run = async (onStage?: StageListener): Promise<KeptResult> => {
    const result = await askLibrary(scope.supabase, parsed.data, onStage);
    return { ...result, chatId: await keep(scope.supabase, ids, chatId, parsed.data.question, result) };
  };

  const wantsStream = (request.headers.get('accept') ?? '').includes('application/x-ndjson');
  if (!wantsStream) {
    try {
      return NextResponse.json(await run(), { headers: NO_STORE });
    } catch (error) {
      return NextResponse.json(errorReply(error), { status: 200, headers: NO_STORE });
    }
  }

  return streamReply((onStage) => run(onStage), errorReply);
}
