import { describe, it, expect } from 'vitest';
import { classifyHandPose } from './poseClassifier';
import { LandmarkPoint } from './types';
import { 
  intersectRayWithHorizontalLine, 
  intersectRayWithVerticalLine, 
  RaySmoother
} from './rayCaster';

function createSyntheticHand(options: {
  indexDir: { x: number; y: number };
  indexCurled?: boolean;
  allFingersExtended?: boolean;
}): LandmarkPoint[] {
  const landmarks: LandmarkPoint[] = [];

  // Wrist at 0, 0
  landmarks[0] = { x: 0.5, y: 0.8, z: 0 };

  // Thumb
  landmarks[1] = { x: 0.45, y: 0.75, z: 0 };
  landmarks[2] = { x: 0.42, y: 0.70, z: 0 };
  landmarks[3] = { x: 0.40, y: 0.67, z: 0 };
  landmarks[4] = { x: 0.38, y: 0.65, z: 0 };

  // Index MCP
  const mcpX = 0.48;
  const mcpY = 0.65;
  landmarks[5] = { x: mcpX, y: mcpY, z: 0 };

  if (options.indexCurled) {
    // Curled: bends back towards MCP
    landmarks[6] = { x: mcpX + options.indexDir.x * 0.05, y: mcpY + options.indexDir.y * 0.05, z: 0 };
    landmarks[7] = { x: mcpX + options.indexDir.x * 0.06, y: mcpY + options.indexDir.y * 0.06 + 0.03, z: 0.02 };
    landmarks[8] = { x: mcpX + 0.02, y: mcpY + 0.03, z: 0.04 }; // tip close to MCP
  } else {
    // Straight: extends along indexDir
    const seg = 0.06;
    landmarks[6] = { x: mcpX + options.indexDir.x * seg, y: mcpY + options.indexDir.y * seg, z: 0 };
    landmarks[7] = { x: mcpX + options.indexDir.x * seg * 2, y: mcpY + options.indexDir.y * seg * 2, z: 0 };
    landmarks[8] = { x: mcpX + options.indexDir.x * seg * 3, y: mcpY + options.indexDir.y * seg * 3, z: 0 };
  }

  // Middle MCP
  landmarks[9] = { x: 0.52, y: 0.64, z: 0 };
  if (options.allFingersExtended) {
    landmarks[10] = { x: 0.52, y: 0.58, z: 0 };
    landmarks[11] = { x: 0.52, y: 0.52, z: 0 };
    landmarks[12] = { x: 0.52, y: 0.46, z: 0 };
  } else {
    landmarks[10] = { x: 0.52, y: 0.68, z: 0.02 };
    landmarks[11] = { x: 0.52, y: 0.70, z: 0.04 };
    landmarks[12] = { x: 0.52, y: 0.66, z: 0.05 }; // curled
  }

  // Ring MCP
  landmarks[13] = { x: 0.55, y: 0.65, z: 0 };
  if (options.allFingersExtended) {
    landmarks[14] = { x: 0.55, y: 0.59, z: 0 };
    landmarks[15] = { x: 0.55, y: 0.53, z: 0 };
    landmarks[16] = { x: 0.55, y: 0.47, z: 0 };
  } else {
    landmarks[14] = { x: 0.55, y: 0.69, z: 0.02 };
    landmarks[15] = { x: 0.55, y: 0.71, z: 0.04 };
    landmarks[16] = { x: 0.55, y: 0.67, z: 0.05 }; // curled
  }

  // Pinky MCP
  landmarks[17] = { x: 0.58, y: 0.68, z: 0 };
  if (options.allFingersExtended) {
    landmarks[18] = { x: 0.58, y: 0.62, z: 0 };
    landmarks[19] = { x: 0.58, y: 0.56, z: 0 };
    landmarks[20] = { x: 0.58, y: 0.50, z: 0 };
  } else {
    landmarks[18] = { x: 0.58, y: 0.71, z: 0.02 };
    landmarks[19] = { x: 0.58, y: 0.73, z: 0.04 };
    landmarks[20] = { x: 0.58, y: 0.69, z: 0.05 }; // curled
  }

  return landmarks;
}

describe('Pose Classifier & Ray Caster', () => {
  it('detects pointing across multiple directions (up, diagonal, right, left)', () => {
    // Pointing Up (0, -1)
    const handUp = createSyntheticHand({ indexDir: { x: 0, y: -1 } });
    const poseUp = classifyHandPose(handUp);
    expect(poseUp.isPointing).toBe(true);
    expect(poseUp.isIndexCurled).toBe(false);
    expect(poseUp.isOpenPalm).toBe(false);

    // Pointing Diagonal (0.707, -0.707)
    const handDiag = createSyntheticHand({ indexDir: { x: 0.707, y: -0.707 } });
    const poseDiag = classifyHandPose(handDiag);
    expect(poseDiag.isPointing).toBe(true);

    // Pointing Right (1, 0)
    const handRight = createSyntheticHand({ indexDir: { x: 1, y: 0 } });
    const poseRight = classifyHandPose(handRight);
    expect(poseRight.isPointing).toBe(true);

    // Pointing Left (-1, 0)
    const handLeft = createSyntheticHand({ indexDir: { x: -1, y: 0 } });
    const poseLeft = classifyHandPose(handLeft);
    expect(poseLeft.isPointing).toBe(true);
  });

  it('detects curled index finger with other fingers curled', () => {
    const handCurled = createSyntheticHand({ 
      indexDir: { x: 0, y: -1 }, 
      indexCurled: true 
    });
    const poseCurled = classifyHandPose(handCurled);
    expect(poseCurled.isPointing).toBe(false);
    expect(poseCurled.isIndexCurled).toBe(true);
  });

  it('recognizes open palm and does NOT classify it as pointing or curl', () => {
    const handOpen = createSyntheticHand({ 
      indexDir: { x: 0, y: -1 }, 
      allFingersExtended: true 
    });
    const poseOpen = classifyHandPose(handOpen);
    expect(poseOpen.isOpenPalm).toBe(true);
    expect(poseOpen.isPointing).toBe(false);
    expect(poseOpen.isIndexCurled).toBe(false);
  });

  it('correctly intersects horizontal equation rail', () => {
    const ray = {
      origin: { x: 500, y: 600 },
      direction: { x: 0.5, y: -0.866 }, // pointing up and right
      active: true
    };
    const railY = 200; // rail above finger
    const hit = intersectRayWithHorizontalLine(ray, railY);
    expect(hit).not.toBeNull();
    expect(hit!.hitY).toBe(200);
    // hitX = 500 + ((200 - 600) / -0.866) * 0.5 = 500 + 461.89 * 0.5 = 730.9
    expect(hit!.hitX).toBeGreaterThan(700);
  });

  it('rejects ray directed away from rail (t <= 0)', () => {
    const ray = {
      origin: { x: 500, y: 200 },
      direction: { x: 0, y: 1 }, // pointing down
      active: true
    };
    const railY = 100; // rail is above
    const hit = intersectRayWithHorizontalLine(ray, railY);
    expect(hit).toBeNull();
  });

  it('correctly intersects vertical answer rail', () => {
    const ray = {
      origin: { x: 600, y: 500 },
      direction: { x: 0.8, y: -0.6 }, // pointing right
      active: true
    };
    const answerX = 1000;
    const hit = intersectRayWithVerticalLine(ray, answerX);
    expect(hit).not.toBeNull();
    expect(hit!.hitX).toBe(1000);
    expect(hit!.hitY).toBeLessThan(500);
  });

  it('smoothes ray origin and direction cleanly without jitter', () => {
    const smoother = new RaySmoother(0.5);
    const step1 = smoother.smooth({ x: 100, y: 100 }, { x: 0, y: -1 });
    expect(step1.origin.x).toBe(100);

    const step2 = smoother.smooth({ x: 200, y: 200 }, { x: 1, y: 0 });
    // 0.5 blend of 100 and 200 is 150
    expect(step2.origin.x).toBe(150);
    expect(step2.origin.y).toBe(150);
  });
});
