import { LandmarkPoint } from './types';

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function transformLandmarkToViewport(
  point: { x: number; y: number },
  viewport: ViewportRect,
  mirrored: boolean = true
): { x: number; y: number } {
  const normX = mirrored ? (1 - point.x) : point.x;
  const x = viewport.left + normX * viewport.width;
  const y = viewport.top + point.y * viewport.height;
  return { x, y };
}

export function computeLaserRay(
  tipLandmark: LandmarkPoint,
  pipLandmark: LandmarkPoint,
  viewport: ViewportRect,
  mirrored: boolean = true
): { origin: { x: number; y: number }; direction: { x: number; y: number } } {
  const origin = transformLandmarkToViewport(tipLandmark, viewport, mirrored);
  const pip = transformLandmarkToViewport(pipLandmark, viewport, mirrored);

  const dx = origin.x - pip.x;
  const dy = origin.y - pip.y;
  const len = Math.hypot(dx, dy);

  const direction = len > 0.001
    ? { x: dx / len, y: dy / len }
    : { x: 0, y: -1 };

  return { origin, direction };
}
