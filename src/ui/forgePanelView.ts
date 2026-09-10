import { OperationSign } from '../math/types';

export type ForgeSign = OperationSign;

export interface ForgeCallbacks {
  onSelectSign: (sign: ForgeSign) => void;
}

export class ForgePanelView {
  private container: HTMLElement;
  private callbacks: ForgeCallbacks;
  private cardElements: Map<string, { cardEl: HTMLElement; fillCircle: SVGCircleElement | null }> = new Map();
  private readonly circumference: number = 2 * Math.PI * 34; // r=34 -> ~213.6

  constructor(container: HTMLElement, callbacks: ForgeCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public render(visible: boolean, mode: 'forging' | 'applying' | null = null, forgedOp: string | null = null) {
    this.cardElements.clear();

    if (!visible || !mode) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'flex';

    const isApplying = mode === 'applying';
    const subTitle = isApplying
      ? 'Pull forged bubble up to the equation ☝️'
      : 'Hold bubble on the opposite sign for 1s, or click';

    const signs: Array<{ id: string; sign: ForgeSign; display: string; className: string }> = [
      { id: 'forge-op-plus', sign: '+', display: '+', className: 'op-plus' },
      { id: 'forge-op-minus', sign: '-', display: '−', className: 'op-minus' },
      { id: 'forge-op-times', sign: '×', display: '×', className: 'op-times' },
      { id: 'forge-op-divide', sign: '÷', display: '÷', className: 'op-divide' }
    ];

    const cardsHtml = signs.map(({ id, sign, display, className }) => {
      const isForgedChoice = isApplying && (forgedOp === sign || (sign === '-' && forgedOp === '−'));
      return `
        <div 
          id="${id}" 
          class="forge-card ${className} ${isForgedChoice ? 'forged-active' : ''} ${isApplying && !isForgedChoice ? 'dimmed' : ''}" 
          data-sign="${sign}"
          role="button"
          tabindex="0"
          aria-label="Forge ${sign}"
        >
          <span class="forge-symbol">${display}</span>
          <svg class="forge-dwell-svg" viewBox="0 0 80 80">
            <circle class="forge-dwell-track" cx="40" cy="40" r="34"></circle>
            <circle 
              class="forge-dwell-fill" 
              cx="40" 
              cy="40" 
              r="34"
              stroke-dasharray="${this.circumference}"
              stroke-dashoffset="${this.circumference}"
            ></circle>
          </svg>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="forge-header ${isApplying ? 'applying' : ''}">
        <div class="forge-badge">${isApplying ? '✨ Balanced' : 'Choose Opposite'}</div>
        <div class="forge-subtitle">${subTitle}</div>
      </div>
      <div class="forge-cards-vertical">
        ${cardsHtml}
      </div>
    `;

    // Cache elements and attach click/touch listeners
    this.container.querySelectorAll<HTMLElement>('.forge-card').forEach(card => {
      const sign = card.getAttribute('data-sign') as ForgeSign;
      const circle = card.querySelector<SVGCircleElement>('.forge-dwell-fill');
      this.cardElements.set(card.id, {
        cardEl: card,
        fillCircle: circle
      });

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isApplying) {
          this.callbacks.onSelectSign(sign);
        }
      });
    });
  }

  /**
   * Ultra-fast 60 FPS update of dwell progress without DOM destruction
   */
  public updateDwell(activeTargetId: string | null, dwellProgress: number) {
    for (const [cardId, { cardEl, fillCircle }] of this.cardElements) {
      const isHovered = activeTargetId === cardId;
      cardEl.classList.toggle('hovered', isHovered);

      if (fillCircle) {
        const progress = isHovered ? Math.max(0, Math.min(1, dwellProgress)) : 0;
        const offset = this.circumference * (1 - progress);
        fillCircle.style.strokeDashoffset = `${offset}`;
      }
    }
  }

  /**
   * Quick "nah-uh!" shake on incorrect sign attempt
   */
  public triggerShake(sign: ForgeSign) {
    const cardId = sign === '+'
      ? 'forge-op-plus'
      : (sign === '-' || sign === '−' ? 'forge-op-minus' : (sign === '×' ? 'forge-op-times' : 'forge-op-divide'));

    const item = this.cardElements.get(cardId);
    if (item) {
      item.cardEl.classList.remove('shake-nah-uh');
      // Trigger reflow to restart animation
      void item.cardEl.offsetWidth;
      item.cardEl.classList.add('shake-nah-uh');
      window.setTimeout(() => {
        item.cardEl.classList.remove('shake-nah-uh');
      }, 500);
    }
  }

  /**
   * Success flash on correct forged sign
   */
  public triggerSuccess(sign: ForgeSign) {
    const cardId = sign === '+'
      ? 'forge-op-plus'
      : (sign === '-' || sign === '−' ? 'forge-op-minus' : (sign === '×' ? 'forge-op-times' : 'forge-op-divide'));

    const item = this.cardElements.get(cardId);
    if (item) {
      item.cardEl.classList.add('forge-success');
    }
  }

  public getCardCenter(sign: ForgeSign): { x: number; y: number } | null {
    const cardId = sign === '+'
      ? 'forge-op-plus'
      : (sign === '-' || sign === '−' ? 'forge-op-minus' : (sign === '×' ? 'forge-op-times' : 'forge-op-divide'));
    const rect = this.cardElements.get(cardId)?.cardEl.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  }

  public getInteractiveElements(): Array<{ id: string; type: 'forge'; element: HTMLElement }> {
    const result: Array<{ id: string; type: 'forge'; element: HTMLElement }> = [];
    for (const [cardId, { cardEl }] of this.cardElements) {
      if (!cardEl.classList.contains('dimmed')) {
        result.push({ id: cardId, type: 'forge', element: cardEl });
      }
    }
    return result;
  }
}
