import { LinearEquationDef, EquationState } from '../math/types';
import { 
  createInitialState, 
  pickUpTerm, 
  cancelCarry, 
  commitDrop, 
  submitAnswer, 
  undo 
} from '../math/linearEquation';
import { soundManager } from '../audio/soundEffects';
import { generateCuratedLevelSet } from '../math/puzzleGenerator';

export type StateListener = (state: EquationState, extra?: { currentLevel: number; totalLevels: number }) => void;

export class GameController {
  private levels: LinearEquationDef[];
  private currentLevelIndex: number = 0;
  private state: EquationState;
  private listeners: Set<StateListener> = new Set();
  private cancellationTimeout: number | null = null;
  public reducedMotion: boolean = false;

  constructor(levels?: LinearEquationDef[]) {
    this.levels = levels || generateCuratedLevelSet();
    this.state = createInitialState(this.levels[0]);
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state, { 
      currentLevel: this.currentLevelIndex + 1, 
      totalLevels: this.levels.length 
    });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state, {
      currentLevel: this.currentLevelIndex + 1,
      totalLevels: this.levels.length
    }));
  }

  public getState(): EquationState {
    return this.state;
  }

  public getCurrentLevel(): LinearEquationDef {
    return this.levels[this.currentLevelIndex];
  }

  public getCurrentLevelNumber(): number {
    return this.currentLevelIndex + 1;
  }

  public getTotalLevels(): number {
    return this.levels.length;
  }

  public pickup(term: 'constant' | 'coefficient'): boolean {
    if (this.state.phase !== 'ready') return false;

    const res = pickUpTerm(this.state, term);
    this.state = res.state;
    if (res.success) {
      soundManager.playPickup();
    } else if (res.guideMessage) {
      soundManager.playIncorrect();
    }
    this.notify();
    return res.success;
  }

  public cancel(): void {
    if (this.state.phase !== 'carrying') return;
    this.state = cancelCarry(this.state);
    this.notify();
  }

  public drop(): boolean {
    if (this.state.phase !== 'carrying') return false;

    const res = commitDrop(this.state);
    if (!res.success) return false;

    this.state = res.state;
    this.notify();
    return true;
  }

  public onBeforeCorrectAdvance?: (correctVal: number, done: () => void) => void;

  public answer(choice: number): boolean {
    if (this.state.phase !== 'question' || !this.state.pendingArithmetic) return false;

    const res = submitAnswer(this.state, choice);

    if (res.correct) {
      soundManager.playCorrect();
      if (this.onBeforeCorrectAdvance) {
        this.onBeforeCorrectAdvance(choice, () => {
          this.state = res.state;
          if (this.state.stage === 'solved') {
            setTimeout(() => soundManager.playCelebration(), 300);
          }
          this.notify();
        });
        return true;
      }
      this.state = res.state;
      if (this.state.stage === 'solved') {
        setTimeout(() => soundManager.playCelebration(), 300);
      }
    } else {
      soundManager.playIncorrect();
      this.state = res.state;
    }

    this.notify();
    return res.correct;
  }

  public performUndo(): boolean {
    if (this.cancellationTimeout) clearTimeout(this.cancellationTimeout);

    const res = undo(this.state);
    if (!res.success) return false;

    this.state = res.state;
    this.notify();
    return true;
  }

  public nextLevel(): void {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.currentLevelIndex++;
    } else {
      this.currentLevelIndex = 0; // Loop or restart
    }
    this.state = createInitialState(this.levels[this.currentLevelIndex]);
    this.notify();
  }

  public restartLevel(): void {
    if (this.cancellationTimeout) clearTimeout(this.cancellationTimeout);
    this.state = createInitialState(this.levels[this.currentLevelIndex]);
    this.notify();
  }

  public getHint(): string {
    const { stage, currentB, currentA, currentC, phase, pendingArithmetic } = this.state;
    if (phase === 'question' && pendingArithmetic) {
      return pendingArithmetic.explanation;
    }
    if (stage === 'undo_constant') {
      const absB = Math.abs(currentB);
      if (currentB < 0) {
        return `Point your finger at −${absB} and carry it across the = sign to add ${absB} to ${currentC}.`;
      } else {
        return `Point your finger at +${absB} and carry it across the = sign to subtract ${absB} from ${currentC}.`;
      }
    }
    if (stage === 'undo_coefficient') {
      return `Point your finger at the ${currentA} in ${currentA}x and carry it below ${currentC} to divide both sides by ${currentA}.`;
    }
    if (stage === 'solved') {
      return `Solved! Look at the balance check, then click Next.`;
    }
    return 'Get x on its own by undoing operations with inverse steps.';
  }
}
