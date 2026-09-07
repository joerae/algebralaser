export type EquationFamily = 
  | 'x_plus_b'    // x + b = c
  | 'x_minus_b'   // x - b = c
  | 'ax'          // ax = c
  | 'ax_plus_b'   // ax + b = c
  | 'ax_minus_b'; // ax - b = c

export interface LinearEquationDef {
  id: string;
  family: EquationFamily;
  a: number;         // coefficient of x (>= 1)
  b: number;         // constant term (can be positive, negative, or 0)
  c: number;         // right-hand side constant
  solution: number;  // x value
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
  leftExpr: string;       // e.g. "3x - 1 + 1" or "(3x)/3"
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
}
