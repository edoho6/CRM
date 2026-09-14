-- Migration 54 — the library's conversations, kept for the practitioner who had them.
--
-- Until now a conversation lived in the browser tab and died with it. The
-- practitioner asked for a chat that remembers: a list of conversations,
-- pinned or deleted at will, the same on every device. So the questions and
-- answers are kept here — private to the person who asked, never the
-- clinic's, never a colleague's — while the activity log (library_queries)
-- stays as it was: who asked and when, without a word of text.
--
-- A question the library refused because it carried an identifying detail
-- is never written here; the refusal is shown once and forgotten. That
-- rule lives in the route, not in a constraint, because the database cannot
-- tell a phone number from a dose.
create table if not exists public.library_chats (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists library_chats_user_idx on public.library_chats (user_id, pinned desc, last_message_at desc);

drop trigger if exists library_chats_set_updated_at on public.library_chats;
create trigger library_chats_set_updated_at
  before update on public.library_chats
  for each row execute function public.set_updated_at();

create table if not exists public.library_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.library_chats(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  -- The library's verdict on an answer; a question carries none.
  status text check (status is null or status in ('answered', 'no_sources', 'refused_quota', 'error')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists library_messages_chat_idx on public.library_messages (chat_id, created_at);

-- ---------------------------------------------------------------------------
-- Policies: one's own conversations, in one's own clinic, and nobody else's.
-- The functions sit inside a sub-select so they run once per query.
-- ---------------------------------------------------------------------------
alter table public.library_chats enable row level security;
alter table public.library_messages enable row level security;

drop policy if exists library_chats_own on public.library_chats;
create policy library_chats_own on public.library_chats
  for all
  using (user_id = (select auth.uid()) and clinic_id = (select public.current_clinic_id()))
  with check (user_id = (select auth.uid()) and clinic_id = (select public.current_clinic_id()));

drop policy if exists library_messages_own on public.library_messages;
create policy library_messages_own on public.library_messages
  for all
  using (user_id = (select auth.uid()) and clinic_id = (select public.current_clinic_id()))
  with check (user_id = (select auth.uid()) and clinic_id = (select public.current_clinic_id()));
