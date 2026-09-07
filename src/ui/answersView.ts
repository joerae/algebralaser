import { PendingArithmetic } from '../math/types';

export class AnswersView {
  private container: HTMLElement;
  private onSelectCallback: (choice: number) => void;

  constructor(container: HTMLElement, onSelect: (choice: number) => void) {
    this.container = container;
    this.onSelectCallback = onSelect;
  }

  public render(
    arithmetic: PendingArithmetic | null,
    activeTargetId: string | null = null,
    dwellProgress: number = 0
  ) {
    if (!arithmetic) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'flex';
    const questionText = arithmetic.operator === '÷'
      ? `What is ${arithmetic.operand1} ÷ ${arithmetic.operand2}?`
      : `What is ${arithmetic.operand1} ${arithmetic.operator === '+' ? '+' : '−'} ${arithmetic.operand2}?`;

    const circumference = 2 * Math.PI * 18; // ~113.1

    const cardsHtml = arithmetic.choices.map((choice) => {
      const cardId = `answer-choice-${choice}`;
      const isHovered = activeTargetId === cardId;
      const progress = isHovered ? dwellProgress : 0;
      const strokeOffset = circumference * (1 - progress);

      return `
        <div 
          id="${cardId}" 
          class="answer-card ${isHovered ? 'hovered' : ''}" 
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
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${strokeOffset}"
            ></circle>
          </svg>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="arithmetic-question">
        <div class="question-text">${questionText}</div>
        <div class="question-subtext">Aim laser ray & hold to select, or click/tap</div>
      </div>
      <div class="answer-cards-list">
        ${cardsHtml}
      </div>
    `;

    // Attach click listeners for mouse/touch
    this.container.querySelectorAll<HTMLElement>('.answer-card').forEach(card => {
      const choice = Number(card.getAttribute('data-choice'));
      card.addEventListener('click', () => {
        this.onSelectCallback(choice);
      });
    });
  }

  public getInteractiveElements(): Array<{ id: string; type: 'answer'; element: HTMLElement }> {
    const cards = this.container.querySelectorAll<HTMLElement>('.answer-card');
    const result: Array<{ id: string; type: 'answer'; element: HTMLElement }> = [];
    cards.forEach(c => {
      if (c.id) {
        result.push({ id: c.id, type: 'answer', element: c });
      }
    });
    return result;
  }
}
