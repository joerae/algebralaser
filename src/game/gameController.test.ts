import { describe, it, expect } from 'vitest';
import { GameController } from './gameController';

describe('GameController', () => {
  it('initializes with the 4 pure curated levels (+, -, *, /)', () => {
    const gc = new GameController();
    expect(gc.getTotalLevels()).toBe(4);
    expect(gc.getCurrentLevelNumber()).toBe(1);

    // Level 1: Pure +
    expect(gc.getCurrentLevel().family).toBe('x_plus_b');
    expect(gc.getCurrentLevel().b).toBeGreaterThan(0);

    // Level 2: Pure -
    gc.nextLevel();
    expect(gc.getCurrentLevelNumber()).toBe(2);
    expect(gc.getCurrentLevel().family).toBe('x_minus_b');
    expect(gc.getCurrentLevel().b).toBeLessThan(0);

    // Level 3: Pure *
    gc.nextLevel();
    expect(gc.getCurrentLevelNumber()).toBe(3);
    expect(gc.getCurrentLevel().family).toBe('ax');
    expect(gc.getCurrentLevel().a).toBeGreaterThan(1);

    // Level 4: Pure /
    gc.nextLevel();
    expect(gc.getCurrentLevelNumber()).toBe(4);
    expect(gc.getCurrentLevel().family).toBe('x_div_d');
    expect(gc.getCurrentLevel().d).toBe(4);
  });

  it('dynamically generates endless random levels when advancing beyond level 4', () => {
    const gc = new GameController();
    
    // Advance through the first 4
    for (let i = 0; i < 3; i++) {
      gc.nextLevel();
    }
    expect(gc.getCurrentLevelNumber()).toBe(4);
    expect(gc.getTotalLevels()).toBe(4);

    // Advance to Level 5 (first dynamic random level)
    gc.nextLevel();
    expect(gc.getCurrentLevelNumber()).toBe(5);
    expect(gc.getTotalLevels()).toBe(5);
    expect(gc.getCurrentLevel().id).toContain('-5');

    // Advance to Level 6
    gc.nextLevel();
    expect(gc.getCurrentLevelNumber()).toBe(6);
    expect(gc.getTotalLevels()).toBe(6);
    expect(gc.getCurrentLevel().solution).toBeGreaterThan(0);
  });

  it('bypasses curated tutorial levels when skipTutorial is enabled', () => {
    const gc = new GameController(undefined, 'mode_a', true);
    expect(gc.isTutorialLevel()).toBe(false);
    expect(gc.getCurrentLevelNumber()).toBe(1);
    expect(gc.getCurrentLevel().id).not.toBe('curated-1');
  });

  it('allows skipping to generated levels mid-game and restoring', () => {
    const gc = new GameController();
    expect(gc.isTutorialLevel()).toBe(true);
    expect(gc.getCurrentLevel().id).toBe('curated-1');

    gc.skipToGeneratedLevels();
    expect(gc.isTutorialLevel()).toBe(false);
    expect(gc.getCurrentLevelNumber()).toBe(1);

    gc.restoreTutorialLevels();
    expect(gc.isTutorialLevel()).toBe(true);
    expect(gc.getCurrentLevel().id).toBe('curated-1');
  });

  it('automatically toggles tutorial off and fires callback when finishing the 4th level', () => {
    let completedFired = false;
    const gc = new GameController();
    gc.onTutorialCompleted = () => {
      completedFired = true;
    };

    expect(gc.isSkipTutorialEnabled()).toBe(false);

    // Advance to level 4
    gc.nextLevel(); // lvl 2
    gc.nextLevel(); // lvl 3
    gc.nextLevel(); // lvl 4 (curated-4)
    expect(gc.isSkipTutorialEnabled()).toBe(false);
    expect(completedFired).toBe(false);

    // Finishing/advancing beyond level 4
    gc.nextLevel();
    expect(gc.isSkipTutorialEnabled()).toBe(true);
    expect(completedFired).toBe(true);
  });
});
