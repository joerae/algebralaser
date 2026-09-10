export type EquationFamily = 
  | 'x_plus_b'           // Y + b = c
  | 'x_minus_b'          // Y - b = c
  | 'ax'                 // a x Y = c
  | 'ax_plus_b'          // a x Y + b = c
  | 'ax_minus_b'         // a x Y - b = c
  | 'x_div_d'            // Y ÷ d = c
  | 'x_div_d_plus_b'     // Y ÷ d + b = c
  | 'x_div_d_minus_b';   // Y ÷ d - b = c

export interface LinearEquationDef {
  id: string;
  family: EquationFamily;
  a: number;         // coefficient of Y (>= 1, or 1 for division)
  b: number;         // constant term (can be positive, negative, or 0)
  c: number;         // right-hand side constant
  solution: number;  // Y value
  d?: number;        // denominator of Y for division equations (>= 2)
  description?: string;
}

export type SolverStage = 
  | 'undo_constant'     // when b != 0, move constant across
  | 'undo_coefficient'  // when b == 0 and a > 1, divide by coefficient
  | 'solved';           // when a == 1 and b == 0

export type SolverMode = 'mode_a' | 'mode_b' | 'mode_c' | 'mode_d';
export const DEFAULT_MODE: SolverMode = 'mode_b';

export type GamePhase =
  | 'ready'              // waiting for player to grab a term or fire blaster
  | 'carrying'           // term picked up, aiming at destination (Mode A)
  | 'forging'            // term picked up, forge panel active (Mode B)
  | 'applying'           // opposite operation forged, aiming at = sign (Mode B)
  | 'balancing'          // sequential apply-to-both-sides animation (Mode B)
  | 'awaiting_cleanup'   // applied inverse is visible and ready to blast away (Mode B)
  | 'cancelling'         // brief visual cancellation animation
  | 'blasting_rhs'       // LHS smashed free, operand carried, aiming at RHS (Mode C)
  | 'awaiting_simplify'  // RHS blasted, scale balanced, awaiting Calculator blaster (Mode C) / Mode D simplify prompt
  | 'choose_inverse'     // Mode D: 4 inverse operation choices displayed on left panel
  | 'blast_first_side'   // Mode D: inverse operation charged, aiming at first side of scale
  | 'blast_second_side'  // Mode D: scale tilted, aiming at unmatched second side
  | 'question'           // unsimplified equation committed, awaiting arithmetic choice
  | 'feedback'           // brief feedback after answering (merging / success)
  | 'solved'             // puzzle completed, showing verification
  | 'paused';            // paused state

export type OperationSign = '+' | '-' | '−' | '×' | '÷';

export type BlasterType = '+' | '-' | '−' | '×' | '÷' | 'calc';

export type ScaleTilt = 'balanced' | 'lhs_heavy' | 'lhs_light';

export interface CarriedOperand {
  operator: OperationSign;
  value: number;
}

export interface UnsimplifiedExpression {
  leftNum: number;
  op: OperationSign;
  rightNum: number;
  displayText: string;
}

export interface BlasterState {
  equipped: BlasterType | null;
  scaleTilt: ScaleTilt;
  carriedOperand: CarriedOperand | null;
  rhsUnsimplified: UnsimplifiedExpression | null;
}

export interface InverseChoice {
  id: string;
  operator: OperationSign;
  operand: number;
  displayText: string;
  isCorrect: boolean;
}

export interface ModeDState {
  targetTerm: 'constant' | 'coefficient' | null;
  inverseChoices: InverseChoice[];
  selectedInverse: InverseChoice | null;
  blastedLhs: boolean;
  blastedRhs: boolean;
  tiltAngle: number; // in degrees, e.g. -30 to +30
  lhsUnsimplified: string | null;
  rhsUnsimplified: string | null;
  simplifiedLhs: boolean;
  simplifiedRhs: boolean;
  activeSimplifyingSide: 'lhs' | 'rhs' | null;
}

export interface ForgedOperation {
  originalOperator: OperationSign;
  originalOperand: number;
  forgedOperator: OperationSign;
  forgedOperand: number;
}

export interface BalancedDisplay {
  leftBefore: string;
  leftAdded: string;
  rightBefore: string;
  rightAdded: string;
  fullBalancedLine: string;
  cancellingLhs: string;
  simplifiedLhs: string;
  lhsApplied: boolean;
  rhsApplied: boolean;
  lhsCleaned: boolean;
  rhsActivated: boolean;
  rhsSolved: boolean;
}

export interface PendingArithmetic {
  operand1: number;
  operand2: number;
  operator: OperationSign;
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
  mode: SolverMode;
  currentA: number;
  currentB: number;
  currentC: number;
  stage: SolverStage;
  phase: GamePhase;
  carriedTerm: 'constant' | 'coefficient' | null;
  forgedOperation: ForgedOperation | null;
  balancedDisplay: BalancedDisplay | null;
  blasterState?: BlasterState;
  modeDState?: ModeDState;
  pendingArithmetic: PendingArithmetic | null;
  cancellation: CancellationDisplay | null;
  errorMessage: string | null;
  equationHistory: string[]; // Running list of previous equation lines
  history: HistorySnapshot[];
}

export interface HistorySnapshot {
  mode: SolverMode;
  currentA: number;
  currentB: number;
  currentC: number;
  stage: SolverStage;
  phase: GamePhase;
  carriedTerm: 'constant' | 'coefficient' | null;
  forgedOperation: ForgedOperation | null;
  balancedDisplay: BalancedDisplay | null;
  blasterState?: BlasterState;
  modeDState?: ModeDState;
  pendingArithmetic: PendingArithmetic | null;
  equationHistory: string[];
}
