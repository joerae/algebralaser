import { LinearEquationDef } from '../math/types';
import { getMagicItemForPuzzle } from '../data/magicItems';
import { buildConcreteStory } from '../story/buildConcreteStory';
import { generateEquationChoices } from '../story/equationChoices';
import type { StoryPresentationState } from '../story/types';

export type StoryStateListener = (state: StoryPresentationState) => void;

export class StoryController {
  private enabled: boolean = true;
  private currentSessionId: number = 0;
  private state: StoryPresentationState;
  private listeners: Set<StoryStateListener> = new Set();
  private condensingTimer: any = null;
  private sentenceTimer: any = null;

  public onReadyForSolving?: () => void;
  public reducedMotion: boolean = false;

  constructor(initialEquation: LinearEquationDef, initialEnabled: boolean = true) {
    this.enabled = initialEnabled;
    const item = getMagicItemForPuzzle(initialEquation.id);
    const story = buildConcreteStory(initialEquation, item);
    const candidates = generateEquationChoices(initialEquation, item);

    this.state = {
      enabled: this.enabled,
      phase: this.enabled ? 'reading' : 'solving',
      story,
      candidates,
      selectedCandidateId: null,
      revealedSentenceCount: this.enabled ? 0 : story.beats.length,
      lastFeedback: null,
      highlightedBeat: null,
      isPopoverOpen: false
    };

    if (this.enabled) {
      this.startSentenceReveal();
    }
  }

  public subscribe(listener: StoryStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  public getState(): StoryPresentationState {
    return this.state;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.state.enabled = enabled;

    if (!enabled) {
      this.cancelTimers();
      this.state.phase = 'solving';
      this.state.isPopoverOpen = false;
      this.notify();
    } else {
      // Re-initialize for current equation
      this.initLevel(this.state.story.equation, true);
    }
  }

  public initLevel(equation: LinearEquationDef, forceStart: boolean = false) {
    this.currentSessionId++;
    const sessionId = this.currentSessionId;
    this.cancelTimers();

    const item = getMagicItemForPuzzle(equation.id);
    const story = buildConcreteStory(equation, item);
    const candidates = generateEquationChoices(equation, item);

    this.state = {
      enabled: this.enabled,
      phase: this.enabled ? 'reading' : 'solving',
      story,
      candidates,
      selectedCandidateId: null,
      revealedSentenceCount: this.enabled ? 0 : story.beats.length,
      lastFeedback: null,
      highlightedBeat: null,
      isPopoverOpen: false
    };

    this.notify();

    if (this.enabled || forceStart) {
      this.startSentenceReveal(sessionId);
    }
  }

  private cancelTimers() {
    if (this.condensingTimer) {
      clearTimeout(this.condensingTimer);
      this.condensingTimer = null;
    }
    if (this.sentenceTimer) {
      clearTimeout(this.sentenceTimer);
      this.sentenceTimer = null;
    }
  }

  private startSentenceReveal(sessionId: number = this.currentSessionId) {
    if (!this.enabled) return;

    if (this.reducedMotion) {
      this.state.revealedSentenceCount = this.state.story.beats.length;
      this.state.phase = 'choosing_equation';
      this.notify();
      return;
    }

    const totalBeats = this.state.story.beats.length;
    let current = 0;

    const revealNext = () => {
      if (this.currentSessionId !== sessionId) return;
      current++;
      this.state.revealedSentenceCount = current;
      if (current >= totalBeats) {
        this.state.phase = 'choosing_equation';
      }
      this.notify();

      if (current < totalBeats) {
        this.sentenceTimer = setTimeout(revealNext, 450);
      }
    };

    this.sentenceTimer = setTimeout(revealNext, 200);
  }

  public selectEquationChoice(choiceId: string): { success: boolean; isCorrect: boolean; feedback: string } {
    if (this.state.phase !== 'choosing_equation') {
      return { success: false, isCorrect: false, feedback: '' };
    }

    const candidate = this.state.candidates.find(c => c.id === choiceId);
    if (!candidate) {
      return { success: false, isCorrect: false, feedback: '' };
    }

    if (!candidate.isCorrect) {
      this.state.lastFeedback = candidate.feedback;
      this.state.highlightedBeat = candidate.highlightTarget;
      this.notify();
      return { success: true, isCorrect: false, feedback: candidate.feedback };
    }

    // Correct choice!
    const sessionId = this.currentSessionId;
    this.state.selectedCandidateId = choiceId;
    this.state.phase = 'condensing';
    this.state.lastFeedback = candidate.feedback;
    this.state.highlightedBeat = null;
    this.notify();

    const duration = this.reducedMotion ? 0 : 700;

    this.condensingTimer = setTimeout(() => {
      if (this.currentSessionId !== sessionId) return;
      this.state.phase = 'solving';
      this.notify();
      if (this.onReadyForSolving) {
        this.onReadyForSolving();
      }
    }, duration);

    return { success: true, isCorrect: true, feedback: candidate.feedback };
  }

  public handlePuzzleSolved() {
    if (!this.enabled) return;
    this.state.phase = 'completed';
    this.state.isPopoverOpen = false;
    this.notify();
  }

  public handleModeSwitch() {
    // Mode switch: retain story, item, choice order, and whether the equation was correctly selected.
    // If switching during condensing, cancel animation and transition immediately.
    if (this.state.phase === 'condensing') {
      this.cancelTimers();
      this.state.phase = 'solving';
      this.notify();
      if (this.onReadyForSolving) {
        this.onReadyForSolving();
      }
    }
  }

  public restartLevel() {
    this.initLevel(this.state.story.equation, true);
  }

  public togglePopover(): boolean {
    if (!this.enabled || this.state.phase !== 'solving') return false;
    this.state.isPopoverOpen = !this.state.isPopoverOpen;
    this.notify();
    return this.state.isPopoverOpen;
  }

  public openPopover() {
    if (!this.enabled || this.state.phase !== 'solving') return;
    this.state.isPopoverOpen = true;
    this.notify();
  }

  public closePopover() {
    if (!this.state.isPopoverOpen) return;
    this.state.isPopoverOpen = false;
    this.notify();
  }

  public blocksSolverInteraction(): boolean {
    if (!this.enabled) return false;
    return (
      this.state.phase === 'reading' ||
      this.state.phase === 'choosing_equation' ||
      this.state.phase === 'condensing' ||
      this.state.isPopoverOpen
    );
  }
}
