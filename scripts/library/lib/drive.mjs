// Google Drive, read through a service account that was shown one folder.
//
// The account is a Google identity of its own (…@…iam.gserviceaccount.com);
// the practitioner shares the library folder with it as a viewer, and that
// is all it can ever see. Its key file (JSON, downloaded once from Google
// Cloud) stays outside the repository; only its path is in .env.local.
// Signed-in without a library: the JWT is signed here with node:crypto and
// exchanged for a one-hour token — and a run over a thousand files lasts
// longer than an hour, so the token is a session that renews itself before
// it expires, and once more on a 401. Every request is retried when the
// network drops or Google asks for a pause.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { sleep } from '../../medicine/lib.mjs';

// Read the folder it was shown, and call Vision for the scans (vision.mjs). Never the practitioner's other files.
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/cloud-vision';
const API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * What the library reads (the kind extract.mjs reads it as), and what a
 * Google-native file is exported as. An image, and a PDF that turns out to
 * be a scan, go to Vision's OCR (vision.mjs) instead.
 */
export const READABLE = {
  'application/pdf': { ext: 'pdf' },
  [DOCX]: { ext: 'docx' },
  'application/msword': { ext: 'doc' },
  'application/rtf': { ext: 'rtf' },
  'text/rtf': { ext: 'rtf' },
  [PPTX]: { ext: 'pptx' },
  [XLSX]: { ext: 'xlsx' },
  'application/epub+zip': { ext: 'epub' },
  'text/plain': { ext: 'txt' },
  'text/markdown': { ext: 'md' },
  'image/jpeg': { ext: 'image' },
  'image/png': { ext: 'image' },
  'image/tiff': { ext: 'image' },
  'image/webp': { ext: 'image' },
  'application/vnd.google-apps.document': { ext: 'docx', exportAs: DOCX },
  'application/vnd.google-apps.presentation': { ext: 'pptx', exportAs: PPTX },
  'application/vnd.google-apps.spreadsheet': { ext: 'xlsx', exportAs: XLSX },
};

/** A token is renewed this long after it was minted — before Google's hour is up. */
const RENEW_AFTER_MS = 50 * 60 * 1000;
/** Network drops and Google's pauses: tries, and the pause between them grows. */
const TRIES = 6;

const base64url = (input) => Buffer.from(input).toString('base64url');

/** One fresh one-hour token for the service account. */
export async function driveToken(keyFile) {
  const account = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: account.token_uri, iat: now, exp: now + 3600 }));
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key, 'base64url');
  const response = await fetchWithRetry(account.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
  });
  if (!response.ok) throw new Error(`google token ${response.status} — is the Drive API enabled for the project?`);
  const payload = await response.json();
  return { token: payload.access_token, email: account.client_email };
}

/**
 * A token that stays valid for as long as a run takes: minted on first use,
 * renewed after fifty minutes, and renewed at once when a request is
 * refused as expired. Hand `session.token` (the function) wherever a token
 * is wanted.
 */
export function driveSession(keyFile) {
  let current = null;
  let mintedAt = 0;
  let email = null;
  const mint = async () => {
    const fresh = await driveToken(keyFile);
    current = fresh.token;
    email = fresh.email;
    mintedAt = Date.now();
    return current;
  };
  const session = {
    token: async () => (current && Date.now() - mintedAt < RENEW_AFTER_MS ? current : mint()),
    renew: mint,
    email: async () => {
      if (!email) await mint();
      return email;
    },
  };
  return session;
}

/** A token, whether it was given as a string or as a session's function. */
export async function resolveToken(token) {
  return typeof token === 'function' ? token() : token;
}

/** `fetch` that tries again when the network drops (a thrown error, not a status). */
export async function fetchWithRetry(url, init = {}, tries = TRIES) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (attempt >= tries) throw new Error(`network: ${error.cause?.code ?? error.message}`);
      await sleep(attempt * 5000);
    }
  }
}

/**
 * A Drive request with the retries a long run needs: the network dropping,
 * Google asking for a pause (429, 5xx), and the token having expired (401,
 * once — renewed through the session when there is one).
 */
export async function driveGet(token, url, init = {}) {
  let renewed = false;
  for (let attempt = 1; ; attempt += 1) {
    const bearer = await resolveToken(token);
    const response = await fetchWithRetry(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${bearer}` } });
    if (response.ok) return response;
    if (response.status === 401 && !renewed && typeof token === 'function' && token.renew) {
      renewed = true;
      await token.renew();
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < TRIES) {
      await sleep(attempt * 5000);
      continue;
    }
    if (response.status === 404) throw new Error('not found — is the folder shared with the service account, and is the id right?');
    throw new Error(`drive ${response.status}`);
  }
}

/**
 * Every readable file under the folder, subfolders included, with the path
 * it was found at. Folders the account cannot see simply do not appear.
 * The kinds left out are counted on `files.skipped` at the top level.
 */
export async function listFolder(token, folderId, prefix = '', skipped = {}) {
  const files = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, size)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await (await driveGet(token, `${API}/files?${params}`)).json();
    for (const file of payload.files ?? []) {
      const filePath = prefix ? `${prefix}/${file.name}` : file.name;
      if (file.mimeType === FOLDER) files.push(...(await listFolder(token, file.id, filePath, skipped)));
      // Word keeps a lock file (~$name.docx) beside an open document; it is not a document.
      else if (file.name.startsWith('~$')) continue;
      else if (READABLE[file.mimeType]) files.push({ ...file, path: filePath, ext: READABLE[file.mimeType].ext, exportAs: READABLE[file.mimeType].exportAs ?? null });
      else skipped[file.mimeType] = (skipped[file.mimeType] ?? 0) + 1;
    }
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);
  if (!prefix) files.skipped = skipped;
  return files;
}

/** The file's bytes — exported when it is a Google document, downloaded otherwise. */
export async function downloadFile(token, file) {
  const url = file.exportAs
    ? `${API}/files/${file.id}/export?${new URLSearchParams({ mimeType: file.exportAs })}`
    : `${API}/files/${file.id}?${new URLSearchParams({ alt: 'media', supportsAllDrives: 'true' })}`;
  return Buffer.from(await (await driveGet(token, url)).arrayBuffer());
}
