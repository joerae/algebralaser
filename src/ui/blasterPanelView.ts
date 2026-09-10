import { BlasterType, GamePhase } from '../math/types';

export interface BlasterCallbacks {
  onSelectBlaster: (blaster: BlasterType) => void;
}

export class BlasterPanelView {
  private container: HTMLElement;
  private callbacks: BlasterCallbacks;
  private cardElements: Map<string, { cardEl: HTMLElement; fillCircle: SVGCircleElement | null }> = new Map();
  private readonly circumference: number = 2 * Math.PI * 30; // r=30 -> ~188.5

  private lastRenderKey: string = '';

  constructor(container: HTMLElement, callbacks: BlasterCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public render(
    visible: boolean, 
    equippedBlaster: BlasterType | null = null, 
    phase: GamePhase = 'ready',
    recommendedBlaster: BlasterType | null = null
  ) {
    const currentKey = `${visible}_${equippedBlaster}_${phase}_${recommendedBlaster}`;
    if (currentKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = currentKey;
    this.cardElements.clear();

    if (!visible) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'flex';

    const isAwaitingSimplify = phase === 'awaiting_simplify';
    const subTitle = isAwaitingSimplify
      ? 'Equip 🖩 to simplify the equation!'
      : (equippedBlaster ? `Blaster active! Aim laser at target.` : 'Pick a blaster with your finger ☝️');

    const blasters: Array<{ id: string; type: BlasterType; display: string; className: string; label: string }> = [
      { id: 'blaster-op-plus', type: '+', display: '+', className: 'blaster-plus', label: 'Add Blaster' },
      { id: 'blaster-op-minus', type: '-', display: '−', className: 'blaster-minus', label: 'Subtract Blaster' },
      { id: 'blaster-op-times', type: '×', display: '×', className: 'blaster-times', label: 'Multiply Blaster' },
      { id: 'blaster-op-divide', type: '÷', display: '÷', className: 'blaster-divide', label: 'Divide Blaster' },
      { id: 'blaster-op-calc', type: 'calc', display: '🖩', className: 'blaster-calc', label: 'Calculator Blaster' }
    ];

    const cardsHtml = blasters.map(({ id, type, display, className, label }) => {
      const isEquipped = equippedBlaster === type || (type === '-' && equippedBlaster === '−');
      const shouldPulse = (isAwaitingSimplify && type === 'calc') || 
        (recommendedBlaster === type || (recommendedBlaster === '−' && type === '-'));

      return `
        <div 
          id="${id}" 
          class="blaster-card ${className} ${isEquipped ? 'equipped-active' : ''} ${shouldPulse ? 'calc-guide-pulse' : ''}" 
          data-blaster="${type}"
          role="button"
          tabindex="0"
          aria-label="${label}"
          title="${label}"
        >
          <span class="blaster-symbol">${display}</span>
          <svg class="blaster-dwell-svg" viewBox="0 0 72 72">
            <circle class="blaster-dwell-track" cx="36" cy="36" r="30"></circle>
            <circle 
              class="blaster-dwell-fill" 
              cx="36" 
              cy="36" 
              r="30"
              stroke-dasharray="${this.circumference}"
              stroke-dashoffset="${this.circumference}"
            ></circle>
          </svg>
          <span class="blaster-status-pill">${isEquipped ? 'EQUIPPED' : ''}</span>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="blaster-header ${isAwaitingSimplify ? 'awaiting-calc' : ''}">
        <div class="blaster-badge">💥 Blasters</div>
        <div class="blaster-subtitle">${subTitle}</div>
      </div>
      <div class="blaster-cards-vertical">
        ${cardsHtml}
      </div>
    `;

    // Cache elements and attach click/touch listeners
    this.container.querySelectorAll<HTMLElement>('.blaster-card').forEach(card => {
      const blaster = card.getAttribute('data-blaster') as BlasterType;
      const circle = card.querySelector<SVGCircleElement>('.blaster-dwell-fill');
      this.cardElements.set(card.id, {
        cardEl: card,
        fillCircle: circle
      });

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onSelectBlaster(blaster);
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
   * Quick "nah-uh!" shake on incorrect blaster attempt
   */
  public triggerShake(blaster: BlasterType) {
    const cardId = blaster === '+' 
      ? 'blaster-op-plus' 
      : (blaster === '-' || blaster === '−' ? 'blaster-op-minus' : (blaster === '×' ? 'blaster-op-times' : (blaster === '÷' ? 'blaster-op-divide' : 'blaster-op-calc')));
    
    const item = this.cardElements.get(cardId);
    if (item) {
      item.cardEl.classList.remove('shake-nah-uh');
      void item.cardEl.offsetWidth;
      item.cardEl.classList.add('shake-nah-uh');
      window.setTimeout(() => {
        item.cardEl.classList.remove('shake-nah-uh');
      }, 500);
    }
  }

  public getInteractiveElements(): Array<{ id: string; type: 'blaster'; element: HTMLElement }> {
    const result: Array<{ id: string; type: 'blaster'; element: HTMLElement }> = [];
    for (const [cardId, { cardEl }] of this.cardElements) {
      result.push({ id: cardId, type: 'blaster', element: cardEl });
    }
    return result;
  }
}
