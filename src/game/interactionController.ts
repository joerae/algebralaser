import { GameController } from './gameController';
import { LaserRay, RayHitResult, ClassifiedPose } from '../vision/types';
import { soundManager } from '../audio/soundEffects';
import { OperationSign, BlasterType } from '../math/types';

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
  public onBlasterSelected?: (blaster: BlasterType) => void;
  public onSmashLhsRequested?: () => void;
  public onBlastRhsRequested?: () => void;
  public onBlastSimplifyRequested?: () => void;
  private lastDwellTargetId: string | null = null;
  private lastDwellTime: number = 0;
  private openPalmStartTime: number = 0;
  private questionEnterGuard: boolean = false; // prevents auto-submit upon new question appearing
  private lastPhase: string = 'ready';

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

    // Reset dwell cleanly on phase transitions
    if (this.lastPhase !== gameState.phase) {
      this.resetDwell();
      this.lastDwellTargetId = null;
      this.questionEnterGuard = false;
      this.lastPhase = gameState.phase;
    }

    // Guard: If tracking is completely missing (no hand detected)
    if (!pose) {
      if (gameState.phase === 'carrying') {
        if (!this.state.trackingLostTimer) {
          this.state.trackingLostTimer = now;
        } else if (now - this.state.trackingLostTimer > 350) {
          // Grace period expired: safely cancel carry in Mode A
          this.game.cancel();
          this.state.trackingLostTimer = null;
          this.state.carriedPosition = null;
          this.state.isDestinationHovered = false;
        }
      }
      // In Mode B (forging or applying), losing hand tracking preserves current equation state!
      this.resetDwell();
      this.state.hoveredTargetId = null;
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;
      return;
    }

    // Tracking is active, clear tracking loss timer
    this.state.trackingLostTimer = null;

    // Handle Open Palm: cancel carry safely in Mode A
    if (pose.isOpenPalm && gameState.phase === 'carrying') {
      this.game.cancel();
      this.state.carriedPosition = null;
      this.state.isDestinationHovered = false;
      return;
    }

    // Mode C: Blaster Selection (Available across ready, blasting_rhs, and awaiting_simplify)
    if (gameState.mode === 'mode_c' && hit && hit.targetType === 'blaster' && pose.isPointing) {
      this.state.hoveredTargetId = hit.targetId;

      if (this.lastDwellTargetId !== hit.targetId) {
        this.lastDwellTargetId = hit.targetId;
        this.lastDwellTime = now;
        this.state.dwellProgress = 0;
        this.state.dwellTargetId = hit.targetId;
      } else {
        const elapsed = now - this.lastDwellTime;
        const progress = Math.min(1.0, elapsed / 400);
        this.state.dwellProgress = progress;

        if (progress > 0.2 && Math.random() < 0.2) {
          soundManager.playDwellTick(progress);
        }

        if (progress >= 1.0) {
          let bType: BlasterType = '+';
          if (hit.targetId === 'blaster-op-minus') bType = '-';
          else if (hit.targetId === 'blaster-op-times') bType = '×';
          else if (hit.targetId === 'blaster-op-divide') bType = '÷';
          else if (hit.targetId === 'blaster-op-calc') bType = 'calc';

          this.game.selectBlaster(bType);
          this.onBlasterSelected?.(bType);
          this.resetDwell();
        }
      }
      return;
    }

    // Mode C: BLASTING RHS (carrying operand along laser ray)
    if (gameState.phase === 'blasting_rhs' && gameState.mode === 'mode_c') {
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;

      if (!ray || !ray.active) {
        this.state.hoveredTargetId = null;
        this.state.isDestinationHovered = false;
        this.resetDwell();
        return;
      }

      if (hit && hit.targetId === 'term-rhs-mode-c' && pose.isPointing) {
        this.state.hoveredTargetId = hit.targetId;
        this.state.isDestinationHovered = true;

        if (this.lastDwellTargetId !== hit.targetId) {
          this.lastDwellTargetId = hit.targetId;
          this.lastDwellTime = now;
          this.state.dwellProgress = 0;
          this.state.dwellTargetId = hit.targetId;
        } else {
          const elapsed = now - this.lastDwellTime;
          const progress = Math.min(1.0, elapsed / 500);
          this.state.dwellProgress = progress;

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            this.game.shootRhs();
            this.onBlastRhsRequested?.();
            this.resetDwell();
          }
        }
      } else {
        this.state.hoveredTargetId = null;
        this.state.isDestinationHovered = false;
        this.resetDwell();
      }
      return;
    }

    // Mode C: AWAITING SIMPLIFY (RHS balanced, aiming Calculator blaster at unsimplified RHS)
    if (gameState.phase === 'awaiting_simplify' && gameState.mode === 'mode_c') {
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;

      if (!ray || !ray.active) {
        this.state.hoveredTargetId = null;
        this.state.isDestinationHovered = false;
        this.resetDwell();
        return;
      }

      if (hit && hit.targetId === 'term-simplify-target' && pose.isPointing) {
        this.state.hoveredTargetId = hit.targetId;
        this.state.isDestinationHovered = true;

        if (this.lastDwellTargetId !== hit.targetId) {
          this.lastDwellTargetId = hit.targetId;
          this.lastDwellTime = now;
          this.state.dwellProgress = 0;
          this.state.dwellTargetId = hit.targetId;
        } else {
          const elapsed = now - this.lastDwellTime;
          const progress = Math.min(1.0, elapsed / this.dwellDurationMs);
          this.state.dwellProgress = progress;

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            this.game.shootSimplify();
            this.onBlastSimplifyRequested?.();
            this.resetDwell();
          }
        }
      } else {
        this.state.hoveredTargetId = null;
        this.state.isDestinationHovered = false;
        this.resetDwell();
      }
      return;
    }

    // Phase: READY (Mode C: Dwell to shoot LHS)
    if (gameState.phase === 'ready' && gameState.mode === 'mode_c') {
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;

      if (!ray || !ray.active) {
        this.state.hoveredTargetId = null;
        this.resetDwell();
        return;
      }

      if (hit && pose.isPointing) {
        this.state.hoveredTargetId = hit.targetId;

        if (hit.targetId === 'term-coefficient-not-yet') {
          this.game.shootLhs();
          this.onNotYetRequested?.('coefficient');
          this.state.hoveredTargetId = null;
          this.resetDwell();
          return;
        }

        if (hit.targetId === 'term-constant' || hit.targetId === 'term-coefficient') {
          if (this.lastDwellTargetId !== hit.targetId) {
            this.lastDwellTargetId = hit.targetId;
            this.lastDwellTime = now;
            this.state.dwellProgress = 0;
            this.state.dwellTargetId = hit.targetId;
          } else {
            const elapsed = now - this.lastDwellTime;
            const progress = Math.min(1.0, elapsed / this.dwellDurationMs);
            this.state.dwellProgress = progress;

            if (progress > 0.2 && Math.random() < 0.2) {
              soundManager.playDwellTick(progress);
            }

            if (progress >= 1.0) {
              const success = this.game.shootLhs();
              if (success) {
                this.onSmashLhsRequested?.();
              } else {
                this.onNotYetRequested?.('coefficient');
              }
              this.resetDwell();
            }
          }
          return;
        }
      } else {
        this.state.hoveredTargetId = null;
        this.resetDwell();
      }
      return;
    }

    // Phase: READY (Mode A & B)
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

        if (hit.targetId === 'term-coefficient-not-yet') {
          // Guided NOT YET shake
          this.game.pickup('coefficient');
          this.onNotYetRequested?.('coefficient');
          this.state.hoveredTargetId = null;
        } else if (hit.targetId === 'term-constant' && gameState.stage === 'undo_constant') {
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

    // Phase: FORGING (Mode B — 1 second hold on opposite sign)
    if (gameState.phase === 'forging') {
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;

      if (hit) {
        this.state.carriedPosition = { ...hit.point };
      } else {
        this.state.carriedPosition = ray ? { ...ray.origin } : null;
      }

      if (!ray || !ray.active) {
        this.state.hoveredTargetId = null;
        this.resetDwell();
        return;
      }

      if (hit && hit.targetType === 'forge' && pose.isPointing) {
        this.state.hoveredTargetId = hit.targetId;

        if (this.lastDwellTargetId !== hit.targetId) {
          this.lastDwellTargetId = hit.targetId;
          this.lastDwellTime = now;
          this.state.dwellProgress = 0;
          this.state.dwellTargetId = hit.targetId;
        } else {
          const elapsed = now - this.lastDwellTime;
          const progress = Math.min(1.0, elapsed / this.forgeDwellDurationMs);
          this.state.dwellProgress = progress;

          if (progress > 0.15 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            let chosenSign: OperationSign = '+';
            if (hit.targetId === 'forge-op-minus') chosenSign = '-';
            else if (hit.targetId === 'forge-op-times') chosenSign = '×';
            else if (hit.targetId === 'forge-op-divide') chosenSign = '÷';

            if (this.onForgeRequested) {
              this.onForgeRequested(chosenSign);
            } else {
              this.game.forge(chosenSign);
            }
            this.resetDwell();
          }
        }
      } else {
        this.state.hoveredTargetId = null;
        this.resetDwell();
      }
      return;
    }

    // Phase: APPLYING (Mode B — pull forged bubble up to = sign)
    if (gameState.phase === 'applying') {
      this.openPalmStartTime = 0;
      this.state.openPalmProgress = 0;

      if (hit) {
        this.state.carriedPosition = { ...hit.point };
        this.state.isDestinationHovered = hit.targetId === 'eq-equals-target';
      } else {
        this.state.carriedPosition = ray ? { ...ray.origin } : null;
        this.state.isDestinationHovered = false;
      }

      if (!ray || !ray.active) {
        this.state.hoveredTargetId = null;
        this.resetDwell();
        return;
      }

      if (hit && hit.targetId === 'eq-equals-target' && pose.isPointing) {
        this.state.hoveredTargetId = hit.targetId;

        if (this.lastDwellTargetId !== hit.targetId) {
          this.lastDwellTargetId = hit.targetId;
          this.lastDwellTime = now;
          this.state.dwellProgress = 0;
          this.state.dwellTargetId = hit.targetId;
        } else {
          const elapsed = now - this.lastDwellTime;
          const progress = Math.min(1.0, elapsed / this.dwellDurationMs);
          this.state.dwellProgress = progress;

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0 || pose.isIndexCurled) {
            if (this.onApplyEqualsRequested) {
              this.onApplyEqualsRequested();
            } else {
              this.game.applyBalance();
            }
            this.resetDwell();
          }
        }
      } else {
        if (pose.isIndexCurled && this.state.isDestinationHovered) {
          if (this.onApplyEqualsRequested) {
            this.onApplyEqualsRequested();
          } else {
            this.game.applyBalance();
          }
          this.resetDwell();
        } else {
          this.state.hoveredTargetId = null;
          this.resetDwell();
        }
      }
      return;
    }

    // Phase: CARRYING (Mode A)
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

    // Phase: BALANCING (Animation in progress)
    if (gameState.phase === 'balancing') {
      this.state.carriedPosition = null;
      this.state.isDestinationHovered = false;
      this.resetDwell();
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

    // Mode B: Forging sign shortcuts (+, -, *, /)
    if (gameState.phase === 'forging') {
      if (e.key === '+' || e.key === '=') {
        return this.game.forge('+');
      }
      if (e.key === '-' || e.key === '_') {
        return this.game.forge('-');
      }
      if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        return this.game.forge('×');
      }
      if (e.key === '/' || e.key === 'd' || e.key === 'D') {
        return this.game.forge('÷');
      }
    }

    // Mode B: Applying (Enter or Space applies to both sides)
    if (gameState.phase === 'applying' && (e.key === 'Enter' || e.key === ' ')) {
      if (this.onApplyEqualsRequested) {
        this.onApplyEqualsRequested();
      } else {
        this.game.applyBalance();
      }
      return true;
    }

    // Mode C: Blaster selection shortcuts (+, -, *, /, c)
    if (gameState.mode === 'mode_c') {
      if (e.key === '+' || e.key === '=') {
        this.game.selectBlaster('+');
        return true;
      }
      if (e.key === '-' || e.key === '_') {
        this.game.selectBlaster('-');
        return true;
      }
      if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        this.game.selectBlaster('×');
        return true;
      }
      if (e.key === '/' || e.key === 'd' || e.key === 'D') {
        this.game.selectBlaster('÷');
        return true;
      }
      if (e.key === 'c' || e.key === 'C') {
        this.game.selectBlaster('calc');
        return true;
      }
    }

    // Enter / Space: Actions across modes
    if (e.key === 'Enter' || e.key === ' ') {
      if (gameState.mode === 'mode_c') {
        if (gameState.phase === 'ready') {
          return this.game.shootLhs();
        } else if (gameState.phase === 'blasting_rhs') {
          return this.game.shootRhs();
        } else if (gameState.phase === 'awaiting_simplify') {
          return this.game.shootSimplify();
        } else if (gameState.phase === 'solved') {
          this.game.nextLevel();
          return true;
        }
      } else {
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
    }

    return false;
  }
}
