import type { WhatsappMessageKind, WhatsappMessageStatus } from '@clinic/domain';

/** One thread as the list shows it: who, what was last said, how much waits. */
export interface ConversationSummary {
  id: string;
  contactKey: string;
  phone: string | null;
  contactName: string | null;
  patient: { id: string; fullName: string; firstName: string } | null;
  status: 'open' | 'closed';
  unread: number;
  lastMessageAt: string;
  preview: string | null;
  /** When the patient last wrote: free text may go for a day after it. */
  lastInboundAt: string | null;
}

/** One message as the thread shows it. */
export interface ThreadMessage {
  id: string;
  direction: 'in' | 'out';
  kind: WhatsappMessageKind;
  body: string | null;
  mediaUrl: string | null;
  status: WhatsappMessageStatus;
  errorCode: string | null;
  templateId: string | null;
  createdAt: string;
}

/** A file the thread can be joined to, or opened for. */
export interface PatientOption {
  id: string;
  fullName: string;
  phone: string | null;
}

/** The longest message the composer sends; the service takes more, a thread does not need it. */
export const CHAT_MESSAGE_MAX = 2000;
