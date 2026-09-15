// What every step of the catalogue pipeline shares: where the caches, the
// pulled Bara records and the reports live, and who we are to the site we
// read. The medicine pipeline's helpers (env, args, json, polite fetch) are
// reused as they are, so the two pipelines behave the same way.
import path from 'node:path';
import { root } from '../medicine/lib.mjs';

export {
  root,
  args,
  env,
  ensureDir,
  readJson,
  writeJson,
  sleep,
  log,
  fetchPolite,
} from '../medicine/lib.mjs';

/** Everything downloaded or generated, outside git. */
export const cacheDir = path.join(root, '.cache', 'catalogue');
/** The American Dragon pages as served, one file per page. */
export const dragonDir = path.join(cacheDir, 'americandragon');
/** The fact sheets and the written text. */
export const factsDir = path.join(cacheDir, 'facts');
export const textDir = path.join(cacheDir, 'text');
/** What scripts/pull/bara.mjs saved (logged in as the practitioner; never in git). */
export const baraDir = path.join(root, 'test-results', 'pull', 'bara', 'index');
/** Reports and the dataset the import reads. */
export const reportDir = path.join(root, 'test-results', 'catalogue');
export const datasetFile = path.join(reportDir, 'dataset.json');
/** The library crawl's manifest: the list of American Dragon addresses it walked on 14.9. */
export const crawlManifest = path.join(root, '.cache', 'library', 'crawl-manifest.json');

/** A contact address is what a site's policy asks of a reader that is a program. */
export const UA =
  'herbalist-clinic-catalogue/1.0 (facts for a clinic app reference; contact edoho6@gmail.com)';

export const DRAGON_ORIGIN = 'https://www.americandragon.com';

/** The three page families, by the folder American Dragon keeps them in. */
export const DRAGON_FAMILIES = {
  herbs: 'Individualherbsupdate',
  formulas: 'Herb Formulas copy',
  points: 'Points',
};
