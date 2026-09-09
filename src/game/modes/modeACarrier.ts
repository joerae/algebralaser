import { ModeInteractionHandler, ModeVisionContext, ModeKeyContext } from './types';
import { EquationState } from '../../math/types';
import { GameController } from '../gameController';
import { InteractionState } from '../interactionController';

export class ModeACarrier implements ModeInteractionHandler {
  public onTrackingLost(
    gameState: EquationState,
    interState: InteractionState,
    game: GameController,
    now: number
  ): void {
    if (gameState.phase === 'carrying') {
      if (!interState.trackingLostTimer) {
        interState.trackingLostTimer = now;
      } else if (now - interState.trackingLostTimer > 350) {
        game.cancel();
        interState.trackingLostTimer = null;
        interState.carriedPosition = null;
        interState.isDestinationHovered = false;
      }
    }
  }

  public onVisionFrame(ctx: ModeVisionContext): boolean {
    const { ray, pose, hit, gameState, interState, game, callbacks } = ctx;

    // Open Palm cancel carry
    if (pose.isOpenPalm && gameState.phase === 'carrying') {
      game.cancel();
      interState.carriedPosition = null;
      interState.isDestinationHovered = false;
      return true;
    }

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

    // Phase: CARRYING
    if (gameState.phase === 'carrying') {
      ctx.resetDwell();

      if (hit) {
        interState.carriedPosition = { ...hit.point };
        interState.isDestinationHovered = (
          hit.targetType === 'destination' || 
          hit.targetId === 'drop-destination'
        );
      } else {
        interState.carriedPosition = ray ? { ...ray.origin } : null;
        interState.isDestinationHovered = false;
      }

      // Drop on observed index curl
      if (pose.isIndexCurled) {
        if (interState.isDestinationHovered) {
          if (callbacks.onDropRequested) {
            callbacks.onDropRequested();
          } else {
            game.drop();
          }
        } else {
          game.cancel();
        }
        interState.carriedPosition = null;
        interState.isDestinationHovered = false;
      }
      return true;
    }

    return false;
  }

  public onKeyDown(ctx: ModeKeyContext): boolean {
    const { e, gameState, game } = ctx;

    // Escape: Cancel Carry
    if (e.key === 'Escape') {
      if (gameState.phase === 'carrying') {
        game.cancel();
        return true;
      }
    }

    // Enter / Space: Pickup or Drop
    if (e.key === 'Enter' || e.key === ' ') {
      if (gameState.phase === 'ready') {
        if (gameState.stage === 'undo_constant') {
          return game.pickup('constant');
        } else if (gameState.stage === 'undo_coefficient') {
          return game.pickup('coefficient');
        }
      } else if (gameState.phase === 'carrying') {
        return game.drop();
      }
    }

    return false;
  }
}
