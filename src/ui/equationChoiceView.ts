import { EquationCandidate } from '../story/types';
import { MagicItem } from '../data/magicItems';
import { renderProduct, renderDivision } from './mathItemView';

export interface EquationChoiceViewCallbacks {
  onSelectChoice: (choiceId: string) => void;
}

export class EquationChoiceView {
  private container: HTMLElement;
  private callbacks: EquationChoiceViewCallbacks;

  constructor(container: HTMLElement, callbacks: EquationChoiceViewCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public render(
    candidates: EquationCandidate[],
    item: MagicItem,
    feedback: string | null = null,
    selectedId: string | null = null
  ) {
    if (!candidates || candidates.length === 0) {
      this.container.innerHTML = '';
      return;
    }

    const cardsHtml = candidates.map((cand, index) => {
      const isSelected = selectedId === cand.id;
      const keyNum = index + 1;

      // Render the candidate equation expression
      const productHtml = cand.d && cand.d > 1
        ? renderDivision(cand.d, item)
        : renderProduct(cand.a, item, {
            tileClass: 'choice-coeff-tile',
            timesClass: 'choice-times-symbol'
          });
      let modifierHtml = '';
      if (cand.b > 0) {
        modifierHtml = `<span class="choice-modifier-tile op-plus">+ ${cand.b}</span>`;
      } else if (cand.b < 0) {
        modifierHtml = `<span class="choice-modifier-tile op-minus">− ${Math.abs(cand.b)}</span>`;
      }

      return `
        <button id="${cand.id}" class="story-equation-card ${isSelected ? 'selected' : ''}" data-choice-id="${cand.id}" aria-label="Equation choice ${keyNum}">
          <div class="choice-equation-expr">
            <div class="choice-lhs">
              ${productHtml}
              ${modifierHtml}
            </div>
            <span class="choice-equals">=</span>
            <span class="choice-rhs">${cand.c}</span>
          </div>
          <svg class="dwell-svg choice-dwell-svg" viewBox="0 0 44 44">
            <circle class="dwell-track" cx="22" cy="22" r="18"></circle>
            <circle class="dwell-fill" cx="22" cy="22" r="18" stroke-dasharray="113.1" stroke-dashoffset="113.1"></circle>
          </svg>
        </button>
      `;
    }).join('');

    const feedbackHtml = feedback ? `
      <div class="story-choice-feedback-banner animate-fade-in" role="alert">
        <span class="feedback-icon">💡</span>
        <span class="feedback-text">${feedback}</span>
      </div>
    ` : '';

    this.container.innerHTML = `
      ${feedbackHtml}
      <div class="story-equation-cards-vertical">
        ${cardsHtml}
      </div>
    `;

    this.container.querySelectorAll<HTMLButtonElement>('.story-equation-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const choiceId = btn.dataset.choiceId;
        if (choiceId) {
          this.callbacks.onSelectChoice(choiceId);
        }
      });
    });
  }

  public updateDwell(hoveredTargetId: string | null, progress: number) {
    this.container.querySelectorAll<HTMLElement>('.story-equation-card').forEach(card => {
      const isTarget = hoveredTargetId === card.id;
      const fillCircle = card.querySelector<SVGCircleElement>('.dwell-fill');

      if (isTarget) {
        card.classList.add('dwell-active');
        if (fillCircle) {
          const circumference = 113.1;
          const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));
          fillCircle.style.strokeDashoffset = `${offset}`;
        }
      } else {
        card.classList.remove('dwell-active');
        if (fillCircle) {
          fillCircle.style.strokeDashoffset = '113.1';
        }
      }
    });
  }

  public triggerShake(choiceId: string) {
    const card = this.container.querySelector<HTMLElement>(`#${choiceId}`);
    if (card) {
      card.classList.remove('shake-card');
      void card.offsetWidth; // trigger reflow
      card.classList.add('shake-card');
    }
  }

  public getInteractiveElements(): { id: string; element: HTMLElement; type: 'equation_choice' }[] {
    const targets: { id: string; element: HTMLElement; type: 'equation_choice' }[] = [];
    this.container.querySelectorAll<HTMLElement>('.story-equation-card').forEach(card => {
      if (card.offsetParent !== null) {
        targets.push({
          id: card.id,
          element: card,
          type: 'equation_choice'
        });
      }
    });
    return targets;
  }
}
