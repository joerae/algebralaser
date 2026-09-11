import { PendingArithmetic } from '../math/types';
import { MagicItem } from '../data/magicItems';

export class AnswersView {
  private container: HTMLElement;
  private onSelectCallback: (choice: number) => void;
  private cardElements: Map<string, { cardEl: HTMLElement; fillCircle: SVGCircleElement | null }> = new Map();
  private readonly circumference: number = 2 * Math.PI * 18; // ~113.1
  private magicItem: MagicItem | null = null;

  constructor(container: HTMLElement, onSelect: (choice: number) => void) {
    this.container = container;
    this.onSelectCallback = onSelect;
  }

  public setMagicItem(item: MagicItem | null) {
    this.magicItem = item;
  }

  public render(arithmetic: PendingArithmetic | null, item?: MagicItem | null) {
    const activeItem = item !== undefined ? item : this.magicItem;
    this.cardElements.clear();

    if (!arithmetic) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      this.container.style.visibility = 'hidden';
      return;
    }

    // Positioning is completed by App.updateArrowAndLayout on the next layout pass.
    // Keep the freshly populated panel measurable without painting it at stale/default coordinates.
    this.container.style.visibility = 'hidden';
    this.container.style.display = 'flex';
    const shopBadge = activeItem ? `<span class="answers-shop-badge" title="${activeItem.singular}">${activeItem.emojiFallback}</span> ` : '';
    let opSymbol = '−';
    if (arithmetic.operator === '÷') opSymbol = '÷';
    else if (arithmetic.operator === '×') opSymbol = '×';
    else if (arithmetic.operator === '+') opSymbol = '+';
    const questionText = `${shopBadge}What is ${arithmetic.operand1} ${opSymbol} ${arithmetic.operand2}?`;

    const cardsHtml = arithmetic.choices.map((choice) => {
      const cardId = `answer-choice-${choice}`;
      return `
        <div 
          id="${cardId}" 
          class="answer-card" 
          data-choice="${choice}"
        >
          <span class="answer-val">${choice}</span>
          <svg class="dwell-svg" viewBox="0 0 44 44">
            <circle class="dwell-track" cx="22" cy="22" r="18"></circle>
            <circle 
              class="dwell-fill" 
              cx="22" 
              cy="22" 
              r="18"
              stroke-dasharray="${this.circumference}"
              stroke-dashoffset="${this.circumference}"
            ></circle>
          </svg>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="arithmetic-question">
        <div class="question-text">${questionText}</div>
      </div>
      <div class="answer-cards-list">
        ${cardsHtml}
      </div>
    `;

    // Cache card elements and attach listeners
    this.container.querySelectorAll<HTMLElement>('.answer-card').forEach(card => {
      const choice = Number(card.getAttribute('data-choice'));
      const circle = card.querySelector<SVGCircleElement>('.dwell-fill');
      this.cardElements.set(card.id, {
        cardEl: card,
        fillCircle: circle
      });

      card.addEventListener('click', () => {
        this.onSelectCallback(choice);
      });
    });
  }

  /**
   * Ultra-fast 60 FPS update of dwell progress without destroying/recreating DOM!
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

  public getInteractiveElements(): Array<{ id: string; type: 'answer'; element: HTMLElement }> {
    const result: Array<{ id: string; type: 'answer'; element: HTMLElement }> = [];
    for (const [cardId, { cardEl }] of this.cardElements) {
      result.push({ id: cardId, type: 'answer', element: cardEl });
    }
    return result;
  }
}
