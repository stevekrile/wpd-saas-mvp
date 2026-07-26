import { describe, expect, it } from 'vitest';

import {
  getBoardBrickBaseHp,
  calculateOverallProgress,
  getBoardObjectiveVariants,
  getBoardOrbCountForLevel,
  toMetaEarned,
} from './rogueBrickBoard';
import type { CoreVariant } from './rogueBrickPathing';

describe('getBoardObjectiveVariants', () => {
  const run = {
    seed: 123456789,
    boardsCleared: 11,
    maxLevels: 21,
  };

  const expectAllVariantsMatchNodeColor = (variants: CoreVariant[], nodeColor: CoreVariant): void => {
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every((variant) => variant === nodeColor)).toBe(true);
  };

  it('returns one objective orb in early levels, matching the selected map-node core color', () => {
    const nodeColor: CoreVariant = 'green';
    const variants = getBoardObjectiveVariants(run, 1, nodeColor);

    expect(variants).toHaveLength(1);
    expectAllVariantsMatchNodeColor(variants, nodeColor);
  });

  it('returns two objective orbs in mid levels, both matching the selected map-node core color', () => {
    const nodeColor: CoreVariant = 'blue';
    const variants = getBoardObjectiveVariants(run, 8, nodeColor);

    expect(variants).toHaveLength(2);
    expectAllVariantsMatchNodeColor(variants, nodeColor);
  });

  it('returns three objective orbs in late levels, all matching the selected map-node core color', () => {
    const nodeColor: CoreVariant = 'yellow';
    const variants = getBoardObjectiveVariants(run, 15, nodeColor);

    expect(variants).toHaveLength(3);
    expectAllVariantsMatchNodeColor(variants, nodeColor);
  });
});

describe('getBoardOrbCountForLevel', () => {
  it('returns 1/2/3 orbs across early, mid, and late level bands', () => {
    expect(getBoardOrbCountForLevel(1, 21)).toBe(1);
    expect(getBoardOrbCountForLevel(8, 21)).toBe(2);
    expect(getBoardOrbCountForLevel(15, 21)).toBe(3);
  });
});

describe('getBoardBrickBaseHp', () => {
  it('ramps standard brick hp quickly enough in early levels', () => {
    const levelOneHp = getBoardBrickBaseHp({
      level: 1,
      maxLevels: 21,
      boardsCleared: 0,
      ballCount: 5,
      hpMultiplier: 1,
    });
    const levelThreeHp = getBoardBrickBaseHp({
      level: 3,
      maxLevels: 21,
      boardsCleared: 2,
      ballCount: 5,
      hpMultiplier: 1,
    });

    expect(levelOneHp).toBe(1);
    expect(levelThreeHp).toBeGreaterThanOrEqual(2);
  });

  it('continues increasing hp through mid and late run progression', () => {
    const earlyHp = getBoardBrickBaseHp({
      level: 3,
      maxLevels: 21,
      boardsCleared: 2,
      ballCount: 5,
      hpMultiplier: 1,
    });
    const midHp = getBoardBrickBaseHp({
      level: 10,
      maxLevels: 21,
      boardsCleared: 9,
      ballCount: 7,
      hpMultiplier: 1,
    });
    const lateHp = getBoardBrickBaseHp({
      level: 21,
      maxLevels: 21,
      boardsCleared: 20,
      ballCount: 10,
      hpMultiplier: 1,
    });

    expect(midHp).toBeGreaterThan(earlyHp);
    expect(lateHp).toBeGreaterThan(midHp);
  });

  it('thickens hp when more balls are in flight', () => {
    const baselineHp = getBoardBrickBaseHp({
      level: 8,
      maxLevels: 21,
      boardsCleared: 7,
      ballCount: 5,
      hpMultiplier: 1,
    });
    const highVolleyHp = getBoardBrickBaseHp({
      level: 8,
      maxLevels: 21,
      boardsCleared: 7,
      ballCount: 10,
      hpMultiplier: 1,
    });

    expect(highVolleyHp).toBeGreaterThan(baselineHp);
  });

  it('applies challenge hp multipliers on top of base progression', () => {
    const baseHp = getBoardBrickBaseHp({
      level: 8,
      maxLevels: 21,
      boardsCleared: 7,
      ballCount: 7,
      hpMultiplier: 1,
    });
    const harderPathHp = getBoardBrickBaseHp({
      level: 8,
      maxLevels: 21,
      boardsCleared: 7,
      ballCount: 7,
      hpMultiplier: 1.22,
    });

    expect(harderPathHp).toBeGreaterThan(baseHp);
  });
});

describe('run summary progression math', () => {
  it('awards a fixed victory bonus over defeat for the same run snapshot', () => {
    const runSnapshot = {
      level: 12,
      maxLevels: 21,
      levelGoalBricks: 60,
      levelBricksDestroyed: 31,
      mana: 82,
      boardsCleared: 9,
      wardensDefeated: ['7:blank'],
      ballCount: 7,
      damage: 3,
    };

    const defeatMeta = toMetaEarned(runSnapshot, false);
    const victoryMeta = toMetaEarned(runSnapshot, true);

    expect(victoryMeta - defeatMeta).toBe(35);
  });

  it('caps overall progress at 100% when board-level progress exceeds target', () => {
    const runSnapshot = {
      level: 21,
      maxLevels: 21,
      levelGoalBricks: 40,
      levelBricksDestroyed: 39,
    };

    const progressPct = calculateOverallProgress(runSnapshot, {
      destroyedBricks: 10,
      manaEarned: 0,
    });

    expect(progressPct).toBeLessThanOrEqual(100);
    expect(progressPct).toBe(100);
  });
});
