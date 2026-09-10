import { LinearEquationDef, EquationFamily, PendingArithmetic, OperationSign } from './types';

// Simple mulberry32 seeded PRNG
export function createRng(seed: number) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray<T>(array: T[], rng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const PURE_PLUS_PUZZLE: LinearEquationDef = {
  id: 'curated-1',
  family: 'x_plus_b',
  a: 1,
  b: 3,
  c: 8,
  solution: 5,
  description: 'Pure Addition: Solve Y + 3 = 8'
};

export const TUTORIAL_PUZZLE: LinearEquationDef = {
  id: 'tutorial-1',
  family: 'x_plus_b',
  a: 1,
  b: 1,
  c: 3,
  solution: 2,
  description: 'Warm up: Get Y on its own by undoing +1'
};

export const PURE_MINUS_PUZZLE: LinearEquationDef = {
  id: 'curated-2',
  family: 'x_minus_b',
  a: 1,
  b: -4,
  c: 6,
  solution: 10,
  description: 'Pure Subtraction: Solve Y − 4 = 6'
};

export const PURE_TIMES_PUZZLE: LinearEquationDef = {
  id: 'curated-3',
  family: 'ax',
  a: 3,
  b: 0,
  c: 15,
  solution: 5,
  description: 'Pure Multiplication: Solve 3 x Y = 15'
};

export const PURE_DIVIDE_PUZZLE: LinearEquationDef = {
  id: 'curated-4',
  family: 'x_div_d',
  a: 1,
  d: 4,
  b: 0,
  c: 7,
  solution: 28,
  description: 'Pure Division: Solve Y ÷ 4 = 7'
};

// Kept for legacy backward compatibility in tests
export const BENCHMARK_PUZZLE: LinearEquationDef = {
  id: 'benchmark-3x-minus-1',
  family: 'ax_minus_b',
  a: 3,
  b: -1,
  c: 11,
  solution: 4,
  description: 'The Classic: Solve 3 x Y − 1 = 11'
};

export function generateArithmeticChoices(
  _op1: number,
  _op2: number,
  _operator: OperationSign,
  correct: number,
  rng: () => number = Math.random
): number[] {
  const distractors = new Set<number>();

  // Candidates close to correct answer (e.g. +/- 1, +/- 2, +/- 3)
  const deltas = [-1, 1, -2, 2, -3, 3];
  const shuffledDeltas = shuffleArray(deltas, rng);

  for (const delta of shuffledDeltas) {
    const cand = correct + delta;
    if (cand > 0 && cand !== correct) {
      distractors.add(cand);
      if (distractors.size >= 4) break;
    }
  }

  // Ensure we have at least 2 distinct positive distractors
  let offset = 4;
  while (distractors.size < 2) {
    if (correct + offset > 0) distractors.add(correct + offset);
    if (distractors.size < 2 && correct - offset > 0) distractors.add(correct - offset);
    offset++;
  }

  // Pick 2 distractors
  const distractorList = Array.from(distractors).filter(d => d !== correct);
  const picked = shuffleArray(distractorList, rng).slice(0, 2);

  return shuffleArray([correct, picked[0], picked[1]], rng);
}

export function createPendingArithmetic(
  op1: number,
  op2: number,
  operator: OperationSign,
  rng: () => number = Math.random
): PendingArithmetic {
  let correct: number;
  let explanation = '';
  let wrongHint = '';

  switch (operator) {
    case '+':
      correct = op1 + op2;
      explanation = `${op1} + ${op2} = ${correct}`;
      wrongHint = `We added ${op2}. Start at ${op1} and count up ${op2}.`;
      break;
    case '-':
    case '−':
      correct = op1 - op2;
      explanation = `${op1} − ${op2} = ${correct}`;
      wrongHint = `We subtracted ${op2}. Take ${op2} away from ${op1}.`;
      break;
    case '÷':
      correct = Math.round(op1 / op2);
      explanation = `${op1} ÷ ${op2} = ${correct}`;
      wrongHint = `How many times does ${op2} go into ${op1}?`;
      break;
    case '×':
      correct = op1 * op2;
      explanation = `${op1} × ${op2} = ${correct}`;
      wrongHint = `Multiply ${op1} by ${op2}.`;
      break;
  }

  const choices = generateArithmeticChoices(op1, op2, operator, correct, rng);

  return {
    operand1: op1,
    operand2: op2,
    operator,
    correctAnswer: correct,
    choices,
    explanation,
    wrongHint
  };
}

export function generatePuzzle(
  family: EquationFamily,
  seed: number,
  idSuffix: string = '1'
): LinearEquationDef {
  const rng = createRng(seed);

  let a = 1;
  let b = 0;
  let d: number | undefined = undefined;
  let solution = 1;
  let c = 1;

  switch (family) {
    case 'x_plus_b': {
      a = 1;
      b = Math.floor(rng() * 10) + 1; // 1 to 10
      solution = Math.floor(rng() * 12) + 1; // 1 to 12
      c = solution + b;
      break;
    }
    case 'x_minus_b': {
      a = 1;
      b = -(Math.floor(rng() * 9) + 1); // -1 to -9
      solution = Math.floor(rng() * 10) + 2; // 2 to 11
      c = solution + b;
      if (c <= 0) {
        solution = Math.abs(b) + Math.floor(rng() * 6) + 1;
        c = solution + b;
      }
      break;
    }
    case 'ax': {
      a = Math.floor(rng() * 6) + 2; // 2 to 7
      b = 0;
      solution = Math.floor(rng() * 9) + 1; // 1 to 9
      c = a * solution;
      break;
    }
    case 'ax_plus_b': {
      a = Math.floor(rng() * 5) + 2; // 2 to 6
      solution = Math.floor(rng() * 8) + 1; // 1 to 8
      b = Math.floor(rng() * 8) + 1; // 1 to 8
      c = a * solution + b;
      break;
    }
    case 'ax_minus_b': {
      a = Math.floor(rng() * 5) + 2; // 2 to 6
      solution = Math.floor(rng() * 8) + 2; // 2 to 9
      b = -(Math.floor(rng() * 8) + 1); // -1 to -8
      c = a * solution + b;
      if (c <= 0) {
        solution = Math.floor(rng() * 5) + 3;
        b = -(Math.floor(rng() * (a * solution - 1)) + 1);
        c = a * solution + b;
      }
      break;
    }
    case 'x_div_d': {
      a = 1;
      d = Math.floor(rng() * 4) + 2; // 2 to 5
      c = Math.floor(rng() * 8) + 2; // 2 to 9
      b = 0;
      solution = c * d;
      break;
    }
    case 'x_div_d_plus_b': {
      a = 1;
      d = Math.floor(rng() * 3) + 2; // 2 to 4
      const part = Math.floor(rng() * 6) + 2; // 2 to 7
      b = Math.floor(rng() * 6) + 1; // 1 to 6
      c = part + b;
      solution = part * d;
      break;
    }
    case 'x_div_d_minus_b': {
      a = 1;
      d = Math.floor(rng() * 3) + 2; // 2 to 4
      const absB = Math.floor(rng() * 5) + 1; // 1 to 5
      b = -absB;
      c = Math.floor(rng() * 6) + 2; // 2 to 7 (always positive!)
      const part = c + absB;
      solution = part * d;
      break;
    }
  }

  return {
    id: `generated-${family}-${idSuffix}`,
    family,
    a,
    b,
    c,
    d,
    solution,
    description: `Solve ${formatEquationString(a, b, c, d)}`
  };
}

export function formatEquationString(a: number, b: number, c: number, d?: number): string {
  let left = '';
  if (d && d > 1) {
    left = `Y ÷ ${d}`;
  } else if (a === 1) {
    left = 'Y';
  } else {
    left = `${a} x Y`;
  }

  if (b > 0) {
    left += ` + ${b}`;
  } else if (b < 0) {
    left += ` − ${Math.abs(b)}`;
  }

  return `${left} = ${c}`;
}

export const ALL_EQUATION_FAMILIES: EquationFamily[] = [
  'x_plus_b',
  'x_minus_b',
  'ax',
  'ax_plus_b',
  'ax_minus_b',
  'x_div_d',
  'x_div_d_plus_b',
  'x_div_d_minus_b'
];

export function generateRandomPuzzle(levelNumber: number, rngSeed?: number): LinearEquationDef {
  const seed = rngSeed !== undefined ? rngSeed : Date.now() + levelNumber * 10007;
  const rng = createRng(seed);
  const familyIdx = Math.floor(rng() * ALL_EQUATION_FAMILIES.length);
  const family = ALL_EQUATION_FAMILIES[familyIdx];
  return generatePuzzle(family, seed, `${levelNumber}`);
}

export function generateCuratedLevelSet(): LinearEquationDef[] {
  return [
    PURE_PLUS_PUZZLE,
    PURE_MINUS_PUZZLE,
    PURE_TIMES_PUZZLE,
    PURE_DIVIDE_PUZZLE
  ];
}
