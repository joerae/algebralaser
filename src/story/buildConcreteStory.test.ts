import { describe, it, expect } from 'vitest';
import { buildConcreteStory } from './buildConcreteStory';
import { MAGIC_ITEMS, getMagicItemForPuzzle } from '../data/magicItems';
import { generateCuratedLevelSet, generatePuzzle } from '../math/puzzleGenerator';
import { EquationFamily, LinearEquationDef } from '../math/types';

describe('buildConcreteStory', () => {
  it('generates at most 4 sentences for all 5 families and 4 items', () => {
    const families: EquationFamily[] = ['x_plus_b', 'x_minus_b', 'ax', 'ax_plus_b', 'ax_minus_b'];

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
    expect(story.fullStoryText).toContain('extra charge of 5 gold');
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

  it('deterministically selects magic items for the curated level set', () => {
    const levels = generateCuratedLevelSet();
    const items = levels.map(lvl => getMagicItemForPuzzle(lvl.id));

    // Must be reproducible
    const itemsSecondPass = levels.map(lvl => getMagicItemForPuzzle(lvl.id));
    expect(items.map(i => i.id)).toEqual(itemsSecondPass.map(i => i.id));
  });
});
