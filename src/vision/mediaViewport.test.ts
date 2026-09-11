import { describe, expect, it } from 'vitest';
import { CAMERA_OVERSCAN_SCALE, getObjectFitViewport } from './mediaViewport';

describe('getObjectFitViewport', () => {
  it('centres a portrait camera feed inside a wide element', () => {
    expect(getObjectFitViewport(
      { left: 20, top: 100, width: 300, height: 400 },
      480,
      640
    )).toEqual({ left: 20, top: 100, width: 300, height: 400 });
  });

  it('removes contain letterboxing from the interaction viewport', () => {
    expect(getObjectFitViewport(
      { left: 20, top: 100, width: 400, height: 300 },
      480,
      640
    )).toEqual({ left: 107.5, top: 100, width: 225, height: 300 });
  });

  it('reports the rendered crop when object-fit is cover', () => {
    const viewport = getObjectFitViewport(
      { left: 10, top: 20, width: 240, height: 320 },
      640,
      480,
      'cover'
    );

    expect(viewport.left).toBeCloseTo(-83.3333);
    expect(viewport.top).toBe(20);
    expect(viewport.width).toBeCloseTo(426.6667);
    expect(viewport.height).toBe(320);
  });

  it('expands the tracked plane around the visible camera centre for overscan', () => {
    const viewport = getObjectFitViewport(
      { left: 100, top: 50, width: 400, height: 300 },
      640,
      480,
      'contain',
      CAMERA_OVERSCAN_SCALE
    );

    expect(viewport.left).toBeCloseTo(76);
    expect(viewport.top).toBeCloseTo(32);
    expect(viewport.width).toBeCloseTo(448);
    expect(viewport.height).toBeCloseTo(336);
  });
});
