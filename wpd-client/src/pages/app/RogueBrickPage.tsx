import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { rogueBrickApi } from '../../api/rogueBrickApi';
import { useWpdAuth } from '../../features/auth/AuthContext';
import './RogueBrickPage.css';

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 720;
const BRICK_COLUMNS = 7;
const BRICK_GAP = 3;
const BRICK_HEIGHT = 44;
const BRICK_SIZE_SCALE = 0.7;
const STANDARD_BRICK_MIN_SCALE = 0.58;
const BRICK_ROW_STEP = BRICK_HEIGHT + BRICK_GAP;
const BRICK_TOP = 70;
const LAUNCHER_Y = CANVAS_HEIGHT - 42;
const BALL_RADIUS = 6.5;
const BALL_SPEED = 630;
const MAX_ACTIVE_BALLS = 280;
const MIN_LAUNCH_UPWARD_COMPONENT = -0.08;
const LOSE_Y = LAUNCHER_Y - 14;
const LOCAL_STORAGE_PREFIX = 'wpd:rogue-brick:';
const HOMING_BULLET_TIME_SCALE = 0.34;
const POWER_POPOVER_WIDTH_PX = 272;
const CORE_MIN_SCALE = 0.42;
const BLUE_CORE_MIN_SCALE = 0.92;
const BLUE_CORE_FORCE_FIELD_SIZE_MULTIPLIER = 1.5;
const BOARD_ROW_ADVANCE_ANIMATION_MS = 360;
const BOARD_ROW_ADVANCE_STEP_ROWS = 0.62;
const CORE_BREACH_FLASH_MS = 1400;
const CORE_VARIANTS = ['yellow', 'blue', 'green'] as const;
const UNBREAKABLE_INTRO_BOARD = 16;
const UNBREAKABLE_HALF_BOARD = 48;
const UNBREAKABLE_MAX_SHARE = 0.5;
const PATH_PREVIEW_VISIBLE_LEVELS = 5;
const PATH_MAX_LANE_ABS = 8;
const STORE_INTERACTION_MESSAGE_PREFIXES = ['Purchased ', 'Gamble resolved.', 'Left the store.', 'Board cleared.'] as const;
const RUN_POWERUP_MESSAGE_SUFFIX = ' acquired.';

const BALANCE_TARGETS = {
  runDurationMinutes: 20,
  storeEveryBoards: [4, 5] as const,
  powerChoiceEveryBoards: 4,
  expectedStorePurchasesPerStop: 1,
  expectedStoreOffersPerStop: 3,
};

const BALANCE = {
  maxLevels: 60,
  launchStaggerMs: 96,
  storeIntervalMinBoards: BALANCE_TARGETS.storeEveryBoards[0],
  storeIntervalMaxBoards: BALANCE_TARGETS.storeEveryBoards[1],
  powerChoiceEveryBoards: BALANCE_TARGETS.powerChoiceEveryBoards,
  storeOfferCount: BALANCE_TARGETS.expectedStoreOffersPerStop,
  objectiveHpBase: 10,
  objectiveHpPerLevel: 3.8,
  objectiveHpLevelScale: 2.4,
  powerOfferMinManaCost: 16,
  powerOfferLevelStepBoards: 3,
  powerOfferLevelScalePerStep: 0.2,
  storeOfferMinCoinCost: 20,
  storeOfferLevelStepBoards: 4,
  storeOfferLevelScalePerStep: 0.24,
  gambleBaseCost: 24,
  gambleCostPerLevel: 2.5,
  gambleSuccessChance: 0.45,
  gambleBackfireThreshold: 0.8,
  gambleBackfireMinBalls: 6,
  gambleBackfireManaLoss: 8,
  objectiveCoinRewardFlat: 18,
  objectiveCoinRewardHpScale: 0.35,
  brickCoinRewardFlat: 0.8,
  brickCoinRewardHpScale: 0.08,
  objectiveManaRewardCrit: 1.2,
  objectiveManaRewardNormal: 0.8,
  brickManaRewardCrit: 0.55,
  brickManaRewardNormal: 0.35,
} as const;

type RunStage = 'board' | 'hub' | 'powerup' | 'store';
type PathChallengeKey = 'balanced' | 'swarm' | 'fortified' | 'gauntlet';
type PathStoreType = 'mana' | 'money' | null;
type BrickKind =
  | 'standard'
  | 'reinforced'
  | 'prism'
  | 'objective'
  | 'unbreakable'
  | 'oneway'
  | 'exploding'
  | 'splinter';
type CoreVariant = (typeof CORE_VARIANTS)[number];
type OneWaySide = 'top' | 'bottom' | 'left' | 'right';

interface Brick {
  id: string;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  kind?: BrickKind;
  coreVariant?: CoreVariant;
  weakSide?: OneWaySide;
}

interface BoardState {
  turn: number;
  objectiveBrickId: string | null;
  objectiveBrickIds: string[];
  bricks: Brick[];
}

interface PowerOffer {
  id: string;
  name: string;
  description: string;
  manaCost: number;
}

interface StoreOffer {
  id: string;
  name: string;
  description: string;
  coinCost: number;
  purchased: boolean;
}

interface RunSummary {
  victory: boolean;
  boardsCleared: number;
  levelReached: number;
  metaEarned: number;
  completedAt: number;
}

interface BoardSummary {
  shotsTaken: number;
  bounceCount: number;
  achievements: string[];
}

type ResourceHelpKey = 'mana' | 'coins';
type GambleOutcomeTone = 'success' | 'failure' | 'backfire';

interface GambleOutcome {
  tone: GambleOutcomeTone;
  title: string;
  message: string;
}

interface RogueRunState {
  seed: number;
  rngState: number;
  stage: RunStage;
  level: number;
  maxLevels: number;
  boardsCleared: number;
  nextStoreBoard: number;
  mana: number;
  coins: number;
  ballCount: number;
  damage: number;
  critChance: number;
  manaMultiplier: number;
  coinMultiplier: number;
  powers: Record<string, number>;
  levelGoalBricks: number;
  levelBricksDestroyed: number;
  coreCharge: number;
  homingBarrageReady: boolean;
  board: BoardState;
  pendingPowerOffers: PowerOffer[];
  pendingStoreOffers: StoreOffer[];
  hubMessage: string;
  boardShotsTaken: number;
  boardBounceCount: number;
  lastBoardSummary: BoardSummary | null;
  boardSummaryAcknowledged: boolean;
  pathCurrentNodeId: string;
  pathNodesByLevel: Record<number, PathNodeState>;
}

interface PathNodeState {
  id: string;
  parentId: string | null;
  level: number;
  lane: number;
  challenge: PathChallengeKey;
  storeType: PathStoreType;
}

interface PathChallengeDefinition {
  key: PathChallengeKey;
  label: string;
  description: string;
  boardPoolShift: number;
  hpMultiplier: number;
  objectiveHpMultiplier: number;
  objectiveCountBonus: number;
  unbreakableShareMultiplier: number;
}

interface PathPreviewNode extends PathNodeState {
  relation: 'past' | 'current' | 'future';
  isSelected: boolean;
  isPlayable: boolean;
}

interface PathPreviewEdge {
  fromId: string;
  toId: string;
}

interface PathPreview {
  startLevel: number;
  endLevel: number;
  minLane: number;
  maxLane: number;
  nodes: PathPreviewNode[];
  edges: PathPreviewEdge[];
}

type PermanentUpgradeKey = 'startingBalls' | 'startingMana' | 'startingCoins' | 'startingDamage';

interface PermanentUpgradeState {
  rank: number;
  enabled: boolean;
}

interface RogueBrickProfile {
  version: number;
  updatedAt: number;
  metaCurrency: number;
  totalRuns: number;
  bestLevel: number;
  permanentUpgrades: Record<PermanentUpgradeKey, PermanentUpgradeState>;
  run: RogueRunState | null;
  lastRunSummary: RunSummary | null;
}

interface StoredEnvelope {
  profile: RogueBrickProfile;
  pendingSync: boolean;
  serverUpdatedAt: number;
}

interface BallRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  coreCharged: boolean;
}

interface LaunchQueueItem {
  delayMs: number;
}

interface TurnRewards {
  mana: number;
  coins: number;
}

interface LiveHudState {
  destroyedBricks: number;
  manaEarned: number;
  coinsEarned: number;
  remainingBricks: number;
}

interface BrickVisualState {
  hitUntil: number;
}

interface BoardAdvanceAnimationState {
  durationMs: number;
  startsAtTurn: number;
  startedAtMs: number | null;
  startingBrickRows: Record<string, number>;
}

interface BreakParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lifeMs: number;
  ageMs: number;
  color: string;
  kind: 'spark' | 'shard';
  rotation: number;
  rotationVelocity: number;
  glow: number;
}

interface PermanentUpgradeDefinition {
  key: PermanentUpgradeKey;
  name: string;
  description: string;
  baseCost: number;
  costScale: number;
  maxRank: number;
}

const PERMANENT_UPGRADES: PermanentUpgradeDefinition[] = [
  {
    key: 'startingBalls',
    name: 'Orb Reservoir',
    description: '+2 starting balls per rank.',
    baseCost: 45,
    costScale: 1.7,
    maxRank: 3,
  },
  {
    key: 'startingMana',
    name: 'Mana Cache',
    description: '+12 starting mana per rank.',
    baseCost: 35,
    costScale: 1.6,
    maxRank: 3,
  },
  {
    key: 'startingCoins',
    name: 'Traveler Purse',
    description: '+12 starting coins per rank.',
    baseCost: 30,
    costScale: 1.6,
    maxRank: 3,
  },
  {
    key: 'startingDamage',
    name: 'Etched Core',
    description: '+1 starting damage per rank.',
    baseCost: 60,
    costScale: 1.8,
    maxRank: 2,
  },
];

const POWER_BASE_COLORS: Record<string, string> = {
  startingBalls: '#22d3ee',
  startingMana: '#8b5cf6',
  startingCoins: '#f59e0b',
  startingDamage: '#ef4444',
  'arcane-volley': '#38bdf8',
  'rune-edge': '#fb7185',
  'siphon-shell': '#a78bfa',
  'golden-thread': '#fbbf24',
  'fortune-ricochet': '#34d399',
  'shop-ball': '#2dd4bf',
  'shop-damage': '#f97316',
  'shop-crit': '#60a5fa',
  'shop-mana': '#c084fc',
};

const POWER_BACKDROP_ICONS: Record<string, string> = {
  startingBalls: '◍',
  startingMana: '✦',
  startingCoins: '◈',
  startingDamage: '✶',
  'arcane-volley': '✹',
  'rune-edge': '⟡',
  'siphon-shell': '⬢',
  'golden-thread': '⌁',
  'fortune-ricochet': '◎',
  'shop-ball': '◌',
  'shop-damage': '✸',
  'shop-crit': '✷',
  'shop-mana': '✧',
};

interface RuntimePowerTemplate {
  id: string;
  name: string;
  description: string;
  baseManaCost: number;
  apply: (run: RogueRunState) => void;
}

const POWER_POOL: RuntimePowerTemplate[] = [
  {
    id: 'arcane-volley',
    name: 'Arcane Volley',
    description: '+2 balls this run.',
    baseManaCost: 30,
    apply: (run) => {
      run.ballCount += 2;
      run.powers['arcane-volley'] = (run.powers['arcane-volley'] ?? 0) + 1;
    },
  },
  {
    id: 'rune-edge',
    name: 'Rune Edge',
    description: '+1 damage this run.',
    baseManaCost: 34,
    apply: (run) => {
      run.damage += 1;
      run.powers['rune-edge'] = (run.powers['rune-edge'] ?? 0) + 1;
    },
  },
  {
    id: 'siphon-shell',
    name: 'Siphon Shell',
    description: '+20% mana gained this run.',
    baseManaCost: 36,
    apply: (run) => {
      run.manaMultiplier += 0.2;
      run.powers['siphon-shell'] = (run.powers['siphon-shell'] ?? 0) + 1;
    },
  },
  {
    id: 'golden-thread',
    name: 'Golden Thread',
    description: '+20% coin gains this run.',
    baseManaCost: 32,
    apply: (run) => {
      run.coinMultiplier += 0.2;
      run.powers['golden-thread'] = (run.powers['golden-thread'] ?? 0) + 1;
    },
  },
  {
    id: 'fortune-ricochet',
    name: 'Fortune Ricochet',
    description: '+7% critical chance this run.',
    baseManaCost: 38,
    apply: (run) => {
      run.critChance += 0.07;
      run.powers['fortune-ricochet'] = (run.powers['fortune-ricochet'] ?? 0) + 1;
    },
  },
];

interface StoreTemplate {
  id: string;
  name: string;
  description: string;
  baseCoinCost: number;
  apply: (run: RogueRunState) => void;
}

const STORE_POOL: StoreTemplate[] = [
  {
    id: 'shop-ball',
    name: 'Orb Crate',
    description: '+1 ball',
    baseCoinCost: 42,
    apply: (run) => {
      run.ballCount += 1;
      run.powers['shop-ball'] = (run.powers['shop-ball'] ?? 0) + 1;
    },
  },
  {
    id: 'shop-damage',
    name: 'Sharpening Glyph',
    description: '+1 damage',
    baseCoinCost: 50,
    apply: (run) => {
      run.damage += 1;
      run.powers['shop-damage'] = (run.powers['shop-damage'] ?? 0) + 1;
    },
  },
  {
    id: 'shop-crit',
    name: 'Lucky Sigil',
    description: '+5% crit chance',
    baseCoinCost: 44,
    apply: (run) => {
      run.critChance += 0.05;
      run.powers['shop-crit'] = (run.powers['shop-crit'] ?? 0) + 1;
    },
  },
  {
    id: 'shop-mana',
    name: 'Mana Flask',
    description: '+18 mana now',
    baseCoinCost: 30,
    apply: (run) => {
      run.mana += 18;
      run.powers['shop-mana'] = (run.powers['shop-mana'] ?? 0) + 1;
    },
  },
];

const PATH_CHALLENGES: PathChallengeDefinition[] = [
  {
    key: 'balanced',
    label: 'Balanced Route',
    description: 'Stable climb with mixed threats.',
    boardPoolShift: 0,
    hpMultiplier: 1,
    objectiveHpMultiplier: 1,
    objectiveCountBonus: 0,
    unbreakableShareMultiplier: 1,
  },
  {
    key: 'swarm',
    label: 'Swarm Route',
    description: 'More cores and denser objective pressure.',
    boardPoolShift: 8,
    hpMultiplier: 0.95,
    objectiveHpMultiplier: 1,
    objectiveCountBonus: 1,
    unbreakableShareMultiplier: 1.08,
  },
  {
    key: 'fortified',
    label: 'Fortified Route',
    description: 'Heavier HP scaling and durable core targets.',
    boardPoolShift: 12,
    hpMultiplier: 1.22,
    objectiveHpMultiplier: 1.35,
    objectiveCountBonus: 0,
    unbreakableShareMultiplier: 1.25,
  },
  {
    key: 'gauntlet',
    label: 'Gauntlet Route',
    description: 'Late-tier board patterns with oppressive armor.',
    boardPoolShift: 20,
    hpMultiplier: 1.12,
    objectiveHpMultiplier: 1.22,
    objectiveCountBonus: 1,
    unbreakableShareMultiplier: 1.38,
  },
];

const PATH_CHALLENGE_BY_KEY: Record<PathChallengeKey, PathChallengeDefinition> = {
  balanced: PATH_CHALLENGES[0],
  swarm: PATH_CHALLENGES[1],
  fortified: PATH_CHALLENGES[2],
  gauntlet: PATH_CHALLENGES[3],
};

interface ActivePowerIndicator {
  id: string;
  name: string;
  description: string;
  category: 'permanent' | 'run';
  currentLevel: number;
  barSlots: number;
  baseColor: string;
  backdropIcon: string;
  statusLabel: string;
  levelLabel: string;
  maxLevelLabel: string;
}

function defaultProfile(): RogueBrickProfile {
  return {
    version: 1,
    updatedAt: Date.now(),
    metaCurrency: 0,
    totalRuns: 0,
    bestLevel: 0,
    permanentUpgrades: {
      startingBalls: { rank: 0, enabled: false },
      startingMana: { rank: 0, enabled: false },
      startingCoins: { rank: 0, enabled: false },
      startingDamage: { rank: 0, enabled: false },
    },
    run: null,
    lastRunSummary: null,
  };
}

function normalizeProfile(profile: RogueBrickProfile): RogueBrickProfile {
  const normalized = cloneProfile(profile);
  const defaults = defaultProfile();
  normalized.permanentUpgrades = {
    ...defaults.permanentUpgrades,
    ...normalized.permanentUpgrades,
  };
  for (const upgrade of PERMANENT_UPGRADES) {
    const state = normalized.permanentUpgrades[upgrade.key];
    if (!state || typeof state !== 'object') {
      normalized.permanentUpgrades[upgrade.key] = { ...defaults.permanentUpgrades[upgrade.key] };
      continue;
    }
    if (typeof state.rank !== 'number' || Number.isNaN(state.rank)) {
      state.rank = 0;
    }
    if (typeof state.enabled !== 'boolean') {
      state.enabled = false;
    }
  }

  if (normalized.run) {
    normalized.run.powers =
      normalized.run.powers && typeof normalized.run.powers === 'object'
        ? normalized.run.powers
        : {};
    normalized.run.pendingPowerOffers = Array.isArray(normalized.run.pendingPowerOffers)
      ? normalized.run.pendingPowerOffers
      : [];
    normalized.run.pendingStoreOffers = Array.isArray(normalized.run.pendingStoreOffers)
      ? normalized.run.pendingStoreOffers
      : [];
    if (!normalized.run.board || !Array.isArray(normalized.run.board.bricks)) {
      normalized.run.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
    }
    if (typeof normalized.run.board.turn !== 'number' || Number.isNaN(normalized.run.board.turn)) {
      normalized.run.board.turn = 1;
    }
    if (!Array.isArray((normalized.run.board as BoardState).objectiveBrickIds)) {
      (normalized.run.board as BoardState).objectiveBrickIds = [];
    }
    if (typeof normalized.run.board.objectiveBrickId !== 'string') {
      normalized.run.board.objectiveBrickId = null;
    }
    normalized.run.board.bricks = normalized.run.board.bricks.map((brick) => ({
      ...brick,
      kind: brick.kind ?? 'standard',
      coreVariant: brick.kind === 'objective' ? (brick.coreVariant ?? 'yellow') : brick.coreVariant,
    }));
    const objectiveBrickIds = (normalized.run.board as BoardState).objectiveBrickIds
      .filter((id): id is string => typeof id === 'string')
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .filter((id) => normalized.run?.board.bricks.some((brick) => brick.id === id));
    const fallbackObjectiveIds = normalized.run.board.objectiveBrickId
      ? [normalized.run.board.objectiveBrickId]
      : normalized.run.board.bricks.filter((brick) => brick.kind === 'objective').map((brick) => brick.id);
    (normalized.run.board as BoardState).objectiveBrickIds =
      objectiveBrickIds.length > 0 ? objectiveBrickIds : fallbackObjectiveIds;
    normalized.run.board.objectiveBrickId =
      (normalized.run.board as BoardState).objectiveBrickIds[0] ?? null;
    if (typeof normalized.run.homingBarrageReady !== 'boolean') {
      normalized.run.homingBarrageReady = false;
    }
    if (typeof normalized.run.coreCharge !== 'number' || Number.isNaN(normalized.run.coreCharge)) {
      const objectiveBrick = normalized.run.board.bricks.find(
        (brick) => brick.id === normalized.run?.board.objectiveBrickId
      );
      normalized.run.coreCharge = objectiveBrick
        ? Math.max(0, Math.min(1, 1 - objectiveBrick.hp / Math.max(1, objectiveBrick.maxHp)))
        : 0;
    }
    if (typeof normalized.run.boardShotsTaken !== 'number' || Number.isNaN(normalized.run.boardShotsTaken)) {
      normalized.run.boardShotsTaken = 0;
    }
    if (typeof normalized.run.boardBounceCount !== 'number' || Number.isNaN(normalized.run.boardBounceCount)) {
      normalized.run.boardBounceCount = 0;
    }
    if (!normalized.run.lastBoardSummary || typeof normalized.run.lastBoardSummary !== 'object') {
      normalized.run.lastBoardSummary = null;
    } else {
      if (typeof normalized.run.lastBoardSummary.shotsTaken !== 'number') {
        normalized.run.lastBoardSummary.shotsTaken = 0;
      }
      if (typeof normalized.run.lastBoardSummary.bounceCount !== 'number') {
        normalized.run.lastBoardSummary.bounceCount = 0;
      }
      if (!Array.isArray(normalized.run.lastBoardSummary.achievements)) {
        normalized.run.lastBoardSummary.achievements = [];
      }
    }
    if (typeof normalized.run.boardSummaryAcknowledged !== 'boolean') {
      normalized.run.boardSummaryAcknowledged = normalized.run.lastBoardSummary ? false : true;
    }
    if (
      normalized.run.stage === 'hub' &&
      normalized.run.pendingStoreOffers.length > 0 &&
      normalized.run.pendingPowerOffers.length === 0
    ) {
      normalized.run.stage = 'store';
    }
    ensureRunPathState(normalized.run);
  }
  return normalized;
}

function cloneProfile(profile: RogueBrickProfile): RogueBrickProfile {
  return JSON.parse(JSON.stringify(profile)) as RogueBrickProfile;
}

function nextRandom(run: RogueRunState): number {
  run.rngState = (Math.imul(run.rngState, 1664525) + 1013904223) >>> 0;
  return run.rngState / 4294967296;
}

function randomInt(run: RogueRunState, min: number, max: number): number {
  return min + Math.floor(nextRandom(run) * (max - min + 1));
}

function hashStringToUint32(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function clampPathLane(lane: number): number {
  return Math.max(-PATH_MAX_LANE_ABS, Math.min(PATH_MAX_LANE_ABS, lane));
}

function toPathChallengeKey(value: unknown): PathChallengeKey {
  if (typeof value === 'string' && value in PATH_CHALLENGE_BY_KEY) {
    return value as PathChallengeKey;
  }
  return 'balanced';
}

function getPathChallengeDefinition(challenge: PathChallengeKey): PathChallengeDefinition {
  return PATH_CHALLENGE_BY_KEY[challenge] ?? PATH_CHALLENGE_BY_KEY.balanced;
}

function toPathStoreType(value: unknown): PathStoreType {
  if (value === 'mana' || value === 'money') {
    return value;
  }
  return null;
}

function getPathStoreTypeLabel(storeType: PathStoreType): string | null {
  if (storeType === 'mana') {
    return 'Mana Store';
  }
  if (storeType === 'money') {
    return 'Money Store';
  }
  return null;
}

function makePathNodeId(
  seed: number,
  level: number,
  lane: number,
  parentId: string | null,
  challenge: PathChallengeKey,
  storeType: PathStoreType
): string {
  const token = hashStringToUint32(`${seed}|${level}|${lane}|${parentId ?? 'root'}|${challenge}|${storeType ?? 'none'}`)
    .toString(16)
    .padStart(8, '0');
  return `path-${level}-${lane}-${challenge}-${token.slice(0, 8)}`;
}

function createRootPathNode(seed: number): PathNodeState {
  return {
    id: makePathNodeId(seed, 0, 0, null, 'balanced', null),
    parentId: null,
    level: 0,
    lane: 0,
    challenge: 'balanced',
    storeType: null,
  };
}

function ensureRunPathState(run: RogueRunState): void {
  if (!run.pathNodesByLevel || typeof run.pathNodesByLevel !== 'object') {
    run.pathNodesByLevel = {};
  }

  const sanitizedByLevel: Record<number, PathNodeState> = {};
  for (const [levelKey, rawNode] of Object.entries(run.pathNodesByLevel as Record<string, unknown>)) {
    const level = Number(levelKey);
    if (!Number.isFinite(level) || level < 0 || !rawNode || typeof rawNode !== 'object') {
      continue;
    }
    const node = rawNode as Partial<PathNodeState>;
    const nodeLevel = Math.max(0, Math.floor(typeof node.level === 'number' ? node.level : level));
    const lane = clampPathLane(Math.round(typeof node.lane === 'number' ? node.lane : 0));
    const challenge = toPathChallengeKey(node.challenge);
    const storeType = toPathStoreType(node.storeType);
    const parentId = typeof node.parentId === 'string' ? node.parentId : null;
    const id =
      typeof node.id === 'string' && node.id.length > 0
        ? node.id
        : makePathNodeId(run.seed, nodeLevel, lane, parentId, challenge, storeType);
    sanitizedByLevel[nodeLevel] = {
      id,
      parentId,
      level: nodeLevel,
      lane,
      challenge,
      storeType,
    };
  }
  run.pathNodesByLevel = sanitizedByLevel;

  if (!run.pathNodesByLevel[0]) {
    run.pathNodesByLevel[0] = createRootPathNode(run.seed);
  }

  const inferredCurrentLevel = run.stage === 'board' ? Math.max(1, run.level) : Math.max(0, run.level - 1);
  for (let level = 1; level <= inferredCurrentLevel; level += 1) {
    if (run.pathNodesByLevel[level]) {
      continue;
    }
    const parentNode = run.pathNodesByLevel[level - 1] ?? run.pathNodesByLevel[0];
    run.pathNodesByLevel[level] = {
      id: makePathNodeId(run.seed, level, parentNode.lane, parentNode.id, 'balanced', null),
      parentId: parentNode.id,
      level,
      lane: parentNode.lane,
      challenge: 'balanced',
      storeType: null,
    };
  }

  const knownNodes = Object.values(run.pathNodesByLevel);
  const currentNode =
    knownNodes.find((node) => node.id === run.pathCurrentNodeId) ??
    run.pathNodesByLevel[inferredCurrentLevel] ??
    run.pathNodesByLevel[1] ??
    run.pathNodesByLevel[0];
  run.pathCurrentNodeId = currentNode.id;
}

function getCurrentPathNode(run: RogueRunState): PathNodeState {
  const nodeById = Object.values(run.pathNodesByLevel ?? {}).find((item) => item.id === run.pathCurrentNodeId);
  if (nodeById) {
    return nodeById;
  }
  const inferredLevel = run.stage === 'board' ? Math.max(1, run.level) : Math.max(0, run.level - 1);
  return run.pathNodesByLevel?.[inferredLevel] ?? run.pathNodesByLevel?.[1] ?? run.pathNodesByLevel?.[0] ?? createRootPathNode(run.seed);
}

function derivePathChildren(run: RogueRunState, parentNode: PathNodeState): PathNodeState[] {
  const level = parentNode.level + 1;
  if (level > run.maxLevels) {
    return [];
  }

  const branchSeed = hashStringToUint32(`${run.seed}|${parentNode.id}|${level}`);
  const branchCount = 2 + (branchSeed % 2);
  const offsets = branchCount === 2 ? [-1, 1] : [-1, 0, 1];
  const usedLanes = new Set<number>();
  const storeRowRoll = hashStringToUint32(`${branchSeed}|${level}|store-row`) % 100;
  const hasStoreOnRow = level >= 3 && storeRowRoll < 34;
  const rowStoreType: PathStoreType = hasStoreOnRow ? (storeRowRoll % 2 === 0 ? 'mana' : 'money') : null;
  const rowStoreIndex = hasStoreOnRow
    ? hashStringToUint32(`${branchSeed}|${level}|store-index`) % offsets.length
    : -1;
  const children: PathNodeState[] = [];

  for (let index = 0; index < offsets.length; index += 1) {
    let lane = clampPathLane(parentNode.lane + offsets[index]);
    if (usedLanes.has(lane)) {
      lane = clampPathLane(parentNode.lane + offsets[index] + (index % 2 === 0 ? -1 : 1));
    }
    usedLanes.add(lane);

    const challengeIndex =
      (hashStringToUint32(`${branchSeed}|${index}|${lane}`) + level + index) %
      PATH_CHALLENGES.length;
    const challenge = PATH_CHALLENGES[challengeIndex].key;
    const storeType: PathStoreType = index === rowStoreIndex ? rowStoreType : null;

    children.push({
      id: makePathNodeId(run.seed, level, lane, parentNode.id, challenge, storeType),
      parentId: parentNode.id,
      level,
      lane,
      challenge,
      storeType,
    });
  }

  children.sort((left, right) => left.lane - right.lane);
  return children;
}

function buildPathPreview(run: RogueRunState, shouldGateBoardChoices: boolean): PathPreview {
  const anchorNode = getCurrentPathNode(run);
  const startLevel = Math.max(0, anchorNode.level);
  const endLevel = Math.min(run.maxLevels, startLevel + (PATH_PREVIEW_VISIBLE_LEVELS - 1));
  const nodesById = new Map<string, PathPreviewNode>();
  const edges: PathPreviewEdge[] = [];

  const addNode = (node: PathNodeState, relation: PathPreviewNode['relation']) => {
    const selectedNodeAtLevel = run.pathNodesByLevel[node.level];
    const isSelected = selectedNodeAtLevel?.id === node.id;
    const isPlayable =
      run.stage === 'hub' &&
      !shouldGateBoardChoices &&
      node.level === run.level &&
      node.parentId === anchorNode.id;
    const existing = nodesById.get(node.id);
    if (existing) {
      existing.isPlayable = existing.isPlayable || isPlayable;
      if (relation === 'current') {
        existing.relation = 'current';
      } else if (relation === 'past' && existing.relation === 'future') {
        existing.relation = 'past';
      }
      existing.isSelected = existing.isSelected || isSelected;
      return;
    }
    nodesById.set(node.id, {
      ...node,
      relation,
      isSelected,
      isPlayable,
    });
  };

  addNode(anchorNode, 'current');

  let frontier: PathNodeState[] = [anchorNode];
  for (let level = anchorNode.level + 1; level <= endLevel; level += 1) {
    const generated: PathNodeState[] = [];
    for (const parentNode of frontier) {
      const children = derivePathChildren(run, parentNode);
      let previewChildren = children;
      if (level > run.level) {
        previewChildren = children.filter((child) => {
          const visibilityRoll = hashStringToUint32(`${parentNode.id}|${child.id}|preview-edge`) % 100;
          return visibilityRoll < 68;
        });
        if (previewChildren.length === 0 && children.length > 0) {
          const fallbackIndex = hashStringToUint32(`${parentNode.id}|${level}|preview-fallback`) % children.length;
          previewChildren = [children[fallbackIndex]];
        }
      }
      for (const child of previewChildren) {
        generated.push(child);
        addNode(child, 'future');
        edges.push({ fromId: parentNode.id, toId: child.id });
      }
    }

    const selectedNode = run.pathNodesByLevel[level];
    if (selectedNode && selectedNode.parentId) {
      addNode(selectedNode, selectedNode.level < anchorNode.level ? 'past' : 'future');
    }
    if (level < run.level && selectedNode) {
      frontier = [selectedNode];
    } else {
      frontier = generated;
    }
  }

  const nodes = Array.from(nodesById.values())
    .filter((node) => node.level >= startLevel && node.level <= endLevel)
    .sort((left, right) => {
      if (left.level !== right.level) {
        return right.level - left.level;
      }
      return left.lane - right.lane;
    });

  const laneValues = nodes.map((node) => node.lane);
  const minLane = laneValues.length ? Math.min(...laneValues) : -1;
  const maxLane = laneValues.length ? Math.max(...laneValues) : 1;

  return {
    startLevel,
    endLevel,
    minLane,
    maxLane,
    nodes,
    edges,
  };
}

function getBrickWidth(): number {
  return (CANVAS_WIDTH - BRICK_GAP * (BRICK_COLUMNS + 1)) / BRICK_COLUMNS;
}

function getObjectiveSizeScale(brick: Brick): number {
  if (brick.kind !== 'objective') {
    return 1;
  }
  const hpPct = Math.max(0, Math.min(1, brick.hp / Math.max(1, brick.maxHp)));
  if ((brick.coreVariant ?? 'yellow') === 'blue') {
    return BLUE_CORE_MIN_SCALE + hpPct * (1 - BLUE_CORE_MIN_SCALE);
  }
  return CORE_MIN_SCALE + hpPct * (1 - CORE_MIN_SCALE);
}

function getBrickSizeScale(brick: Brick): number {
  if (brick.kind === 'objective') {
    return getObjectiveSizeScale(brick);
  }
  const hpPct = Math.max(0, Math.min(1, brick.hp / Math.max(1, brick.maxHp)));
  return STANDARD_BRICK_MIN_SCALE + hpPct * (1 - STANDARD_BRICK_MIN_SCALE);
}

function getObjectiveDimensions(brick: Brick, brickWidth: number): { width: number; height: number } {
  if (brick.kind !== 'objective') {
    const scale = getBrickSizeScale(brick);
    return {
      width: brickWidth * scale,
      height: BRICK_HEIGHT * scale,
    };
  }
  const scale = BRICK_SIZE_SCALE * getBrickSizeScale(brick);
  const coreVariant = brick.coreVariant ?? 'yellow';
  if (coreVariant === 'blue') {
    const diameter = Math.min(brickWidth, BRICK_HEIGHT) * 1.45 * scale;
    return { width: diameter, height: diameter };
  }
  if (coreVariant === 'green') {
    return {
      width: brickWidth * 3 * scale,
      height: BRICK_HEIGHT * 0.92 * scale,
    };
  }
  return {
    width: brickWidth * scale,
    height: BRICK_HEIGHT * scale,
  };
}

function getCoreVariantLabel(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return 'Blue Core';
    case 'green':
      return 'Green Core';
    default:
      return 'Yellow Core';
  }
}

function getCoreVariantColor(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return '#38bdf8';
    case 'green':
      return '#22c55e';
    default:
      return '#f59e0b';
  }
}

function getCoreVariantFlashGlow(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return 'rgb(56 189 248 / 0.3)';
    case 'green':
      return 'rgb(34 197 94 / 0.3)';
    default:
      return 'rgb(251 191 36 / 0.28)';
  }
}

function getCoreVariantFlashText(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return 'rgb(224 242 254 / 0.96)';
    case 'green':
      return 'rgb(220 252 231 / 0.96)';
    default:
      return 'rgb(254 240 138 / 0.96)';
  }
}

function getCoreVariantFlashShadow(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return 'rgb(14 116 144 / 0.68)';
    case 'green':
      return 'rgb(22 101 52 / 0.68)';
    default:
      return 'rgb(245 158 11 / 0.65)';
  }
}

function getObjectiveCountForLevel(level: number): number {
  if (level < 10) {
    return 1;
  }
  if (level < 45) {
    return 2;
  }
  return 3;
}

function getObjectiveBrickIds(board: BoardState): string[] {
  if (Array.isArray(board.objectiveBrickIds) && board.objectiveBrickIds.length > 0) {
    return board.objectiveBrickIds;
  }
  return board.objectiveBrickId ? [board.objectiveBrickId] : [];
}

function getBrickBounds(
  brick: Brick,
  brickX: number,
  brickY: number,
  brickWidth: number
): { x: number; y: number; width: number; height: number } {
  const { width, height } = getObjectiveDimensions(brick, brickWidth);
  const baseX = brickX + (brickWidth - width) * 0.5;
  const baseY = brickY + (BRICK_HEIGHT - height) * 0.5;
  if (brick.kind === 'objective' && (brick.coreVariant ?? 'yellow') === 'green') {
    return {
      x: clampCoordinate(baseX, 0, CANVAS_WIDTH - width),
      y: baseY,
      width,
      height,
    };
  }
  return {
    x: baseX,
    y: baseY,
    width,
    height,
  };
}

function doBrickBoundsOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

type CuratedCellSymbol = '.' | 's' | 'r' | 'o' | 'p' | 'u' | 'C';

interface CuratedBoardDesign {
  id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rows: string[];
}

const CURATED_BASE_PATTERNS: string[][] = [
  ['..s.s..', '.s...s.', '..r.r..', '...C...', '..r.r..', '.s...s.', '..s.s..'],
  ['...s...', '..s.s..', '.r...r.', '..s.s..', '...C...', '..s.s..', '.s...s.', '..s.s..'],
  ['.s...s.', '..r.r..', '.s...s.', '...C...', '.s...s.', '..r.r..', '.s...s.'],
  ['..o.o..', '.s...s.', '..r.r..', '...C...', '..r.r..', '.s...s.', '..o.o..'],
  ['...r...', '..s.s..', '.s...s.', '..s.s..', '...C...', '.s...s.', '..s.s..', '...r...'],
  ['.r...r.', '..s.s..', '.s...s.', '..r.r..', '...C...', '..r.r..', '.s...s.', '..s.s..'],
  ['..s.s..', '.r...r.', '..s.s..', '...C...', '..s.s..', '.r...r.', '..s.s..'],
  ['...s...', '.s...s.', '..r.r..', '.s...s.', '...C...', '.s...s.', '..r.r..', '.s...s.'],
  ['.s...s.', '..o.o..', '.r...r.', '..s.s..', '...C...', '..s.s..', '.r...r.', '..o.o..'],
  ['..r.r..', '.s...s.', '...s...', '..s.s..', '...C...', '..s.s..', '...s...', '.s...s.', '..r.r..'],
  ['..s.s..', '.s...s.', '..p.p..', '.r...r.', '...C...', '.r...r.', '..p.p..', '.s...s.'],
  ['...s...', '..r.r..', '.s...s.', '..o.o..', '...C...', '..o.o..', '.s...s.', '..r.r..'],
  ['.s...s.', '..s.s..', '.r...r.', '..s.s..', '...C...', '..s.s..', '.r...r.', '..s.s..', '.s...s.'],
  ['..o.o..', '.r...r.', '..s.s..', '.s...s.', '...C...', '.s...s.', '..s.s..', '.r...r.', '..o.o..'],
  ['...r...', '.s...s.', '..s.s..', '.r...r.', '...C...', '.r...r.', '..s.s..', '.s...s.', '...r...'],
  ['.r...r.', '..o.o..', '.s...s.', '..r.r..', '...C...', '..r.r..', '.s...s.', '..o.o..', '.r...r.'],
  ['..s.s..', '.r...r.', '..s.s..', '.s...s.', '...C...', '.s...s.', '..s.s..', '.r...r.', '..s.s..'],
  ['...s...', '.r...r.', '..s.s..', '.o...o.', '...C...', '.o...o.', '..s.s..', '.r...r.', '...s...'],
  ['.s...s.', '..r.r..', '.o...o.', '..s.s..', '...C...', '..s.s..', '.o...o.', '..r.r..', '.s...s.'],
  ['..r.r..', '.s...s.', '..o.o..', '.s...s.', '...C...', '.s...s.', '..o.o..', '.s...s.', '..r.r..'],
];

function applyCuratedVariant(baseRows: string[], variant: number): string[] {
  const midRow = Math.floor(baseRows.length / 2);
  return baseRows.map((row, rowIndex) => row.split('').map((char, colIndex) => {
    const symbol = char as CuratedCellSymbol;
    if (symbol === '.' || symbol === 'C') {
      return symbol;
    }

    const edgeCell = colIndex <= 1 || colIndex >= BRICK_COLUMNS - 2;
    const lowerHalf = rowIndex > midRow;
    if (variant === 0) {
      if (edgeCell && rowIndex <= 1) {
        return '.';
      }
      if (symbol === 'u' || symbol === 'r') {
        return 's';
      }
      return symbol;
    }
    if (variant === 1) {
      if (symbol === 'u') {
        return 'r';
      }
      return symbol;
    }
    if (variant === 2) {
      if (symbol === 'u') {
        return 'r';
      }
      return symbol;
    }
    if (variant === 3) {
      if (lowerHalf && symbol === 's') {
        return 'r';
      }
      return symbol;
    }
    if (symbol === 's' && lowerHalf) {
      return 'r';
    }
    if (symbol === 'r' && lowerHalf) {
      return 'u';
    }
    return symbol;
  }).join(''));
}

function enforceIndirectCorePath(rows: string[]): string[] {
  const coreRow = rows.findIndex((row) => row.includes('C'));
  if (coreRow < 0) {
    return rows;
  }
  const coreCol = rows[coreRow].indexOf('C');
  if (coreCol < 0) {
    return rows;
  }

  const hasBlockerBelowCore = rows
    .slice(coreRow + 1)
    .some((row) => row[coreCol] && row[coreCol] !== '.');
  if (hasBlockerBelowCore) {
    return rows;
  }

  const targetRowIndex = Math.min(rows.length - 1, coreRow + 1);
  const targetRow = rows[targetRowIndex].split('');
  if (targetRow[coreCol] === '.') {
    targetRow[coreCol] = 'r';
  }
  const nextRows = [...rows];
  nextRows[targetRowIndex] = targetRow.join('');
  return nextRows;
}

function shiftCuratedRows(rows: string[], offset: number): string[] {
  if (offset === 0) {
    return rows;
  }

  const shiftedRows: string[] = [];
  for (const row of rows) {
    const nextRow = Array.from({ length: BRICK_COLUMNS }, () => '.');
    for (let col = 0; col < BRICK_COLUMNS; col += 1) {
      const symbol = row[col];
      if (!symbol || symbol === '.') {
        continue;
      }
      const nextCol = col + offset;
      if (nextCol >= 0 && nextCol < BRICK_COLUMNS) {
        nextRow[nextCol] = symbol;
      }
    }
    shiftedRows.push(nextRow.join(''));
  }
  return shiftedRows;
}

function pickCoreLaneOffset(rows: string[], run: RogueRunState): number {
  let minOccupiedCol = BRICK_COLUMNS - 1;
  let maxOccupiedCol = 0;
  let hasOccupied = false;

  for (const row of rows) {
    for (let col = 0; col < BRICK_COLUMNS; col += 1) {
      if (row[col] && row[col] !== '.') {
        hasOccupied = true;
        minOccupiedCol = Math.min(minOccupiedCol, col);
        maxOccupiedCol = Math.max(maxOccupiedCol, col);
      }
    }
  }

  if (!hasOccupied) {
    return 0;
  }

  const minOffset = -minOccupiedCol;
  const maxOffset = BRICK_COLUMNS - 1 - maxOccupiedCol;
  const allowedOffsets: number[] = [];
  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    allowedOffsets.push(offset);
  }
  const nonZeroOffsets = allowedOffsets.filter((offset) => offset !== 0);
  if (nonZeroOffsets.length === 0) {
    return 0;
  }

  const useNonCenterLane = randomInt(run, 0, 99) < 80;
  if (useNonCenterLane) {
    return nonZeroOffsets[randomInt(run, 0, nonZeroOffsets.length - 1)];
  }
  return 0;
}

function buildCuratedBoardCatalog(): CuratedBoardDesign[] {
  const boards: CuratedBoardDesign[] = [];
  for (let variant = 0; variant < 5; variant += 1) {
    const difficulty: CuratedBoardDesign['difficulty'] =
      variant <= 1 ? 'easy' : variant <= 3 ? 'medium' : 'hard';
    for (let patternIndex = 0; patternIndex < CURATED_BASE_PATTERNS.length; patternIndex += 1) {
      const variantRows = applyCuratedVariant(CURATED_BASE_PATTERNS[patternIndex], variant);
      boards.push({
        id: `v${variant + 1}-p${patternIndex + 1}`,
        difficulty,
        rows: enforceIndirectCorePath(variantRows),
      });
    }
  }
  return boards;
}

const CURATED_BOARD_CATALOG = buildCuratedBoardCatalog();

function clampCoordinate(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasBrickCrossedThreshold(brick: Brick): boolean {
  const brickBottomY = BRICK_TOP + brick.row * BRICK_ROW_STEP + BRICK_HEIGHT;
  return brickBottomY >= LOSE_Y;
}

function getTargetUnbreakableShare(boardsCleared: number): number {
  const boardNumber = boardsCleared + 1;
  if (boardNumber < UNBREAKABLE_INTRO_BOARD) {
    return 0;
  }
  if (boardNumber >= UNBREAKABLE_HALF_BOARD) {
    return UNBREAKABLE_MAX_SHARE;
  }

  const progress =
    (boardNumber - UNBREAKABLE_INTRO_BOARD) /
    Math.max(1, UNBREAKABLE_HALF_BOARD - UNBREAKABLE_INTRO_BOARD);
  return Math.max(0.08, UNBREAKABLE_MAX_SHARE * progress);
}

function getImpactSideFromVelocity(ball: BallRuntime, normal?: { x: number; y: number }): OneWaySide {
  if (normal) {
    if (Math.abs(normal.x) > Math.abs(normal.y)) {
      return normal.x < 0 ? 'left' : 'right';
    }
    return normal.y < 0 ? 'top' : 'bottom';
  }
  if (Math.abs(ball.vx) > Math.abs(ball.vy)) {
    return ball.vx > 0 ? 'left' : 'right';
  }
  return ball.vy > 0 ? 'top' : 'bottom';
}

function generateBoard(run: RogueRunState): BoardState {
  ensureRunPathState(run);
  const activePathNode = run.pathNodesByLevel[run.level] ?? getCurrentPathNode(run);
  const challengeDefinition = getPathChallengeDefinition(activePathNode.challenge);
  const progress = (Math.max(1, run.level) - 1) / Math.max(1, run.maxLevels - 1);
  let poolStart = 0;
  let poolSize = 40;
  if (progress > 0.72) {
    poolStart = 80;
    poolSize = 20;
  } else if (progress > 0.35) {
    poolStart = 40;
    poolSize = 40;
  }
  const selectedIndex =
    (poolStart +
      challengeDefinition.boardPoolShift +
      ((run.boardsCleared + run.level + randomInt(run, 0, poolSize - 1)) % poolSize)) %
    CURATED_BOARD_CATALOG.length;
  const design = CURATED_BOARD_CATALOG[selectedIndex];
  const coreLaneOffset = pickCoreLaneOffset(design.rows, run);
  const boardRows = enforceIndirectCorePath(shiftCuratedRows(design.rows, coreLaneOffset));

  let bricks: Brick[] = [];
  const hpBase = Math.max(2, Math.round((2 + Math.floor(run.level * 0.55)) * challengeDefinition.hpMultiplier));
  let objectiveRow = Math.floor(boardRows.length / 2);
  let objectiveCol = Math.floor(BRICK_COLUMNS / 2);
  let objectiveMaxHp = Math.max(
    8,
    Math.round((BALANCE.objectiveHpBase + run.level * 2.4) * challengeDefinition.objectiveHpMultiplier)
  );
  const objectiveCount = getObjectiveCountForLevel(run.level) + challengeDefinition.objectiveCountBonus;
  const targetObjectiveCount = Math.max(1, Math.min(objectiveCount, CORE_VARIANTS.length));
  const remainingVariants = [...CORE_VARIANTS];
  const objectiveVariants: CoreVariant[] = [];
  while (objectiveVariants.length < targetObjectiveCount && remainingVariants.length > 0) {
    const nextVariantIndex = randomInt(run, 0, remainingVariants.length - 1);
    const nextVariant = remainingVariants.splice(nextVariantIndex, 1)[0];
    if (nextVariant) {
      objectiveVariants.push(nextVariant);
    }
  }
  const objectiveCoreVariant = objectiveVariants[0] ?? 'yellow';

  for (let row = 0; row < boardRows.length; row += 1) {
    const rowPattern = boardRows[row];
    for (let col = 0; col < BRICK_COLUMNS; col += 1) {
      const symbol = rowPattern[col] as CuratedCellSymbol;
      if (!symbol || symbol === '.') {
        continue;
      }

      if (symbol === 'C') {
        objectiveRow = row;
        objectiveCol = col;
        const coreHpMultiplier = objectiveCoreVariant === 'green' ? 3.5 : 1;
        objectiveMaxHp = Math.max(
          Math.round((design.difficulty === 'easy' ? 10 : design.difficulty === 'medium' ? 14 : 20) * coreHpMultiplier),
          Math.round(
            (BALANCE.objectiveHpBase + run.level * BALANCE.objectiveHpPerLevel) *
            coreHpMultiplier *
            challengeDefinition.objectiveHpMultiplier
          )
        );
        continue;
      }

      let kind: BrickKind = 'standard';
      if (symbol === 'p') {
        kind = 'prism';
      } else if (symbol === 'r') {
        kind = 'reinforced';
      } else if (symbol === 'u') {
        kind = 'unbreakable';
      }

      const rowBias = Math.max(0, row - objectiveRow) * 0.65;
      const difficultyBias =
        design.difficulty === 'easy' ? -1 : design.difficulty === 'medium' ? 0.5 : 1.5;
      const hp =
        kind === 'unbreakable'
          ? 999
          : Math.max(
              1,
              Math.round(
                hpBase +
                rowBias +
                difficultyBias +
                (kind === 'reinforced' ? 1.8 : kind === 'prism' ? 0.6 : 0) +
                randomInt(run, 0, 2)
              )
            );

      bricks.push({
        id: `${design.id}-${run.level}-${row}-${col}-${Math.round(nextRandom(run) * 1_000_000)}`,
        row,
        col,
        hp,
        maxHp: hp,
        kind,
      });
    }
  }

  const targetUnbreakableShare = Math.min(
    0.8,
    getTargetUnbreakableShare(run.boardsCleared) * challengeDefinition.unbreakableShareMultiplier
  );
  if (targetUnbreakableShare > 0 && bricks.length > 0) {
    const targetUnbreakableCount = Math.max(1, Math.round(bricks.length * targetUnbreakableShare));
    const unbreakableCount = bricks.reduce(
      (count, brick) => count + ((brick.kind ?? 'standard') === 'unbreakable' ? 1 : 0),
      0
    );
    const additionalUnbreakableCount = Math.max(0, targetUnbreakableCount - unbreakableCount);
    if (additionalUnbreakableCount > 0) {
      const candidateIndexes = bricks
        .map((brick, index) => ({ brick, index }))
        .filter(({ brick }) => {
          const kind = brick.kind ?? 'standard';
          return kind === 'standard' || kind === 'reinforced' || kind === 'prism';
        })
        .map(({ index }) => index);
      let converted = 0;
      while (converted < additionalUnbreakableCount && candidateIndexes.length > 0) {
        const nextCandidate = candidateIndexes.splice(randomInt(run, 0, candidateIndexes.length - 1), 1)[0];
        if (typeof nextCandidate !== 'number') {
          break;
        }
        const candidate = bricks[nextCandidate];
        candidate.kind = 'unbreakable';
        candidate.hp = 999;
        candidate.maxHp = 999;
        converted += 1;
      }
    }
  }

  const objectiveId = `${design.id}-objective-${run.level}-${objectiveRow}-${objectiveCol}-${Math.round(nextRandom(run) * 1_000_000)}`;
  bricks.push({
    id: objectiveId,
    row: objectiveRow,
    col: objectiveCol,
    hp: objectiveMaxHp,
    maxHp: objectiveMaxHp,
    kind: 'objective',
    coreVariant: objectiveCoreVariant,
  });

  const objectiveBrickIds = [objectiveId];
  if (targetObjectiveCount > 1 && bricks.length > 1) {
    const candidateIndexes = bricks
      .map((_, index) => index)
      .filter((index) => bricks[index].kind !== 'objective');
    const extraCount = Math.min(targetObjectiveCount - 1, candidateIndexes.length);
    const selectedIndexes: number[] = [];
    while (selectedIndexes.length < extraCount) {
      const nextIndex = candidateIndexes.splice(randomInt(run, 0, candidateIndexes.length - 1), 1)[0];
      if (typeof nextIndex !== 'number') {
        break;
      }
      selectedIndexes.push(nextIndex);
    }

    const buildObjectiveHp = (variant: CoreVariant): number => {
      const coreHpMultiplier = variant === 'green' ? 3.5 : 1;
      return Math.max(
        Math.round((design.difficulty === 'easy' ? 10 : design.difficulty === 'medium' ? 14 : 20) * coreHpMultiplier),
        Math.round(
          (BALANCE.objectiveHpBase + run.level * BALANCE.objectiveHpPerLevel) *
          coreHpMultiplier *
          challengeDefinition.objectiveHpMultiplier
        )
      );
    };

    for (let selectedIndex = 0; selectedIndex < selectedIndexes.length; selectedIndex += 1) {
      const index = selectedIndexes[selectedIndex];
      const objectiveBrick = bricks[index];
      const variant = objectiveVariants[selectedIndex + 1] ?? objectiveCoreVariant;
      const extraObjectiveHp = buildObjectiveHp(variant);
      objectiveBrick.kind = 'objective';
      objectiveBrick.coreVariant = variant;
      objectiveBrick.hp = extraObjectiveHp;
      objectiveBrick.maxHp = extraObjectiveHp;
      objectiveBrickIds.push(objectiveBrick.id);
    }
  }

  const greenObjectives = bricks.filter(
    (brick) => brick.kind === 'objective' && (brick.coreVariant ?? 'yellow') === 'green'
  );
  if (greenObjectives.length > 0) {
    const brickWidth = getBrickWidth();
    const greenObjectiveBounds = greenObjectives.map((objectiveBrick) => {
      const objectiveX = BRICK_GAP + objectiveBrick.col * (brickWidth + BRICK_GAP);
      const objectiveY = BRICK_TOP + objectiveBrick.row * (BRICK_HEIGHT + BRICK_GAP);
      return getBrickBounds(objectiveBrick, objectiveX, objectiveY, brickWidth);
    });
    bricks = bricks.filter((brick) => {
      if (brick.kind === 'objective') {
        return true;
      }
      const brickX = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
      const brickY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
      const bounds = getBrickBounds(brick, brickX, brickY, brickWidth);
      return !greenObjectiveBounds.some((objectiveBounds) => doBrickBoundsOverlap(bounds, objectiveBounds));
    });
  }

  return {
    turn: 1,
    objectiveBrickId: objectiveBrickIds[0] ?? null,
    objectiveBrickIds,
    bricks,
  };
}

function calculateLevelGoal(initialBrickCount: number): number {
  return Math.max(1, initialBrickCount);
}

function easeInOutSine(progress: number): number {
  return -(Math.cos(Math.PI * progress) - 1) / 2;
}

function advanceBoardRows(board: BoardState): void {
  for (const brick of board.bricks) {
    brick.row += BOARD_ROW_ADVANCE_STEP_ROWS;
  }
  board.turn += 1;
}

function makePowerOffers(run: RogueRunState): PowerOffer[] {
  const offers: PowerOffer[] = [];
  const picked = new Set<string>();

  while (offers.length < 3 && picked.size < POWER_POOL.length) {
    const template = POWER_POOL[randomInt(run, 0, POWER_POOL.length - 1)];
    if (picked.has(template.id)) {
      continue;
    }
    picked.add(template.id);
    const levelScale =
      1 + Math.floor(run.level / BALANCE.powerOfferLevelStepBoards) * BALANCE.powerOfferLevelScalePerStep;
    offers.push({
      id: template.id,
      name: template.name,
      description: template.description,
      manaCost: Math.max(BALANCE.powerOfferMinManaCost, Math.round(template.baseManaCost * levelScale)),
    });
  }

  return offers;
}

function buildStartingRunPowerChoices(): string[] {
  const pool = [...POWER_POOL];
  const picked: string[] = [];
  const choiceCount = Math.min(3, pool.length);
  while (picked.length < choiceCount && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    const [template] = pool.splice(index, 1);
    if (template) {
      picked.push(template.id);
    }
  }
  return picked;
}

function makeStoreOffers(run: RogueRunState): StoreOffer[] {
  const offers: StoreOffer[] = [];
  const picked = new Set<string>();

  while (offers.length < BALANCE.storeOfferCount && picked.size < STORE_POOL.length) {
    const template = STORE_POOL[randomInt(run, 0, STORE_POOL.length - 1)];
    if (picked.has(template.id)) {
      continue;
    }
    picked.add(template.id);
    const levelScale =
      1 + Math.floor(run.level / BALANCE.storeOfferLevelStepBoards) * BALANCE.storeOfferLevelScalePerStep;
    offers.push({
      id: template.id,
      name: template.name,
      description: template.description,
      coinCost: Math.max(BALANCE.storeOfferMinCoinCost, Math.round(template.baseCoinCost * levelScale)),
      purchased: false,
    });
  }

  return offers;
}

function completeStoreStop(runState: RogueRunState, message: string): void {
  runState.pendingStoreOffers = [];
  runState.stage = 'hub';
  runState.hubMessage = message;
}

function toMetaEarned(run: RogueRunState, victory: boolean): number {
  const base = run.boardsCleared * 8 + run.level * 3 + Math.floor(run.coins * 0.4) + Math.floor(run.mana * 0.35);
  return victory ? base + 35 : base;
}

function upgradeCost(def: PermanentUpgradeDefinition, rank: number): number {
  return Math.round(def.baseCost * Math.pow(def.costScale, rank));
}

function calculateOverallScore(run: RogueRunState | null, liveHud: LiveHudState): number {
  if (!run) {
    return 0;
  }

  const destroyedBricks = (run.levelBricksDestroyed ?? 0) + liveHud.destroyedBricks;
  const mana = Math.floor(run.mana + liveHud.manaEarned);
  const coins = Math.floor(run.coins + liveHud.coinsEarned);

  return (
    run.boardsCleared * 1200 +
    Math.max(0, run.level - 1) * 650 +
    destroyedBricks * 40 +
    mana * 4 +
    coins * 5 +
    run.ballCount * 18 +
    run.damage * 90
  );
}

function calculateOverallProgress(run: RogueRunState | null, liveHud: LiveHudState): number {
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

function buildBoardAchievements(summary: BoardSummary): string[] {
  const achievements: string[] = [];
  if (summary.shotsTaken === 1) {
    achievements.push('One Shot Wonder');
  }
  if (summary.bounceCount >= 30) {
    achievements.push('Pinball Wizard');
  } else if (summary.bounceCount >= 16) {
    achievements.push('Bank Shot Specialist');
  }
  if (summary.shotsTaken <= 2 && summary.bounceCount >= 10) {
    achievements.push('Core Killer');
  }
  return achievements;
}

function parseProgress(json: string): RogueBrickProfile | null {
  try {
    const parsed = JSON.parse(json) as RogueBrickProfile;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (!parsed.permanentUpgrades || typeof parsed.permanentUpgrades !== 'object') {
      return null;
    }
    const normalized = normalizeProfile(parsed);
    if (normalized.run && (typeof normalized.run.nextStoreBoard !== 'number' || Number.isNaN(normalized.run.nextStoreBoard))) {
      normalized.run.nextStoreBoard = 0;
    }
    return normalized;
  } catch {
    return null;
  }
}

export default function RogueBrickPage() {
  const { wpdUser } = useWpdAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const profileRef = useRef<RogueBrickProfile | null>(null);
  const animationRef = useRef<number | null>(null);
  const ballsRef = useRef<BallRuntime[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const launchQueueRef = useRef<LaunchQueueItem[]>([]);
  const launchDirectionRef = useRef<{ x: number; y: number }>({ x: 0, y: -1 });
  const launchElapsedRef = useRef(0);
  const pendingRewardsRef = useRef<TurnRewards>({ mana: 0, coins: 0 });
  const pendingDestroyedBricksRef = useRef(0);
  const pendingBounceCountRef = useRef(0);
  const coreChargeRef = useRef(0);
  const homingBarrageUsedRef = useRef(false);
  const homingBulletTimeHitsRef = useRef(0);
  const finalBrickCinematicUntilRef = useRef(0);
  const gambleRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brickVisualRef = useRef<Map<string, BrickVisualState>>(new Map());
  const breakParticlesRef = useRef<BreakParticle[]>([]);
  const boardAdvanceAnimationRef = useRef<BoardAdvanceAnimationState | null>(null);
  const coreBreachFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coreBreachLaunchFrameRef = useRef<number | null>(null);
  const breachCleanupQueuedRef = useRef(false);
  const coreBreachHandledThisTurnRef = useRef(false);
  const launchShotRef = useRef<(
    direction: { x: number; y: number },
    options?: { forceHoming?: boolean }
  ) => void>(() => {});
  const frameNowRef = useRef(0);
  const shotInFlightRef = useRef(false);
  const idleAnimationRef = useRef<number | null>(null);
  const powersStripRef = useRef<HTMLElement | null>(null);
  const [profile, setProfile] = useState<RogueBrickProfile | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'pending' | 'synced'>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [aimPoint, setAimPoint] = useState<{ x: number; y: number } | null>(null);
  const [shotInProgress, setShotInProgress] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPowerDrawerExpanded, setIsPowerDrawerExpanded] = useState(false);
  const [previewStartingPowerId, setPreviewStartingPowerId] = useState<string | null>(null);
  const [pendingStartingRunPowerId, setPendingStartingRunPowerId] = useState<string | null>(null);
  const [selectedPowerId, setSelectedPowerId] = useState<string | null>(null);
  const [selectedResourceHelp, setSelectedResourceHelp] = useState<ResourceHelpKey | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showGambleConfirm, setShowGambleConfirm] = useState(false);
  const [isGambleRevealing, setIsGambleRevealing] = useState(false);
  const [gambleOutcome, setGambleOutcome] = useState<GambleOutcome | null>(null);
  const [dismissedDefeatSummaryCompletedAt, setDismissedDefeatSummaryCompletedAt] = useState<number | null>(null);
  const [hiddenHubMessageKey, setHiddenHubMessageKey] = useState<string | null>(null);
  const [autoHomingLaunchPending, setAutoHomingLaunchPending] = useState(false);
  const [isCoreBreachFlashing, setIsCoreBreachFlashing] = useState(false);
  const [coreBreachFlashVariant, setCoreBreachFlashVariant] = useState<CoreVariant>('yellow');
  const [startingRunPowerChoices, setStartingRunPowerChoices] = useState<string[]>([]);
  const [powerPopoverLayout, setPowerPopoverLayout] = useState({ left: 8, arrow: 136 });
  const [liveHud, setLiveHud] = useState<LiveHudState>({
    destroyedBricks: 0,
    manaEarned: 0,
    coinsEarned: 0,
    remainingBricks: 0,
  });

  const run = profile?.run ?? null;
  const storageKey = useMemo(
    () => (wpdUser ? `${LOCAL_STORAGE_PREFIX}${wpdUser.userId}` : ''),
    [wpdUser]
  );

  useEffect(() => {
    if (run) {
      if (startingRunPowerChoices.length > 0) {
        setStartingRunPowerChoices([]);
      }
      setPendingStartingRunPowerId(null);
      return;
    }
    if (startingRunPowerChoices.length === 0) {
      setStartingRunPowerChoices(buildStartingRunPowerChoices());
    }
  }, [run, startingRunPowerChoices]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#0d111d';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const now = performance.now();

    const profileSnapshot = profileRef.current;
    const runSnapshot = profileSnapshot?.run ?? null;
    if (!runSnapshot) {
      return;
    }

    const brickWidth = getBrickWidth();
    const bricksToDraw = shotInFlightRef.current ? bricksRef.current : runSnapshot.board.bricks;
    const objectiveBrickInView = runSnapshot.board.objectiveBrickId
      ? bricksToDraw.find((brick) => brick.id === runSnapshot.board.objectiveBrickId) ?? null
      : null;
    const objectiveCharge = objectiveBrickInView
      ? Math.max(0, Math.min(1, 1 - objectiveBrickInView.hp / Math.max(1, objectiveBrickInView.maxHp)))
      : runSnapshot.coreCharge ?? 1;
    const boardAdvanceAnimation = boardAdvanceAnimationRef.current;
    let boardAdvanceProgress = 1;
    if (boardAdvanceAnimation && runSnapshot.board.turn >= boardAdvanceAnimation.startsAtTurn) {
      if (boardAdvanceAnimation.startedAtMs === null) {
        boardAdvanceAnimation.startedAtMs = now;
      }
      const elapsedMs = Math.max(0, now - boardAdvanceAnimation.startedAtMs);
      const progress = Math.min(1, elapsedMs / Math.max(1, boardAdvanceAnimation.durationMs));
      boardAdvanceProgress = easeInOutSine(progress);
      if (progress >= 1) {
        boardAdvanceAnimationRef.current = null;
      }
    }

    for (const brick of bricksToDraw) {
      const visual = brickVisualRef.current.get(brick.id);
      const hitIntensity = visual ? Math.max(0, (visual.hitUntil - now) / 120) : 0;
      if (visual && hitIntensity <= 0) {
        brickVisualRef.current.delete(brick.id);
      }

      const x = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
      const startingRow = boardAdvanceAnimation?.startingBrickRows[brick.id];
      const renderRow =
        typeof startingRow === 'number'
          ? startingRow + (brick.row - startingRow) * boardAdvanceProgress
          : brick.row;
      const y = BRICK_TOP + renderRow * BRICK_ROW_STEP;
      const kind = brick.kind ?? 'standard';
      const hpPct = Math.max(0, Math.min(1, brick.hp / Math.max(1, brick.maxHp)));
      const brickSizeScale = getBrickSizeScale(brick);
      const styleByKind = (() => {
        if (kind === 'objective') {
          return {
            top: { r: 86, g: 52, b: 16 },
            bottom: { r: 38, g: 22, b: 6 },
            edge: 'rgba(255, 210, 120, 0.5)',
          };
        }
        if (kind === 'unbreakable') {
          return {
            top: { r: 58, g: 72, b: 96 },
            bottom: { r: 28, g: 37, b: 56 },
            edge: 'rgba(210, 224, 240, 0.5)',
          };
        }
        if (kind === 'oneway') {
          return {
            top: { r: 42, g: 62, b: 88 },
            bottom: { r: 20, g: 34, b: 52 },
            edge: 'rgba(124, 212, 255, 0.46)',
          };
        }
        if (kind === 'exploding') {
          return {
            top: { r: 88, g: 40, b: 34 },
            bottom: { r: 44, g: 20, b: 18 },
            edge: 'rgba(255, 163, 137, 0.46)',
          };
        }
        if (kind === 'prism') {
          return {
            top: { r: 58, g: 46, b: 96 },
            bottom: { r: 30, g: 24, b: 58 },
            edge: 'rgba(196, 181, 253, 0.44)',
          };
        }
        if (kind === 'reinforced') {
          return {
            top: { r: 64, g: 58, b: 86 },
            bottom: { r: 34, g: 29, b: 52 },
            edge: 'rgba(203, 213, 225, 0.45)',
          };
        }
        if (kind === 'splinter') {
          return {
            top: { r: 48, g: 72, b: 54 },
            bottom: { r: 24, g: 40, b: 30 },
            edge: 'rgba(167, 243, 208, 0.42)',
          };
        }
        return {
          top: { r: 46, g: 66, b: 94 },
          bottom: { r: 20, g: 33, b: 55 },
          edge: 'rgba(186, 230, 253, 0.42)',
        };
      })();
      const hpBoost = Math.round(hpPct * 14);
      const topColor = {
        r: Math.min(255, styleByKind.top.r + hpBoost),
        g: Math.min(255, styleByKind.top.g + hpBoost),
        b: Math.min(255, styleByKind.top.b + hpBoost),
      };
      const bottomColor = {
        r: Math.max(0, styleByKind.bottom.r + Math.round(hpPct * 8)),
        g: Math.max(0, styleByKind.bottom.g + Math.round(hpPct * 8)),
        b: Math.max(0, styleByKind.bottom.b + Math.round(hpPct * 8)),
      };
      const centerX = x + brickWidth / 2;
      const centerY = y + BRICK_HEIGHT / 2;
      const hitScale = 1 + hitIntensity * 0.06;
      const baseScale = kind === 'objective' ? 1 : brickSizeScale;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(hitScale * baseScale, hitScale * baseScale);
      ctx.translate(-centerX, -centerY);

      const gradient = ctx.createLinearGradient(x, y, x, y + BRICK_HEIGHT);
      gradient.addColorStop(
        0,
        `rgba(${topColor.r}, ${topColor.g}, ${topColor.b}, 1)`
      );
      gradient.addColorStop(1, `rgba(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b}, 1)`);

      ctx.fillStyle = gradient;
      ctx.strokeStyle = styleByKind.edge;

      if (kind === 'prism') {
        ctx.beginPath();
        ctx.moveTo(centerX, y + 1.5);
        ctx.lineTo(x + brickWidth - 1.5, centerY);
        ctx.lineTo(centerX, y + BRICK_HEIGHT - 1.5);
        ctx.lineTo(x + 1.5, centerY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (kind === 'reinforced') {
        const cut = 6;
        ctx.beginPath();
        ctx.moveTo(x + cut, y + 1);
        ctx.lineTo(x + brickWidth - cut, y + 1);
        ctx.lineTo(x + brickWidth - 1, y + BRICK_HEIGHT * 0.38);
        ctx.lineTo(x + brickWidth - cut, y + BRICK_HEIGHT - 1);
        ctx.lineTo(x + cut, y + BRICK_HEIGHT - 1);
        ctx.lineTo(x + 1, y + BRICK_HEIGHT * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (kind === 'objective') {
        const objectiveBounds = getBrickBounds(brick, x, y, brickWidth);
        const objectiveX = objectiveBounds.x;
        const objectiveY = objectiveBounds.y;
        const objectiveWidth = objectiveBounds.width;
        const objectiveHeight = objectiveBounds.height;
        const coreVariant = brick.coreVariant ?? 'yellow';
        const corePalette =
          coreVariant === 'blue'
            ? {
                auraOuter: 'rgba(96, 165, 250, 0)',
                auraMid: 'rgba(59, 130, 246, 0.12)',
                auraCore: 'rgba(125, 211, 252, 0.18)',
                shellTop: 'rgba(191, 219, 254, 1)',
                shellMid: 'rgba(59, 130, 246, 1)',
                shellBottom: 'rgba(30, 64, 175, 1)',
                edge: 'rgba(191, 219, 254, 0.58)',
                accent: 'rgba(224, 242, 254, 0.88)',
                text: 'rgba(239, 246, 255, 0.95)',
              }
            : coreVariant === 'green'
              ? {
                  auraOuter: 'rgba(34, 197, 94, 0)',
                  auraMid: 'rgba(34, 197, 94, 0.14)',
                  auraCore: 'rgba(134, 239, 172, 0.2)',
                  shellTop: 'rgba(187, 247, 208, 1)',
                  shellMid: 'rgba(34, 197, 94, 1)',
                  shellBottom: 'rgba(21, 128, 61, 1)',
                  edge: 'rgba(134, 239, 172, 0.62)',
                  accent: 'rgba(220, 252, 231, 0.92)',
                  text: 'rgba(240, 253, 244, 0.96)',
                }
            : {
                auraOuter: 'rgba(245, 158, 11, 0)',
                auraMid: 'rgba(245, 158, 11, 0.12)',
                auraCore: 'rgba(254, 240, 138, 0.18)',
                shellTop: 'rgba(255, 228, 146, 1)',
                shellMid: 'rgba(245, 158, 11, 1)',
                shellBottom: 'rgba(154, 52, 18, 1)',
                edge: 'rgba(255, 210, 120, 0.5)',
                accent: 'rgba(255, 247, 205, 0.9)',
                text: 'rgba(255, 252, 229, 0.95)',
              };
        const pulsePhase = now / 280 + brick.row * 0.35 + brick.col * 0.22;
        const pulse = 0.5 + Math.sin(pulsePhase) * 0.5;
        const transfer = Math.max(0, Math.min(1, 1 - brick.hp / Math.max(1, brick.maxHp)));
        const coreGlow = 1 - transfer;
        const coreShakeIntensity = Math.min(3.5, hitIntensity * 4.2);
        const coreShakeX = Math.sin(now * 0.16 + brick.col) * coreShakeIntensity;
        const coreShakeY = Math.cos(now * 0.2 + brick.row) * coreShakeIntensity * 0.7;
        ctx.save();
        ctx.translate(coreShakeX, coreShakeY);
        const auraRadius = Math.max(objectiveWidth, objectiveHeight) * (0.62 + pulse * 0.24);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const aura = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, auraRadius);
        aura.addColorStop(0, `rgba(255, 255, 255, ${(0.08 + pulse * 0.12) * coreGlow})`);
        aura.addColorStop(0.32, corePalette.auraCore);
        aura.addColorStop(0.62, corePalette.auraMid);
        aura.addColorStop(1, corePalette.auraOuter);
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const coreGradient = ctx.createRadialGradient(
          centerX,
          centerY,
          Math.max(2, objectiveHeight * 0.1),
          centerX,
          centerY,
          Math.max(objectiveWidth, objectiveHeight) * 0.62
        );
        coreGradient.addColorStop(0, corePalette.shellTop);
        coreGradient.addColorStop(0.45, corePalette.shellMid);
        coreGradient.addColorStop(1, corePalette.shellBottom);
        ctx.fillStyle = coreGradient;
        ctx.strokeStyle = corePalette.edge;

        if (coreVariant === 'blue') {
          const blueRadius = Math.max(6.2, Math.min(objectiveWidth, objectiveHeight) * 0.5);
          const blueForceFieldRadius = blueRadius * 1.9 * BLUE_CORE_FORCE_FIELD_SIZE_MULTIPLIER;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const blueGlow = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, blueForceFieldRadius);
          blueGlow.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
          blueGlow.addColorStop(0.18, 'rgba(191, 219, 254, 0.22)');
          blueGlow.addColorStop(0.55, 'rgba(59, 130, 246, 0.14)');
          blueGlow.addColorStop(1, 'rgba(30, 64, 175, 0)');
          ctx.fillStyle = blueGlow;
          ctx.beginPath();
          ctx.arc(centerX, centerY, blueForceFieldRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.beginPath();
          ctx.arc(centerX, centerY, blueRadius, 0, Math.PI * 2);
          ctx.fillStyle = coreGradient;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(centerX, centerY, Math.max(2.2, blueRadius * 0.72), 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 246, 255, 0.92)';
          ctx.fill();
          ctx.restore();
          ctx.restore();
          continue;
        }

        ctx.save();
        ctx.beginPath();
        if (coreVariant === 'green') {
          ctx.roundRect(objectiveX, objectiveY, objectiveWidth, objectiveHeight, objectiveHeight / 2);
        } else {
          ctx.roundRect(objectiveX, objectiveY, objectiveWidth, objectiveHeight, Math.min(7, objectiveHeight * 0.4));
        }
        ctx.lineWidth = 1.4 + pulse * 0.8;
        ctx.fill();
        ctx.stroke();
        ctx.clip();
        ctx.fillStyle = corePalette.accent;
        ctx.fillRect(
          objectiveX + 2 + pulse * 2,
          objectiveY + 2 + pulse * 1.5,
          Math.max(6, objectiveWidth * (0.32 + pulse * 0.1)),
          Math.max(3, objectiveHeight * (0.26 + pulse * 0.12))
        );
        ctx.restore();

        const pulseInset = 3 + pulse * 1.2;
        ctx.strokeStyle = corePalette.text;
        ctx.lineWidth = 1 + pulse * 0.4;
        ctx.beginPath();
        if (coreVariant === 'green') {
          ctx.roundRect(
            objectiveX + pulseInset,
            objectiveY + pulseInset,
            Math.max(2, objectiveWidth - pulseInset * 2),
            Math.max(2, objectiveHeight - pulseInset * 2),
            Math.max(2, (objectiveHeight - pulseInset * 2) / 2)
          );
        } else {
          ctx.roundRect(
            objectiveX + pulseInset,
            objectiveY + pulseInset,
            Math.max(2, objectiveWidth - pulseInset * 2),
            Math.max(2, objectiveHeight - pulseInset * 2),
            Math.min(6, objectiveHeight * 0.35)
          );
        }
        ctx.stroke();

        const coreRadius = Math.max(3.5, objectiveHeight * (0.17 + pulse * 0.08));
        ctx.fillStyle = coreVariant === 'green'
          ? 'rgba(240, 253, 244, 0.88)'
          : 'rgba(255, 252, 229, 0.85)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        if (coreVariant !== 'yellow') {
          ctx.strokeStyle = corePalette.text;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 2]);
          ctx.lineDashOffset = -now / 45;
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreRadius + 2.6 + pulse * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 247, 205, ${(0.28 + pulse * 0.2) * coreGlow})`;
        ctx.beginPath();
        ctx.moveTo(centerX, objectiveY + 3);
        ctx.lineTo(centerX, objectiveY + objectiveHeight - 3);
        ctx.moveTo(objectiveX + 3, centerY);
        ctx.lineTo(objectiveX + objectiveWidth - 3, centerY);
        ctx.stroke();
        ctx.restore();
      } else if (kind === 'unbreakable') {
        const metalGradient = ctx.createLinearGradient(x, y, x, y + BRICK_HEIGHT);
        metalGradient.addColorStop(0, 'rgba(248, 250, 252, 1)');
        metalGradient.addColorStop(0.22, 'rgba(148, 163, 184, 1)');
        metalGradient.addColorStop(0.5, 'rgba(71, 85, 105, 1)');
        metalGradient.addColorStop(0.78, 'rgba(148, 163, 184, 1)');
        metalGradient.addColorStop(1, 'rgba(30, 41, 59, 1)');
        ctx.fillStyle = metalGradient;
        ctx.fillRect(x, y, brickWidth, BRICK_HEIGHT);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y + 1, brickWidth - 2, BRICK_HEIGHT - 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
        ctx.lineWidth = 4;
        for (let stripe = -BRICK_HEIGHT; stripe < brickWidth + BRICK_HEIGHT; stripe += 12) {
          ctx.beginPath();
          ctx.moveTo(x + stripe, y + BRICK_HEIGHT);
          ctx.lineTo(x + stripe + BRICK_HEIGHT, y);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x + 1, y + 1, brickWidth - 2, BRICK_HEIGHT - 2);

        ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
        const rivetOffsetX = Math.max(8, brickWidth * 0.14);
        const rivetOffsetY = Math.max(7, BRICK_HEIGHT * 0.24);
        for (const rivetX of [x + rivetOffsetX, x + brickWidth - rivetOffsetX]) {
          for (const rivetY of [y + rivetOffsetY, y + BRICK_HEIGHT - rivetOffsetY]) {
            ctx.beginPath();
            ctx.arc(rivetX, rivetY, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        ctx.fillRect(x, y, brickWidth, BRICK_HEIGHT);
        ctx.strokeRect(x + 0.5, y + 0.5, brickWidth - 1, BRICK_HEIGHT - 1);
      }

      if (kind !== 'prism') {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + hitIntensity * 0.12})`;
        ctx.fillRect(x + 2, y + 2, brickWidth - 4, 3);
      }

      if (kind === 'unbreakable') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + brickWidth * 0.2, y + BRICK_HEIGHT * 0.3);
        ctx.lineTo(x + brickWidth * 0.8, y + BRICK_HEIGHT * 0.7);
        ctx.moveTo(x + brickWidth * 0.8, y + BRICK_HEIGHT * 0.3);
        ctx.lineTo(x + brickWidth * 0.2, y + BRICK_HEIGHT * 0.7);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (kind === 'oneway' && brick.weakSide) {
        const side = brick.weakSide;
        const arrowSize = Math.max(6, Math.min(9, Math.min(brickWidth, BRICK_HEIGHT) * 0.42));
        ctx.fillStyle = 'rgba(34, 211, 238, 0.26)';
        if (side === 'top') {
          ctx.fillRect(x + 1.5, y + 1.5, brickWidth - 3, 5);
        } else if (side === 'bottom') {
          ctx.fillRect(x + 1.5, y + BRICK_HEIGHT - 6.5, brickWidth - 3, 5);
        } else if (side === 'left') {
          ctx.fillRect(x + 1.5, y + 1.5, 5, BRICK_HEIGHT - 3);
        } else {
          ctx.fillRect(x + brickWidth - 6.5, y + 1.5, 5, BRICK_HEIGHT - 3);
        }

        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        if (side === 'top') {
          ctx.beginPath();
          ctx.moveTo(centerX, y + 3.5);
          ctx.lineTo(centerX - arrowSize, y + 3.5 + arrowSize + 1);
          ctx.lineTo(centerX + arrowSize, y + 3.5 + arrowSize + 1);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else if (side === 'bottom') {
          ctx.beginPath();
          ctx.moveTo(centerX, y + BRICK_HEIGHT - 3.5);
          ctx.lineTo(centerX - arrowSize, y + BRICK_HEIGHT - 3.5 - arrowSize - 1);
          ctx.lineTo(centerX + arrowSize, y + BRICK_HEIGHT - 3.5 - arrowSize - 1);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else if (side === 'left') {
          ctx.beginPath();
          ctx.moveTo(x + 3.5, centerY);
          ctx.lineTo(x + 3.5 + arrowSize + 1, centerY - arrowSize);
          ctx.lineTo(x + 3.5 + arrowSize + 1, centerY + arrowSize);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(x + brickWidth - 3.5, centerY);
          ctx.lineTo(x + brickWidth - 3.5 - arrowSize - 1, centerY - arrowSize);
          ctx.lineTo(x + brickWidth - 3.5 - arrowSize - 1, centerY + arrowSize);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        }
        ctx.lineWidth = 1;
      }

      const drawRoundedRectPath = (left: number, top: number, width: number, height: number, radius: number) => {
        const clampedRadius = Math.min(radius, width * 0.5, height * 0.5);
        ctx.beginPath();
        ctx.moveTo(left + clampedRadius, top);
        ctx.lineTo(left + width - clampedRadius, top);
        ctx.quadraticCurveTo(left + width, top, left + width, top + clampedRadius);
        ctx.lineTo(left + width, top + height - clampedRadius);
        ctx.quadraticCurveTo(left + width, top + height, left + width - clampedRadius, top + height);
        ctx.lineTo(left + clampedRadius, top + height);
        ctx.quadraticCurveTo(left, top + height, left, top + height - clampedRadius);
        ctx.lineTo(left, top + clampedRadius);
        ctx.quadraticCurveTo(left, top, left + clampedRadius, top);
        ctx.closePath();
      };

      const label = String(Math.max(0, Math.ceil(brick.hp)));
      if (kind === 'unbreakable') {
        const iconBadgeSize = Math.min(15, BRICK_HEIGHT - 6);
        const iconBadgeX = centerX - iconBadgeSize * 0.5;
        const iconBadgeY = centerY - iconBadgeSize * 0.5;
        drawRoundedRectPath(iconBadgeX, iconBadgeY, iconBadgeSize, iconBadgeSize, 3);
        ctx.fillStyle = 'rgba(6, 12, 24, 0.74)';
        ctx.fill();

        const lockBodyWidth = Math.max(5, iconBadgeSize * 0.5);
        const lockBodyHeight = Math.max(4, iconBadgeSize * 0.34);
        const lockBodyX = centerX - lockBodyWidth / 2;
        const lockBodyY = centerY - lockBodyHeight / 2 + 1;
        const shackleRadius = lockBodyWidth * 0.34;
        const shackleY = lockBodyY - shackleRadius + 0.5;

        ctx.strokeStyle = 'rgba(239, 246, 255, 0.96)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, shackleY, shackleRadius, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();

        drawRoundedRectPath(lockBodyX, lockBodyY, lockBodyWidth, lockBodyHeight, 1.5);
        ctx.fillStyle = 'rgba(239, 246, 255, 0.98)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(8, 15, 30, 0.88)';
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.fillStyle = 'rgba(8, 15, 30, 0.92)';
        ctx.beginPath();
        ctx.arc(centerX, lockBodyY + lockBodyHeight * 0.46, 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(centerX - 0.45, lockBodyY + lockBodyHeight * 0.46, 0.9, 1.7);
        ctx.restore();
        continue;
      }
      if (kind === 'objective') {
        ctx.restore();
        continue;
      }

      ctx.font = '700 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = 'rgba(3, 8, 19, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.strokeText(label, centerX, centerY);
      ctx.shadowColor = 'rgba(3, 8, 19, 0.45)';
      ctx.shadowBlur = 2;
      ctx.fillText(label, centerX, centerY);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    for (const particle of breakParticlesRef.current) {
      const alpha = Math.max(0, 1 - particle.ageMs / particle.lifeMs);
      if (alpha <= 0) {
        continue;
      }
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color.replace('ALPHA', alpha.toFixed(3));
      ctx.shadowColor = particle.color.replace('ALPHA', Math.min(1, alpha * 0.9).toFixed(3));
      ctx.shadowBlur = particle.glow * alpha;

      if (particle.kind === 'shard') {
        const shardWidth = particle.radius * 1.9;
        const shardHeight = Math.max(1.5, particle.radius * 0.62);
        ctx.fillRect(-shardWidth * 0.5, -shardHeight * 0.5, shardWidth, shardHeight);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    const loseY = LOSE_Y;
    ctx.moveTo(0, loseY);
    ctx.lineTo(CANVAS_WIDTH, loseY);
    ctx.stroke();

    if (isDragging && aimPoint && !shotInFlightRef.current) {
      const launcherX = CANVAS_WIDTH / 2;
      ctx.strokeStyle = 'rgba(120, 220, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(launcherX, LAUNCHER_Y);
      ctx.lineTo(aimPoint.x, aimPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    for (const ball of ballsRef.current) {
      if (!ball.active) {
        continue;
      }
      if (ball.coreCharged) {
        const speed = Math.hypot(ball.vx, ball.vy);
        const dirX = speed > 0.001 ? ball.vx / speed : 0;
        const dirY = speed > 0.001 ? ball.vy / speed : -1;
        for (let i = 1; i <= 4; i += 1) {
          const trailX = ball.x - dirX * i * 4.7 + Math.sin(now * 0.04 + i * 0.9) * 0.5;
          const trailY = ball.y - dirY * i * 4.7 + Math.cos(now * 0.05 + i * 0.8) * 0.5;
          const size = Math.max(1.5, 4 - i * 0.62);
          const alpha = Math.max(0.2, 0.62 - i * 0.1);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
          ctx.fillRect(trailX - size * 0.5, trailY - size * 0.5, size, size);
        }

        ctx.save();
        ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
        ctx.shadowBlur = 10;
        const chargedGradient = ctx.createRadialGradient(
          ball.x - 1.5,
          ball.y - 1.5,
          1,
          ball.x,
          ball.y,
          BALL_RADIUS + 1.2
        );
        chargedGradient.addColorStop(0, 'rgba(224, 242, 254, 1)');
        chargedGradient.addColorStop(0.35, 'rgba(125, 211, 252, 1)');
        chargedGradient.addColorStop(1, 'rgba(2, 132, 199, 1)');
        ctx.fillStyle = chargedGradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS + 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(186, 230, 253, 0.95)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS + 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const shooterGlow = Math.max(0, Math.min(1, objectiveCharge));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const shooterAura = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      LAUNCHER_Y,
      2,
      CANVAS_WIDTH / 2,
      LAUNCHER_Y,
      16 + shooterGlow * 9
    );
    shooterAura.addColorStop(0, `rgba(254, 240, 138, ${0.1 + shooterGlow * 0.5})`);
    shooterAura.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = shooterAura;
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, LAUNCHER_Y, 16 + shooterGlow * 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = shooterGlow > 0.05
      ? `rgba(255, ${222 + Math.round(shooterGlow * 26)}, ${104 + Math.round(shooterGlow * 70)}, 1)`
      : '#22d3ee';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, LAUNCHER_Y, 8 + shooterGlow * 2.8, 0, Math.PI * 2);
    ctx.fill();
  }, [aimPoint, isDragging]);

  const spawnBreakParticles = useCallback((brick: Brick, slowCinematic = false) => {
    const brickWidth = getBrickWidth();
    const brickX = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
    const brickY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
    const bounds = getBrickBounds(brick, brickX, brickY, brickWidth);
    const x = bounds.x;
    const y = bounds.y;
    const width = bounds.width;
    const height = bounds.height;
    const hpPct = Math.max(0, Math.min(1, brick.hp / Math.max(1, brick.maxHp)));
    const red = Math.round(220 - hpPct * 120);
    const green = Math.round(90 + hpPct * 110);
    const blue = 240;

    for (let i = 0; i < 12; i += 1) {
      const speedBase = slowCinematic ? 24 : 75;
      const speedRange = slowCinematic ? 56 : 135;
      const speed = speedBase + Math.random() * speedRange;
      const angle = Math.random() * Math.PI * 2;
      const isShard = i % 3 === 0;
      breakParticlesRef.current.push({
        x: x + width * (0.2 + Math.random() * 0.6),
        y: y + height * (0.2 + Math.random() * 0.6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (slowCinematic ? 8 : 30),
        radius: isShard ? 1.5 + Math.random() * 1.6 : 1.8 + Math.random() * 2.4,
        lifeMs: (slowCinematic ? 1300 : 220) + Math.random() * (slowCinematic ? 420 : 180),
        ageMs: 0,
        color: `rgba(${red}, ${green}, ${blue}, ALPHA)`,
        kind: isShard ? 'shard' : 'spark',
        rotation: Math.random() * Math.PI * 2,
        rotationVelocity: (Math.random() - 0.5) * (slowCinematic ? 4 : 11),
        glow: slowCinematic ? (isShard ? 7 : 12) : (isShard ? 5 : 9),
      });
    }
  }, []);

  const commitProfile = useCallback(
    (mutate: (draft: RogueBrickProfile) => void, markDirty: boolean) => {
      setProfile((prev) => {
        const base = prev ? cloneProfile(prev) : defaultProfile();
        mutate(base);
        base.updatedAt = Date.now();
        profileRef.current = base;
        return base;
      });
      if (markDirty) {
        setPendingSync(true);
        setSyncStatus('pending');
      }
    },
    []
  );

  useEffect(() => {
    profileRef.current = profile;
    if (profile?.run?.stage === 'board' && !shotInProgress) {
      bricksRef.current = profile.run.board.bricks.map((brick) => ({ ...brick }));
      return;
    }
    draw();
  }, [profile, draw]);

  useEffect(() => {
    const run = profile?.run;
    if (!run || run.stage !== 'board' || !run.homingBarrageReady || shotInFlightRef.current) {
      return;
    }

    setIsCoreBreachFlashing(true);
    const launchFrame = window.requestAnimationFrame(() => {
      const latestRun = profileRef.current?.run;
      if (!latestRun || latestRun.stage !== 'board' || !latestRun.homingBarrageReady || shotInFlightRef.current) {
        return;
      }
      launchShotRef.current({ x: 0, y: -1 }, { forceHoming: true });
    });

    return () => {
      window.cancelAnimationFrame(launchFrame);
    };
  }, [profile?.run?.homingBarrageReady, profile?.run?.stage]);

  useEffect(() => {
    if (shotInFlightRef.current || profile?.run?.stage !== 'board') {
      return;
    }

    const animateIdleBoard = (timestamp: number) => {
      if (shotInFlightRef.current) {
        idleAnimationRef.current = null;
        return;
      }
      const runSnapshot = profileRef.current?.run;
      if (!runSnapshot || runSnapshot.stage !== 'board') {
        idleAnimationRef.current = null;
        return;
      }
      frameNowRef.current = timestamp;
      draw();
      const hasObjective = runSnapshot.board.bricks.some((brick) => (brick.kind ?? 'standard') === 'objective');
      if (hasObjective || boardAdvanceAnimationRef.current) {
        idleAnimationRef.current = requestAnimationFrame(animateIdleBoard);
      } else {
        idleAnimationRef.current = null;
      }
    };

    idleAnimationRef.current = requestAnimationFrame(animateIdleBoard);
    return () => {
      if (idleAnimationRef.current !== null) {
        cancelAnimationFrame(idleAnimationRef.current);
        idleAnimationRef.current = null;
      }
    };
  }, [draw, profile?.run, shotInProgress]);

  useEffect(() => {
    const handleOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineState);
    window.addEventListener('offline', handleOnlineState);
    return () => {
      window.removeEventListener('online', handleOnlineState);
      window.removeEventListener('offline', handleOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!isFocusMode) {
      return;
    }

    document.body.classList.add('rogue-brick-focus-mode');

    return () => {
      document.body.classList.remove('rogue-brick-focus-mode');
    };
  }, [isFocusMode]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const storedRaw = localStorage.getItem(storageKey);
      let localEnvelope: StoredEnvelope | null = null;
      if (storedRaw) {
        try {
          const parsed = JSON.parse(storedRaw) as StoredEnvelope;
          if (parsed?.profile && typeof parsed.profile === 'object') {
            localEnvelope = {
              profile: normalizeProfile(parsed.profile as RogueBrickProfile),
              pendingSync: Boolean(parsed.pendingSync),
              serverUpdatedAt:
                typeof parsed.serverUpdatedAt === 'number' && !Number.isNaN(parsed.serverUpdatedAt)
                  ? parsed.serverUpdatedAt
                  : 0,
            };
          }
        } catch {
          localEnvelope = null;
        }
      }

      if (localEnvelope) {
        setProfile(localEnvelope.profile);
        setPendingSync(localEnvelope.pendingSync);
        setServerUpdatedAt(localEnvelope.serverUpdatedAt);
      } else {
        setProfile(defaultProfile());
        setPendingSync(false);
        setServerUpdatedAt(0);
      }

      if (!navigator.onLine) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const remote = await rogueBrickApi.getProgress();
        if (cancelled) {
          return;
        }

        const remoteProfile = remote.progressJson ? parseProgress(remote.progressJson) : null;
        if (!remoteProfile) {
          setIsLoading(false);
          return;
        }

        if (!localEnvelope) {
          setProfile(remoteProfile);
          setPendingSync(false);
          setServerUpdatedAt(remote.updatedAtEpochMs);
          setSyncStatus('synced');
          setIsLoading(false);
          return;
        }

        if (!localEnvelope.pendingSync && remote.updatedAtEpochMs > localEnvelope.serverUpdatedAt) {
          setProfile(remoteProfile);
          setPendingSync(false);
          setServerUpdatedAt(remote.updatedAtEpochMs);
          setSyncStatus('synced');
        }
      } catch {
        setSyncStatus('pending');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !profile) {
      return;
    }
    const payload: StoredEnvelope = {
      profile,
      pendingSync,
      serverUpdatedAt,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [storageKey, profile, pendingSync, serverUpdatedAt]);

  useEffect(() => {
    if (!profile || !pendingSync || !isOnline) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        const response = await rogueBrickApi.saveProgress(JSON.stringify(profile));
        setPendingSync(false);
        setServerUpdatedAt(response.updatedAtEpochMs);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('pending');
      }
    }, 1100);

    return () => window.clearTimeout(timeout);
  }, [profile, pendingSync, isOnline]);

  const endRun = useCallback(
    (victory: boolean) => {
      commitProfile((draft) => {
        if (!draft.run) {
          return;
        }
        const runState = draft.run;
        const metaEarned = toMetaEarned(runState, victory);
        draft.metaCurrency += metaEarned;
        draft.totalRuns += 1;
        draft.bestLevel = Math.max(draft.bestLevel, runState.level);
        draft.lastRunSummary = {
          victory,
          boardsCleared: runState.boardsCleared,
          levelReached: runState.level,
          metaEarned,
          completedAt: Date.now(),
        };
        draft.run = null;
      }, true);
    },
    [commitProfile]
  );

  const finalizeTurn = useCallback(() => {
    setShotInProgress(false);
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      coinsEarned: 0,
      remainingBricks: 0,
    });
    shotInFlightRef.current = false;
    brickVisualRef.current.clear();
    breakParticlesRef.current = [];
    finalBrickCinematicUntilRef.current = 0;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const brickSnapshot = bricksRef.current.map((brick) => ({ ...brick }));
    const rewards = { ...pendingRewardsRef.current };
    const destroyedThisTurn = pendingDestroyedBricksRef.current;
    const bounceCountThisTurn = pendingBounceCountRef.current;
    const postTurnCoreCharge = coreChargeRef.current;
    const usedHomingBarrage = homingBarrageUsedRef.current;
    const handledCoreBreachThisTurn = coreBreachHandledThisTurnRef.current;
    homingBarrageUsedRef.current = false;
    pendingRewardsRef.current = { mana: 0, coins: 0 };
    pendingDestroyedBricksRef.current = 0;
    pendingBounceCountRef.current = 0;

    let shouldFlashCoreBreach = false;
    let flashVariant: CoreVariant = coreBreachFlashVariant;
    const shouldAnimateBoardAdvance = brickSnapshot.length > 0;
    const commitTurnResolution = () =>
      commitProfile((draft) => {
        if (!draft.run || draft.run.stage !== 'board') {
          return;
        }

        const runState = draft.run;
        runState.mana += Math.round(rewards.mana);
        runState.coins += Math.round(rewards.coins);
        runState.board.bricks = brickSnapshot;
        runState.coreCharge = postTurnCoreCharge;
        if (usedHomingBarrage) {
          runState.homingBarrageReady = false;
        }
        runState.levelBricksDestroyed = (runState.levelBricksDestroyed ?? 0) + destroyedThisTurn;
        runState.boardShotsTaken = (runState.boardShotsTaken ?? 0) + 1;
        runState.boardBounceCount = (runState.boardBounceCount ?? 0) + bounceCountThisTurn;
        runState.levelGoalBricks = Math.max(
          1,
          runState.levelGoalBricks ?? calculateLevelGoal(Math.max(1, runState.board.bricks.length))
        );
        const objectiveIds = getObjectiveBrickIds(runState.board);
        const remainingObjectiveIds = objectiveIds.filter((id) =>
          runState.board.bricks.some((brick) => brick.id === id)
        );
        const objectiveRemoved = objectiveIds.length > 0 && remainingObjectiveIds.length < objectiveIds.length;
        if (objectiveRemoved && !handledCoreBreachThisTurn) {
          runState.board.objectiveBrickIds = remainingObjectiveIds;
          runState.board.objectiveBrickId = remainingObjectiveIds[0] ?? null;
          const currentObjective = remainingObjectiveIds.length
            ? runState.board.bricks.find((brick) => brick.id === remainingObjectiveIds[0]) ?? null
            : null;
          runState.coreCharge = currentObjective
            ? Math.max(0, Math.min(1, 1 - currentObjective.hp / Math.max(1, currentObjective.maxHp)))
            : 0;
          runState.homingBarrageReady = false;
          runState.hubMessage =
            remainingObjectiveIds.length > 0
              ? `${remainingObjectiveIds.length} core${remainingObjectiveIds.length === 1 ? '' : 's'} remain.`
              : 'Core drained! Next shot is a guaranteed homing barrage.';
          shouldFlashCoreBreach = true;
          flashVariant = currentObjective?.coreVariant ?? flashVariant;
        }

        if (runState.board.bricks.length === 0) {
          const clearedPathNode = runState.pathNodesByLevel[runState.level] ?? getCurrentPathNode(runState);
          const clearedStoreType = clearedPathNode.storeType;
          const boardSummary: BoardSummary = {
            shotsTaken: runState.boardShotsTaken,
            bounceCount: runState.boardBounceCount,
            achievements: [],
          };
          boardSummary.achievements = buildBoardAchievements(boardSummary);
          runState.lastBoardSummary = boardSummary;
          runState.boardSummaryAcknowledged = false;
          runState.boardsCleared += 1;
          runState.level += 1;
          const storeArrivalMessage =
            clearedStoreType === 'mana'
              ? ' A mana store awaits at the hub.'
              : clearedStoreType === 'money'
                ? ' A money store awaits at the hub.'
                : '';
          runState.hubMessage = `Board cleared. Ascend to level ${runState.level}.${storeArrivalMessage}`;

          if (runState.level > runState.maxLevels) {
            runState.stage = 'hub';
            runState.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
            runState.coreCharge = 0;
            runState.homingBarrageReady = false;
            runState.boardShotsTaken = 0;
            runState.boardBounceCount = 0;
            return;
          }

          const moneyStoreUnlocked = clearedStoreType === 'money';
          const manaStoreUnlocked = clearedStoreType === 'mana';
          if (manaStoreUnlocked || runState.boardsCleared % BALANCE.powerChoiceEveryBoards === 0) {
            runState.stage = 'powerup';
            runState.pendingPowerOffers = makePowerOffers(runState);
            runState.pendingStoreOffers = moneyStoreUnlocked ? makeStoreOffers(runState) : [];
          } else if (moneyStoreUnlocked) {
            runState.stage = 'store';
            runState.pendingStoreOffers = makeStoreOffers(runState);
            runState.pendingPowerOffers = [];
          } else {
            runState.stage = 'hub';
            runState.pendingStoreOffers = [];
            runState.pendingPowerOffers = [];
          }

          runState.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
          runState.coreCharge = 0;
          runState.homingBarrageReady = false;
          return;
        }

        advanceBoardRows(runState.board);
        if (runState.board.bricks.some((brick) => hasBrickCrossedThreshold(brick))) {
          runState.stage = 'hub';
          runState.hubMessage = 'A brick crossed the threshold.';
        }
      }, true);
    if (shouldAnimateBoardAdvance) {
      const currentTurn = profileRef.current?.run?.board.turn ?? 1;
      const startingBrickRows = brickSnapshot.reduce<Record<string, number>>((rows, brick) => {
        rows[brick.id] = brick.row;
        return rows;
      }, {});
      boardAdvanceAnimationRef.current = {
        durationMs: BOARD_ROW_ADVANCE_ANIMATION_MS,
        startsAtTurn: currentTurn + 1,
        startedAtMs: null,
        startingBrickRows,
      };
    }
    commitTurnResolution();

    if (shouldFlashCoreBreach) {
      setCoreBreachFlashVariant(flashVariant);
      setIsCoreBreachFlashing(true);
      if (coreBreachFlashTimeoutRef.current !== null) {
        window.clearTimeout(coreBreachFlashTimeoutRef.current);
      }
      coreBreachFlashTimeoutRef.current = window.setTimeout(() => {
        coreBreachFlashTimeoutRef.current = null;
        setIsCoreBreachFlashing(false);
      }, CORE_BREACH_FLASH_MS);
    }
    if (handledCoreBreachThisTurn) {
      coreBreachHandledThisTurnRef.current = false;
    }
  }, [commitProfile]);

  useEffect(() => {
    if (!autoHomingLaunchPending) {
      return;
    }
  }, [autoHomingLaunchPending]);

  useEffect(() => {
    if (!profile?.run) {
      return;
    }
    if (profile.run.level > profile.run.maxLevels) {
      const timer = window.setTimeout(() => endRun(true), 0);
      return () => window.clearTimeout(timer);
    }
    if (profile.run.stage === 'hub' && profile.run.hubMessage === 'A brick crossed the threshold.') {
      const timer = window.setTimeout(() => endRun(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [profile, endRun]);

  const launchShot = useCallback(
    (direction: { x: number; y: number }, options?: { forceHoming?: boolean }) => {
      const currentRun = profileRef.current?.run;
      if (!currentRun || currentRun.stage !== 'board') {
        return;
      }
      if (
        (shotInFlightRef.current && !options?.forceHoming) ||
        currentRun.board.bricks.length === 0
      ) {
        return;
      }

      setIsDragging(false);
      setAimPoint(null);
      setAutoHomingLaunchPending(false);
      if (options?.forceHoming) {
        breachCleanupQueuedRef.current = false;
      }
      if (coreBreachFlashTimeoutRef.current !== null) {
        window.clearTimeout(coreBreachFlashTimeoutRef.current);
        coreBreachFlashTimeoutRef.current = null;
      }
      if (coreBreachLaunchFrameRef.current !== null) {
        window.cancelAnimationFrame(coreBreachLaunchFrameRef.current);
        coreBreachLaunchFrameRef.current = null;
      }
      boardAdvanceAnimationRef.current = null;
      const sourceBricks = options?.forceHoming ? bricksRef.current : currentRun.board.bricks;
      if (sourceBricks.length === 0) {
        return;
      }
      shotInFlightRef.current = true;
      setShotInProgress(true);
      setLiveHud({
        destroyedBricks: 0,
        manaEarned: 0,
        coinsEarned: 0,
        remainingBricks: sourceBricks.length,
      });
      const homingBarrageActive = Boolean(currentRun.homingBarrageReady || options?.forceHoming);
      homingBarrageUsedRef.current = homingBarrageActive;
      ballsRef.current = [];
      bricksRef.current = sourceBricks.map((brick) => ({ ...brick }));
      launchQueueRef.current = Array.from({ length: currentRun.ballCount }, (_, index) => ({
        delayMs: index * BALANCE.launchStaggerMs,
      }));
      launchDirectionRef.current = direction;
      launchElapsedRef.current = 0;
      pendingRewardsRef.current = { mana: 0, coins: 0 };
      pendingDestroyedBricksRef.current = 0;
      pendingBounceCountRef.current = 0;
      coreChargeRef.current = currentRun.coreCharge ?? 0;
      homingBulletTimeHitsRef.current = 0;
      finalBrickCinematicUntilRef.current = 0;
      let noHitElapsedMs = 0;
      let speedMultiplier = 1;

      let previousTs = performance.now();
      const frame = (timestamp: number) => {
        frameNowRef.current = timestamp;
        const activeRun = profileRef.current?.run;
        if (!shotInFlightRef.current || !activeRun || activeRun.stage !== 'board') {
          return;
        }

        homingBulletTimeHitsRef.current =
          homingBarrageActive && bricksRef.current.length === 1 ? 1 : 0;
        const bulletTimeScale =
          homingBarrageActive && homingBulletTimeHitsRef.current > 0
            ? HOMING_BULLET_TIME_SCALE
            : 1;
        const dtSeconds = Math.min((timestamp - previousTs) / 1000, 0.033) * speedMultiplier * bulletTimeScale;
        previousTs = timestamp;
        launchElapsedRef.current += dtSeconds * 1000;
        let touchedBrickThisFrame = false;

        while (
          launchQueueRef.current.length > 0 &&
          launchElapsedRef.current >= launchQueueRef.current[0].delayMs
        ) {
          launchQueueRef.current.shift();
          const scatter = (Math.random() - 0.5) * 0.05;
          const vx = homingBarrageActive
            ? Math.cos(-Math.PI * 0.5 + (Math.random() - 0.5) * 0.8) * BALL_SPEED * 1.2
            : (launchDirectionRef.current.x + scatter) * BALL_SPEED;
          const vy = homingBarrageActive
            ? Math.sin(-Math.PI * 0.5 + (Math.random() - 0.5) * 0.8) * BALL_SPEED * 1.2
            : launchDirectionRef.current.y * BALL_SPEED;
          ballsRef.current.push({
            x: CANVAS_WIDTH / 2,
            y: LAUNCHER_Y,
            vx,
            vy,
            active: true,
            coreCharged: false,
          });
        }

        const rewards = pendingRewardsRef.current;
        const brickWidth = getBrickWidth();
        const processedExplosions = new Set<string>();
        const activeObjectiveBrickIds = getObjectiveBrickIds(activeRun.board);
        const activeObjectiveBricks = activeObjectiveBrickIds
          .map((id) => bricksRef.current.find((brick) => brick.id === id) ?? null)
          .filter((brick): brick is Brick => Boolean(brick));
        const objectiveCharge = activeObjectiveBricks.length
          ? Math.max(
              ...activeObjectiveBricks.map((brick) =>
                Math.max(0, Math.min(1, 1 - brick.hp / Math.max(1, brick.maxHp)))
              )
            )
          : homingBarrageActive
            ? 1
            : activeRun.coreCharge ?? 1;
        coreChargeRef.current = objectiveCharge;
        const blueCoreBricks = activeObjectiveBricks.filter((brick) => (brick.coreVariant ?? 'yellow') === 'blue');
        const finalBrickCinematicActive = finalBrickCinematicUntilRef.current > timestamp;
        const particleTimeScale = finalBrickCinematicActive ? 0.12 : 1;
        const particleDtSeconds = dtSeconds * particleTimeScale;
        for (const particle of breakParticlesRef.current) {
          particle.ageMs += particleDtSeconds * 1000;
          particle.x += particle.vx * particleDtSeconds;
          particle.y += particle.vy * particleDtSeconds;
          particle.vx *= 0.985;
          particle.vy *= 0.99;
          particle.vy += 280 * particleDtSeconds;
          particle.rotation += particle.rotationVelocity * particleDtSeconds;
        }
        breakParticlesRef.current = breakParticlesRef.current.filter(
          (particle) => particle.ageMs < particle.lifeMs
        );

        const destroyBrick = (brick: Brick, sourceBall: BallRuntime | null) => {
          pendingDestroyedBricksRef.current += 1;
          const isObjective = (brick.kind ?? 'standard') === 'objective';
          const isUnbreakable = (brick.kind ?? 'standard') === 'unbreakable';
          const baseCoinReward = isObjective
            ? BALANCE.objectiveCoinRewardFlat + Math.max(1, brick.maxHp) * BALANCE.objectiveCoinRewardHpScale
            : isUnbreakable
              ? 4
            : BALANCE.brickCoinRewardFlat + Math.max(1, brick.maxHp) * BALANCE.brickCoinRewardHpScale;
          rewards.coins += activeRun.coinMultiplier * baseCoinReward;
          const bricksRemainingAfterHit = bricksRef.current.reduce(
            (count, entry) => count + (entry.hp > 0 ? 1 : 0),
            0
          );
          const isFinalBrickExplosion = bricksRemainingAfterHit === 0;
          const remainingObjectiveCount = bricksRef.current.reduce(
            (count, entry) => count + ((entry.kind ?? 'standard') === 'objective' && entry.hp > 0 ? 1 : 0),
            0
          );
          if (isFinalBrickExplosion) {
            finalBrickCinematicUntilRef.current = timestamp + 1800;
          }
          spawnBreakParticles(brick, isFinalBrickExplosion);
          brickVisualRef.current.delete(brick.id);
          if (isObjective && remainingObjectiveCount === 0) {
            coreBreachHandledThisTurnRef.current = true;
            breachCleanupQueuedRef.current = true;
            setCoreBreachFlashVariant(brick.coreVariant ?? 'yellow');
            setIsCoreBreachFlashing(true);
            if (coreBreachFlashTimeoutRef.current !== null) {
              window.clearTimeout(coreBreachFlashTimeoutRef.current);
            }
            coreBreachFlashTimeoutRef.current = window.setTimeout(() => {
              coreBreachFlashTimeoutRef.current = null;
              setIsCoreBreachFlashing(false);
            }, CORE_BREACH_FLASH_MS);
          }

          if ((brick.kind ?? 'standard') === 'splinter' && sourceBall) {
            if (ballsRef.current.length < MAX_ACTIVE_BALLS) {
              const baseAngle = Math.atan2(sourceBall.vy, sourceBall.vx);
              const speed = Math.hypot(sourceBall.vx, sourceBall.vy) * 0.9;
              const brickX = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
              const brickY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
              const originX = brickX + brickWidth / 2;
              const originY = brickY + BRICK_HEIGHT / 2;
              for (const offset of [-0.45, 0.45]) {
                if (ballsRef.current.length >= MAX_ACTIVE_BALLS) {
                  break;
                }
                const angle = baseAngle + offset;
                ballsRef.current.push({
                  x: originX,
                  y: originY,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  active: true,
                  coreCharged: sourceBall.coreCharged,
                });
              }
            }
          }

          if ((brick.kind ?? 'standard') === 'exploding' && !processedExplosions.has(brick.id)) {
            processedExplosions.add(brick.id);
            const splashDamage = Math.max(2, Math.round(activeRun.damage * 1.25));
            for (const neighbor of bricksRef.current) {
              if (neighbor.id === brick.id || neighbor.hp <= 0) {
                continue;
              }
              if (Math.abs(neighbor.row - brick.row) > 1 || Math.abs(neighbor.col - brick.col) > 1) {
                continue;
              }
              if ((neighbor.kind ?? 'standard') === 'unbreakable') {
                continue;
              }
              neighbor.hp -= splashDamage;
              brickVisualRef.current.set(neighbor.id, { hitUntil: timestamp + 120 });
              touchedBrickThisFrame = true;
              if (neighbor.hp <= 0) {
                destroyBrick(neighbor, sourceBall);
              }
            }
          }
        };

        for (const ball of ballsRef.current) {
          if (!ball.active) {
            continue;
          }

          if (blueCoreBricks.length > 0 && !homingBarrageActive) {
            let nearestBlueCore: Brick | null = null;
            let nearestBlueDistanceSq = Number.POSITIVE_INFINITY;
            for (const blueCoreBrick of blueCoreBricks) {
              const blueCoreWidth = getBrickWidth();
              const blueCoreBounds = getBrickBounds(
                blueCoreBrick,
                BRICK_GAP + blueCoreBrick.col * (blueCoreWidth + BRICK_GAP),
                BRICK_TOP + blueCoreBrick.row * (BRICK_HEIGHT + BRICK_GAP),
                blueCoreWidth
              );
              const blueCoreX = blueCoreBounds.x + blueCoreBounds.width * 0.5;
              const blueCoreY = blueCoreBounds.y + blueCoreBounds.height * 0.5;
              const deltaX = blueCoreX - ball.x;
              const deltaY = blueCoreY - ball.y;
              const distanceSq = deltaX * deltaX + deltaY * deltaY;
              if (distanceSq < nearestBlueDistanceSq) {
                nearestBlueDistanceSq = distanceSq;
                nearestBlueCore = blueCoreBrick;
              }
            }
            if (nearestBlueCore) {
              const blueCoreWidth = getBrickWidth();
              const blueCoreBounds = getBrickBounds(
                nearestBlueCore,
                BRICK_GAP + nearestBlueCore.col * (blueCoreWidth + BRICK_GAP),
                BRICK_TOP + nearestBlueCore.row * (BRICK_HEIGHT + BRICK_GAP),
                blueCoreWidth
              );
              const blueCoreCenterX = blueCoreBounds.x + blueCoreBounds.width * 0.5;
              const blueCoreCenterY = blueCoreBounds.y + blueCoreBounds.height * 0.5;
              const awayX = ball.x - blueCoreCenterX;
              const awayY = ball.y - blueCoreCenterY;
              const awayDistance = Math.hypot(awayX, awayY);
              if (awayDistance > 0.001) {
                const blueCoreSizeScale = getObjectiveSizeScale(nearestBlueCore);
                const blueCoreForceScale = 1.35 + (1 - blueCoreSizeScale) * 3.1;
                const blueCoreVisualRadius = Math.max(6.2, Math.min(blueCoreBounds.width, blueCoreBounds.height) * 0.5);
                const blueCoreInfluenceRadius =
                  blueCoreVisualRadius * 1.2 * BLUE_CORE_FORCE_FIELD_SIZE_MULTIPLIER;
                if (awayDistance < blueCoreInfluenceRadius) {
                  const awayNormalX = awayX / awayDistance;
                  const awayNormalY = awayY / awayDistance;
                  const toCoreNormalX = -awayNormalX;
                  const toCoreNormalY = -awayNormalY;
                  const ballSpeed = Math.hypot(ball.vx, ball.vy);
                  const towardCoreAlignment =
                    ballSpeed > 0.001
                      ? Math.max(0, ball.vx * toCoreNormalX + ball.vy * toCoreNormalY) / ballSpeed
                      : 0;
                  const proximity = (blueCoreInfluenceRadius - awayDistance) / blueCoreInfluenceRadius;
                  const approachAmplifier = 1 + towardCoreAlignment * 3.4;
                  const repelStrength =
                    proximity * proximity * 930 * blueCoreForceScale * approachAmplifier;
                  const resistance = ball.coreCharged ? 0.65 : 1;
                  ball.vx += awayNormalX * repelStrength * resistance * dtSeconds;
                  ball.vy += awayNormalY * repelStrength * resistance * dtSeconds;

                  const tangentX = -awayNormalY;
                  const tangentY = awayNormalX;
                  const cross = ball.vx * awayNormalY - ball.vy * awayNormalX;
                  const swirlDirection = cross === 0 ? (ball.x < blueCoreCenterX ? -1 : 1) : Math.sign(cross);
                  const swerveStrength = proximity * 640 * blueCoreForceScale * approachAmplifier;
                  ball.vx += tangentX * swirlDirection * swerveStrength * resistance * dtSeconds;
                  ball.vy += tangentY * swirlDirection * swerveStrength * resistance * dtSeconds;
                  const towardCoreVelocity = ball.vx * toCoreNormalX + ball.vy * toCoreNormalY;
                  if (towardCoreVelocity > 0) {
                    ball.vx -= toCoreNormalX * towardCoreVelocity;
                    ball.vy -= toCoreNormalY * towardCoreVelocity;
                  }

                  if (ballSpeed > 0.001) {
                    const adjustedSpeed = Math.hypot(ball.vx, ball.vy);
                    if (adjustedSpeed > 0.001) {
                      const speedScale = ballSpeed / adjustedSpeed;
                      ball.vx *= speedScale;
                      ball.vy *= speedScale;
                    }
                  }
                }
              }
            }
          }

          if (homingBarrageActive && bricksRef.current.length > 0) {
            let nearestBrick: Brick | null = null;
            let nearestDistanceSq = Number.POSITIVE_INFINITY;
            for (const brick of bricksRef.current) {
              if (brick.hp <= 0) {
                continue;
              }
              const targetX = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP) + brickWidth * 0.5;
              const targetY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP) + BRICK_HEIGHT * 0.5;
              const dx = targetX - ball.x;
              const dy = targetY - ball.y;
              const distanceSq = dx * dx + dy * dy;
              if (distanceSq < nearestDistanceSq) {
                nearestDistanceSq = distanceSq;
                nearestBrick = brick;
              }
            }
            if (nearestBrick) {
              const targetX = BRICK_GAP + nearestBrick.col * (brickWidth + BRICK_GAP) + brickWidth * 0.5;
              const targetY = BRICK_TOP + nearestBrick.row * (BRICK_HEIGHT + BRICK_GAP) + BRICK_HEIGHT * 0.5;
              const toTargetX = targetX - ball.x;
              const toTargetY = targetY - ball.y;
              const toTargetLength = Math.hypot(toTargetX, toTargetY);
              if (toTargetLength > 0.001) {
                const homingSpeed = BALL_SPEED * 1.45;
                ball.vx = (toTargetX / toTargetLength) * homingSpeed;
                ball.vy = (toTargetY / toTargetLength) * homingSpeed;
              }
            }
          }

          const travelX = ball.vx * dtSeconds;
          const travelY = ball.vy * dtSeconds;
          const travelDistance = Math.hypot(travelX, travelY);
          const subSteps = Math.max(1, Math.min(6, Math.ceil(travelDistance / (BALL_RADIUS * 0.65))));
          const stepX = travelX / subSteps;
          const stepY = travelY / subSteps;

          for (let stepIndex = 0; stepIndex < subSteps; stepIndex += 1) {
            ball.x += stepX;
            ball.y += stepY;

            if (ball.x <= BALL_RADIUS) {
              ball.x = BALL_RADIUS;
              ball.vx = Math.abs(ball.vx);
              ball.coreCharged = true;
              pendingBounceCountRef.current += 1;
            } else if (ball.x >= CANVAS_WIDTH - BALL_RADIUS) {
              ball.x = CANVAS_WIDTH - BALL_RADIUS;
              ball.vx = -Math.abs(ball.vx);
              ball.coreCharged = true;
              pendingBounceCountRef.current += 1;
            }

            if (ball.y <= BALL_RADIUS) {
              ball.y = BALL_RADIUS;
              ball.vy = Math.abs(ball.vy);
              ball.coreCharged = true;
              pendingBounceCountRef.current += 1;
            }
            if (homingBarrageActive && ball.y >= CANVAS_HEIGHT - BALL_RADIUS) {
              ball.y = CANVAS_HEIGHT - BALL_RADIUS;
              ball.vy = -Math.abs(ball.vy);
              pendingBounceCountRef.current += 1;
            }

            let hitBrick = false;
            for (const brick of bricksRef.current) {
              if (brick.hp <= 0) {
                continue;
              }
              const brickX = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
              const brickY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
              const brickBounds = getBrickBounds(brick, brickX, brickY, brickWidth);
              const collisionX = brickBounds.x;
              const collisionY = brickBounds.y;
              const collisionWidth = brickBounds.width;
              const collisionHeight = brickBounds.height;
              if (
                ball.x + BALL_RADIUS < collisionX ||
                ball.x - BALL_RADIUS > collisionX + collisionWidth ||
                ball.y + BALL_RADIUS < collisionY ||
                ball.y - BALL_RADIUS > collisionY + collisionHeight
              ) {
                continue;
              }

              const nearestX = clampCoordinate(ball.x, collisionX, collisionX + collisionWidth);
              const nearestY = clampCoordinate(ball.y, collisionY, collisionY + collisionHeight);
              const deltaX = ball.x - nearestX;
              const deltaY = ball.y - nearestY;
              const distanceSq = deltaX * deltaX + deltaY * deltaY;
              const radiusSq = BALL_RADIUS * BALL_RADIUS;
              if (distanceSq > radiusSq) {
                continue;
              }
              const hitVerticalEdge =
                Math.abs(nearestX - collisionX) < 0.001 || Math.abs(nearestX - (collisionX + collisionWidth)) < 0.001;
              const hitHorizontalEdge =
                Math.abs(nearestY - collisionY) < 0.001 || Math.abs(nearestY - (collisionY + collisionHeight)) < 0.001;
              const cornerHit = hitVerticalEdge && hitHorizontalEdge;

              const isCrit = Math.random() < activeRun.critChance;
              const baseDamage = activeRun.damage * (isCrit ? 2 : 1);
              const chargedDamage = Math.max(1, Math.round(baseDamage * (1 + objectiveCharge * 1.4)));
              const variant = brick.kind ?? 'standard';
              const damage =
                variant === 'reinforced'
                  ? Math.max(1, Math.round(chargedDamage * 0.75))
                  : variant === 'splinter'
                    ? Math.max(1, Math.round(chargedDamage * 0.9))
                    : chargedDamage;

              let normalX = 0;
              let normalY = 0;
              if (distanceSq > 0.0001) {
                const distance = Math.sqrt(distanceSq);
                normalX = deltaX / distance;
                normalY = deltaY / distance;
              } else if (Math.abs(ball.vx) > Math.abs(ball.vy)) {
                normalX = ball.vx > 0 ? -1 : 1;
              } else {
                normalY = ball.vy > 0 ? -1 : 1;
              }

              const impactSide = getImpactSideFromVelocity(ball, { x: normalX, y: normalY });
              const objectiveCanTakeDamage =
                variant !== 'objective' ||
                homingBarrageActive ||
                ball.coreCharged ||
                (brick.coreVariant ?? 'yellow') !== 'yellow';
              if (variant === 'objective' && !objectiveCanTakeDamage) {
                brickVisualRef.current.set(brick.id, { hitUntil: timestamp + 95 });
                for (let burst = 0; burst < 10; burst += 1) {
                  const angle = (Math.PI * 2 * burst) / 10 + Math.random() * 0.35;
                  const speed = 70 + Math.random() * 85;
                  breakParticlesRef.current.push({
                    x: ball.x,
                    y: ball.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 25,
                    radius: 1.6 + Math.random() * 1.5,
                    lifeMs: 180 + Math.random() * 120,
                    ageMs: 0,
                    color: 'rgba(248, 113, 113, ALPHA)',
                    kind: burst % 2 === 0 ? 'spark' : 'shard',
                    rotation: Math.random() * Math.PI * 2,
                    rotationVelocity: (Math.random() - 0.5) * 9,
                    glow: 8,
                  });
                }
                ball.active = false;
                hitBrick = true;
                break;
              }
              const canDamage =
                objectiveCanTakeDamage &&
                (homingBarrageActive || variant !== 'unbreakable' || objectiveCharge >= 1) &&
                (variant !== 'oneway' || !brick.weakSide || brick.weakSide === impactSide);

              if (canDamage) {
                if (homingBarrageActive || (variant === 'unbreakable' && objectiveCharge >= 1)) {
                  brick.hp = 0;
                } else {
                  brick.hp -= damage;
                }
                touchedBrickThisFrame = true;
                brickVisualRef.current.set(brick.id, { hitUntil: timestamp + 120 });
                const isObjective = variant === 'objective';
                if (isObjective) {
                  ball.coreCharged = false;
                }
                const baseManaReward = isObjective
                  ? (isCrit ? BALANCE.objectiveManaRewardCrit : BALANCE.objectiveManaRewardNormal)
                  : isCrit
                  ? BALANCE.brickManaRewardCrit
                  : BALANCE.brickManaRewardNormal;
                rewards.mana += activeRun.manaMultiplier * baseManaReward;
                if (brick.hp <= 0) {
                  destroyBrick(brick, ball);
                }
              } else {
                brickVisualRef.current.set(brick.id, { hitUntil: timestamp + 80 });
              }

              const penetration = BALL_RADIUS - Math.sqrt(Math.max(distanceSq, 0));
              if (penetration > 0) {
                ball.x += normalX * (penetration + 0.05);
                ball.y += normalY * (penetration + 0.05);
              }
              const velocityDotNormal = ball.vx * normalX + ball.vy * normalY;
              if (velocityDotNormal < 0) {
                ball.vx -= 2 * velocityDotNormal * normalX;
                ball.vy -= 2 * velocityDotNormal * normalY;
              } else if (Math.abs(normalX) > Math.abs(normalY)) {
                ball.vx *= -1;
              } else {
                ball.vy *= -1;
              }
              pendingBounceCountRef.current += 1;
              if (variant !== 'objective') {
                ball.coreCharged = true;
              }

              if (cornerHit) {
                const speed = Math.hypot(ball.vx, ball.vy);
                const minCornerComponent = speed * 0.45;
                if (Math.abs(ball.vx) < minCornerComponent) {
                  const horizontalSign = ball.vx === 0 ? (normalX !== 0 ? normalX : 1) : Math.sign(ball.vx);
                  ball.vx = horizontalSign * minCornerComponent;
                }
                if (Math.abs(ball.vy) < minCornerComponent) {
                  const verticalSign = ball.vy === 0 ? (normalY !== 0 ? normalY : -1) : Math.sign(ball.vy);
                  ball.vy = verticalSign * minCornerComponent;
                }
                const normalizedSpeed = Math.hypot(ball.vx, ball.vy);
                if (normalizedSpeed > 0.0001) {
                  const speedScale = speed / normalizedSpeed;
                  ball.vx *= speedScale;
                  ball.vy *= speedScale;
                }
              }

              if (homingBarrageActive) {
                ball.vx = -ball.vx * 0.72 + (Math.random() - 0.5) * 120;
                ball.vy = -Math.sign(ball.vy || -1) * Math.max(120, Math.abs(ball.vy) * 0.72);
              }

              hitBrick = true;
              break;
            }

            if (hitBrick) {
              break;
            }
          }

          if (!homingBarrageActive && ball.y >= CANVAS_HEIGHT + 12) {
            ball.active = false;
          }
        }

        bricksRef.current = bricksRef.current.filter((brick) => brick.hp > 0);
        const activeBrickIds = new Set(bricksRef.current.map((brick) => brick.id));
        for (const brickId of brickVisualRef.current.keys()) {
          if (!activeBrickIds.has(brickId)) {
            brickVisualRef.current.delete(brickId);
          }
        }
        ballsRef.current = ballsRef.current.filter((ball) => ball.active);
        if (breachCleanupQueuedRef.current) {
          breachCleanupQueuedRef.current = false;
          ballsRef.current = [];
          launchQueueRef.current = [];
          if (bricksRef.current.length > 0) {
            launchShotRef.current({ x: 0, y: -1 }, { forceHoming: true });
            return;
          }
        }
        if (homingBarrageActive) {
          if (bricksRef.current.length === 0) {
            ballsRef.current = [];
            launchQueueRef.current = [];
          }
        }

        if (touchedBrickThisFrame) {
          noHitElapsedMs = 0;
          speedMultiplier = 1;
          setLiveHud({
            destroyedBricks: pendingDestroyedBricksRef.current,
            manaEarned: rewards.mana,
            coinsEarned: rewards.coins,
            remainingBricks: bricksRef.current.length,
          });
        } else {
          noHitElapsedMs += dtSeconds * 1000;
          speedMultiplier = noHitElapsedMs >= 3000 ? 2 : 1;
        }

        draw();

        const finished = launchQueueRef.current.length === 0 && ballsRef.current.length === 0;
        const shouldHoldForFinalExplosion = finalBrickCinematicUntilRef.current > timestamp;
        if (finished) {
          if (shouldHoldForFinalExplosion) {
            animationRef.current = requestAnimationFrame(frame);
            return;
          }
          finalizeTurn();
          return;
        }

        animationRef.current = requestAnimationFrame(frame);
      };

      animationRef.current = requestAnimationFrame(frame);
    },
    [draw, finalizeTurn, spawnBreakParticles]
  );

  useEffect(
    () => () => {
      if (coreBreachFlashTimeoutRef.current !== null) {
        window.clearTimeout(coreBreachFlashTimeoutRef.current);
        coreBreachFlashTimeoutRef.current = null;
      }
      if (coreBreachLaunchFrameRef.current !== null) {
        window.cancelAnimationFrame(coreBreachLaunchFrameRef.current);
        coreBreachLaunchFrameRef.current = null;
      }
    },
    []
  );

  const reclaimShot = useCallback(() => {
    if (!shotInFlightRef.current) {
      return;
    }

    launchQueueRef.current = [];
    ballsRef.current = [];
    finalizeTurn();
  }, [finalizeTurn]);

  const confirmResetGame = useCallback(() => {
    setShowResetConfirm(false);
    if (idleAnimationRef.current !== null) {
      cancelAnimationFrame(idleAnimationRef.current);
      idleAnimationRef.current = null;
    }
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    shotInFlightRef.current = false;
    setShotInProgress(false);
    setIsDragging(false);
    setAimPoint(null);
    launchQueueRef.current = [];
    launchElapsedRef.current = 0;
    ballsRef.current = [];
    bricksRef.current = [];
    breakParticlesRef.current = [];
    brickVisualRef.current.clear();
    pendingRewardsRef.current = { mana: 0, coins: 0 };
    pendingDestroyedBricksRef.current = 0;
    setAutoHomingLaunchPending(false);
    setIsCoreBreachFlashing(false);
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      coinsEarned: 0,
      remainingBricks: 0,
    });

    const resetProfile = defaultProfile();
    profileRef.current = resetProfile;
    setProfile(resetProfile);
    setPendingSync(true);
    setServerUpdatedAt(0);
    setSyncStatus('pending');

    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const resetGame = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  useEffect(() => {
    return () => {
      if (idleAnimationRef.current !== null) {
        cancelAnimationFrame(idleAnimationRef.current);
      }
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startRun = useCallback((startingPowerId: string) => {
    setAutoHomingLaunchPending(false);
    setIsCoreBreachFlashing(false);
    commitProfile((draft) => {
      const startingTemplate = POWER_POOL.find((template) => template.id === startingPowerId);
      if (!startingTemplate) {
        return;
      }
      const seed = Math.floor(Math.random() * 4_000_000_000) >>> 0;
      const upgrades = draft.permanentUpgrades;
      const startingBalls =
        10 +
        (upgrades.startingBalls.enabled ? upgrades.startingBalls.rank * 2 : 0);
      const startingMana =
        upgrades.startingMana.enabled ? upgrades.startingMana.rank * 12 : 0;
      const startingCoins =
        upgrades.startingCoins.enabled ? upgrades.startingCoins.rank * 12 : 0;
      const startingDamage =
        1 + (upgrades.startingDamage.enabled ? upgrades.startingDamage.rank : 0);

      const runState: RogueRunState = {
        seed,
        rngState: seed,
        stage: 'hub',
        level: 1,
        maxLevels: BALANCE.maxLevels,
        boardsCleared: 0,
        nextStoreBoard: 0,
        mana: startingMana,
        coins: startingCoins,
        ballCount: startingBalls,
        damage: startingDamage,
        critChance: 0.04,
        manaMultiplier: 1,
        coinMultiplier: 1,
        powers: {},
        levelGoalBricks: 1,
        levelBricksDestroyed: 0,
        coreCharge: 0,
        homingBarrageReady: false,
        board: { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] },
        pendingPowerOffers: [],
        pendingStoreOffers: [],
        hubMessage: 'Run started. Choose your first climb node.',
        boardShotsTaken: 0,
        boardBounceCount: 0,
        lastBoardSummary: null,
        boardSummaryAcknowledged: true,
        pathCurrentNodeId: '',
        pathNodesByLevel: {},
      };
      const rootPathNode = createRootPathNode(seed);
      runState.pathNodesByLevel[0] = rootPathNode;
      runState.pathCurrentNodeId = rootPathNode.id;
      startingTemplate.apply(runState);
      draft.run = runState;
      draft.lastRunSummary = null;
    }, true);
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      coinsEarned: 0,
      remainingBricks: 0,
    });
    setPreviewStartingPowerId(null);
    setStartingRunPowerChoices([]);
  }, [commitProfile]);

  const requestStartingRunConfirmation = useCallback(
    (startingPowerId: string) => {
      if (profileRef.current?.run || shotInProgress) {
        return;
      }
      setPendingStartingRunPowerId(startingPowerId);
    },
    [shotInProgress]
  );

  const confirmStartingRun = useCallback(() => {
    if (!pendingStartingRunPowerId) {
      return;
    }
    startRun(pendingStartingRunPowerId);
    setPendingStartingRunPowerId(null);
  }, [pendingStartingRunPowerId, startRun]);

  const choosePathNode = useCallback((nodeId: string) => {
    setAutoHomingLaunchPending(false);
    setIsCoreBreachFlashing(false);
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'hub') {
        return;
      }
      if (draft.run.level > draft.run.maxLevels || draft.run.boardSummaryAcknowledged === false) {
        return;
      }
      const runState = draft.run;
      ensureRunPathState(runState);
      const currentNode = getCurrentPathNode(runState);
      const availableChildren = derivePathChildren(runState, currentNode);
      const selectedNode = availableChildren.find((node) => node.id === nodeId);
      if (!selectedNode) {
        runState.hubMessage = 'That path collapsed. Choose another route.';
        return;
      }

      runState.pathNodesByLevel[runState.level] = selectedNode;
      runState.pathCurrentNodeId = selectedNode.id;
      runState.stage = 'board';
      runState.board = generateBoard(runState);
      runState.levelGoalBricks = calculateLevelGoal(runState.board.bricks.length);
      runState.levelBricksDestroyed = 0;
      runState.coreCharge = 0;
      runState.homingBarrageReady = false;
      runState.pendingPowerOffers = [];
      runState.pendingStoreOffers = [];
      const challengeLabel = getPathChallengeDefinition(selectedNode.challenge).label;
      const upcomingStoreLabel = getPathStoreTypeLabel(selectedNode.storeType);
      runState.hubMessage = `Entering board ${runState.level} of ${runState.maxLevels} via ${challengeLabel}.${upcomingStoreLabel ? ` Completing this board opens a ${upcomingStoreLabel.toLowerCase()}.` : ''}`;
      runState.boardShotsTaken = 0;
      runState.boardBounceCount = 0;
      runState.lastBoardSummary = null;
      runState.boardSummaryAcknowledged = true;
    }, true);
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      coinsEarned: 0,
      remainingBricks: 0,
    });
  }, [commitProfile]);

  const acknowledgeBoardSummary = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage === 'board') {
        return;
      }
      draft.run.boardSummaryAcknowledged = true;
    }, true);
  }, [commitProfile]);

  const gambleForPower = useCallback((): GambleOutcome | null => {
    const currentProfile = profileRef.current;
    if (!currentProfile?.run || (currentProfile.run.stage !== 'hub' && currentProfile.run.stage !== 'store')) {
      return null;
    }

    const nextProfile = cloneProfile(currentProfile);
    if (!nextProfile.run || (nextProfile.run.stage !== 'hub' && nextProfile.run.stage !== 'store')) {
      return null;
    }

    const runState = nextProfile.run;
    const gambleCost = BALANCE.gambleBaseCost + Math.floor(runState.level * BALANCE.gambleCostPerLevel);
    let outcome: GambleOutcome;

    if (runState.coins < gambleCost) {
      outcome = {
        tone: 'failure',
        title: 'Gamble Failed',
        message: 'Not enough coins to gamble.',
      };
    } else {
      runState.coins -= gambleCost;
      const roll = nextRandom(runState);

      if (roll >= BALANCE.gambleSuccessChance) {
        if (roll >= BALANCE.gambleBackfireThreshold) {
          runState.ballCount = Math.max(BALANCE.gambleBackfireMinBalls, runState.ballCount - 1);
          runState.damage = Math.max(1, runState.damage - 1);
          runState.mana = Math.max(0, runState.mana - BALANCE.gambleBackfireManaLoss);
          outcome = {
            tone: 'backfire',
            title: 'Backfire',
            message: 'You lost 1 ball, 1 damage, and some mana.',
          };
        } else {
          outcome = {
            tone: 'failure',
            title: 'Gamble Failed',
            message: 'Coins spent. No power gained.',
          };
        }
      } else {
        const template = POWER_POOL[randomInt(runState, 0, POWER_POOL.length - 1)];
        template.apply(runState);
        outcome = {
          tone: 'success',
          title: 'Gamble Success',
          message: `You gained ${template.name}.`,
        };
      }
      completeStoreStop(runState, 'Gamble resolved.');
    }

    nextProfile.updatedAt = Date.now();
    setProfile(nextProfile);
    setPendingSync(true);
    setSyncStatus('pending');
    return outcome;
  }, []);

  const choosePowerUp = useCallback(
    (offerId: string) => {
      commitProfile((draft) => {
        if (!draft.run || draft.run.stage !== 'powerup') {
          return;
        }
        const runState = draft.run;
        const offer = runState.pendingPowerOffers.find((item) => item.id === offerId);
        if (!offer) {
          return;
        }
        if (runState.mana < offer.manaCost) {
          runState.hubMessage = 'Not enough mana for that choice.';
          return;
        }
        const template = POWER_POOL.find((item) => item.id === offer.id);
        if (!template) {
          return;
        }

        runState.mana -= offer.manaCost;
        template.apply(runState);
        runState.pendingPowerOffers = [];
        runState.stage = runState.pendingStoreOffers.length > 0 ? 'store' : 'hub';
        runState.hubMessage = `${template.name} acquired.`;
      }, true);
    },
    [commitProfile]
  );

  useEffect(() => {
    launchShotRef.current = launchShot;
  }, [launchShot]);

  const skipPowerUp = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'powerup') {
        return;
      }
      draft.run.pendingPowerOffers = [];
      draft.run.stage = draft.run.pendingStoreOffers.length > 0 ? 'store' : 'hub';
      draft.run.hubMessage = 'Skipped power-up selection.';
    }, true);
  }, [commitProfile]);

  const buyStoreOffer = useCallback(
    (offerId: string) => {
      commitProfile((draft) => {
        if (!draft.run || (draft.run.stage !== 'store' && draft.run.stage !== 'hub')) {
          return;
        }
        const runState = draft.run;
        const offer = runState.pendingStoreOffers.find((item) => item.id === offerId);
        if (!offer || offer.purchased) {
          return;
        }
        if (runState.coins < offer.coinCost) {
          runState.hubMessage = 'Not enough coins to buy that.';
          return;
        }

        const template = STORE_POOL.find((item) => item.id === offer.id);
        if (!template) {
          return;
        }

        runState.coins -= offer.coinCost;
        template.apply(runState);
        completeStoreStop(runState, `Purchased ${offer.name}.`);
      }, true);
    },
    [commitProfile]
  );

  const leaveStore = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'store') {
        return;
      }
      const runState = draft.run;
      completeStoreStop(runState, 'Left the store.');
    }, true);
  }, [commitProfile]);

  const buyPermanentUpgrade = useCallback(
    (key: PermanentUpgradeKey) => {
      commitProfile((draft) => {
        if (draft.run) {
          return;
        }
        const def = PERMANENT_UPGRADES.find((item) => item.key === key);
        if (!def) {
          return;
        }
        const state = draft.permanentUpgrades[key];
        if (state.rank >= def.maxRank) {
          return;
        }
        const cost = upgradeCost(def, state.rank);
        if (draft.metaCurrency < cost) {
          return;
        }
        draft.metaCurrency -= cost;
        state.rank += 1;
      }, true);
    },
    [commitProfile]
  );

  const togglePermanentUpgrade = useCallback(
    (key: PermanentUpgradeKey) => {
      commitProfile((draft) => {
        if (draft.run) {
          return;
        }
        const current = draft.permanentUpgrades[key];
        if (current.rank === 0) {
          return;
        }
        current.enabled = !current.enabled;
      }, true);
    },
    [commitProfile]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!run || run.stage !== 'board' || shotInProgress) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH;
      const y = ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      setAimPoint({ x, y });
    },
    [run, shotInProgress]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDragging) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH;
      const y = ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT;
      setAimPoint({ x, y });
    },
    [isDragging]
  );

  const clearAim = useCallback(() => {
    setIsDragging(false);
    setAimPoint(null);
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDragging || !aimPoint) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const dx = aimPoint.x - CANVAS_WIDTH / 2;
      const dy = aimPoint.y - LAUNCHER_Y;
      const length = Math.hypot(dx, dy);
      clearAim();

      if (length < 10) {
        return;
      }

      const nx = dx / length;
      const ny = dy / length;
      if (ny >= MIN_LAUNCH_UPWARD_COMPONENT) {
        return;
      }

      launchShot({ x: nx, y: ny });
    },
    [aimPoint, clearAim, isDragging, launchShot]
  );

  const handlePointerCancel = useCallback(() => {
    clearAim();
  }, [clearAim]);

  const handlePowerChipClick = useCallback((powerId: string, chipElement: HTMLButtonElement) => {
    if (selectedPowerId === powerId) {
      setSelectedPowerId(null);
      return;
    }

    const stripRect = powersStripRef.current?.getBoundingClientRect();
    const chipRect = chipElement.getBoundingClientRect();
    if (stripRect) {
      const chipCenter = chipRect.left - stripRect.left + chipRect.width / 2;
      const maxLeft = Math.max(8, stripRect.width - POWER_POPOVER_WIDTH_PX - 8);
      const left = Math.min(maxLeft, Math.max(8, chipCenter - POWER_POPOVER_WIDTH_PX / 2));
      const arrow = Math.min(POWER_POPOVER_WIDTH_PX - 18, Math.max(18, chipCenter - left));
      setPowerPopoverLayout({ left, arrow });
    }
    setSelectedPowerId(powerId);
  }, [selectedPowerId]);

  useEffect(() => {
    if (!run || run.stage === 'board') {
      setSelectedResourceHelp(null);
    }
  }, [run]);

  useEffect(() => {
    if (!run || (run.stage !== 'hub' && run.stage !== 'store')) {
      if (gambleRevealTimeoutRef.current) {
        clearTimeout(gambleRevealTimeoutRef.current);
        gambleRevealTimeoutRef.current = null;
      }
      setShowGambleConfirm(false);
      setIsGambleRevealing(false);
      setGambleOutcome(null);
    }
  }, [run]);

  const hubMessageKey =
    run?.stage === 'hub' && run.hubMessage
      ? `${profile?.updatedAt ?? 0}:${run.hubMessage}`
      : '';
  const hasTransientHubMessage =
    run?.stage === 'hub' &&
    Boolean(run.hubMessage) &&
    (STORE_INTERACTION_MESSAGE_PREFIXES.some((prefix) => run.hubMessage.startsWith(prefix)) ||
      run.hubMessage.endsWith(RUN_POWERUP_MESSAGE_SUFFIX));
  const isPurchasedStoreHubMessage =
    run?.stage === 'hub' &&
    Boolean(run.hubMessage) &&
    run.hubMessage.startsWith('Purchased ');
  const purchasedStoreOffer =
    isPurchasedStoreHubMessage && run?.hubMessage
      ? STORE_POOL.find((offer) => run.hubMessage === `Purchased ${offer.name}.`) ?? null
      : null;
  const purchasedStoreIcon = purchasedStoreOffer
    ? POWER_BACKDROP_ICONS[purchasedStoreOffer.id] ?? '◌'
    : '◌';

  useEffect(() => {
    if (!hasTransientHubMessage || !hubMessageKey) {
      setHiddenHubMessageKey(null);
      return;
    }

    setHiddenHubMessageKey(null);
    const hideTimer = window.setTimeout(() => {
      setHiddenHubMessageKey(hubMessageKey);
    }, 4400);

    return () => window.clearTimeout(hideTimer);
  }, [hasTransientHubMessage, hubMessageKey]);

  useEffect(
    () => () => {
      if (gambleRevealTimeoutRef.current) {
        clearTimeout(gambleRevealTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (
      !selectedPowerId &&
      !selectedResourceHelp &&
      !showGambleConfirm &&
      !isGambleRevealing &&
      !gambleOutcome &&
      !pendingStartingRunPowerId
    ) {
      return;
    }

    const handleGlobalPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest('[data-popover-surface="true"]')) {
        return;
      }
      if (isGambleRevealing) {
        return;
      }
      if (gambleOutcome) {
        return;
      }
      setSelectedPowerId(null);
      setSelectedResourceHelp(null);
      setShowGambleConfirm(false);
      setPendingStartingRunPowerId(null);
    };

    document.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
  }, [selectedPowerId, selectedResourceHelp, showGambleConfirm, isGambleRevealing, gambleOutcome, pendingStartingRunPowerId]);

  const syncLabel = useMemo(() => {
    if (!isOnline) {
      return 'Offline (local progress only)';
    }
    if (syncStatus === 'syncing') {
      return 'Syncing progress...';
    }
    if (pendingSync) {
      return 'Pending cloud sync';
    }
    if (syncStatus === 'synced') {
      return 'Synced';
    }
    return 'Idle';
  }, [isOnline, pendingSync, syncStatus]);

  const gambleCoinCost = run
    ? BALANCE.gambleBaseCost + Math.floor(run.level * BALANCE.gambleCostPerLevel)
    : BALANCE.gambleBaseCost;
  const canAffordGamble = (run?.coins ?? 0) >= gambleCoinCost;
  const startGambleReveal = useCallback(() => {
    if (isGambleRevealing || !canAffordGamble) {
      return;
    }
    setShowGambleConfirm(false);
    setGambleOutcome(null);
    setIsGambleRevealing(true);
    if (gambleRevealTimeoutRef.current) {
      clearTimeout(gambleRevealTimeoutRef.current);
    }
    gambleRevealTimeoutRef.current = setTimeout(() => {
      gambleRevealTimeoutRef.current = null;
      setIsGambleRevealing(false);
      const outcome = gambleForPower();
      if (outcome) {
        setGambleOutcome(outcome);
      }
    }, 900);
  }, [canAffordGamble, gambleForPower, isGambleRevealing]);

  if (isLoading || !profile) {
    return <div className="loading">Loading hidden module...</div>;
  }

  const hasActiveRun = !!profile.run;
  const lastRunSummary = profile.lastRunSummary;
  const shouldShowDefeatNotification = Boolean(
    !hasActiveRun &&
    lastRunSummary &&
    !lastRunSummary.victory &&
    dismissedDefeatSummaryCompletedAt !== lastRunSummary.completedAt
  );
  const shouldShowStartingRunSelection = !hasActiveRun && !shouldShowDefeatNotification;
  const canSelectStartingRunPower = !profile.run && !shotInProgress;
  const startingRunPowerChoiceTemplates = startingRunPowerChoices
    .map((id) => POWER_POOL.find((template) => template.id === id) ?? null)
    .filter((template): template is RuntimePowerTemplate => Boolean(template));
  const pendingStartingRunPowerTemplate = pendingStartingRunPowerId
    ? POWER_POOL.find((template) => template.id === pendingStartingRunPowerId) ?? null
    : null;
  const previewStartingRunPowerTemplate = previewStartingPowerId
    ? POWER_POOL.find((template) => template.id === previewStartingPowerId) ?? null
    : null;
  const highlightedPowerChipId = previewStartingPowerId ? `run-${previewStartingPowerId}` : null;
  const runProgressPct = run
    ? Math.round((Math.max(0, run.level - 1) / Math.max(1, run.maxLevels)) * 100)
    : 0;
  const boardBricksRemaining = run?.board.bricks.length ?? 0;
  const displayBricksRemaining =
    shotInProgress && hasActiveRun ? liveHud.remainingBricks : boardBricksRemaining;
  const activeBoardBricks = shotInProgress && hasActiveRun ? bricksRef.current : (run?.board.bricks ?? []);
  const objectiveBrickIds = run ? getObjectiveBrickIds(run.board) : [];
  const objectiveBricks = objectiveBrickIds
    .map((id) => activeBoardBricks.find((brick) => brick.id === id) ?? null)
    .filter((brick): brick is Brick => Boolean(brick));
  const objectiveCount = objectiveBricks.length;
  const coreChargeProgress = objectiveBricks.length
    ? Math.max(
        ...objectiveBricks.map((brick) => Math.max(0, Math.min(1, 1 - brick.hp / Math.max(1, brick.maxHp))))
      )
    : hasActiveRun
      ? run?.coreCharge ?? 1
      : 0;
  const barrageReady = Boolean(run?.homingBarrageReady);
  const powerShotBonusPct = Math.round(coreChargeProgress * 140);
  const objectiveStatusLabel = objectiveBricks.length
    ? `${objectiveCount > 1 ? `${objectiveCount} cores active | ` : ''}${
        objectiveBricks
          .map((brick) => getCoreVariantLabel(brick.coreVariant))
          .join(' • ')
      } | Power Shot +${powerShotBonusPct}%`
    : hasActiveRun
      ? `Core drained | Power Shot +${powerShotBonusPct}%${barrageReady ? ' | Barrage ready' : ''}`
      : 'No active core';
  const coreProgressSlots = CORE_VARIANTS.map((variant) => {
    const variantBricks = objectiveBricks.filter((brick) => (brick.coreVariant ?? 'yellow') === variant);
    const progressPct = variantBricks.length
      ? Math.round(
          Math.max(
            ...variantBricks.map((brick) => Math.max(0, Math.min(1, 1 - brick.hp / Math.max(1, brick.maxHp))))
          ) * 100
        )
      : 0;
    return {
      variant,
      progressPct,
      hasCore: variantBricks.length > 0,
    };
  });
  const boardHpRemaining = run
    ? Math.round(run.board.bricks.reduce((sum, brick) => sum + Math.max(0, brick.hp), 0))
    : 0;
  const displayMana = hasActiveRun ? Math.floor((run?.mana ?? 0) + liveHud.manaEarned) : 0;
  const displayCoins = hasActiveRun ? Math.floor((run?.coins ?? 0) + liveHud.coinsEarned) : 0;
  const displayDestroyedBricks = (run?.levelBricksDestroyed ?? 0) + liveHud.destroyedBricks;
  const displayClimbProgressPct = run
    ? Math.min(
        100,
        Math.round((displayDestroyedBricks / Math.max(1, run.levelGoalBricks ?? 1)) * 100)
      )
    : 0;
  const overallScore = calculateOverallScore(run, liveHud);
  const overallProgressPct = calculateOverallProgress(run, liveHud);
  const showBoardOverlay = !hasActiveRun || run?.stage !== 'board';
  const isBetweenLevelHub = run?.stage === 'hub';
  const permanentPowerIndicators: ActivePowerIndicator[] = PERMANENT_UPGRADES.map((upgrade) => {
    const state = profile.permanentUpgrades[upgrade.key];
    return {
      id: `perm-${upgrade.key}`,
      name: upgrade.name,
      description: upgrade.description,
      category: 'permanent',
      currentLevel: state.rank,
      barSlots: upgrade.maxRank,
      baseColor: POWER_BASE_COLORS[upgrade.key] ?? '#22d3ee',
      backdropIcon: POWER_BACKDROP_ICONS[upgrade.key] ?? '◌',
      levelLabel: `L${state.rank}`,
      statusLabel: state.rank > 0 ? (state.enabled ? 'Enabled' : 'Owned') : 'Not owned',
      maxLevelLabel: `L${upgrade.maxRank}`,
    };
  });
  const runPowerTemplates = [...POWER_POOL, ...STORE_POOL];
  const runPowerIndicators: ActivePowerIndicator[] = runPowerTemplates
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((template) => {
      const rank = run?.powers?.[template.id] ?? 0;
      return {
        id: `run-${template.id}`,
        name: template.name,
        description: template.description,
        category: 'run',
        currentLevel: rank,
        barSlots: 5,
        baseColor: POWER_BASE_COLORS[template.id] ?? '#60a5fa',
        backdropIcon: POWER_BACKDROP_ICONS[template.id] ?? '◌',
        levelLabel: `x${rank}`,
        statusLabel: rank > 0 ? 'Purchased' : 'Not purchased',
        maxLevelLabel: 'Uncapped',
      };
    });
  const activePowerIndicators = [...permanentPowerIndicators, ...runPowerIndicators];
  const selectedPower =
    activePowerIndicators.find((power) => power.id === selectedPowerId) ?? null;
  const powerPopoverStyle = {
    '--power-popover-left': `${powerPopoverLayout.left}px`,
    '--power-popover-arrow': `${powerPopoverLayout.arrow}px`,
  } as CSSProperties;
  const boardSummary = run?.lastBoardSummary ?? null;
  const shouldGateBoardChoices =
    run?.stage !== 'board' &&
    Boolean(boardSummary) &&
    run?.boardSummaryAcknowledged === false;
  const shouldShowStoreGamble = Boolean(
    run &&
    !shouldGateBoardChoices &&
    (run.stage === 'hub' || run.stage === 'store')
  );
  const pathPreview = run ? buildPathPreview(run, shouldGateBoardChoices) : null;
  const pathNodePositions: Record<string, { x: number; y: number }> = {};
  if (pathPreview) {
    const laneSpan = Math.max(1, pathPreview.maxLane - pathPreview.minLane);
    const levelSpan = Math.max(1, pathPreview.endLevel - pathPreview.startLevel);
    const pathLeftPct = 16;
    const pathWidthPct = 80;
    const pathTopPct = 4;
    const pathHeightPct = 92;
    for (const node of pathPreview.nodes) {
      const xPct = pathLeftPct + ((node.lane - pathPreview.minLane) / laneSpan) * pathWidthPct;
      const yPct = pathTopPct + ((pathPreview.endLevel - node.level) / levelSpan) * pathHeightPct;
      pathNodePositions[node.id] = { x: xPct, y: yPct };
    }
  }
  const pathLevelMarkers = pathPreview
    ? Array.from({ length: pathPreview.endLevel - pathPreview.startLevel + 1 }, (_, index) => {
        const level = pathPreview.endLevel - index;
        const levelSpan = Math.max(1, pathPreview.endLevel - pathPreview.startLevel);
        const yPct = 4 + ((pathPreview.endLevel - level) / levelSpan) * 92;
        return { level, yPct };
      })
    : [];
  const renderOfferCost = (
    amount: number,
    currency: 'mana' | 'coins',
    purchased = false,
  ) => {
    if (purchased) {
      return <span className="rogue-store-offer-cost-text">Purchased</span>;
    }

    const currencyIconClass =
      currency === 'mana'
        ? 'rogue-overlay-resource-icon-mana'
        : 'rogue-overlay-resource-icon-coins';

    return (
      <span className="rogue-store-offer-cost-text">
        <span
          className={`rogue-store-offer-currency-icon rogue-overlay-resource-icon ${currencyIconClass}`}
          aria-hidden="true"
        />
        <strong>{amount}</strong>
      </span>
    );
  };
  const renderStoreOfferCard = (offer: StoreOffer) => {
    const currentLevel = run?.powers?.[offer.id] ?? 0;
    const nextLevel = currentLevel + 1;
    const startsNewStack = currentLevel === 0;
    const previewSlots = 5;
    const currentActive = Math.min(currentLevel, previewSlots);
    const nextActive = Math.min(nextLevel, previewSlots);
    const baseColor = POWER_BASE_COLORS[offer.id] ?? '#60a5fa';
    const backdropIcon = POWER_BACKDROP_ICONS[offer.id] ?? '◌';

    return (
      <button
        type="button"
        key={offer.id}
        className="rogue-choice-card rogue-store-offer-card"
        onClick={() => buyStoreOffer(offer.id)}
        disabled={offer.purchased}
        style={{ '--power-base-color': baseColor } as CSSProperties}
      >
        <span className="rogue-store-offer-corner-icon" aria-hidden="true">{backdropIcon}</span>
        <div className="rogue-store-offer-segment rogue-store-offer-segment-top">
          <div className="rogue-store-offer-title">
            <strong>{offer.name}</strong>
          </div>
        </div>
        <div className="rogue-store-offer-segment rogue-store-offer-segment-middle">
          <span>{offer.description}</span>
          <div className="rogue-store-offer-preview">
            <span className="rogue-store-offer-preview-label">
              {startsNewStack ? 'Starts new stack' : 'Adds to existing stack'}
            </span>
            <div className="rogue-store-offer-bars" aria-hidden="true">
              <span
                className="rogue-active-power-chip rogue-store-power-chip"
                style={{ '--power-base-color': baseColor } as CSSProperties}
              >
                <span className="rogue-active-power-backdrop">{backdropIcon}</span>
                <span className="rogue-active-power-stack">
                  {Array.from({ length: previewSlots }, (_, index) => (
                    <span
                      key={`${offer.id}-current-${index}`}
                      className={`rogue-active-power-segment${index < currentActive ? ' is-active' : ''}`}
                    />
                  ))}
                </span>
              </span>
              <span className="rogue-store-power-arrow">→</span>
              <span
                className="rogue-active-power-chip rogue-store-power-chip is-after"
                style={{ '--power-base-color': baseColor } as CSSProperties}
              >
                <span className="rogue-active-power-backdrop">{backdropIcon}</span>
                <span className="rogue-active-power-stack">
                  {Array.from({ length: previewSlots }, (_, index) => (
                    <span
                      key={`${offer.id}-next-${index}`}
                      className={`rogue-active-power-segment${index < nextActive ? ' is-active' : ''}`}
                    />
                  ))}
                </span>
              </span>
            </div>
            <span className="rogue-store-offer-levels">
              Current x{currentLevel} → New x{nextLevel}
            </span>
          </div>
        </div>
        <div className="rogue-store-offer-segment rogue-store-offer-segment-bottom">
          {renderOfferCost(offer.coinCost, 'coins', offer.purchased)}
        </div>
      </button>
    );
  };

  const powerStripElement = (
    <section
      ref={powersStripRef}
      className={`rogue-active-powers-strip${isPowerDrawerExpanded ? ' is-expanded' : ' is-collapsed'}${isFocusMode ? ' is-focus-drawer' : ''}`}
      aria-label="Owned and active powers"
    >
      <button
        type="button"
        className="rogue-active-powers-tab"
        onClick={() => setIsPowerDrawerExpanded((expanded) => !expanded)}
        aria-label={isPowerDrawerExpanded ? 'Collapse powers drawer' : 'Expand powers drawer'}
      >
        <span className="rogue-active-powers-tab-handle" aria-hidden="true" />
      </button>
      <div className="rogue-active-powers-header">
        <span>Powers</span>
        {!hasActiveRun && previewStartingRunPowerTemplate && (
          <span className="rogue-active-powers-preview" aria-live="polite">
            <span className="rogue-active-powers-preview-icon" aria-hidden="true">
              {POWER_BACKDROP_ICONS[previewStartingRunPowerTemplate.id] ?? '◌'}
            </span>
            <span>{previewStartingRunPowerTemplate.name}</span>
          </span>
        )}
      </div>
      <div className="rogue-active-powers-row">
        {activePowerIndicators.length > 0 ? (
          <div className="rogue-active-powers-grid" role="list">
            {activePowerIndicators.map((power) => (
              <button
                type="button"
                key={power.id}
                className={`rogue-active-power-chip is-${power.category}${selectedPowerId === power.id ? ' is-selected' : ''}${highlightedPowerChipId === power.id ? ' is-linked-highlight' : ''}`}
                title={power.name}
                aria-label={`${power.name}: ${power.statusLabel}`}
                onClick={(event) => handlePowerChipClick(power.id, event.currentTarget)}
                style={{ '--power-base-color': power.baseColor } as CSSProperties}
                data-popover-surface="true"
              >
                <span className="rogue-active-power-backdrop" aria-hidden="true">
                  {power.backdropIcon}
                </span>
                <span className="rogue-active-power-stack" aria-hidden="true">
                  {Array.from({ length: power.barSlots }, (_, index) => {
                    const activeThreshold = Math.min(power.currentLevel, power.barSlots);
                    const isActive = index < activeThreshold;
                    return (
                      <span
                        key={`${power.id}-${index}`}
                        className={`rogue-active-power-segment${isActive ? ' is-active' : ''}`}
                      />
                    );
                  })}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rogue-active-powers-empty">No upgrades or powers owned yet.</p>
        )}
        <button
          type="button"
          className="btn-secondary rogue-active-powers-reclaim"
          onClick={reclaimShot}
          disabled={!shotInProgress || run?.stage !== 'board'}
          aria-label="Reclaim balls"
          title="Reclaim balls"
        >
          ⇊
        </button>
      </div>
      {isFocusMode && isPowerDrawerExpanded && (
        <button type="button" className="btn-secondary rogue-active-powers-reset" onClick={resetGame}>
          Reset Game (Abandon Run)
        </button>
      )}
      {selectedPower && (
        <section
          className="rogue-active-power-hover-card"
          style={powerPopoverStyle}
          role="dialog"
          aria-label={`${selectedPower.name} details`}
          data-popover-surface="true"
        >
          <div className="rogue-active-power-detail-head">
            <strong>{selectedPower.name}</strong>
            <button
              type="button"
              className="btn-text"
              onClick={() => setSelectedPowerId(null)}
            >
              Close
            </button>
          </div>
          <p>{selectedPower.description}</p>
          <div className="rogue-active-power-detail-stats">
            <span>Status: {selectedPower.statusLabel}</span>
            <span>Current: {selectedPower.levelLabel}</span>
            <span>Max: {selectedPower.maxLevelLabel}</span>
          </div>
        </section>
      )}
    </section>
  );
  const boardSummaryModalElement = (() => {
    if (!shouldGateBoardChoices || !boardSummary) {
      return null;
    }
    return (
      <div className="rogue-board-summary-modal-backdrop">
        <section
          className="rogue-board-summary rogue-board-summary-modal"
          aria-label="Board summary"
          role="dialog"
          aria-modal="true"
        >
          <div className="rogue-board-summary-stats">
            <div className="rogue-board-summary-stat">
              <span className="rogue-board-summary-stat-icon rogue-board-summary-stat-icon-shots" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                  <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                  <path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
              <div className="rogue-board-summary-stat-copy">
                <span>Shots Taken</span>
                <strong>{boardSummary.shotsTaken}</strong>
              </div>
            </div>
            <div className="rogue-board-summary-stat">
              <span className="rogue-board-summary-stat-icon rogue-board-summary-stat-icon-bounces" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                  <path d="M2 10.6c1.6-1.2 3.3-1.2 4.9 0s3.3 1.2 4.9 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="3.2" cy="6" r="1.1" fill="currentColor" />
                  <circle cx="8" cy="4.4" r="1.1" fill="currentColor" opacity="0.82" />
                  <circle cx="12.8" cy="6" r="1.1" fill="currentColor" opacity="0.64" />
                </svg>
              </span>
              <div className="rogue-board-summary-stat-copy">
                <span>Bounce Count</span>
                <strong>{boardSummary.bounceCount}</strong>
              </div>
            </div>
          </div>
          {boardSummary.achievements.length > 0 && (
            <div className="rogue-board-summary-achievements">
              {boardSummary.achievements.map((achievement) => (
                <span key={achievement}>{achievement}</span>
              ))}
            </div>
          )}
          <button type="button" className="btn-text rogue-board-summary-dismiss" onClick={acknowledgeBoardSummary}>
            Continue
          </button>
        </section>
      </div>
    );
  })();
  const boardSummaryModalLayer =
    boardSummaryModalElement && typeof document !== 'undefined'
      ? createPortal(boardSummaryModalElement, document.body)
      : boardSummaryModalElement;

  return (
    <div className="rogue-brick-page">
      <header className="rogue-brick-header">
        <div>
          <h1>Rogue Brick Vault</h1>
          <p className="rogue-brick-subtitle">
            Hidden mode: rogue-like brick breaker. Drag to aim and release to fire.
          </p>
        </div>
        <div className="rogue-brick-header-actions">
          <div className="rogue-brick-sync-status">{syncLabel}</div>
          <button type="button" className="btn-secondary" onClick={() => setIsFocusMode(true)}>
            Lock In Full Screen
          </button>
        </div>
      </header>

      <section className={`rogue-brick-layout-shell${isFocusMode ? ' is-focus-mode' : ''}`}>
        <div className="rogue-brick-top-hud" aria-label="Current score and progress">
          <div className="rogue-brick-top-hud-row">
            <span className="rogue-brick-top-hud-label">Overall Score</span>
            <div className="rogue-brick-top-hud-score-group">
              <strong className="rogue-brick-top-hud-score">{overallScore.toLocaleString()}</strong>
              {isFocusMode && (
                <button
                  type="button"
                  className="rogue-brick-focus-exit"
                  onClick={() => setIsFocusMode(false)}
                  aria-label="Exit lock mode"
                  title="Exit lock mode"
                >
                  <svg
                    className="rogue-brick-focus-exit-icon"
                    viewBox="0 0 24 24"
                    role="img"
                    aria-hidden="true"
                  >
                    <path d="M4 3.5h8.5v17H4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M9.1 12h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path
                      d="M16.5 7.6l1.35 2.1m-1.35-2.1L14.7 9m2.8.85-.95 3.05m.95-3.05 1.9 1.45m-2.85 1.6L14 14.85m2.55-1.95 2.35 1.55m-4.9.4L12.45 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="rogue-brick-top-hud-row">
            <span className="rogue-brick-top-hud-label">
              Progress {overallProgressPct}%
              {hasActiveRun ? ` - Level ${run?.level}/${run?.maxLevels}` : ''}
            </span>
          </div>
          <div
            className="rogue-progress-track rogue-progress-track-compact"
            role="progressbar"
            aria-label="Overall run progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgressPct}
          >
            <div className="rogue-progress-fill" style={{ width: `${overallProgressPct}%` }} />
          </div>
        </div>

        <div className={`rogue-brick-layout${isFocusMode ? ' is-focus-mode' : ''}`}>
          <div className={`rogue-brick-canvas-wrap${isPowerDrawerExpanded ? ' is-power-drawer-expanded' : ''}`}>
            <div className={`rogue-brick-board-frame${isBetweenLevelHub ? ' is-between-level' : ''}`}>
              {hasActiveRun && run?.stage === 'board' && (
                <div className="rogue-core-progress-board" aria-label="Core progress (Yellow left, Blue middle, Green right)">
                  {coreProgressSlots.map((slot) => {
                    const variantColor = getCoreVariantColor(slot.variant);
                    return (
                      <span
                        key={slot.variant}
                        className={`rogue-core-progress-ring${slot.hasCore ? '' : ' is-inactive'}`}
                        style={{
                          background: `conic-gradient(${variantColor} ${slot.progressPct * 3.6}deg, rgb(51 65 85 / 0.9) 0deg)`,
                        }}
                        aria-label={`${getCoreVariantLabel(slot.variant)} ${slot.progressPct}% complete`}
                      >
                        <span className="rogue-core-progress-ring-value">{slot.progressPct}%</span>
                      </span>
                    );
                  })}
                </div>
              )}
              {showBoardOverlay && (
                <div className="rogue-board-overlay">
                  <section
                    className={`rogue-board-overlay-content${isBetweenLevelHub ? ' is-between-level' : ''}`}
                  >
                    {hasActiveRun && run?.stage !== 'board' && (
                      <div className="rogue-overlay-resources" aria-label="Current run resources">
                        <div className="rogue-overlay-resource-wrap">
                          <button
                            type="button"
                            className="rogue-overlay-resource rogue-overlay-resource-button"
                            onClick={() => setSelectedResourceHelp(selectedResourceHelp === 'mana' ? null : 'mana')}
                            aria-label={`Mana ${displayMana}. Show details`}
                            title={`Mana ${displayMana}`}
                            data-popover-surface="true"
                          >
                            <span className="rogue-overlay-resource-icon rogue-overlay-resource-icon-mana" aria-hidden="true" />
                            <strong>{displayMana}</strong>
                          </button>
                          {selectedResourceHelp === 'mana' && (
                            <section
                              className="rogue-overlay-resource-popover"
                              role="dialog"
                              aria-label="Mana details"
                              data-popover-surface="true"
                            >
                              <div className="rogue-overlay-resource-popover-head">
                                <strong>Mana</strong>
                                <button type="button" className="btn-text" onClick={() => setSelectedResourceHelp(null)}>
                                  Close
                                </button>
                              </div>
                              <p>Mana is spent on between-board power-up choices to improve your current run.</p>
                            </section>
                          )}
                        </div>
                        <div className="rogue-overlay-resource-wrap">
                          <button
                            type="button"
                            className="rogue-overlay-resource rogue-overlay-resource-button"
                            onClick={() => setSelectedResourceHelp(selectedResourceHelp === 'coins' ? null : 'coins')}
                            aria-label={`Coins ${displayCoins}. Show details`}
                            title={`Coins ${displayCoins}`}
                            data-popover-surface="true"
                          >
                            <span className="rogue-overlay-resource-icon rogue-overlay-resource-icon-coins" aria-hidden="true" />
                            <strong>{displayCoins}</strong>
                          </button>
                          {selectedResourceHelp === 'coins' && (
                            <section
                              className="rogue-overlay-resource-popover"
                              role="dialog"
                              aria-label="Coin details"
                              data-popover-surface="true"
                            >
                              <div className="rogue-overlay-resource-popover-head">
                                <strong>Coins</strong>
                                <button type="button" className="btn-text" onClick={() => setSelectedResourceHelp(null)}>
                                  Close
                                </button>
                              </div>
                              <p>Coins are used for gambling in hub and for purchases when the store caravan appears.</p>
                            </section>
                          )}
                        </div>
                      </div>
                    )}

                    {shouldShowStartingRunSelection && (
                      <>
                        <h2 className="rogue-starting-run-title">Lexor&apos;s Gift</h2>
                        <div className="rogue-choice-grid rogue-choice-grid-store">
                          {startingRunPowerChoiceTemplates.map((offer) => {
                            const backdropIcon = POWER_BACKDROP_ICONS[offer.id] ?? '◌';
                            const baseColor = POWER_BASE_COLORS[offer.id] ?? '#60a5fa';
                            const currentLevel = 0;
                            return (
                              <button
                                type="button"
                                key={`start-power-${offer.id}`}
                                className="rogue-choice-card rogue-store-offer-card"
                                onClick={() => requestStartingRunConfirmation(offer.id)}
                                onMouseEnter={() => {
                                  setPreviewStartingPowerId(offer.id);
                                }}
                                onMouseLeave={() => setPreviewStartingPowerId((current) => (current === offer.id ? null : current))}
                                onFocus={() => {
                                  setPreviewStartingPowerId(offer.id);
                                }}
                                onBlur={() => setPreviewStartingPowerId((current) => (current === offer.id ? null : current))}
                                disabled={!canSelectStartingRunPower}
                                style={{ '--power-base-color': baseColor } as CSSProperties}
                              >
                                <span className="rogue-store-offer-corner-icon" aria-hidden="true">{backdropIcon}</span>
                                <div className="rogue-store-offer-segment rogue-store-offer-segment-top">
                                  <div className="rogue-store-offer-title">
                                    <strong>{offer.name}</strong>
                                  </div>
                                </div>
                                <div className="rogue-store-offer-segment rogue-store-offer-segment-middle">
                                  <span>{offer.description}</span>
                                </div>
                                <div className="rogue-store-offer-segment rogue-store-offer-segment-bottom">
                                  <span className="rogue-store-offer-levels">Current level: x{currentLevel}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {shouldShowStartingRunSelection && pendingStartingRunPowerTemplate && (
                      <div
                        className="rogue-gamble-modal-backdrop"
                        role="presentation"
                        onClick={() => setPendingStartingRunPowerId(null)}
                      >
                        <section
                          className="rogue-gamble-modal"
                          role="dialog"
                          aria-label="Confirm starting run power-up"
                          data-popover-surface="true"
                        >
                          <p className="rogue-starting-run-confirm-copy">
                            Start your run with <strong>{pendingStartingRunPowerTemplate.name}</strong>?
                          </p>
                          <div className="rogue-gamble-modal-actions">
                            <button
                              type="button"
                              className="rogue-starting-run-confirm-action is-accept"
                              onClick={confirmStartingRun}
                            >
                              Start run
                            </button>
                            <button
                              type="button"
                              className="rogue-starting-run-confirm-action is-cancel"
                              onClick={() => setPendingStartingRunPowerId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </section>
                      </div>
                    )}

                    {run?.stage === 'hub' && !shouldGateBoardChoices && pathPreview && (
                      <>
                        <div className="rogue-path-tree-panel" aria-label="Level climb path selector">
                          <div className="rogue-path-tree-heading">
                            <strong>Choose your next climb node</strong>
                          </div>
                          <div className="rogue-path-tree-graph">
                            <div className="rogue-path-tree-level-rail" aria-hidden="true">
                              {pathLevelMarkers.map((marker) => (
                                <div
                                  key={`path-level-${marker.level}`}
                                  className="rogue-path-tree-level-marker"
                                  style={{ top: `${marker.yPct}%` }}
                                >
                                  <span>L{marker.level}</span>
                                </div>
                              ))}
                            </div>
                            <svg className="rogue-path-tree-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                              {pathPreview.edges.map((edge) => {
                                const from = pathNodePositions[edge.fromId];
                                const to = pathNodePositions[edge.toId];
                                if (!from || !to) {
                                  return null;
                                }
                                return (
                                  <line
                                    key={`${edge.fromId}-${edge.toId}`}
                                    x1={from.x}
                                    y1={from.y}
                                    x2={to.x}
                                    y2={to.y}
                                    className="rogue-path-tree-line"
                                  />
                                );
                              })}
                            </svg>
                            {pathPreview.nodes.map((node) => {
                              const position = pathNodePositions[node.id];
                              if (!position) {
                                return null;
                              }
                              const challenge = getPathChallengeDefinition(node.challenge);
                              const storeLabel = getPathStoreTypeLabel(node.storeType);
                              const challengeTitle = `${challenge.label}${storeLabel ? ` + ${storeLabel}` : ''} - ${challenge.description}`;
                              const nodeClassName = [
                                'rogue-path-tree-node',
                                `is-${node.relation}`,
                                node.storeType ? `is-store-${node.storeType}` : '',
                                node.isSelected ? 'is-selected' : '',
                                node.isPlayable ? 'is-playable' : '',
                              ]
                                .filter(Boolean)
                                .join(' ');
                              const style = {
                                left: `${position.x}%`,
                                top: `${position.y}%`,
                              };

                              if (node.isPlayable) {
                                return (
                                  <button
                                    type="button"
                                    key={node.id}
                                    className={nodeClassName}
                                    style={style}
                                    onClick={() => choosePathNode(node.id)}
                                    aria-label={`Choose level ${node.level} node (${challenge.label}${storeLabel ? `, ${storeLabel}` : ''})`}
                                    title={challengeTitle}
                                  />
                                );
                              }

                              return (
                                <div
                                  key={node.id}
                                  className={nodeClassName}
                                  style={style}
                                  title={challengeTitle}
                                />
                              );
                            })}
                          </div>
                        </div>
                        {run.hubMessage &&
                          hubMessageKey !== hiddenHubMessageKey &&
                          isPurchasedStoreHubMessage && (
                          <div className="rogue-store-purchase-toast is-transient" role="status" aria-live="polite">
                            <span className="rogue-store-purchase-toast-icon" aria-hidden="true">{purchasedStoreIcon}</span>
                            <span>{run.hubMessage}</span>
                          </div>
                        )}
                      </>
                    )}

                    {run?.stage === 'powerup' && !shouldGateBoardChoices && (
                      <>
                        <h2>Choose a Power-Up (Mana)</h2>
                        <div className="rogue-choice-grid rogue-choice-grid-store">
                          {run.pendingPowerOffers.map((offer) => (
                            (() => {
                              const currentLevel = run?.powers?.[offer.id] ?? 0;
                              const nextLevel = currentLevel + 1;
                              const startsNewStack = currentLevel === 0;
                              const previewSlots = 5;
                              const currentActive = Math.min(currentLevel, previewSlots);
                              const nextActive = Math.min(nextLevel, previewSlots);
                              const baseColor = POWER_BASE_COLORS[offer.id] ?? '#60a5fa';
                              const backdropIcon = POWER_BACKDROP_ICONS[offer.id] ?? '◌';

                              return (
                                <button
                                  type="button"
                                  key={offer.id}
                                  className="rogue-choice-card rogue-store-offer-card"
                                  onClick={() => choosePowerUp(offer.id)}
                                  style={{ '--power-base-color': baseColor } as CSSProperties}
                                >
                                  <span className="rogue-store-offer-corner-icon" aria-hidden="true">{backdropIcon}</span>
                                  <div className="rogue-store-offer-segment rogue-store-offer-segment-top">
                                    <div className="rogue-store-offer-title">
                                      <strong>{offer.name}</strong>
                                    </div>
                                  </div>
                                  <div className="rogue-store-offer-segment rogue-store-offer-segment-middle">
                                    <span>{offer.description}</span>
                                    <div className="rogue-store-offer-preview">
                                      <span className="rogue-store-offer-preview-label">
                                        {startsNewStack ? 'Starts new stack' : 'Adds to existing stack'}
                                      </span>
                                      <div className="rogue-store-offer-bars" aria-hidden="true">
                                        <span
                                          className="rogue-active-power-chip rogue-store-power-chip"
                                          style={{ '--power-base-color': baseColor } as CSSProperties}
                                        >
                                          <span className="rogue-active-power-backdrop">{backdropIcon}</span>
                                          <span className="rogue-active-power-stack">
                                            {Array.from({ length: previewSlots }, (_, index) => (
                                              <span
                                                key={`${offer.id}-power-current-${index}`}
                                                className={`rogue-active-power-segment${index < currentActive ? ' is-active' : ''}`}
                                              />
                                            ))}
                                          </span>
                                        </span>
                                        <span className="rogue-store-power-arrow">→</span>
                                        <span
                                          className="rogue-active-power-chip rogue-store-power-chip is-after"
                                          style={{ '--power-base-color': baseColor } as CSSProperties}
                                        >
                                          <span className="rogue-active-power-backdrop">{backdropIcon}</span>
                                          <span className="rogue-active-power-stack">
                                            {Array.from({ length: previewSlots }, (_, index) => (
                                              <span
                                                key={`${offer.id}-power-next-${index}`}
                                                className={`rogue-active-power-segment${index < nextActive ? ' is-active' : ''}`}
                                              />
                                            ))}
                                          </span>
                                        </span>
                                      </div>
                                      <span className="rogue-store-offer-levels">
                                        Current x{currentLevel} → New x{nextLevel}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="rogue-store-offer-segment rogue-store-offer-segment-bottom">
                                    {renderOfferCost(offer.manaCost, 'mana')}
                                  </div>
                                </button>
                              );
                            })()
                          ))}
                        </div>
                        <button type="button" className="btn-text" onClick={skipPowerUp}>
                          Skip choice
                        </button>
                      </>
                    )}

                    {run?.stage === 'hub' && !shouldGateBoardChoices && run.pendingStoreOffers.length > 0 && (
                      <>
                        <h2>Money Store</h2>
                        <div className="rogue-choice-grid rogue-choice-grid-store">
                          {run.pendingStoreOffers.map((offer) => renderStoreOfferCard(offer))}
                          <button
                            type="button"
                            className="rogue-choice-card rogue-store-gamble-card"
                            onClick={() => {
                              if (!isGambleRevealing && !gambleOutcome) {
                                setShowGambleConfirm((prev) => !prev);
                              }
                            }}
                            disabled={isGambleRevealing || Boolean(gambleOutcome)}
                            data-popover-surface="true"
                          >
                            <strong>Gamble</strong>
                            <span>Take a chance for a random power-up.</span>
                            <span className="rogue-store-gamble-dice" aria-hidden="true">🎲</span>
                            <span>{`Cost: ${gambleCoinCost} coin${gambleCoinCost === 1 ? '' : 's'}`}</span>
                          </button>
                        </div>
                      </>
                    )}

                    {run?.stage === 'store' && !shouldGateBoardChoices && (
                      <>
                        <h2>Money Store</h2>
                        <div className="rogue-choice-grid rogue-choice-grid-store">
                          {run.pendingStoreOffers.map((offer) => renderStoreOfferCard(offer))}
                          <button
                            type="button"
                            className="rogue-choice-card rogue-store-gamble-card"
                            onClick={() => {
                              if (!isGambleRevealing && !gambleOutcome) {
                                setShowGambleConfirm((prev) => !prev);
                              }
                            }}
                            disabled={isGambleRevealing || Boolean(gambleOutcome)}
                            data-popover-surface="true"
                          >
                            <strong>Gamble</strong>
                            <span>Take a chance for a random power-up.</span>
                            <span className="rogue-store-gamble-dice" aria-hidden="true">🎲</span>
                            <span>{`Cost: ${gambleCoinCost} coin${gambleCoinCost === 1 ? '' : 's'}`}</span>
                          </button>
                        </div>
                        <button type="button" className="btn-primary" onClick={leaveStore}>
                          Return
                        </button>
                      </>
                    )}

                    {run?.stage === 'hub' &&
                      !shouldGateBoardChoices &&
                      run.hubMessage &&
                      hubMessageKey !== hiddenHubMessageKey &&
                      !isPurchasedStoreHubMessage && (
                      <p className={`rogue-hub-message${hasTransientHubMessage ? ' is-transient' : ''}`}>
                        {run.hubMessage}
                      </p>
                    )}
                    {shouldShowStoreGamble && (showGambleConfirm || isGambleRevealing || gambleOutcome) && (
                      <div
                        className="rogue-gamble-modal-backdrop"
                        role="presentation"
                        onClick={() => {
                          if (!isGambleRevealing && !gambleOutcome) {
                            setShowGambleConfirm(false);
                          }
                        }}
                      >
                        <section
                          className={`rogue-gamble-modal${gambleOutcome ? ` is-${gambleOutcome.tone}` : ''}`}
                          role="dialog"
                          aria-label={
                            isGambleRevealing
                              ? 'Resolving gamble'
                              : gambleOutcome
                                ? 'Gamble result'
                                : 'Confirm gamble'
                          }
                          data-popover-surface="true"
                        >
                          {isGambleRevealing ? (
                            <>
                              <div className="rogue-gamble-reveal-dice" aria-hidden="true">
                                🎲
                              </div>
                              <p className="rogue-gamble-modal-copy">Rolling fate...</p>
                            </>
                          ) : gambleOutcome ? (
                            <>
                              <div
                                className={`rogue-gamble-outcome-icon rogue-gamble-outcome-icon-${gambleOutcome.tone === 'success' ? 'success' : 'bad'}`}
                                aria-hidden="true"
                              >
                                {gambleOutcome.tone === 'success' ? '✓' : '✕'}
                              </div>
                              <p className="rogue-gamble-modal-copy">{gambleOutcome.message}</p>
                              <div className="rogue-gamble-modal-actions">
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() => setGambleOutcome(null)}
                                >
                                  OK
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h3>Confirm Gamble</h3>
                              <p>
                                Spend <strong>{gambleCoinCost}</strong> coin{gambleCoinCost === 1 ? '' : 's'} to gamble for a random power?
                              </p>
                              <div className="rogue-gamble-modal-actions">
                                <button type="button" className="btn-primary" disabled={!canAffordGamble} onClick={startGambleReveal}>
                                  Gamble
                                </button>
                                <button type="button" className="btn-secondary" onClick={() => setShowGambleConfirm(false)}>
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                        </section>
                      </div>
                    )}
                    {boardSummaryModalLayer}
                  </section>
                </div>
              )}
              {showResetConfirm && (
                <div
                  className="rogue-gamble-modal-backdrop"
                  role="presentation"
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      setShowResetConfirm(false);
                    }
                  }}
                >
                  <section
                    className="rogue-gamble-modal"
                    role="dialog"
                    aria-label="Confirm abandon run"
                    data-popover-surface="true"
                  >
                    <h3>Confirm Abandon Run</h3>
                    <p>Reset all Rogue Brick progress and abandon the current run? This cannot be undone.</p>
                    <div className="rogue-gamble-modal-actions">
                      <button type="button" className="btn-primary" onClick={confirmResetGame}>
                        Abandon Run
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setShowResetConfirm(false)}>
                        Cancel
                      </button>
                    </div>
                  </section>
                </div>
              )}
              {isCoreBreachFlashing && !showBoardOverlay && (
                <div
                  className="rogue-core-breach-flash"
                  style={
                    {
                      '--core-breach-glow': getCoreVariantFlashGlow(coreBreachFlashVariant),
                      '--core-breach-text': getCoreVariantFlashText(coreBreachFlashVariant),
                      '--core-breach-shadow': getCoreVariantFlashShadow(coreBreachFlashVariant),
                    } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  <span>CORE BREACHED</span>
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="rogue-brick-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              />
            </div>
            {isFocusMode && typeof document !== 'undefined'
              ? createPortal(powerStripElement, document.body)
              : powerStripElement}
        </div>

        <aside className="rogue-brick-sidebar">
          <section className="rogue-brick-panel">
            <h2>Run Stats</h2>
            {hasActiveRun ? (
              <>
                <div className="rogue-progress-label">
                  <span>Run Progress</span>
                  <strong>{runProgressPct}%</strong>
                </div>
                <div className="rogue-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={runProgressPct}>
                  <div className="rogue-progress-fill" style={{ width: `${runProgressPct}%` }} />
                </div>
                <div className="rogue-progress-label">
                  <span>Climb to Next Level</span>
                  <strong>{displayDestroyedBricks}/{run?.levelGoalBricks ?? 0} bricks</strong>
                </div>
                <div className="rogue-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayClimbProgressPct}>
                  <div className="rogue-progress-fill rogue-progress-fill-climb" style={{ width: `${displayClimbProgressPct}%` }} />
                </div>
                <ul className="rogue-stat-list">
                  <li>Level: {run?.level}/{run?.maxLevels}</li>
                  <li>Boards Cleared: {run?.boardsCleared}</li>
                  <li>{objectiveStatusLabel}</li>
                  <li>Bricks Remaining: {displayBricksRemaining}</li>
                  <li>Board HP Remaining: {boardHpRemaining}</li>
                  <li>Mana: {displayMana}</li>
                  <li>Coins: {displayCoins}</li>
                  <li>Balls: {run?.ballCount}</li>
                  <li>Damage: {run?.damage}</li>
                  <li>Power Shot: +{powerShotBonusPct}%</li>
                  <li>Barrage: {barrageReady ? 'Ready' : 'Charging'}</li>
                  <li>Crit: {Math.round((run?.critChance ?? 0) * 100)}%</li>
                </ul>
              </>
            ) : (
              <p>No active run.</p>
            )}
          </section>

          <section className="rogue-brick-panel">
            <h2>Meta Progress</h2>
            <p>Meta Currency: <strong>{profile.metaCurrency}</strong></p>
            <p>Best Level: <strong>{profile.bestLevel}</strong></p>
            <p>Total Runs: <strong>{profile.totalRuns}</strong></p>
            <button type="button" className="btn-secondary" onClick={resetGame}>
              Reset Game (Abandon Run)
            </button>
          </section>

          {!hasActiveRun && lastRunSummary && (
            <section className="rogue-brick-panel">
              <h2>Last Run</h2>
              <p>{lastRunSummary.victory ? 'Victory' : 'Defeat'}</p>
              <p>Level Reached: {lastRunSummary.levelReached}</p>
              <p>Boards Cleared: {lastRunSummary.boardsCleared}</p>
              <p>Meta Earned: +{lastRunSummary.metaEarned}</p>
            </section>
          )}
        </aside>
        </div>
      </section>

      {shouldShowStartingRunSelection && (
        <section className="rogue-brick-panel">
          <h2>Permanent Upgrades</h2>
          <div className="rogue-choice-grid">
            {PERMANENT_UPGRADES.map((upgrade) => {
              const state = profile.permanentUpgrades[upgrade.key];
              const cost = upgradeCost(upgrade, state.rank);
              const atMax = state.rank >= upgrade.maxRank;
              const baseColor = POWER_BASE_COLORS[upgrade.key] ?? '#22d3ee';
              const backdropIcon = POWER_BACKDROP_ICONS[upgrade.key] ?? '◌';
              const currentRank = state.rank;
              const nextRank = atMax ? state.rank : state.rank + 1;
              return (
                <div key={upgrade.key} className="rogue-upgrade-card">
                  <strong>{upgrade.name}</strong>
                  <span>{upgrade.description}</span>
                  <div className="rogue-store-offer-preview">
                    <span className="rogue-store-offer-preview-label">
                      {state.enabled ? 'Meta power enabled' : state.rank > 0 ? 'Owned but disabled' : 'Not owned yet'}
                    </span>
                    <div className="rogue-store-offer-bars" aria-hidden="true">
                      <span
                        className="rogue-active-power-chip rogue-store-power-chip"
                        style={{ '--power-base-color': baseColor } as CSSProperties}
                      >
                        <span className="rogue-active-power-backdrop">{backdropIcon}</span>
                        <span className="rogue-active-power-stack">
                          {Array.from({ length: upgrade.maxRank }, (_, index) => (
                            <span
                              key={`${upgrade.key}-perm-current-${index}`}
                              className={`rogue-active-power-segment${index < currentRank ? ' is-active' : ''}`}
                            />
                          ))}
                        </span>
                      </span>
                      <span className="rogue-store-power-arrow">→</span>
                      <span
                        className="rogue-active-power-chip rogue-store-power-chip is-after"
                        style={{ '--power-base-color': baseColor } as CSSProperties}
                      >
                        <span className="rogue-active-power-backdrop">{backdropIcon}</span>
                        <span className="rogue-active-power-stack">
                          {Array.from({ length: upgrade.maxRank }, (_, index) => (
                            <span
                              key={`${upgrade.key}-perm-next-${index}`}
                              className={`rogue-active-power-segment${index < nextRank ? ' is-active' : ''}`}
                            />
                          ))}
                        </span>
                      </span>
                    </div>
                    <span className="rogue-store-offer-levels">
                      Rank {currentRank}/{upgrade.maxRank} → {nextRank}/{upgrade.maxRank}
                    </span>
                  </div>
                  <div className="rogue-upgrade-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => buyPermanentUpgrade(upgrade.key)}
                      disabled={atMax || profile.metaCurrency < cost}
                    >
                      {atMax ? 'Maxed' : `Buy (${cost})`}
                    </button>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => togglePermanentUpgrade(upgrade.key)}
                      disabled={state.rank === 0}
                    >
                      {state.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {shouldShowDefeatNotification && lastRunSummary && (
        <div className="rogue-gamble-modal-backdrop" role="presentation">
          <section
            className="rogue-gamble-modal is-backfire"
            role="dialog"
            aria-label="Run ended in defeat"
            aria-modal="true"
            data-popover-surface="true"
          >
            <h3 className="rogue-defeat-title">
              <span className="rogue-defeat-title-icon" aria-hidden="true">☠</span>
              Defeat
            </h3>
            <p className="rogue-gamble-modal-copy">
              You were crushed at level {lastRunSummary.levelReached} after {lastRunSummary.boardsCleared}{' '}
              board{lastRunSummary.boardsCleared === 1 ? '' : 's'}.
            </p>
            <p className="rogue-gamble-modal-copy">Your run is gone. You salvaged +{lastRunSummary.metaEarned} meta.</p>
            <div className="rogue-gamble-modal-actions">
              <button
                type="button"
                className="rogue-defeat-dismiss"
                onClick={() => setDismissedDefeatSummaryCompletedAt(lastRunSummary.completedAt)}
              >
                Accept Defeat
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
