import type { CoreVariant } from './rogueBrickPathing';

export const WARDEN_BLANK_HP_MAX = 1800;
const WARDEN_MAX_SHOT_CAPACITY = 10;
const WARDEN_MAX_POWER_CAPACITY = 10;

export interface WardenVolleyRunSnapshot {
  essenceByColor: Record<CoreVariant, number>;
  ballCount: number;
  damage: number;
}

export interface WardenVolleyCaps {
  availableOrange: number;
  availableGreen: number;
  maxShotCapacity: number;
  maxPowerCapacity: number;
  shotCap: number;
  powerCap: number;
}

export interface WardenVolleySelection {
  shotCount: number;
  power: number;
}

export interface WardenShieldTearHitResolution {
  nextShieldHp: number;
  nextGraceUntilMs: number | null;
  startedGraceWindow: boolean;
  hubMessage: string | null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBlankEyeRenderMetrics(canvasWidth: number, dualEyes: boolean): { width: number; height: number; spacingPx: number } {
  const baseWidth = Math.min(canvasWidth * 0.38, 140);
  const width = dualEyes ? baseWidth * 0.78 : baseWidth;
  return {
    width,
    height: width * 0.65,
    spacingPx: dualEyes ? Math.max(92, width * 1.08) : 0,
  };
}

export function getBlankEyeCount(dualEyes: boolean): 1 | 2 {
  return dualEyes ? 2 : 1;
}

export function getBlankEncounterHpMax(dualEyes: boolean, hpPerEye = WARDEN_BLANK_HP_MAX): number {
  return hpPerEye * getBlankEyeCount(dualEyes);
}

export function normalizeBlankEyeHp(
  eyeHp: number[] | null | undefined,
  dualEyes: boolean,
  hpPerEye = WARDEN_BLANK_HP_MAX
): number[] {
  const eyeCount = getBlankEyeCount(dualEyes);
  return Array.from({ length: eyeCount }, (_, index) => {
    const hp = eyeHp?.[index];
    const safeHp = typeof hp === 'number' && Number.isFinite(hp) ? hp : hpPerEye;
    return Math.max(0, Math.min(hpPerEye, Math.round(safeHp)));
  });
}

export function getBlankCombinedHp(
  eyeHp: number[] | null | undefined,
  dualEyes: boolean,
  hpPerEye = WARDEN_BLANK_HP_MAX
): number {
  return normalizeBlankEyeHp(eyeHp, dualEyes, hpPerEye).reduce((sum, hp) => sum + hp, 0);
}

export function getWardenShotColor(shotCount: number, shotCap: number): string {
  const ratio = clampNumber(shotCount / Math.max(1, shotCap), 0, 1);
  const start = { r: 249, g: 196, b: 209 };
  const end = { r: 239, g: 68, b: 68 };
  const r = Math.round(start.r + (end.r - start.r) * ratio);
  const g = Math.round(start.g + (end.g - start.g) * ratio);
  const b = Math.round(start.b + (end.b - start.b) * ratio);
  return `rgb(${r} ${g} ${b})`;
}

export function getWardenVolleyCaps(run: WardenVolleyRunSnapshot, baseShotCount: number): WardenVolleyCaps {
  const availableOrange = Math.max(0, Math.floor(run.essenceByColor.yellow));
  const availableGreen = Math.max(0, Math.floor(run.essenceByColor.green));
  const maxShotCapacity = Math.max(baseShotCount, Math.min(WARDEN_MAX_SHOT_CAPACITY, Math.floor(run.ballCount)));
  const maxPowerCapacity = Math.max(1, Math.min(WARDEN_MAX_POWER_CAPACITY, Math.floor(run.damage * 2) + 4));
  const shotCap = Math.min(maxShotCapacity, baseShotCount + availableOrange);
  const powerCap = Math.min(maxPowerCapacity, Math.max(1, 1 + availableGreen));
  return {
    availableOrange,
    availableGreen,
    maxShotCapacity,
    maxPowerCapacity,
    shotCap,
    powerCap,
  };
}

export function normalizeWardenVolleySelection(
  selectedShotCount: number,
  selectedPower: number,
  caps: WardenVolleyCaps,
  baseShotCount: number
): WardenVolleySelection {
  return {
    shotCount: Math.floor(clampNumber(selectedShotCount, baseShotCount, caps.shotCap)),
    power: Math.floor(clampNumber(selectedPower, 1, Math.min(WARDEN_MAX_POWER_CAPACITY, caps.powerCap))),
  };
}

export function getWardenVolleyDamageProfile(power: number): { damagePerHit: number; tearDamage: number } {
  return {
    damagePerHit: Math.max(2, Math.round(power * 3)),
    tearDamage: Math.max(6, Math.round(power * 1.25)),
  };
}

export function resolveWardenShieldTearHit(
  previousShieldHp: number,
  activeGraceUntilMs: number | null,
  now: number,
  graceMs: number
): WardenShieldTearHitResolution {
  const nextShieldHp = Math.max(0, previousShieldHp - 1);
  if (nextShieldHp <= 0) {
    if (activeGraceUntilMs === null) {
      return {
        nextShieldHp,
        nextGraceUntilMs: now + graceMs,
        startedGraceWindow: true,
        hubMessage: 'Shield broken! Fire now or perish.',
      };
    }
    return {
      nextShieldHp,
      nextGraceUntilMs: activeGraceUntilMs,
      startedGraceWindow: false,
      hubMessage: null,
    };
  }
  return {
    nextShieldHp,
    nextGraceUntilMs: null,
    startedGraceWindow: false,
    hubMessage: `Shield hit! ${nextShieldHp} pip${nextShieldHp === 1 ? '' : 's'} remaining.`,
  };
}
