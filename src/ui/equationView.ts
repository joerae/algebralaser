import { EquationState } from '../math/types';
import { formatVerification } from '../math/linearEquation';

export class EquationView {
  private container: HTMLElement;
  private onPickupCallback: (term: 'constant' | 'coefficient') => void;
  private onDropCallback: () => void;
  private onNextCallback: () => void;
  private onReplayCallback: () => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onPickup: (term: 'constant' | 'coefficient') => void;
      onDrop: () => void;
      onNext: () => void;
      onReplay: () => void;
    }
  ) {
    this.container = container;
    this.onPickupCallback = callbacks.onPickup;
    this.onDropCallback = callbacks.onDrop;
    this.onNextCallback = callbacks.onNext;
    this.onReplayCallback = callbacks.onReplay;
  }

  public render(
    state: EquationState, 
    isDestinationHovered: boolean = false, 
    _carriedPos: { x: number; y: number } | null = null
  ) {
    const { 
      currentA, 
      currentB, 
      currentC, 
      stage, 
      phase, 
      carriedTerm, 
      cancellation, 
      pendingArithmetic, 
      problem 
    } = state;

    // 1. Solved State: Final Equation + Verification
    if (phase === 'solved') {
      const verif = formatVerification(problem);
      this.container.innerHTML = `
        <div class="equation-rail" style="flex-direction: column; gap: 14px;">
          <div style="font-size: 58px; font-weight: 700; color: #38bdf8;">
            x = ${currentC}
          </div>
          <div class="verification-panel">
            <div class="verif-title">Balance Verification</div>
            <div class="verif-step">${verif.subStep}</div>
            <div class="verif-step">${verif.evalStep}</div>
            <div class="verif-step final">${verif.finalStep} ✓</div>
            <div class="verif-actions">
              <button id="btn-replay" class="icon-btn">Replay</button>
              <button id="btn-next" class="action-btn-primary action-btn-dwell">
                <span class="btn-text">Next Puzzle →</span>
                <svg class="dwell-svg btn-dwell-svg" viewBox="0 0 44 44">
                  <circle class="dwell-track" cx="22" cy="22" r="18"></circle>
                  <circle class="dwell-fill" cx="22" cy="22" r="18" stroke-dasharray="113.1" stroke-dashoffset="113.1"></circle>
                </svg>
              </button>
            </div>
            <div id="open-palm-advance" class="open-palm-advance-badge">
              <div class="palm-ring-wrap">
                <span class="palm-emoji">👋</span>
                <svg class="palm-ring-svg" viewBox="0 0 48 48">
                  <circle class="palm-track" cx="24" cy="24" r="20"></circle>
                  <circle class="palm-fill" cx="24" cy="24" r="20" stroke-dasharray="125.66" stroke-dashoffset="125.66"></circle>
                </svg>
              </div>
              <span class="palm-text">Hold Open Palm 👋 or Aim laser at Next to continue</span>
            </div>
          </div>
        </div>
      `;

      this.container.querySelector('#btn-next')?.addEventListener('click', () => this.onNextCallback());
      this.container.querySelector('#btn-replay')?.addEventListener('click', () => this.onReplayCallback());
      return;
    }

    // 2. Cancellation Animation Phase
    if (phase === 'cancelling' && cancellation) {
      this.container.innerHTML = `
        <div class="equation-rail">
          <div class="cancellation-step">
            <span class="cancelling-term">${cancellation.leftExpr}</span>
            <span class="math-symbol symbol-equals">=</span>
            <span>${cancellation.rightExpr}</span>
          </div>
        </div>
      `;
      return;
    }

    // 3. Question Phase (Unsimplified intermediate expression, ready to collapse)
    if (phase === 'question' && pendingArithmetic) {
      // When dividing by coefficient, the LHS is just x (the coefficient cancels)
      const leftSide = pendingArithmetic.operator === '÷' ? 'x' : (currentA === 1 ? 'x' : `${currentA}x`);
      let exprHtml = '';

      if (pendingArithmetic.operator === '÷') {
        exprHtml = `
          <div class="fraction" style="font-size: 54px;">
            <div class="num">${pendingArithmetic.operand1}</div>
            <div class="fraction-bar"></div>
            <div class="denom">${pendingArithmetic.operand2}</div>
          </div>
        `;
      } else {
        const opSymbol = pendingArithmetic.operator === '+' ? '+' : '−';
        exprHtml = `<span class="math-symbol" style="font-size: 58px; color: #fbbf24;">${pendingArithmetic.operand1} ${opSymbol} ${pendingArithmetic.operand2}</span>`;
      }

      this.container.innerHTML = `
        <div class="equation-rail">
          <div class="math-symbol">${leftSide}</div>
          <div class="math-symbol symbol-equals">=</div>
          <div id="arithmetic-rhs" class="collapsing-arithmetic-section">
            ${exprHtml}
          </div>
        </div>
      `;
      return;
    }

    // 4. Carrying State (Term is detached, destination appears)
    if (phase === 'carrying' && carriedTerm) {
      if (carriedTerm === 'constant') {
        const isNeg = currentB < 0;
        const absB = Math.abs(currentB);
        const leftVar = currentA === 1 ? 'x' : `${currentA}x`;

        this.container.innerHTML = `
          <div class="equation-rail">
            <div class="math-symbol">${leftVar}</div>
            <div class="term-tile term-ghost">${isNeg ? '−' : '+'} ${absB}</div>
            <div class="math-symbol symbol-equals">=</div>
            <div class="math-symbol">${currentC}</div>
            <div id="drop-destination" class="drop-destination ${isDestinationHovered ? 'active' : ''}">
              <div class="math-symbol" style="font-size: 28px; color: #38bdf8;">⇣</div>
              <div class="destination-caption">Landing Slot</div>
            </div>
          </div>
        `;

        this.attachDropListener();
        return;
      }

      if (carriedTerm === 'coefficient') {
        this.container.innerHTML = `
          <div class="equation-rail">
            <div class="term-tile term-ghost">${currentA}</div>
            <div class="math-symbol term-x">x</div>
            <div class="math-symbol symbol-equals">=</div>
            <div class="fraction">
              <div class="num">${currentC}</div>
              <div class="fraction-bar"></div>
              <div id="drop-destination" class="drop-destination ${isDestinationHovered ? 'active' : ''}" style="min-height: 48px; padding: 2px 14px;">
                <div class="denom" style="color: #38bdf8; font-size: 28px;">⇣</div>
              </div>
            </div>
          </div>
        `;

        this.attachDropListener();
        return;
      }
    }

    // 5. Ready Phase (Standard equation with interactive tiles)
    let leftHtml = '';

    // Coefficient + x
    if (currentA > 1) {
      const isInteractiveCoeff = stage === 'undo_coefficient';
      leftHtml += `
        <div id="term-coefficient" class="term-tile ${isInteractiveCoeff ? 'interactive' : ''}" data-term="coefficient">
          ${currentA}
        </div>
        <div class="math-symbol term-x">x</div>
      `;
    } else {
      leftHtml += `<div class="math-symbol term-x">x</div>`;
    }

    // Constant term
    if (currentB !== 0) {
      const isNeg = currentB < 0;
      const absB = Math.abs(currentB);
      const isInteractiveConst = stage === 'undo_constant';
      leftHtml += `
        <div id="term-constant" class="term-tile ${isInteractiveConst ? 'interactive' : ''}" data-term="constant">
          ${isNeg ? '−' : '+'} ${absB}
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="equation-rail">
        ${leftHtml}
        <div class="math-symbol symbol-equals">=</div>
        <div class="math-symbol">${currentC}</div>
      </div>
      ${state.errorMessage ? `<div class="operation-banner" style="background: rgba(244, 63, 94, 0.15); border-color: #f43f5e; color: #fecdd3;">${state.errorMessage}</div>` : ''}
    `;

    // Attach click/touch listeners for mouse/touch play
    const constTile = this.container.querySelector('#term-constant');
    const coeffTile = this.container.querySelector('#term-coefficient');

    constTile?.addEventListener('click', () => this.onPickupCallback('constant'));
    coeffTile?.addEventListener('click', () => this.onPickupCallback('coefficient'));
  }

  private attachDropListener() {
    const dest = this.container.querySelector('#drop-destination');
    dest?.addEventListener('click', () => this.onDropCallback());
  }

  // Get bounding boxes of interactive elements for ray casting
  public getInteractiveElements(): Array<{ id: string; type: 'term' | 'destination'; element: HTMLElement }> {
    const targets: Array<{ id: string; type: 'term' | 'destination'; element: HTMLElement }> = [];

    const constTerm = this.container.querySelector<HTMLElement>('#term-constant.interactive');
    if (constTerm) targets.push({ id: 'term-constant', type: 'term', element: constTerm });

    const coeffTerm = this.container.querySelector<HTMLElement>('#term-coefficient.interactive');
    if (coeffTerm) targets.push({ id: 'term-coefficient', type: 'term', element: coeffTerm });

    const dropDest = this.container.querySelector<HTMLElement>('#drop-destination');
    if (dropDest) targets.push({ id: 'drop-destination', type: 'destination', element: dropDest });

    return targets;
  }

  /**
   * Ultra-fast update of drop destination active state without rebuilding DOM!
   */
  public setDestinationHovered(isHovered: boolean) {
    const dest = this.container.querySelector('#drop-destination');
    if (dest) {
      dest.classList.toggle('active', isHovered);
    }
  }

  /**
   * Return center X of equals sign for bubble sign flipping
   */
  public getEqualsX(): number {
    const eq = this.container.querySelector('.symbol-equals');
    if (eq) {
      const rect = eq.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }
    return window.innerWidth / 2;
  }

  /**
   * Animate collapse of intermediate arithmetic (e.g. 3 - 1) into the final answer
   */
  public triggerCollapse(finalAnswer: number, onComplete: () => void) {
    const rhs = this.container.querySelector<HTMLElement>('#arithmetic-rhs');
    if (!rhs) {
      onComplete();
      return;
    }

    rhs.classList.add('collapsing');
    window.setTimeout(() => {
      rhs.innerHTML = `<span class="math-symbol" style="font-size: 58px; color: #38bdf8;">${finalAnswer}</span>`;
      rhs.classList.remove('collapsing');
      rhs.classList.add('collapsed-final');
      window.setTimeout(() => {
        onComplete();
      }, 250);
    }, 300);
  }

  /**
   * Ultra-fast update of solved state dwell and open palm progress without DOM rebuilding
   */
  public updateSolvedDwell(activeTargetId: string | null, dwellProgress: number, openPalmProgress: number) {
    const nextBtn = this.container.querySelector<HTMLElement>('#btn-next');
    if (nextBtn) {
      const isHovered = activeTargetId === 'btn-next';
      nextBtn.classList.toggle('hovered', isHovered);
      const fillCircle = nextBtn.querySelector<SVGCircleElement>('.dwell-fill');
      if (fillCircle) {
        const circumference = 113.1;
        const progress = isHovered ? Math.max(0, Math.min(1, dwellProgress)) : 0;
        fillCircle.style.strokeDashoffset = `${circumference * (1 - progress)}`;
      }
    }

    const palmIndicator = this.container.querySelector<HTMLElement>('#open-palm-advance');
    if (palmIndicator) {
      const isActive = openPalmProgress > 0;
      palmIndicator.classList.toggle('active', isActive);
      const palmFill = palmIndicator.querySelector<SVGCircleElement>('.palm-fill');
      if (palmFill) {
        const circumference = 125.66;
        const progress = Math.max(0, Math.min(1, openPalmProgress));
        palmFill.style.strokeDashoffset = `${circumference * (1 - progress)}`;
      }
    }
  }
}
