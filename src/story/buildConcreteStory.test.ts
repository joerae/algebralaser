import { describe, it, expect } from 'vitest';
import { buildConcreteStory } from './buildConcreteStory';
import { MAGIC_ITEMS, getMagicItemForPuzzle } from '../data/magicItems';
import { generateCuratedLevelSet, generatePuzzle } from '../math/puzzleGenerator';
import { EquationFamily, LinearEquationDef } from '../math/types';

describe('buildConcreteStory', () => {
  it('generates at most 4 sentences for all 8 families and all magic items', () => {
    const families: EquationFamily[] = [
      'x_plus_b', 'x_minus_b', 'ax', 'ax_plus_b', 'ax_minus_b',
      'x_div_d', 'x_div_d_plus_b', 'x_div_d_minus_b'
    ];

    for (const family of families) {
      const puzzle = generatePuzzle(family, 42);
      for (const item of MAGIC_ITEMS) {
        const story = buildConcreteStory(puzzle, item);
        expect(story.beats.length).toBeLessThanOrEqual(4);
        expect(story.beats.length).toBeGreaterThanOrEqual(3);

        // Does not leak the unknown price/solution in story text
        expect(story.fullStoryText).not.toContain(`costs ${puzzle.solution}`);
        expect(story.fullStoryText).not.toContain(`cost ${puzzle.solution} gold`);
        expect(story.fullStoryText).not.toContain(`${puzzle.solution} gold each`);
      }
    }
  });

  it('treats negative b as positive discount amount', () => {
    const puzzle: LinearEquationDef = {
      id: 'test-discount',
      family: 'ax_minus_b',
      a: 3,
      b: -2,
      c: 10,
      solution: 4
    };
    const item = MAGIC_ITEMS[0]; // wand
    const story = buildConcreteStory(puzzle, item);

    expect(story.modifierType).toBe('discount');
    expect(story.modifierAmount).toBe(2);
    expect(story.fullStoryText).toContain('discount of 2 gold');
    expect(story.fullStoryText).not.toContain('-2');
    expect(story.fullStoryText).not.toContain('−2');
  });

  it('treats positive b as extra charge amount', () => {
    const puzzle: LinearEquationDef = {
      id: 'test-charge',
      family: 'x_plus_b',
      a: 1,
      b: 5,
      c: 12,
      solution: 7
    };
    const item = MAGIC_ITEMS[2]; // cauldron
    const story = buildConcreteStory(puzzle, item);

    expect(story.modifierType).toBe('extra_charge');
    expect(story.modifierAmount).toBe(5);
    expect(story.modifierReason).toBeDefined();
    expect(story.fullStoryText).toContain(`${story.modifierReason} fee of 5 gold`);
  });

  it('generates division fraction story for magical chocolate', () => {
    const puzzle: LinearEquationDef = {
      id: 'curated-4',
      family: 'x_div_d',
      a: 1,
      d: 4,
      b: 0,
      c: 7,
      solution: 28
    };
    const item = MAGIC_ITEMS.find(m => m.id === 'chocolate')!;
    const story = buildConcreteStory(puzzle, item);

    expect(story.fullStoryText).toContain('1/4 of a block of magical chocolate');
    expect(story.fullStoryText).toContain('paid 7 gold');
    expect(story.shortQuestion).toBe('How much does a whole block of magical chocolate cost?');
    expect(story.verification.numericCheckLine).toBe('28 ÷ 4 = 7');
  });

  it('produces accurate verification lines on solve', () => {
    const puzzle: LinearEquationDef = {
      id: 'benchmark-3x-minus-1',
      family: 'ax_minus_b',
      a: 3,
      b: -1,
      c: 11,
      solution: 4
    };
    const item = MAGIC_ITEMS[0]; // wand
    const story = buildConcreteStory(puzzle, item);

    expect(story.verification.unitPriceLine).toBe('Each wand costs 4 gold.');
    expect(story.verification.subtotalLine).toBe('3 wands at 4 gold each = 12 gold.');
    expect(story.verification.modifierLine).toBe('12 gold − 1 gold discount = 11 gold paid.');
    expect(story.verification.numericCheckLine).toBe('3 × 4 − 1 = 11');
  });

  it('deterministically maps the 4 curated pure levels to wand, broomstick, cauldron, chocolate', () => {
    const levels = generateCuratedLevelSet();
    expect(levels.length).toBe(4);
    const items = levels.map(lvl => getMagicItemForPuzzle(lvl.id));

    expect(items.map(i => i.id)).toEqual(['wand', 'broomstick', 'cauldron', 'chocolate']);
  });
});
