import { stripCitations } from './library';

/**
 * How a library answer is shown, and how a conversation is named — pure
 * text work, kept here so it is tested and so the page renders no HTML
 * from a model: the answer is cut into blocks and runs, and every piece
 * of it becomes text inside an element the page itself creates.
 *
 * The model writes light Markdown (headings, bullets, **bold**) with [n]
 * markers pointing at passages. The practitioner asked to read the answer
 * without the markers and without a source list, so the markers go; the
 * grounding checks that used them have already run on the server.
 */

export type AnswerBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

export interface InlineRun {
  text: string;
  bold: boolean;
}

const HEADING = /^#{1,6}\s+(.*)$/;
const BULLET = /^\s*(?:[-*•▪]|\d+[.)])\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+/;

/** The answer without its [n] markers, and without the spaces they leave behind. */
export function displayAnswer(answer: string): string {
  return stripCitations(answer)
    .replace(/[ \t]+([.,;:!?)])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/** The answer as blocks: headings, paragraphs and lists, in reading order. */
export function answerBlocks(answer: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const raw of displayAnswer(answer).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: heading[1]!.trim() });
      continue;
    }
    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      const ordered = ORDERED.test(line);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(bullet[1]!.trim());
      continue;
    }
    if (list) {
      // A wrapped line belongs to the item above it.
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** A line as runs of plain and **bold** text; an unmatched marker is left as it is. */
export function inlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part === '') continue;
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    runs.push({ text: bold ? part.slice(2, -2) : part, bold });
  }
  return runs;
}

/**
 * A conversation is named after its first question: the first line,
 * cut at a word so the list stays readable. A hundred and twenty is the
 * column's limit; sixty is what a sidebar can show.
 */
export function chatTitleFrom(question: string, max = 60): string {
  const line = String(question ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .find((l) => l.length > 0) ?? '';
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const atWord = cut.lastIndexOf(' ');
  return `${(atWord > max * 0.6 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

/**
 * The turns a follow-up carries back to the server. A question refused for a
 * patient's identifier stays on the screen with its refusal, but it is not
 * sent again: the server checks the history too, so every question after it
 * in the same conversation was refused as well.
 */
export function historyTurns<T extends { role: 'user' | 'assistant'; status?: string | null }>(messages: readonly T[]): T[] {
  const kept: T[] = [];
  for (const message of messages) {
    if (message.role === 'assistant' && message.status === 'refused_pii') {
      if (kept[kept.length - 1]?.role === 'user') kept.pop();
      continue;
    }
    kept.push(message);
  }
  return kept;
}
