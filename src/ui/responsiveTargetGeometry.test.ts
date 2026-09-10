import { describe, expect, it } from 'vitest';
import { expandNonOverlappingTargets } from './responsiveTargetGeometry';

describe('expandNonOverlappingTargets', () => {
  it('keeps vertically stacked answer targets separated', () => {
    const targets = expandNonOverlappingTargets([
      { left: 900, top: 200, right: 1100, bottom: 280 },
      { left: 900, top: 288, right: 1100, bottom: 368 },
      { left: 900, top: 376, right: 1100, bottom: 456 }
    ], { padding: 22, guard: 4, viewportWidth: 1200, viewportHeight: 650 });

    expect(targets[0].bottom).toBeLessThan(targets[1].top);
    expect(targets[1].bottom).toBeLessThan(targets[2].top);
    expect(targets[0].top).toBe(178);
    expect(targets[2].bottom).toBe(478);
  });

  it('keeps horizontal portrait targets separated', () => {
    const targets = expandNonOverlappingTargets([
      { left: 12, top: 180, right: 122, bottom: 236 },
      { left: 128, top: 180, right: 238, bottom: 236 },
      { left: 244, top: 180, right: 354, bottom: 236 }
    ], { padding: 18, guard: 2, viewportWidth: 390, viewportHeight: 844 });

    expect(targets[0].right).toBeLessThan(targets[1].left);
    expect(targets[1].right).toBeLessThan(targets[2].left);
    expect(targets[0].left).toBe(0);
    expect(targets[2].right).toBe(372);
  });

  it('clips expanded targets to the viewport', () => {
    const [target] = expandNonOverlappingTargets([
      { left: 2, top: 3, right: 98, bottom: 53 }
    ], { padding: 24, viewportWidth: 100, viewportHeight: 60 });

    expect(target).toEqual({ left: 0, top: 0, right: 100, bottom: 60, width: 100, height: 60 });
  });
});
