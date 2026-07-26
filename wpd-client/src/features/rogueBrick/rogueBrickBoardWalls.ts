export type BoardWallMode = 'orthogonal' | 'cavern';

export interface BoardWallProfile {
  mode: BoardWallMode;
  width: number;
  height: number;
  leftBaseX: number;
  rightBaseX: number;
  ceilingBaseY: number;
  sampleStepPx: number;
  leftBySample: number[];
  rightBySample: number[];
  ceilingBySample: number[];
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function getInterpolatedSample(values: number[], sampleStepPx: number, y: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0] ?? 0;
  }
  const sampleY = Math.max(0, y) / Math.max(1, sampleStepPx);
  const lowerIndex = Math.floor(sampleY);
  const upperIndex = Math.min(values.length - 1, lowerIndex + 1);
  const lowerValue = values[Math.max(0, Math.min(values.length - 1, lowerIndex))] ?? values[0] ?? 0;
  const upperValue = values[upperIndex] ?? lowerValue;
  const blend = clampNumber(sampleY - lowerIndex, 0, 1);
  return lowerValue + (upperValue - lowerValue) * blend;
}

function applyCorridorConstraint(
  leftValue: number,
  rightValue: number,
  minCorridorWidth: number
): { left: number; right: number } {
  if (rightValue - leftValue >= minCorridorWidth) {
    return { left: leftValue, right: rightValue };
  }
  const center = (leftValue + rightValue) * 0.5;
  return {
    left: center - minCorridorWidth * 0.5,
    right: center + minCorridorWidth * 0.5,
  };
}

export function createBoardWallProfile(options: {
  mode: BoardWallMode;
  seed: number;
  width: number;
  height: number;
  leftBaseX: number;
  rightBaseX: number;
  minCorridorWidthPx: number;
  maxEncroachPx: number;
  ceilingBaseY?: number;
  maxCeilingDropPx?: number;
  cornerRadiusPx?: number;
  sampleStepPx?: number;
}): BoardWallProfile {
  const sampleStepPx = Math.max(4, Math.floor(options.sampleStepPx ?? 10));
  const sampleCount = Math.max(2, Math.floor(options.height / sampleStepPx) + 2);
  const ceilingSampleCount = Math.max(2, Math.floor(options.width / sampleStepPx) + 2);
  const leftBySample: number[] = [];
  const rightBySample: number[] = [];
  const ceilingBySample: number[] = [];
  const minCorridorWidth = Math.max(40, Math.floor(options.minCorridorWidthPx));
  const leftBaseX = options.leftBaseX;
  const rightBaseX = options.rightBaseX;
  const ceilingBaseY = Math.max(0, Math.floor(options.ceilingBaseY ?? 0));

  if (options.mode === 'orthogonal') {
    for (let index = 0; index < sampleCount; index += 1) {
      leftBySample.push(leftBaseX);
      rightBySample.push(rightBaseX);
    }
    for (let index = 0; index < ceilingSampleCount; index += 1) {
      ceilingBySample.push(ceilingBaseY);
    }
    return {
      mode: options.mode,
      width: options.width,
      height: options.height,
      leftBaseX,
      rightBaseX,
      ceilingBaseY,
      sampleStepPx,
      leftBySample,
      rightBySample,
      ceilingBySample,
    };
  }

  const random = createSeededRandom(options.seed);
  const maxEncroachPx = Math.max(0, Math.floor(options.maxEncroachPx));
  const maxCeilingDropPx = Math.max(0, Math.floor(options.maxCeilingDropPx ?? 0));
  let leftDrift = random() * maxEncroachPx * 0.45;
  let rightDrift = random() * maxEncroachPx * 0.45;
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  const phaseC = random() * Math.PI * 2;
  let ceilingDrift = random() * maxCeilingDropPx * 0.3;
  const ceilingPhaseA = random() * Math.PI * 2;
  const ceilingPhaseB = random() * Math.PI * 2;
  const ceilingPhaseC = random() * Math.PI * 2;
  for (let index = 0; index < sampleCount; index += 1) {
    const waveA = Math.sin(index * 0.34 + phaseA) * (maxEncroachPx * 0.34);
    const waveB = Math.sin(index * 0.15 + phaseB) * (maxEncroachPx * 0.26);
    const waveC = Math.sin(index * 0.52 + phaseC) * (maxEncroachPx * 0.18);
    leftDrift = clampNumber(leftDrift * 0.62 + (random() - 0.5) * (maxEncroachPx * 0.62), 0, maxEncroachPx);
    rightDrift = clampNumber(rightDrift * 0.62 + (random() - 0.5) * (maxEncroachPx * 0.62), 0, maxEncroachPx);
    const leftRaw = leftBaseX + clampNumber(leftDrift + waveA + waveB + waveC, 0, maxEncroachPx);
    const rightRaw = rightBaseX - clampNumber(rightDrift - waveA * 0.55 + waveB * 0.5 - waveC * 0.42, 0, maxEncroachPx);
    const constrained = applyCorridorConstraint(leftRaw, rightRaw, minCorridorWidth);
    leftBySample.push(constrained.left);
    rightBySample.push(constrained.right);
  }
  for (let index = 0; index < ceilingSampleCount; index += 1) {
    const waveA = Math.sin(index * 0.34 + ceilingPhaseA) * (maxCeilingDropPx * 0.4);
    const waveB = Math.sin(index * 0.12 + ceilingPhaseB) * (maxCeilingDropPx * 0.28);
    const waveC = Math.sin(index * 0.58 + ceilingPhaseC) * (maxCeilingDropPx * 0.18);
    ceilingDrift = clampNumber(
      ceilingDrift * 0.64 + (random() - 0.5) * (maxCeilingDropPx * 0.44),
      -maxCeilingDropPx * 0.3,
      maxCeilingDropPx
    );
    const offset = clampNumber(ceilingDrift + waveA + waveB + waveC, 0, maxCeilingDropPx);
    ceilingBySample.push(ceilingBaseY + offset);
  }

  const cornerRadiusPx = Math.max(0, Math.floor(options.cornerRadiusPx ?? 0));
  if (cornerRadiusPx > 0) {
    const topLeftX = leftBySample[0] ?? leftBaseX;
    const topRightX = rightBySample[0] ?? rightBaseX;
    const topLeftY = getInterpolatedSample(ceilingBySample, sampleStepPx, topLeftX);
    const topRightY = getInterpolatedSample(ceilingBySample, sampleStepPx, topRightX);
    const sideJoinDepth = Math.max(sampleStepPx, cornerRadiusPx * 1.2);
    const ceilingJoinWidth = Math.max(sampleStepPx, cornerRadiusPx * 1.4);

    for (let index = 0; index < leftBySample.length; index += 1) {
      const sampleY = index * sampleStepPx;
      if (sampleY > sideJoinDepth) {
        break;
      }
      const blend = clampNumber(sampleY / sideJoinDepth, 0, 1);
      const easedBlend = 1 - Math.cos((blend * Math.PI) / 2);
      leftBySample[index] = topLeftX + ((leftBySample[index] ?? topLeftX) - topLeftX) * easedBlend;
      rightBySample[index] = topRightX + ((rightBySample[index] ?? topRightX) - topRightX) * easedBlend;
    }

    for (let index = 0; index < ceilingBySample.length; index += 1) {
      const sampleX = index * sampleStepPx;
      if (sampleX >= topLeftX && sampleX <= topLeftX + ceilingJoinWidth) {
        const blend = clampNumber((sampleX - topLeftX) / ceilingJoinWidth, 0, 1);
        const easedBlend = 1 - Math.cos((blend * Math.PI) / 2);
        ceilingBySample[index] = topLeftY + ((ceilingBySample[index] ?? topLeftY) - topLeftY) * easedBlend;
      }
      if (sampleX >= topRightX - ceilingJoinWidth && sampleX <= topRightX) {
        const blend = clampNumber((topRightX - sampleX) / ceilingJoinWidth, 0, 1);
        const easedBlend = 1 - Math.cos((blend * Math.PI) / 2);
        ceilingBySample[index] = topRightY + ((ceilingBySample[index] ?? topRightY) - topRightY) * easedBlend;
      }
    }
  }

  return {
    mode: options.mode,
    width: options.width,
    height: options.height,
    leftBaseX,
    rightBaseX,
    ceilingBaseY,
    sampleStepPx,
    leftBySample,
    rightBySample,
    ceilingBySample,
  };
}

export function getBoardWallBoundsAtY(profile: BoardWallProfile, y: number): { leftX: number; rightX: number } {
  const clampedY = clampNumber(y, 0, profile.height);
  const leftX = getInterpolatedSample(profile.leftBySample, profile.sampleStepPx, clampedY);
  const rightX = getInterpolatedSample(profile.rightBySample, profile.sampleStepPx, clampedY);
  return { leftX, rightX };
}

export function getBoardWallSlopeAtY(profile: BoardWallProfile, y: number, side: 'left' | 'right'): number {
  const deltaPx = 2;
  const before = getBoardWallBoundsAtY(profile, y - deltaPx);
  const after = getBoardWallBoundsAtY(profile, y + deltaPx);
  if (side === 'left') {
    return (after.leftX - before.leftX) / (deltaPx * 2);
  }
  return (after.rightX - before.rightX) / (deltaPx * 2);
}

export function getBoardWallCeilingYAtX(profile: BoardWallProfile, x: number): number {
  const clampedX = clampNumber(x, 0, profile.width);
  return getInterpolatedSample(profile.ceilingBySample, profile.sampleStepPx, clampedX);
}

export function getBoardWallCeilingSlopeAtX(profile: BoardWallProfile, x: number): number {
  const deltaPx = 2;
  const before = getBoardWallCeilingYAtX(profile, x - deltaPx);
  const after = getBoardWallCeilingYAtX(profile, x + deltaPx);
  return (after - before) / (deltaPx * 2);
}

export function isHorizontalSpanInsideBoardWalls(options: {
  profile: BoardWallProfile;
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
  insetPx: number;
}): boolean {
  const insetPx = Math.max(0, options.insetPx);
  const sampleYs = [
    options.topY,
    (options.topY + options.bottomY) * 0.5,
    options.bottomY,
  ];
  for (const sampleY of sampleYs) {
    const bounds = getBoardWallBoundsAtY(options.profile, sampleY);
    if (options.leftX < bounds.leftX + insetPx || options.rightX > bounds.rightX - insetPx) {
      return false;
    }
  }
  return true;
}
