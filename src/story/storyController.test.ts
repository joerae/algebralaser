import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoryController } from '../game/storyController';
import { BENCHMARK_PUZZLE } from '../math/puzzleGenerator';

describe('StoryController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in reading phase and reveals sentences into choosing_equation', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    expect(controller.getState().phase).toBe('reading');
    expect(controller.getState().revealedSentenceCount).toBe(0);

    // Fast-forward sentence reveal
    vi.advanceTimersByTime(2500);

    expect(controller.getState().phase).toBe('choosing_equation');
    expect(controller.getState().revealedSentenceCount).toBe(controller.getState().story.beats.length);
  });

  it('skips reveal animation when reducedMotion is true', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    controller.reducedMotion = true;
    controller.initLevel(BENCHMARK_PUZZLE);

    expect(controller.getState().phase).toBe('choosing_equation');
    expect(controller.getState().revealedSentenceCount).toBe(controller.getState().story.beats.length);
  });

  it('handles wrong equation choice: retains phase, provides targeted feedback', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    controller.reducedMotion = true;
    controller.initLevel(BENCHMARK_PUZZLE);

    const candidates = controller.getState().candidates;
    const wrongChoice = candidates.find(c => !c.isCorrect)!;

    const res = controller.selectEquationChoice(wrongChoice.id);
    expect(res.success).toBe(true);
    expect(res.isCorrect).toBe(false);
    expect(controller.getState().phase).toBe('choosing_equation');
    expect(controller.getState().lastFeedback).toBe(wrongChoice.feedback);
  });

  it('handles correct equation choice: moves directly to solving', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    controller.reducedMotion = false;
    controller.initLevel(BENCHMARK_PUZZLE);
    vi.advanceTimersByTime(2000);

    const correctChoice = controller.getState().candidates.find(c => c.isCorrect)!;
    const readySpy = vi.fn();
    controller.onReadyForSolving = readySpy;

    const res = controller.selectEquationChoice(correctChoice.id);
    expect(res.success).toBe(true);
    expect(res.isCorrect).toBe(true);
    expect(controller.getState().phase).toBe('solving');
    expect(readySpy).toHaveBeenCalled();
  });

  it('blocks solver interaction during reading, choosing, and popover', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    expect(controller.blocksSolverInteraction()).toBe(true);

    controller.reducedMotion = true;
    controller.initLevel(BENCHMARK_PUZZLE);
    expect(controller.blocksSolverInteraction()).toBe(true); // choosing_equation

    const correct = controller.getState().candidates.find(c => c.isCorrect)!;
    controller.selectEquationChoice(correct.id);
    vi.runAllTimers();
    expect(controller.blocksSolverInteraction()).toBe(false); // in solving

    // Open popover
    controller.openPopover();
    expect(controller.blocksSolverInteraction()).toBe(true);

    controller.closePopover();
    expect(controller.blocksSolverInteraction()).toBe(false);
  });

  it('retains state on mode switch and cancels stale animations', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    controller.initLevel(BENCHMARK_PUZZLE);
    vi.advanceTimersByTime(2000);

    const correct = controller.getState().candidates.find(c => c.isCorrect)!;
    controller.selectEquationChoice(correct.id);
    expect(controller.getState().phase).toBe('solving');

    // Player switches mode
    controller.handleModeSwitch();
    expect(controller.getState().phase).toBe('solving');
  });

  it('cancels stale timers when level changes', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    expect(controller.getState().phase).toBe('reading');

    // Advance halfway, then change level
    vi.advanceTimersByTime(300);
    controller.initLevel(BENCHMARK_PUZZLE);

    // Old timer should not advance phase prematurely
    vi.advanceTimersByTime(300);
    expect(controller.getState().phase).toBe('reading');
  });

  it('disables and enables via feature flag', () => {
    const controller = new StoryController(BENCHMARK_PUZZLE, true);
    expect(controller.isEnabled()).toBe(true);
    expect(controller.blocksSolverInteraction()).toBe(true);

    controller.setEnabled(false);
    expect(controller.isEnabled()).toBe(false);
    expect(controller.getState().phase).toBe('solving');
    expect(controller.blocksSolverInteraction()).toBe(false);

    controller.setEnabled(true);
    expect(controller.isEnabled()).toBe(true);
    expect(controller.getState().phase).toBe('reading');
  });
});
