export type MagicItemId = 'wand' | 'broomstick' | 'cauldron' | 'spell' | 'chocolate' | 'crystal' | 'potion';

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
    id: 'chocolate',
    singular: 'block of magical chocolate',
    plural: 'blocks of magical chocolate',
    iconAsset: '/icons/magic-shop/chocolate.svg',
    accessibleLabel: 'price of one block of magical chocolate',
    emojiFallback: '🍫',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg chocolate-svg" aria-hidden="true" fill="none"><rect x="10" y="10" width="28" height="28" rx="4" fill="#582f0e" stroke="#7f4f24" stroke-width="2"/><rect x="13" y="13" width="10" height="10" rx="1.5" fill="#7f4f24" stroke="#936639" stroke-width="1"/><rect x="25" y="13" width="10" height="10" rx="1.5" fill="#7f4f24" stroke="#936639" stroke-width="1"/><rect x="13" y="25" width="10" height="10" rx="1.5" fill="#7f4f24" stroke="#936639" stroke-width="1"/><rect x="25" y="25" width="10" height="10" rx="1.5" fill="#7f4f24" stroke="#936639" stroke-width="1"/><path d="M10 28 L20 38 L10 38 Z" fill="#fbbf24"/><circle cx="36" cy="12" r="2" fill="#fde047"/><circle cx="12" cy="12" r="1.5" fill="#67e8f9"/></svg>`
  },
  {
    id: 'spell',
    singular: 'spell scroll',
    plural: 'spell scrolls',
    iconAsset: '/icons/magic-shop/spell.svg',
    accessibleLabel: 'price of one spell scroll',
    emojiFallback: '📜',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg spell-svg" aria-hidden="true" fill="none"><rect x="12" y="10" width="24" height="28" rx="2" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/><rect x="9" y="8" width="30" height="5" rx="2.5" fill="#92400e"/><rect x="9" y="35" width="30" height="5" rx="2.5" fill="#92400e"/><path d="M24 16 L29 23 L25 24 L28 30 L20 23 L24 22 Z" fill="#818cf8"/><line x1="12" y1="24" x2="36" y2="24" stroke="#e11d48" stroke-width="2.5" stroke-dasharray="4 2"/></svg>`
  },
  {
    id: 'crystal',
    singular: 'magic crystal',
    plural: 'magic crystals',
    iconAsset: '/icons/magic-shop/crystal.svg',
    accessibleLabel: 'price of one magic crystal',
    emojiFallback: '🔮',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg crystal-svg" aria-hidden="true" fill="none"><path d="M24 6 L38 18 L32 40 L16 40 L10 18 Z" fill="#6366f1" stroke="#818cf8" stroke-width="2"/><path d="M24 6 L32 40 M24 6 L16 40 M10 18 L38 18" stroke="#a5b4fc" stroke-width="1.5"/><circle cx="38" cy="10" r="1.5" fill="#f472b6"/></svg>`
  },
  {
    id: 'potion',
    singular: 'health potion',
    plural: 'health potions',
    iconAsset: '/icons/magic-shop/potion.svg',
    accessibleLabel: 'price of one health potion',
    emojiFallback: '🧪',
    svgContent: `<svg viewBox="0 0 48 48" class="magic-item-svg potion-svg" aria-hidden="true" fill="none"><rect x="21" y="8" width="6" height="6" rx="1" fill="#94a3b8" stroke="#cbd5e1" stroke-width="1.5"/><path d="M20 14 L12 36 C10 40, 14 42, 24 42 C34 42, 38 40, 36 36 L28 14 Z" fill="#ec4899" stroke="#f472b6" stroke-width="2"/><ellipse cx="24" cy="24" rx="8" ry="3" fill="#fbcfe8" opacity="0.6"/><circle cx="21" cy="32" r="2" fill="#ffffff" opacity="0.8"/><circle cx="27" cy="28" r="1.5" fill="#ffffff" opacity="0.8"/></svg>`
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
  if (puzzleId === 'curated-1' || puzzleId === 'tutorial-1') return MAGIC_ITEMS.find(m => m.id === 'wand')!;
  if (puzzleId === 'curated-2' || puzzleId === 'curated-x-minus-b') return MAGIC_ITEMS.find(m => m.id === 'broomstick')!;
  if (puzzleId === 'curated-3' || puzzleId === 'curated-ax') return MAGIC_ITEMS.find(m => m.id === 'cauldron')!;
  if (puzzleId === 'curated-4' || puzzleId === 'curated-chocolate' || puzzleId.includes('chocolate')) return MAGIC_ITEMS.find(m => m.id === 'chocolate')!;

  for (const item of MAGIC_ITEMS) {
    if (puzzleId.includes(item.id)) return item;
  }

  const index = hashString(puzzleId) % MAGIC_ITEMS.length;
  return MAGIC_ITEMS[index];
}
