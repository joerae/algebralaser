import { GameController } from './gameController';
import { LaserRay, RayHitResult, ClassifiedPose } from '../vision/types';
import { soundManager } from '../audio/soundEffects';
import { OperationSign, BlasterType, SolverMode } from '../math/types';
import { ModeInteractionHandler, ModeVisionContext, ModeKeyContext, ModeInteractionCallbacks } from './modes/types';
import { ModeACarrier } from './modes/modeACarrier';
import { ModeBForgeHandler } from './modes/modeBForgeHandler';
import { ModeCBlasterHandler } from './modes/modeCBlasterHandler';
import { ModeDBlastSidesHandler } from './modes/modeDBlastSidesHandler';

export interface InteractionState {
  laserRay: LaserRay | null;
  hoveredTargetId: string | null;
  dwellProgress: number; // 0 to 1
  dwellTargetId: string | null;
  carriedPosition: { x: number; y: number } | null;
  isDestinationHovered: boolean;
  activeHandId: number | null;
  trackingLostTimer: number | null;
  openPalmProgress: number; // 0 to 1 for open palm advance
}

export class InteractionController {
  private game: GameController;
  private state: InteractionState = {
    laserRay: null,
    hoveredTargetId: null,
    dwellProgress: 0,
    dwellTargetId: null,
    carriedPosition: null,
    isDestinationHovered: false,
    activeHandId: null,
    trackingLostTimer: null,
    openPalmProgress: 0
  };

  public dwellDurationMs: number = 450;
  public forgeDwellDurationMs: number = 1000;
  public onDropRequested?: () => void;
  public onNotYetRequested?: (term: 'coefficient') => void;
  public onForgeRequested?: (sign: OperationSign) => void;
  public onApplyEqualsRequested?: () => void;
  public onModeBCleanupRequested?: () => void;
  public onModeBPickupRequested?: (term: 'constant' | 'coefficient', source: { x: number; y: number }, finger: { x: number; y: number }) => void;
  public onBlasterSelected?: (blaster: BlasterType) => void;
  public onSmashLhsRequested?: () => void;
  public onBlastRhsRequested?: () => void;
  public onBlastSimplifyRequested?: () => void;
  public onModeDInverseRequested?: (choiceId: string) => void;

  private lastDwellTargetId: string | null = null;
  private lastDwellTime: number = 0;
  private openPalmStartTime: number = 0;
  private questionEnterGuard: boolean = false; // prevents auto-submit upon new question appearing
  private lastPhase: string = 'ready';

  private modeHandlers: Record<SolverMode, ModeInteractionHandler>;

  constructor(game: GameController) {
    this.game = game;
    this.modeHandlers = {
      mode_a: new ModeACarrier(),
      mode_b: new ModeBForgeHandler(),
      mode_c: new ModeCBlasterHandler(),
      mode_d: new ModeDBlastSidesHandler()
    };
  }

  public getState(): InteractionState {
    return this.state;
  }

  private getCallbacks(): ModeInteractionCallbacks {
    return {
      onDropRequested: this.onDropRequested,
      onNotYetRequested: this.onNotYetRequested,
      onForgeRequested: this.onForgeRequested,
      onApplyEqualsRequested: this.onApplyEqualsRequested,
      onModeBCleanupRequested: this.onModeBCleanupRequested,
      onModeBPickupRequested: this.onModeBPickupRequested,
      onBlasterSelected: this.onBlasterSelected,
      onSmashLhsRequested: this.onSmashLhsRequested,
      onBlastRhsRequested: this.onBlastRhsRequested,
      onBlastSimplifyRequested: this.onBlastSimplifyRequested,
      onModeDInverseRequested: this.onModeDInverseRequested
    };
  }

  // Update loop called every animation frame with latest vision ray & pose
  public updateVisionFrame(
    ray: LaserRay | null,
    pose: ClassifiedPose | null,
    hit: RayHitResult | null,
    now: number
  ) {
    const gameState = this.game.getState();
    this.state.laserRay = ray;

    // Reset dwell cleanly on phase transitions
    if (this.lastPhase !== gameState.phase) {
      this.resetDwell();
      this.lastDwellTargetId = null;
      this.questionEnterGuard = false;
      this.lastPhase = gameState.phase;
    }

    // Tracking missing guard
    if (!pose) {
      const handler = this.modeHandlers[gameState.mode];
      handler?.onTrackingLost?.(gameState, this.state, this.game, now);
      this.resetDwell();
      this.state.hoveredTargetId = null;
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;
      return;
    }

    this.state.trackingLostTimer = null;

    // Shared Phase: QUESTION (Dwell confirmation on answer cards)
    if (gameState.phase === 'question') {
      this.handleQuestionPhase(ray, pose, hit, now);
      return;
    }

    // Shared Phase: SOLVED (Open palm or Next/Replay dwell)
    if (gameState.phase === 'solved') {
      this.handleSolvedPhase(ray, pose, hit, now);
      return;
    }

    // Mode-specific interaction handling
    const ctx: ModeVisionContext = {
      ray,
      pose,
      hit,
      now,
      gameState,
      interState: this.state,
      game: this.game,
      callbacks: this.getCallbacks(),
      dwellDurationMs: this.dwellDurationMs,
      lastDwellTargetId: this.lastDwellTargetId,
      lastDwellTime: this.lastDwellTime,
      setDwellState: (targetId, progress, lastTargetId, lastTime) => {
        this.state.dwellTargetId = targetId;
        this.state.dwellProgress = progress;
        this.lastDwellTargetId = lastTargetId;
        this.lastDwellTime = lastTime;
      },
      resetDwell: () => this.resetDwell()
    };

    const handler = this.modeHandlers[gameState.mode];
    if (handler) {
      handler.onVisionFrame(ctx);
    }
  }

  private handleQuestionPhase(
    ray: LaserRay | null,
    pose: ClassifiedPose,
    hit: RayHitResult | null,
    now: number
  ) {
    this.state.carriedPosition = null;
    this.state.isDestinationHovered = false;
    this.openPalmStartTime = 0;
    this.state.openPalmProgress = 0;

    if (!ray || !ray.active) {
      this.state.hoveredTargetId = null;
      this.resetDwell();
      return;
    }

    if (hit && hit.targetType === 'answer' && pose.isPointing) {
      this.state.hoveredTargetId = hit.targetId;

      if (this.lastDwellTargetId !== hit.targetId) {
        this.lastDwellTargetId = hit.targetId;
        this.lastDwellTime = now;
        this.state.dwellProgress = 0;
        this.state.dwellTargetId = hit.targetId;
        this.questionEnterGuard = false;
      } else if (!this.questionEnterGuard) {
        const elapsed = now - this.lastDwellTime;
        const progress = Math.min(1.0, elapsed / this.dwellDurationMs);
        this.state.dwellProgress = progress;

        if (progress > 0.2 && Math.random() < 0.2) {
          soundManager.playDwellTick(progress);
        }

        if (progress >= 1.0) {
          const choiceVal = Number(hit.targetId.replace('answer-choice-', ''));
          if (!isNaN(choiceVal)) {
            this.game.answer(choiceVal);
          }
          this.resetDwell();
          this.questionEnterGuard = true;
        }
      }
    } else {
      this.state.hoveredTargetId = null;
      this.resetDwell();
      this.questionEnterGuard = false;
    }
  }

  private handleSolvedPhase(
    ray: LaserRay | null,
    pose: ClassifiedPose,
    hit: RayHitResult | null,
    now: number
  ) {
    // 1. Open palm gesture (500ms hold)
    if (pose.isOpenPalm) {
      if (!this.openPalmStartTime) {
        this.openPalmStartTime = now;
      }
      const elapsed = now - this.openPalmStartTime;
      this.state.openPalmProgress = Math.min(1.0, elapsed / 500);

      if (this.state.openPalmProgress > 0.2 && Math.random() < 0.2) {
        soundManager.playDwellTick(this.state.openPalmProgress);
      }

      if (this.state.openPalmProgress >= 1.0) {
        soundManager.playCorrect();
        this.game.nextLevel();
        this.openPalmStartTime = 0;
        this.state.openPalmProgress = 0;
        this.resetDwell();
        this.state.hoveredTargetId = null;
        return;
      }
    } else {
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;
    }

    // 2. Pointing with dwell on Next or Replay buttons
    if (ray && ray.active && hit && hit.targetType === 'utility' && pose.isPointing) {
      this.state.hoveredTargetId = hit.targetId;
      if (this.lastDwellTargetId !== hit.targetId) {
        this.lastDwellTargetId = hit.targetId;
        this.lastDwellTime = now;
        this.state.dwellProgress = 0;
        this.state.dwellTargetId = hit.targetId;
      } else {
        const elapsed = now - this.lastDwellTime;
        this.state.dwellProgress = Math.min(1.0, elapsed / this.dwellDurationMs);

        if (this.state.dwellProgress > 0.2 && Math.random() < 0.2) {
          soundManager.playDwellTick(this.state.dwellProgress);
        }

        if (this.state.dwellProgress >= 1.0) {
          soundManager.playCorrect();
          if (hit.targetId === 'btn-next') {
            this.game.nextLevel();
          } else if (hit.targetId === 'btn-replay') {
            this.game.restartLevel();
          }
          this.resetDwell();
        }
      }
    } else {
      this.resetDwell();
      this.state.hoveredTargetId = null;
    }
  }

  private resetDwell() {
    this.state.dwellProgress = 0;
    this.state.dwellTargetId = null;
    this.lastDwellTargetId = null;
  }

  // Keyboard navigation
  public handleKeyDown(e: KeyboardEvent): boolean {
    const gameState = this.game.getState();

    // Shared Undo: 'u' or Ctrl+Z
    if (e.key === 'u' || e.key === 'U' || (e.ctrlKey && e.key === 'z')) {
      return this.game.performUndo();
    }

    // Shared Hint: 'h'
    if (e.key === 'h' || e.key === 'H') {
      const hint = this.game.getHint();
      alert(hint);
      return true;
    }

    // Shared Answer Selection: 1, 2, 3
    if (gameState.phase === 'question' && gameState.pendingArithmetic) {
      const choices = gameState.pendingArithmetic.choices;
      if (e.key === '1' && choices[0] !== undefined) {
        this.game.answer(choices[0]);
        return true;
      }
      if (e.key === '2' && choices[1] !== undefined) {
        this.game.answer(choices[1]);
        return true;
      }
      if (e.key === '3' && choices[2] !== undefined) {
        this.game.answer(choices[2]);
        return true;
      }
    }

    // Shared Solved Advance: Enter or Space
    if (gameState.phase === 'solved' && (e.key === 'Enter' || e.key === ' ')) {
      this.game.nextLevel();
      return true;
    }

    // Delegate mode-specific shortcuts
    const keyCtx: ModeKeyContext = {
      e,
      gameState,
      game: this.game,
      callbacks: this.getCallbacks()
    };

    const handler = this.modeHandlers[gameState.mode];
    if (handler && handler.onKeyDown) {
      return handler.onKeyDown(keyCtx);
    }

    return false;
  }
}
