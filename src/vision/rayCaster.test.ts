import { describe, expect, it } from 'vitest';
import { castRayAgainstTargets, InteractiveTarget } from './rayCaster';

describe('castRayAgainstTargets', () => {
  it('returns inverse-choice cards as laser targets', () => {
    const target: InteractiveTarget = {
      id: 'inverse-choice-add-1',
      type: 'inverse_choice',
      rect: { left: 40, top: 0, right: 80, bottom: 40, width: 40, height: 40 },
      enabled: true
    };

    const hit = castRayAgainstTargets({
      origin: { x: 0, y: 20 },
      direction: { x: 1, y: 0 },
      active: true
    }, [target]);

    expect(hit?.targetId).toBe(target.id);
    expect(hit?.targetType).toBe('inverse_choice');
  });
});
