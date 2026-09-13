// Google Drive, read through a service account that was shown one folder.
//
// The account is a Google identity of its own (…@…iam.gserviceaccount.com);
// the practitioner shares the library folder with it as a viewer, and that
// is all it can ever see. Its key file (JSON, downloaded once from Google
// Cloud) stays outside the repository; only its path is in .env.local.
// Signed-in without a library: the JWT is signed here with node:crypto and
// exchanged for a one-hour token.
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
 * be a scan, go to Drive's OCR (convert.mjs) instead.
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

const base64url = (input) => Buffer.from(input).toString('base64url');

export async function driveToken(keyFile) {
  const account = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: account.token_uri, iat: now, exp: now + 3600 }));
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key, 'base64url');
  const response = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
  });
  if (!response.ok) throw new Error(`google token ${response.status} — is the Drive API enabled for the project?`);
  const payload = await response.json();
  return { token: payload.access_token, email: account.client_email };
}

async function driveGet(token, url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (response.ok) return response;
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
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
      else if (/^~$/.test(file.name)) continue;
      else if (READABLE[file.mimeType]) files.push({ ...file, path: filePath, ext: READABLE[file.mimeType].ext, exportAs: READABLE[file.mimeType].exportAs ?? null });
      else skipped[file.mimeType] = (skipped[file.mimeType] ?? 0) + 1;
    }
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);
  // The kinds left out ride along on the array, for one log line at the top level.
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
