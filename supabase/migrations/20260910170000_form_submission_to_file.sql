-- A filled-in questionnaire goes into the patient's file, under documents.
--
-- The submission stays where it is; what is added is a document row that
-- points at it, so it lists beside the scans and lab results and opens
-- through the same download link. The file itself is not stored: the
-- download route renders the answers on request, from the submission's own
-- frozen copy of the questions, so nothing can drift and nothing is
-- duplicated. Its path is a marker rather than a storage key.
--
-- A trigger rather than application code because a questionnaire is filled
-- from two places — by staff in the app and by the patient in the portal —
-- and the file must be the same either way. Security definer: a patient may
-- write a submission but has no right to write a document row directly.

create or replace function public.file_form_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  select t.title into v_title from public.form_templates t where t.id = new.template_id;
  insert into public.patient_documents
    (clinic_id, patient_id, uploaded_by, file_path, file_name, mime_type, size_bytes, category, shared_with_patient)
  values
    (new.clinic_id,
     new.patient_id,
     new.submitted_by,
     'form-submission:' || new.id::text,
     coalesce(v_title, 'שאלון') || ' · ' || to_char(new.created_at at time zone 'Asia/Jerusalem', 'DD/MM/YYYY') || '.html',
     'text/html',
     null,
     'intake_form',
     -- Filled by the patient: theirs to see. Filled by staff: private until shared.
     new.submitted_by is null);
  return new;
end;
$$;

drop trigger if exists form_submissions_to_file on public.form_submissions;
create trigger form_submissions_to_file
  after insert on public.form_submissions
  for each row execute function public.file_form_submission();

-- Deleting a submission takes its document row along.
create or replace function public.unfile_form_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.patient_documents where file_path = 'form-submission:' || old.id::text;
  return old;
end;
$$;

drop trigger if exists form_submissions_unfile on public.form_submissions;
create trigger form_submissions_unfile
  after delete on public.form_submissions
  for each row execute function public.unfile_form_submission();

-- Submissions already on record get their document row once.
insert into public.patient_documents
  (clinic_id, patient_id, uploaded_by, file_path, file_name, mime_type, size_bytes, category, shared_with_patient)
select s.clinic_id, s.patient_id, s.submitted_by,
       'form-submission:' || s.id::text,
       coalesce(t.title, 'שאלון') || ' · ' || to_char(s.created_at at time zone 'Asia/Jerusalem', 'DD/MM/YYYY') || '.html',
       'text/html', null, 'intake_form', s.submitted_by is null
  from public.form_submissions s
  left join public.form_templates t on t.id = s.template_id
 where not exists (
   select 1 from public.patient_documents d where d.file_path = 'form-submission:' || s.id::text
 );
