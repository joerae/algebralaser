import { InverseChoice } from '../math/types';

export interface InversePanelCallbacks {
  onSelectChoice: (choiceId: string) => void;
}

export class InversePanelView {
  private container: HTMLElement;
  private callbacks: InversePanelCallbacks;
  private cardElements: Map<string, { cardEl: HTMLElement; fillCircle: SVGCircleElement | null }> = new Map();
  private readonly circumference: number = 2 * Math.PI * 18; // ~113.1
  private renderKey: string | null = null;

  constructor(container: HTMLElement, callbacks: InversePanelCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public render(visible: boolean, choices: InverseChoice[] = [], targetPrompt: string = 'What blasts it away?') {
    if (!visible || choices.length === 0) {
      this.renderKey = null;
      this.cardElements.clear();
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'flex';
    const nextRenderKey = JSON.stringify({
      choices: choices.map(choice => [choice.id, choice.displayText]),
      targetPrompt
    });
    if (this.renderKey === nextRenderKey) return;

    this.renderKey = nextRenderKey;
    this.cardElements.clear();

    const cardsHtml = choices.map((choice) => {
      const cardId = `inverse-choice-${choice.id}`;
      const opClass = choice.operator === '+' 
        ? 'op-plus' 
        : (choice.operator === '-' || choice.operator === '−' 
            ? 'op-minus' 
            : (choice.operator === '×' ? 'op-times' : 'op-divide'));

      return `
        <div 
          id="${cardId}" 
          class="inverse-card ${opClass}" 
          data-choice-id="${choice.id}"
          role="button"
          tabindex="0"
          title="Choose ${choice.displayText}"
        >
          <span class="inverse-val">${choice.displayText}</span>
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
      <div class="inverse-header">
        <div class="inverse-title">
          <span>⚡</span>
          <span>BLAST IT AWAY</span>
        </div>
        <div class="inverse-subtitle">${targetPrompt}</div>
      </div>
      <div class="inverse-cards-list">
        ${cardsHtml}
      </div>
    `;

    // Attach event listeners
    this.container.querySelectorAll<HTMLElement>('.inverse-card').forEach(card => {
      const choiceId = card.getAttribute('data-choice-id');
      const circle = card.querySelector<SVGCircleElement>('.dwell-fill');
      if (choiceId) {
        this.cardElements.set(card.id, {
          cardEl: card,
          fillCircle: circle
        });

        card.addEventListener('click', () => {
          this.callbacks.onSelectChoice(choiceId);
        });
      }
    });
  }

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

  public triggerForge(
    choiceId: string,
    sourceText: string,
    choice: InverseChoice,
    onComplete: () => void,
    reducedMotion: boolean = false
  ) {
    const entry = this.cardElements.get(`inverse-choice-${choiceId}`);
    const valueEl = entry?.cardEl.querySelector<HTMLElement>('.inverse-val');
    if (!entry || !valueEl || reducedMotion) {
      onComplete();
      return;
    }

    entry.cardEl.classList.add('forge-impact');
    valueEl.textContent = sourceText;

    window.setTimeout(() => {
      valueEl.classList.add('forge-flipping');
    }, 90);

    window.setTimeout(() => {
      valueEl.innerHTML = choice.operator === '÷'
        ? `<span class="flat-division"><span class="flat-division-bar"></span><span>${choice.operand}</span></span>`
        : choice.displayText;
      valueEl.classList.add('forged-result');
    }, 280);

    window.setTimeout(onComplete, 720);
  }

  public getInteractiveElements(): Array<{ id: string; type: 'inverse_choice'; element: HTMLElement }> {
    const result: Array<{ id: string; type: 'inverse_choice'; element: HTMLElement }> = [];
    for (const [cardId, { cardEl }] of this.cardElements) {
      result.push({ id: cardId, type: 'inverse_choice', element: cardEl });
    }
    return result;
  }
}
