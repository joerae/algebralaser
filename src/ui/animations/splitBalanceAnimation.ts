import { ForgedOperation } from '../../math/types';
import { soundManager } from '../../audio/soundEffects';

type AnimationPoint = { x: number; y: number };

const transformAt = (point: AnimationPoint, scale: number) =>
  `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%) scale(${scale})`;

/** Animate fixed-position travellers without touching layout-triggering left/top. */
function animateTransform(
  element: HTMLElement,
  from: AnimationPoint,
  to: AnimationPoint,
  milliseconds: number,
  fromScale: number,
  toScale: number,
  easing: string
): Animation {
  const fromTransform = transformAt(from, fromScale);
  const toTransform = transformAt(to, toScale);
  element.style.transform = fromTransform;
  const animation = element.animate(
    [{ transform: fromTransform }, { transform: toTransform }],
    { duration: milliseconds, easing, fill: 'forwards' }
  );
  animation.onfinish = () => {
    element.style.transform = toTransform;
    animation.cancel();
  };
  return animation;
}

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

  // Run the original sequence at 1.25x speed (20% shorter durations).
  const duration = (milliseconds: number) => Math.round(milliseconds * 0.8);
  const sourcePoints = [
    { x: source.x - 46, y: source.y },
    { x: source.x + 46, y: source.y }
  ];

  [splitLeftEl, splitRightEl].forEach((el, index) => {
    el.className = `carried-bubble split-clone ${opClass}`;
    el.style.display = 'none';
    // Keep layout coordinates fixed. All travel happens on the compositor via transform.
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.opacity = '1';
    el.style.transform = transformAt(sourcePoints[index], 0.84);
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

  const launchAt = (
    projectile: HTMLElement,
    hover: { x: number; y: number },
    smash: { x: number; y: number },
    onImpact: () => void,
    impactSound: () => void,
    done: () => void
  ) => {
    projectile.classList.remove('holding-charge');
    projectile.classList.add('split-projectile');
    projectile.style.opacity = '1';

    projectile.classList.add('hovering');

    window.setTimeout(() => {
      projectile.classList.remove('hovering');
      projectile.classList.add('smashing');
      animateTransform(
        projectile,
        hover,
        smash,
        duration(280),
        0.94,
        1.18,
        'cubic-bezier(0.55, 0.055, 0.675, 0.19)'
      );

      window.setTimeout(() => {
        impactSound();
        onImpact();
        projectile.classList.add('smashed');
        const impactTransform = transformAt(smash, 1.18);
        const burstTransform = transformAt(smash, 1.4);
        const burstAnimation = projectile.animate(
          [
            { transform: impactTransform, opacity: 1 },
            { transform: burstTransform, opacity: 0 }
          ],
          { duration: duration(180), easing: 'ease-out', fill: 'forwards' }
        );
        window.setTimeout(() => {
          burstAnimation.cancel();
          projectile.style.display = 'none';
          done();
        }, duration(240));
      }, duration(280));
    }, duration(100));
  };

  window.requestAnimationFrame(() => {
    [splitLeftEl, splitRightEl].forEach(el => {
      el.classList.add('moving-to-hold');
    });
    animateTransform(
      splitLeftEl,
      sourcePoints[0],
      targets.left.hover,
      300,
      0.84,
      0.9,
      'cubic-bezier(0.16, 1, 0.3, 1)'
    );
    animateTransform(
      splitRightEl,
      sourcePoints[1],
      targets.right.hover,
      300,
      0.84,
      0.9,
      'cubic-bezier(0.16, 1, 0.3, 1)'
    );
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
            window.setTimeout(onComplete, duration(420));
          });
        }, duration(520));
      });
    }, 180);
  }, 300);
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
  bubbleEl.style.left = '0px';
  bubbleEl.style.top = '0px';
  bubbleEl.style.transform = transformAt(from, 1);
  if (term) term.textContent = originalSymbol;
  if (twinEl) twinEl.style.display = 'none';

  window.requestAnimationFrame(() => {
    bubbleEl.classList.add('forge-outbound');
    animateTransform(bubbleEl, from, to, 420, 1, 1.1, 'cubic-bezier(0.16, 1, 0.3, 1)');
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
        twinEl.style.left = '0px';
        twinEl.style.top = '0px';
        twinEl.style.transform = transformAt(to, 1.1);
        const twinTerm = twinEl.querySelector<HTMLElement>('.bubble-term');
        if (twinTerm) twinTerm.textContent = forgedSymbol;
      }
    }, 170);

    window.setTimeout(() => {
      bubbleEl.classList.remove('forge-flipping', 'forge-outbound');
      bubbleEl.classList.add('forge-returning');
      const returnPosition = getReturnPosition?.() || from;
      const leftReturn = { x: returnPosition.x - 44, y: returnPosition.y };
      animateTransform(bubbleEl, to, leftReturn, 420, 1.1, 0.96, 'cubic-bezier(0.16, 1, 0.3, 1)');
      if (twinEl) {
        twinEl.classList.add('forge-returning');
        const rightReturn = { x: returnPosition.x + 44, y: returnPosition.y };
        animateTransform(twinEl, to, rightReturn, 420, 1.1, 0.96, 'cubic-bezier(0.16, 1, 0.3, 1)');
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
  bubbleEl.style.left = '0px';
  bubbleEl.style.top = '0px';
  bubbleEl.style.transform = transformAt(source, 0.74);
  if (term) term.textContent = symbol;

  window.requestAnimationFrame(() => {
    bubbleEl.classList.add('sucking-up');
    animateTransform(bubbleEl, source, finger, 400, 0.74, 1, 'cubic-bezier(0.16, 1, 0.3, 1)');
  });

  window.setTimeout(() => {
    bubbleEl.style.display = 'none';
    onComplete();
  }, 430);
}
