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

export const CHARGE_REASONS = ['delivery', 'gift wrapping', 'packaging'] as const;
export type ChargeReason = typeof CHARGE_REASONS[number];

export function getChargeReason(equationId: string): ChargeReason {
  let hash = 0;
  for (let i = 0; i < equationId.length; i++) {
    hash = ((hash << 5) - hash + equationId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % CHARGE_REASONS.length;
  return CHARGE_REASONS[idx];
}

export function buildStoryBeats(equation: LinearEquationDef, item: MagicItem): {
  beats: StoryBeat[];
  shortQuestion: string;
  modifierType: 'extra_charge' | 'discount' | 'none';
  modifierAmount: number;
  modifierReason?: string;
} {
  const { family, a, b, c, id } = equation;
  const absB = Math.abs(b);
  const reason = getChargeReason(id);

  switch (family) {
    case 'x_plus_b':
      return {
        modifierType: 'extra_charge',
        modifierAmount: absB,
        modifierReason: reason,
        shortQuestion: `How much did the ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought a ${item.singular}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `There was a ${reason} fee of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did the ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };

    case 'x_minus_b':
      return {
        modifierType: 'discount',
        modifierAmount: absB,
        shortQuestion: `How much did the ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought a ${item.singular}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `I got a discount of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did the ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };

    case 'ax':
      return {
        modifierType: 'none',
        modifierAmount: 0,
        shortQuestion: `How much did each ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought ${a} ${item.plural}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did each ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };

    case 'ax_plus_b':
      return {
        modifierType: 'extra_charge',
        modifierAmount: absB,
        modifierReason: reason,
        shortQuestion: `How much did each ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought ${a} ${item.plural}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `There was a ${reason} fee of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did each ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };

    case 'ax_minus_b':
      return {
        modifierType: 'discount',
        modifierAmount: absB,
        shortQuestion: `How much did each ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought ${a} ${item.plural}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `I got a discount of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much did each ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };

    case 'x_div_d': {
      const d = equation.d || 4;
      return {
        modifierType: 'none',
        modifierAmount: 0,
        shortQuestion: `How much does a whole ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought 1/${d} of a ${item.singular}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much does a whole ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };
    }

    case 'x_div_d_plus_b': {
      const d = equation.d || 4;
      return {
        modifierType: 'extra_charge',
        modifierAmount: absB,
        modifierReason: reason,
        shortQuestion: `How much does a whole ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought 1/${d} of a ${item.singular}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `There was a ${reason} fee of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much does a whole ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };
    }

    case 'x_div_d_minus_b': {
      const d = equation.d || 4;
      return {
        modifierType: 'discount',
        modifierAmount: absB,
        shortQuestion: `How much does a whole ${item.singular} cost?`,
        beats: [
          { type: 'objects', text: `I bought 1/${d} of a ${item.singular}{{ITEM_ICON}}.`, highlightTarget: 'objects' },
          { type: 'modifier', text: `I got a discount of ${absB} gold.`, highlightTarget: 'modifier' },
          { type: 'total', text: `I paid ${c} gold.`, highlightTarget: 'total' },
          { type: 'question', text: `How much does a whole ${item.singular}{{ITEM_ICON}} cost?` }
        ]
      };
    }
  }
}

/**
 * Builds the completed purchase verification breakdown once solved.
 */
export function buildVerification(equation: LinearEquationDef, item: MagicItem, modifierReason?: string): VerificationData {
  const { a, b, c, solution, id, d, family } = equation;
  const absB = Math.abs(b);
  const reason = modifierReason || getChargeReason(id);
  const isDiv = family === 'x_div_d' || family === 'x_div_d_plus_b' || family === 'x_div_d_minus_b';
  const denom = d || 4;

  let unitPriceLine: string;
  let subtotalLine: string | undefined = undefined;
  let modifierLine: string | undefined = undefined;
  let numericCheckLine = '';

  if (isDiv) {
    unitPriceLine = `A whole ${item.singular} costs ${solution} gold.`;
    subtotalLine = `1/${denom} of ${solution} gold = ${Math.round(solution / denom)} gold.`;
    if (b > 0) {
      modifierLine = `${Math.round(solution / denom)} gold + ${absB} gold ${reason} = ${c} gold paid.`;
      numericCheckLine = `${solution} ÷ ${denom} + ${absB} = ${c}`;
    } else if (b < 0) {
      modifierLine = `${Math.round(solution / denom)} gold − ${absB} gold discount = ${c} gold paid.`;
      numericCheckLine = `${solution} ÷ ${denom} − ${absB} = ${c}`;
    } else {
      numericCheckLine = `${solution} ÷ ${denom} = ${c}`;
    }
  } else {
    unitPriceLine = a === 1
      ? `The ${item.singular} costs ${solution} gold.`
      : `Each ${item.singular} costs ${solution} gold.`;

    if (a > 1) {
      subtotalLine = `${a} ${item.plural} at ${solution} gold each = ${a * solution} gold.`;
    }

    if (b > 0) {
      modifierLine = `${a * solution} gold + ${absB} gold ${reason} = ${c} gold paid.`;
    } else if (b < 0) {
      modifierLine = `${a * solution} gold − ${absB} gold discount = ${c} gold paid.`;
    }

    if (a === 1) {
      if (b > 0) numericCheckLine = `${solution} + ${absB} = ${c}`;
      else if (b < 0) numericCheckLine = `${solution} − ${absB} = ${c}`;
      else numericCheckLine = `${solution} = ${c}`;
    } else {
      if (b > 0) numericCheckLine = `${a} × ${solution} + ${absB} = ${c}`;
      else if (b < 0) numericCheckLine = `${a} × ${solution} − ${absB} = ${c}`;
      else numericCheckLine = `${a} × ${solution} = ${c}`;
    }
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
  wrong_sign_charge: (absB: number, reason: string = 'delivery') => `The ${reason} fee of ${absB} gold adds money to the price, so we add (+).`,
  omit_coefficient: (a: number, plural: string) => `You bought ${a} ${plural}, so multiply the item price by ${a}.`,
  wrong_coefficient: (expectedA: number, chosenA: number, plural: string) => `You bought ${expectedA} ${plural}, not ${chosenA}.`,
  wrong_division: (denom: number) => `You bought 1/${denom} of the item, so divide the price by ${denom} (÷ ${denom}).`,
  wrong_total: (expectedC: number, chosenC: number) => `The story says you paid ${expectedC} gold altogether, not ${chosenC}.`,
  correct: () => 'Perfect! That matches the purchase situation.'
};
