import { LandmarkPoint, ClassifiedPose } from './types';

function dist3d(p1: LandmarkPoint, p2: LandmarkPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function dist2d(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function classifyHandPose(landmarks: LandmarkPoint[], confidenceScore: number = 1.0): ClassifiedPose {
  if (!landmarks || landmarks.length < 21) {
    return {
      isPointing: false,
      isIndexCurled: false,
      isOpenPalm: false,
      isForeshortened: false,
      confidence: 0,
      indexTip: { x: 0, y: 0 },
      indexPip: { x: 0, y: 0 },
      rayDirection: { x: 0, y: -1 },
      curlRatio: 1,
      reason: 'Insufficient landmarks'
    };
  }

  // Key landmarks
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexDip = landmarks[7];
  const indexTip = landmarks[8];

  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleDip = landmarks[11];
  const middleTip = landmarks[12];

  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringDip = landmarks[15];
  const ringTip = landmarks[16];

  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyDip = landmarks[19];
  const pinkyTip = landmarks[20];

  // Palm scale (Wrist 0 to Middle MCP 9)
  const palmScale3d = Math.max(0.01, dist3d(wrist, middleMcp));
  const palmScale2d = Math.max(0.01, dist2d(wrist, middleMcp));

  // Index segment lengths
  const indexSegments3d = dist3d(indexMcp, indexPip) + dist3d(indexPip, indexDip) + dist3d(indexDip, indexTip);
  const indexChord3d = dist3d(indexMcp, indexTip);
  const indexStraightness = indexSegments3d > 0 ? indexChord3d / indexSegments3d : 0;

  // 2D distance for foreshortening check
  const indexChord2d = dist2d(indexMcp, indexTip);
  const index2dRatio = indexChord2d / palmScale2d;

  // Middle finger curl
  const middleSegments3d = dist3d(middleMcp, middlePip) + dist3d(middlePip, middleDip) + dist3d(middleDip, middleTip);
  const middleChord3d = dist3d(middleMcp, middleTip);
  const middleStraightness = middleSegments3d > 0 ? middleChord3d / middleSegments3d : 0;

  // Ring finger curl
  const ringSegments3d = dist3d(ringMcp, ringPip) + dist3d(ringPip, ringDip) + dist3d(ringDip, ringTip);
  const ringChord3d = dist3d(ringMcp, ringTip);
  const ringStraightness = ringSegments3d > 0 ? ringChord3d / ringSegments3d : 0;

  // Pinky curl
  const pinkySegments3d = dist3d(pinkyMcp, pinkyPip) + dist3d(pinkyPip, pinkyDip) + dist3d(pinkyDip, pinkyTip);
  const pinkyChord3d = dist3d(pinkyMcp, pinkyTip);
  const pinkyStraightness = pinkySegments3d > 0 ? pinkyChord3d / pinkySegments3d : 0;

  // Classifications:
  // 1. Open palm: all four fingers reasonably straight
  const isOpenPalm = indexStraightness > 0.80 && 
                     middleStraightness > 0.76 && 
                     ringStraightness > 0.76 && 
                     pinkyStraightness > 0.72;

  // 2. Foreshortened: straight in 3D but projected 2D chord is short
  const isForeshortened = indexStraightness > 0.85 && index2dRatio < 0.40;

  // 3. Other fingers curled
  // Middle, ring, pinky should be folded
  const otherFingersCurled = (middleStraightness < 0.72) && 
                             (ringStraightness < 0.72) && 
                             (pinkyStraightness < 0.75);

  // 4. Index straight (pointing)
  // Index straightness >= 0.85 and index chord compared to palm scale >= 0.65
  const isIndexStraight = indexStraightness >= 0.86 && (indexChord3d / palmScale3d) >= 0.65;

  const isPointing = isIndexStraight && otherFingersCurled && !isOpenPalm && !isForeshortened;

  // 5. Index curled
  // Observed curl: index bends significantly while other fingers remain curled
  const curlRatio = Math.max(0, Math.min(1, 1 - (indexStraightness - 0.5) / 0.4));
  const isIndexCurled = indexStraightness < 0.70 && otherFingersCurled && !isOpenPalm;

  // 2D Ray Direction from PIP (or DIP) to Tip
  const rawDx = indexTip.x - indexPip.x;
  const rawDy = indexTip.y - indexPip.y;
  const len2d = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

  const rayDirection = len2d > 0.001
    ? { x: rawDx / len2d, y: rawDy / len2d }
    : { x: 0, y: -1 };

  return {
    isPointing,
    isIndexCurled,
    isOpenPalm,
    isForeshortened,
    confidence: confidenceScore,
    indexTip: { x: indexTip.x, y: indexTip.y },
    indexPip: { x: indexPip.x, y: indexPip.y },
    rayDirection,
    curlRatio,
    reason: isForeshortened ? 'Turn your finger sideways a little.' : undefined
  };
}
