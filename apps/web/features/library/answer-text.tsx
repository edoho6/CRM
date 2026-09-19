'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { answerBlocks, displayAnswer, inlineRuns, type AnswerBlock } from '@clinic/domain';
import { cn } from '@clinic/ui';

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeMotion(listener: () => void) {
  const query = window.matchMedia?.(MOTION_QUERY);
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}
const readReducedMotion = () => Boolean(window.matchMedia?.(MOTION_QUERY).matches);
const noReducedMotion = () => false;

/**
 * An answer on the page: its Markdown-lite cut into headings, paragraphs
 * and lists by the domain (no HTML from a model ever reaches the DOM —
 * every piece is text inside an element made here), without the [n]
 * markers the practitioner asked not to see.
 *
 * A new answer is revealed block by block over a second or so, a reveal
 * and not a stream: the text was checked whole before it was sent. The
 * whole of it is in the page from the first frame for a screen reader.
 * Reduced motion shows it at once.
 */
export function AnswerText({ text, reveal }: { text: string; reveal: boolean }) {
  const blocks = useMemo(() => answerBlocks(text), [text]);
  // All at once when there is nothing to reveal, or motion is turned down —
  // decided in render; the effect only runs the reveal itself.
  const reducedMotion = useSyncExternalStore(subscribeMotion, readReducedMotion, noReducedMotion);
  const instant = !reveal || reducedMotion;
  const [revealed, setShown] = useState(0);
  const shown = instant ? blocks.length : Math.min(revealed, blocks.length);

  useEffect(() => {
    if (instant) return;
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setShown(count);
      if (count >= blocks.length) window.clearInterval(timer);
    }, 140);
    return () => window.clearInterval(timer);
  }, [instant, blocks.length]);

  const revealing = shown < blocks.length;
  // Not dir="auto": that takes the first letter, and a Hebrew answer that opens with a
  // pinyin name ("Shi Gao הוא…") would be laid out left to right from top to bottom.
  const dir = /\p{Script=Hebrew}/u.test(text) ? 'rtl' : 'auto';
  return (
    <div className="text-sm leading-6 text-ink-900" dir={dir}>
      {revealing ? <span className="sr-only">{displayAnswer(text)}</span> : null}
      <div aria-hidden={revealing || undefined} className="space-y-2">
        {blocks.slice(0, shown).map((block, index) => (
          <Block key={index} block={block} />
        ))}
        {revealing ? <span className="ms-0.5 inline-block h-4 w-0.5 animate-pulse bg-ink-500 align-middle" /> : null}
      </div>
    </div>
  );
}

function Block({ block }: { block: AnswerBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <p className="mt-3 font-semibold text-ink-900 first:mt-0">
          <Runs text={block.text} />
        </p>
      );
    case 'paragraph':
      return (
        <p className="whitespace-pre-line">
          <Runs text={block.text} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={cn('space-y-1 ps-5', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, index) => (
            <li key={index} className="whitespace-pre-line">
              <Runs text={item} />
            </li>
          ))}
        </Tag>
      );
    }
  }
}

function Runs({ text }: { text: string }) {
  return (
    <>
      {inlineRuns(text).map((run, index) =>
        run.bold ? (
          <strong key={index} className="font-semibold">
            {run.text}
          </strong>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}
