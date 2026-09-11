import { 
  LinearEquationDef, 
  EquationState, 
  HistorySnapshot, 
  PendingArithmetic, 
  CancellationDisplay, 
  SolverMode,
  DEFAULT_MODE,
  ForgedOperation, 
  BalancedDisplay, 
  OperationSign, 
  SolverStage,
  GamePhase,
  BlasterType,
  BlasterState,
  ScaleTilt,
  UnsimplifiedExpression,
  ModeDState,
  InverseChoice
} from './types';
import { createPendingArithmetic, shuffleArray } from './puzzleGenerator';

export function formatEquationLine(a: number, b: number, c: number, compactCoefficient: boolean = false, d?: number): string {
  let left = '';
  if (d && d > 1) {
    left = `Y ÷ ${d}`;
  } else if (a === 1) {
    left = 'Y';
  } else {
    left = compactCoefficient ? `${a}Y` : `${a} x Y`;
  }

  if (b > 0) {
    left += ` + ${b}`;
  } else if (b < 0) {
    left += ` − ${Math.abs(b)}`;
  }

  return `${left} = ${c}`;
}

export function formatUnsimplifiedEquationLine(
  a: number,
  _stage: SolverStage,
  _c: number,
  pending: PendingArithmetic,
  d?: number
): string {
  let left = '';
  if (pending.operator === '÷' || pending.operator === '×') {
    left = 'Y';
  } else if (d && d > 1) {
    left = `Y ÷ ${d}`;
  } else if (a === 1) {
    left = 'Y';
  } else {
    left = `${a} x Y`;
  }
  const opDisplay = pending.operator === '-' ? '−' : pending.operator;
  return `${left} = ${pending.operand1} ${opDisplay} ${pending.operand2}`;
}

export function createInitialBlasterState(): BlasterState {
  return {
    equipped: null,
    scaleTilt: 'balanced',
    carriedOperand: null,
    rhsUnsimplified: null
  };
}

export function createInitialModeDState(): ModeDState {
  return {
    targetTerm: null,
    inverseChoices: [],
    selectedInverse: null,
    blastedLhs: false,
    blastedRhs: false,
    tiltAngle: 0,
    lhsUnsimplified: null,
    rhsUnsimplified: null,
    simplifiedLhs: false,
    simplifiedRhs: false,
    activeSimplifyingSide: null
  };
}

export function createInitialState(problem: LinearEquationDef, mode: SolverMode = DEFAULT_MODE): EquationState {
  const isDivision = Boolean(problem.d && problem.d > 1);
  const stage = problem.b !== 0 
    ? 'undo_constant' 
    : ((problem.a > 1 || isDivision) ? 'undo_coefficient' : 'solved');

  return {
    problem,
    mode,
    currentA: problem.a,
    currentB: problem.b,
    currentC: problem.c,
    stage,
    phase: stage === 'solved' ? 'solved' : 'ready',
    carriedTerm: null,
    forgedOperation: null,
    balancedDisplay: null,
    blasterState: (mode === 'mode_c' || mode === 'mode_d') ? createInitialBlasterState() : undefined,
    modeDState: mode === 'mode_d' ? createInitialModeDState() : undefined,
    pendingArithmetic: null,
    cancellation: null,
    errorMessage: null,
    equationHistory: [],
    history: []
  };
}

function saveSnapshot(state: EquationState): HistorySnapshot {
  return {
    mode: state.mode,
    currentA: state.currentA,
    currentB: state.currentB,
    currentC: state.currentC,
    stage: state.stage,
    phase: state.phase,
    carriedTerm: state.carriedTerm,
    forgedOperation: state.forgedOperation ? { ...state.forgedOperation } : null,
    balancedDisplay: state.balancedDisplay ? { ...state.balancedDisplay } : null,
    blasterState: state.blasterState ? { ...state.blasterState } : undefined,
    modeDState: state.modeDState ? {
      ...state.modeDState,
      inverseChoices: [...state.modeDState.inverseChoices]
    } : undefined,
    pendingArithmetic: state.pendingArithmetic ? { ...state.pendingArithmetic } : null,
    equationHistory: [...state.equationHistory]
  };
}


export function pickUpTerm(
  state: EquationState, 
  term: 'constant' | 'coefficient'
): { state: EquationState; success: boolean; notYet?: boolean; guideMessage?: string } {
  if (state.phase !== 'ready') {
    return { state, success: false };
  }

  // Guided Solver Rule:
  // If constant is present (b != 0), player must undo the constant first!
  if (term === 'coefficient' && state.currentB !== 0) {
    const signStr = state.currentB < 0 ? '−' : '+';
    const val = Math.abs(state.currentB);
    const msg = state.mode === 'mode_b' 
      ? `NOT YET — Undo ${signStr}${val} first to avoid fractions!` 
      : `First undo the ${signStr}${val}.`;
    return {
      state: {
        ...state,
        errorMessage: msg
      },
      success: false,
      notYet: true,
      guideMessage: msg
    };
  }

  if (term === 'constant' && state.currentB === 0) {
    return { state, success: false };
  }

  const isDivision = Boolean(state.problem.d && state.problem.d > 1);
  if (term === 'coefficient' && state.currentA <= 1 && !isDivision) {
    return { state, success: false };
  }

  // In Mode B, picking up an operation enters 'forging' phase where original stays visible
  const nextPhase = state.mode === 'mode_b' ? 'forging' : 'carrying';

  return {
    state: {
      ...state,
      phase: nextPhase,
      carriedTerm: term,
      forgedOperation: null,
      balancedDisplay: null,
      errorMessage: null
    },
    success: true
  };
}

export function getRequiredForge(state: EquationState): {
  originalSign: OperationSign;
  requiredSign: OperationSign;
  operand: number;
} | null {
  if (!state.carriedTerm) return null;

  if (state.carriedTerm === 'constant') {
    const isNeg = state.currentB < 0;
    const operand = Math.abs(state.currentB);
    return {
      originalSign: isNeg ? '-' : '+',
      requiredSign: isNeg ? '+' : '-',
      operand
    };
  }

  if (state.carriedTerm === 'coefficient') {
    const isDivision = Boolean(state.problem.d && state.problem.d > 1);
    if (isDivision) {
      return {
        originalSign: '÷',
        requiredSign: '×',
        operand: state.problem.d!
      };
    }
    return {
      originalSign: '×',
      requiredSign: '÷',
      operand: state.currentA
    };
  }

  return null;
}

export function forgeOpposite(
  state: EquationState,
  sign: OperationSign
): { state: EquationState; correct: boolean } {
  if (state.phase !== 'forging' || !state.carriedTerm) {
    return { state, correct: false };
  }

  const req = getRequiredForge(state);
  if (!req) return { state, correct: false };

  // Normalize sign comparison ('-' vs '−')
  const normalize = (s: OperationSign) => (s === '−' ? '-' : s);
  const isMatch = normalize(sign) === normalize(req.requiredSign);

  if (!isMatch) {
    return { state, correct: false };
  }

  const forgedOperation: ForgedOperation = {
    originalOperator: req.originalSign,
    originalOperand: req.operand,
    forgedOperator: req.requiredSign,
    forgedOperand: req.operand
  };

  return {
    state: {
      ...state,
      phase: 'applying',
      forgedOperation,
      errorMessage: null
    },
    correct: true
  };
}

export function applyToBothSides(
  state: EquationState,
  rng: () => number = Math.random
): { state: EquationState; success: boolean } {
  if (state.phase !== 'applying' || !state.forgedOperation || !state.carriedTerm) {
    return { state, success: false };
  }

  const history = [...state.history, saveSnapshot(state)];
  const { forgedOperator, forgedOperand } = state.forgedOperation;

  let leftBefore = '';
  let leftAdded = '';
  let rightBefore = `${state.currentC}`;
  let rightAdded = '';
  let cancellingLhs = '';
  let simplifiedLhs = '';
  let pendingArithmetic: PendingArithmetic;

  if (state.carriedTerm === 'constant') {
    const isNeg = state.currentB < 0;
    const origSign = isNeg ? '−' : '+';
    const forgeSign = forgedOperator === '+' ? '+' : '−';
    const isDivision = Boolean(state.problem.d && state.problem.d > 1);

    leftBefore = isDivision
      ? `Y ÷ ${state.problem.d}`
      : (state.currentA === 1 ? 'Y' : `${state.currentA} x Y`);
    leftAdded = `${origSign} ${forgedOperand} ${forgeSign} ${forgedOperand}`;
    rightAdded = `${forgeSign} ${forgedOperand}`;
    cancellingLhs = `${origSign} ${forgedOperand} ${forgeSign} ${forgedOperand}`;
    simplifiedLhs = leftBefore;

    pendingArithmetic = createPendingArithmetic(
      state.currentC,
      forgedOperand,
      forgedOperator,
      rng
    );
  } else {
    // coefficient or division denominator
    const isDivision = Boolean(state.problem.d && state.problem.d > 1);
    if (isDivision) {
      leftBefore = `Y ÷ ${forgedOperand}`;
      leftAdded = `× ${forgedOperand}`;
      rightAdded = `× ${forgedOperand}`;
      cancellingLhs = `Y ÷ ${forgedOperand} × ${forgedOperand}`;
      simplifiedLhs = 'Y';

      pendingArithmetic = createPendingArithmetic(
        state.currentC,
        forgedOperand,
        '×',
        rng
      );
    } else {
      leftBefore = `${state.currentA} x Y`;
      leftAdded = `÷ ${forgedOperand}`;
      rightAdded = `÷ ${forgedOperand}`;
      cancellingLhs = `${state.currentA} x ... ÷ ${forgedOperand}`;
      simplifiedLhs = 'Y';

      pendingArithmetic = createPendingArithmetic(
        state.currentC,
        forgedOperand,
        '÷',
        rng
      );
    }
  }

  const balancedDisplay: BalancedDisplay = {
    leftBefore,
    leftAdded,
    rightBefore,
    rightAdded,
    fullBalancedLine: `${leftBefore} ${leftAdded} = ${rightBefore} ${rightAdded}`,
    cancellingLhs,
    simplifiedLhs,
    lhsApplied: false,
    rhsApplied: false,
    lhsCleaned: false,
    rhsActivated: false,
    rhsSolved: false
  };

  const isDivision = Boolean(state.problem.d && state.problem.d > 1);
  const currentLine = formatEquationLine(
    state.currentA,
    state.currentB,
    state.currentC,
    false,
    isDivision ? state.problem.d : undefined
  );
  const updatedHistory = state.equationHistory.includes(currentLine)
    ? [...state.equationHistory]
    : [...state.equationHistory, currentLine];

  return {
    state: {
      ...state,
      history,
      equationHistory: updatedHistory,
      phase: 'balancing',
      balancedDisplay,
      pendingArithmetic,
      errorMessage: null
    },
    success: true
  };
}

function completeModeBStep(state: EquationState): EquationState {
  if (!state.pendingArithmetic) return state;

  const isDivision = Boolean(state.problem.d && state.problem.d > 1);
  const completedLine = formatUnsimplifiedEquationLine(
    state.currentA,
    state.stage,
    state.currentC,
    state.pendingArithmetic,
    isDivision ? state.problem.d : undefined
  );
  const equationHistory = state.equationHistory.includes(completedLine)
    ? [...state.equationHistory]
    : [...state.equationHistory, completedLine];
  const currentA = state.stage === 'undo_coefficient' ? 1 : state.currentA;
  const currentB = state.stage === 'undo_constant' ? 0 : state.currentB;
  const currentC = state.pendingArithmetic.correctAnswer;
  const stage: SolverStage = currentB !== 0
    ? 'undo_constant'
    : ((currentA > 1 || (state.stage !== 'undo_coefficient' && isDivision)) ? 'undo_coefficient' : 'solved');

  return {
    ...state,
    history: [...state.history, saveSnapshot(state)],
    equationHistory,
    currentA,
    currentB,
    currentC,
    stage,
    phase: stage === 'solved' ? 'solved' : 'ready',
    carriedTerm: null,
    forgedOperation: null,
    balancedDisplay: null,
    pendingArithmetic: null,
    errorMessage: null
  };
}

export function cancelLhsInverse(state: EquationState): EquationState {
  if (state.phase !== 'awaiting_cleanup' || !state.balancedDisplay) {
    return state;
  }

  const cleanedState: EquationState = {
    ...state,
    balancedDisplay: {
      ...state.balancedDisplay,
      lhsCleaned: true
    }
  };

  return state.balancedDisplay.rhsSolved ? completeModeBStep(cleanedState) : cleanedState;
}

export function revealModeBBalanceSide(
  state: EquationState,
  side: 'lhs' | 'rhs'
): EquationState {
  if (state.mode !== 'mode_b' || state.phase !== 'balancing' || !state.balancedDisplay) {
    return state;
  }

  return {
    ...state,
    balancedDisplay: {
      ...state.balancedDisplay,
      lhsApplied: side === 'lhs' ? true : state.balancedDisplay.lhsApplied,
      rhsApplied: side === 'rhs' ? true : state.balancedDisplay.rhsApplied
    }
  };
}

export function finishModeBBalance(state: EquationState): EquationState {
  if (
    state.mode !== 'mode_b' ||
    state.phase !== 'balancing' ||
    !state.balancedDisplay?.lhsApplied ||
    !state.balancedDisplay?.rhsApplied
  ) {
    return state;
  }

  return {
    ...state,
    phase: 'awaiting_cleanup'
  };
}

export function activateModeBRhsCalculation(state: EquationState): EquationState {
  if (
    state.mode !== 'mode_b' ||
    state.phase !== 'awaiting_cleanup' ||
    !state.balancedDisplay ||
    state.balancedDisplay.rhsSolved
  ) {
    return state;
  }

  return {
    ...state,
    balancedDisplay: {
      ...state.balancedDisplay,
      rhsActivated: true
    }
  };
}

export function equipBlaster(state: EquationState, blaster: BlasterType): EquationState {
  const blasterState = state.blasterState ? { ...state.blasterState } : createInitialBlasterState();
  return {
    ...state,
    blasterState: {
      ...blasterState,
      equipped: blaster
    },
    errorMessage: null
  };
}

export function blastLhs(
  state: EquationState,
  blaster?: BlasterType
): { state: EquationState; success: boolean; notYet?: boolean; guideMessage?: string } {
  if (state.phase !== 'ready') {
    return { state, success: false };
  }

  const activeBlaster = blaster || state.blasterState?.equipped;
  if (!activeBlaster) {
    const msg = 'Equip a blaster on the left first!';
    return {
      state: {
        ...state,
        errorMessage: msg
      },
      success: false,
      notYet: true,
      guideMessage: msg
    };
  }

  // 1. Constant Stage
  if (state.stage === 'undo_constant') {
    const isNeg = state.currentB < 0;
    const requiredOp: OperationSign = isNeg ? '+' : '−';
    const isCorrectBlaster = activeBlaster === '+' ? isNeg : (!isNeg && (activeBlaster === '-' || activeBlaster === '−'));

    if (!isCorrectBlaster) {
      const msg = `Wrong blaster! Use the ${requiredOp} blaster to neutralize ${isNeg ? '−' : '+'}${Math.abs(state.currentB)}.`;
      return {
        state: {
          ...state,
          errorMessage: msg
        },
        success: false,
        notYet: true,
        guideMessage: msg
      };
    }

    // Correct blaster: pop LHS constant
    const history = [...state.history, saveSnapshot(state)];
    const operandVal = Math.abs(state.currentB);
    const operandSign: OperationSign = isNeg ? '+' : '−';
    // Neutralizing a negative number adds weight (LHS tilts down: heavier)
    // Neutralizing a positive number removes weight (LHS tilts up: lighter)
    const scaleTilt: ScaleTilt = isNeg ? 'lhs_heavy' : 'lhs_light';

    return {
      state: {
        ...state,
        history,
        phase: 'blasting_rhs',
        errorMessage: null,
        blasterState: {
          ...(state.blasterState || createInitialBlasterState()),
          equipped: activeBlaster,
          scaleTilt,
          carriedOperand: {
            operator: operandSign,
            value: operandVal
          },
          rhsUnsimplified: null
        }
      },
      success: true
    };
  }

  // 2. Coefficient Stage
  if (state.stage === 'undo_coefficient') {
    if (state.currentB !== 0) {
      const msg = 'NOT YET — Undo the constant term first!';
      return {
        state: { ...state, errorMessage: msg },
        success: false,
        notYet: true,
        guideMessage: msg
      };
    }

    const isDivision = Boolean(state.problem.d && state.problem.d > 1);
    const expectedBlaster: BlasterType = isDivision ? '×' : '÷';
    const operandVal = isDivision ? state.problem.d! : state.currentA;

    if (activeBlaster !== expectedBlaster) {
      const msg = isDivision
        ? `Wrong blaster! Use the × blaster to multiply both sides by ${operandVal}.`
        : `Wrong blaster! Use the ÷ blaster to divide both sides by ${operandVal}.`;
      return {
        state: { ...state, errorMessage: msg },
        success: false,
        notYet: true,
        guideMessage: msg
      };
    }

    // Correct blaster: pop coefficient/denominator
    const history = [...state.history, saveSnapshot(state)];
    const scaleTilt: ScaleTilt = isDivision ? 'lhs_heavy' : 'lhs_light';

    return {
      state: {
        ...state,
        history,
        phase: 'blasting_rhs',
        errorMessage: null,
        blasterState: {
          ...(state.blasterState || createInitialBlasterState()),
          equipped: activeBlaster,
          scaleTilt,
          carriedOperand: {
            operator: isDivision ? '×' : '÷',
            value: operandVal
          },
          rhsUnsimplified: null
        }
      },
      success: true
    };
  }

  return { state, success: false };
}

export function blastRhs(
  state: EquationState
): { state: EquationState; success: boolean } {
  if (state.phase !== 'blasting_rhs' || !state.blasterState?.carriedOperand) {
    return { state, success: false };
  }

  const history = [...state.history, saveSnapshot(state)];
  const { operator, value } = state.blasterState.carriedOperand;

  const rhsUnsimplified: UnsimplifiedExpression = {
    leftNum: state.currentC,
    op: operator,
    rightNum: value,
    displayText: `${state.currentC} ${operator === '-' ? '−' : operator} ${value}`
  };

  return {
    state: {
      ...state,
      history,
      phase: 'awaiting_simplify',
      errorMessage: null,
      blasterState: {
        ...state.blasterState,
        scaleTilt: 'balanced',
        carriedOperand: null,
        rhsUnsimplified
      }
    },
    success: true
  };
}

export function blastSimplify(
  state: EquationState,
  blaster?: BlasterType,
  rng: () => number = Math.random
): { state: EquationState; success: boolean; notYet?: boolean; guideMessage?: string } {
  if (state.phase !== 'awaiting_simplify' || !state.blasterState?.rhsUnsimplified) {
    return { state, success: false };
  }

  const activeBlaster = blaster || state.blasterState?.equipped;
  if (activeBlaster !== 'calc') {
    const msg = 'Equip the Calculator blaster on the left to simplify!';
    return {
      state: { ...state, errorMessage: msg },
      success: false,
      notYet: true,
      guideMessage: msg
    };
  }

  const { leftNum, op, rightNum } = state.blasterState.rhsUnsimplified;
  const pendingArithmetic = createPendingArithmetic(
    leftNum,
    rightNum,
    op,
    rng
  );

  const history = [...state.history, saveSnapshot(state)];

  return {
    state: {
      ...state,
      history,
      phase: 'question',
      pendingArithmetic,
      errorMessage: null
    },
    success: true
  };
}

export function generateModeDInverseChoices(
  targetTerm: 'constant' | 'coefficient',
  currentA: number,
  currentB: number,
  currentC: number,
  rng: () => number = Math.random,
  d?: number
): InverseChoice[] {
  let correctOp: OperationSign;
  let correctVal: number;
  let sameOp: OperationSign;
  const rhsVal = Math.abs(currentC);

  if (targetTerm === 'constant') {
    const isNeg = currentB < 0;
    const absB = Math.abs(currentB);
    correctOp = isNeg ? '+' : '−';
    sameOp = isNeg ? '−' : '+';
    correctVal = absB;
  } else if (d && d > 1) {
    correctOp = '×';
    sameOp = '÷';
    correctVal = d;
  } else {
    correctOp = '÷';
    sameOp = '×';
    correctVal = currentA;
  }

  const choices: InverseChoice[] = [
    {
      id: 'inv-correct',
      operator: correctOp,
      operand: correctVal,
      displayText: `${correctOp}${correctVal}`,
      isCorrect: true
    },
    {
      id: 'inv-distractor-same-op',
      operator: sameOp,
      operand: correctVal,
      displayText: `${sameOp}${correctVal}`,
      isCorrect: false
    },
    {
      id: 'inv-distractor-rhs-inv',
      operator: correctOp,
      operand: rhsVal,
      displayText: `${correctOp}${rhsVal}`,
      isCorrect: false
    },
    {
      id: 'inv-distractor-rhs-same',
      operator: sameOp,
      operand: rhsVal,
      displayText: `${sameOp}${rhsVal}`,
      isCorrect: false
    }
  ];

  // If distractor operand duplicates correct choice, adjust distractor operand so all 4 choices are unique
  const seen = new Set<string>();
  for (let i = 0; i < choices.length; i++) {
    let key = choices[i].displayText;
    if (seen.has(key)) {
      const newOperand = choices[i].operand + 2;
      choices[i].operand = newOperand;
      choices[i].displayText = `${choices[i].operator}${newOperand}`;
    }
    seen.add(choices[i].displayText);
  }

  return shuffleArray(choices, rng);
}

export function identifyModeDTarget(
  state: EquationState,
  term: 'constant' | 'coefficient',
  rng: () => number = Math.random
): { state: EquationState; success: boolean; notYet?: boolean; guideMessage?: string } {
  if (state.mode !== 'mode_d' || state.phase !== 'ready') {
    return { state, success: false };
  }

  if (term === 'coefficient' && state.currentB !== 0) {
    const signStr = state.currentB < 0 ? '−' : '+';
    const val = Math.abs(state.currentB);
    const msg = `NOT YET — Undo ${signStr}${val} first!`;
    return {
      state: { ...state, errorMessage: msg },
      success: false,
      notYet: true,
      guideMessage: msg
    };
  }

  const choices = generateModeDInverseChoices(
    term,
    state.currentA,
    state.currentB,
    state.currentC,
    rng,
    state.problem.d
  );

  const history = [...state.history, saveSnapshot(state)];

  return {
    state: {
      ...state,
      history,
      phase: 'choose_inverse',
      errorMessage: null,
      modeDState: {
        ...(state.modeDState || createInitialModeDState()),
        targetTerm: term,
        inverseChoices: choices,
        selectedInverse: null,
        blastedLhs: false,
        blastedRhs: false,
        tiltAngle: 0,
        lhsUnsimplified: null,
        rhsUnsimplified: null,
        simplifiedLhs: false,
        simplifiedRhs: false,
        activeSimplifyingSide: null
      }
    },
    success: true
  };
}

export function selectModeDInverse(
  state: EquationState,
  choiceId: string
): { state: EquationState; success: boolean; notYet?: boolean; guideMessage?: string } {
  if (state.mode !== 'mode_d' || state.phase !== 'choose_inverse' || !state.modeDState) {
    return { state, success: false };
  }

  const choice = state.modeDState.inverseChoices.find(c => c.id === choiceId);
  if (!choice) return { state, success: false };

  if (!choice.isCorrect) {
    const targetStr = state.modeDState.targetTerm === 'constant'
      ? (state.currentB < 0 ? `−${Math.abs(state.currentB)}` : `+${state.currentB}`)
      : `×${state.currentA}`;
    const msg = `Not quite! ${choice.displayText} does not blast away ${targetStr}. Try another choice!`;
    return {
      state: { ...state, errorMessage: msg },
      success: false,
      notYet: true,
      guideMessage: msg
    };
  }

  const history = [...state.history, saveSnapshot(state)];

  return {
    state: {
      ...state,
      history,
      phase: 'blast_first_side',
      errorMessage: null,
      modeDState: {
        ...state.modeDState,
        selectedInverse: choice
      },
      blasterState: {
        equipped: choice.operator as BlasterType,
        scaleTilt: 'balanced',
        carriedOperand: {
          operator: choice.operator,
          value: choice.operand
        },
        rhsUnsimplified: null
      }
    },
    success: true
  };
}

export function calculateModeDTiltAngle(
  blastedSide: 'lhs' | 'rhs',
  operator: OperationSign,
  operand: number
): number {
  let magnitude: number;
  if (operator === '+' || operator === '-' || operator === '−') {
    magnitude = Math.min(24, 10 + (operand - 1) * 2);
  } else {
    magnitude = Math.min(30, 16 + (operand - 2) * 4);
  }

  const isHeavier = operator === '+' || operator === '×';
  if (blastedSide === 'lhs') {
    return isHeavier ? magnitude : -magnitude;
  } else {
    return isHeavier ? -magnitude : magnitude;
  }
}

export function blastModeDSide(
  state: EquationState,
  side: 'lhs' | 'rhs'
): { state: EquationState; success: boolean; alreadyBlasted?: boolean } {
  if (state.mode !== 'mode_d' || !state.modeDState || !state.modeDState.selectedInverse) {
    return { state, success: false };
  }

  const { selectedInverse, blastedLhs, blastedRhs } = state.modeDState;

  if ((side === 'lhs' && blastedLhs) || (side === 'rhs' && blastedRhs)) {
    return { state, success: false, alreadyBlasted: true };
  }

  if (state.phase === 'blast_first_side') {
    const history = [...state.history, saveSnapshot(state)];
    const tiltAngle = calculateModeDTiltAngle(side, selectedInverse.operator, selectedInverse.operand);

    let lhsUnsimplified = state.modeDState.lhsUnsimplified;
    let rhsUnsimplified = state.modeDState.rhsUnsimplified;

    if (side === 'lhs') {
      const isDivision = Boolean(state.problem.d && state.problem.d > 1);
      if (selectedInverse.operator === '÷') {
        lhsUnsimplified = `(${state.currentA}/${selectedInverse.operand})Y`;
      } else if (selectedInverse.operator === '×') {
        const denom = isDivision ? state.problem.d! : 1;
        lhsUnsimplified = `(Y/${denom}) * ${selectedInverse.operand}`;
      } else {
        const leftVar = isDivision
          ? `Y ÷ ${state.problem.d}`
          : (state.currentA > 1 ? `${state.currentA}Y` : 'Y');
        const origB = state.currentB < 0 ? `− ${Math.abs(state.currentB)}` : `+ ${state.currentB}`;
        lhsUnsimplified = `${leftVar} ${origB} ${selectedInverse.operator} ${selectedInverse.operand}`;
      }
    } else {
      if (selectedInverse.operator === '÷') {
        rhsUnsimplified = `${state.currentC}/${selectedInverse.operand}`;
      } else if (selectedInverse.operator === '×') {
        rhsUnsimplified = `${state.currentC} × ${selectedInverse.operand}`;
      } else {
        rhsUnsimplified = `${state.currentC} ${selectedInverse.operator} ${selectedInverse.operand}`;
      }
    }

    return {
      state: {
        ...state,
        history,
        phase: 'blast_second_side',
        errorMessage: null,
        modeDState: {
          ...state.modeDState,
          blastedLhs: side === 'lhs',
          blastedRhs: side === 'rhs',
          tiltAngle,
          lhsUnsimplified,
          rhsUnsimplified
        },
        blasterState: {
          ...(state.blasterState || createInitialBlasterState()),
          scaleTilt: tiltAngle > 0 ? 'lhs_heavy' : 'lhs_light',
          carriedOperand: {
            operator: selectedInverse.operator,
            value: selectedInverse.operand
          }
        }
      },
      success: true
    };
  }

  if (state.phase === 'blast_second_side') {
    const history = [...state.history, saveSnapshot(state)];

    let lhsUnsimplified = state.modeDState.lhsUnsimplified;
    let rhsUnsimplified = state.modeDState.rhsUnsimplified;

    if (side === 'lhs') {
      const isDivision = Boolean(state.problem.d && state.problem.d > 1);
      if (selectedInverse.operator === '÷') {
        lhsUnsimplified = `(${state.currentA}/${selectedInverse.operand})Y`;
      } else if (selectedInverse.operator === '×') {
        const denom = isDivision ? state.problem.d! : 1;
        lhsUnsimplified = `(Y/${denom}) * ${selectedInverse.operand}`;
      } else {
        const leftVar = isDivision
          ? `Y ÷ ${state.problem.d}`
          : (state.currentA > 1 ? `${state.currentA}Y` : 'Y');
        const origB = state.currentB < 0 ? `− ${Math.abs(state.currentB)}` : `+ ${state.currentB}`;
        lhsUnsimplified = `${leftVar} ${origB} ${selectedInverse.operator} ${selectedInverse.operand}`;
      }
    } else {
      if (selectedInverse.operator === '÷') {
        rhsUnsimplified = `${state.currentC}/${selectedInverse.operand}`;
      } else if (selectedInverse.operator === '×') {
        rhsUnsimplified = `${state.currentC} × ${selectedInverse.operand}`;
      } else {
        rhsUnsimplified = `${state.currentC} ${selectedInverse.operator} ${selectedInverse.operand}`;
      }
    }

    return {
      state: {
        ...state,
        history,
        phase: 'awaiting_simplify',
        errorMessage: null,
        modeDState: {
          ...state.modeDState,
          blastedLhs: true,
          blastedRhs: true,
          tiltAngle: 0,
          lhsUnsimplified,
          rhsUnsimplified,
          simplifiedLhs: false,
          simplifiedRhs: false,
          activeSimplifyingSide: null
        },
        blasterState: {
          equipped: null,
          scaleTilt: 'balanced',
          carriedOperand: null,
          rhsUnsimplified: null
        }
      },
      success: true
    };
  }

  return { state, success: false };
}

export function activateModeDSimplify(
  state: EquationState,
  side: 'lhs' | 'rhs',
  rng: () => number = Math.random
): { state: EquationState; success: boolean } {
  if (state.mode !== 'mode_d' || state.phase !== 'awaiting_simplify' || !state.modeDState) {
    return { state, success: false };
  }

  if (side === 'lhs' && state.modeDState.simplifiedLhs) {
    return { state, success: false };
  }
  if (side === 'rhs' && state.modeDState.simplifiedRhs) {
    return { state, success: false };
  }

  const history = [...state.history, saveSnapshot(state)];
  const selectedInverse = state.modeDState.selectedInverse!;
  let pendingArithmetic: PendingArithmetic;

  if (side === 'lhs') {
    if (state.modeDState.targetTerm === 'constant') {
      const absB = Math.abs(state.currentB);
      const inverseOperand = selectedInverse.operator === '+' ? absB : -absB;
      pendingArithmetic = {
        operand1: state.currentB,
        operand2: Math.abs(inverseOperand),
        operator: inverseOperand >= 0 ? '+' : '-',
        correctAnswer: 0,
        choices: shuffleArray([0, absB, -absB], rng),
        explanation: `${state.currentB} ${inverseOperand >= 0 ? '+' : '−'} ${Math.abs(inverseOperand)} = 0 (Cancels to zero!)`,
        wrongHint: `Adding and subtracting the same number cancels to zero.`
      };
    } else {
      const isDivision = Boolean(state.problem.d && state.problem.d > 1);
      const val = isDivision ? state.problem.d! : state.currentA;
      pendingArithmetic = {
        operand1: val,
        operand2: val,
        operator: '÷',
        correctAnswer: 1,
        choices: shuffleArray([1, val, 0], rng),
        explanation: `${val} ÷ ${val} = 1 (Cancels out to leave Y!)`,
        wrongHint: `Any number divided by itself is 1.`
      };
    }
  } else {
    const c = state.currentC;
    const val = selectedInverse.operand;
    const op = selectedInverse.operator;
    pendingArithmetic = createPendingArithmetic(c, val, op, rng);
  }

  return {
    state: {
      ...state,
      history,
      phase: 'question',
      pendingArithmetic,
      modeDState: {
        ...state.modeDState,
        activeSimplifyingSide: side
      }
    },
    success: true
  };
}

export function cancelCarry(state: EquationState): EquationState {
  if (state.phase !== 'carrying' && state.phase !== 'forging') return state;
  return {
    ...state,
    phase: 'ready',
    carriedTerm: null,
    forgedOperation: null,
    balancedDisplay: null,
    errorMessage: null
  };
}

export function commitDrop(
  state: EquationState,
  rng: () => number = Math.random
): { state: EquationState; success: boolean } {
  if (state.phase !== 'carrying' || !state.carriedTerm) {
    return { state, success: false };
  }

  const history = [...state.history, saveSnapshot(state)];
  const term = state.carriedTerm;

  if (term === 'constant') {
    const b = state.currentB;
    const isNegative = b < 0;
    const absB = Math.abs(b);
    const op = isNegative ? '+' : '-';
    
    // Caption & cancellation
    const caption = isNegative ? `Add ${absB} to both sides.` : `Subtract ${absB} from both sides.`;
    const isDivision = Boolean(state.problem.d && state.problem.d > 1);
    const leftSymbol = isDivision
      ? `Y ÷ ${state.problem.d}`
      : (state.currentA === 1 ? 'Y' : `${state.currentA} x Y`);
    const origSign = isNegative ? '−' : '+';
    const balanceSign = isNegative ? '+' : '−';

    const cancellation: CancellationDisplay = {
      leftExpr: `${leftSymbol} ${origSign} ${absB} ${balanceSign} ${absB}`,
      rightExpr: `${state.currentC} ${op === '+' ? '+' : '−'} ${absB}`,
      cancellingPart: `${origSign} ${absB} ${balanceSign} ${absB}`,
      caption
    };

    const pendingArithmetic: PendingArithmetic = createPendingArithmetic(
      state.currentC,
      absB,
      op,
      rng
    );

    return {
      state: {
        ...state,
        history,
        phase: 'question',
        carriedTerm: null,
        cancellation,
        pendingArithmetic,
        errorMessage: null
      },
      success: true
    };
  }

  if (term === 'coefficient') {
    const isDivision = Boolean(state.problem.d && state.problem.d > 1);
    if (isDivision) {
      const d = state.problem.d!;
      const caption = `Multiply both sides by ${d}.`;
      const cancellation: CancellationDisplay = {
        leftExpr: `(Y ÷ ${d}) × ${d}`,
        rightExpr: `${state.currentC} × ${d}`,
        cancellingPart: `÷ ${d} × ${d}`,
        caption
      };
      const pendingArithmetic: PendingArithmetic = createPendingArithmetic(
        state.currentC,
        d,
        '×',
        rng
      );
      return {
        state: {
          ...state,
          history,
          phase: 'question',
          carriedTerm: null,
          cancellation,
          pendingArithmetic,
          errorMessage: null
        },
        success: true
      };
    }

    const a = state.currentA;
    const caption = `Divide both sides by ${a}.`;

    const cancellation: CancellationDisplay = {
      leftExpr: `(${a} x Y) / ${a}`,
      rightExpr: `${state.currentC}/${a}`,
      cancellingPart: `${a}/`,
      caption
    };

    const pendingArithmetic: PendingArithmetic = createPendingArithmetic(
      state.currentC,
      a,
      '÷',
      rng
    );

    return {
      state: {
        ...state,
        history,
        phase: 'question',
        carriedTerm: null,
        cancellation,
        pendingArithmetic,
        errorMessage: null
      },
      success: true
    };
  }

  return { state, success: false };
}

export function submitAnswer(
  state: EquationState,
  answer: number
): { state: EquationState; correct: boolean; hint?: string } {
  const isParallelModeBStep = state.mode === 'mode_b'
    && state.phase === 'awaiting_cleanup'
    && !!state.balancedDisplay?.rhsActivated;
  if ((state.phase !== 'question' && !isParallelModeBStep) || !state.pendingArithmetic) {
    return { state, correct: false };
  }

  const isCorrect = answer === state.pendingArithmetic.correctAnswer;

  if (!isCorrect) {
    return {
      state: {
        ...state,
        errorMessage: state.pendingArithmetic.wrongHint
      },
      correct: false,
      hint: state.pendingArithmetic.wrongHint
    };
  }

  const history = [...state.history, saveSnapshot(state)];

  if (isParallelModeBStep && state.balancedDisplay) {
    const answeredState: EquationState = {
      ...state,
      history,
      currentC: state.pendingArithmetic.correctAnswer,
      balancedDisplay: {
        ...state.balancedDisplay,
        rhsSolved: true
      },
      errorMessage: null
    };
    return {
      state: state.balancedDisplay.lhsCleaned ? completeModeBStep(answeredState) : answeredState,
      correct: true
    };
  }

  // Mode D two-step simplification handling
  if (state.mode === 'mode_d' && state.modeDState && state.modeDState.activeSimplifyingSide) {
    const side = state.modeDState.activeSimplifyingSide;
    const isLhs = side === 'lhs';
    const newSimplifiedLhs = isLhs ? true : state.modeDState.simplifiedLhs;
    const newSimplifiedRhs = !isLhs ? true : state.modeDState.simplifiedRhs;
    const bothSimplified = newSimplifiedLhs && newSimplifiedRhs;

    let newC = state.currentC;
    let newA = state.currentA;
    let newB = state.currentB;

    if (!isLhs) {
      newC = state.pendingArithmetic.correctAnswer;
    }

    if (bothSimplified) {
      if (state.stage === 'undo_constant') {
        newB = 0;
      } else if (state.stage === 'undo_coefficient') {
        newA = 1;
      }
    }

    const isDivision = Boolean(state.problem.d && state.problem.d > 1);
    const nextStage = bothSimplified
      ? (newB !== 0
          ? 'undo_constant'
          : ((newA > 1 || (state.stage !== 'undo_coefficient' && isDivision)) ? 'undo_coefficient' : 'solved'))
      : state.stage;

    const nextPhase: GamePhase = bothSimplified
      ? (nextStage === 'solved' ? 'solved' : 'ready')
      : 'awaiting_simplify';

    const updatedEquationHistory = [...state.equationHistory];
    if (bothSimplified) {
      const line = formatEquationLine(
        newA,
        newB,
        newC,
        true,
        (nextStage !== 'solved' && isDivision) ? state.problem.d : undefined
      );
      if (!updatedEquationHistory.includes(line)) {
        updatedEquationHistory.push(line);
      }
    }

    return {
      state: {
        ...state,
        history,
        equationHistory: updatedEquationHistory,
        currentA: newA,
        currentB: newB,
        currentC: newC,
        stage: nextStage,
        phase: nextPhase,
        modeDState: {
          ...state.modeDState,
          simplifiedLhs: newSimplifiedLhs,
          simplifiedRhs: newSimplifiedRhs,
          activeSimplifyingSide: null,
          targetTerm: bothSimplified ? null : state.modeDState.targetTerm,
          selectedInverse: bothSimplified ? null : state.modeDState.selectedInverse,
          blastedLhs: bothSimplified ? false : state.modeDState.blastedLhs,
          blastedRhs: bothSimplified ? false : state.modeDState.blastedRhs,
          lhsUnsimplified: bothSimplified ? null : state.modeDState.lhsUnsimplified,
          rhsUnsimplified: bothSimplified ? null : state.modeDState.rhsUnsimplified,
          tiltAngle: 0
        },
        blasterState: {
          equipped: null,
          scaleTilt: 'balanced',
          carriedOperand: null,
          rhsUnsimplified: null
        },
        pendingArithmetic: null,
        errorMessage: null
      },
      correct: true
    };
  }

  const isDivision = Boolean(state.problem.d && state.problem.d > 1);
  // Record completed line before simplifying state
  let completedLine: string;
  if ((state.mode === 'mode_b' || state.mode === 'mode_c') && state.pendingArithmetic) {
    completedLine = formatUnsimplifiedEquationLine(
      state.currentA,
      state.stage,
      state.currentC,
      state.pendingArithmetic,
      isDivision ? state.problem.d : undefined
    );
  } else {
    completedLine = formatEquationLine(
      state.currentA,
      state.currentB,
      state.currentC,
      false,
      isDivision ? state.problem.d : undefined
    );
  }
  const updatedEquationHistory = state.equationHistory.includes(completedLine)
    ? [...state.equationHistory]
    : [...state.equationHistory, completedLine];

  // Correct answer! Advance equation
  const newC = state.pendingArithmetic.correctAnswer;
  let newA = state.currentA;
  let newB = state.currentB;

  // Determine which move was just solved
  if (state.stage === 'undo_constant') {
    newB = 0;
  } else if (state.stage === 'undo_coefficient') {
    newA = 1;
  }
  const nextStage = newB !== 0
    ? 'undo_constant'
    : ((newA > 1 || (state.stage !== 'undo_coefficient' && isDivision)) ? 'undo_coefficient' : 'solved');

  const nextBlasterState = state.mode === 'mode_c'
    ? {
        equipped: state.blasterState?.equipped || null,
        scaleTilt: 'balanced' as ScaleTilt,
        carriedOperand: null,
        rhsUnsimplified: null
      }
    : undefined;

  return {
    state: {
      ...state,
      history,
      equationHistory: updatedEquationHistory,
      currentA: newA,
      currentB: newB,
      currentC: newC,
      stage: nextStage,
      phase: nextStage === 'solved' ? 'solved' : 'ready',
      carriedTerm: null,
      forgedOperation: null,
      balancedDisplay: null,
      blasterState: nextBlasterState,
      cancellation: null,
      pendingArithmetic: null,
      errorMessage: null
    },
    correct: true
  };
}

export function undo(state: EquationState): { state: EquationState; success: boolean } {
  if (state.history.length === 0) {
    return { state, success: false };
  }

  const history = [...state.history];
  const last = history.pop()!;

  return {
    state: {
      ...state,
      history,
      mode: last.mode || state.mode,
      currentA: last.currentA,
      currentB: last.currentB,
      currentC: last.currentC,
      stage: last.stage,
      phase: last.phase,
      carriedTerm: last.carriedTerm,
      forgedOperation: last.forgedOperation,
      balancedDisplay: last.balancedDisplay,
      blasterState: last.blasterState ? { ...last.blasterState } : ((state.mode === 'mode_c' || state.mode === 'mode_d') ? createInitialBlasterState() : undefined),
      modeDState: last.modeDState ? {
        ...last.modeDState,
        inverseChoices: [...last.modeDState.inverseChoices]
      } : (state.mode === 'mode_d' ? createInitialModeDState() : undefined),
      pendingArithmetic: last.pendingArithmetic,
      equationHistory: last.equationHistory || [],
      cancellation: null,
      errorMessage: null
    },
    success: true
  };
}


export function formatVerification(problem: LinearEquationDef): {
  subStep: string;
  evalStep: string;
  finalStep: string;
} {
  const { a, b, c, solution } = problem;
  let subStep = '';
  if (a === 1) {
    subStep = b === 0 ? `${solution} = ${c}` : `${solution} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`;
  } else {
    subStep = b === 0 ? `${a} x ${solution} = ${c}` : `${a} x ${solution} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`;
  }

  const evalStep = b === 0 
    ? `${a * solution} = ${c}` 
    : `${a * solution} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`;

  const finalStep = `${c} = ${c}`;

  return {
    subStep,
    evalStep,
    finalStep
  };
}
