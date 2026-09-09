import { ModeInteractionHandler, ModeVisionContext, ModeKeyContext } from './types';
import { soundManager } from '../../audio/soundEffects';
import { OperationSign } from '../../math/types';

export class ModeBForgeHandler implements ModeInteractionHandler {
  public forgeDwellDurationMs: number = 1000;
  private cleanupMustExitTarget = false;
  private lastObservedPhase: string | null = null;

  public onVisionFrame(ctx: ModeVisionContext): boolean {
    const { ray, pose, hit, now, gameState, interState, game, callbacks } = ctx;

    if (this.lastObservedPhase !== 'awaiting_cleanup' && gameState.phase === 'awaiting_cleanup') {
      this.cleanupMustExitTarget = true;
    }
    if (gameState.phase === 'ready') {
      this.cleanupMustExitTarget = false;
    }
    this.lastObservedPhase = gameState.phase;

    // Phase: READY
    if (gameState.phase === 'ready') {
      ctx.resetDwell();
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        return true;
      }

      if (hit && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;
        if (hit.targetId === 'term-coefficient-not-yet') {
          game.pickup('coefficient');
          callbacks.onNotYetRequested?.('coefficient');
          interState.hoveredTargetId = null;
        } else if (hit.targetId === 'term-constant' && gameState.stage === 'undo_constant') {
          interState.carriedPosition = { ...ray.origin };
          if (callbacks.onModeBPickupRequested) {
            callbacks.onModeBPickupRequested('constant', { ...hit.point }, { ...ray.origin });
          } else {
            game.pickup('constant');
          }
        } else if (hit.targetId === 'term-coefficient') {
          interState.carriedPosition = { ...ray.origin };
          if (callbacks.onModeBPickupRequested) {
            callbacks.onModeBPickupRequested('coefficient', { ...hit.point }, { ...ray.origin });
          } else {
            game.pickup('coefficient');
          }
        }
      } else {
        interState.hoveredTargetId = null;
      }
      return true;
    }

    // Phase: FORGING (1s hold on opposite sign)
    if (gameState.phase === 'forging') {
      interState.carriedPosition = ray ? { ...ray.origin } : interState.carriedPosition;

      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
        return true;
      }

      if (hit && hit.targetType === 'forge' && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;

        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1.0, elapsed / this.forgeDwellDurationMs);
          const easedProgress = 1 - Math.pow(1 - progress, 2);
          interState.carriedPosition = {
            x: ray.origin.x + (hit.point.x - ray.origin.x) * easedProgress,
            y: ray.origin.y + (hit.point.y - ray.origin.y) * easedProgress
          };
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

          if (progress > 0.15 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            let chosenSign: OperationSign = '+';
            if (hit.targetId === 'forge-op-minus') chosenSign = '-';
            else if (hit.targetId === 'forge-op-times') chosenSign = '×';
            else if (hit.targetId === 'forge-op-divide') chosenSign = '÷';

            if (callbacks.onForgeRequested) {
              callbacks.onForgeRequested(chosenSign);
            } else {
              game.forge(chosenSign);
            }
            ctx.resetDwell();
          }
        }
      } else {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
      }
      return true;
    }

    // Phase: APPLYING (pull forged bubble up to = sign)
    if (gameState.phase === 'applying') {
      interState.carriedPosition = ray ? { ...ray.origin } : interState.carriedPosition;
      interState.isDestinationHovered = hit?.targetId === 'eq-equals-target' || hit?.targetId === 'equation-drop-target';

      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
        return true;
      }

      if (hit && (hit.targetId === 'eq-equals-target' || hit.targetId === 'equation-drop-target') && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;

        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1.0, elapsed / ctx.dwellDurationMs);
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0 || pose.isIndexCurled) {
            if (callbacks.onApplyEqualsRequested) {
              callbacks.onApplyEqualsRequested();
            } else {
              game.applyBalance();
            }
            ctx.resetDwell();
          }
        }
      } else {
        if (pose.isIndexCurled && interState.isDestinationHovered) {
          if (callbacks.onApplyEqualsRequested) {
            callbacks.onApplyEqualsRequested();
          } else {
            game.applyBalance();
          }
          ctx.resetDwell();
        } else {
          interState.hoveredTargetId = null;
          ctx.resetDwell();
        }
      }
      return true;
    }

    // Phase: BALANCING
    if (gameState.phase === 'balancing') {
      interState.carriedPosition = null;
      interState.isDestinationHovered = false;
      ctx.resetDwell();
      return true;
    }

    // The identity expression is deliberately explosive: once armed, merely
    // crossing it with the laser sets it off.
    if (gameState.phase === 'awaiting_cleanup') {
      const cleanupTargetId = 'mode-b-cleanup-target';
      const isOnCleanupTarget = !!hit && hit.targetId === cleanupTargetId;

      if (this.cleanupMustExitTarget) {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();

        // Moving anywhere off this target rearms it. The ray can move directly
        // onto another part of the equation; it need not leave the rail.
        if (!ray || !ray.active || !pose.isPointing || !isOnCleanupTarget) {
          this.cleanupMustExitTarget = false;
        }
        return true;
      }

      if (
        ray?.active &&
        pose.isPointing &&
        hit?.targetType === 'answer' &&
        gameState.balancedDisplay?.rhsActivated &&
        !gameState.balancedDisplay?.rhsSolved
      ) {
        interState.hoveredTargetId = hit.targetId;
        interState.isDestinationHovered = false;

        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1, elapsed / ctx.dwellDurationMs);
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);
          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }
          if (progress >= 1) {
            const choice = Number(hit.targetId.replace('answer-choice-', ''));
            if (!Number.isNaN(choice)) game.answer(choice);
            ctx.resetDwell();
          }
        }
        return true;
      }

      if (ray?.active && pose.isPointing && hit?.targetId === 'mode-b-rhs-target') {
        interState.hoveredTargetId = hit.targetId;
        interState.isDestinationHovered = true;
        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1, elapsed / 250);
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);
          if (progress >= 1) {
            game.activateModeBRhsCalculation();
            ctx.resetDwell();
          }
        }
        return true;
      }

      if (ray?.active && pose.isPointing && isOnCleanupTarget) {
        interState.hoveredTargetId = cleanupTargetId;
        interState.isDestinationHovered = true;
        this.cleanupMustExitTarget = true;
        if (callbacks.onModeBCleanupRequested) {
          callbacks.onModeBCleanupRequested();
        } else {
          game.cancelLhs();
        }
        ctx.resetDwell();
      } else {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
      }
      return true;
    }

    return false;
  }

  public onKeyDown(ctx: ModeKeyContext): boolean {
    const { e, gameState, game, callbacks } = ctx;

    if (gameState.phase === 'awaiting_cleanup' && gameState.balancedDisplay?.rhsActivated && !gameState.balancedDisplay?.rhsSolved && gameState.pendingArithmetic) {
      const index = Number(e.key) - 1;
      const choice = gameState.pendingArithmetic.choices[index];
      if (index >= 0 && index < 3 && choice !== undefined) {
        return game.answer(choice);
      }
    }

    // Forging shortcuts (+, -, *, /)
    if (gameState.phase === 'forging') {
      if (e.key === '+' || e.key === '=') return game.forge('+');
      if (e.key === '-' || e.key === '_') return game.forge('-');
      if (e.key === '*' || e.key === 'x' || e.key === 'X') return game.forge('×');
      if (e.key === '/' || e.key === 'd' || e.key === 'D') return game.forge('÷');
    }

    // Applying shortcuts (Enter or Space applies)
    if (gameState.phase === 'applying' && (e.key === 'Enter' || e.key === ' ')) {
      if (callbacks.onApplyEqualsRequested) {
        callbacks.onApplyEqualsRequested();
      } else {
        game.applyBalance();
      }
      return true;
    }

    if (gameState.phase === 'awaiting_cleanup' && (e.key === 'Enter' || e.key === ' ')) {
      if (callbacks.onModeBCleanupRequested) {
        callbacks.onModeBCleanupRequested();
        return true;
      }
      return game.cancelLhs();
    }

    // Ready shortcuts
    if (gameState.phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
      if (gameState.stage === 'undo_constant') return game.pickup('constant');
      if (gameState.stage === 'undo_coefficient') return game.pickup('coefficient');
    }

    return false;
  }
}
