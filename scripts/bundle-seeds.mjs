#!/usr/bin/env node
/**
 * Bundles the reference catalogue seeds into the two files that are pasted
 * into the Supabase SQL editor:
 *
 *   2_herbs_and_formulas_to_run.sql   ← supabase/seed/herbs/*.sql + formulas/*.sql
 *   3_points_to_run.sql               ← supabase/seed/points/*.sql
 *
 * Both land in the repository root and are gitignored (like every other
 * `*_to_run.sql` copy). Run it again after editing a seed file.
 *
 * The seeds write to the shared catalogue tables (migration
 * 20260915200000_reference_catalogue.sql); a clinic then loads the catalogue
 * from Settings, or receives it on creation.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = join(root, 'supabase', 'seed');

function files(folder) {
  return readdirSync(join(seedDir, folder))
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(seedDir, folder, name), 'utf8') }));
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function section(label, entry) {
  return [
    '',
    '-- ####################################################################',
    `-- ## ${label}: ${entry.name}`,
    '-- ####################################################################',
    '',
    entry.text.trimEnd(),
    '',
  ].join('\n');
}

const herbs = files('herbs');
const formulas = files('formulas');
const points = files('points');

const herbCount = herbs.reduce((n, f) => n + count(f.text, 'perform public.catalogue_upsert_herb('), 0);
const formulaCount = formulas.reduce((n, f) => n + count(f.text, 'perform public.catalogue_upsert_formula('), 0);
const pointCount = points.reduce((n, f) => n + count(f.text, 'perform public.catalogue_upsert_point('), 0);
const clinicalCount = points.reduce((n, f) => n + count(f.text, 'perform public.catalogue_set_point_clinical('), 0);

const herbsHeader = `-- ============================================================================
--  הרבליסט / Herbalist — 2 of 3 · HERBS AND FORMULAS (the shared catalogue)
--  Run 1_schema_to_run.sql (or every migration up to and including
--  56_reference_catalogue_to_run.sql) first. This file adds data only — it
--  creates no tables and drops nothing.
--
--    · ${herbCount} medicinals, grouped by the traditional Bensky categories
--    · ${formulaCount} classical formulas with their full ingredient lists
--
--  It fills the service-wide catalogue tables. Each clinic then copies the
--  catalogue into its own lists from Settings ← "מאגר המידע" ← "טעינת
--  הקטלוג" — or receives it on the day it is created. The copy fills only
--  empty fields, so anything corrected by hand survives.
--
--  Safe to re-run: a row is updated in place, and clinics that already
--  loaded it are untouched until they load again.
-- ============================================================================
`;

const pointsHeader = `-- ============================================================================
--  הרבליסט / Herbalist — 3 of 3 · ACUPUNCTURE POINTS (the shared catalogue)
--  Run 1_schema_to_run.sql (or every migration up to and including
--  56_reference_catalogue_to_run.sql) first. This file adds data only.
--
--    · the ${pointCount} points of the fourteen channels, with names, channel, body
--      area and their position on the body chart
--    · clinical text for ${clinicalCount} of them: location in cun, actions, indications,
--      needling depth and angle, cautions, and the classical categories
--
--  Written from the standard clinical knowledge the professional literature
--  shares, in its own words. No text is reproduced from any single copyrighted
--  work. Every row a clinic loads stays flagged for review until a person
--  confirms it.
--
--  It fills the service-wide catalogue table. Each clinic then loads it from
--  Settings ← "מאגר המידע" ← "טעינת הקטלוג", or receives it on creation.
--  Safe to re-run.
-- ============================================================================
`;

const herbsBundle =
  herbsHeader +
  herbs.map((entry) => section('HERBS', entry)).join('\n') +
  '\n' +
  formulas.map((entry) => section('FORMULAS', entry)).join('\n');
const pointsBundle = pointsHeader + points.map((entry) => section('POINTS', entry)).join('\n');

writeFileSync(join(root, '2_herbs_and_formulas_to_run.sql'), herbsBundle, 'utf8');
writeFileSync(join(root, '3_points_to_run.sql'), pointsBundle, 'utf8');
console.log(`2_herbs_and_formulas_to_run.sql: ${herbCount} herbs, ${formulaCount} formulas`);
console.log(`3_points_to_run.sql: ${pointCount} points, ${clinicalCount} with clinical text`);
