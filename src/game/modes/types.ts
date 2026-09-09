import { LaserRay, RayHitResult, ClassifiedPose } from '../../vision/types';
import { EquationState } from '../../math/types';
import { GameController } from '../gameController';
import { InteractionState } from '../interactionController';

export interface ModeInteractionCallbacks {
  onDropRequested?: () => void;
  onNotYetRequested?: (term: 'coefficient') => void;
  onForgeRequested?: (sign: '+' | '-' | '−' | '×' | '÷') => void;
  onApplyEqualsRequested?: () => void;
  onModeBCleanupRequested?: () => void;
  onModeBPickupRequested?: (term: 'constant' | 'coefficient', source: { x: number; y: number }, finger: { x: number; y: number }) => void;
  onBlasterSelected?: (blaster: '+' | '-' | '−' | '×' | '÷' | 'calc') => void;
  onSmashLhsRequested?: () => void;
  onBlastRhsRequested?: () => void;
  onBlastSimplifyRequested?: () => void;
  onModeDInverseRequested?: (choiceId: string) => void;
}

export interface ModeVisionContext {
  ray: LaserRay | null;
  pose: ClassifiedPose;
  hit: RayHitResult | null;
  now: number;
  gameState: EquationState;
  interState: InteractionState;
  game: GameController;
  callbacks: ModeInteractionCallbacks;
  dwellDurationMs: number;
  lastDwellTargetId: string | null;
  lastDwellTime: number;
  setDwellState: (targetId: string | null, progress: number, lastTargetId: string | null, lastTime: number) => void;
  resetDwell: () => void;
}

export interface ModeKeyContext {
  e: KeyboardEvent;
  gameState: EquationState;
  game: GameController;
  callbacks: ModeInteractionCallbacks;
}

export interface ModeInteractionHandler {
  onVisionFrame(ctx: ModeVisionContext): boolean;
  onKeyDown?(ctx: ModeKeyContext): boolean;
  onTrackingLost?(gameState: EquationState, interState: InteractionState, game: GameController, now: number): void;
}
