-- ============================================================================
-- 25 · Questionnaires the practitioner builds
-- ============================================================================
-- Intake forms, follow-up questionnaires, outcome scales, consent-adjacent
-- checklists. Every practice wants different ones and no fixed set is right, so
-- what is modelled here is a form *builder* rather than any particular form.
--
-- The field definitions live in jsonb rather than in a table of questions. That
-- is the unusual choice, so the reason: a template is edited as a whole and read
-- as a whole, its questions have no independent life, and their shapes differ by
-- type — a dropdown has options, a scale has bounds, a text box has neither.
-- Normalising that produces a table of mostly-null columns plus an ordering
-- column that has to be rewritten on every drag. The trade is that Postgres
-- cannot check the inside of a template; the zod schema does, on both sides of
-- the wire, and the CHECK below keeps the outer shape honest.
--
-- Answers are stored the same way and for a harder reason: an answer must stay
-- readable against the form as it was when it was given. A template that gains
-- a question next year must not make last year's submission look incomplete, so
-- a submission records the version it was answered against and its own answers.
-- ============================================================================

create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  title text not null,
  description text,
  /**
   * The questions, in order: [{ id, type, label, required, options?, ... }].
   * Validated by `formTemplateSchema` in packages/domain before it is written.
   */
  fields jsonb not null default '[]'::jsonb,
  /**
   * Bumped whenever the questions change, and copied onto every submission, so
   * an answer can always be read against the form that was actually asked.
   */
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_templates_fields_is_array check (jsonb_typeof(fields) = 'array')
);

create index if not exists form_templates_clinic_idx
  on public.form_templates (clinic_id, is_active, title);

drop trigger if exists form_templates_set_updated_at on public.form_templates;
create trigger form_templates_set_updated_at
  before update on public.form_templates
  for each row execute function public.set_updated_at();

drop trigger if exists form_templates_audit on public.form_templates;
create trigger form_templates_audit
  after insert or update or delete on public.form_templates
  for each row execute function public.write_audit_log();

alter table public.form_templates enable row level security;

drop policy if exists form_templates_staff_all on public.form_templates;
create policy form_templates_staff_all on public.form_templates
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- ---------------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------------
-- A filled-in form is patient data. It carries the same protections as any
-- clinical record: clinic-scoped, audited, and readable by the patient only
-- through the portal policy below.

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.current_clinic_id() references public.clinics(id) on delete cascade,
  template_id uuid not null references public.form_templates(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete cascade,
  -- Set when the form was filled during a treatment rather than on its own.
  encounter_id uuid references public.encounters(id) on delete set null,
  /** The version of the template these answers were given against. */
  template_version integer not null,
  /** A snapshot of the questions as asked, so the answers stay readable. */
  fields jsonb not null default '[]'::jsonb,
  /** { fieldId: answer } — a string, a number, or an array for multi-choice. */
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint form_submissions_answers_is_object check (jsonb_typeof(answers) = 'object'),
  constraint form_submissions_fields_is_array check (jsonb_typeof(fields) = 'array')
);

create index if not exists form_submissions_patient_idx
  on public.form_submissions (clinic_id, patient_id, submitted_at desc);

create index if not exists form_submissions_template_idx
  on public.form_submissions (clinic_id, template_id, submitted_at desc);

drop trigger if exists form_submissions_audit on public.form_submissions;
create trigger form_submissions_audit
  after insert or update or delete on public.form_submissions
  for each row execute function public.write_audit_log();

alter table public.form_submissions enable row level security;

drop policy if exists form_submissions_staff_all on public.form_submissions;
create policy form_submissions_staff_all on public.form_submissions
  for all using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));

-- A patient may read what they themselves filled in, and fill one in through
-- the portal. They may not edit it afterwards — an intake form that can be
-- rewritten after a treatment is not a record of anything.
drop policy if exists form_submissions_patient_read on public.form_submissions;
create policy form_submissions_patient_read on public.form_submissions
  for select using (patient_id = public.current_patient_id());

drop policy if exists form_submissions_patient_insert on public.form_submissions;
create policy form_submissions_patient_insert on public.form_submissions
  for insert with check (patient_id = public.current_patient_id());

-- The questions themselves, so the portal can render a form it is asked to fill.
drop policy if exists form_templates_patient_read on public.form_templates;
create policy form_templates_patient_read on public.form_templates
  for select using (
    is_active
    and exists (
      select 1 from public.patient_portal_access a
      where a.user_id = auth.uid() and a.clinic_id = form_templates.clinic_id and a.is_active
    )
  );

comment on table public.form_templates is
  'Questionnaires a practitioner builds for their own practice. Questions live in jsonb because a template is edited and read whole, and its question shapes differ by type.';

comment on table public.form_submissions is
  'One filled-in form. Carries a snapshot of the questions as asked, so answers stay readable after the template changes.';
