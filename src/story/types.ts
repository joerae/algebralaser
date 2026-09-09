import { LinearEquationDef } from '../math/types';
import { MagicItem } from '../data/magicItems';

export type StoryBeatType = 'objects' | 'modifier' | 'total' | 'question';

export interface StoryBeat {
  type: StoryBeatType;
  text: string;
  highlightTarget?: 'objects' | 'modifier' | 'total';
}

export interface VerificationData {
  unitPriceLine: string;
  subtotalLine?: string;
  modifierLine?: string;
  numericCheckLine: string;
  solution: number;
}

export interface ConcreteStory {
  equation: LinearEquationDef;
  item: MagicItem;
  beats: StoryBeat[]; // at most 4 sentences
  fullStoryText: string;
  shortQuestion: string;
  modifierType: 'extra_charge' | 'discount' | 'none';
  modifierAmount: number;
  objectCount: number;
  totalPaid: number;
  verification: VerificationData;
}

export type MisconceptionTag =
  | 'correct'
  | 'wrong_sign'
  | 'omit_coefficient'
  | 'wrong_coefficient'
  | 'wrong_total';

export interface EquationCandidate {
  id: string; // e.g. "story-choice-0"
  a: number;
  b: number; // modifier: positive (+), negative (-), or 0
  c: number; // total
  isCorrect: boolean;
  misconception: MisconceptionTag;
  feedback: string;
  highlightTarget: 'objects' | 'modifier' | 'total' | null;
}

export type StoryPresentationPhase =
  | 'reading'
  | 'choosing_equation'
  | 'condensing'
  | 'solving'
  | 'completed';

export interface StoryPresentationState {
  enabled: boolean;
  phase: StoryPresentationPhase;
  story: ConcreteStory;
  candidates: EquationCandidate[];
  selectedCandidateId: string | null;
  revealedSentenceCount: number;
  lastFeedback: string | null;
  highlightedBeat: 'objects' | 'modifier' | 'total' | null;
  isPopoverOpen: boolean;
}
