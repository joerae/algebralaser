import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  identifyModeDTarget,
  selectModeDInverse,
  blastModeDSide,
  activateModeDSimplify,
  submitAnswer,
  undo
} from './linearEquation';
import { BENCHMARK_PUZZLE } from './puzzleGenerator';

describe('Mode D: Blast Sides State Machine & Mathematics', () => {
  it('solves benchmark 3 x Y − 1 = 11 from start to finish', () => {
    // 1. Initial State in Mode D
    let state = createInitialState(BENCHMARK_PUZZLE, 'mode_d');
    expect(state.mode).toBe('mode_d');
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_constant');
    expect(state.modeDState).toBeDefined();
    expect(state.modeDState?.tiltAngle).toBe(0);

    // 2. Guided rule: targeting coefficient while constant exists fails
    const notYetCoeff = identifyModeDTarget(state, 'coefficient');
    expect(notYetCoeff.success).toBe(false);
    expect(notYetCoeff.notYet).toBe(true);
    expect(notYetCoeff.guideMessage).toContain('Undo −1 first');

    // 3. Target constant −1
    const targetConst = identifyModeDTarget(state, 'constant');
    expect(targetConst.success).toBe(true);
    state = targetConst.state;
    expect(state.phase).toBe('choose_inverse');
    expect(state.modeDState?.inverseChoices).toHaveLength(4);

    const correctChoice = state.modeDState?.inverseChoices.find(c => c.isCorrect);
    const wrongChoice = state.modeDState?.inverseChoices.find(c => !c.isCorrect);

    expect(correctChoice).toBeDefined();
    expect(correctChoice?.displayText).toBe('+1');

    // 4. Choosing wrong inverse is rejected
    const wrongSelect = selectModeDInverse(state, wrongChoice!.id);
    expect(wrongSelect.success).toBe(false);
    expect(wrongSelect.notYet).toBe(true);

    // 5. Select correct inverse (+1)
    const correctSelect = selectModeDInverse(state, correctChoice!.id);
    expect(correctSelect.success).toBe(true);
    state = correctSelect.state;
    expect(state.phase).toBe('blast_first_side');
    expect(state.modeDState?.selectedInverse?.displayText).toBe('+1');
    expect(state.blasterState?.carriedOperand).toEqual({ operator: '+', value: 1 });

    // 6. Blast LHS first
    const blastLhs = blastModeDSide(state, 'lhs');
    expect(blastLhs.success).toBe(true);
    state = blastLhs.state;
    expect(state.phase).toBe('blast_second_side');
    expect(state.modeDState?.blastedLhs).toBe(true);
    expect(state.modeDState?.blastedRhs).toBe(false);
    expect(state.modeDState?.tiltAngle).toBeGreaterThan(0); // LHS heavy/sinks down
    expect(state.blasterState?.scaleTilt).toBe('lhs_heavy');

    // 7. Cannot blast LHS again while unbalanced
    const reblastLhs = blastModeDSide(state, 'lhs');
    expect(reblastLhs.success).toBe(false);
    expect(reblastLhs.alreadyBlasted).toBe(true);

    // 8. Blast RHS to balance the scale
    const blastRhs = blastModeDSide(state, 'rhs');
    expect(blastRhs.success).toBe(true);
    state = blastRhs.state;
    expect(state.phase).toBe('awaiting_simplify');
    expect(state.modeDState?.blastedLhs).toBe(true);
    expect(state.modeDState?.blastedRhs).toBe(true);
    expect(state.modeDState?.tiltAngle).toBe(0); // Balanced!
    expect(state.blasterState?.scaleTilt).toBe('balanced');

    // 9. Activate LHS simplification (-1 + 1 = 0)
    const actLhsSimp = activateModeDSimplify(state, 'lhs');
    expect(actLhsSimp.success).toBe(true);
    state = actLhsSimp.state;
    expect(state.phase).toBe('question');
    expect(state.pendingArithmetic?.operand1).toBe(-1);
    expect(state.pendingArithmetic?.operator).toBe('+');
    expect(state.pendingArithmetic?.operand2).toBe(1);
    expect(state.pendingArithmetic?.correctAnswer).toBe(0);

    // Answer 0 for LHS
    const ansLhs = submitAnswer(state, 0);
    expect(ansLhs.correct).toBe(true);
    state = ansLhs.state;
    // RHS still needs simplification -> remains in awaiting_simplify
    expect(state.phase).toBe('awaiting_simplify');
    expect(state.modeDState?.simplifiedLhs).toBe(true);
    expect(state.modeDState?.simplifiedRhs).toBe(false);

    // 10. Activate RHS simplification (11 + 1 = 12)
    const actRhsSimp = activateModeDSimplify(state, 'rhs');
    expect(actRhsSimp.success).toBe(true);
    state = actRhsSimp.state;
    expect(state.phase).toBe('question');
    expect(state.pendingArithmetic?.correctAnswer).toBe(12);

    // Answer 12 for RHS
    const ansRhs = submitAnswer(state, 12);
    expect(ansRhs.correct).toBe(true);
    state = ansRhs.state;

    // Both sides simplified! Advances to undo_coefficient
    expect(state.currentA).toBe(3);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(12);
    expect(state.stage).toBe('undo_coefficient');
    expect(state.phase).toBe('ready');
    expect(state.equationHistory).toContain('3 x Y = 12');

    // 11. Target coefficient 3
    const targetCoeff = identifyModeDTarget(state, 'coefficient');
    expect(targetCoeff.success).toBe(true);
    state = targetCoeff.state;
    expect(state.phase).toBe('choose_inverse');

    const correctDiv = state.modeDState?.inverseChoices.find(c => c.isCorrect);
    expect(correctDiv?.displayText).toBe('÷3');

    // 12. Select ÷3
    state = selectModeDInverse(state, correctDiv!.id).state;
    expect(state.phase).toBe('blast_first_side');

    // 13. Blast LHS: dividing makes LHS light (negative tilt)
    state = blastModeDSide(state, 'lhs').state;
    expect(state.phase).toBe('blast_second_side');
    expect(state.modeDState?.tiltAngle).toBeLessThan(0);
    expect(state.blasterState?.scaleTilt).toBe('lhs_light');

    // 14. Blast RHS: balances
    state = blastModeDSide(state, 'rhs').state;
    expect(state.phase).toBe('awaiting_simplify');
    expect(state.modeDState?.tiltAngle).toBe(0);

    // 15. Simplify RHS first (12 ÷ 3 = 4)
    state = activateModeDSimplify(state, 'rhs').state;
    expect(state.pendingArithmetic?.correctAnswer).toBe(4);
    state = submitAnswer(state, 4).state;
    expect(state.phase).toBe('awaiting_simplify');
    expect(state.modeDState?.simplifiedRhs).toBe(true);
    expect(state.modeDState?.simplifiedLhs).toBe(false);

    // 16. Simplify LHS (3 ÷ 3 = 1)
    state = activateModeDSimplify(state, 'lhs').state;
    expect(state.pendingArithmetic?.correctAnswer).toBe(1);
    state = submitAnswer(state, 1).state;

    // Puzzle Solved!
    expect(state.currentA).toBe(1);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(4);
    expect(state.stage).toBe('solved');
    expect(state.phase).toBe('solved');
    expect(state.equationHistory).toContain('Y = 4');
  });

  it('supports undoing in Mode D', () => {
    let state = createInitialState(BENCHMARK_PUZZLE, 'mode_d');
    state = identifyModeDTarget(state, 'constant').state;
    const correctChoice = state.modeDState?.inverseChoices.find(c => c.isCorrect)!;
    state = selectModeDInverse(state, correctChoice.id).state;
    expect(state.phase).toBe('blast_first_side');

    state = blastModeDSide(state, 'lhs').state;
    expect(state.phase).toBe('blast_second_side');
    expect(state.modeDState?.tiltAngle).toBeGreaterThan(0);

    const undoRes = undo(state);
    expect(undoRes.success).toBe(true);
    state = undoRes.state;
    expect(state.phase).toBe('blast_first_side');
    expect(state.modeDState?.blastedLhs).toBe(false);
  });
});
