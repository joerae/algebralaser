import { LinearEquationDef, EquationState, SolverMode, OperationSign } from '../math/types';
import { 
  createInitialState, 
  pickUpTerm, 
  cancelCarry, 
  commitDrop, 
  submitAnswer, 
  undo,
  forgeOpposite,
  applyToBothSides,
  cancelLhsInverse
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

  constructor(levels?: LinearEquationDef[], initialMode: SolverMode = 'mode_b') {
    this.levels = levels || generateCuratedLevelSet();
    this.state = createInitialState(this.levels[0], initialMode);
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

  public setMode(mode: SolverMode): void {
    if (this.state.mode === mode) return;
    if (this.cancellationTimeout) clearTimeout(this.cancellationTimeout);
    // Reset current equation state in the new mode, retaining current level progress
    this.state = createInitialState(this.levels[this.currentLevelIndex], mode);
    this.notify();
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
    } else if (res.notYet) {
      soundManager.playNotYet();
    } else if (res.guideMessage) {
      soundManager.playIncorrect();
    }
    this.notify();
    return res.success;
  }

  public cancel(): void {
    if (this.state.phase !== 'carrying' && this.state.phase !== 'forging') return;
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

  public forge(sign: OperationSign): boolean {
    if (this.state.phase !== 'forging') return false;

    const res = forgeOpposite(this.state, sign);
    if (res.correct) {
      soundManager.playForgeSuccess();
      this.state = res.state;
      this.notify();
      return true;
    } else {
      soundManager.playForgeIncorrect();
      // State is preserved on incorrect sign!
      return false;
    }
  }

  public applyBalance(): boolean {
    if (this.state.phase !== 'applying') return false;

    const res = applyToBothSides(this.state);
    if (!res.success) return false;

    soundManager.playSplit();
    this.state = res.state;
    this.notify();

    // Auto-cancel LHS inverse after short pedagogical glance (750ms)
    window.setTimeout(() => {
      if (this.state.phase === 'balancing') {
        this.state = cancelLhsInverse(this.state);
        this.notify();
      }
    }, 750);

    return true;
  }

  public cancelLhs(): void {
    if (this.state.phase !== 'balancing') return;
    this.state = cancelLhsInverse(this.state);
    this.notify();
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
    this.state = createInitialState(this.levels[this.currentLevelIndex], this.state.mode);
    this.notify();
  }

  public restartLevel(): void {
    if (this.cancellationTimeout) clearTimeout(this.cancellationTimeout);
    this.state = createInitialState(this.levels[this.currentLevelIndex], this.state.mode);
    this.notify();
  }

  public getHint(): string {
    const { mode, stage, currentB, currentA, currentC, phase, pendingArithmetic } = this.state;
    if (phase === 'question' && pendingArithmetic) {
      return pendingArithmetic.explanation;
    }
    if (phase === 'forging') {
      return 'Hold your bubble on the opposite mathematical sign for 1 second.';
    }
    if (phase === 'applying') {
      return 'Pull the forged bubble up to the = sign to balance both sides!';
    }
    if (stage === 'undo_constant') {
      const absB = Math.abs(currentB);
      if (mode === 'mode_b') {
        return currentB < 0
          ? `Point at −${absB} to pick it up, then forge +${absB} and apply to both sides.`
          : `Point at +${absB} to pick it up, then forge −${absB} and apply to both sides.`;
      }
      if (currentB < 0) {
        return `Point your finger at −${absB} and carry it across the = sign to add ${absB} to ${currentC}.`;
      } else {
        return `Point your finger at +${absB} and carry it across the = sign to subtract ${absB} from ${currentC}.`;
      }
    }
    if (stage === 'undo_coefficient') {
      if (mode === 'mode_b') {
        return `Point at ${currentA} to pick it up, forge ÷${currentA} and apply to both sides.`;
      }
      return `Point your finger at the ${currentA} in ${currentA}x and carry it below ${currentC} to divide both sides by ${currentA}.`;
    }
    if (stage === 'solved') {
      return `Solved! Look at the balance check, then click Next.`;
    }
    return 'Get Y on its own by undoing operations with inverse steps.';
  }
}

