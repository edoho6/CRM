import { describe, expect, it } from 'vitest';
import { dragOffset, shouldDismiss } from '@clinic/ui/swipe-math';

describe('bottom sheet swipe', () => {
  it('closes on a long pull, whatever the speed', () => {
    expect(shouldDismiss({ dy: 150, dt: 2000, height: 400 })).toBe(true);
    expect(shouldDismiss({ dy: 99, dt: 2000, height: 400 })).toBe(false);
  });

  it('closes on a quick flick, but not on a twitch', () => {
    expect(shouldDismiss({ dy: 40, dt: 50, height: 400 })).toBe(true);
    expect(shouldDismiss({ dy: 10, dt: 5, height: 400 })).toBe(false);
  });

  it('never closes on an upward drag or no movement', () => {
    expect(shouldDismiss({ dy: -80, dt: 50, height: 400 })).toBe(false);
    expect(shouldDismiss({ dy: 0, dt: 0, height: 400 })).toBe(false);
  });

  it('follows the finger down and resists it up', () => {
    expect(dragOffset(60)).toBe(60);
    expect(dragOffset(-40)).toBe(-10);
  });
});
