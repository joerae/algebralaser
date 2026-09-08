export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  landmarks: LandmarkPoint[];
  handedness: 'Left' | 'Right';
  score: number;
}

export interface ClassifiedPose {
  isPointing: boolean;
  isIndexCurled: boolean;
  isOpenPalm: boolean;
  isForeshortened: boolean;
  confidence: number;
  indexTip: { x: number; y: number };
  indexPip: { x: number; y: number };
  rayDirection: { x: number; y: number }; // normalized 2D vector
  curlRatio: number; // 0 = straight, 1 = fully curled
  reason?: string;
}

export interface LaserRay {
  origin: { x: number; y: number };
  direction: { x: number; y: number };
  active: boolean;
  targetHit?: RayHitResult | null;
}

export interface RayHitResult {
  targetId: string;
  targetType: 'term' | 'destination' | 'answer' | 'utility' | 'forge' | 'blaster';
  point: { x: number; y: number };
  distance: number;
}

export interface TrackedHandState {
  id: number;
  handedness: 'Left' | 'Right';
  lastSeenTime: number;
  pose: ClassifiedPose;
  ray: LaserRay;
}
