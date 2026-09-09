import { LinearEquationDef, EquationState, SolverMode, OperationSign, BlasterType } from '../math/types';
import { 
  createInitialState, 
  pickUpTerm, 
  cancelCarry, 
  commitDrop, 
  submitAnswer, 
  undo,
  forgeOpposite,
  applyToBothSides,
  cancelLhsInverse,
  equipBlaster,
  blastLhs,
  blastRhs,
  blastSimplify,
  identifyModeDTarget,
  selectModeDInverse,
  blastModeDSide,
  activateModeDSimplify
} from '../math/linearEquation';
import { soundManager } from '../audio/soundEffects';
import { generateCuratedLevelSet } from '../math/puzzleGenerator';
import { getModeDefinition } from './modeRegistry';

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

  public selectBlaster(blaster: BlasterType): void {
    if (this.state.mode !== 'mode_c') return;
    this.state = equipBlaster(this.state, blaster);
    soundManager.playBlasterEquip();
    this.notify();
  }

  public shootLhs(blaster?: BlasterType): boolean {
    if (this.state.mode !== 'mode_c') return false;

    const res = blastLhs(this.state, blaster);
    this.state = res.state;
    if (res.success) {
      soundManager.playSmashFree();
      setTimeout(() => soundManager.playScaleTilt(), 100);
    } else if (res.notYet) {
      soundManager.playNotYet();
    }
    this.notify();
    return res.success;
  }

  public shootRhs(): boolean {
    if (this.state.mode !== 'mode_c' || this.state.phase !== 'blasting_rhs') return false;

    const res = blastRhs(this.state);
    if (!res.success) return false;

    this.state = res.state;
    soundManager.playScaleBalance();
    this.notify();
    return true;
  }

  public shootSimplify(blaster?: BlasterType): boolean {
    if (this.state.mode !== 'mode_c' || this.state.phase !== 'awaiting_simplify') return false;

    const res = blastSimplify(this.state, blaster);
    this.state = res.state;
    if (res.success) {
      soundManager.playPickup();
    } else if (res.notYet) {
      soundManager.playNotYet();
    }
    this.notify();
    return res.success;
  }

  public identifyModeDTarget(term: 'constant' | 'coefficient'): boolean {
    if (this.state.mode !== 'mode_d' || this.state.phase !== 'ready') return false;
    const res = identifyModeDTarget(this.state, term);
    this.state = res.state;
    if (res.success) {
      soundManager.playPickup();
    } else if (res.notYet) {
      soundManager.playNotYet();
    }
    this.notify();
    return res.success;
  }

  public selectModeDInverse(choiceId: string): boolean {
    if (this.state.mode !== 'mode_d' || this.state.phase !== 'choose_inverse') return false;
    const res = selectModeDInverse(this.state, choiceId);
    this.state = res.state;
    if (res.success) {
      soundManager.playBlasterEquip();
    } else if (res.notYet) {
      soundManager.playNotYet();
    }
    this.notify();
    return res.success;
  }

  public blastModeDSide(side: 'lhs' | 'rhs'): boolean {
    if (this.state.mode !== 'mode_d') return false;
    const isFirstBlast = this.state.phase === 'blast_first_side';
    const res = blastModeDSide(this.state, side);
    if (!res.success) return false;

    this.state = res.state;
    if (isFirstBlast) {
      soundManager.playSmashFree();
      setTimeout(() => soundManager.playScaleTilt(), 100);
    } else {
      soundManager.playScaleBalance();
    }
    this.notify();
    return true;
  }

  public startSimplifyingSide(side: 'lhs' | 'rhs'): boolean {
    if (this.state.mode !== 'mode_d' || this.state.phase !== 'awaiting_simplify') return false;
    const res = activateModeDSimplify(this.state, side);
    if (!res.success) return false;

    this.state = res.state;
    soundManager.playPickup();
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
    this.state = createInitialState(this.levels[this.currentLevelIndex], this.state.mode);
    this.notify();
  }

  public restartLevel(): void {
    if (this.cancellationTimeout) clearTimeout(this.cancellationTimeout);
    this.state = createInitialState(this.levels[this.currentLevelIndex], this.state.mode);
    this.notify();
  }

  public getHint(): string {
    return getModeDefinition(this.state.mode).getPedagogicalHint(this.state);
  }
}

