import { describe, expect, it } from 'vitest';
import { estimateIndexTipNearEdge } from './indexTipEstimator';
import { LandmarkPoint } from './types';

function handWithIndex(mcp: LandmarkPoint, pip: LandmarkPoint, dip: LandmarkPoint, tip: LandmarkPoint) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[5] = mcp;
  landmarks[6] = pip;
  landmarks[7] = dip;
  landmarks[8] = tip;
  return landmarks;
}

describe('estimateIndexTipNearEdge', () => {
  it('leaves ordinary in-frame fingertip tracking untouched', () => {
    const landmarks = handWithIndex(
      { x: 0.4, y: 0.5, z: 0 },
      { x: 0.5, y: 0.5, z: 0 },
      { x: 0.6, y: 0.5, z: 0 },
      { x: 0.68, y: 0.5, z: 0 }
    );

    const result = estimateIndexTipNearEdge(landmarks);
    expect(result.extrapolated).toBe(false);
    expect(result.landmarks).toBe(landmarks);
  });

  it('projects a clamped fingertip beyond the right camera edge', () => {
    const landmarks = handWithIndex(
      { x: 0.76, y: 0.5, z: 0 },
      { x: 0.85, y: 0.5, z: 0 },
      { x: 0.94, y: 0.5, z: 0 },
      { x: 0.95, y: 0.5, z: 0 }
    );

    const result = estimateIndexTipNearEdge(landmarks);
    expect(result.extrapolated).toBe(true);
    expect(result.landmarks[8].x).toBeGreaterThan(1);
  });

  it('does not extrapolate a finger aimed inward beside an edge', () => {
    const landmarks = handWithIndex(
      { x: 0.02, y: 0.5, z: 0 },
      { x: 0.07, y: 0.5, z: 0 },
      { x: 0.12, y: 0.5, z: 0 },
      { x: 0.17, y: 0.5, z: 0 }
    );

    expect(estimateIndexTipNearEdge(landmarks).extrapolated).toBe(false);
  });

  it('does not extrapolate a bent index finger', () => {
    const landmarks = handWithIndex(
      { x: 0.76, y: 0.5, z: 0 },
      { x: 0.85, y: 0.5, z: 0 },
      { x: 0.86, y: 0.42, z: 0 },
      { x: 0.93, y: 0.46, z: 0 }
    );

    expect(estimateIndexTipNearEdge(landmarks).extrapolated).toBe(false);
  });
});
