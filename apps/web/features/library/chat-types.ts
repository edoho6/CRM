/**
 * The shapes a conversation is passed around in. A `'use server'` module
 * may export nothing but async functions, so the types and the one
 * constant live here, for the actions and the page alike.
 */

export interface ChatSummary {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  status: 'answered' | 'no_sources' | 'refused_quota' | 'error' | null;
  content: string;
  createdAt: string;
}

/** The column's limit; the list shows less and the name is cut earlier. */
export const CHAT_TITLE_MAX = 120;
