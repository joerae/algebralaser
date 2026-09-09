import { ModeInteractionHandler, ModeVisionContext, ModeKeyContext } from './types';
import { soundManager } from '../../audio/soundEffects';

export class ModeDBlastSidesHandler implements ModeInteractionHandler {
  public onVisionFrame(ctx: ModeVisionContext): boolean {
    const { ray, pose, hit, now, gameState, interState, game } = ctx;
    const modeDState = gameState.modeDState;

    if (!modeDState) return false;

    // 1. READY (Identify what to undo)
    if (gameState.phase === 'ready') {
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
        return true;
      }

      if (hit && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;

        if (hit.targetId === 'term-coefficient-not-yet') {
          game.identifyModeDTarget('coefficient');
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
              const term = hit.targetId === 'term-constant' ? 'constant' : 'coefficient';
              game.identifyModeDTarget(term);
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

    // 2. CHOOSE_INVERSE (Select from 4 inverse choice cards on LHS of camera)
    if (gameState.phase === 'choose_inverse') {
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
        return true;
      }

      if (hit && hit.targetId.startsWith('inverse-choice-') && pose.isPointing) {
        interState.hoveredTargetId = hit.targetId;

        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1.0, elapsed / 450);
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            const choiceId = hit.targetId.replace('inverse-choice-', '');
            game.selectModeDInverse(choiceId);
            ctx.resetDwell();
          }
        }
        return true;
      } else {
        interState.hoveredTargetId = null;
        ctx.resetDwell();
      }
      return true;
    }

    // 3. BLASTING SIDES (blast_first_side & blast_second_side)
    if (gameState.phase === 'blast_first_side' || gameState.phase === 'blast_second_side') {
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
        return true;
      }

      const isLhs = hit && (
        hit.targetId === 'scale-pan-lhs' ||
        hit.targetId === 'blast-target-lhs' ||
        hit.targetId === 'blast-target-scale-lhs' ||
        hit.targetId === 'equation-side-lhs'
      );
      const isRhs = hit && (
        hit.targetId === 'scale-pan-rhs' ||
        hit.targetId === 'blast-target-rhs' ||
        hit.targetId === 'blast-target-scale-rhs' ||
        hit.targetId === 'equation-side-rhs'
      );
      const isBlastTarget = isLhs || isRhs;

      if (isBlastTarget && pose.isPointing) {
        const side = isLhs ? 'lhs' : 'rhs';
        const isAlreadyBlasted = (side === 'lhs' && modeDState.blastedLhs) || (side === 'rhs' && modeDState.blastedRhs);

        // Disallow dwelling on already-blasted side (clean rejection)
        if (isAlreadyBlasted) {
          interState.hoveredTargetId = null;
          interState.isDestinationHovered = false;
          ctx.resetDwell();
          return true;
        }

        interState.hoveredTargetId = hit.targetId;
        interState.isDestinationHovered = true;

        if (ctx.lastDwellTargetId !== hit.targetId) {
          ctx.setDwellState(hit.targetId, 0, hit.targetId, now);
        } else {
          const elapsed = now - ctx.lastDwellTime;
          const progress = Math.min(1.0, elapsed / 450);
          ctx.setDwellState(hit.targetId, progress, ctx.lastDwellTargetId, ctx.lastDwellTime);

          if (progress > 0.2 && Math.random() < 0.2) {
            soundManager.playDwellTick(progress);
          }

          if (progress >= 1.0) {
            game.blastModeDSide(side);
            ctx.resetDwell();
          }
        }
        return true;
      } else {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
      }
      return true;
    }

    // 4. AWAITING SIMPLIFY (Point at an unsimplified side to enter arithmetic calculation)
    if (gameState.phase === 'awaiting_simplify') {
      if (!ray || !ray.active) {
        interState.hoveredTargetId = null;
        interState.isDestinationHovered = false;
        ctx.resetDwell();
        return true;
      }

      const isSimplifyTarget = hit && (hit.targetId === 'simplify-target-lhs' || hit.targetId === 'simplify-target-rhs');

      if (isSimplifyTarget && pose.isPointing) {
        const side = hit.targetId === 'simplify-target-lhs' ? 'lhs' : 'rhs';
        const isAlreadyDone = (side === 'lhs' && modeDState.simplifiedLhs) || (side === 'rhs' && modeDState.simplifiedRhs);

        if (isAlreadyDone) {
          interState.hoveredTargetId = null;
          interState.isDestinationHovered = false;
          ctx.resetDwell();
          return true;
        }

        interState.hoveredTargetId = hit.targetId;
        interState.isDestinationHovered = true;

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
            game.startSimplifyingSide(side);
            ctx.resetDwell();
          }
        }
        return true;
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
    const { e, gameState, game } = ctx;
    const modeDState = gameState.modeDState;

    // 1. Keyboard shortcuts 1-4 for inverse choices
    if (gameState.phase === 'choose_inverse' && modeDState) {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= modeDState.inverseChoices.length) {
        const choice = modeDState.inverseChoices[num - 1];
        if (choice) {
          game.selectModeDInverse(choice.id);
          return true;
        }
      }
    }

    // 2. Space or Enter shortcut for actions
    if (e.key === 'Enter' || e.key === ' ') {
      if (gameState.phase === 'ready') {
        const term = gameState.stage === 'undo_constant' ? 'constant' : 'coefficient';
        return game.identifyModeDTarget(term);
      }
      if (gameState.phase === 'blast_first_side') {
        return game.blastModeDSide('lhs');
      }
      if (gameState.phase === 'blast_second_side') {
        const remainingSide = modeDState?.blastedLhs ? 'rhs' : 'lhs';
        return game.blastModeDSide(remainingSide);
      }
      if (gameState.phase === 'awaiting_simplify') {
        const nextSide = !modeDState?.simplifiedLhs ? 'lhs' : 'rhs';
        return game.startSimplifyingSide(nextSide);
      }
    }

    return false;
  }
}
