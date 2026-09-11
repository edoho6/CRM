# Security and privacy

This describes what the system does today, and — in the same detail — what it
does not. It is written to be handed to a lawyer or a privacy consultant before
the clinic serves real patients, so an honest gap is worth more here than a
confident claim.

Last reviewed: 7 September 2026.

---

## 1 · Isolation between clinics

Every domain table carries `clinic_id NOT NULL`, defaulted from
`current_clinic_id()` — a `SECURITY DEFINER` function that reads the clinic from
the caller's own membership row, never from a parameter the client could set.

Row Level Security is enabled on every one of those tables, with policies built
from three helpers: `current_clinic_id()`, `is_clinic_member(uuid)` and
`has_clinic_role(uuid, text[])`. Filtering is therefore enforced by Postgres, not
by application code — a query that forgets its `WHERE clinic_id = …` returns
nothing rather than everything.

Views used by the app (`herb_stock_levels`, `formula_stock_levels`,
`access_activity`, `access_anomalies`) are declared `security_invoker = on`, so
they run with the caller's rights and inherit the same policies. A view created
the default way would have bypassed them.

**Shared tables.** The price comparison's four tables (`shop_stores`,
`shop_products`, `shop_offers`, `shop_fetch_runs`) are the one exception to
`clinic_id`: a shop's price is the same fact for every clinic, and reading it
once for the whole service is a courtesy to the shops that reading it once per
clinic would not be. They hold no patient data. Their only policy is `SELECT`
for a caller with a clinic membership, so a portal patient or an anonymous
caller sees nothing, and no policy allows a write from the app. Rows are
written by the `fetch-shop-prices` function, which runs inside Supabase with
the service role, through `SECURITY DEFINER` functions granted to
`service_role` alone — revoked by name from `anon` and `authenticated`, which
Supabase otherwise grants EXECUTE on every new public function; a platform admin may change a shop's status or ask for a
refresh through two functions that check `is_platform_admin()`. The view
`shop_product_prices` is `security_invoker` like the others.

Isolation is tested, not merely inspected. `supabase/tests/tenant_isolation.sql`
builds two throwaway clinics plus a portal patient inside a transaction,
impersonates each identity in turn, and asserts what each one cannot reach:
another clinic's patients, medical history, clinical notes, herb catalogue and
views; its treatment protocols, working hours and closures; its packages,
signatures and treatment confirmations; cross-clinic writes; a forged or edited
audit entry. It also proves two rules hold in the database rather than in a
button: that a signature cannot be edited, and that a punch card cannot be
overdrawn. It then checks the
portal patient — an auth user with no membership — sees their own file and their
shared documents and nothing clinical, and that an anonymous caller sees nothing
at all. For the shared price tables it proves the opposite shape: the same rows
for both clinics, none for the patient or the stranger, and every write — and
every call to the job's or the admin's functions — refused. Everything is rolled back, so it is safe to run against the live project
and should be re-run after any migration that adds a table or touches a policy.

**Gap:** it is run by hand in the SQL editor. Wiring it into CI needs a database
CI can reach, which means the staging project of §12.

## 2 · Who may do what

`memberships(user_id, clinic_id, role)` with roles `owner`, `practitioner`,
`staff`, `assistant`. A second person joins only through an invitation
(`clinic_invitations`, migration 37): an owner makes a link on the team page and
passes it on themselves — the app sends no email. The link's token is the whole
secret: `invitation_by_token` (callable anonymously) answers with the clinic's
name, the role and whether the link is still open, nothing else; `accept_invitation`
(signed-in accounts only) refuses portal accounts and anyone who already belongs
to a clinic, and spends the link on first use. Links expire after seven days and
an owner can revoke one at any time. Only owners see or manage invitations and
members (`set_membership_role`, `set_membership_active`), never their own row, and
the trigger `memberships_keep_owner` refuses any change that would leave a clinic
without an active owner. `tenant_isolation.sql` covers all of this with a fifth
identity: a stranger holding a link.

**Gap:** `has_clinic_role` exists but the policies do not yet distinguish roles —
every active member of a clinic has the same access, whatever role the invitation
gave them. Before a clinic invites someone who should see less than the owner, the
policies need to separate at minimum: who may see clinical notes, who may see
financial records, and who may change clinic settings.

**Gap:** MFA is not enforced for the owner account. Supabase supports it; it is
not switched on.

## 3 · The audit trail

Two halves, written differently and for different reasons.

**Changes** are recorded by a database trigger (`write_audit_log`) on insert,
update and delete, plus `sign` as its own action when an encounter is signed.
The trigger is `SECURITY DEFINER` and nobody holds `INSERT` on `audit_log`, so
application code cannot forge or suppress an entry. Updates store only the
fields that actually changed.

**Reads** are recorded by the application through `log_record_access`, because
nothing in Postgres fires on a `SELECT`. Same definer rights, same
unforgeability. Views are deduplicated over fifteen minutes — opening a patient,
following a link to their encounter and pressing back is one act of looking.
Document downloads are recorded as `export` and are never deduplicated: taking a
copy out of the system is the strongest form of access there is.

Currently logged: opening a patient file, opening a treatment record,
downloading a document. `audit_log` is readable by clinic staff and writable by
nobody.

**Gap:** the calendar, the invoice list and the reference catalogues do not log
reads. That is a deliberate line — the catalogues hold no patient data — but the
invoice list does, and it should.

**Gap:** there is no retention or archival policy for the log. It grows without
bound. At clinic volume that is years away from mattering, and it is still
unspecified.

**Signed records.** A signed treatment record cannot be edited in place. It
can be reopened through `reopen_encounter`, which requires a reason, keeps the
signature it carried (who, when) together with who reopened it, when and why
in `encounter_signatures` — a table with no update or delete policy — and
returns the record to draft to be signed again. Every field change in between
is in the audit log as before. The rule: a correction is always visible, and a
signature is never erased.

## 4 · Watching for misuse

`/settings/access` shows the trail with names resolved, filterable by reads
versus changes.

`access_anomalies` implements two rules, both stated on screen:

- thirty or more distinct records opened by one user within one hour
- five or more reads between 23:00 and 06:00 Asia/Jerusalem

A flag is a reason to look, not proof of anything. The thresholds are printed
next to the results so a practitioner can judge them.

**Gap — and the significant one:** failed logins, login location and unfamiliar
devices are not monitored. Those events live in Supabase's `auth` schema, which
the application database cannot query. Covering them needs the auth webhook or
the admin API. The screen says so rather than implying coverage it lacks.

**Gap:** nothing is pushed. An owner has to open the screen. There is no email
or message on a flag.

## 5 · Authentication

Staff sign in with email and password against Supabase Auth. Patients use a
magic link into the separate portal application.

Sign-in is rate limited: eight failures within fifteen minutes locks that
address-and-source-address pair for fifteen minutes. Keying on both means one
person guessing many accounts and one office behind a single NAT are both
handled sensibly, and nobody can lock a colleague out by mistyping their email.

**Limitation, stated in the source too:** the limiter is per-process and held in
memory. Behind several instances an attacker gets one budget per instance, and a
restart clears it. It raises the cost of guessing; it is not a wall. Supabase
applies its own limits underneath.

The sign-in form returns one generic failure for both a wrong password and an
unknown address, so it cannot be used to discover who has an account.

## 6 · Transport and headers

Both applications send, on every response:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; scripts and styles from self; images and connections limited to self and the Supabase origin; `object-src 'none'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone and geolocation all denied |
| `Strict-Transport-Security` | two years, `includeSubDomains; preload` — production only |

`X-Powered-By` is removed.

**Search engines.** Each application serves a `robots.txt` (`app/robots.ts`). The web app
allows indexing of the online booking page alone, with the assets needed to render it, and
disallows everything else — sign-in, sign-up, the confirmation links, the calendar feeds; the
confirmation page also carries its own `noindex`, so a link that leaks into a crawler's path
is still not indexed. The patient portal disallows everything.

**Known concession:** the CSP allows `'unsafe-inline'` for scripts and styles.
Next injects inline bootstrap scripts, and Radix sets inline styles. Removing it
needs per-request nonces threaded through the app. It is marked as a concession
in `next.config.ts` rather than left to be discovered.

## 7 · Data at rest and in transit

Supabase encrypts at rest and enforces TLS in transit; both are platform
defaults and neither is configured by this repository.

**Gap:** no application-level encryption of particularly sensitive columns —
national ID and free-text clinical notes are stored in plain columns, protected
by RLS and by the platform's disk encryption but readable by anyone with
database access. Whether that is sufficient is a decision to take with the
privacy consultant, not one to assume.

**Gap:** backups are whatever the Supabase plan provides. No restore has ever
been rehearsed, and an unrehearsed restore is a hope rather than a backup.

## 8 · Secrets

No key is committed. `.env`, `.env.local` and `.env.*.local` are all ignored, and
only the anon key — which is safe to publish, being subject to RLS — reaches the
browser through `NEXT_PUBLIC_*`.

The Grow payment credentials live in `clinic_payment_settings`, readable only by
the clinic owner. The webhook cannot read that table directly and instead calls
`grow_credentials_for_process(process_id)`, a definer function that returns the
credentials for one known process and nothing else.

### The assistant's API key

`ANTHROPIC_API_KEY` is read on the server only. It is deliberately not a
`NEXT_PUBLIC_*` variable, so it cannot reach the browser bundle even by mistake,
and with it unset the assistant screen reports itself unconfigured rather than
failing on the first question. See §8b for what that feature sends.

## 8b · The assistant, and what leaves the clinic

`/assistant` answers questions about the clinic's own numbers — how many patients,
who has not been in, which herbs get used, what is outstanding. It is the only
part of this system that talks to a third party, and it is off unless a key is set.

**The boundary is a file, not a prompt.** `apps/web/features/assistant/queries.ts`
holds a closed list of eleven queries. The model chooses one and supplies at most
a number of months; it cannot compose a query, and there is no path by which it
can reach a table that is not on that list. A prompt instructing a model to behave
is not a control — a list it cannot extend is.

Every query runs through the caller's own RLS-scoped client, so the assistant can
never see further than the person asking. Results are capped at fifty rows.

**What is sent to Anthropic:** the practitioner's question, and the rows a query
returned — patient names, dates, counts and amounts.

**What is never sent:** national ID numbers, addresses, dates of birth, and the
free text of any clinical record — the complaint, the treatment note, the pattern,
the questionnaire answers. No query selects those columns, so there is no request
in which they could appear.

A failed query is reported to the model as a failure, never as an empty result:
the assistant saying "you saw nobody in September" because a query errored is a
worse outcome than no answer at all.

**Decision on record:** the practitioner was asked whether the model should see
query results or only aggregate counts, and chose narrowed results, having been
shown that this sends names and dates to an external API. The screen states this
in both languages every time it is opened.

**Before real patients:** this is the one feature to raise with the privacy
adviser alongside the database registration. Sending identifying data to a
processor outside the clinic is a processing decision, not a technical one, and
the answer may be a data-processing agreement, or may be to leave the key unset.

## 8c · Signatures, and what the patient portal can do

**Signatures.** `signatures` holds one mark per consent decision or filled-in
form. It is append-only in the same strong sense as the consents themselves, with
the same single exception for erasing a patient's file, and it carries no audit
trigger of its own — the row it points at is already audited, and copying a
base64 image into every audit entry would bury the readable diff.

Two routes are offered and recorded distinctly: `drawn` and `typed`. Typing is
not a lesser signature but the accessible one — drawing is impossible with a
keyboard alone and hard with a tremor, and a consent form that can only be
completed by drawing is a form some patients cannot give consent on.

**The portal.** A patient can now fill in a questionnaire and record a consent
decision from their own device. Nothing about this widened the database: the
policies — `form_templates_patient_read`, `form_submissions_patient_insert`,
`consent_documents_patient_read`, `patient_consents_patient_insert` — were
written when those features were, and had no screen until now.

No portal query takes a patient id from the caller. Every one resolves through
`current_patient_id()`, a definer function that reads the portal-access row for
the signed-in user, so there is no identifier in the request to tamper with. A
portal consent is forced to `method = 'portal'` by the policy itself, so a
decision made at home can never be recorded as though it had been witnessed in
the room.

## 8d · Treatment confirmations — what this document is not

`treatment_confirmations` produces a page attesting that a named practitioner
treated a named patient on given dates. Israeli health funds require exactly
that, with the practitioner's qualification, before they will reimburse a
patient — which is why the feature exists.

**It is deliberately not a receipt and not a tax document.** Receipts here are
subject to the Income Tax (Bookkeeping) Regulations, 1973, and are to be issued
by a licensed invoicing provider through its API, not by this system. The printed
page says so in both languages, in its footer, because a page listing a
practitioner, a patient and a list of dates looks enough like a receipt that
somebody will eventually try to use it as one.

Every printed value — both names, both ID numbers, the qualification, the dates —
is copied onto the row when it is issued rather than looked up on each print. A
document already handed to an insurer must keep saying what it said, whatever is
corrected in the record afterwards. Deleting one is possible and is itself
audited.

## 9 · Payments

Card details never touch this system. Grow hosts the payment page and the
customer is redirected there; the callback carries a process id and token that
this system generated and stored.

Settlement runs through `settle_grow_payment`, which is idempotent because Grow
retries, and which does nothing at all for a process id it does not recognise —
that is the check that stands in for a signature.

**Known limitation:** Grow sends no cryptographic signature to verify, so the
process id and token are the whole of the trust model. It is weaker than a
signed webhook and it is the strongest thing available with this provider.

**Gap:** the Israeli invoicing reform's allocation number is not implemented.
The invoice schema has room for it.

## 10 · Consent

Consent points at a document, not at a concept. `consent_documents` holds the
texts, versioned per kind and locale; `patient_consents` records each decision
with the document id, the method (in person, portal, paper, phone, email) and the
timestamp. So "what exactly did she agree to, and when" is answerable two years
later.

Two rules are enforced by the database rather than by the application:

- A published document is frozen. `freeze_published_consent_document()` rejects
  any change to its title, body, version or kind. Correcting one means publishing
  the next version, which is what makes the version number mean anything.
- Decisions are append-only. `block_consent_mutation()` rejects updates and
  deletes, so withdrawing is a new row and "agreed in March, withdrew in
  September" survives. The one exception is the cascade from a deleted patient —
  see §11.

Version numbers are allocated inside `publish_consent_document()` rather than
read-then-written by the application, so two concurrent publishes cannot collide.

Marketing is a separate kind from the outset. Bundling it with terms of use is
what makes a consent unfree, and separating it later would mean re-collecting
everything. `patient_consent_status` gives the standing answer per kind, which is
the form the question is actually asked in.

A patient may record their own decision through the portal
(`patient_consents_patient_insert`, restricted to `method = 'portal'`), so
"withdraw at any time" is a mechanism rather than a promise to email someone.

Verified by `supabase/tests/consent_rules.sql`.

## 11 · Patient rights

`GET /api/patients/[id]/export` returns the complete file as one JSON document:
personal details, medical history, appointments, encounters, clinical notes,
prescriptions, document metadata, the consent history, and the access history
from `audit_log`. The export logs itself as an `export` action, so requesting a
file is itself part of the record. Uploaded files are listed by name and date and
downloaded separately; embedding them would make the export unusable in size.

Deletion is a cascade from `patients`, and it works: the append-only rule on
consents deliberately steps aside when the patient row is already gone, so a
file's own audit rules cannot defeat the right to have it erased. The audit
entries for the deletion itself are not cascaded, so the fact that a file was
erased survives the erasure.

**Gap:** there is no deletion *flow* in the interface — no button, no
confirmation, no record of who asked. Today it is a `DELETE` in the SQL editor,
which is a real gap once a patient can ask for it in writing.

## 12 · Development practice

Environment configuration is per-application and git-ignored. There is no
staging project yet — development runs against the same Supabase project as
production, which is acceptable only while no real patient data exists.

**This is the gap to close first, before the first real patient is entered.**

The half of that which does not depend on a second project is built.
`seed_synthetic_data()` fills a clinic with fictional patients, appointments and
treatment records: two dozen files, several visits each, tongue and pulse
findings, signed records and one left in draft. The fictional details are
unusable rather than merely invented — `.test` email addresses, phone numbers in
an unallocated range, national ids that fail the check digit — because a
realistic random phone number is eventually a real person's, and that only shows
up when a stray reminder reaches them.

The guard is a column rather than a convention. `clinics.is_synthetic` must be
true before either `seed_synthetic_data()` or `purge_synthetic_data()` writes
anything, and a flagged clinic carries an amber banner on every screen. So
seeding production fails, and no one works in a sandbox for ten minutes without
noticing.

## 13 · Accessibility

Israeli standard 5568 (WCAG 2.1 AA). Colour contrast is measured, not estimated:
`pnpm build && pnpm check:contrast` reads the emitted stylesheet and fails below
4.5:1 across 101 pairs. The first run found three real failures, including white
text on the primary button at 3.30:1.

`pnpm check:a11y` runs axe against the server-rendered markup of the public
pages — labels, accessible names, heading order, `lang` and `dir`. It is checked
against deliberately broken markup, so a clean result means something rather than
meaning the harness is inert.

Both palettes are measured. Dark mode is a hand-picked set of steps rather than
an inversion of the light ones, so it is read out of the built stylesheet and
checked pair by pair alongside the light theme — 124 pairs across the two. The
checker also fails the build on `text-white`, which no longer means white: dark
mode redefines `--color-white` to the card surface so every panel flips at once,
and text on a coloured button therefore belongs on `text-accent-fg`.

Full status, including what has not been done, is on `/accessibility` — which is
also the statement the standard requires. Its contact details are unfilled and
visibly marked as such.

**Gap:** the axe run covers four public pages. Everything behind the login is
uncovered, and that is most of the application — it needs a staging database to
render against, which is §12 again.

## 14 · Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: types, tests,
build, contrast, then axe against the started application. A second job runs
`pnpm audit`, failing on high and critical advisories and reporting moderate ones
without blocking — a build that cries wolf gets ignored, and then the critical one
is ignored with it. `.github/dependabot.yml` opens weekly grouped upgrades, with
Next, React and Tailwind held back for deliberate handling.

**Gap:** the repository has no remote, so none of this has executed yet. It runs
on the first push.

The tenant isolation and consent tests are not in CI either, for the same reason
as everything else here: they need a database CI can reach.

---

## Summary of what blocks going live

1. A separate staging environment (§12) — **the first one to close**, and now the
   only thing standing between the tooling and the rule it exists to enforce
2. A deletion flow in the interface, not only in SQL (§11)
3. Role separation in the RLS policies before a second user is invited (§2)
4. MFA on the owner account (§2)
5. Accessibility coordinator details on the statement (§13)
6. A rehearsed backup restore (§7)
7. Database registration under the Privacy Protection Law — a legal step, not a
   technical one
8. A decision on the assistant (§8b) — either a data-processing agreement with
   Anthropic, or leaving `ANTHROPIC_API_KEY` unset. Not a blocker for the rest of
   the system: with no key, nothing here reaches an external service at all

Closed since the first version of this document: consent records with document
version and timestamp (§10), patient file export (§11), tenant isolation tests
(§1), and the synthetic seed script (§12).
