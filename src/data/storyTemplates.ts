import { LinearEquationDef } from '../math/types';
import { MagicItem } from './magicItems';
import { StoryBeat, VerificationData } from '../story/types';

/**
 * Human-editable story templates and text builders for the 5 linear equation families.
 * 
 * Rules:
 * 1. At most 4 short sentences per story.
 * 2. Combine purchase and equal-price info into one sentence.
 * 3. Treat negative b as a positive discount.
 * 4. Never reveal the unknown price (solution) in the story or questions.
 */

export function buildStoryBeats(equation: LinearEquationDef, item: MagicItem): {
  beats: StoryBeat[];
  shortQuestion: string;
  modifierType: 'extra_charge' | 'discount' | 'none';
  modifierAmount: number;
} {
  const { family, a, b, c } = equation;
  const absB = Math.abs(b);

  switch (family) {
    case 'x_plus_b':
      return {
        modifierType: 'extra_charge',
        modifierAmount: absB,
        shortQuestion: `How much did the ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought a ${item.singular}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `There was an extra charge of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold altogether.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did the ${item.singular} cost before the extra charge?` }
        ]
      };

    case 'x_minus_b':
      return {
        modifierType: 'discount',
        modifierAmount: absB,
        shortQuestion: `How much did the ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought a ${item.singular}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `I got a discount of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold altogether.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did the ${item.singular} cost before the discount?` }
        ]
      };

    case 'ax':
      return {
        modifierType: 'none',
        modifierAmount: 0,
        shortQuestion: `How much did each ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought ${a} identical ${item.plural} for the same price each.`, highlightTarget: 'objects' },
          { type: 'total', text: `I paid ${c} gold altogether.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did each ${item.singular} cost?` }
        ]
      };

    case 'ax_plus_b':
      return {
        modifierType: 'extra_charge',
        modifierAmount: absB,
        shortQuestion: `How much did each ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought ${a} identical ${item.plural} for the same price each.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `There was an extra charge of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold altogether.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did each ${item.singular} cost before the extra charge?` }
        ]
      };

    case 'ax_minus_b':
      return {
        modifierType: 'discount',
        modifierAmount: absB,
        shortQuestion: `How much did each ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought ${a} identical ${item.plural} for the same price each.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `I got a discount of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold altogether.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did each ${item.singular} cost before the discount?` }
        ]
      };
  }
}

/**
 * Builds the completed purchase verification breakdown once solved.
 */
export function buildVerification(equation: LinearEquationDef, item: MagicItem): VerificationData {
  const { a, b, c, solution } = equation;
  const absB = Math.abs(b);

  const unitPriceLine = a === 1
    ? `The ${item.singular} costs ${solution} gold.`
    : `Each ${item.singular} costs ${solution} gold.`;

  const subtotalLine = a > 1
    ? `${a} ${item.plural} at ${solution} gold each = ${a * solution} gold.`
    : undefined;

  let modifierLine: string | undefined = undefined;
  if (b > 0) {
    modifierLine = `${a * solution} gold + ${absB} gold extra charge = ${c} gold paid.`;
  } else if (b < 0) {
    modifierLine = `${a * solution} gold − ${absB} gold discount = ${c} gold paid.`;
  }

  let numericCheckLine = '';
  if (a === 1) {
    if (b > 0) numericCheckLine = `${solution} + ${absB} = ${c}`;
    else if (b < 0) numericCheckLine = `${solution} − ${absB} = ${c}`;
    else numericCheckLine = `${solution} = ${c}`;
  } else {
    if (b > 0) numericCheckLine = `${a} × ${solution} + ${absB} = ${c}`;
    else if (b < 0) numericCheckLine = `${a} × ${solution} − ${absB} = ${c}`;
    else numericCheckLine = `${a} × ${solution} = ${c}`;
  }

  return {
    unitPriceLine,
    subtotalLine,
    modifierLine,
    numericCheckLine,
    solution
  };
}

/**
 * Targeted pedagogical feedback templates for wrong equation choices.
 */
export const FEEDBACK_TEMPLATES = {
  wrong_sign_discount: (absB: number) => `A discount of ${absB} gold takes money off the price, so we subtract (−).`,
  wrong_sign_charge: (absB: number) => `An extra charge of ${absB} gold adds money to the price, so we add (+).`,
  omit_coefficient: (a: number, plural: string) => `You bought ${a} ${plural}, so multiply the item price by ${a}.`,
  wrong_coefficient: (expectedA: number, chosenA: number, plural: string) => `You bought ${expectedA} ${plural}, not ${chosenA}.`,
  wrong_total: (expectedC: number, chosenC: number) => `The story says you paid ${expectedC} gold altogether, not ${chosenC}.`,
  correct: () => 'Perfect! That matches the purchase situation.'
};
