import { describe, it, expect, vi } from 'vitest';
import { ModeBForgeHandler } from './modeBForgeHandler';
import { GameController } from '../gameController';
import { ModeVisionContext } from './types';
import { LaserRay, ClassifiedPose, RayHitResult } from '../../vision/types';

describe('ModeBForgeHandler cleanup sweep protection', () => {
  function makeMockContext(overrides?: Partial<ModeVisionContext>): ModeVisionContext {
    const game = new GameController(undefined, 'mode_b');
    const ray: LaserRay = {
      origin: { x: 100, y: 100 },
      direction: { x: 0, y: -1 },
      active: true
    };
    const pose: ClassifiedPose = {
      isPointing: true,
      isIndexCurled: false,
      isOpenPalm: false,
      isForeshortened: false,
      confidence: 0.95,
      indexTip: { x: 100, y: 50 },
      indexPip: { x: 100, y: 70 },
      rayDirection: { x: 0, y: -1 },
      curlRatio: 0
    };
    const interState = {
      laserRay: ray,
      hoveredTargetId: null,
      dwellProgress: 0,
      dwellTargetId: null,
      carriedPosition: null,
      isDestinationHovered: false,
      activeHandId: null,
      trackingLostTimer: null,
      openPalmProgress: 0
    };

    return {
      ray,
      pose,
      hit: null,
      now: 1000,
      gameState: {
        ...game.getState(),
        phase: 'awaiting_cleanup'
      },
      interState,
      game,
      callbacks: {},
      dwellDurationMs: 450,
      lastDwellTargetId: null,
      lastDwellTime: 0,
      setDwellState: vi.fn(),
      resetDwell: vi.fn(),
      ...overrides
    };
  }

  it('triggers cleanup immediately on first pass if entering awaiting_cleanup while pointing away from -7 + 7 box', () => {
    const handler = new ModeBForgeHandler();
    const cleanupRequested = vi.fn();

    // Frame 1: Transitioning to awaiting_cleanup while pointing at equals or elsewhere on equation rail
    const railHit: RayHitResult = {
      targetId: 'eq-equals-target',
      targetType: 'destination',
      point: { x: 200, y: 50 },
      distance: 50
    };

    const ctx1 = makeMockContext({
      hit: railHit,
      callbacks: { onModeBCleanupRequested: cleanupRequested }
    });
    handler.onVisionFrame(ctx1);
    expect(cleanupRequested).not.toHaveBeenCalled();

    // Frame 2: Sweeping laser over mode-b-cleanup-target for the first time
    const cleanupHit: RayHitResult = {
      targetId: 'mode-b-cleanup-target',
      targetType: 'term',
      point: { x: 120, y: 50 },
      distance: 50
    };
    const ctx2 = makeMockContext({
      hit: cleanupHit,
      callbacks: { onModeBCleanupRequested: cleanupRequested }
    });
    handler.onVisionFrame(ctx2);

    // It MUST trigger on the first frame it sweeps over!
    expect(cleanupRequested).toHaveBeenCalledTimes(1);
  });

  it('requires pointing away first if entering awaiting_cleanup while already pointing directly at cleanup target', () => {
    const handler = new ModeBForgeHandler();
    const cleanupRequested = vi.fn();

    const cleanupHit: RayHitResult = {
      targetId: 'mode-b-cleanup-target',
      targetType: 'term',
      point: { x: 120, y: 50 },
      distance: 50
    };

    // Frame 1: Enters awaiting_cleanup while ALREADY on mode-b-cleanup-target
    const ctx1 = makeMockContext({
      hit: cleanupHit,
      callbacks: { onModeBCleanupRequested: cleanupRequested }
    });
    handler.onVisionFrame(ctx1);
    // Should NOT trigger yet because the laser was already on it upon phase start
    expect(cleanupRequested).not.toHaveBeenCalled();

    // Frame 2: Moves off target to rearm
    const ctx2 = makeMockContext({
      hit: null,
      callbacks: { onModeBCleanupRequested: cleanupRequested }
    });
    handler.onVisionFrame(ctx2);
    expect(cleanupRequested).not.toHaveBeenCalled();

    // Frame 3: Sweeps back over mode-b-cleanup-target
    const ctx3 = makeMockContext({
      hit: cleanupHit,
      callbacks: { onModeBCleanupRequested: cleanupRequested }
    });
    handler.onVisionFrame(ctx3);
    expect(cleanupRequested).toHaveBeenCalledTimes(1);
  });
});
