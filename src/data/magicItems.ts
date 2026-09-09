export type MagicItemId = 'wand' | 'broomstick' | 'cauldron' | 'spell';

export interface MagicItem {
  id: MagicItemId;
  singular: string;
  plural: string;
  iconAsset: string;
  accessibleLabel: string;
  emojiFallback: string;
  svgContent: string;
}

export const MAGIC_ITEMS: MagicItem[] = [
  {
    id: 'wand',
    singular: 'wand',
    plural: 'wands',
    iconAsset: '/icons/magic-shop/wand.svg',
    accessibleLabel: 'price of one wand',
    emojiFallback: '🪄',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg wand-svg" aria-hidden="true" fill="none"><path d="M9 39 L31 17" stroke="#b45309" stroke-width="4.5" stroke-linecap="round"/><path d="M8 40 L12 36" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/><path d="M31 17 L38 10" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/><path d="M38 10 L39 6 L40 10 L44 11 L40 12 L39 16 L38 12 L34 11 Z" fill="#fef08a"/><circle cx="28" cy="8" r="1.5" fill="#67e8f9"/><circle cx="43" cy="18" r="1" fill="#f472b6"/></svg>`
  },
  {
    id: 'broomstick',
    singular: 'broomstick',
    plural: 'broomsticks',
    iconAsset: '/icons/magic-shop/broomstick.svg',
    accessibleLabel: 'price of one broomstick',
    emojiFallback: '🧹',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg broom-svg" aria-hidden="true" fill="none"><path d="M7 8 L29 30" stroke="#a16207" stroke-width="4" stroke-linecap="round"/><path d="M28 29 C29 27, 33 27, 36 29 L42 41 C40 43, 34 44, 30 40 L28 29 Z" fill="#f59e0b"/><line x1="28" y1="31" x2="33" y2="28" stroke="#fde047" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="18" r="1.5" fill="#38bdf8"/></svg>`
  },
  {
    id: 'cauldron',
    singular: 'cauldron',
    plural: 'cauldrons',
    iconAsset: '/icons/magic-shop/cauldron.svg',
    accessibleLabel: 'price of one cauldron',
    emojiFallback: '🍲',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg cauldron-svg" aria-hidden="true" fill="none"><path d="M16 38 L14 43 M32 38 L34 43" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><path d="M11 20 C10 32, 16 39, 24 39 C32 39, 38 32, 37 20 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5"/><ellipse cx="24" cy="20" rx="14" ry="3.5" fill="#334155" stroke="#64748b" stroke-width="1.5"/><ellipse cx="24" cy="20" rx="11" ry="2.5" fill="#22c55e"/><circle cx="21" cy="14" r="2" fill="#4ade80"/><circle cx="27" cy="11" r="2.5" fill="#86efac"/></svg>`
  },
  {
    id: 'spell',
    singular: 'spell scroll',
    plural: 'spell scrolls',
    iconAsset: '/icons/magic-shop/spell.svg',
    accessibleLabel: 'price of one spell scroll',
    emojiFallback: '📜',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg spell-svg" aria-hidden="true" fill="none"><rect x="12" y="10" width="24" height="28" rx="2" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/><rect x="9" y="8" width="30" height="5" rx="2.5" fill="#92400e"/><rect x="9" y="35" width="30" height="5" rx="2.5" fill="#92400e"/><path d="M24 16 L29 23 L25 24 L28 30 L20 23 L24 22 Z" fill="#818cf8"/><line x1="12" y1="24" x2="36" y2="24" stroke="#e11d48" stroke-width="2.5" stroke-dasharray="4 2"/></svg>`
  }
];

/**
 * 32-bit FNV-1a hash algorithm
 * Generates a stable deterministic hash from a string without consuming RNG
 */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministically picks a magic shop item for a puzzle based on its ID.
 * Avoids consuming puzzle generator RNG.
 */
export function getMagicItemForPuzzle(puzzleId: string): MagicItem {
  const index = hashString(puzzleId) % MAGIC_ITEMS.length;
  return MAGIC_ITEMS[index];
}
