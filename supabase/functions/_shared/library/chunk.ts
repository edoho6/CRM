// A document in passages. A passage is a few hundred words that reads on
// its own: whole paragraphs, a short overlap with the one before so a
// sentence cut by the boundary is still found, the page it starts on and
// the nearest heading above it. Tokens are estimated from characters — the
// count only guards the batch sizes, so an estimate is enough.
//
// Shared between the loading scripts (Node) and the scheduled refresh
// (Deno): a page must be cut the same way wherever it is read, or the
// refresh would rewrite every passage of an unchanged page.

export interface PageInput {
  page: number | null;
  text: string;
}

export interface Chunk {
  ordinal: number;
  page: number | null;
  heading: string | null;
  content: string;
  tokens: number;
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

/** English prose runs about four characters to a token; Hebrew and Chinese fewer, and the estimate stays safe by rounding up. */
export function estimateTokens(text: string | null | undefined): number {
  return Math.ceil(String(text ?? '').length / 3.5);
}

/** A short line without a full stop, or a numbered or hash-marked one, reads as a heading. */
export function looksLikeHeading(line: string | null | undefined): boolean {
  const text = String(line ?? '').trim();
  if (!text || text.length > 90) return false;
  if (/^#{1,6}\s+\S/.test(text)) return true;
  if (/^(\d+(\.\d+)*[.)]?|[IVX]+\.|[A-Z]\.)\s+\S/.test(text) && !/[.!?]$/.test(text)) return true;
  if (/[.!?,;:]$/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > 12) return false;
  const capitals = words.filter((w) => /^[A-Z֐-׿]/.test(w)).length;
  return text === text.toUpperCase() ? /[A-Z]/.test(text) : capitals / words.length >= 0.6;
}

function cleanHeading(line: string): string {
  return String(line).trim().replace(/^#{1,6}\s+/, '').slice(0, 120);
}

/** Paragraphs of a page's text, blank-line separated; a very long paragraph is cut at sentence ends. */
function paragraphsOf(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n+/)) {
    const paragraph = raw.replace(/[ \t]+\n/g, '\n').trim();
    if (!paragraph) continue;
    if (paragraph.length <= maxChars) {
      out.push(paragraph);
      continue;
    }
    let current = '';
    for (const sentence of paragraph.split(/(?<=[.!?。])\s+/)) {
      if (current && current.length + sentence.length + 1 > maxChars) {
        out.push(current);
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
      // A single sentence longer than a passage is cut by length.
      while (current.length > maxChars) {
        out.push(current.slice(0, maxChars));
        current = current.slice(maxChars);
      }
    }
    if (current) out.push(current);
  }
  return out;
}

/** The tail of a passage, cut at a sentence end, to open the next one with. */
function tailOf(text: string, overlapChars: number): string {
  if (text.length <= overlapChars) return text;
  const tail = text.slice(-overlapChars);
  const cut = tail.search(/(?<=[.!?。\n])\s+/);
  return cut >= 0 ? tail.slice(cut).trim() : tail;
}

export function chunkPages(pages: readonly PageInput[], { maxChars = 3000, overlapChars = 400 }: ChunkOptions = {}): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferChars = 0;
  let bufferPage: number | null = null;
  let bufferHeading: string | null = null;
  let heading: string | null = null;
  let carry = '';

  const close = () => {
    if (buffer.length === 0) return;
    const content = buffer.join('\n\n').trim();
    if (content) {
      chunks.push({ ordinal: chunks.length, page: bufferPage, heading: bufferHeading, content, tokens: estimateTokens(content) });
      carry = tailOf(content, overlapChars);
    }
    buffer = [];
    bufferChars = 0;
    bufferPage = null;
    bufferHeading = null;
  };

  for (const { page, text } of pages) {
    for (const paragraph of paragraphsOf(text, maxChars)) {
      const firstLine = paragraph.split('\n')[0]!;
      if (looksLikeHeading(firstLine) && paragraph.split('\n').length <= 2) heading = cleanHeading(firstLine);
      if (bufferChars > 0 && bufferChars + paragraph.length + 2 > maxChars) close();
      if (buffer.length === 0) {
        bufferPage = page ?? null;
        bufferHeading = heading;
        if (carry && carry.length < maxChars / 2) {
          buffer.push(carry);
          bufferChars = carry.length;
        }
      }
      buffer.push(paragraph);
      bufferChars += paragraph.length + 2;
    }
  }
  close();
  return chunks;
}
