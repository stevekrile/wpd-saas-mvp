import { describe, expect, it } from 'vitest';

import {
  createBoardWallProfile,
  getBoardWallCeilingYAtX,
  getBoardWallBoundsAtY,
  isHorizontalSpanInsideBoardWalls,
} from './rogueBrickBoardWalls';

describe('createBoardWallProfile', () => {
  it('returns fixed walls for orthogonal mode', () => {
    const profile = createBoardWallProfile({
      mode: 'orthogonal',
      seed: 123,
      width: 420,
      height: 720,
      leftBaseX: 30,
      rightBaseX: 390,
      minCorridorWidthPx: 272,
      maxEncroachPx: 0,
    });
    const upper = getBoardWallBoundsAtY(profile, 12);
    const lower = getBoardWallBoundsAtY(profile, 640);
    const ceilingLeft = getBoardWallCeilingYAtX(profile, 10);
    const ceilingMid = getBoardWallCeilingYAtX(profile, 210);
    expect(upper.leftX).toBe(30);
    expect(upper.rightX).toBe(390);
    expect(lower.leftX).toBe(30);
    expect(lower.rightX).toBe(390);
    expect(ceilingLeft).toBe(0);
    expect(ceilingMid).toBe(0);
  });

  it('is deterministic for cavern mode seed and options', () => {
    const first = createBoardWallProfile({
      mode: 'cavern',
      seed: 987654321,
      width: 420,
      height: 720,
      leftBaseX: 30,
      rightBaseX: 390,
      minCorridorWidthPx: 272,
      maxEncroachPx: 22,
      ceilingBaseY: 6,
      maxCeilingDropPx: 10,
    });
    const second = createBoardWallProfile({
      mode: 'cavern',
      seed: 987654321,
      width: 420,
      height: 720,
      leftBaseX: 30,
      rightBaseX: 390,
      minCorridorWidthPx: 272,
      maxEncroachPx: 22,
      ceilingBaseY: 6,
      maxCeilingDropPx: 10,
    });
    expect(first.leftBySample).toEqual(second.leftBySample);
    expect(first.rightBySample).toEqual(second.rightBySample);
    expect(first.ceilingBySample).toEqual(second.ceilingBySample);
  });

  it('keeps a legal corridor and supports span validation', () => {
    const profile = createBoardWallProfile({
      mode: 'cavern',
      seed: 77,
      width: 420,
      height: 720,
      leftBaseX: 30,
      rightBaseX: 390,
      minCorridorWidthPx: 272,
      maxEncroachPx: 22,
      ceilingBaseY: 6,
      maxCeilingDropPx: 10,
    });
    for (let y = 0; y <= 720; y += 32) {
      const bounds = getBoardWallBoundsAtY(profile, y);
      expect(bounds.rightX - bounds.leftX).toBeGreaterThanOrEqual(272 - 0.01);
    }
    expect(
      isHorizontalSpanInsideBoardWalls({
        profile,
        leftX: 170,
        rightX: 250,
        topY: 200,
        bottomY: 240,
        insetPx: 2,
      })
    ).toBe(true);
    expect(getBoardWallCeilingYAtX(profile, 200)).toBeGreaterThanOrEqual(6);
  });
});
