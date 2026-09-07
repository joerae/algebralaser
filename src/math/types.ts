export type EquationFamily = 
  | 'x_plus_b'    // Y + b = c
  | 'x_minus_b'   // Y - b = c
  | 'ax'          // a x Y = c
  | 'ax_plus_b'   // a x Y + b = c
  | 'ax_minus_b'; // a x Y - b = c

export interface LinearEquationDef {
  id: string;
  family: EquationFamily;
  a: number;         // coefficient of Y (>= 1)
  b: number;         // constant term (can be positive, negative, or 0)
  c: number;         // right-hand side constant
  solution: number;  // Y value
  description?: string;
}

export type SolverStage = 
  | 'undo_constant'     // when b != 0, move constant across
  | 'undo_coefficient'  // when b == 0 and a > 1, divide by coefficient
  | 'solved';           // when a == 1 and b == 0

export type GamePhase =
  | 'ready'       // waiting for player to grab a term
  | 'carrying'    // term picked up, aiming at destination
  | 'cancelling'  // brief visual cancellation animation
  | 'question'    // unsimplified equation committed, awaiting arithmetic choice
  | 'feedback'    // brief feedback after answering (merging / success)
  | 'solved'      // puzzle completed, showing verification
  | 'paused';     // paused state

export interface PendingArithmetic {
  operand1: number;
  operand2: number;
  operator: '+' | '-' | '×' | '÷';
  correctAnswer: number;
  choices: number[]; // exactly 3 choices, shuffled
  explanation: string;
  wrongHint: string;
}

export interface CancellationDisplay {
  leftExpr: string;       // e.g. "3 x Y - 1 + 1" or "(3 x Y)/3"
  rightExpr: string;      // e.g. "11 + 1" or "12/3"
  cancellingPart: string; // e.g. "- 1 + 1" or "/3"
  caption: string;        // e.g. "Add 1 to both sides" or "Divide both sides by 3"
}

export interface EquationState {
  problem: LinearEquationDef;
  currentA: number;
  currentB: number;
  currentC: number;
  stage: SolverStage;
  phase: GamePhase;
  carriedTerm: 'constant' | 'coefficient' | null;
  pendingArithmetic: PendingArithmetic | null;
  cancellation: CancellationDisplay | null;
  errorMessage: string | null;
  equationHistory: string[]; // Running list of previous equation lines
  history: HistorySnapshot[];
}

export interface HistorySnapshot {
  currentA: number;
  currentB: number;
  currentC: number;
  stage: SolverStage;
  phase: GamePhase;
  carriedTerm: 'constant' | 'coefficient' | null;
  pendingArithmetic: PendingArithmetic | null;
  equationHistory: string[];
}
