import { describe, it, expect } from 'vitest';
import { 
  createInitialState, 
  pickUpTerm, 
  cancelCarry, 
  commitDrop, 
  submitAnswer, 
  undo, 
  formatVerification,
  formatEquationLine,
  forgeOpposite,
  applyToBothSides,
  cancelLhsInverse,
  revealModeBBalanceSide,
  finishModeBBalance,
  activateModeBRhsCalculation,
  equipBlaster,
  blastLhs,
  blastRhs,
  blastSimplify,
  identifyModeDTarget,
  selectModeDInverse,
  blastModeDSide,
  activateModeDSimplify
} from './linearEquation';
import { 
  BENCHMARK_PUZZLE, 
  TUTORIAL_PUZZLE, 
  generatePuzzle, 
  generateArithmeticChoices 
} from './puzzleGenerator';

describe('Linear Equation Mathematics & State Machine', () => {
  it('solves benchmark 3 x Y − 1 = 11 step by step and tracks equationHistory (Mode A)', () => {
    let state = createInitialState(BENCHMARK_PUZZLE, 'mode_a');
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_constant');
    expect(state.equationHistory).toEqual([]);

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
    expect(state.equationHistory).toEqual(['3 x Y − 1 = 11']);

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
    expect(state.equationHistory).toEqual(['3 x Y − 1 = 11', '3 x Y = 12']);

    // Final verification check
    const verif = formatVerification(BENCHMARK_PUZZLE);
    expect(verif.subStep).toBe('3 x 4 − 1 = 11');
    expect(verif.evalStep).toBe('12 − 1 = 11');
    expect(verif.finalStep).toBe('11 = 11');
  });

  it('handles undo correctly during question and after step completion', () => {
    let state = createInitialState(TUTORIAL_PUZZLE, 'mode_a'); // Y + 1 = 3
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

    // Complete step 1
    state = pickUpTerm(state, 'constant').state;
    state = commitDrop(state).state;
    state = submitAnswer(state, 2).state;
    expect(state.phase).toBe('solved');
    expect(state.equationHistory).toEqual(['Y + 1 = 3']);

    // Undo from solved step restores previous state and equationHistory
    const undoSolved = undo(state);
    expect(undoSolved.success).toBe(true);
    expect(undoSolved.state.phase).toBe('question');
    expect(undoSolved.state.equationHistory).toEqual([]);
  });

  it('formats equation lines correctly with Y and a x Y format', () => {
    expect(formatEquationLine(1, 1, 3)).toBe('Y + 1 = 3');
    expect(formatEquationLine(1, -4, 5)).toBe('Y − 4 = 5');
    expect(formatEquationLine(3, 0, 12)).toBe('3 x Y = 12');
    expect(formatEquationLine(3, -1, 11)).toBe('3 x Y − 1 = 11');
    expect(formatEquationLine(4, 2, 10)).toBe('4 x Y + 2 = 10');
    expect(formatEquationLine(1, 0, 7)).toBe('Y = 7');
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

  it('solves Mode B: Balance Both Sides step by step through forging and applying', () => {
    let state = createInitialState(BENCHMARK_PUZZLE, 'mode_b');
    expect(state.mode).toBe('mode_b');
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_constant');

    // Attempting to select coefficient 3 while -1 is present gives NOT YET
    const invalidCoeff = pickUpTerm(state, 'coefficient');
    expect(invalidCoeff.success).toBe(false);
    expect(invalidCoeff.notYet).toBe(true);
    expect(invalidCoeff.guideMessage).toContain('NOT YET');

    // Step 1: Select -1 to undo
    const pick1 = pickUpTerm(state, 'constant');
    expect(pick1.success).toBe(true);
    state = pick1.state;
    expect(state.phase).toBe('forging');
    expect(state.carriedTerm).toBe('constant');

    // Step 2: Forge opposite - incorrect signs fail without resetting
    const wrongMinus = forgeOpposite(state, '−');
    expect(wrongMinus.correct).toBe(false);
    const wrongTimes = forgeOpposite(state, '×');
    expect(wrongTimes.correct).toBe(false);
    const wrongDiv = forgeOpposite(state, '÷');
    expect(wrongDiv.correct).toBe(false);
    expect(state.phase).toBe('forging');

    // Correct sign '+' for '-1'
    const forgePlus = forgeOpposite(state, '+');
    expect(forgePlus.correct).toBe(true);
    state = forgePlus.state;
    expect(state.phase).toBe('applying');
    expect(state.forgedOperation).toEqual({
      originalOperator: '-',
      originalOperand: 1,
      forgedOperator: '+',
      forgedOperand: 1
    });

    // Step 3: Apply to both sides
    const applied1 = applyToBothSides(state);
    expect(applied1.success).toBe(true);
    state = applied1.state;
    expect(state.phase).toBe('balancing');
    expect(state.balancedDisplay?.fullBalancedLine).toBe('3 x Y − 1 + 1 = 11 + 1');
    expect(state.equationHistory).toEqual(['3 x Y − 1 = 11']);

    expect(state.balancedDisplay?.lhsApplied).toBe(false);
    expect(state.balancedDisplay?.rhsApplied).toBe(false);

    // The power-up reveals one side at a time and cannot finish early.
    state = revealModeBBalanceSide(state, 'lhs');
    expect(state.balancedDisplay?.lhsApplied).toBe(true);
    expect(state.balancedDisplay?.rhsApplied).toBe(false);
    expect(finishModeBBalance(state).phase).toBe('balancing');
    state = revealModeBBalanceSide(state, 'rhs');
    state = finishModeBBalance(state);
    expect(state.phase).toBe('awaiting_cleanup');

    // Step 4: Blast away the LHS identity; RHS calculation remains available.
    state = cancelLhsInverse(state);
    expect(state.phase).toBe('awaiting_cleanup');
    expect(state.balancedDisplay?.lhsCleaned).toBe(true);
    expect(state.pendingArithmetic?.operand1).toBe(11);
    expect(state.pendingArithmetic?.operand2).toBe(1);
    expect(state.pendingArithmetic?.operator).toBe('+');
    expect(state.pendingArithmetic?.correctAnswer).toBe(12);

    state = activateModeBRhsCalculation(state);
    expect(state.balancedDisplay?.rhsActivated).toBe(true);

    // Answer 12
    const ans1 = submitAnswer(state, 12);
    expect(ans1.correct).toBe(true);
    state = ans1.state;
    expect(state.currentA).toBe(3);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(12);
    expect(state.stage).toBe('undo_coefficient');
    expect(state.phase).toBe('ready');
    expect(state.equationHistory).toEqual(['3 x Y − 1 = 11', '3 x Y = 11 + 1']);

    // Step 5: Repeat for ×3
    const pick2 = pickUpTerm(state, 'coefficient');
    expect(pick2.success).toBe(true);
    state = pick2.state;
    expect(state.phase).toBe('forging');

    // Forge ÷ for ×3
    const forgeDiv = forgeOpposite(state, '÷');
    expect(forgeDiv.correct).toBe(true);
    state = forgeDiv.state;
    expect(state.phase).toBe('applying');
    expect(state.forgedOperation?.forgedOperator).toBe('÷');

    // Apply to both sides
    const applied2 = applyToBothSides(state);
    expect(applied2.success).toBe(true);
    state = applied2.state;
    expect(state.phase).toBe('balancing');
    expect(state.equationHistory).toEqual(['3 x Y − 1 = 11', '3 x Y = 11 + 1', '3 x Y = 12']);

    // Reveal both applications. This time solve the RHS first.
    state = revealModeBBalanceSide(state, 'lhs');
    state = revealModeBBalanceSide(state, 'rhs');
    state = finishModeBBalance(state);
    expect(state.phase).toBe('awaiting_cleanup');
    state = activateModeBRhsCalculation(state);
    expect(state.balancedDisplay?.rhsActivated).toBe(true);
    expect(state.pendingArithmetic?.operand1).toBe(12);
    expect(state.pendingArithmetic?.operand2).toBe(3);
    expect(state.pendingArithmetic?.operator).toBe('÷');
    expect(state.pendingArithmetic?.correctAnswer).toBe(4);

    // Answer 4 while the 3/3 cleanup is still available.
    const ans2 = submitAnswer(state, 4);
    expect(ans2.correct).toBe(true);
    state = ans2.state;
    expect(state.phase).toBe('awaiting_cleanup');
    expect(state.balancedDisplay?.rhsSolved).toBe(true);
    expect(state.currentC).toBe(4);

    // Blasting away 3/3 completes the step.
    state = cancelLhsInverse(state);
    expect(state.currentA).toBe(1);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(4);
    expect(state.stage).toBe('solved');
    expect(state.phase).toBe('solved');
    expect(state.equationHistory).toEqual([
      '3 x Y − 1 = 11',
      '3 x Y = 11 + 1',
      '3 x Y = 12',
      'Y = 12 ÷ 3'
    ]);
  });

  it('defaults to Mode B when createInitialState is called without a mode argument', () => {
    const state = createInitialState(BENCHMARK_PUZZLE);
    expect(state.mode).toBe('mode_b');
  });

  it('solves division puzzle Y ÷ 4 = 7 in Mode B by forging multiplication', () => {
    const divPuzzle = {
      id: 'test-div-puzzle',
      a: 1,
      b: 0,
      c: 7,
      d: 4,
      family: 'x_div_d' as const,
      itemId: 'item-chocolate',
      targetVariable: 'Y' as const,
      solution: 28
    };
    let state = createInitialState(divPuzzle, 'mode_b');
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_coefficient');

    // Pick up coefficient/division term (the 4)
    const pick = pickUpTerm(state, 'coefficient');
    expect(pick.success).toBe(true);
    state = pick.state;
    expect(state.phase).toBe('forging');
    expect(state.carriedTerm).toBe('coefficient');

    // Forge opposite: ÷4 requires ×4
    const forgeWrong = forgeOpposite(state, '+');
    expect(forgeWrong.correct).toBe(false);

    const forgeTimes = forgeOpposite(state, '×');
    expect(forgeTimes.correct).toBe(true);
    state = forgeTimes.state;
    expect(state.phase).toBe('applying');
    expect(state.forgedOperation?.originalOperator).toBe('÷');
    expect(state.forgedOperation?.originalOperand).toBe(4);
    expect(state.forgedOperation?.forgedOperator).toBe('×');
    expect(state.forgedOperation?.forgedOperand).toBe(4);

    // Apply to both sides
    const applied = applyToBothSides(state);
    expect(applied.success).toBe(true);
    state = applied.state;
    expect(state.phase).toBe('balancing');
    expect(state.balancedDisplay?.leftBefore).toBe('Y ÷ 4');
    expect(state.balancedDisplay?.leftAdded).toBe('× 4');
    expect(state.balancedDisplay?.rightAdded).toBe('× 4');
    expect(state.pendingArithmetic?.operator).toBe('×');
    expect(state.pendingArithmetic?.operand1).toBe(7);
    expect(state.pendingArithmetic?.operand2).toBe(4);
    expect(state.pendingArithmetic?.correctAnswer).toBe(28);
    expect(state.equationHistory).toEqual(['Y ÷ 4 = 7']);

    // Reveal Mode B sides
    state = revealModeBBalanceSide(state, 'lhs');
    state = revealModeBBalanceSide(state, 'rhs');
    state = finishModeBBalance(state);
    expect(state.phase).toBe('awaiting_cleanup');

    // Activate RHS and answer 28
    state = activateModeBRhsCalculation(state);
    const ans = submitAnswer(state, 28);
    expect(ans.correct).toBe(true);
    state = ans.state;
    expect(state.currentC).toBe(28);

    // Clean up LHS (cancelling ÷4 and ×4)
    state = cancelLhsInverse(state);
    expect(state.stage).toBe('solved');
    expect(state.phase).toBe('solved');
    expect(state.currentC).toBe(28);
    expect(state.equationHistory).toEqual(['Y ÷ 4 = 7', 'Y = 7 × 4']);
  });

  it('solves two-step division equation Y ÷ 4 + 3 = 11 in Mode B without losing ÷4', () => {
    const puzzle = {
      id: 'test-div-plus-b',
      a: 1,
      b: 3,
      c: 11,
      d: 4,
      family: 'x_div_d_plus_b' as const,
      solution: 32
    };
    let state = createInitialState(puzzle, 'mode_b');
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_constant');

    // Pick up constant +3
    const pick1 = pickUpTerm(state, 'constant');
    expect(pick1.success).toBe(true);
    state = pick1.state;
    expect(state.phase).toBe('forging');

    // Forge opposite: +3 requires −
    const forgeMinus = forgeOpposite(state, '−');
    expect(forgeMinus.correct).toBe(true);
    state = forgeMinus.state;
    expect(state.phase).toBe('applying');

    // Apply to both sides
    const applied1 = applyToBothSides(state);
    expect(applied1.success).toBe(true);
    state = applied1.state;
    expect(state.phase).toBe('balancing');
    expect(state.balancedDisplay?.leftBefore).toBe('Y ÷ 4');
    expect(state.balancedDisplay?.fullBalancedLine).toBe('Y ÷ 4 + 3 − 3 = 11 − 3');
    expect(state.equationHistory).toEqual(['Y ÷ 4 + 3 = 11']);

    // Reveal Mode B sides
    state = revealModeBBalanceSide(state, 'lhs');
    state = revealModeBBalanceSide(state, 'rhs');
    state = finishModeBBalance(state);
    expect(state.phase).toBe('awaiting_cleanup');

    // Cancel LHS cancelling pair (+3 -3)
    state = cancelLhsInverse(state);
    expect(state.phase).toBe('awaiting_cleanup');
    expect(state.balancedDisplay?.lhsCleaned).toBe(true);

    // Activate RHS and answer 11 - 3 = 8
    state = activateModeBRhsCalculation(state);
    const ans1 = submitAnswer(state, 8);
    expect(ans1.correct).toBe(true);
    state = ans1.state;
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(8);
    expect(state.stage).toBe('undo_coefficient');
    expect(state.phase).toBe('ready');
    expect(state.equationHistory).toEqual(['Y ÷ 4 + 3 = 11', 'Y ÷ 4 = 11 − 3']);

    // Step 2: Pick up ÷4
    const pick2 = pickUpTerm(state, 'coefficient');
    expect(pick2.success).toBe(true);
    state = pick2.state;
    expect(state.phase).toBe('forging');

    // Forge ×
    const forgeTimes = forgeOpposite(state, '×');
    expect(forgeTimes.correct).toBe(true);
    state = forgeTimes.state;

    // Apply to both sides
    const applied2 = applyToBothSides(state);
    expect(applied2.success).toBe(true);
    state = applied2.state;
    expect(state.phase).toBe('balancing');
    expect(state.balancedDisplay?.leftBefore).toBe('Y ÷ 4');
    expect(state.balancedDisplay?.fullBalancedLine).toBe('Y ÷ 4 × 4 = 8 × 4');
    expect(state.equationHistory).toEqual(['Y ÷ 4 + 3 = 11', 'Y ÷ 4 = 11 − 3', 'Y ÷ 4 = 8']);

    // Reveal sides and finish balance
    state = revealModeBBalanceSide(state, 'lhs');
    state = revealModeBBalanceSide(state, 'rhs');
    state = finishModeBBalance(state);

    // Activate RHS and answer 32
    state = activateModeBRhsCalculation(state);
    const ans2 = submitAnswer(state, 32);
    expect(ans2.correct).toBe(true);
    state = ans2.state;

    // Clean up LHS
    state = cancelLhsInverse(state);
    expect(state.stage).toBe('solved');
    expect(state.phase).toBe('solved');
    expect(state.currentC).toBe(32);
    expect(state.equationHistory).toEqual([
      'Y ÷ 4 + 3 = 11',
      'Y ÷ 4 = 11 − 3',
      'Y ÷ 4 = 8',
      'Y = 8 × 4'
    ]);
  });

  it('solves two-step division equation Y ÷ 3 − 2 = 5 with negative constant in Mode B', () => {
    const puzzle = {
      id: 'test-div-minus-b',
      a: 1,
      b: -2,
      c: 5,
      d: 3,
      family: 'x_div_d_minus_b' as const,
      solution: 21
    };
    let state = createInitialState(puzzle, 'mode_b');
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_constant');

    // Pick up constant -2
    const pick1 = pickUpTerm(state, 'constant');
    expect(pick1.success).toBe(true);
    state = pick1.state;

    // Forge +
    const forgePlus = forgeOpposite(state, '+');
    expect(forgePlus.correct).toBe(true);
    state = forgePlus.state;

    // Apply to both sides
    const applied1 = applyToBothSides(state);
    expect(applied1.success).toBe(true);
    state = applied1.state;
    expect(state.balancedDisplay?.leftBefore).toBe('Y ÷ 3');
    expect(state.balancedDisplay?.fullBalancedLine).toBe('Y ÷ 3 − 2 + 2 = 5 + 2');
    expect(state.equationHistory).toEqual(['Y ÷ 3 − 2 = 5']);

    // Reveal & finish balance
    state = revealModeBBalanceSide(state, 'lhs');
    state = revealModeBBalanceSide(state, 'rhs');
    state = finishModeBBalance(state);

    // Cancel LHS
    state = cancelLhsInverse(state);

    // Answer 5 + 2 = 7
    state = activateModeBRhsCalculation(state);
    const ans1 = submitAnswer(state, 7);
    expect(ans1.correct).toBe(true);
    state = ans1.state;
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(7);
    expect(state.stage).toBe('undo_coefficient');
    expect(state.equationHistory).toEqual(['Y ÷ 3 − 2 = 5', 'Y ÷ 3 = 5 + 2']);

    // Undo division ÷ 3
    const pick2 = pickUpTerm(state, 'coefficient');
    state = pick2.state;
    const forgeTimes = forgeOpposite(state, '×');
    state = forgeTimes.state;
    const applied2 = applyToBothSides(state);
    state = applied2.state;
    expect(state.balancedDisplay?.leftBefore).toBe('Y ÷ 3');

    state = revealModeBBalanceSide(state, 'lhs');
    state = revealModeBBalanceSide(state, 'rhs');
    state = finishModeBBalance(state);

    state = activateModeBRhsCalculation(state);
    const ans2 = submitAnswer(state, 21);
    state = ans2.state;
    state = cancelLhsInverse(state);

    expect(state.stage).toBe('solved');
    expect(state.currentC).toBe(21);
    expect(state.equationHistory).toEqual([
      'Y ÷ 3 − 2 = 5',
      'Y ÷ 3 = 5 + 2',
      'Y ÷ 3 = 7',
      'Y = 7 × 3'
    ]);
  });

  it('solves two-step division equation Y ÷ 4 + 3 = 11 in Mode A', () => {
    const puzzle = {
      id: 'test-div-mode-a',
      a: 1,
      b: 3,
      c: 11,
      d: 4,
      family: 'x_div_d_plus_b' as const,
      solution: 32
    };
    let state = createInitialState(puzzle, 'mode_a');
    expect(state.stage).toBe('undo_constant');

    // Pick up constant +3
    const pick1 = pickUpTerm(state, 'constant');
    state = pick1.state;
    expect(state.phase).toBe('carrying');

    // Drop
    const drop1 = commitDrop(state);
    expect(drop1.success).toBe(true);
    state = drop1.state;
    expect(state.phase).toBe('question');
    expect(state.cancellation?.leftExpr).toContain('Y ÷ 4');

    // Answer 8
    const ans1 = submitAnswer(state, 8);
    expect(ans1.correct).toBe(true);
    state = ans1.state;
    expect(state.stage).toBe('undo_coefficient');
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(8);

    // Pick up coefficient/denominator
    const pick2 = pickUpTerm(state, 'coefficient');
    state = pick2.state;
    expect(state.phase).toBe('carrying');

    // Drop
    const drop2 = commitDrop(state);
    expect(drop2.success).toBe(true);
    state = drop2.state;
    expect(state.phase).toBe('question');
    expect(state.cancellation?.leftExpr).toBe('(Y ÷ 4) × 4');

    // Answer 32
    const ans2 = submitAnswer(state, 32);
    expect(ans2.correct).toBe(true);
    state = ans2.state;
    expect(state.stage).toBe('solved');
    expect(state.currentC).toBe(32);
  });

  it('solves two-step division equation Y ÷ 4 + 3 = 11 in Mode C', () => {
    const puzzle = {
      id: 'test-div-mode-c',
      a: 1,
      b: 3,
      c: 11,
      d: 4,
      family: 'x_div_d_plus_b' as const,
      solution: 32
    };
    let state = createInitialState(puzzle, 'mode_c');
    expect(state.stage).toBe('undo_constant');

    // 1. Equip − blaster and blast constant 3 on LHS
    state = equipBlaster(state, '−');
    const blast1 = blastLhs(state);
    expect(blast1.success).toBe(true);
    state = blast1.state;
    expect(state.phase).toBe('blasting_rhs');

    // Blast RHS
    const rhs1 = blastRhs(state);
    expect(rhs1.success).toBe(true);
    state = rhs1.state;

    // Equip calc and blast simplify
    state = equipBlaster(state, 'calc');
    const simp1 = blastSimplify(state);
    expect(simp1.success).toBe(true);
    state = simp1.state;

    // Answer 8
    const ans1 = submitAnswer(state, 8);
    expect(ans1.correct).toBe(true);
    state = ans1.state;
    expect(state.stage).toBe('undo_coefficient');
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(8);

    // 2. Division stage: trying ÷ blaster should fail
    state = equipBlaster(state, '÷');
    const wrongBlaster = blastLhs(state);
    expect(wrongBlaster.success).toBe(false);
    expect(wrongBlaster.notYet).toBe(true);

    // Equip × blaster to multiply both sides by 4
    state = equipBlaster(state, '×');
    const blast2 = blastLhs(state);
    expect(blast2.success).toBe(true);
    state = blast2.state;

    // Blast RHS
    const rhs2 = blastRhs(state);
    expect(rhs2.success).toBe(true);
    state = rhs2.state;

    // Simplify with calc
    state = equipBlaster(state, 'calc');
    const simp2 = blastSimplify(state);
    expect(simp2.success).toBe(true);
    state = simp2.state;

    // Answer 32
    const ans2 = submitAnswer(state, 32);
    expect(ans2.correct).toBe(true);
    state = ans2.state;
    expect(state.stage).toBe('solved');
    expect(state.currentC).toBe(32);
  });

  it('solves two-step division equation Y ÷ 4 + 3 = 11 in Mode D', () => {
    const puzzle = {
      id: 'test-div-mode-d',
      a: 1,
      b: 3,
      c: 11,
      d: 4,
      family: 'x_div_d_plus_b' as const,
      solution: 32
    };
    let state = createInitialState(puzzle, 'mode_d');
    expect(state.stage).toBe('undo_constant');

    // 1. Target constant
    const t1 = identifyModeDTarget(state, 'constant');
    expect(t1.success).toBe(true);
    state = t1.state;

    // Select correct inverse (−3)
    const invMinus = state.modeDState!.inverseChoices.find(c => c.isCorrect)!;
    const sel1 = selectModeDInverse(state, invMinus.id);
    expect(sel1.success).toBe(true);
    state = sel1.state;

    // Blast LHS then RHS
    state = blastModeDSide(state, 'lhs').state;
    state = blastModeDSide(state, 'rhs').state;
    expect(state.phase).toBe('awaiting_simplify');

    // Simplify LHS (cancels to 0)
    state = activateModeDSimplify(state, 'lhs').state;
    state = submitAnswer(state, 0).state;

    // Simplify RHS (11 - 3 = 8)
    state = activateModeDSimplify(state, 'rhs').state;
    state = submitAnswer(state, 8).state;

    // After step 1, must advance to undo_coefficient, NOT solved!
    expect(state.stage).toBe('undo_coefficient');
    expect(state.phase).toBe('ready');
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(8);

    // 2. Target coefficient/denominator
    const t2 = identifyModeDTarget(state, 'coefficient');
    expect(t2.success).toBe(true);
    state = t2.state;

    // Select correct inverse (×4)
    const invTimes = state.modeDState!.inverseChoices.find(c => c.isCorrect)!;
    expect(invTimes.operator).toBe('×');
    expect(invTimes.operand).toBe(4);
    state = selectModeDInverse(state, invTimes.id).state;

    // Blast LHS then RHS
    state = blastModeDSide(state, 'lhs').state;
    state = blastModeDSide(state, 'rhs').state;

    // Simplify LHS (cancels to 1)
    state = activateModeDSimplify(state, 'lhs').state;
    state = submitAnswer(state, 1).state;

    // Simplify RHS (8 * 4 = 32)
    state = activateModeDSimplify(state, 'rhs').state;
    state = submitAnswer(state, 32).state;

    expect(state.stage).toBe('solved');
    expect(state.phase).toBe('solved');
    expect(state.currentC).toBe(32);
  });
});
