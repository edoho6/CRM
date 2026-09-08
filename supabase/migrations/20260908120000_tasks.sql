-- ============================================================================
-- 28 · Tasks — the things that have to be done, and are not appointments
-- ============================================================================
-- "Ring Ronit about her blood results." "Order more Dang Gui." "Send the
-- confirmation to Maccabi." None of these is a booking, none belongs in a
-- treatment record, and until now the only place for them was a sticky note on
-- the monitor.
--
-- Deliberately small. No assignment to another user, no sub-tasks, no
-- recurrence, no projects: this is a list for one practitioner to clear, and
-- every one of those turns it into something that needs managing itself. The
-- fields are what a note on a monitor already has — what, by when, and whether
-- it is urgent.
--
-- The optional patient link is the one thing paper cannot do, and it is why this
-- is a table rather than a text widget: a task about a person should open that
-- person's file.
-- ============================================================================

create table if not exists public.clinic_tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,

  title text not null,
  notes text,

  /**
   * Null means "no date", which is a real and common answer.
   *
   * A task with an invented due date is a task that will nag on a day nobody
   * chose, and the usual result is that every date stops being believed.
   */
  due_on date,

  /** Urgent floats to the top of the list. Nothing else changes. */
  is_urgent boolean not null default false,

  /** Set when it is ticked off. Null is the whole of "still to do". */
  done_at timestamptz,

  -- A task about a person links to them, so it can be opened from the list.
  -- `set null` rather than cascade: erasing a patient should not silently
  -- delete "send their file to the lawyer".
  patient_id uuid references public.patients(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint clinic_tasks_title_not_blank check (length(btrim(title)) > 0)
);

-- The dashboard asks one question — what is still open, urgent first, then by
-- date — so that is the index.
create index if not exists clinic_tasks_open_idx
  on public.clinic_tasks (clinic_id, is_urgent desc, due_on nulls last)
  where done_at is null;

create index if not exists clinic_tasks_patient_idx
  on public.clinic_tasks (clinic_id, patient_id)
  where patient_id is not null;

drop trigger if exists clinic_tasks_set_updated_at on public.clinic_tasks;
create trigger clinic_tasks_set_updated_at
  before update on public.clinic_tasks
  for each row execute function public.set_updated_at();

-- No audit trigger. A task is an aide-mémoire, not a clinical or financial
-- record, and writing every tick of a to-do list into the audit log would bury
-- the entries that exist to be found.

alter table public.clinic_tasks enable row level security;

drop policy if exists clinic_tasks_staff_all on public.clinic_tasks;
create policy clinic_tasks_staff_all on public.clinic_tasks
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- No patient policy: this is the practitioner's own list, and a patient has no
-- business reading "chase her about the unpaid invoice".

comment on table public.clinic_tasks is
  'The practitioner''s to-do list. Deliberately minimal — what, by when, urgent or not, and optionally which patient it concerns.';
