import { describe, expect, it } from 'vitest';
import { applyOverrides, reconcile, withOverride, withPending } from './optimistic';

const task = (id: string) => ({ id });
const open = [task('a'), task('b'), task('c')];
const done = [task('x'), task('y')];

describe('applyOverrides', () => {
  it('shows the server lists as they are when nothing has been told', () => {
    const result = applyOverrides(open, done, new Map());
    expect(result.open.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(result.done.map((t) => t.id)).toEqual(['x', 'y']);
  });

  it('moves a task ticked done to the top of the done list at once', () => {
    const result = applyOverrides(open, done, new Map([['b', 'done']]));
    expect(result.open.map((t) => t.id)).toEqual(['a', 'c']);
    expect(result.done.map((t) => t.id)).toEqual(['b', 'x', 'y']);
  });

  it('moves a reopened task to the top of the open list', () => {
    const result = applyOverrides(open, done, new Map([['y', 'open']]));
    expect(result.open.map((t) => t.id)).toEqual(['y', 'a', 'b', 'c']);
    expect(result.done.map((t) => t.id)).toEqual(['x']);
  });

  it('drops a removed task from either list', () => {
    const result = applyOverrides(open, done, new Map([['a', 'removed'], ['x', 'removed']]));
    expect(result.open.map((t) => t.id)).toEqual(['b', 'c']);
    expect(result.done.map((t) => t.id)).toEqual(['y']);
  });
});

describe('reconcile', () => {
  it('keeps an override the server has not caught up with', () => {
    const kept = reconcile(open, done, new Map([['b', 'done']]));
    expect([...kept.entries()]).toEqual([['b', 'done']]);
  });

  it('drops an override once the server lists agree', () => {
    const kept = reconcile([task('a'), task('c')], [task('b'), task('x'), task('y')], new Map([['b', 'done']]));
    expect(kept.size).toBe(0);
  });

  it('drops a removal once the task is in neither list', () => {
    expect(reconcile([task('b')], [], new Map([['a', 'removed']])).size).toBe(0);
    expect(reconcile([task('a')], [], new Map([['a', 'removed']])).size).toBe(1);
  });
});

describe('the small map and set helpers', () => {
  it('never mutate what they are given', () => {
    const overrides = new Map([['a', 'done' as const]]);
    const next = withOverride(overrides, 'b', 'open');
    expect(overrides.size).toBe(1);
    expect(next.get('b')).toBe('open');
    expect(withOverride(next, 'a', null).has('a')).toBe(false);

    const pending = new Set(['a']);
    const more = withPending(pending, 'b', true);
    expect(pending.size).toBe(1);
    expect(more.has('b')).toBe(true);
    expect(withPending(more, 'a', false).has('a')).toBe(false);
  });
});
