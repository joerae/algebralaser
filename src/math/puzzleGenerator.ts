import { LinearEquationDef, EquationFamily, PendingArithmetic } from './types';

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

export const TUTORIAL_PUZZLE: LinearEquationDef = {
  id: 'tutorial-1',
  family: 'x_plus_b',
  a: 1,
  b: 1,
  c: 3,
  solution: 2,
  description: 'Warm up: Get x on its own by undoing +1'
};

export const BENCHMARK_PUZZLE: LinearEquationDef = {
  id: 'benchmark-3x-minus-1',
  family: 'ax_minus_b',
  a: 3,
  b: -1,
  c: 11,
  solution: 4,
  description: 'The Classic: Solve 3x − 1 = 11'
};

export function generateArithmeticChoices(
  op1: number,
  op2: number,
  operator: '+' | '-' | '×' | '÷',
  correct: number,
  rng: () => number = Math.random
): number[] {
  const distractors = new Set<number>();
  
  // Plausible mistakes
  if (operator === '+') {
    // Subtraction instead
    const sub = op1 - op2;
    if (sub > 0 && sub !== correct) distractors.add(sub);
    // Off by one
    if (correct + 1 !== correct) distractors.add(correct + 1);
    if (correct - 1 > 0 && correct - 1 !== correct) distractors.add(correct - 1);
    // Off by two
    distractors.add(correct + 2);
  } else if (operator === '-') {
    // Addition instead
    const add = op1 + op2;
    if (add !== correct) distractors.add(add);
    if (correct + 1 !== correct) distractors.add(correct + 1);
    if (correct - 1 > 0 && correct - 1 !== correct) distractors.add(correct - 1);
  } else if (operator === '÷') {
    // Subtraction instead of division (e.g. 12 - 3 = 9 instead of 12 / 3 = 4)
    const sub = op1 - op2;
    if (sub > 0 && sub !== correct) distractors.add(sub);
    // Inverse factor or nearby factor
    if (op2 !== correct && op2 > 0) distractors.add(op2);
    if (correct + 1 !== correct) distractors.add(correct + 1);
    if (correct - 1 > 0 && correct - 1 !== correct) distractors.add(correct - 1);
    if (correct * 2 !== correct) distractors.add(correct * 2);
  } else if (operator === '×') {
    // Addition instead
    distractors.add(op1 + op2);
    distractors.add(correct + op2);
    if (correct - op2 > 0) distractors.add(correct - op2);
  }

  // Ensure we have at least 2 distinct distractors
  let offset = 1;
  while (distractors.size < 2) {
    const cand1 = correct + offset;
    if (cand1 !== correct && cand1 > 0) distractors.add(cand1);
    const cand2 = correct - offset;
    if (cand2 !== correct && cand2 > 0) distractors.add(cand2);
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
  operator: '+' | '-' | '×' | '÷',
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
  }

  return {
    id: `generated-${family}-${idSuffix}`,
    family,
    a,
    b,
    c,
    solution,
    description: `Solve ${formatEquationString(a, b, c)}`
  };
}

export function formatEquationString(a: number, b: number, c: number): string {
  let left = '';
  if (a === 1) {
    left = 'x';
  } else {
    left = `${a}x`;
  }

  if (b > 0) {
    left += ` + ${b}`;
  } else if (b < 0) {
    left += ` − ${Math.abs(b)}`;
  }

  return `${left} = ${c}`;
}

export function generateCuratedLevelSet(): LinearEquationDef[] {
  return [
    TUTORIAL_PUZZLE,
    BENCHMARK_PUZZLE,
    generatePuzzle('x_minus_b', 101, '3'),
    generatePuzzle('ax', 202, '4'),
    generatePuzzle('ax_plus_b', 303, '5'),
  ];
}
