import { EquationState, ScaleTilt } from '../math/types';

export interface EquationViewCallbacks {
  onPickup: (term: 'constant' | 'coefficient') => void;
  onDrop: () => void;
  onNext: () => void;
  onReplay: () => void;
  onNotYet?: (term: 'coefficient') => void;
  onApplyEquals?: () => void;
  onBlastRhs?: () => void;
  onBlastSimplify?: () => void;
}

export class EquationView {
  private container: HTMLElement;
  private onPickupCallback: (term: 'constant' | 'coefficient') => void;
  private onDropCallback: () => void;
  private onNextCallback: () => void;
  private onReplayCallback: () => void;
  private onNotYetCallback?: (term: 'coefficient') => void;
  private onApplyEqualsCallback?: () => void;
  private onBlastRhsCallback?: () => void;
  private onBlastSimplifyCallback?: () => void;

  constructor(
    container: HTMLElement,
    callbacks: EquationViewCallbacks
  ) {
    this.container = container;
    this.onPickupCallback = callbacks.onPickup;
    this.onDropCallback = callbacks.onDrop;
    this.onNextCallback = callbacks.onNext;
    this.onReplayCallback = callbacks.onReplay;
    this.onNotYetCallback = callbacks.onNotYet;
    this.onApplyEqualsCallback = callbacks.onApplyEquals;
    this.onBlastRhsCallback = callbacks.onBlastRhs;
    this.onBlastSimplifyCallback = callbacks.onBlastSimplify;
  }

  private renderHistory(historyLines: string[]): string {
    const lines = historyLines || [];
    const n = lines.length;
    const linesHtml = lines.map((line, idx) => {
      const depth = n - idx; // depth 1 is most recent (closest to active rail)
      return `<div class="history-line" data-depth="${depth}">${line}</div>`;
    }).join('');

    return `<div class="equation-history-container">${linesHtml}</div>`;
  }

  private renderScale(tilt: ScaleTilt = 'balanced'): string {
    const tiltClass = tilt === 'lhs_heavy' 
      ? 'tilt-lhs-heavy' 
      : (tilt === 'lhs_light' ? 'tilt-lhs-light' : 'tilt-balanced');

    return `
      <div class="scale-visual-container" aria-label="Balance Scale">
        <div class="scale-beam-assembly ${tiltClass}">
          <div class="scale-pan scale-pan-lhs"></div>
          <div class="scale-beam-bar"></div>
          <div class="scale-pan scale-pan-rhs"></div>
        </div>
        <div class="scale-fulcrum-pivot">▲</div>
      </div>
    `;
  }

  public render(
    state: EquationState, 
    isDestinationHovered: boolean = false, 
    _carriedPos: { x: number; y: number } | null = null
  ) {
    const { 
      mode,
      currentA, 
      currentB, 
      currentC, 
      stage, 
      phase, 
      carriedTerm, 
      cancellation, 
      balancedDisplay,
      pendingArithmetic, 
      equationHistory 
    } = state;

    const historyHtml = this.renderHistory(equationHistory);

    // 1. Solved State: Full Derivation History + Active Solution Line + Unclipped Prominent Next Button
    if (phase === 'solved') {
      this.container.innerHTML = `
        <div class="solved-panel">
          ${historyHtml}
          <div class="equation-rail" style="padding: 6px 36px; min-height: 76px;">
            <div class="solved-line-wrap">
              <span class="math-symbol term-variable">Y</span>
              <span class="math-symbol symbol-equals">=</span>
              <span class="math-symbol" style="color: #38bdf8;">${currentC}</span>
              <span class="solved-check">✓</span>
            </div>
          </div>
          <div class="solved-actions">
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
            <span class="palm-text">Aim laser at Next Puzzle → or show Open Palm 👋 to continue</span>
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
        ${historyHtml}
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

    // 3. Mode B: Balancing Phase (showing both sides balanced and inverse cancelling)
    if (phase === 'balancing' && balancedDisplay) {
      const isCoeff = carriedTerm === 'coefficient' || stage === 'undo_coefficient';
      let leftHtml = '';
      let rightHtml = '';

      if (isCoeff) {
        leftHtml = `
          <span class="balanced-term-group">
            <span class="cancelling-term">${currentA} <span class="term-times">x</span></span>
            <span class="term-variable">Y</span>
            <span class="cancelling-term op-divide">÷ ${currentA}</span>
          </span>
        `;
        rightHtml = `
          <span class="math-symbol op-divide" style="font-size: 52px;">
            ${balancedDisplay.rightBefore} ÷ ${state.forgedOperation?.forgedOperand || currentA}
          </span>
        `;
      } else {
        const absB = Math.abs(currentB);
        const isNeg = currentB < 0;
        const origSign = isNeg ? '−' : '+';
        const forgeSign = isNeg ? '+' : '−';
        const leftVar = currentA > 1 
          ? `${currentA} <span class="term-times">x</span> <span class="term-variable">Y</span>` 
          : `<span class="term-variable">Y</span>`;

        leftHtml = `
          <div class="math-symbol">${leftVar}</div>
          <div class="balanced-cancel-group cancelling-term">
            <span>${origSign} ${absB}</span>
            <span class="${isNeg ? 'op-plus' : 'op-minus'}">${forgeSign} ${absB}</span>
          </div>
        `;
        rightHtml = `
          <span class="math-symbol" style="font-size: 52px;">
            ${balancedDisplay.rightBefore} <span class="${isNeg ? 'op-plus' : 'op-minus'}">${forgeSign} ${absB}</span>
          </span>
        `;
      }

      this.container.innerHTML = `
        ${historyHtml}
        <div class="equation-rail balanced-rail">
          ${leftHtml}
          <div class="math-symbol symbol-equals">=</div>
          ${rightHtml}
        </div>
        <div class="operation-banner balanced-banner">Opposite applied to both sides! Cancelling on variable side...</div>
      `;
      return;
    }

    // 4. Question Phase (Unsimplified intermediate expression, ready to collapse)
    if (phase === 'question' && pendingArithmetic) {
      let leftSide = '';
      if (pendingArithmetic.operator === '÷') {
        leftSide = `<span class="term-variable">Y</span>`;
      } else {
        leftSide = currentA > 1 
          ? `${currentA} <span class="term-times">x</span> <span class="term-variable">Y</span>` 
          : `<span class="term-variable">Y</span>`;
      }

      let exprHtml = '';
      if (pendingArithmetic.operator === '÷') {
        exprHtml = `
          <div class="fraction op-divide" style="font-size: 50px;">
            <div class="num">${pendingArithmetic.operand1}</div>
            <div class="fraction-bar"></div>
            <div class="denom">${pendingArithmetic.operand2}</div>
          </div>
        `;
      } else {
        const opSymbol = pendingArithmetic.operator === '+' ? '+' : '−';
        const opClass = pendingArithmetic.operator === '+' ? 'op-plus' : 'op-minus';
        exprHtml = `<span class="math-symbol ${opClass}" style="font-size: 54px;">${pendingArithmetic.operand1} ${opSymbol} ${pendingArithmetic.operand2}</span>`;
      }

      const scaleHtml = mode === 'mode_c' ? this.renderScale('balanced') : '';
      this.container.innerHTML = `
        ${historyHtml}
        <div class="equation-rail ${mode === 'mode_c' ? 'mode-c-rail' : ''}">
          <div class="math-symbol">${leftSide}</div>
          <div class="math-symbol symbol-equals">=</div>
          <div id="arithmetic-rhs" class="collapsing-arithmetic-section">
            ${exprHtml}
          </div>
        </div>
        ${scaleHtml}
      `;
      return;
    }

    // 5. Mode B: Forging & Applying Phase (Original remains visible in equation)
    if (mode === 'mode_b' && (phase === 'forging' || phase === 'applying')) {
      let leftHtml = '';
      const isCoeff = carriedTerm === 'coefficient';
      const isConst = carriedTerm === 'constant';
      const isApplying = phase === 'applying';

      // Coefficient
      if (currentA > 1) {
        leftHtml += `
          <div id="term-coefficient" class="term-tile op-times ${isCoeff ? 'selected-term' : ''}" data-term="coefficient">
            ${currentA}
          </div>
          <div class="math-symbol term-times op-times">x</div>
          <div class="math-symbol term-variable">Y</div>
        `;
      } else {
        leftHtml += `<div class="math-symbol term-variable">Y</div>`;
      }

      // Constant term
      if (currentB !== 0) {
        const isNeg = currentB < 0;
        const absB = Math.abs(currentB);
        leftHtml += `
          <div id="term-constant" class="term-tile ${isNeg ? 'op-minus' : 'op-plus'} ${isConst ? 'selected-term' : ''}" data-term="constant">
            ${isNeg ? '−' : '+'} ${absB}
          </div>
        `;
      }

      const equalsTargetHtml = isApplying
        ? `
          <div id="eq-equals-target" class="symbol-equals-target ${isDestinationHovered ? 'active' : ''}" role="button" title="Apply to both sides">
            <span class="math-symbol symbol-equals">=</span>
          </div>
        `
        : `<div class="math-symbol symbol-equals">=</div>`;

      this.container.innerHTML = `
        ${historyHtml}
        <div id="equation-drop-target" class="equation-rail mode-b-rail ${isApplying ? 'applying-target' : ''} ${isDestinationHovered ? 'active' : ''}">
          ${leftHtml}
          ${equalsTargetHtml}
          <div id="term-rhs" class="math-symbol">${currentC}</div>
        </div>
      `;

      if (isApplying) {
        this.container.querySelector('#equation-drop-target')?.addEventListener('click', () => {
          this.onApplyEqualsCallback?.();
        });
        this.container.querySelector('#eq-equals-target')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onApplyEqualsCallback?.();
        });
      }
      return;
    }

    // 5b. Mode C: Blasting RHS Phase (LHS popped, operand attached to laser, RHS awaiting blast)
    if (mode === 'mode_c' && phase === 'blasting_rhs') {
      const isCoeff = stage === 'undo_coefficient';
      const leftVar = isCoeff
        ? `<div class="math-symbol term-variable">Y</div>`
        : (currentA > 1 
            ? `<div class="term-tile op-times">${currentA}</div><div class="math-symbol term-times op-times">x</div><div class="math-symbol term-variable">Y</div>` 
            : `<div class="math-symbol term-variable">Y</div>`);

      const operand = state.blasterState?.carriedOperand;
      const opSign = operand ? operand.operator : '+';
      const opVal = operand ? operand.value : '';
      const scaleHtml = this.renderScale(state.blasterState?.scaleTilt);

      this.container.innerHTML = `
        ${historyHtml}
        <div class="equation-rail mode-c-rail">
          ${leftVar}
          <div class="math-symbol symbol-equals">=</div>
          <div id="term-rhs-mode-c" class="math-symbol blast-rhs-target ${isDestinationHovered ? 'active' : ''}" role="button" title="Blast RHS with ${opSign}${opVal}">
            ${currentC}
          </div>
        </div>
        ${scaleHtml}
        <div class="operation-banner mode-c-banner">
          Aim your laser at ${currentC} to balance the scale with ${opSign}${opVal}! ⚡
        </div>
      `;

      this.container.querySelector('#term-rhs-mode-c')?.addEventListener('click', () => {
        this.onBlastRhsCallback?.();
      });
      return;
    }

    // 5c. Mode C: Awaiting Simplify Phase (RHS balanced, awaiting Calculator blaster)
    if (mode === 'mode_c' && phase === 'awaiting_simplify') {
      const isCoeff = stage === 'undo_coefficient';
      const leftVar = isCoeff
        ? `<div class="math-symbol term-variable">Y</div>`
        : (currentA > 1 
            ? `<div class="term-tile op-times">${currentA}</div><div class="math-symbol term-times op-times">x</div><div class="math-symbol term-variable">Y</div>` 
            : `<div class="math-symbol term-variable">Y</div>`);

      const unsimplified = state.blasterState?.rhsUnsimplified;
      let rhsDisplay = '';
      if (unsimplified?.op === '÷') {
        rhsDisplay = `
          <div class="fraction op-divide" style="font-size: 50px;">
            <div class="num">${unsimplified.leftNum}</div>
            <div class="fraction-bar"></div>
            <div class="denom">${unsimplified.rightNum}</div>
          </div>
        `;
      } else if (unsimplified) {
        const opSymbol = unsimplified.op === '+' ? '+' : '−';
        rhsDisplay = `${unsimplified.leftNum} ${opSymbol} ${unsimplified.rightNum}`;
      } else {
        rhsDisplay = `${currentC}`;
      }

      const scaleHtml = this.renderScale('balanced');

      this.container.innerHTML = `
        ${historyHtml}
        <div class="equation-rail mode-c-rail">
          ${leftVar}
          <div class="math-symbol symbol-equals">=</div>
          <div id="term-simplify-target" class="math-symbol blast-simplify-target ${isDestinationHovered ? 'active' : ''}" role="button" title="Blast with Calculator to simplify">
            ${rhsDisplay}
          </div>
        </div>
        ${scaleHtml}
        <div class="operation-banner mode-c-banner calc-prompt-banner">
          Scale is balanced! Equip the Calculator 🖩 blaster on the left and blast to simplify.
        </div>
      `;

      this.container.querySelector('#term-simplify-target')?.addEventListener('click', () => {
        this.onBlastSimplifyCallback?.();
      });
      return;
    }

    // 6. Mode A: Carrying State (Term is detached, landing slot appears)
    if (phase === 'carrying' && carriedTerm) {
      if (carriedTerm === 'constant') {
        const isNeg = currentB < 0;
        const absB = Math.abs(currentB);
        const leftVar = currentA > 1 
          ? `${currentA} <span class="term-times op-times">x</span> <span class="term-variable">Y</span>` 
          : `<span class="term-variable">Y</span>`;

        this.container.innerHTML = `
          ${historyHtml}
          <div class="equation-rail">
            <div class="math-symbol">${leftVar}</div>
            <div class="term-tile term-ghost ${isNeg ? 'op-minus' : 'op-plus'}">${isNeg ? '−' : '+'} ${absB}</div>
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
          ${historyHtml}
          <div class="equation-rail">
            <div class="term-tile term-ghost op-times">${currentA}</div>
            <div class="math-symbol term-times op-times">x</div>
            <div class="math-symbol term-variable">Y</div>
            <div class="math-symbol symbol-equals">=</div>
            <div class="fraction op-divide">
              <div class="num">${currentC}</div>
              <div class="fraction-bar"></div>
              <div id="drop-destination" class="drop-destination ${isDestinationHovered ? 'active' : ''}" style="min-height: 48px; padding: 2px 14px;">
                <div class="denom" style="color: #c084fc; font-size: 28px;">⇣</div>
              </div>
            </div>
          </div>
        `;

        this.attachDropListener();
        return;
      }
    }

    // 7. Ready Phase (Standard equation with spaced interactive tiles)
    let leftHtml = '';

    // Coefficient + multiplication + Y
    if (currentA > 1) {
      const isInteractiveCoeff = stage === 'undo_coefficient';
      const isNotYet = (mode === 'mode_b' || mode === 'mode_c') && currentB !== 0;
      const coeffClass = isInteractiveCoeff ? 'interactive' : (isNotYet ? 'not-yet-target' : '');
      leftHtml += `
        <div id="term-coefficient" class="term-tile op-times ${coeffClass}" data-term="coefficient">
          ${currentA}
        </div>
        <div class="math-symbol term-times op-times">x</div>
        <div class="math-symbol term-variable">Y</div>
      `;
    } else {
      leftHtml += `<div class="math-symbol term-variable">Y</div>`;
    }

    // Constant term
    if (currentB !== 0) {
      const isNeg = currentB < 0;
      const absB = Math.abs(currentB);
      const isInteractiveConst = stage === 'undo_constant';
      leftHtml += `
        <div id="term-constant" class="term-tile ${isNeg ? 'op-minus' : 'op-plus'} ${isInteractiveConst ? 'interactive' : ''}" data-term="constant">
          ${isNeg ? '−' : '+'} ${absB}
        </div>
      `;
    }

    const scaleHtml = mode === 'mode_c' ? this.renderScale(state.blasterState?.scaleTilt || 'balanced') : '';

    this.container.innerHTML = `
      ${historyHtml}
      <div class="equation-rail ${mode === 'mode_b' ? 'mode-b-rail' : (mode === 'mode_c' ? 'mode-c-rail' : '')}">
        ${leftHtml}
        <div class="math-symbol symbol-equals">=</div>
        <div class="math-symbol">${currentC}</div>
      </div>
      ${scaleHtml}
      <div id="equation-feedback-banner" class="operation-banner" style="display: ${state.errorMessage ? 'block' : 'none'}; background: rgba(244, 63, 94, 0.18); border-color: #f43f5e; color: #fecdd3;">
        ${state.errorMessage || ''}
      </div>
    `;

    // Attach click/touch listeners
    const constTile = this.container.querySelector('#term-constant');
    const coeffTile = this.container.querySelector('#term-coefficient');

    constTile?.addEventListener('click', () => {
      this.onPickupCallback('constant');
    });

    coeffTile?.addEventListener('click', () => {
      if (coeffTile.classList.contains('not-yet-target')) {
        this.triggerNotYet();
        this.onNotYetCallback?.('coefficient');
      } else {
        this.onPickupCallback('coefficient');
      }
    });
  }

  /**
   * Mode B: Gentle "NOT YET" shake on coefficient and pulse on active constant
   */
  public triggerNotYet() {
    const coeff = this.container.querySelector<HTMLElement>('#term-coefficient');
    const constant = this.container.querySelector<HTMLElement>('#term-constant');
    const banner = this.container.querySelector<HTMLElement>('#equation-feedback-banner');

    if (coeff) {
      coeff.classList.remove('shake-not-yet');
      void coeff.offsetWidth;
      coeff.classList.add('shake-not-yet');
      window.setTimeout(() => coeff.classList.remove('shake-not-yet'), 450);
    }

    if (constant) {
      constant.classList.remove('pulse-target');
      void constant.offsetWidth;
      constant.classList.add('pulse-target');
      window.setTimeout(() => constant.classList.remove('pulse-target'), 1200);
    }

    if (banner) {
      banner.style.display = 'block';
      banner.textContent = 'NOT YET — Undo the constant term first to avoid fractions!';
      banner.classList.remove('shake-not-yet');
      void banner.offsetWidth;
      banner.classList.add('shake-not-yet');
      window.setTimeout(() => {
        banner.style.display = 'none';
      }, 2500);
    }
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

    // Mode B: Not yet target for ray caster
    const notYetCoeff = this.container.querySelector<HTMLElement>('#term-coefficient.not-yet-target');
    if (notYetCoeff) targets.push({ id: 'term-coefficient-not-yet', type: 'term', element: notYetCoeff });

    // Mode A: Drop destination
    const dropDest = this.container.querySelector<HTMLElement>('#drop-destination');
    if (dropDest) targets.push({ id: 'drop-destination', type: 'destination', element: dropDest });

    // Mode B: Equals and Equation drop targets
    const eqTarget = this.container.querySelector<HTMLElement>('#equation-drop-target');
    if (eqTarget) targets.push({ id: 'equation-drop-target', type: 'destination', element: eqTarget });
    const equalsDest = this.container.querySelector<HTMLElement>('#eq-equals-target');
    if (equalsDest) targets.push({ id: 'eq-equals-target', type: 'destination', element: equalsDest });

    // Mode C: RHS and Simplify blast targets
    const rhsModeCTarget = this.container.querySelector<HTMLElement>('#term-rhs-mode-c');
    if (rhsModeCTarget) targets.push({ id: 'term-rhs-mode-c', type: 'destination', element: rhsModeCTarget });

    const simplifyTarget = this.container.querySelector<HTMLElement>('#term-simplify-target');
    if (simplifyTarget) targets.push({ id: 'term-simplify-target', type: 'destination', element: simplifyTarget });

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
    const eqTarget = this.container.querySelector('#equation-drop-target');
    if (eqTarget) {
      eqTarget.classList.toggle('active', isHovered);
    }
    const equalsTarget = this.container.querySelector('#eq-equals-target');
    if (equalsTarget) {
      equalsTarget.classList.toggle('active', isHovered);
    }
    const rhsModeCTarget = this.container.querySelector('#term-rhs-mode-c');
    if (rhsModeCTarget) {
      rhsModeCTarget.classList.toggle('active', isHovered);
    }
    const simplifyTarget = this.container.querySelector('#term-simplify-target');
    if (simplifyTarget) {
      simplifyTarget.classList.toggle('active', isHovered);
    }
  }

  /**
   * Flash LHS term during cancellation impact
   */
  public triggerLhsCancelFlash() {
    const lhsEl = this.container.querySelector<HTMLElement>('#term-constant') 
      || this.container.querySelector<HTMLElement>('#term-coefficient') 
      || this.container.querySelector<HTMLElement>('.term-tile');
    if (lhsEl) {
      lhsEl.classList.add('lhs-smash-flash');
      window.setTimeout(() => {
        lhsEl.style.opacity = '0';
      }, 250);
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

  public getEqualsRect(): DOMRect | null {
    const eq = this.container.querySelector<HTMLElement>('.symbol-equals');
    return eq ? eq.getBoundingClientRect() : null;
  }

  public getSplitTargets(): { 
    left: { hover: { x: number; y: number }; smash: { x: number; y: number } }; 
    right: { hover: { x: number; y: number }; smash: { x: number; y: number } } 
  } | null {
    const rail = this.container.querySelector<HTMLElement>('.equation-rail');
    const eq = this.container.querySelector<HTMLElement>('.symbol-equals');
    if (!rail || !eq) return null;
    const railRect = rail.getBoundingClientRect();
    const eqRect = eq.getBoundingClientRect();

    const lhsEl = this.container.querySelector<HTMLElement>('#term-constant') 
      || this.container.querySelector<HTMLElement>('#term-coefficient') 
      || this.container.querySelector<HTMLElement>('.term-tile');
    const rhsEl = this.container.querySelector<HTMLElement>('#term-rhs') 
      || this.container.querySelectorAll<HTMLElement>('.math-symbol')[1];

    const lhsRect = lhsEl ? lhsEl.getBoundingClientRect() : {
      left: eqRect.left - 120,
      width: 60,
      top: eqRect.top,
      height: eqRect.height
    };

    const rhsRect = rhsEl ? rhsEl.getBoundingClientRect() : {
      left: eqRect.right + 60,
      width: 60,
      top: eqRect.top,
      height: eqRect.height
    };

    const hoverY = railRect.top - 65;

    return {
      left: {
        hover: { x: lhsRect.left + lhsRect.width / 2, y: hoverY },
        smash: { x: lhsRect.left + lhsRect.width / 2, y: lhsRect.top + lhsRect.height / 2 }
      },
      right: {
        hover: { x: rhsRect.left + rhsRect.width / 2, y: hoverY },
        smash: { x: rhsRect.left + rhsRect.width / 2, y: rhsRect.top + rhsRect.height / 2 }
      }
    };
  }
}

