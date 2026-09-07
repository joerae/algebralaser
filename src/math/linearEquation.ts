import { 
  LinearEquationDef, 
  EquationState, 
  HistorySnapshot, 
  PendingArithmetic, 
  CancellationDisplay 
} from './types';
import { createPendingArithmetic } from './puzzleGenerator';

export function createInitialState(problem: LinearEquationDef): EquationState {
  const stage = problem.b !== 0 
    ? 'undo_constant' 
    : (problem.a > 1 ? 'undo_coefficient' : 'solved');

  return {
    problem,
    currentA: problem.a,
    currentB: problem.b,
    currentC: problem.c,
    stage,
    phase: stage === 'solved' ? 'solved' : 'ready',
    carriedTerm: null,
    pendingArithmetic: null,
    cancellation: null,
    errorMessage: null,
    history: []
  };
}

function saveSnapshot(state: EquationState): HistorySnapshot {
  return {
    currentA: state.currentA,
    currentB: state.currentB,
    currentC: state.currentC,
    stage: state.stage,
    phase: state.phase,
    carriedTerm: state.carriedTerm,
    pendingArithmetic: state.pendingArithmetic ? { ...state.pendingArithmetic } : null
  };
}

export function pickUpTerm(
  state: EquationState, 
  term: 'constant' | 'coefficient'
): { state: EquationState; success: boolean; guideMessage?: string } {
  if (state.phase !== 'ready') {
    return { state, success: false };
  }

  // Guided Solver Rule:
  // If constant is present (b != 0), player must undo the constant first!
  if (term === 'coefficient' && state.currentB !== 0) {
    const signStr = state.currentB < 0 ? '−' : '+';
    const val = Math.abs(state.currentB);
    return {
      state: {
        ...state,
        errorMessage: `First undo the ${signStr}${val}.`
      },
      success: false,
      guideMessage: `First undo the ${signStr}${val}.`
    };
  }

  if (term === 'constant' && state.currentB === 0) {
    return { state, success: false };
  }

  if (term === 'coefficient' && state.currentA <= 1) {
    return { state, success: false };
  }

  return {
    state: {
      ...state,
      phase: 'carrying',
      carriedTerm: term,
      errorMessage: null
    },
    success: true
  };
}

export function cancelCarry(state: EquationState): EquationState {
  if (state.phase !== 'carrying') return state;
  return {
    ...state,
    phase: 'ready',
    carriedTerm: null,
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
    const leftSymbol = state.currentA === 1 ? 'x' : `${state.currentA}x`;
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
    const a = state.currentA;
    const caption = `Divide both sides by ${a}.`;

    const cancellation: CancellationDisplay = {
      leftExpr: `(${a}x) / ${a}`,
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
  if (state.phase !== 'question' || !state.pendingArithmetic) {
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

  // Correct answer! Advance equation
  const history = [...state.history, saveSnapshot(state)];
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
    : (newA > 1 ? 'undo_coefficient' : 'solved');

  return {
    state: {
      ...state,
      history,
      currentA: newA,
      currentB: newB,
      currentC: newC,
      stage: nextStage,
      phase: nextStage === 'solved' ? 'solved' : 'ready',
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
      currentA: last.currentA,
      currentB: last.currentB,
      currentC: last.currentC,
      stage: last.stage,
      phase: last.phase,
      carriedTerm: last.carriedTerm,
      pendingArithmetic: last.pendingArithmetic,
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
    subStep = b === 0 ? `${a} × ${solution} = ${c}` : `${a} × ${solution} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}`;
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
