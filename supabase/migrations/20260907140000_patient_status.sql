-- ============================================================================
-- 20 · One patient status instead of two
-- ============================================================================
-- `is_active` and `treatment_status` were asking the same question twice, and a
-- file could answer them inconsistently: active and "stopped partway" at the
-- same time. There is one status now, and `is_active` is derived from it.
--
-- The column stays rather than being dropped. Every list, every policy and every
-- report filters on `is_active`, and a boolean is the right shape for that
-- filter — what was wrong was that it could be set independently. A trigger now
-- owns it, so the two can no longer disagree whichever code path did the write.
-- ============================================================================

-- 'inactive' joins the set: it is what plain `is_active = false` meant before
-- anyone recorded an outcome, and files carrying exactly that need somewhere to
-- land.
alter table public.patients
  drop constraint if exists patients_treatment_status_check;

alter table public.patients
  add constraint patients_treatment_status_check
  check (treatment_status in (
    'active',            -- מטופל פעיל
    'inactive',          -- לא פעיל
    'completed',         -- סיים טיפולים
    'dropped_out',       -- פרש באמצע
    'full_success',      -- סיים בהצלחה מלאה
    'partial_success',   -- סיים בהצלחה חלקית
    'unsuccessful'       -- טיפול לא צלח
  ));

-- ---------------------------------------------------------------------------
-- The two are kept in step by the database
-- ---------------------------------------------------------------------------
-- Which one wins depends on which one the caller actually changed. A screen
-- that sets a status should move the flag; an older code path or an import that
-- only knows about the flag should still work and should not silently discard a
-- recorded outcome.

create or replace function public.sync_patient_active_flag()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.is_active := (new.treatment_status = 'active');
    return new;
  end if;

  if new.treatment_status is distinct from old.treatment_status then
    -- The status was set: it decides.
    new.is_active := (new.treatment_status = 'active');
  elsif new.is_active is distinct from old.is_active then
    -- Only the flag moved. Reactivating always means 'active'; deactivating
    -- means 'inactive' unless an outcome is already recorded, because
    -- "finished, full improvement" is a better answer than "inactive" and must
    -- not be overwritten by a checkbox.
    if new.is_active then
      new.treatment_status := 'active';
    elsif new.treatment_status = 'active' then
      new.treatment_status := 'inactive';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists patients_sync_active on public.patients;
create trigger patients_sync_active
  before insert or update on public.patients
  for each row execute function public.sync_patient_active_flag();

comment on function public.sync_patient_active_flag() is
  'Keeps patients.is_active derived from treatment_status, so the two cannot disagree. Deactivating a file with a recorded outcome preserves that outcome.';

-- ---------------------------------------------------------------------------
-- Bring existing rows into line
-- ---------------------------------------------------------------------------
-- Files deactivated before there was a status to record say 'active' while the
-- flag says otherwise. They mean "inactive, no outcome recorded", which is
-- exactly what the new value is for.

update public.patients
   set treatment_status = 'inactive'
 where is_active = false
   and treatment_status = 'active';

-- And the mirror case: a status was recorded but the flag never followed it.
update public.patients
   set is_active = (treatment_status = 'active')
 where is_active <> (treatment_status = 'active');

comment on column public.patients.is_active is
  'Derived from treatment_status by a trigger — do not set it directly. Kept as a column because every list and policy filters on it.';
