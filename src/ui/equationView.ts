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
        <div class="equation-rail" style="flex-direction: column; gap: 20px;">
          <div style="font-size: 64px; font-weight: 700; color: #38bdf8;">
            x = ${currentC}
          </div>
          <div class="verification-panel">
            <div class="verif-title">Balance Verification</div>
            <div class="verif-step">${verif.subStep}</div>
            <div class="verif-step">${verif.evalStep}</div>
            <div class="verif-step final">${verif.finalStep} ✓</div>
            <div class="verif-actions">
              <button id="btn-replay" class="icon-btn">Replay</button>
              <button id="btn-next" class="action-btn-primary">Next Puzzle →</button>
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
            <span class="math-symbol">=</span>
            <span>${cancellation.rightExpr}</span>
          </div>
        </div>
        <div class="operation-banner">${cancellation.caption}</div>
      `;
      return;
    }

    // 3. Question Phase (Unsimplified intermediate expression)
    if (phase === 'question' && pendingArithmetic) {
      if (pendingArithmetic.operator === '+') {
        const leftSide = currentA === 1 ? 'x' : `${currentA}x`;
        this.container.innerHTML = `
          <div class="equation-rail">
            <div class="math-symbol">${leftSide}</div>
            <div class="math-symbol">=</div>
            <div class="math-symbol" style="color: #fbbf24;">
              ${pendingArithmetic.operand1} + ${pendingArithmetic.operand2}
            </div>
          </div>
          <div class="operation-banner">Add ${pendingArithmetic.operand2} to both sides</div>
        `;
      } else if (pendingArithmetic.operator === '-') {
        const leftSide = currentA === 1 ? 'x' : `${currentA}x`;
        this.container.innerHTML = `
          <div class="equation-rail">
            <div class="math-symbol">${leftSide}</div>
            <div class="math-symbol">=</div>
            <div class="math-symbol" style="color: #fbbf24;">
              ${pendingArithmetic.operand1} − ${pendingArithmetic.operand2}
            </div>
          </div>
          <div class="operation-banner">Subtract ${pendingArithmetic.operand2} from both sides</div>
        `;
      } else if (pendingArithmetic.operator === '÷') {
        // Real fraction display
        this.container.innerHTML = `
          <div class="equation-rail">
            <div class="math-symbol">x</div>
            <div class="math-symbol">=</div>
            <div class="fraction" style="color: #fbbf24;">
              <div class="num">${pendingArithmetic.operand1}</div>
              <div class="fraction-bar"></div>
              <div class="denom">${pendingArithmetic.operand2}</div>
            </div>
          </div>
          <div class="operation-banner">Divide both sides by ${pendingArithmetic.operand2}</div>
        `;
      }
      return;
    }

    // 4. Carrying State (Term is detached, destination appears)
    if (phase === 'carrying' && carriedTerm) {
      if (carriedTerm === 'constant') {
        const isNeg = currentB < 0;
        const absB = Math.abs(currentB);
        const invSign = isNeg ? '+' : '−';
        const leftVar = currentA === 1 ? 'x' : `${currentA}x`;

        this.container.innerHTML = `
          <div class="equation-rail">
            <div class="math-symbol">${leftVar}</div>
            <div class="term-tile term-ghost">${isNeg ? '−' : '+'} ${absB}</div>
            <div class="math-symbol">=</div>
            <div class="math-symbol">${currentC}</div>
            <div id="drop-destination" class="drop-destination ${isDestinationHovered ? 'active' : ''}">
              <div class="math-symbol" style="font-size: 40px; color: #fbbf24;">${invSign} ${absB}</div>
              <div class="destination-caption">${isNeg ? 'Add' : 'Subtract'} ${absB}</div>
            </div>
          </div>
          <div class="operation-banner">${isNeg ? 'Add' : 'Subtract'} ${absB} to both sides (Curl finger to drop)</div>
        `;

        this.attachDropListener();
        return;
      }

      if (carriedTerm === 'coefficient') {
        this.container.innerHTML = `
          <div class="equation-rail">
            <div class="term-tile term-ghost">${currentA}</div>
            <div class="math-symbol term-x">x</div>
            <div class="math-symbol">=</div>
            <div class="fraction">
              <div class="num">${currentC}</div>
              <div class="fraction-bar"></div>
              <div id="drop-destination" class="drop-destination ${isDestinationHovered ? 'active' : ''}" style="min-height: 54px; padding: 4px 16px;">
                <div class="denom" style="color: #fbbf24;">${currentA}</div>
              </div>
            </div>
          </div>
          <div class="operation-banner">Divide both sides by ${currentA} (Curl finger to drop)</div>
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
        <div class="math-symbol">=</div>
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
}
