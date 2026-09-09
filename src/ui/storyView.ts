import { StoryPresentationState, StoryBeat } from '../story/types';
import { renderItemIcon } from './mathItemView';

export interface StoryViewCallbacks {
  onShowStoryRequested: () => void;
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

    // 1. Reading & Choosing Equation: show rich story card & concrete scene
    if (phase === 'reading' || phase === 'choosing_equation') {
      const visibleBeats = beats.slice(0, revealedSentenceCount);
      const isCompleteReveal = revealedSentenceCount >= beats.length;

      this.container.innerHTML = `
        <div class="story-presentation-panel">
          <div class="story-card">
            <div class="story-card-header">
              <span class="story-card-icon">🧙‍♂️</span>
              <span class="story-card-title">Magic Shop Purchase</span>
            </div>
            <div class="story-beats-container">
              ${visibleBeats.map((b: StoryBeat, idx: number) => {
                const isHighlighted = highlightedBeat === b.highlightTarget;
                return `
                  <p class="story-sentence sentence-revealed ${isHighlighted ? 'sentence-highlight' : ''}" data-index="${idx}">
                    ${b.text}
                  </p>
                `;
              }).join('')}
            </div>

            <div class="concrete-scene-wrap ${isCompleteReveal ? 'scene-visible' : ''}">
              <div class="concrete-scene-row ${highlightedBeat === 'objects' ? 'highlight-objects' : ''}">
                ${this.renderConcreteObjects(objectCount, item)}
                ${this.renderModifierBadge(modifierType, modifierAmount, highlightedBeat === 'modifier')}
                <span class="concrete-equals">=</span>
                <span class="concrete-total ${highlightedBeat === 'total' ? 'highlight-total' : ''}">
                  ${totalPaid} gold
                </span>
              </div>
              <div class="concrete-scene-caption">
                ${shortQuestion}
              </div>
            </div>
          </div>

          <div id="story-equation-choices-container" class="story-choices-mount"></div>
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

    // 3. Solving: display compact story prompt + Show Story button
    if (phase === 'solving') {
      this.container.innerHTML = `
        <div class="story-solving-bar">
          <div class="story-solving-left">
            <span class="story-solving-icon">${item.emojiFallback}</span>
            <span class="story-solving-question">${shortQuestion}</span>
          </div>
          <button id="btn-show-story" class="btn-show-story action-btn-dwell" title="Show original story (Hotkey: S)">
            <span class="btn-text">📖 Show Story</span>
            <svg class="dwell-svg btn-dwell-svg" viewBox="0 0 44 44">
              <circle class="dwell-track" cx="22" cy="22" r="18"></circle>
              <circle class="dwell-fill" cx="22" cy="22" r="18" stroke-dasharray="113.1" stroke-dashoffset="113.1"></circle>
            </svg>
          </button>
        </div>
        ${popoverHtml}
      `;

      this.container.querySelector('#btn-show-story')?.addEventListener('click', () => {
        this.callbacks.onShowStoryRequested();
      });

      this.wirePopoverListeners();
      return;
    }

    // 4. Completed: Show story verification
    if (phase === 'completed') {
      const v = story.verification;
      this.container.innerHTML = `
        <div class="story-completed-verification">
          <div class="verification-badge">✨ Purchase Verified!</div>
          <div class="verification-lines">
            <div class="verification-line line-unit">${v.unitPriceLine}</div>
            ${v.subtotalLine ? `<div class="verification-line line-subtotal">${v.subtotalLine}</div>` : ''}
            ${v.modifierLine ? `<div class="verification-line line-modifier">${v.modifierLine}</div>` : ''}
            <div class="verification-line line-numeric pulse-match">
              <span class="numeric-check-expr">${v.numericCheckLine}</span>
              <span class="numeric-check-badge">✓ Valid</span>
            </div>
          </div>
        </div>
        ${popoverHtml}
      `;
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
    const btnShowStory = this.container.querySelector<HTMLElement>('#btn-show-story');
    if (btnShowStory && btnShowStory.offsetParent !== null) {
      targets.push({ id: 'btn-show-story', element: btnShowStory, type: 'utility' });
    }
    const btnCloseStory = this.container.querySelector<HTMLElement>('#btn-close-story');
    if (btnCloseStory && btnCloseStory.offsetParent !== null) {
      targets.push({ id: 'btn-close-story', element: btnCloseStory, type: 'utility' });
    }
    return targets;
  }
}
