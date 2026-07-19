import { CORE_VARIANTS, type CoreVariant } from './rogueBrickPathing';

export type BoardObjectiveDifficulty = 'easy' | 'medium' | 'hard';

export interface BoardObjectiveHpSnapshot {
  level: number;
  maxLevels: number;
  objectiveHpMultiplier: number;
  difficulty: BoardObjectiveDifficulty;
  variant: CoreVariant;
}

const OBJECTIVE_HP_BY_VARIANT: Record<CoreVariant, number> = {
  yellow: 1,
  blue: 0.94,
  green: 1.08,
};

const OBJECTIVE_HP_BY_DIFFICULTY: Record<BoardObjectiveDifficulty, number> = {
  easy: 0.96,
  medium: 1.02,
  hard: 1.1,
};

export interface BoardObjectiveVariantRunSnapshot {
  seed: number;
  boardsCleared: number;
  maxLevels: number;
}

export interface BoardProgressRunSnapshot {
  level: number;
  maxLevels: number;
  levelGoalBricks: number;
  levelBricksDestroyed: number;
}

export interface BoardScoreRunSnapshot extends BoardProgressRunSnapshot {
  mana: number;
  boardsCleared: number;
  wardensDefeated: string[];
  ballCount: number;
  damage: number;
}

export interface LiveHudSnapshot {
  destroyedBricks: number;
  manaEarned: number;
}

export interface SpoilsTemplateLike {
  id: string;
  name: string;
  description: string;
}

function hashStringToUint32(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBoardOrbCountForLevel(level: number, maxLevels: number): number {
  const progress = Math.max(0, Math.min(1, (Math.max(1, level) - 1) / Math.max(1, maxLevels - 1)));
  if (progress < 1 / 3) {
    return 1;
  }
  if (progress < 2 / 3) {
    return 2;
  }
  return 3;
}

export function getBoardObjectiveVariants(
  run: BoardObjectiveVariantRunSnapshot,
  level: number,
  nodePrimaryCoreVariant: CoreVariant
): CoreVariant[] {
  const orbCount = getBoardOrbCountForLevel(level, run.maxLevels);
  if (orbCount <= 1) {
    return [nodePrimaryCoreVariant];
  }
  if (orbCount === 2) {
    return [nodePrimaryCoreVariant, nodePrimaryCoreVariant];
  }
  const trailingIndex = hashStringToUint32(`${run.seed}|${level}|${run.boardsCleared}|minor-orb`) % CORE_VARIANTS.length;
  const trailingVariant = CORE_VARIANTS[trailingIndex] ?? nodePrimaryCoreVariant;
  return [nodePrimaryCoreVariant, nodePrimaryCoreVariant, trailingVariant];
}

export function getBoardObjectiveHp(snapshot: BoardObjectiveHpSnapshot): number {
  const progress = Math.max(0, Math.min(1, (Math.max(1, snapshot.level) - 1) / Math.max(1, snapshot.maxLevels - 1)));
  const levelBaseHp = 31 + Math.max(1, snapshot.level) * 0.55 + Math.pow(progress, 1.1) * 10;
  const difficultyMultiplier = OBJECTIVE_HP_BY_DIFFICULTY[snapshot.difficulty] ?? OBJECTIVE_HP_BY_DIFFICULTY.medium;
  const variantMultiplier = OBJECTIVE_HP_BY_VARIANT[snapshot.variant] ?? OBJECTIVE_HP_BY_VARIANT.yellow;
  return Math.max(
    18,
    Math.round(levelBaseHp * snapshot.objectiveHpMultiplier * difficultyMultiplier * variantMultiplier)
  );
}

export function selectCuratedBoardIndex(
  level: number,
  maxLevels: number,
  boardsCleared: number,
  boardPoolShift: number,
  catalogLength: number,
  randomOffset: number
): number {
  const progress = (Math.max(1, level) - 1) / Math.max(1, maxLevels - 1);
  let poolStart = 0;
  let poolSize = 40;
  if (progress > 0.72) {
    poolStart = 80;
    poolSize = 20;
  } else if (progress > 0.35) {
    poolStart = 40;
    poolSize = 40;
  }
  return (
    poolStart +
    boardPoolShift +
    ((boardsCleared + level + randomOffset) % poolSize)
  ) % catalogLength;
}

export function calculateLevelGoal(initialBrickCount: number): number {
  return Math.max(1, initialBrickCount);
}

export function getManaYieldScale(boardsCleared: number, decayPerBoard: number, minScale: number): number {
  return clampNumber(1 - boardsCleared * decayPerBoard, minScale, 1);
}

export function makeSpoilsOffers<T extends SpoilsTemplateLike>(
  offerCount: number,
  pool: T[],
  randomIndex: (maxIndex: number) => number
): Array<{ id: string; name: string; description: string; purchased: boolean }> {
  const offers: Array<{ id: string; name: string; description: string; purchased: boolean }> = [];
  const picked = new Set<string>();

  while (offers.length < offerCount && picked.size < pool.length) {
    const template = pool[randomIndex(pool.length - 1)];
    if (!template || picked.has(template.id)) {
      continue;
    }
    picked.add(template.id);
    offers.push({
      id: template.id,
      name: template.name,
      description: template.description,
      purchased: false,
    });
  }

  return offers;
}

export function toMetaEarned(run: BoardScoreRunSnapshot, victory: boolean): number {
  const base =
    run.boardsCleared * 8 +
    run.level * 3 +
    Math.floor(run.mana * 0.45) +
    (run.wardensDefeated.length ?? 0) * 18;
  return victory ? base + 35 : base;
}

export function calculateOverallScore(run: BoardScoreRunSnapshot | null, liveHud: LiveHudSnapshot): number {
  if (!run) {
    return 0;
  }
  const destroyedBricks = (run.levelBricksDestroyed ?? 0) + liveHud.destroyedBricks;
  const mana = Math.floor(run.mana + liveHud.manaEarned);
  return (
    run.boardsCleared * 1200 +
    Math.max(0, run.level - 1) * 650 +
    destroyedBricks * 40 +
    mana * 4 +
    (run.wardensDefeated.length ?? 0) * 1500 +
    run.ballCount * 18 +
    run.damage * 90
  );
}

export function calculateOverallProgress(run: BoardProgressRunSnapshot | null, liveHud: LiveHudSnapshot): number {
  if (!run) {
    return 0;
  }
  const destroyedBricks = (run.levelBricksDestroyed ?? 0) + liveHud.destroyedBricks;
  const boardProgress = Math.min(1, destroyedBricks / Math.max(1, run.levelGoalBricks ?? 1));
  return Math.min(
    100,
    Math.round((((Math.max(1, run.level) - 1) + boardProgress) / Math.max(1, run.maxLevels)) * 100)
  );
}
