export interface TargetRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TargetRectInput {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TargetExpansionOptions {
  padding: number;
  guard?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

function finishRect(left: number, top: number, right: number, bottom: number): TargetRect {
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

/**
 * Expands an ordered row or column of targets into the available whitespace.
 * Edges shared by neighbours stop either side of the gap midpoint, so laser
 * targets remain generous without ever overlapping.
 */
export function expandNonOverlappingTargets(
  inputs: TargetRectInput[],
  options: TargetExpansionOptions
): TargetRect[] {
  if (inputs.length === 0) return [];

  const padding = Math.max(0, options.padding);
  const guard = Math.max(0, options.guard ?? 3);
  const viewportWidth = options.viewportWidth ?? Number.POSITIVE_INFINITY;
  const viewportHeight = options.viewportHeight ?? Number.POSITIVE_INFINITY;
  const centres = inputs.map(rect => ({
    x: (rect.left + rect.right) / 2,
    y: (rect.top + rect.bottom) / 2
  }));
  const xSpread = Math.max(...centres.map(point => point.x)) - Math.min(...centres.map(point => point.x));
  const ySpread = Math.max(...centres.map(point => point.y)) - Math.min(...centres.map(point => point.y));
  const horizontal = xSpread > ySpread;
  const ordered = inputs
    .map((rect, originalIndex) => ({ rect, originalIndex }))
    .sort((a, b) => horizontal ? a.rect.left - b.rect.left : a.rect.top - b.rect.top);
  const expanded: TargetRect[] = new Array(inputs.length);

  ordered.forEach(({ rect, originalIndex }, index) => {
    const previous = ordered[index - 1]?.rect;
    const next = ordered[index + 1]?.rect;
    let left = Math.max(0, rect.left - padding);
    let top = Math.max(0, rect.top - padding);
    let right = Math.min(viewportWidth, rect.right + padding);
    let bottom = Math.min(viewportHeight, rect.bottom + padding);

    if (horizontal) {
      if (previous) {
        const midpoint = (previous.right + rect.left) / 2;
        left = Math.max(left, midpoint + guard / 2);
      }
      if (next) {
        const midpoint = (rect.right + next.left) / 2;
        right = Math.min(right, midpoint - guard / 2);
      }
    } else {
      if (previous) {
        const midpoint = (previous.bottom + rect.top) / 2;
        top = Math.max(top, midpoint + guard / 2);
      }
      if (next) {
        const midpoint = (rect.bottom + next.top) / 2;
        bottom = Math.min(bottom, midpoint - guard / 2);
      }
    }

    expanded[originalIndex] = finishRect(left, top, right, bottom);
  });

  return expanded;
}

