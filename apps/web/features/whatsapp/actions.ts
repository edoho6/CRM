'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import type { WhatsappConversation, WhatsappMessage } from '@clinic/db/types';
import { getClinicScope, type ClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { CHAT_MESSAGE_MAX, type ConversationSummary, type ThreadMessage } from './types';

/**
 * The WhatsApp threads, from the app's side.
 *
 * Reading is the policies' work: a member sees their clinic's threads and
 * nothing else, so nothing here filters by clinic. Writing is one row —
 * what the practitioner typed, queued — and then a word to the sender so
 * it goes now rather than at the next five minutes; the sender takes the
 * row under a lock, so the word and the schedule never send it twice.
 * What comes in is never written from here: the push writes it, as the
 * service, and the app only reads.
 */

const Id = z.string().uuid();
const Body = z.string().trim().min(1).max(CHAT_MESSAGE_MAX);

const CONVERSATION_SELECT =
  'id, contact_key, phone, contact_name, patient_id, status, unread_count, last_message_at, last_message_preview, last_inbound_at, patient:patients(id, full_name, first_name)';
const MESSAGE_SELECT = 'id, direction, kind, body, media_url, status, error_code, template_id, created_at';

type ConversationRow = Pick<
  WhatsappConversation,
  'id' | 'contact_key' | 'phone' | 'contact_name' | 'patient_id' | 'status' | 'unread_count' | 'last_message_at' | 'last_message_preview' | 'last_inbound_at'
> & { patient: { id: string; full_name: string; first_name: string } | { id: string; full_name: string; first_name: string }[] | null };

type MessageRow = Pick<WhatsappMessage, 'id' | 'direction' | 'kind' | 'body' | 'media_url' | 'status' | 'error_code' | 'template_id' | 'created_at'>;

function toSummary(row: ConversationRow): ConversationSummary {
  // PostgREST embeds a one-to-one as an object, but the type says either.
  const patient = Array.isArray(row.patient) ? (row.patient[0] ?? null) : row.patient;
  return {
    id: row.id,
    contactKey: row.contact_key,
    phone: row.phone,
    contactName: row.contact_name,
    patient: patient ? { id: patient.id, fullName: patient.full_name, firstName: patient.first_name } : null,
    status: row.status,
    unread: row.unread_count,
    lastMessageAt: row.last_message_at,
    preview: row.last_message_preview,
    lastInboundAt: row.last_inbound_at,
  };
}

function toMessage(row: MessageRow): ThreadMessage {
  return {
    id: row.id,
    direction: row.direction,
    kind: row.kind,
    body: row.body,
    mediaUrl: row.media_url,
    status: row.status,
    errorCode: row.error_code,
    templateId: row.template_id,
    createdAt: row.created_at,
  };
}

/** A word to the sender: the queue has something. Failure is the schedule's to catch up on. */
async function wakeSender(scope: ClinicScope): Promise<void> {
  try {
    await scope.supabase.functions.invoke('dispatch-messages', { body: { only: 'whatsapp' } });
  } catch {
    // The schedule runs every five minutes either way.
  }
}

/** The most recent two hundred threads, open ones first by their last message. */
export async function listConversations(): Promise<ActionResult<ConversationSummary[]>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const { data, error } = await scope.supabase
    .from('whatsapp_conversations')
    .select(CONVERSATION_SELECT)
    .order('last_message_at', { ascending: false })
    .limit(200)
    .returns<ConversationRow[]>();
  if (error) return actionError(error);
  return actionOk((data ?? []).map(toSummary));
}

export async function loadConversation(
  conversationId: string,
): Promise<ActionResult<{ conversation: ConversationSummary; messages: ThreadMessage[] }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(conversationId);
  if (!id.success) return actionError(new Error('validation'));

  const [conversation, messages] = await Promise.all([
    scope.supabase.from('whatsapp_conversations').select(CONVERSATION_SELECT).eq('id', id.data).maybeSingle<ConversationRow>(),
    scope.supabase
      .from('whatsapp_messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', id.data)
      .order('created_at', { ascending: true })
      .limit(500)
      .returns<MessageRow[]>(),
  ]);
  if (conversation.error) return actionError(conversation.error);
  if (!conversation.data) return actionError(new Error('not_found'));
  if (messages.error) return actionError(messages.error);
  return actionOk({ conversation: toSummary(conversation.data), messages: (messages.data ?? []).map(toMessage) });
}

/** What the practitioner typed: queued for the sender, and the sender woken. */
export async function sendChatMessage(conversationId: string, body: string): Promise<ActionResult<ThreadMessage>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(conversationId);
  const text = Body.safeParse(body);
  if (!id.success || !text.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('whatsapp_messages')
    .insert({
      clinic_id: scope.context.clinic.id,
      conversation_id: id.data,
      direction: 'out',
      kind: 'text',
      body: text.data,
      status: 'queued',
      sent_by: scope.context.membership.user_id,
    })
    .select(MESSAGE_SELECT)
    .single<MessageRow>();
  if (error) return actionError(error);
  await wakeSender(scope);
  return actionOk(toMessage(data));
}

/**
 * The template that opens a conversation more than a day after the patient
 * last wrote: sent with the patient's first name and the clinic's name as
 * its two variables. The row keeps a readable body so the thread shows what
 * was said; the service sends the approved wording.
 */
export async function sendOpener(conversationId: string): Promise<ActionResult<ThreadMessage>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(conversationId);
  if (!id.success) return actionError(new Error('validation'));

  const [{ data: opener }, { data: conversation }] = await Promise.all([
    scope.supabase
      .from('clinic_automations')
      .select('whatsapp_template_id')
      .eq('kind', 'conversation_opener')
      .maybeSingle<{ whatsapp_template_id: string | null }>(),
    scope.supabase.from('whatsapp_conversations').select(CONVERSATION_SELECT).eq('id', id.data).maybeSingle<ConversationRow>(),
  ]);
  const templateId = opener?.whatsapp_template_id?.trim();
  if (!templateId) return actionError(new Error('no_opener'));
  if (!conversation) return actionError(new Error('not_found'));

  const summary = toSummary(conversation);
  const name = summary.patient?.firstName || summary.contactName || '';
  const t = await getTranslations('messages.inbox');
  const clinic = scope.context.clinic.name;
  const { data, error } = await scope.supabase
    .from('whatsapp_messages')
    .insert({
      clinic_id: scope.context.clinic.id,
      conversation_id: id.data,
      direction: 'out',
      kind: 'template',
      body: t('openerBody', { name, clinic }),
      template_id: templateId,
      params: [name, clinic],
      status: 'queued',
      sent_by: scope.context.membership.user_id,
    })
    .select(MESSAGE_SELECT)
    .single<MessageRow>();
  if (error) return actionError(error);
  await wakeSender(scope);
  return actionOk(toMessage(data));
}

/** A message the service refused, offered again once its reason was seen to. */
export async function retryChatMessage(messageId: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(messageId);
  if (!id.success) return actionError(new Error('validation'));
  const { error } = await scope.supabase
    .from('whatsapp_messages')
    .update({ status: 'queued', error_code: null, claimed_at: null })
    .eq('id', id.data)
    .eq('status', 'failed');
  if (error) return actionError(error);
  await wakeSender(scope);
  return actionOk();
}

export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(conversationId);
  if (!id.success) return actionError(new Error('validation'));
  const { error } = await scope.supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', id.data);
  if (error) return actionError(error);
  return actionOk();
}

export async function setConversationStatus(conversationId: string, status: 'open' | 'closed'): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(conversationId);
  if (!id.success || (status !== 'open' && status !== 'closed')) return actionError(new Error('validation'));
  const { error } = await scope.supabase.from('whatsapp_conversations').update({ status }).eq('id', id.data);
  if (error) return actionError(error);
  return actionOk();
}

/** Which file the thread belongs to — a person's choice when the number is not in one file alone. */
export async function linkConversationPatient(conversationId: string, patientId: string | null): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(conversationId);
  const patient = patientId === null ? { success: true as const, data: null } : Id.safeParse(patientId);
  if (!id.success || !patient.success) return actionError(new Error('validation'));
  const { error } = await scope.supabase
    .from('whatsapp_conversations')
    .update({ patient_id: patient.data })
    .eq('id', id.data);
  if (error) return actionError(error);
  return actionOk();
}

/** A thread for this file's number, made if there is none; the number must be one WhatsApp can address. */
export async function openConversationForPatient(patientId: string): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const id = Id.safeParse(patientId);
  if (!id.success) return actionError(new Error('validation'));
  const { data, error } = await scope.supabase.rpc('whatsapp_open_for_patient', { p_patient: id.data });
  if (error) return actionError(error.message.includes('no_phone') ? new Error('no_phone') : error);
  return actionOk({ id: data as string });
}

/** How many threads hold something unread — the number on the menu. */
export async function unreadConversations(): Promise<ActionResult<number>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const { count, error } = await scope.supabase
    .from('whatsapp_conversations')
    .select('id', { count: 'exact', head: true })
    .gt('unread_count', 0);
  if (error) return actionError(error);
  return actionOk(count ?? 0);
}
