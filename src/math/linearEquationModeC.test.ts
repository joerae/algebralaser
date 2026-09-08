import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  equipBlaster,
  blastLhs,
  blastRhs,
  blastSimplify,
  submitAnswer,
  undo
} from './linearEquation';
import { BENCHMARK_PUZZLE } from './puzzleGenerator';

describe('Mode C: Blast Balance State Machine & Mathematics', () => {
  it('solves benchmark 3 x Y − 1 = 11 from start to finish', () => {
    // 1. Initial State in Mode C
    let state = createInitialState(BENCHMARK_PUZZLE, 'mode_c');
    expect(state.mode).toBe('mode_c');
    expect(state.phase).toBe('ready');
    expect(state.stage).toBe('undo_constant');
    expect(state.blasterState).toBeDefined();
    expect(state.blasterState?.equipped).toBeNull();
    expect(state.blasterState?.scaleTilt).toBe('balanced');
    expect(state.blasterState?.carriedOperand).toBeNull();

    // 2. Cannot blast LHS without equipping a blaster
    const noEquip = blastLhs(state);
    expect(noEquip.success).toBe(false);
    expect(noEquip.notYet).toBe(true);

    // 3. Equip wrong blaster (− instead of + for −1)
    state = equipBlaster(state, '-');
    expect(state.blasterState?.equipped).toBe('-');

    const wrongBlaster = blastLhs(state);
    expect(wrongBlaster.success).toBe(false);
    expect(wrongBlaster.notYet).toBe(true);
    expect(wrongBlaster.guideMessage).toContain('Wrong blaster');

    // 4. Equip + blaster and blast −1
    state = equipBlaster(state, '+');
    const smashLhs = blastLhs(state);
    expect(smashLhs.success).toBe(true);
    state = smashLhs.state;

    expect(state.phase).toBe('blasting_rhs');
    expect(state.blasterState?.scaleTilt).toBe('lhs_heavy');
    expect(state.blasterState?.carriedOperand).toEqual({
      operator: '+',
      value: 1
    });

    // 5. Blast RHS to apply carried +1
    const applyRhs = blastRhs(state);
    expect(applyRhs.success).toBe(true);
    state = applyRhs.state;

    expect(state.phase).toBe('awaiting_simplify');
    expect(state.blasterState?.scaleTilt).toBe('balanced');
    expect(state.blasterState?.carriedOperand).toBeNull();
    expect(state.blasterState?.rhsUnsimplified).toEqual({
      leftNum: 11,
      op: '+',
      rightNum: 1,
      displayText: '11 + 1'
    });

    // 6. Attempting to simplify with + blaster fails
    const badSimplify = blastSimplify(state, '+');
    expect(badSimplify.success).toBe(false);
    expect(badSimplify.notYet).toBe(true);
    expect(badSimplify.guideMessage).toContain('Calculator blaster');

    // 7. Equip Calculator blaster and blast simplify
    state = equipBlaster(state, 'calc');
    const simplify = blastSimplify(state);
    expect(simplify.success).toBe(true);
    state = simplify.state;

    expect(state.phase).toBe('question');
    expect(state.pendingArithmetic?.operand1).toBe(11);
    expect(state.pendingArithmetic?.operand2).toBe(1);
    expect(state.pendingArithmetic?.operator).toBe('+');
    expect(state.pendingArithmetic?.correctAnswer).toBe(12);
    expect(state.pendingArithmetic?.choices).toContain(12);

    // 8. Answer 12
    const ans1 = submitAnswer(state, 12);
    expect(ans1.correct).toBe(true);
    state = ans1.state;

    expect(state.currentA).toBe(3);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(12);
    expect(state.stage).toBe('undo_coefficient');
    expect(state.phase).toBe('ready');
    expect(state.blasterState?.scaleTilt).toBe('balanced');
    expect(state.equationHistory).toEqual(['3 x Y = 11 + 1']);

    // 9. Coefficient stage: try blasting with + blaster (wrong)
    state = equipBlaster(state, '+');
    const wrongCoeffBlaster = blastLhs(state);
    expect(wrongCoeffBlaster.success).toBe(false);
    expect(wrongCoeffBlaster.notYet).toBe(true);

    // 10. Equip ÷ blaster and blast 3
    state = equipBlaster(state, '÷');
    const smashCoeff = blastLhs(state);
    expect(smashCoeff.success).toBe(true);
    state = smashCoeff.state;

    expect(state.phase).toBe('blasting_rhs');
    expect(state.blasterState?.scaleTilt).toBe('lhs_light');
    expect(state.blasterState?.carriedOperand).toEqual({
      operator: '÷',
      value: 3
    });

    // 11. Blast RHS
    const applyCoeffRhs = blastRhs(state);
    expect(applyCoeffRhs.success).toBe(true);
    state = applyCoeffRhs.state;
    expect(state.phase).toBe('awaiting_simplify');
    expect(state.blasterState?.scaleTilt).toBe('balanced');

    // 12. Equip calc blaster & simplify
    state = equipBlaster(state, 'calc');
    const simplifyCoeff = blastSimplify(state);
    expect(simplifyCoeff.success).toBe(true);
    state = simplifyCoeff.state;
    expect(state.phase).toBe('question');
    expect(state.pendingArithmetic?.correctAnswer).toBe(4);

    // 13. Answer 4 -> Solved!
    const ans2 = submitAnswer(state, 4);
    expect(ans2.correct).toBe(true);
    state = ans2.state;

    expect(state.currentA).toBe(1);
    expect(state.currentB).toBe(0);
    expect(state.currentC).toBe(4);
    expect(state.stage).toBe('solved');
    expect(state.phase).toBe('solved');
  });

  it('supports undoing in Mode C and restores blasterState and scale tilt', () => {
    let state = createInitialState(BENCHMARK_PUZZLE, 'mode_c');
    state = equipBlaster(state, '+');
    state = blastLhs(state).state;
    expect(state.phase).toBe('blasting_rhs');
    expect(state.blasterState?.scaleTilt).toBe('lhs_heavy');

    const undoRes = undo(state);
    expect(undoRes.success).toBe(true);
    state = undoRes.state;

    expect(state.phase).toBe('ready');
    expect(state.blasterState?.scaleTilt).toBe('balanced');
    expect(state.blasterState?.carriedOperand).toBeNull();
  });
});
