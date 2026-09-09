import { MagicItem } from '../data/magicItems';

/**
 * Shared math item variable rendering helpers.
 * Renders the persistent magical item icon across all solver modes and equation states.
 */

export function renderItemIcon(item: MagicItem, extraClass: string = ''): string {
  return `
    <span class="math-symbol term-variable math-item-token ${extraClass}" role="img" aria-label="${item.accessibleLabel}" title="${item.singular}">
      <img src="${item.iconAsset}" class="math-item-icon" alt="${item.singular}" onerror="this.parentElement.innerHTML='<span class=\\'math-item-emoji\\'>${item.emojiFallback}</span>'" />
    </span>
  `.trim();
}

export function renderProduct(
  a: number,
  item: MagicItem,
  options?: {
    compact?: boolean;
    timesClass?: string;
    tileClass?: string;
    interactiveId?: string;
  }
): string {
  const iconHtml = renderItemIcon(item);

  if (a === 1) {
    return iconHtml;
  }

  if (options?.compact) {
    // Mode D compact representation (e.g. 3× or 3 with icon)
    const coeffId = options.interactiveId ? `id="${options.interactiveId}"` : '';
    return `
      <div class="mode-d-compact-product">
        <div ${coeffId} class="term-tile op-times mode-d-compact-coefficient ${options.tileClass || ''}">${a}</div>
        <div class="mode-d-compact-times">×</div>
        ${iconHtml}
      </div>
    `.trim();
  }

  // Standard product: a × [icon]
  const timesCls = options?.timesClass || 'term-times op-times';
  const tileCls = options?.tileClass || 'term-tile op-times';
  const coeffId = options?.interactiveId ? `id="${options.interactiveId}"` : '';

  return `
    <div ${coeffId} class="${tileCls}">${a}</div>
    <div class="math-symbol ${timesCls}">×</div>
    ${iconHtml}
  `.trim();
}

/**
 * Formats display-only strings (like history lines or arithmetic captions)
 * replacing 'Y' or 'y' variables with clean item references.
 */
export function formatHistoryWithItem(rawHistory: string, item: MagicItem): string {
  if (!rawHistory) return '';
  const iconHtml = renderItemIcon(item, 'history-math-item');
  // Replace standalone Y or Y followed by operators
  return rawHistory
    .replace(/\bY\b/g, iconHtml)
    .replace(/\by\b/g, iconHtml);
}
