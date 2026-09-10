import { EquationState } from '../math/types';
import { LaserRay } from '../vision/types';
import { soundManager } from '../audio/soundEffects';

export interface BubbleUpdateResult {
  isSnapped: boolean;
  targetPos: { x: number; y: number };
  isDestinationHovered: boolean;
  triggerPop: boolean;
  triggerSplit: boolean;
}

export class CarriedBubbleView {
  private bubbleEl: HTMLElement | null;
  private termEl: HTMLElement | null;
  private captionEl: HTMLElement | null;
  private twinEl: HTMLElement | null;
  private twinTermEl: HTMLElement | null;
  private ringFillEl: SVGCircleElement | null;
  private circumference: number = 2 * Math.PI * 45; // ~282.74

  private wasSnapped: boolean = false;
  private wasCrossed: boolean = false;
  private snapStartTime: number | null = null;
  private isPopping: boolean = false;

  constructor(bubbleEl: HTMLElement | null) {
    this.bubbleEl = bubbleEl;
    this.termEl = bubbleEl?.querySelector('.bubble-term') || null;
    this.captionEl = bubbleEl?.querySelector('.bubble-caption') || null;
    this.twinEl = bubbleEl?.querySelector('.bubble-twin') || null;
    this.twinTermEl = bubbleEl?.querySelector('.bubble-twin-term') || null;
    this.ringFillEl = bubbleEl?.querySelector<SVGCircleElement>('.bubble-ring-fill') || null;
  }

  public isBusy(): boolean {
    return this.isPopping;
  }

  public hide(): void {
    if (!this.bubbleEl) return;
    this.bubbleEl.style.display = 'none';
    if (this.twinEl) this.twinEl.style.display = 'none';
    if (this.ringFillEl) {
      this.ringFillEl.style.strokeDashoffset = `${this.circumference}`;
    }
    this.wasSnapped = false;
    this.wasCrossed = false;
    this.snapStartTime = null;
  }

  public update(
    gameState: EquationState,
    currentCarriedPos: { x: number; y: number } | null,
    laserRay: LaserRay | null,
    equalsX: number,
    now: number
  ): BubbleUpdateResult {
    let targetX = currentCarriedPos?.x || (window.innerWidth / 2);
    let targetY = currentCarriedPos?.y || 160;
    let isSnapped = false;
    let isDestinationHovered = false;
    let triggerPop = false;
    let triggerSplit = false;

    // 1. Snapping computation
    if (gameState.phase === 'carrying') {
      const destEl = document.getElementById('drop-destination');
      if (destEl) {
        const destRect = destEl.getBoundingClientRect();
        const destCenter = {
          x: destRect.left + destRect.width / 2,
          y: destRect.top + destRect.height / 2
        };

        if (laserRay && laserRay.active) {
          const t = (destCenter.y - laserRay.origin.y) / laserRay.direction.y;
          if (t > 0) {
            targetX = laserRay.origin.x + t * laserRay.direction.x;
            targetY = destCenter.y;
          }
        }

        const dist = Math.hypot(targetX - destCenter.x, targetY - destCenter.y);
        isSnapped = dist < 120;

        if (isSnapped) {
          targetX = destCenter.x;
          targetY = destCenter.y;
          isDestinationHovered = true;
          if (!this.wasSnapped) {
            soundManager.playSnap();
            this.wasSnapped = true;
          }
        } else {
          isDestinationHovered = false;
          this.wasSnapped = false;
        }
      }
    } else if (gameState.phase === 'applying') {
      const dropTargetEl = document.getElementById('equation-drop-target') || document.getElementById('eq-equals-target');
      if (dropTargetEl) {
        const rect = dropTargetEl.getBoundingClientRect();
        const targetCenterY = rect.top + rect.height / 2;
        let aimX = targetX;
        let aimY = targetY;

        if (laserRay && laserRay.active) {
          const t = (targetCenterY - laserRay.origin.y) / laserRay.direction.y;
          if (t > 0) {
            aimX = laserRay.origin.x + t * laserRay.direction.x;
            aimY = targetCenterY;
          }
        }

        const isNearRail = (
          aimX >= rect.left - 40 &&
          aimX <= rect.right + 40 &&
          aimY >= rect.top - 45 &&
          aimY <= rect.bottom + 45
        );

        isSnapped = isNearRail;

        if (isSnapped) {
          isDestinationHovered = true;
          if (!this.wasSnapped) {
            soundManager.playSnap();
            this.wasSnapped = true;
          }
        } else {
          isDestinationHovered = false;
          this.wasSnapped = false;
        }
      }
    }

    if (!this.bubbleEl || this.isPopping) {
      return { isSnapped, targetPos: { x: targetX, y: targetY }, isDestinationHovered, triggerPop, triggerSplit };
    }

    // 2. DOM Updates
    this.bubbleEl.style.display = 'flex';
    this.bubbleEl.style.left = `${targetX}px`;
    this.bubbleEl.style.top = `${targetY}px`;
    this.bubbleEl.classList.toggle('snapped', isSnapped);
    this.bubbleEl.classList.toggle('double-charge', gameState.phase === 'applying');
    this.bubbleEl.classList.remove('op-plus', 'op-minus', 'op-times', 'op-divide');

    // 3. Phase-specific bubble content
    if (gameState.phase === 'forging') {
      if (this.twinEl) this.twinEl.style.display = 'none';
      this.bubbleEl.classList.remove('crossed');
      if (this.termEl) {
        if (gameState.carriedTerm === 'constant') {
          const isNeg = gameState.currentB < 0;
          const absB = Math.abs(gameState.currentB);
          this.termEl.textContent = `${isNeg ? '−' : '+'}${absB}`;
          this.bubbleEl.classList.add(isNeg ? 'op-minus' : 'op-plus');
        } else if (gameState.carriedTerm === 'coefficient') {
          const isDivision = Boolean(gameState.problem.d && gameState.problem.d > 1);
          const operand = isDivision ? gameState.problem.d : gameState.currentA;
          this.termEl.textContent = isDivision ? `÷ ${operand}` : `x ${operand}`;
          this.bubbleEl.classList.add(isDivision ? 'op-divide' : 'op-times');
        }
      }
      if (this.captionEl) {
        this.captionEl.textContent = 'Hold on opposite sign ⚡';
      }
      if (this.ringFillEl) {
        this.ringFillEl.style.strokeDashoffset = `${this.circumference}`;
      }
    } else if (gameState.phase === 'applying') {
      this.bubbleEl.classList.remove('crossed');
      const forged = gameState.forgedOperation;
      if (forged && this.termEl) {
        const opSymbol = forged.forgedOperator === '-' ? '−' : forged.forgedOperator;
        this.termEl.textContent = `${opSymbol}${forged.forgedOperand}`;
        const opClass = forged.forgedOperator === '+' 
          ? 'op-plus' 
          : (forged.forgedOperator === '-' ? 'op-minus' : (forged.forgedOperator === '×' ? 'op-times' : 'op-divide'));
        this.bubbleEl.classList.add(opClass);
        if (this.twinEl) {
          this.twinEl.className = `bubble-twin ${opClass}`;
          this.twinEl.style.display = 'flex';
        }
        if (this.twinTermEl) this.twinTermEl.textContent = `${opSymbol}${forged.forgedOperand}`;
      }

      if (isSnapped) {
        if (!this.snapStartTime) {
          this.snapStartTime = now;
        }
        const holdDuration = now - this.snapStartTime;
        const progress = Math.min(1.0, holdDuration / 450);

        if (this.ringFillEl) {
          this.ringFillEl.style.strokeDashoffset = `${this.circumference * (1 - progress)}`;
        }

        if (progress > 0.15 && holdDuration % 120 < 18) {
          soundManager.playDwellTick(progress);
        }

        if (this.captionEl) {
          this.captionEl.textContent = '';
        }

        if (progress >= 1.0) {
          triggerSplit = true;
        }
      } else {
        this.snapStartTime = null;
        if (this.ringFillEl) {
          this.ringFillEl.style.strokeDashoffset = `${this.circumference}`;
        }
        if (this.captionEl) {
          this.captionEl.textContent = '';
        }
      }
    } else if (gameState.phase === 'carrying') {
      if (this.twinEl) this.twinEl.style.display = 'none';
      const isCrossed = targetX >= equalsX;

      if (isCrossed && !this.wasCrossed) {
        soundManager.playSnap();
        this.wasCrossed = true;
      } else if (!isCrossed && this.wasCrossed) {
        soundManager.playSnap();
        this.wasCrossed = false;
      }

      this.bubbleEl.classList.toggle('crossed', isCrossed);

      if (this.termEl) {
        if (gameState.carriedTerm === 'constant') {
          const isNeg = gameState.currentB < 0;
          const absB = Math.abs(gameState.currentB);
          if (isCrossed) {
            const flippedSign = isNeg ? '+' : '−';
            this.termEl.textContent = `${flippedSign}${absB}`;
            this.bubbleEl.classList.add(isNeg ? 'op-plus' : 'op-minus');
          } else {
            const origSign = isNeg ? '−' : '+';
            this.termEl.textContent = `${origSign}${absB}`;
            this.bubbleEl.classList.add(isNeg ? 'op-minus' : 'op-plus');
          }
        } else if (gameState.carriedTerm === 'coefficient') {
          const isDivision = Boolean(gameState.problem.d && gameState.problem.d > 1);
          const operand = isDivision ? gameState.problem.d : gameState.currentA;
          if (isCrossed) {
            this.termEl.textContent = isDivision ? `× ${operand}` : `÷ ${operand}`;
            this.bubbleEl.classList.add(isDivision ? 'op-times' : 'op-divide');
          } else {
            this.termEl.textContent = isDivision ? `÷ ${operand}` : `x ${operand}`;
            this.bubbleEl.classList.add(isDivision ? 'op-divide' : 'op-times');
          }
        }
      }

      const HOLD_DURATION_MS = 1000;
      if (isSnapped) {
        if (!this.snapStartTime) {
          this.snapStartTime = now;
        }
        const holdDuration = now - this.snapStartTime;
        const progress = Math.min(1.0, holdDuration / HOLD_DURATION_MS);

        if (this.ringFillEl) {
          const offset = this.circumference * (1 - progress);
          this.ringFillEl.style.strokeDashoffset = `${offset}`;
        }

        if (progress > 0.15 && holdDuration % 120 < 18) {
          soundManager.playDwellTick(progress);
        }

        if (this.captionEl) {
          if (progress < 0.5) {
            this.captionEl.textContent = 'Hold...';
          } else if (progress < 0.85) {
            this.captionEl.textContent = 'Almost...';
          } else {
            this.captionEl.textContent = 'POP!';
          }
        }

        if (progress >= 1.0) {
          triggerPop = true;
        }
      } else {
        this.snapStartTime = null;
        if (this.ringFillEl) {
          this.ringFillEl.style.strokeDashoffset = `${this.circumference}`;
        }
        if (this.captionEl) {
          this.captionEl.textContent = isCrossed ? 'Drag to Landing Slot' : 'Move across =';
        }
      }
    }

    return { isSnapped, targetPos: { x: targetX, y: targetY }, isDestinationHovered, triggerPop, triggerSplit };
  }

  public triggerNahUhShake(): void {
    if (!this.bubbleEl) return;
    this.bubbleEl.classList.remove('shake-nah-uh');
    void this.bubbleEl.offsetWidth;
    this.bubbleEl.classList.add('shake-nah-uh');
    window.setTimeout(() => this.bubbleEl?.classList.remove('shake-nah-uh'), 450);
  }

  public popAndDrop(onComplete: () => void): void {
    if (this.isPopping) return;
    this.isPopping = true;
    this.snapStartTime = null;
    this.wasSnapped = false;
    soundManager.playPop();

    if (this.bubbleEl) {
      this.bubbleEl.classList.add('popping');
    }

    window.setTimeout(() => {
      if (this.bubbleEl) {
        this.bubbleEl.style.display = 'none';
        this.bubbleEl.classList.remove('popping', 'snapped', 'crossed');
        if (this.ringFillEl) {
          this.ringFillEl.style.strokeDashoffset = `${this.circumference}`;
        }
      }
      this.isPopping = false;
      onComplete();
    }, 350);
  }
}
