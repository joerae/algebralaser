import { LinearEquationDef } from '../math/types';
import { MagicItem, hashString } from '../data/magicItems';
import { EquationCandidate } from './types';
import { FEEDBACK_TEMPLATES, getChargeReason } from '../data/storyTemplates';

interface RawCandidate {
  a: number;
  b: number;
  c: number;
  d?: number;
  isCorrect: boolean;
  misconception: EquationCandidate['misconception'];
  feedback: string;
  highlightTarget: 'objects' | 'modifier' | 'total' | null;
}

/**
 * Creates 4 deterministic equation candidates for a concrete story.
 * Includes 1 correct choice and 3 distinct pedagogical misconceptions.
 */
export function generateEquationChoices(
  equation: LinearEquationDef,
  item: MagicItem
): EquationCandidate[] {
  const { a, b, c, solution, d, family } = equation;
  const absB = Math.abs(b);
  const isDivision = family === 'x_div_d' || family === 'x_div_d_plus_b' || family === 'x_div_d_minus_b';
  const denom = d || 4;

  const rawCandidates: RawCandidate[] = [];

  // 1. Always include the correct candidate
  rawCandidates.push({
    a: isDivision ? 1 : a,
    b,
    c,
    d: isDivision ? denom : undefined,
    isCorrect: true,
    misconception: 'correct',
    feedback: FEEDBACK_TEMPLATES.correct(),
    highlightTarget: null
  });

  if (isDivision) {
    // Distractor 1: Multiplies by denom instead of dividing (e.g. 4 × [item] = c)
    rawCandidates.push({
      a: denom,
      b,
      c,
      d: undefined,
      isCorrect: false,
      misconception: 'wrong_division',
      feedback: FEEDBACK_TEMPLATES.wrong_division(denom),
      highlightTarget: 'objects'
    });

    // Distractor 2: Wrong sign (if b !== 0)
    if (b !== 0) {
      const wrongB = -b;
      const isDiscount = b < 0;
      rawCandidates.push({
        a: 1,
        b: wrongB,
        c,
        d: denom,
        isCorrect: false,
        misconception: 'wrong_sign',
        feedback: isDiscount
          ? FEEDBACK_TEMPLATES.wrong_sign_discount(absB)
          : FEEDBACK_TEMPLATES.wrong_sign_charge(absB, getChargeReason(equation.id)),
        highlightTarget: 'modifier'
      });
    }

    // Distractor 3: Alternative denominators (e.g. denom + 1, denom - 1, denom + 2)
    const denomDeltas = [1, -1, 2, 3];
    for (const dd of denomDeltas) {
      const altD = denom + dd;
      if (altD >= 2 && altD !== denom) {
        rawCandidates.push({
          a: 1,
          b,
          c,
          d: altD,
          isCorrect: false,
          misconception: 'wrong_division',
          feedback: FEEDBACK_TEMPLATES.wrong_division(denom),
          highlightTarget: 'objects'
        });
      }
    }

    // Distractor 4: Wrong operation (adding the denominator instead of dividing)
    rawCandidates.push({
      a: 1,
      b: denom,
      c,
      d: undefined,
      isCorrect: false,
      misconception: 'wrong_operation',
      feedback: `The story bought 1/${denom} of the item, which divides the price by ${denom} (÷ ${denom}), not adding ${denom}.`,
      highlightTarget: 'objects'
    });

    // Distractor 5: Wrong total
    const totalDeltas = [1, -1, 2, -2, 3, -3, 4];
    for (const delta of totalDeltas) {
      const wrongC = c + delta;
      if (wrongC > 0 && wrongC !== c) {
        rawCandidates.push({
          a: 1,
          b,
          c: wrongC,
          d: denom,
          isCorrect: false,
          misconception: 'wrong_total',
          feedback: FEEDBACK_TEMPLATES.wrong_total(c, wrongC),
          highlightTarget: 'total'
        });
      }
    }
  } else {
    // Candidate pool based on standard equation families:
    // Distractor 1: Wrong sign (if b !== 0)
    if (b !== 0) {
      const wrongB = -b;
      const isDiscount = b < 0;
      rawCandidates.push({
        a,
        b: wrongB,
        c,
        isCorrect: false,
        misconception: 'wrong_sign',
        feedback: isDiscount 
          ? FEEDBACK_TEMPLATES.wrong_sign_discount(absB)
          : FEEDBACK_TEMPLATES.wrong_sign_charge(absB, getChargeReason(equation.id)),
        highlightTarget: 'modifier'
      });
    }

    // Distractor 2: Omit coefficient (if a > 1) or wrong coefficient (if a === 1)
    if (a > 1) {
      rawCandidates.push({
        a: 1,
        b,
        c,
        isCorrect: false,
        misconception: 'omit_coefficient',
        feedback: FEEDBACK_TEMPLATES.omit_coefficient(a, item.plural),
        highlightTarget: 'objects'
      });
    } else {
      // a === 1: provide a distractor that adds an incorrect quantity (e.g. 2)
      rawCandidates.push({
        a: 2,
        b,
        c,
        isCorrect: false,
        misconception: 'wrong_coefficient',
        feedback: FEEDBACK_TEMPLATES.wrong_coefficient(a, 2, item.plural),
        highlightTarget: 'objects'
      });
    }

    // Distractor 3: Wrong total (c +/- 1 or c +/- 2, keeping c > 0)
    const totalDeltas = [1, -1, 2, -2, 3, -3];
    for (const delta of totalDeltas) {
      const wrongC = c + delta;
      if (wrongC > 0 && wrongC !== c) {
        rawCandidates.push({
          a,
          b,
          c: wrongC,
          isCorrect: false,
          misconception: 'wrong_total',
          feedback: FEEDBACK_TEMPLATES.wrong_total(c, wrongC),
          highlightTarget: 'total'
        });
        break;
      }
    }

    // Distractor 4 & backups: alternative coefficients (a + 1 or a - 1)
    const coeffDeltas = [1, -1, 2];
    for (const cd of coeffDeltas) {
      const candA = a + cd;
      if (candA > 0 && candA !== a) {
        rawCandidates.push({
          a: candA,
          b,
          c,
          isCorrect: false,
          misconception: 'wrong_coefficient',
          feedback: FEEDBACK_TEMPLATES.wrong_coefficient(a, candA, item.plural),
          highlightTarget: 'objects'
        });
      }
    }

    // Additional wrong total fallbacks
    for (const delta of [4, -4, 5]) {
      const wrongC = c + delta;
      if (wrongC > 0 && wrongC !== c) {
        rawCandidates.push({
          a,
          b,
          c: wrongC,
          isCorrect: false,
          misconception: 'wrong_total',
          feedback: FEEDBACK_TEMPLATES.wrong_total(c, wrongC),
          highlightTarget: 'total'
        });
      }
    }
  }

  // Filter candidates:
  // 1. Exactly 1 correct choice.
  // 2. Reject any distractor satisfied by the original solution.
  // 3. Reject duplicate canonical representations.
  // 4. Must have positive coefficient/denominator and positive total.
  const seenCanonical = new Set<string>();
  const validCandidates: RawCandidate[] = [];

  // Insert correct first
  const correct = rawCandidates.find(c => c.isCorrect)!;
  validCandidates.push(correct);
  seenCanonical.add(`${correct.a}:${correct.d || ''}:${correct.b}:${correct.c}`);

  for (const cand of rawCandidates) {
    if (cand.isCorrect) continue;
    if (validCandidates.length >= 3) break;

    const key = `${cand.a}:${cand.d || ''}:${cand.b}:${cand.c}`;
    if (seenCanonical.has(key)) continue;

    // Critical check: does this distractor happen to evaluate to the actual solution?
    const evalTotal = cand.d && cand.d > 0
      ? (solution / cand.d) + cand.b
      : (cand.a * solution) + cand.b;

    if (evalTotal === cand.c) {
      continue; // reject!
    }

    if (cand.a < 1 || cand.c <= 0) continue;

    seenCanonical.add(key);
    validCandidates.push(cand);
  }

  // Deterministic seeded shuffle
  const seed = hashString(`${equation.id}:story-choices:v2`);
  const shuffled = deterministicShuffle(validCandidates, seed);

  // Assign stable IDs
  return shuffled.map((cand, index) => ({
    id: `story-choice-${index}`,
    a: cand.a,
    b: cand.b,
    c: cand.c,
    d: cand.d,
    isCorrect: cand.isCorrect,
    misconception: cand.misconception,
    feedback: cand.feedback,
    highlightTarget: cand.highlightTarget
  }));
}

function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let s = seed >>> 0;

  // LCG pseudo-random step
  const nextRand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
