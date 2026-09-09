import { LinearEquationDef } from '../math/types';
import { MagicItem } from '../data/magicItems';
import { ConcreteStory } from './types';
import { buildStoryBeats, buildVerification } from '../data/storyTemplates';

/**
 * Pure conversion from a LinearEquationDef and MagicItem to full ConcreteStory.
 * Preserves equation RNG and never mutates source problem.
 */
export function buildConcreteStory(
  equation: LinearEquationDef,
  item: MagicItem
): ConcreteStory {
  const { beats, shortQuestion, modifierType, modifierAmount } = buildStoryBeats(equation, item);
  const fullStoryText = beats.map(b => b.text).join(' ');
  const verification = buildVerification(equation, item);

  return {
    equation,
    item,
    beats,
    fullStoryText,
    shortQuestion,
    modifierType,
    modifierAmount,
    objectCount: equation.a,
    totalPaid: equation.c,
    verification
  };
}
