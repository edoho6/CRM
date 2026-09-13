// Old Word files (.doc), read by Word itself.
//
// The pure-JavaScript reader opens one Hebrew .doc in ten; Microsoft Word,
// which is installed on the practitioner's machine, opens them all. So a
// .doc the reader cannot open is handed to Word through PowerShell — opened
// hidden, with alerts off, saved as .docx into a temporary folder (the script
// beside this file) — and the .docx is read the ordinary way. Word is started once per file and
// closed after it; a file Word cannot open within a minute is given up on.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

let available = null;

/** Whether Word can be driven here (Windows, Word installed). Checked once. */
export async function wordAvailable() {
  if (available !== null) return available;
  if (process.platform !== 'win32') return (available = false);
  try {
    const { stdout } = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Classes\\Word.Application\\CurVer' -ErrorAction SilentlyContinue).'(default)'"], { timeout: 20_000, windowsHide: true });
    available = /Word\.Application/.test(stdout);
  } catch {
    available = false;
  }
  return available;
}

const SCRIPT = fileURLToPath(new URL('./word-convert.ps1', import.meta.url));

/**
 * A .doc as .docx bytes, through Word.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function docToDocx(buffer) {
  if (!(await wordAvailable())) throw new Error('Word is not installed here');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'herbalist-doc-'));
  const input = path.join(dir, 'in.doc');
  const output = path.join(dir, 'out.docx');
  try {
    fs.writeFileSync(input, buffer);
    await run('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, input, output], { timeout: 90_000, windowsHide: true });
    if (!fs.existsSync(output)) throw new Error('Word wrote nothing');
    return fs.readFileSync(output);
  } catch (error) {
    const line = String(error.stderr ?? error.message ?? error).split(/\r?\n/).find((l) => l.trim()) ?? 'Word failed';
    throw new Error(`Word: ${line.trim().slice(0, 120)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
