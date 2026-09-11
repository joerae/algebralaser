import { ViewportRect } from './coordinateTransform';

export type ObjectFitMode = 'contain' | 'cover';

/**
 * Slightly enlarges the tracked camera plane beyond the visible frame. The
 * video uses the same scale in CSS, so landmarks remain aligned while hands
 * near an edge can continue into the surrounding controls.
 */
export const CAMERA_OVERSCAN_SCALE = 1.12;

/** Returns the exact on-screen rectangle occupied by object-fit video pixels. */
export function getObjectFitViewport(
  elementRect: ViewportRect,
  intrinsicWidth: number,
  intrinsicHeight: number,
  fit: ObjectFitMode = 'contain',
  displayScale: number = 1
): ViewportRect {
  if (
    elementRect.width <= 0
    || elementRect.height <= 0
    || intrinsicWidth <= 0
    || intrinsicHeight <= 0
  ) {
    return elementRect;
  }

  const widthScale = elementRect.width / intrinsicWidth;
  const heightScale = elementRect.height / intrinsicHeight;
  const scale = fit === 'cover'
    ? Math.max(widthScale, heightScale)
    : Math.min(widthScale, heightScale);
  const safeDisplayScale = displayScale > 0 ? displayScale : 1;
  const width = intrinsicWidth * scale * safeDisplayScale;
  const height = intrinsicHeight * scale * safeDisplayScale;

  return {
    left: elementRect.left + (elementRect.width - width) / 2,
    top: elementRect.top + (elementRect.height - height) / 2,
    width,
    height
  };
}
