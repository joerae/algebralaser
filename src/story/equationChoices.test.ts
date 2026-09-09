import { describe, it, expect } from 'vitest';
import { generateEquationChoices } from './equationChoices';
import { MAGIC_ITEMS } from '../data/magicItems';
import { generatePuzzle, generateCuratedLevelSet } from '../math/puzzleGenerator';
import { EquationFamily } from '../math/types';

describe('equationChoices', () => {
  it('generates exactly 3 choices with exactly 1 correct choice', () => {
    const levels = generateCuratedLevelSet();

    for (const lvl of levels) {
      const item = MAGIC_ITEMS[0];
      const choices = generateEquationChoices(lvl, item);

      expect(choices).toHaveLength(3);
      const correctChoices = choices.filter(c => c.isCorrect);
      expect(correctChoices).toHaveLength(1);

      // Verify the correct choice matches the actual equation values
      const correct = correctChoices[0];
      expect(correct.a).toBe(lvl.a);
      expect(correct.b).toBe(lvl.b);
      expect(correct.c).toBe(lvl.c);
    }
  });

  it('ensures no incorrect candidate is mathematically satisfied by the original solution', () => {
    const families: EquationFamily[] = ['x_plus_b', 'x_minus_b', 'ax', 'ax_plus_b', 'ax_minus_b'];

    for (const family of families) {
      for (let seed = 1; seed <= 15; seed++) {
        const puzzle = generatePuzzle(family, seed * 17);
        const item = MAGIC_ITEMS[seed % MAGIC_ITEMS.length];
        const choices = generateEquationChoices(puzzle, item);

        expect(choices).toHaveLength(3);

        for (const choice of choices) {
          if (!choice.isCorrect) {
            // Must NOT evaluate to true for the correct solution!
            const evalResult = choice.a * puzzle.solution + choice.b;
            expect(evalResult).not.toBe(choice.c);
          }
        }
      }
    }
  });

  it('produces unique expressions with positive coefficients and totals', () => {
    const families: EquationFamily[] = ['x_plus_b', 'x_minus_b', 'ax', 'ax_plus_b', 'ax_minus_b'];

    for (const family of families) {
      const puzzle = generatePuzzle(family, 77);
      const choices = generateEquationChoices(puzzle, MAGIC_ITEMS[1]);

      const keys = choices.map(c => `${c.a}:${c.b}:${c.c}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(3);

      for (const c of choices) {
        expect(c.a).toBeGreaterThanOrEqual(1);
        expect(c.c).toBeGreaterThan(0);
      }
    }
  });

  it('assigns stable sequential IDs story-choice-0 to story-choice-2', () => {
    const puzzle = generatePuzzle('ax_minus_b', 99);
    const choices = generateEquationChoices(puzzle, MAGIC_ITEMS[0]);

    expect(choices.map(c => c.id)).toEqual([
      'story-choice-0',
      'story-choice-1',
      'story-choice-2'
    ]);
  });
});
