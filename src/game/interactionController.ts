import { GameController } from './gameController';
import { LaserRay, RayHitResult, ClassifiedPose } from '../vision/types';
import { soundManager } from '../audio/soundEffects';

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
  public onDropRequested?: () => void;
  private lastDwellTargetId: string | null = null;
  private lastDwellTime: number = 0;
  private openPalmStartTime: number = 0;
  private questionEnterGuard: boolean = false; // prevents auto-submit upon new question appearing

  constructor(game: GameController) {
    this.game = game;
  }

  public getState(): InteractionState {
    return this.state;
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

    // Guard: If tracking is completely missing (no hand detected)
    if (!pose) {
      if (gameState.phase === 'carrying') {
        if (!this.state.trackingLostTimer) {
          this.state.trackingLostTimer = now;
        } else if (now - this.state.trackingLostTimer > 350) {
          // Grace period expired: safely cancel carry
          this.game.cancel();
          this.state.trackingLostTimer = null;
          this.state.carriedPosition = null;
          this.state.isDestinationHovered = false;
        }
      }
      this.resetDwell();
      this.state.hoveredTargetId = null;
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;
      return;
    }

    // Tracking is active, clear tracking loss timer
    this.state.trackingLostTimer = null;

    // Handle Open Palm: cancel carry safely
    if (pose.isOpenPalm && gameState.phase === 'carrying') {
      this.game.cancel();
      this.state.carriedPosition = null;
      this.state.isDestinationHovered = false;
      return;
    }

    // Phase: READY
    if (gameState.phase === 'ready') {
      this.resetDwell();
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;

      if (!ray || !ray.active) {
        this.state.hoveredTargetId = null;
        return;
      }

      if (hit && pose.isPointing) {
        this.state.hoveredTargetId = hit.targetId;

        if (hit.targetId === 'term-constant' && gameState.stage === 'undo_constant') {
          this.game.pickup('constant');
          this.state.carriedPosition = { ...hit.point };
        } else if (hit.targetId === 'term-coefficient') {
          this.game.pickup('coefficient');
          this.state.carriedPosition = { ...hit.point };
        }
      } else {
        this.state.hoveredTargetId = null;
      }
      return;
    }

    // Phase: CARRYING
    if (gameState.phase === 'carrying') {
      this.resetDwell();
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;

      // Track carried position following ray origin / projection
      if (hit) {
        this.state.carriedPosition = { ...hit.point };
        this.state.isDestinationHovered = (
          hit.targetType === 'destination' || 
          hit.targetId === 'drop-destination'
        );
      } else {
        this.state.carriedPosition = ray ? { ...ray.origin } : null;
        this.state.isDestinationHovered = false;
      }

      // Drop on observed index curl
      if (pose.isIndexCurled) {
        if (this.state.isDestinationHovered) {
          if (this.onDropRequested) {
            this.onDropRequested();
          } else {
            this.game.drop();
          }
          this.questionEnterGuard = true; // require pointer to leave/re-enter before dwelling
        } else {
          // Curled elsewhere: cancel carry back to origin
          this.game.cancel();
        }
        this.state.carriedPosition = null;
        this.state.isDestinationHovered = false;
      }
      return;
    }

    // Phase: QUESTION (Dwell confirmation on answer cards)
    if (gameState.phase === 'question') {
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

        // If newly entered from outside, clear guard
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

          // Subtle ticking audio
          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            // Commit answer!
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
      return;
    }

    // Phase: SOLVED
    if (gameState.phase === 'solved') {
      // 1. Open palm gesture with dwell (500ms hold to advance)
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
  }

  private resetDwell() {
    this.state.dwellProgress = 0;
    this.state.dwellTargetId = null;
    this.lastDwellTargetId = null;
  }

  // Keyboard navigation
  public handleKeyDown(e: KeyboardEvent): boolean {
    const gameState = this.game.getState();

    // Undo: 'u' or Ctrl+Z
    if (e.key === 'u' || e.key === 'U' || (e.ctrlKey && e.key === 'z')) {
      return this.game.performUndo();
    }

    // Hint: 'h'
    if (e.key === 'h' || e.key === 'H') {
      const hint = this.game.getHint();
      alert(hint);
      return true;
    }

    // Escape: Cancel Carry
    if (e.key === 'Escape') {
      if (gameState.phase === 'carrying') {
        this.game.cancel();
        return true;
      }
    }

    // Answer Selection: 1, 2, 3
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

    // Enter / Space: Pick up or Drop
    if (e.key === 'Enter' || e.key === ' ') {
      if (gameState.phase === 'ready') {
        if (gameState.stage === 'undo_constant') {
          return this.game.pickup('constant');
        } else if (gameState.stage === 'undo_coefficient') {
          return this.game.pickup('coefficient');
        }
      } else if (gameState.phase === 'carrying') {
        return this.game.drop();
      } else if (gameState.phase === 'solved') {
        this.game.nextLevel();
        return true;
      }
    }

    return false;
  }
}
