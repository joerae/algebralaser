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
  source?: { x: number; y: number };
  onLhsImpact: () => void;
  onRhsImpact: () => void;
  onComplete: () => void;
  reducedMotion?: boolean;
}

export function runSplitBalanceAnimation(params: SplitAnimationParams): void {
  const {
    splitLeftEl,
    splitRightEl,
    forgedOp,
    targets,
    eqCenter,
    source = eqCenter,
    onLhsImpact,
    onRhsImpact,
    onComplete,
    reducedMotion = false
  } = params;

  const symbol = forgedOp
    ? `${forgedOp.forgedOperator === '-' ? '−' : forgedOp.forgedOperator}${forgedOp.forgedOperand}`
    : '';
  const opClass = forgedOp?.forgedOperator === '+'
    ? 'op-plus'
    : (forgedOp?.forgedOperator === '-'
      ? 'op-minus'
      : (forgedOp?.forgedOperator === '×' ? 'op-times' : 'op-divide'));

  [splitLeftEl, splitRightEl].forEach((el, index) => {
    el.className = `carried-bubble split-clone ${opClass}`;
    el.style.display = 'none';
    el.style.left = `${source.x + (index === 0 ? -46 : 46)}px`;
    el.style.top = `${source.y}px`;
    el.style.transform = 'translate(-50%, -50%) scale(1)';
    const term = el.querySelector('.bubble-term');
    if (term) term.textContent = symbol;
  });

  if (reducedMotion) {
    onLhsImpact();
    onRhsImpact();
    onComplete();
    return;
  }

  soundManager.playSplit();

  // Both forged charges leave the fingertip together and settle into a
  // symmetric holding formation beneath their respective equation sides.
  splitLeftEl.style.display = 'flex';
  splitRightEl.style.display = 'flex';
  splitLeftEl.classList.add('queued-charge');
  splitRightEl.classList.add('queued-charge', 'waiting-charge');

  const launchAt = (
    projectile: HTMLElement,
    hover: { x: number; y: number },
    smash: { x: number; y: number },
    onImpact: () => void,
    impactSound: () => void,
    done: () => void
  ) => {
    projectile.classList.remove('queued-charge', 'waiting-charge', 'holding-charge');
    projectile.classList.add('split-projectile');
    projectile.style.opacity = '1';

    window.requestAnimationFrame(() => {
      projectile.classList.add('hovering');
      projectile.style.left = `${hover.x}px`;
      projectile.style.top = `${hover.y}px`;
    });

    window.setTimeout(() => {
      projectile.classList.remove('hovering');
      projectile.classList.add('smashing');
      projectile.style.left = `${smash.x}px`;
      projectile.style.top = `${smash.y}px`;

      window.setTimeout(() => {
        impactSound();
        onImpact();
        projectile.classList.add('smashed');
        window.setTimeout(() => {
          projectile.style.display = 'none';
          done();
        }, 240);
      }, 280);
    }, 100);
  };

  window.requestAnimationFrame(() => {
    [splitLeftEl, splitRightEl].forEach(el => {
      el.classList.remove('queued-charge', 'waiting-charge');
      el.classList.add('moving-to-hold');
    });
    splitLeftEl.style.left = `${targets.left.hover.x}px`;
    splitLeftEl.style.top = `${targets.left.hover.y}px`;
    splitRightEl.style.left = `${targets.right.hover.x}px`;
    splitRightEl.style.top = `${targets.right.hover.y}px`;
  });

  window.setTimeout(() => {
    [splitLeftEl, splitRightEl].forEach(el => {
      el.classList.remove('moving-to-hold');
      el.classList.add('holding-charge');
    });

    window.setTimeout(() => {
      launchAt(splitLeftEl, targets.left.hover, targets.left.smash, onLhsImpact, () => soundManager.playPop(), () => {
        window.setTimeout(() => {
          launchAt(splitRightEl, targets.right.hover, targets.right.smash, onRhsImpact, () => soundManager.playSnap(), () => {
            window.setTimeout(onComplete, 420);
          });
        }, 520);
      });
    }, 520);
  }, 700);
}

export interface ForgeRoundTripParams {
  bubbleEl: HTMLElement;
  twinEl?: HTMLElement;
  from: { x: number; y: number };
  to: { x: number; y: number };
  originalSymbol: string;
  forgedSymbol: string;
  originalClass: string;
  forgedClass: string;
  getReturnPosition?: () => { x: number; y: number } | null;
  onComplete: () => void;
  reducedMotion?: boolean;
}

export function runForgeRoundTripAnimation(params: ForgeRoundTripParams): void {
  const { bubbleEl, twinEl, from, to, originalSymbol, forgedSymbol, originalClass, forgedClass, getReturnPosition, onComplete, reducedMotion = false } = params;
  if (reducedMotion) {
    onComplete();
    return;
  }

  const term = bubbleEl.querySelector<HTMLElement>('.bubble-term');
  bubbleEl.className = `carried-bubble split-clone forge-traveller ${originalClass}`;
  bubbleEl.style.display = 'flex';
  bubbleEl.style.opacity = '1';
  bubbleEl.style.left = `${from.x}px`;
  bubbleEl.style.top = `${from.y}px`;
  if (term) term.textContent = originalSymbol;
  if (twinEl) twinEl.style.display = 'none';

  window.requestAnimationFrame(() => {
    bubbleEl.classList.add('forge-outbound');
    bubbleEl.style.left = `${to.x}px`;
    bubbleEl.style.top = `${to.y}px`;
  });

  window.setTimeout(() => {
    bubbleEl.classList.add('forge-flipping');
    window.setTimeout(() => {
      bubbleEl.classList.remove(originalClass);
      bubbleEl.classList.add(forgedClass);
      if (term) term.textContent = forgedSymbol;
      if (twinEl) {
        twinEl.className = `carried-bubble split-clone forge-traveller forge-twin ${forgedClass}`;
        twinEl.style.display = 'flex';
        twinEl.style.opacity = '1';
        twinEl.style.left = `${to.x}px`;
        twinEl.style.top = `${to.y}px`;
        const twinTerm = twinEl.querySelector<HTMLElement>('.bubble-term');
        if (twinTerm) twinTerm.textContent = forgedSymbol;
      }
    }, 170);

    window.setTimeout(() => {
      bubbleEl.classList.remove('forge-flipping', 'forge-outbound');
      bubbleEl.classList.add('forge-returning');
      const returnPosition = getReturnPosition?.() || from;
      bubbleEl.style.left = `${returnPosition.x - 44}px`;
      bubbleEl.style.top = `${returnPosition.y}px`;
      if (twinEl) {
        twinEl.classList.add('forge-returning');
        twinEl.style.left = `${returnPosition.x + 44}px`;
        twinEl.style.top = `${returnPosition.y}px`;
      }

      window.setTimeout(() => {
        bubbleEl.style.display = 'none';
        if (twinEl) twinEl.style.display = 'none';
        onComplete();
      }, 460);
    }, 390);
  }, 420);
}

export interface PickupToFingerParams {
  bubbleEl: HTMLElement;
  source: { x: number; y: number };
  finger: { x: number; y: number };
  symbol: string;
  operationClass: string;
  onComplete: () => void;
  reducedMotion?: boolean;
}

export function runPickupToFingerAnimation(params: PickupToFingerParams): void {
  const { bubbleEl, source, finger, symbol, operationClass, onComplete, reducedMotion = false } = params;
  if (reducedMotion) {
    onComplete();
    return;
  }

  const term = bubbleEl.querySelector<HTMLElement>('.bubble-term');
  bubbleEl.className = `carried-bubble split-clone pickup-traveller ${operationClass}`;
  bubbleEl.style.display = 'flex';
  bubbleEl.style.opacity = '1';
  bubbleEl.style.left = `${source.x}px`;
  bubbleEl.style.top = `${source.y}px`;
  bubbleEl.style.transform = 'translate(-50%, -50%) scale(0.74)';
  if (term) term.textContent = symbol;

  window.requestAnimationFrame(() => {
    bubbleEl.classList.add('sucking-up');
    bubbleEl.style.left = `${finger.x}px`;
    bubbleEl.style.top = `${finger.y}px`;
    bubbleEl.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  window.setTimeout(() => {
    bubbleEl.style.display = 'none';
    onComplete();
  }, 430);
}
