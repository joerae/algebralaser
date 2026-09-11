import { ViewportRect } from './coordinateTransform';

export type ObjectFitMode = 'contain' | 'cover';

/** Returns the exact on-screen rectangle occupied by object-fit video pixels. */
export function getObjectFitViewport(
  elementRect: ViewportRect,
  intrinsicWidth: number,
  intrinsicHeight: number,
  fit: ObjectFitMode = 'contain'
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
  const width = intrinsicWidth * scale;
  const height = intrinsicHeight * scale;

  return {
    left: elementRect.left + (elementRect.width - width) / 2,
    top: elementRect.top + (elementRect.height - height) / 2,
    width,
    height
  };
}
