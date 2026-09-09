import { describe, expect, it } from 'vitest';
import { fitWithin, jpegName } from './shrink-image';

describe('fitWithin', () => {
  it('leaves a small picture alone', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600, scaled: false });
  });

  it('scales the long side to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200, scaled: true });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600, scaled: true });
  });

  it('never produces a zero-sized edge', () => {
    expect(fitWithin(10000, 1, 1600).height).toBe(1);
  });
});

describe('jpegName', () => {
  it('swaps the extension', () => {
    expect(jpegName('IMG_0042.HEIC')).toBe('IMG_0042.jpg');
    expect(jpegName('tongue.png')).toBe('tongue.jpg');
  });

  it('copes with a name that has none', () => {
    expect(jpegName('photo')).toBe('photo.jpg');
    expect(jpegName('.png')).toBe('photo.jpg');
  });
});
