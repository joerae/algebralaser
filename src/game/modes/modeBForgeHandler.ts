import { ModeInteractionHandler, ModeVisionContext, ModeKeyContext } from './types';
import { soundManager } from '../../audio/soundEffects';
import { OperationSign } from '../../math/types';

export class ModeBForgeHandler implements ModeInteractionHandler {
  public forgeDwellDurationMs: number = 1000;

  public onVisionFrame(ctx: ModeVisionContext): boolean {
    const { ray, pose, hit, now, gameState, interState, game, callbacks } = ctx;

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
          game.pickup('constant');
          interState.carriedPosition = { ...hit.point };
        } else if (hit.targetId === 'term-coefficient') {
          game.pickup('coefficient');
          interState.carriedPosition = { ...hit.point };
        }
      } else {
        interState.hoveredTargetId = null;
      }
      return true;
    }

    // Phase: FORGING (1s hold on opposite sign)
    if (gameState.phase === 'forging') {
      if (hit) {
        interState.carriedPosition = { ...hit.point };
      } else {
        interState.carriedPosition = ray ? { ...ray.origin } : null;
      }

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
      if (hit) {
        interState.carriedPosition = { ...hit.point };
        interState.isDestinationHovered = hit.targetId === 'eq-equals-target';
      } else {
        interState.carriedPosition = ray ? { ...ray.origin } : null;
        interState.isDestinationHovered = false;
      }

      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
        return true;
      }

      if (hit && hit.targetId === 'eq-equals-target' && pose.isPointing) {
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

    return false;
  }

  public onKeyDown(ctx: ModeKeyContext): boolean {
    const { e, gameState, game, callbacks } = ctx;

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

    // Ready shortcuts
    if (gameState.phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
      if (gameState.stage === 'undo_constant') return game.pickup('constant');
      if (gameState.stage === 'undo_coefficient') return game.pickup('coefficient');
    }

    return false;
  }
}
