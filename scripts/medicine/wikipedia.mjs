// Step 2c — Wikipedia, Hebrew and English (CC BY-SA 4.0). The one large
// body of medical text that exists in Hebrew, and the licence the user
// accepted for it: the text is quoted with a link to the article, and an
// entry whose Hebrew rests on it is published under the same licence and
// says so. Doses are never taken from it — those come from the labels only
// (compile.mjs skips a dosage section from here on purpose).
//
//   node scripts/medicine/wikipedia.mjs
//
// One request per article through the MediaWiki API — TextExtracts returns
// the whole text of one page at a time, so the corpus is thousands of
// requests. Two at a time and half a second apart: eight at a time earned a
// 429 on every request and the run crawled. The Hebrew articles are read
// first, because they are the ones that can become the entry itself.
//
// Each answer carries a revision id and timestamp, so a quote can say which
// version it read.
// Output: .cache/medicine/wikipedia/<lang>/<qid>.json
import fs from 'node:fs';
import path from 'node:path';
import { cacheDir, fetchPolite, log, readJson, sleep, writeJson } from './lib.mjs';

const dir = path.join(cacheDir, 'wikipedia');
const LANGS = ['he', 'en'];

async function fetchArticle(lang, title) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|revisions&explaintext=1&exsectionformat=wiki` +
    `&rvprop=ids|timestamp&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const response = await fetchPolite(url, { minDelayMs: 120 });
  if (!response.ok) return { error: response.status };
  const data = await response.json();
  const page = data.query?.pages?.[0];
  if (!page || page.missing) return { error: 'missing' };
  const revision = page.revisions?.[0] ?? {};
  return {
    title: page.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    revid: revision.revid ?? null,
    timestamp: revision.timestamp ?? null,
    text: page.extract ?? '',
  };
}

async function main() {
  const corpus = readJson(path.join(cacheDir, 'wikidata', 'corpus.json'));
  if (!corpus) throw new Error('run wikidata.mjs first');
  const qids = [...corpus.selected.condition, ...corpus.selected.symptom, ...corpus.selected.drug];
  const jobs = [];
  for (const lang of LANGS) {
    for (const qid of qids) {
      const title = corpus.entities[qid]?.sitelinks?.[lang];
      if (title && !fs.existsSync(path.join(dir, lang, `${qid}.json`))) jobs.push({ qid, lang, title });
    }
  }
  const total = jobs.length;
  log(`wikipedia: ${total} articles to read (Hebrew first)`);
  let done = 0;
  let got = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (jobs.length) {
        const job = jobs.shift();
        try {
          const article = await fetchArticle(job.lang, job.title);
          writeJson(path.join(dir, job.lang, `${job.qid}.json`), { qid: job.qid, lang: job.lang, retrieved_at: new Date().toISOString(), ...article });
          if (!article.error) got += 1;
        } catch (error) {
          log(`wikipedia: ${job.lang} ${job.title} — ${error.message}`);
        }
        done += 1;
        if (done % 200 === 0) log(`wikipedia: ${done}/${total} read`);
        await sleep(500);
      }
    }),
  );
  const counts = {};
  for (const lang of LANGS) counts[lang] = fs.existsSync(path.join(dir, lang)) ? fs.readdirSync(path.join(dir, lang)).length : 0;
  log(`wikipedia: ${got} articles read this run; cached ${JSON.stringify(counts)} → .cache/medicine/wikipedia/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
