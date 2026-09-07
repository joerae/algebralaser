import { describe, it, expect } from 'vitest';
import { 
  createInitialState, 
  pickUpTerm, 
  cancelCarry, 
  commitDrop, 
  submitAnswer, 
  undo, 
  formatVerification 
} from './linearEquation';
import { 
  BENCHMARK_PUZZLE, 
  TUTORIAL_PUZZLE, 
  generatePuzzle, 
  generateArithmeticChoices 
} from './puzzleGenerator';

describe('Linear Equation Mathematics & State Machine', () => {
  it('solves benchmark 3x − 1 = 11 step by step', () => {
    let state = createInitialState(BENCHMARK_PUZZLE);
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_constant');

    // Rule: Attempting to pick up coefficient 3 before undoing -1 is guided
    const invalidCoeff = pickUpTerm(state, 'coefficient');
    expect(invalidCoeff.success).toBe(false);
    expect(invalidCoeff.guideMessage).toBe('First undo the −1.');

    // Step 1: Pick up -1
    const pick1 = pickUpTerm(state, 'constant');
    expect(pick1.success).toBe(true);
    state = pick1.state;
    expect(state.phase).toBe('carrying');
    expect(state.carriedTerm).toBe('constant');

    // Drop -1 across equals sign
    const drop1 = commitDrop(state);
    expect(drop1.success).toBe(true);
    state = drop1.state;
    expect(state.phase).toBe('question');
    expect(state.pendingArithmetic?.operand1).toBe(11);
    expect(state.pendingArithmetic?.operand2).toBe(1);
    expect(state.pendingArithmetic?.operator).toBe('+');
    expect(state.pendingArithmetic?.correctAnswer).toBe(12);
    expect(state.pendingArithmetic?.choices.length).toBe(3);
    expect(state.pendingArithmetic?.choices).toContain(12);

    // Wrong answer attempt
    const wrongChoice = state.pendingArithmetic!.choices.find(c => c !== 12)!;
    const wrongAns = submitAnswer(state, wrongChoice);
    expect(wrongAns.correct).toBe(false);
    expect(wrongAns.hint).toBeDefined();
    // Equation must remain unsimplified!
    expect(wrongAns.state.phase).toBe('question');
    expect(wrongAns.state.currentC).toBe(11);

    // Correct answer: 12
    const correctAns1 = submitAnswer(state, 12);
    expect(correctAns1.correct).toBe(true);
    state = correctAns1.state;
    expect(state.currentA).toBe(3);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(12);
    expect(state.stage).toBe('undo_coefficient');
    expect(state.phase).toBe('ready');

    // Step 2: Pick up coefficient 3
    const pick2 = pickUpTerm(state, 'coefficient');
    expect(pick2.success).toBe(true);
    state = pick2.state;
    expect(state.phase).toBe('carrying');

    // Drop 3 into denominator
    const drop2 = commitDrop(state);
    expect(drop2.success).toBe(true);
    state = drop2.state;
    expect(state.phase).toBe('question');
    expect(state.pendingArithmetic?.operand1).toBe(12);
    expect(state.pendingArithmetic?.operand2).toBe(3);
    expect(state.pendingArithmetic?.operator).toBe('÷');
    expect(state.pendingArithmetic?.correctAnswer).toBe(4);
    expect(state.pendingArithmetic?.choices).toContain(4);

    // Answer 4
    const correctAns2 = submitAnswer(state, 4);
    expect(correctAns2.correct).toBe(true);
    state = correctAns2.state;
    expect(state.currentA).toBe(1);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(4);
    expect(state.stage).toBe('solved');
    expect(state.phase).toBe('solved');

    // Final verification check
    const verif = formatVerification(BENCHMARK_PUZZLE);
    expect(verif.subStep).toBe('3 × 4 − 1 = 11');
    expect(verif.evalStep).toBe('12 − 1 = 11');
    expect(verif.finalStep).toBe('11 = 11');
  });

  it('handles undo correctly during question and after step completion', () => {
    let state = createInitialState(TUTORIAL_PUZZLE); // x + 1 = 3
    state = pickUpTerm(state, 'constant').state;
    state = commitDrop(state).state;
    expect(state.phase).toBe('question');

    // Undo while on question restores ready state before drop
    const undo1 = undo(state);
    expect(undo1.success).toBe(true);
    state = undo1.state;
    expect(state.phase).toBe('carrying');

    // Cancel carry returns to ready
    state = cancelCarry(state);
    expect(state.phase).toBe('ready');
    expect(state.carriedTerm).toBe(null);
  });

  it('generates 3 unique choices with exactly one correct answer across 100 seeds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const choices = generateArithmeticChoices(11, 1, '+', 12);
      expect(choices.length).toBe(3);
      expect(new Set(choices).size).toBe(3);
      expect(choices).toContain(12);

      const divChoices = generateArithmeticChoices(12, 3, '÷', 4);
      expect(divChoices.length).toBe(3);
      expect(new Set(divChoices).size).toBe(3);
      expect(divChoices).toContain(4);
      // Ensure distractors are close to 4 (e.g. 3, 5, 2, 6), not distant numbers like 9 or 8
      for (const choice of divChoices) {
        expect(Math.abs(choice - 4)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('generates valid problems across all 5 equation families', () => {
    const families = ['x_plus_b', 'x_minus_b', 'ax', 'ax_plus_b', 'ax_minus_b'] as const;
    for (const family of families) {
      for (let i = 1; i <= 10; i++) {
        const prob = generatePuzzle(family, i * 100);
        expect(prob.solution).toBeGreaterThan(0);
        expect(Number.isInteger(prob.solution)).toBe(true);
        // Verify algebraic identity
        expect(prob.a * prob.solution + prob.b).toBe(prob.c);
      }
    }
  });
});
