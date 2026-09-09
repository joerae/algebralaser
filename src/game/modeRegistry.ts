import { SolverMode, EquationState } from '../math/types';

export interface ModeDefinition {
  id: SolverMode;
  title: string;
  label: string;
  icon: string;
  description: string;
  getInstruction(state: EquationState): string;
  getBadgeHint(state: EquationState): string;
  getPedagogicalHint(state: EquationState): string;
}

export const MODE_DEFINITIONS: ModeDefinition[] = [
  {
    id: 'mode_a',
    title: 'Mode A: Move Across (Drag across =)',
    label: 'Mode A: Move Across',
    icon: '⇄',
    description: 'Drag terms across = to undo them',
    getInstruction(state: EquationState): string {
      const { phase, stage, currentB, currentA } = state;
      if (phase === 'ready') {
        if (stage === 'undo_constant') {
          const sign = currentB < 0 ? '−' : '+';
          return `Point laser at ${sign}${Math.abs(currentB)} or drag it across = to undo it.`;
        }
        if (stage === 'undo_coefficient') {
          return `Point laser at ${currentA} or drag it beneath = to divide.`;
        }
      }
      if (phase === 'carrying') {
        return 'Drag across = to the drop zone and hold to pop the bubble!';
      }
      if (phase === 'question') {
        return 'Aim laser at an answer card and hold to confirm, or click.';
      }
      if (phase === 'solved') {
        return 'Equation balanced! Aim at Next Puzzle → or hold Open Palm 👋 to continue.';
      }
      return 'Get Y on its own.';
    },
    getBadgeHint(state: EquationState): string {
      switch (state.phase) {
        case 'ready': return 'Point up at equation ☝️';
        case 'carrying': return 'Drag term to drop slot 🧲';
        case 'question': return 'Aim laser at answer 👉';
        case 'solved': return 'Show Open Palm 👋 or Point Next';
        default: return 'Point up at equation ☝️';
      }
    },
    getPedagogicalHint(state: EquationState): string {
      const { stage, currentB, currentA, currentC, phase, pendingArithmetic } = state;
      if (phase === 'question' && pendingArithmetic) {
        return pendingArithmetic.explanation;
      }
      if (stage === 'undo_constant') {
        const absB = Math.abs(currentB);
        return currentB < 0
          ? `Point your finger at −${absB} and carry it across the = sign to add ${absB} to ${currentC}.`
          : `Point your finger at +${absB} and carry it across the = sign to subtract ${absB} from ${currentC}.`;
      }
      if (stage === 'undo_coefficient') {
        return `Point your finger at the ${currentA} in ${currentA}x and carry it below ${currentC} to divide both sides by ${currentA}.`;
      }
      if (stage === 'solved') {
        return 'Solved! Look at the balance check, then click Next.';
      }
      return 'Get Y on its own by moving terms across the = sign.';
    }
  },
  {
    id: 'mode_b',
    title: 'Mode B: Balance Both Sides (Forge & Apply to Both Sides)',
    label: 'Mode B: Balance Both Sides',
    icon: '⚖️',
    description: 'Forge opposite operations and apply to both sides',
    getInstruction(state: EquationState): string {
      const { phase, stage, currentB, currentA } = state;
      if (phase === 'ready') {
        if (stage === 'undo_constant') {
          const sign = currentB < 0 ? '−' : '+';
          return `Point laser at ${sign}${Math.abs(currentB)} or click to pick it up.`;
        }
        if (stage === 'undo_coefficient') {
          return `Point laser at ${currentA} in ${currentA}x or click to pick it up.`;
        }
      }
      if (phase === 'forging') {
        return 'Hold bubble on the opposite sign (+, −, ×, ÷) for 1s to forge it, or click.';
      }
      if (phase === 'applying') {
        return 'Pull forged bubble up to the equation to balance both sides!';
      }
      if (phase === 'balancing') {
        return 'Opposites balance! Cancelling inverse operations on variable side...';
      }
      if (phase === 'question') {
        return 'Aim laser at an answer card and hold to confirm, or click.';
      }
      if (phase === 'solved') {
        return 'Equation balanced! Aim at Next Puzzle → or hold Open Palm 👋 to continue.';
      }
      return 'Get Y on its own.';
    },
    getBadgeHint(state: EquationState): string {
      switch (state.phase) {
        case 'ready': return 'Point up at equation ☝️';
        case 'forging': return 'Forge opposite sign ⚡';
        case 'applying': return 'Aim at equation to balance ⚖️';
        case 'question': return 'Aim laser at answer 👉';
        case 'solved': return 'Show Open Palm 👋 or Point Next';
        default: return 'Point up at equation ☝️';
      }
    },
    getPedagogicalHint(state: EquationState): string {
      const { stage, currentB, currentA, phase, pendingArithmetic } = state;
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
        return currentB < 0
          ? `Point at −${absB} to pick it up, then forge +${absB} and apply to both sides.`
          : `Point at +${absB} to pick it up, then forge −${absB} and apply to both sides.`;
      }
      if (stage === 'undo_coefficient') {
        return `Point at ${currentA} to pick it up, forge ÷${currentA} and apply to both sides.`;
      }
      if (stage === 'solved') {
        return 'Solved! Look at the balance check, then click Next.';
      }
      return 'Get Y on its own by undoing operations with inverse steps.';
    }
  },
  {
    id: 'mode_c',
    title: 'Mode C: Blast Balance (Shoot inverse blasters & balance the scale)',
    label: 'Mode C: Blast Balance',
    icon: '💥',
    description: 'Shoot inverse blasters & balance the scale',
    getInstruction(state: EquationState): string {
      return this.getPedagogicalHint(state);
    },
    getBadgeHint(state: EquationState): string {
      switch (state.phase) {
        case 'ready':
          return state.blasterState?.equipped ? 'Shoot LHS Term 💥' : 'Equip Blaster 🔫';
        case 'blasting_rhs':
          return 'Blast RHS to Balance 🎯';
        case 'awaiting_simplify':
          return 'Equip Calculator 🖩 & Blast';
        case 'question':
          return 'Aim laser at answer 👉';
        case 'solved':
          return 'Show Open Palm 👋 or Point Next';
        default:
          return 'Equip Blaster 🔫';
      }
    },
    getPedagogicalHint(state: EquationState): string {
      const { stage, currentB, currentA, phase, pendingArithmetic } = state;
      if (phase === 'question' && pendingArithmetic) {
        return pendingArithmetic.explanation;
      }
      if (stage === 'undo_constant') {
        const absB = Math.abs(currentB);
        const blasterSign = currentB < 0 ? '+' : '−';
        return `Equip the ${blasterSign} blaster on the left, then blast ${currentB < 0 ? '−' : '+'}${absB} to smash it free!`;
      }
      if (stage === 'undo_coefficient') {
        return `Equip the ÷ blaster on the left, then blast ${currentA} to divide both sides by ${currentA}!`;
      }
      if (stage === 'solved') {
        return 'Solved! Look at the balance check, then click Next.';
      }
      return 'Equip a blaster on the left, then blast LHS to smash free and balance.';
    }
  },
  {
    id: 'mode_d',
    title: 'Mode D: Blast Sides (Select inverse & blast both sides of scale)',
    label: 'Mode D: Blast Sides',
    icon: '🎯',
    description: 'Choose inverse operations and blast whole sides to balance',
    getInstruction(state: EquationState): string {
      return this.getPedagogicalHint(state);
    },
    getBadgeHint(state: EquationState): string {
      switch (state.phase) {
        case 'ready':
          return 'Identify what to undo ☝️';
        case 'choose_inverse':
          return 'Select inverse on left ⚡';
        case 'blast_first_side':
          return 'Blast first side 💥';
        case 'blast_second_side':
          return 'Balance other side ⚖️';
        case 'awaiting_simplify':
          return 'Point to simplify 🖩';
        case 'question':
          return 'Aim laser at answer 👉';
        case 'solved':
          return 'Show Open Palm 👋 or Point Next';
        default:
          return 'Blast Sides 🎯';
      }
    },
    getPedagogicalHint(state: EquationState): string {
      const { stage, currentB, currentA, phase, pendingArithmetic, modeDState } = state;
      if (phase === 'question' && pendingArithmetic) {
        return pendingArithmetic.explanation;
      }
      if (phase === 'ready') {
        if (stage === 'undo_constant') {
          const signStr = currentB < 0 ? '−' : '+';
          const val = Math.abs(currentB);
          return `What should you undo first? Point laser at ${signStr}${val}.`;
        }
        if (stage === 'undo_coefficient') {
          return `What should you undo next? Point laser at ${currentA} in ${currentA}Y.`;
        }
      }
      if (phase === 'choose_inverse') {
        const targetStr = modeDState?.targetTerm === 'constant'
          ? (currentB < 0 ? `−${Math.abs(currentB)}` : `+${currentB}`)
          : `×${currentA}`;
        return `What blasts away ${targetStr}? Choose the inverse operation on the left panel!`;
      }
      if (phase === 'blast_first_side') {
        const opStr = modeDState?.selectedInverse?.displayText || '';
        return `Blast ${opStr} onto the scale pan to apply it to the whole side!`;
      }
      if (phase === 'blast_second_side') {
        const opStr = modeDState?.selectedInverse?.displayText || '';
        return `Scale is unbalanced! Blast ${opStr} onto the glowing other side to restore balance!`;
      }
      if (phase === 'awaiting_simplify') {
        return 'Both sides match! Reset your aim, then point back at an unsimplified term to simplify it.';
      }
      if (phase === 'solved') {
        return 'Equation balanced and solved! Look at the balance check, then continue.';
      }
      return 'Choose the inverse operation and blast both complete sides to balance.';
    }
  }
];

export function getModeDefinition(mode: SolverMode): ModeDefinition {
  return MODE_DEFINITIONS.find(m => m.id === mode) || MODE_DEFINITIONS[0];
}
