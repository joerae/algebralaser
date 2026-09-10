import { StoryPresentationState, StoryBeat } from '../story/types';
import { renderItemIcon } from './mathItemView';

export interface StoryViewCallbacks {
  onCloseStoryRequested: () => void;
}

export class StoryView {
  private container: HTMLElement;
  private callbacks: StoryViewCallbacks;

  constructor(container: HTMLElement, callbacks: StoryViewCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public render(state: StoryPresentationState) {
    if (!state.enabled) {
      this.container.innerHTML = '';
      return;
    }

    const { phase, story, revealedSentenceCount, highlightedBeat, isPopoverOpen } = state;
    const { item, beats, shortQuestion, modifierType, modifierAmount, totalPaid, objectCount } = story;

    // Popover overlay if open
    let popoverHtml = '';
    if (isPopoverOpen) {
      popoverHtml = `
        <div id="story-popover-backdrop" class="story-popover-backdrop" role="dialog" aria-modal="true" aria-label="Magic Shop Story">
          <div class="story-popover-content">
            <div class="story-popover-header">
              <span class="story-popover-title">🧙‍♂️ Magic Shop Story</span>
              <button id="btn-close-story" class="icon-btn story-popover-close" title="Close story (Esc)">✕</button>
            </div>
            <div class="story-popover-body">
              <div class="story-full-prose">
                ${beats.map(b => `<p class="story-popover-sentence">${b.text}</p>`).join('')}
              </div>
              <div class="concrete-scene-row popover-scene">
                ${this.renderConcreteObjects(objectCount, item)}
                ${this.renderModifierBadge(modifierType, modifierAmount)}
                <span class="concrete-equals">=</span>
                <span class="concrete-total">${totalPaid} gold paid</span>
              </div>
              <div class="story-popover-question">
                <strong>Goal:</strong> ${shortQuestion}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 1. Reading & Choosing Equation: show rich story card & concise question
    if (phase === 'reading' || phase === 'choosing_equation') {
      const visibleBeats = beats.slice(0, revealedSentenceCount);

      this.container.innerHTML = `
        <div class="story-presentation-panel">
          <div class="story-card">
            <div class="story-card-header">
              <span class="story-card-icon">${item.emojiFallback}</span>
              <span class="story-card-title">${this.capitalise(item.singular)} Purchase</span>
            </div>
            <div class="story-beats-container">
              ${visibleBeats.map((b: StoryBeat, idx: number) => {
                const isHighlighted = highlightedBeat === b.highlightTarget;
                const isQuestion = b.type === 'question';
                const html = this.injectItemIcon(b.text, item);
                return `
                  <p class="story-sentence sentence-revealed ${isHighlighted ? 'sentence-highlight' : ''} ${isQuestion ? 'story-question-beat' : ''}" data-index="${idx}">
                    ${html}
                  </p>
                `;
              }).join('')}
            </div>
          </div>
        </div>
        ${popoverHtml}
      `;

      this.wirePopoverListeners();
      return;
    }

    // 2. Condensing: animate repeated items into coefficient
    if (phase === 'condensing') {
      this.container.innerHTML = `
        <div class="story-presentation-panel condensing-active">
          <div class="story-card condensing-card">
            <div class="story-condensing-banner">✨ Writing down the equation...</div>
            <div class="concrete-scene-row condensing-animation-row">
              <div class="condensing-objects">
                <span class="condensing-coeff">${objectCount > 1 ? `${objectCount} ×` : ''}</span>
                ${renderItemIcon(item, 'condensed-icon')}
              </div>
              ${this.renderModifierBadge(modifierType, modifierAmount)}
              <span class="concrete-equals">=</span>
              <span class="concrete-total">${totalPaid} gold</span>
            </div>
          </div>
        </div>
        ${popoverHtml}
      `;
      this.wirePopoverListeners();
      return;
    }

    // 3. Solving: display the compact story prompt. The S key still recalls the story.
    if (phase === 'solving') {
      this.container.innerHTML = `
        <div class="story-solving-bar">
          <div class="story-solving-left">
            <span class="story-solving-icon">${item.emojiFallback}</span>
            <span class="story-solving-question">${shortQuestion}</span>
          </div>
        </div>
        ${popoverHtml}
      `;

      this.wirePopoverListeners();
      return;
    }

    // 4. Completed: no verification box — the answer line below is sufficient
    if (phase === 'completed') {
      this.container.innerHTML = '';
      this.wirePopoverListeners();
      return;
    }
  }

  private renderConcreteObjects(count: number, item: any): string {
    const itemsHtml = Array.from({ length: count }).map((_, i) => `
      <span class="concrete-item-token" style="animation-delay: ${i * 80}ms;">
        <img src="${item.iconAsset}" class="concrete-item-img" alt="${item.singular}" />
      </span>
    `).join('');

    return `
      <div class="concrete-items-cluster" title="${count} ${count === 1 ? item.singular : item.plural}">
        ${itemsHtml}
      </div>
    `;
  }

  private renderModifierBadge(type: 'extra_charge' | 'discount' | 'none', amount: number, isHighlight: boolean = false): string {
    if (type === 'none' || amount === 0) return '';
    const isDiscount = type === 'discount';
    const cls = isDiscount ? 'mod-discount' : 'mod-charge';
    const sign = isDiscount ? '−' : '+';
    const label = isDiscount ? 'discount' : 'extra charge';
    const hlCls = isHighlight ? 'highlight-pulse' : '';

    return `
      <span class="concrete-modifier-badge ${cls} ${hlCls}">
        <span class="mod-sign">${sign}</span>
        <span class="mod-amount">${amount} gold</span>
        <span class="mod-tag">${label}</span>
      </span>
    `;
  }

  private capitalise(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private injectItemIcon(text: string, item: any): string {
    if (!text.includes('{{ITEM_ICON}}')) return text;
    const iconHtml = `<span class="story-inline-icon">${renderItemIcon(item, 'story-text-icon')}</span>`;
    return text.replace(/\{\{ITEM_ICON\}\}/g, iconHtml);
  }

  private wirePopoverListeners() {
    this.container.querySelector('#btn-close-story')?.addEventListener('click', () => {
      this.callbacks.onCloseStoryRequested();
    });

    this.container.querySelector('#story-popover-backdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'story-popover-backdrop') {
        this.callbacks.onCloseStoryRequested();
      }
    });
  }

  public getInteractiveElements(): { id: string; element: HTMLElement; type: 'utility' }[] {
    const targets: { id: string; element: HTMLElement; type: 'utility' }[] = [];
    const btnCloseStory = this.container.querySelector<HTMLElement>('#btn-close-story');
    if (btnCloseStory && btnCloseStory.offsetParent !== null) {
      targets.push({ id: 'btn-close-story', element: btnCloseStory, type: 'utility' });
    }
    return targets;
  }
}
