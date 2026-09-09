import { ForgedOperation } from '../../math/types';
import { soundManager } from '../../audio/soundEffects';

export interface SplitAnimationTargets {
  left: {
    hover: { x: number; y: number };
    smash: { x: number; y: number };
  };
  right: {
    hover: { x: number; y: number };
    smash: { x: number; y: number };
  };
}

export interface SplitAnimationParams {
  splitLeftEl: HTMLElement;
  splitRightEl: HTMLElement;
  forgedOp: ForgedOperation | null;
  targets: SplitAnimationTargets;
  eqCenter: { x: number; y: number };
  onLhsImpact: () => void;
  onComplete: () => void;
}

export function runSplitBalanceAnimation(params: SplitAnimationParams): void {
  const {
    splitLeftEl,
    splitRightEl,
    forgedOp,
    targets,
    eqCenter,
    onLhsImpact,
    onComplete
  } = params;

  const symbol = forgedOp 
    ? `${forgedOp.forgedOperator === '-' ? '−' : forgedOp.forgedOperator}${forgedOp.forgedOperand}` 
    : '';
  const opClass = forgedOp?.forgedOperator === '+' 
    ? 'op-plus' 
    : (forgedOp?.forgedOperator === '-' 
        ? 'op-minus' 
        : (forgedOp?.forgedOperator === '×' ? 'op-times' : 'op-divide'));

  [splitLeftEl, splitRightEl].forEach(el => {
    el.className = `carried-bubble split-clone ${opClass}`;
    el.style.display = 'flex';
    el.style.left = `${eqCenter.x}px`;
    el.style.top = `${eqCenter.y}px`;
    el.style.transform = 'translate(-50%, -50%) scale(1)';
    const term = el.querySelector('.bubble-term');
    if (term) term.textContent = symbol;
  });

  soundManager.playSplit();

  // Stage 1: Float up above both sides (LHS & RHS)
  window.requestAnimationFrame(() => {
    splitLeftEl.classList.add('hovering');
    splitRightEl.classList.add('hovering');
    splitLeftEl.style.left = `${targets.left.hover.x}px`;
    splitLeftEl.style.top = `${targets.left.hover.y}px`;
    splitRightEl.style.left = `${targets.right.hover.x}px`;
    splitRightEl.style.top = `${targets.right.hover.y}px`;
  });

  // Stage 2: Smash Side 1 (LHS) into term
  window.setTimeout(() => {
    splitLeftEl.classList.remove('hovering');
    splitLeftEl.classList.add('smashing');
    splitLeftEl.style.left = `${targets.left.smash.x}px`;
    splitLeftEl.style.top = `${targets.left.smash.y}px`;

    // Impact on LHS
    window.setTimeout(() => {
      soundManager.playPop();
      onLhsImpact();
      splitLeftEl.classList.add('smashed');
      window.setTimeout(() => {
        splitLeftEl.style.display = 'none';
      }, 180);

      // Stage 3: Smash Side 2 (RHS) into constant
      window.setTimeout(() => {
        splitRightEl.classList.remove('hovering');
        splitRightEl.classList.add('smashing');
        splitRightEl.style.left = `${targets.right.smash.x}px`;
        splitRightEl.style.top = `${targets.right.smash.y}px`;

        // Impact on RHS
        window.setTimeout(() => {
          soundManager.playSnap();
          splitRightEl.classList.add('smashed');
          window.setTimeout(() => {
            splitRightEl.style.display = 'none';
          }, 180);

          // Stage 4: Completed
          onComplete();
        }, 240);
      }, 220);
    }, 240);
  }, 450);
}
