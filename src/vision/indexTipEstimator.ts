import { LandmarkPoint } from './types';

export interface IndexTipEstimate {
  landmarks: LandmarkPoint[];
  extrapolated: boolean;
}

const EDGE_ZONE = 0.14;
const MIN_SEGMENT_LENGTH = 0.008;
const DISTAL_TO_MIDDLE_RATIO = 0.85;
const MIN_STRAIGHT_DOT = 0.72;

function length2d(x: number, y: number): number {
  return Math.hypot(x, y);
}

/**
 * Reconstructs an off-camera index fingertip from MCP, PIP, and DIP joints.
 *
 * MediaPipe always returns a complete landmark set, but its fingertip can
 * collapse onto the image edge once the real tip leaves the sensor. We only
 * replace it when the visible index joints are straight, close to an edge,
 * and travelling out through that edge. Normal in-frame tracking is untouched.
 */
export function estimateIndexTipNearEdge(landmarks: LandmarkPoint[]): IndexTipEstimate {
  if (landmarks.length < 21) return { landmarks, extrapolated: false };

  const mcp = landmarks[5];
  const pip = landmarks[6];
  const dip = landmarks[7];
  const trackedTip = landmarks[8];
  const points = [mcp, pip, dip, trackedTip];
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z))) {
    return { landmarks, extrapolated: false };
  }

  const proximalX = pip.x - mcp.x;
  const proximalY = pip.y - mcp.y;
  const middleX = dip.x - pip.x;
  const middleY = dip.y - pip.y;
  const proximalLength = length2d(proximalX, proximalY);
  const middleLength = length2d(middleX, middleY);
  if (proximalLength < MIN_SEGMENT_LENGTH || middleLength < MIN_SEGMENT_LENGTH) {
    return { landmarks, extrapolated: false };
  }

  const straightDot = (proximalX * middleX + proximalY * middleY) / (proximalLength * middleLength);
  if (straightDot < MIN_STRAIGHT_DOT) return { landmarks, extrapolated: false };

  const edgeCandidates = [
    { distance: dip.x, outward: middleX < -MIN_SEGMENT_LENGTH },
    { distance: 1 - dip.x, outward: middleX > MIN_SEGMENT_LENGTH },
    { distance: dip.y, outward: middleY < -MIN_SEGMENT_LENGTH },
    { distance: 1 - dip.y, outward: middleY > MIN_SEGMENT_LENGTH }
  ];
  const outwardDistances = edgeCandidates.filter(edge => edge.outward).map(edge => edge.distance);
  const edgeDistance = outwardDistances.length > 0 ? Math.min(...outwardDistances) : Number.POSITIVE_INFINITY;
  if (edgeDistance >= EDGE_ZONE) return { landmarks, extrapolated: false };

  const estimatedTip: LandmarkPoint = {
    x: dip.x + middleX * DISTAL_TO_MIDDLE_RATIO,
    y: dip.y + middleY * DISTAL_TO_MIDDLE_RATIO,
    z: dip.z + (dip.z - pip.z) * DISTAL_TO_MIDDLE_RATIO
  };

  // Feather into the estimate across the edge zone to avoid a visible jump.
  // A suspiciously shortened or backwards tracked distal joint is replaced
  // completely because that is the characteristic edge-clamping failure.
  const trackedDistalX = trackedTip.x - dip.x;
  const trackedDistalY = trackedTip.y - dip.y;
  const trackedDistalLength = length2d(trackedDistalX, trackedDistalY);
  const trackedDirectionDot = trackedDistalLength > 0
    ? (trackedDistalX * middleX + trackedDistalY * middleY) / (trackedDistalLength * middleLength)
    : -1;
  const trackedTipIsUnreliable = trackedDistalLength < middleLength * 0.35 || trackedDirectionDot < 0.45;
  const edgeStrength = Math.max(0, Math.min(1, 1 - edgeDistance / EDGE_ZONE));
  const blend = trackedTipIsUnreliable ? 1 : edgeStrength;

  const resolvedTip: LandmarkPoint = {
    x: trackedTip.x + (estimatedTip.x - trackedTip.x) * blend,
    y: trackedTip.y + (estimatedTip.y - trackedTip.y) * blend,
    z: trackedTip.z + (estimatedTip.z - trackedTip.z) * blend
  };
  const adjustedLandmarks = landmarks.slice();
  adjustedLandmarks[8] = resolvedTip;
  return { landmarks: adjustedLandmarks, extrapolated: true };
}
