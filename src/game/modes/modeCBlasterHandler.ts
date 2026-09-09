import { ModeInteractionHandler, ModeVisionContext, ModeKeyContext } from './types';
import { soundManager } from '../../audio/soundEffects';
import { BlasterType } from '../../math/types';

export class ModeCBlasterHandler implements ModeInteractionHandler {
  public onVisionFrame(ctx: ModeVisionContext): boolean {
    const { ray, pose, hit, now, gameState, interState, game, callbacks } = ctx;

    // 1. Blaster Selection (available in ready, blasting_rhs, awaiting_simplify)
    if (hit && hit.targetType === 'blaster' && pose.isPointing) {
      interState.hoveredTargetId = hit.targetId;

      if (ctx.lastDwellTargetId !== hit.targetId) {
        ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
      } else {
        const elapsed = now - ctx.lastDwellTime;
        const progress = Math.min(1.0, elapsed / 400);
        ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

        if (progress > 0.2 && Math.random() < 0.2) {
          soundManager.playDwellTick(progress);
        }

        if (progress >= 1.0) {
          let bType: BlasterType = '+';
          if (hit.targetId === 'blaster-op-minus') bType = '-';
          else if (hit.targetId === 'blaster-op-times') bType = '×';
          else if (hit.targetId === 'blaster-op-divide') bType = '÷';
          else if (hit.targetId === 'blaster-op-calc') bType = 'calc';

          game.selectBlaster(bType);
          callbacks.onBlasterSelected?.(bType);
          ctx.resetDwell();
        }
      }
      return true;
    }

    // 2. BLASTING RHS
    if (gameState.phase === 'blasting_rhs') {
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
        return true;
      }

      if (hit && hit.targetId === 'term-rhs-mode-c' && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;
        interState.isDestinationHovered = true;

        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1.0, elapsed / 500);
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            game.shootRhs();
            callbacks.onBlastRhsRequested?.();
            ctx.resetDwell();
          }
        }
      } else {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
      }
      return true;
    }

    // 3. AWAITING SIMPLIFY
    if (gameState.phase === 'awaiting_simplify') {
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
        return true;
      }

      if (hit && hit.targetId === 'term-simplify-target' && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;
        interState.isDestinationHovered = true;

        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1.0, elapsed / ctx.dwellDurationMs);
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            game.shootSimplify();
            callbacks.onBlastSimplifyRequested?.();
            ctx.resetDwell();
          }
        }
      } else {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
      }
      return true;
    }

    // 4. READY (Dwell to shoot LHS)
    if (gameState.phase === 'ready') {
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
        return true;
      }

      if (hit && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;

        if (hit.targetId === 'term-coefficient-not-yet') {
          game.shootLhs();
          callbacks.onNotYetRequested?.('coefficient');
          interState.hoveredTargetId = null;
          ctx.resetDwell();
          return true;
        }

        if (hit.targetId === 'term-constant' || hit.targetId === 'term-coefficient') {
          if (ctx.lastDwellTargetId !== hit.targetId) {
            ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
          } else {
            const elapsed = now - ctx.lastDwellTime;
            const progress = Math.min(1.0, elapsed / ctx.dwellDurationMs);
            ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

            if (progress > 0.2 && Math.random() < 0.2) {
              soundManager.playDwellTick(progress);
            }

            if (progress >= 1.0) {
              const success = game.shootLhs();
              if (success) {
                callbacks.onSmashLhsRequested?.();
              } else {
                callbacks.onNotYetRequested?.('coefficient');
              }
              ctx.resetDwell();
            }
          }
          return true;
        }
      } else {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
      }
      return true;
    }

    return false;
  }

  public onKeyDown(ctx: ModeKeyContext): boolean {
    const { e, gameState, game } = ctx;

    // Blaster selection shortcuts (+, -, *, /, c)
    if (e.key === '+' || e.key === '=') {
      game.selectBlaster('+');
      return true;
    }
    if (e.key === '-' || e.key === '_') {
      game.selectBlaster('-');
      return true;
    }
    if (e.key === '*' || e.key === 'x' || e.key === 'X') {
      game.selectBlaster('×');
      return true;
    }
    if (e.key === '/' || e.key === 'd' || e.key === 'D') {
      game.selectBlaster('÷');
      return true;
    }
    if (e.key === 'c' || e.key === 'C') {
      game.selectBlaster('calc');
      return true;
    }

    // Action shortcuts (Enter or Space)
    if (e.key === 'Enter' || e.key === ' ') {
      if (gameState.phase === 'ready') return game.shootLhs();
      if (gameState.phase === 'blasting_rhs') return game.shootRhs();
      if (gameState.phase === 'awaiting_simplify') return game.shootSimplify();
    }

    return false;
  }
}
