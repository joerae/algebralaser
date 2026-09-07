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
  mirrored: boolean = true,
  mcpLandmark?: LandmarkPoint
): { origin: { x: number; y: number }; direction: { x: number; y: number } } {
  const origin = transformLandmarkToViewport(tipLandmark, viewport, mirrored);
  const pip = transformLandmarkToViewport(pipLandmark, viewport, mirrored);

  // If MCP knuckle landmark is provided, blend PIP and MCP to create a longer, stabilized base
  let baseX = pip.x;
  let baseY = pip.y;
  if (mcpLandmark) {
    const mcp = transformLandmarkToViewport(mcpLandmark, viewport, mirrored);
    baseX = pip.x * 0.6 + mcp.x * 0.4;
    baseY = pip.y * 0.6 + mcp.y * 0.4;
  }

  const dx = origin.x - baseX;
  const dy = origin.y - baseY;
  const len = Math.hypot(dx, dy);

  const direction = len > 0.001
    ? { x: dx / len, y: dy / len }
    : { x: 0, y: -1 };

  return { origin, direction };
}
