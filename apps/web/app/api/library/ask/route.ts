import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LIBRARY_DISCLAIMER_HE, LIBRARY_LIMITS } from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { askLibrary } from '@/features/library/ask';
import { LibraryUnavailableError } from '@/features/library/claude';
import { isLibraryConfigured } from '@/features/library/voyage';

/**
 * The library's one endpoint: a question in, an answer with its citations
 * and the disclaimer out — every reply carries the disclaimer, whatever
 * its status, so the page can print it under each answer without a case
 * of its own.
 *
 * A route handler rather than a server action for two reasons: the JSON
 * shape is the contract (a field called `disclaimer`, always there), and
 * two model calls in a row need more than a serverless function's default
 * time. Same-origin only: the page's own fetch, with the session cookie.
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
});

export async function POST(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const scope = await getClinicScope();
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isLibraryConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    const result = await askLibrary(scope.supabase, parsed.data);
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    // A short code, never the question and never a provider's message body.
    const code = error instanceof LibraryUnavailableError ? error.message : 'error';
    return NextResponse.json(
      { status: 'error', answer: '', citations: [], retrieved: [], disclaimer: LIBRARY_DISCLAIMER_HE, error: code },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  }
}
