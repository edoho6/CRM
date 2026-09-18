'use server';

import { z } from 'zod';
import { getScopeWithAbility } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { CHAT_TITLE_MAX, type ChatMessage, type ChatSummary } from './chat-types';

/**
 * The practitioner's conversations with the library: a list to come back
 * to, on any device. Every row is theirs alone — the policies allow a
 * person their own chats in their own clinic and nothing else — so these
 * actions carry no filter by user: the database is the filter.
 *
 * Writing a conversation happens in the ask route, next to the answer,
 * so that a question the library refused for an identifying detail is
 * never written at all. Here: list, rename, pin, delete, read back.
 */

const Id = z.string().uuid();
const Title = z.string().trim().min(1).max(CHAT_TITLE_MAX);

const CHAT_COLUMNS = 'id, title, pinned, last_message_at';

interface ChatRow {
  id: string;
  title: string;
  pinned: boolean;
  last_message_at: string;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  status: ChatMessage['status'];
  content: string;
  general: string | null;
  created_at: string;
}

const toSummary = (row: ChatRow): ChatSummary => ({ id: row.id, title: row.title, pinned: row.pinned, lastMessageAt: row.last_message_at });

/** Pinned first, then the most recently active; two hundred is more than a list can show. */
export async function listChats(): Promise<ActionResult<ChatSummary[]>> {
  const scope = await getScopeWithAbility('library');
  if (!scope) return actionError(new Error('unauthorized'));
  const { data, error } = await scope.supabase
    .from('library_chats')
    .select(CHAT_COLUMNS)
    .order('pinned', { ascending: false })
    .order('last_message_at', { ascending: false })
    .limit(200)
    .returns<ChatRow[]>();
  if (error) return actionError(error);
  return actionOk((data ?? []).map(toSummary));
}

export async function loadChatMessages(chatId: string): Promise<ActionResult<ChatMessage[]>> {
  const scope = await getScopeWithAbility('library');
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(chatId);
  if (!id.success) return actionError(new Error('validation'));
  const { data, error } = await scope.supabase
    .from('library_messages')
    .select('id, role, status, content, general, created_at')
    .eq('chat_id', id.data)
    .order('created_at', { ascending: true })
    .limit(400)
    .returns<MessageRow[]>();
  if (error) return actionError(error);
  return actionOk((data ?? []).map((row) => ({ id: row.id, role: row.role, status: row.status, content: row.content, general: row.general ?? null, createdAt: row.created_at })));
}

export async function renameChat(chatId: string, title: string): Promise<ActionResult> {
  const scope = await getScopeWithAbility('library');
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(chatId);
  const name = Title.safeParse(title);
  if (!id.success || !name.success) return actionError(new Error('validation'));
  const { error, count } = await scope.supabase.from('library_chats').update({ title: name.data }, { count: 'exact' }).eq('id', id.data);
  if (error) return actionError(error);
  if (!count) return actionError(new Error('not_found'));
  return actionOk();
}

export async function setChatPinned(chatId: string, pinned: boolean): Promise<ActionResult> {
  const scope = await getScopeWithAbility('library');
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(chatId);
  if (!id.success) return actionError(new Error('validation'));
  const { error, count } = await scope.supabase.from('library_chats').update({ pinned: Boolean(pinned) }, { count: 'exact' }).eq('id', id.data);
  if (error) return actionError(error);
  if (!count) return actionError(new Error('not_found'));
  return actionOk();
}

/** The conversation and every message in it; the activity log keeps its line, which never held the text. */
export async function deleteChat(chatId: string): Promise<ActionResult> {
  const scope = await getScopeWithAbility('library');
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(chatId);
  if (!id.success) return actionError(new Error('validation'));
  const { error, count } = await scope.supabase.from('library_chats').delete({ count: 'exact' }).eq('id', id.data);
  if (error) return actionError(error);
  if (!count) return actionError(new Error('not_found'));
  return actionOk();
}
