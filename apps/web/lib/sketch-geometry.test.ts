import { describe, expect, it } from 'vitest';
import { distanceToSegment, strokeHit, strokeWidth, type SketchStroke } from '../../../packages/ui/src/sketch-geometry';

describe('strokeWidth', () => {
  it('varies with a stylus’ pressure within bounds, and not at all for a mouse or a finger', () => {
    expect(strokeWidth(4, 0.5, 'mouse')).toBe(4);
    expect(strokeWidth(4, 1, 'touch')).toBe(4);
    expect(strokeWidth(4, 0.1, 'pen')).toBeLessThan(4);
    expect(strokeWidth(4, 0.9, 'pen')).toBeGreaterThan(4);
    expect(strokeWidth(4, 1, 'pen')).toBeLessThanOrEqual(4 * 1.7);
    expect(strokeWidth(4, 0, 'pen')).toBe(4); // no pressure reported: nominal
  });
});

describe('strokeHit', () => {
  const stroke: SketchStroke = { id: 's', tool: 'pen', color: '#000', size: 4, points: [{ x: 0, y: 0, p: 0.5 }, { x: 100, y: 0, p: 0.5 }] };

  it('touches a stroke when the eraser is within its radius plus half the line', () => {
    expect(distanceToSegment({ x: 50, y: 5 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(5);
    expect(strokeHit(stroke, { x: 50, y: 5 }, 4)).toBe(true);
    expect(strokeHit(stroke, { x: 50, y: 12 }, 4)).toBe(false);
    expect(strokeHit(stroke, { x: 120, y: 0 }, 4)).toBe(false);
  });

  it('reaches further for a highlighter, and handles a dot', () => {
    const marker: SketchStroke = { ...stroke, tool: 'highlighter' };
    expect(strokeHit(marker, { x: 50, y: 11 }, 4)).toBe(true);
    const dot: SketchStroke = { ...stroke, points: [{ x: 10, y: 10, p: 0.5 }] };
    expect(strokeHit(dot, { x: 12, y: 12 }, 2)).toBe(true);
    expect(strokeHit({ ...stroke, points: [] }, { x: 0, y: 0 }, 10)).toBe(false);
  });
});
