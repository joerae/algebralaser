import { LaserRay, RayHitResult } from './types';

export interface InteractiveTarget {
  id: string;
  type: 'term' | 'destination' | 'answer' | 'utility' | 'forge';
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  enabled: boolean;
  priority?: number;
}

export function intersectRayWithHorizontalLine(
  ray: LaserRay,
  lineY: number
): { hitX: number; hitY: number; t: number } | null {
  if (!ray.active) return null;
  
  // If ray is nearly horizontal, reject
  if (Math.abs(ray.direction.y) < 0.05) return null;

  const t = (lineY - ray.origin.y) / ray.direction.y;
  if (t <= 0) return null; // Behind the finger

  const hitX = ray.origin.x + t * ray.direction.x;
  return { hitX, hitY: lineY, t };
}

export function intersectRayWithVerticalLine(
  ray: LaserRay,
  lineX: number
): { hitX: number; hitY: number; t: number } | null {
  if (!ray.active) return null;

  // If ray is nearly vertical, reject
  if (Math.abs(ray.direction.x) < 0.05) return null;

  const t = (lineX - ray.origin.x) / ray.direction.x;
  if (t <= 0) return null; // Behind the finger

  const hitY = ray.origin.y + t * ray.direction.y;
  return { hitX: lineX, hitY, t };
}

// Ray vs AABB box intersection (for buttons / padded hit targets)
export function intersectRayWithRect(
  ray: LaserRay,
  rect: { left: number; top: number; right: number; bottom: number }
): { hitX: number; hitY: number; t: number } | null {
  if (!ray.active) return null;

  const { origin, direction } = ray;
  let tmin = 0;
  let tmax = Infinity;

  // X slab
  if (Math.abs(direction.x) < 1e-6) {
    if (origin.x < rect.left || origin.x > rect.right) return null;
  } else {
    let t1 = (rect.left - origin.x) / direction.x;
    let t2 = (rect.right - origin.x) / direction.x;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Y slab
  if (Math.abs(direction.y) < 1e-6) {
    if (origin.y < rect.top || origin.y > rect.bottom) return null;
  } else {
    let t1 = (rect.top - origin.y) / direction.y;
    let t2 = (rect.bottom - origin.y) / direction.y;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (tmax <= 0) return null;
  const t = tmin > 0 ? tmin : tmax;
  return {
    hitX: origin.x + t * direction.x,
    hitY: origin.y + t * direction.y,
    t
  };
}

export function castRayAgainstTargets(
  ray: LaserRay,
  targets: InteractiveTarget[]
): RayHitResult | null {
  if (!ray.active) return null;

  let bestHit: RayHitResult | null = null;
  let minDistance = Infinity;

  for (const target of targets) {
    if (!target.enabled) continue;

    const hit = intersectRayWithRect(ray, target.rect);
    if (hit) {
      // Prioritize answers / destinations over utility if needed, or by distance
      const effectiveDistance = hit.t - (target.priority || 0) * 1000;
      if (effectiveDistance < minDistance) {
        minDistance = effectiveDistance;
        bestHit = {
          targetId: target.id,
          targetType: target.type,
          point: { x: hit.hitX, y: hit.hitY },
          distance: hit.t
        };
      }
    }
  }

  return bestHit;
}

// Velocity-adaptive smoothing filter:
// High velocity (moving/aiming) -> high alpha (up to 0.85) for instant zero-lag response.
// Low velocity (hovering/dwelling) -> low alpha (down to 0.38) for rock-solid stability.
export class RaySmoother {
  private smoothedOrigin: { x: number; y: number } | null = null;
  private smoothedDirection: { x: number; y: number } | null = null;
  private minAlpha: number;
  private maxAlpha: number;

  constructor(minAlpha: number = 0.38, maxAlpha?: number) {
    this.minAlpha = minAlpha;
    this.maxAlpha = maxAlpha !== undefined ? maxAlpha : (minAlpha === 0.38 ? 0.85 : minAlpha);
  }

  reset() {
    this.smoothedOrigin = null;
    this.smoothedDirection = null;
  }

  smooth(origin: { x: number; y: number }, direction: { x: number; y: number }): {
    origin: { x: number; y: number };
    direction: { x: number; y: number };
  } {
    if (!this.smoothedOrigin || !this.smoothedDirection) {
      this.smoothedOrigin = { ...origin };
      this.smoothedDirection = { ...direction };
      return { origin: { ...origin }, direction: { ...direction } };
    }

    // Measure delta in position and direction to determine movement velocity
    const deltaOriginDist = Math.hypot(origin.x - this.smoothedOrigin.x, origin.y - this.smoothedOrigin.y);
    const deltaDirDist = Math.hypot(direction.x - this.smoothedDirection.x, direction.y - this.smoothedDirection.y);

    // Compute dynamic alpha: fast movements get high alpha (instant), slow movements get low alpha (steady)
    const speedScore = Math.min(1.0, (deltaOriginDist / 20) + (deltaDirDist * 3.5));
    const dynamicAlpha = this.minAlpha + (this.maxAlpha - this.minAlpha) * speedScore;

    const oX = this.smoothedOrigin.x * (1 - dynamicAlpha) + origin.x * dynamicAlpha;
    const oY = this.smoothedOrigin.y * (1 - dynamicAlpha) + origin.y * dynamicAlpha;
    this.smoothedOrigin = { x: oX, y: oY };

    const dX = this.smoothedDirection.x * (1 - dynamicAlpha) + direction.x * dynamicAlpha;
    const dY = this.smoothedDirection.y * (1 - dynamicAlpha) + direction.y * dynamicAlpha;
    const len = Math.hypot(dX, dY);
    this.smoothedDirection = len > 0 ? { x: dX / len, y: dY / len } : { x: 0, y: -1 };

    return {
      origin: { ...this.smoothedOrigin },
      direction: { ...this.smoothedDirection }
    };
  }
}
