import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  WARDEN_BLANK_HP_MAX,
  getBlankCombinedHp,
  getBlankEncounterHpMax,
  getBlankEyeRenderMetrics,
  getWardenShotColor,
  getWardenVolleyCaps,
  getWardenVolleyDamageProfile,
  normalizeBlankEyeHp,
  normalizeWardenVolleySelection,
  resolveWardenShieldTearHit,
} from '../../features/rogueBrick/rogueBrickCombat';
import {
  getBoardObjectiveHp,
  calculateLevelGoal,
  calculateOverallProgress,
  calculateOverallScore,
  getBoardObjectiveVariants,
  getManaYieldScale,
  makeSpoilsOffers,
  selectCuratedBoardIndex,
  toMetaEarned,
} from '../../features/rogueBrick/rogueBrickBoard';
import {
  CORE_VARIANTS,
  PATH_MAX_LANE_ABS,
  PATH_WARDEN_INTERVAL_LEVELS,
  PATH_WARDEN_TOTAL,
  WARDEN_TRIGGERS,
  buildPathFocusSets,
  buildPathPreview,
  createRootPathNode,
  derivePathChildren,
  ensureRunPathState,
  getBlankEncounterProfile,
  getCurrentPathNode,
  getDeepwoodDomainDefinition,
  getFirstWardenTrigger,
  getPathChallengeDefinition,
  getPathNodePrimaryCoreVariant,
  getPathNodeWardenForecast,
  makePathNodeId,
  makeWardenEncounterKey,
  normalizePathLaneForLevel,
  toDeepwoodDomainKey,
  type CoreVariant,
  type DeepwoodDomainKey,
  type PathChallengeKey,
  type PathPreviewNode,
} from '../../features/rogueBrick/rogueBrickPathing';
import { browserRogueBrickPersistence } from '../../features/rogueBrick/rogueBrickPersistence';
import {
  cloneRogueBrickProfile,
  createDefaultRogueBrickProfile,
  getOrbSkillGaugeMaxByColor as getRogueBrickOrbSkillGaugeMaxByColor,
  parseRogueBrickProgress,
  type BoardSkillBonus,
  type BoardState,
  type BoardSummary,
  type Brick,
  type BrickKind,
  type OneWaySide,
  type PermanentUpgradeKey,
  type PermanentUpgradeState,
  type PowerOffer,
  type RogueBrickProfile,
  type RogueRunState,
  type SpoilsOffer,
} from '../../features/rogueBrick/rogueBrickSaveModel';
import rogueBrickTargetAtlasUrl from '../../assets/rogue-brick-target-atlas.png';
import blankBodyIdle01Url from '../../assets/blank/body/blank_body_idle_01.png';
import blankLidOpenUrl from '../../assets/blank/eyelid/blank_lid_open.png';
import blankLid25Url from '../../assets/blank/eyelid/blank_lid_25.png';
import blankLid50Url from '../../assets/blank/eyelid/blank_lid_50.png';
import blankLid75Url from '../../assets/blank/eyelid/blank_lid_75.png';
import blankLidClosedUrl from '../../assets/blank/eyelid/blank_lid_closed.png';
import tearFall01Url from '../../assets/blank/tear/tear_fall_01.png';
import './RogueBrickPage.css';

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 720;
const BRICK_COLUMNS = 7;
const BRICK_GAP = 1.5;
const BRICK_HEIGHT = 34;
const BRICK_SIZE_SCALE = 0.7;
const DEFAULT_LAUNCH_ORIGIN_X = CANVAS_WIDTH / 2;
const STANDARD_BRICK_MIN_SCALE = 0.70;
const BRICK_ROW_STEP = BRICK_HEIGHT + BRICK_GAP;
const BRICK_TOP = 70;
const LAUNCHER_Y = CANVAS_HEIGHT - 42;
const BALL_RADIUS = 6.5;
const BALL_SPEED = 630;
const BALL_RADIUS_MIN = 3.2;
const BALL_RADIUS_MAX = 9.4;
const BALL_MASS_MIN = 0.55;
const BALL_MASS_MAX = 1.8;
const BALL_SPEED_MULTIPLIER_MIN = 0.82;
const BALL_SPEED_MULTIPLIER_MAX = 1.38;
const CORE_DAMAGE_WEIGHT_MIN = 0.55;
const CORE_DAMAGE_WEIGHT_MAX = 1.55;
const MAX_ACTIVE_BALLS = 280;
const MIN_LAUNCH_UPWARD_COMPONENT = -0.08;
const LOSE_Y = LAUNCHER_Y - 20;
const WARDEN_LAUNCHER_Y = LAUNCHER_Y - 12;
const WARDEN_TURRET_SLIDE_MS = 200;
const LOCAL_SAVE_DEBOUNCE_MS = 900;
const HOMING_BULLET_TIME_SCALE = 0.34;
const POWER_POPOVER_WIDTH_PX = 272;
const CORE_MIN_SCALE = 0.42;
const BLUE_CORE_MIN_SCALE = 0.92;
const BLUE_CORE_FORCE_FIELD_SIZE_MULTIPLIER = 1.5;
const BOARD_ROW_ADVANCE_ANIMATION_MS = 360;
const BOARD_ROW_ADVANCE_STEP_ROWS = 0.62;
const CORE_BREACH_FLASH_MS = 1400;
const BONUS_EVENT_TEXT_ANIMATION_MS = 1500;
const FORCE_ALL_CRIT_SHOTS_FOR_TESTING = false;
const UNBREAKABLE_INTRO_BOARD = 16;
const UNBREAKABLE_HALF_BOARD = 48;
const UNBREAKABLE_MAX_SHARE = 0.5;
const BOARD_SIDE_CHANNEL_WIDTH = 30;
const STANDARD_BRICK_MAX_SCALE = 0.90;
const PATH_TREE_MIN_HEIGHT_REM = 37.8;
const PATH_TREE_LEVEL_HEIGHT_REM = 2.8;
const PATH_SLIDE_ANIMATION_MS = 420;
const WARDEN_SHIELD_BASE_PIPS = 3;
const WARDEN_SHIELD_GRACE_MS = 5000;
const BOARD_SHOT_COOLDOWN_MS = 3000;
const BOARD_TURRET_Y_OFFSET = 8;
const WARDEN_SHOT_COOLDOWN_MIN_MS = 200;
const WARDEN_SHOT_COOLDOWN_STEP_MS = 200;
const WARDEN_SHOT_COOLDOWN_MAX_LEVEL = Math.floor(
  (BOARD_SHOT_COOLDOWN_MS - WARDEN_SHOT_COOLDOWN_MIN_MS) / WARDEN_SHOT_COOLDOWN_STEP_MS
);
const WARDEN_VOLLEY_HARD_CAP = 20;
const WARDEN_TURRET_Y_OFFSET = 8;
const ORB_SKILL_GAUGE_BASE_SEGMENTS = 5;
const ORB_SKILL_GAUGE_MAX_SEGMENTS = 20;
const WARDEN_SHOT_BASE_COUNT = 5;
const WARDEN_TEAR_HP_MAX = 1;        // HP of a falling tear; temporary tuning for rapid iteration
const WARDEN_TEAR_DEFAULT_DETACH_SEC = 3;
const WARDEN_TEAR_FIRST_STARTUP_SEC = 1;
const WARDEN_TEAR_REPEAT_STARTUP_SEC = 5;
const WARDEN_TEAR_REPEAT_STARTUP_MIN_SEC = 3;
const TPose_THRESHOLD_BRICKS_BEFORE_ORB = 20;

const BALANCE_TARGETS = {
  runDurationMinutes: 20,
  spoilsEveryBoards: [4, 5] as const,
  powerChoiceEveryBoards: 4,
  expectedSpoilsClaimsPerStop: 1,
  expectedSpoilsOffersPerStop: 4,
};

const BALANCE = {
  maxLevels: PATH_WARDEN_INTERVAL_LEVELS * PATH_WARDEN_TOTAL,
  launchStaggerMs: 96,
  spoilsIntervalMinBoards: BALANCE_TARGETS.spoilsEveryBoards[0],
  spoilsIntervalMaxBoards: BALANCE_TARGETS.spoilsEveryBoards[1],
  powerChoiceEveryBoards: BALANCE_TARGETS.powerChoiceEveryBoards,
  spoilsOfferCount: BALANCE_TARGETS.expectedSpoilsOffersPerStop,
  objectiveHpBase: 10,
  objectiveHpPerLevel: 3.8,
  objectiveHpLevelScale: 2.4,
  powerOfferCount: 4,
  powerOfferBaseManaCost: 30,
  powerOfferCostGrowthRate: 1.32,
  manaRewardDecayPerBoard: 0.013,
  manaRewardMinScale: 0.58,
  objectiveManaRewardCrit: 0.45,
  objectiveManaRewardNormal: 0.28,
  brickManaRewardCrit: 0.14,
  brickManaRewardNormal: 0.08,
} as const;

type DeepwoodCurrencyType = 'mana' | 'spoils' | 'meta';
type DeepwoodCatalogStatus = 'implemented' | 'planned';
type TargetArtStyle = 'classic' | 'sigil' | 'relic' | 'atlas';
type ResourceHelpKey = 'mana' | 'essence-yellow' | 'essence-blue' | 'essence-green';

const TARGET_ART_STYLE_LABELS: Record<TargetArtStyle, string> = {
  classic: 'Classic Brick',
  sigil: 'Runed Sigil',
  relic: 'Carved Relic',
  atlas: 'Atlas Paintover',
};

const TARGET_ART_STYLE_SEQUENCE: TargetArtStyle[] = ['classic', 'sigil', 'relic', 'atlas'];
const TARGET_ATLAS_TILE_SIZE = 128;
const BRICK_ASSET_URLS_BY_FILE = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/brick-assets/*.png', {
      eager: true,
      import: 'default',
    }) as Record<string, string>
  ).map(([filePath, fileUrl]) => [filePath.split('/').pop() ?? filePath, fileUrl])
) as Record<string, string>;

type BrickArtState = 'idle' | 'hit' | 'damaged';

interface DeepwoodCatalogEntry {
  id: string;
  status: DeepwoodCatalogStatus;
  currency: DeepwoodCurrencyType;
  name: string;
  summary: string;
  domainLean: DeepwoodDomainKey | 'cross-domain';
  counters: string;
  baseCost: number;
  scalingNote: string;
}

interface BallRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  active: boolean;
  coreCharged: boolean;
  isCritShot: boolean;
  reboundCount: number;
  wardenTouchingBlank?: boolean;
  wardenTouchingTear?: boolean;
}

interface LaunchQueueItem {
  delayMs: number;
  spawn?: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    mass: number;
    isCritShot?: boolean;
  };
}

interface TurnRewards {
  mana: number;
  essenceByColor: Record<CoreVariant, number>;
}

interface LiveHudState {
  destroyedBricks: number;
  manaEarned: number;
  remainingBricks: number;
  essenceByColor: Record<CoreVariant, number>;
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

interface WardenImpactParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ageMs: number;
  lifeMs: number;
  color: string;
}

interface WardenActiveTear {
  xCanvas: number;
  yStartCanvas: number;
  sourceEyeIndex: number;
  hp: number;
  phase: 'falling' | 'hit' | 'gone';
  spawnedAtMs: number;
  revealDurationMs: number;
}

interface ManaBonusEventText {
  label: string;
  x: number;
  y: number;
  ageMs: number;
  lifeMs: number;
}

interface OrbSlotUpgradeFlash {
  variant: CoreVariant;
  slotIndex: number;
  token: number;
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
    name: 'Expedition Quiver',
    description: 'Persistent starting shot reserve. Each rank sends a larger vanguard into the Deepwood.',
    baseCost: 45,
    costScale: 1.7,
    maxRank: 3,
  },
  {
    key: 'startingMana',
    name: 'Rootwell Cache',
    description: 'Persistent starting mana reserve. Each rank deepens the Rootwell you draw from at first light.',
    baseCost: 35,
    costScale: 1.6,
    maxRank: 3,
  },
  {
    key: 'startingDamage',
    name: 'Siege Etching',
    description: 'Persistent starting impact bonus. Each rank sharpens your opening blows with deeper siege etchings.',
    baseCost: 60,
    costScale: 1.8,
    maxRank: 2,
  },
];

const POWER_BASE_COLORS: Record<string, string> = {
  startingBalls: '#22d3ee',
  startingMana: '#8b5cf6',
  startingDamage: '#ef4444',
  'starting-gift-shot': '#facc15',
  'starting-gift-shield': '#60a5fa',
  'starting-gift-strength': '#22c55e',
  'arcane-volley': '#38bdf8',
  'rune-edge': '#fb7185',
  'siphon-shell': '#a78bfa',
  'golden-thread': '#fbbf24',
  'fortune-ricochet': '#34d399',
  'shop-ball': '#2dd4bf',
  'shop-damage': '#f97316',
  'shop-shield-slot': '#60a5fa',
  'shop-cooldown': '#a78bfa',
};

const POWER_BACKDROP_ICONS: Record<string, string> = {
  startingBalls: '◍',
  startingMana: '✦',
  startingDamage: '✶',
  'starting-gift-shot': '◉',
  'starting-gift-shield': '⬒',
  'starting-gift-strength': '✚',
  'arcane-volley': '✹',
  'rune-edge': '⟡',
  'siphon-shell': '⬢',
  'golden-thread': '⌁',
  'fortune-ricochet': '◎',
  'shop-ball': '◌',
  'shop-damage': '✸',
  'shop-shield-slot': '⬒',
  'shop-cooldown': '⏱',
};

const DEEPWOOD_CATALOG: DeepwoodCatalogEntry[] = [
  {
    id: 'arcane-volley',
    status: 'implemented',
    currency: 'mana',
    name: 'Briar Volley',
    summary: 'Launches denser salvos to overwhelm evasive threats.',
    domainLean: 'crow-spire',
    counters: 'Blue influence and yellow consumption punish low-mass spam.',
    baseCost: 30,
    scalingNote: 'Mana cost scales every 3 boards.',
  },
  {
    id: 'rune-edge',
    status: 'implemented',
    currency: 'mana',
    name: 'Hunter\'s Draw',
    summary: 'Concentrates force for cleaner armor breaks.',
    domainLean: 'thorn-keep',
    counters: 'Lower total contacts can suffer against swarm screens.',
    baseCost: 34,
    scalingNote: 'Mana cost scales every 3 boards.',
  },
  {
    id: 'siphon-shell',
    status: 'implemented',
    currency: 'mana',
    name: 'Root Siphon',
    summary: 'Root channels answer your call.',
    domainLean: 'black-bog',
    counters: 'Frontloaded cost delays immediate board tempo spikes.',
    baseCost: 36,
    scalingNote: 'Mana cost scales every 3 boards.',
  },
  {
    id: 'golden-thread',
    status: 'implemented',
    currency: 'mana',
    name: 'Wayfinder Thread',
    summary: 'A gilded thread follows your passage.',
    domainLean: 'cross-domain',
    counters: 'Indirect value can be punished by burst-heavy boards.',
    baseCost: 32,
    scalingNote: 'Mana cost scales every 3 boards.',
  },
  {
    id: 'fortune-ricochet',
    status: 'implemented',
    currency: 'mana',
    name: 'Stillhand Omen',
    summary: 'Raises crit pressure for timed warden windows.',
    domainLean: 'ash-castle',
    counters: 'Variance remains if contact volume is too low.',
    baseCost: 38,
    scalingNote: 'Mana cost scales every 3 boards.',
  },
  {
    id: 'shop-ball',
    status: 'implemented',
    currency: 'spoils',
    name: 'Hollow Orb Crate',
    summary: 'Adds a shot to increase contact density.',
    domainLean: 'crow-spire',
    counters: 'Extra low-mass traffic is easier to disrupt or consume.',
    baseCost: 42,
    scalingNote: 'Claimed from Warden spoils.',
  },
  {
    id: 'shop-damage',
    status: 'implemented',
    currency: 'spoils',
    name: 'Lead Seed Carving',
    summary: 'Adds impact for armor and absorb checks.',
    domainLean: 'thorn-keep',
    counters: 'Heavier builds can lose coverage against evasive swarms.',
    baseCost: 50,
    scalingNote: 'Claimed from Warden spoils.',
  },
  {
    id: 'shop-crit',
    status: 'implemented',
    currency: 'spoils',
    name: 'Crowglass Sigil',
    summary: 'Boosts spike damage for warden phase races.',
    domainLean: 'ash-castle',
    counters: 'Relies on timing and sufficient hit frequency.',
    baseCost: 44,
    scalingNote: 'Claimed from Warden spoils.',
  },
  {
    id: 'shop-mana',
    status: 'implemented',
    currency: 'spoils',
    name: 'Sap Flask',
    summary: 'A flask of distilled root-sap.',
    domainLean: 'black-bog',
    counters: 'One-shot value can be wasted without a follow-up buy.',
    baseCost: 30,
    scalingNote: 'Claimed from Warden spoils.',
  },
  {
    id: 'startingBalls',
    status: 'implemented',
    currency: 'meta',
    name: 'Expedition Quiver',
    summary: 'Persistent starting shot reserve.',
    domainLean: 'cross-domain',
    counters: 'Raw quantity can overcommit you into low-mass paths.',
    baseCost: 45,
    scalingNote: 'Cost scales by rank (x1.7).',
  },
  {
    id: 'startingMana',
    status: 'implemented',
    currency: 'meta',
    name: 'Rootwell Cache',
    summary: 'Persistent starting mana reserve.',
    domainLean: 'black-bog',
    counters: 'Economic opening only; no direct combat stat gain.',
    baseCost: 35,
    scalingNote: 'Cost scales by rank (x1.6).',
  },
  {
    id: 'startingDamage',
    status: 'implemented',
    currency: 'meta',
    name: 'Siege Etching',
    summary: 'Persistent starting impact bonus.',
    domainLean: 'thorn-keep',
    counters: 'Can underperform when routes demand spread over force.',
    baseCost: 60,
    scalingNote: 'Cost scales by rank (x1.8).',
  },
  {
    id: 'split-husk',
    status: 'planned',
    currency: 'spoils',
    name: 'Split Husk',
    summary: 'Chance to split on impact for board coverage.',
    domainLean: 'crow-spire',
    counters: 'Split fragments are vulnerable to absorb pressure.',
    baseCost: 46,
    scalingNote: 'Planned for post-v1 pool expansion.',
  },
  {
    id: 'bogcraft-charter',
    status: 'planned',
    currency: 'meta',
    name: 'Bogcraft Charter',
    summary: 'Biases Warden spoils toward anti-absorb picks.',
    domainLean: 'black-bog',
    counters: 'Specialization reduces cross-domain flexibility.',
    baseCost: 75,
    scalingNote: 'Planned doctrine unlock after first milestone.',
  },
];

const DEEPWOOD_CATALOG_BY_ID: Record<string, DeepwoodCatalogEntry> = DEEPWOOD_CATALOG.reduce(
  (accumulator, entry) => {
    accumulator[entry.id] = entry;
    return accumulator;
  },
  {} as Record<string, DeepwoodCatalogEntry>
);

function getDeepwoodCatalogEntry(id: string): DeepwoodCatalogEntry | null {
  return DEEPWOOD_CATALOG_BY_ID[id] ?? null;
}

function getDeepwoodLabel(id: string, fallback: string): string {
  return getDeepwoodCatalogEntry(id)?.name ?? fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface RuntimePowerTemplate {
  id: string;
  name: string;
  description: string;
  baseManaCost: number;
  maxLevel: number;
  describeLevelImpact: (level: number) => string;
  apply: (run: RogueRunState) => void;
}

const BRIAR_VOLLEY_MAX_LEVEL = 5;
const HUNTERS_DRAW_MAX_LEVEL = 5;
const ROOT_SIPHON_MAX_LEVEL = 6;
const STILLHAND_OMEN_MAX_LEVEL = 5;
const SPOILS_SLOT_MAX_BONUS = 5;
const BRIAR_VOLLEY_BASE_OFFSET_DEGREES = 5;
const HUNTERS_DRAW_BASE_CONSISTENCY_CHANCE = 0.5;

function getRunPowerLevel(run: RogueRunState | null | undefined, powerId: string): number {
  return Math.max(0, Math.floor(run?.powers?.[powerId] ?? 0));
}

function incrementRunPowerLevel(run: RogueRunState, powerId: string, maxLevel: number): number {
  const currentLevel = getRunPowerLevel(run, powerId);
  if (currentLevel >= maxLevel) {
    run.powers[powerId] = maxLevel;
    return maxLevel;
  }
  const nextLevel = currentLevel + 1;
  run.powers[powerId] = nextLevel;
  return nextLevel;
}

function getBriarVolleyMaxOffsetDegrees(level: number): number {
  const clampedLevel = clampNumber(level, 0, BRIAR_VOLLEY_MAX_LEVEL);
  const remainingRatio = 1 - clampedLevel / BRIAR_VOLLEY_MAX_LEVEL;
  return Math.max(0, BRIAR_VOLLEY_BASE_OFFSET_DEGREES * remainingRatio);
}

function getHuntersDrawConsistencyChance(level: number): number {
  const clampedLevel = clampNumber(level, 0, HUNTERS_DRAW_MAX_LEVEL);
  const progressRatio = clampedLevel / HUNTERS_DRAW_MAX_LEVEL;
  return clampNumber(HUNTERS_DRAW_BASE_CONSISTENCY_CHANCE + progressRatio * 0.5, 0, 1);
}

function getRootSiphonManaBonusPct(level: number): number {
  return Math.max(0, Math.floor(clampNumber(level, 0, ROOT_SIPHON_MAX_LEVEL) * 5));
}

function getStillhandOmenCritBonusPct(level: number): number {
  const clampedLevel = Math.max(0, Math.floor(clampNumber(level, 0, STILLHAND_OMEN_MAX_LEVEL)));
  return Math.min(9, clampedLevel * 2);
}

function applyRootSiphonLevel(run: RogueRunState, nextLevel: number, previousLevel: number): void {
  const previousBonusPct = getRootSiphonManaBonusPct(previousLevel);
  const nextBonusPct = getRootSiphonManaBonusPct(nextLevel);
  const deltaPct = nextBonusPct - previousBonusPct;
  if (deltaPct !== 0) {
    run.manaMultiplier += deltaPct / 100;
  }
}

function applyStillhandOmenLevel(run: RogueRunState, nextLevel: number, previousLevel: number): void {
  const previousBonusPct = getStillhandOmenCritBonusPct(previousLevel);
  const nextBonusPct = getStillhandOmenCritBonusPct(nextLevel);
  const deltaPct = nextBonusPct - previousBonusPct;
  if (deltaPct !== 0) {
    run.critChance += deltaPct / 100;
  }
}

function getRunOrbSkillGaugeMaxByColor(
  run: RogueRunState | null | undefined,
  permanentUpgrades: Record<PermanentUpgradeKey, PermanentUpgradeState>
): Record<CoreVariant, number> {
  const baseGaugeMaxByColor = getOrbSkillGaugeMaxByColor(permanentUpgrades);
  const slotBonusByColor = run?.orbSlotBonusByColor ?? { yellow: 0, blue: 0, green: 0 };
  return {
    yellow: baseGaugeMaxByColor.yellow + Math.min(SPOILS_SLOT_MAX_BONUS, Math.max(0, Math.floor(slotBonusByColor.yellow ?? 0))),
    blue: baseGaugeMaxByColor.blue + Math.min(SPOILS_SLOT_MAX_BONUS, Math.max(0, Math.floor(slotBonusByColor.blue ?? 0))),
    green: baseGaugeMaxByColor.green + Math.min(SPOILS_SLOT_MAX_BONUS, Math.max(0, Math.floor(slotBonusByColor.green ?? 0))),
  };
}

function getRunShotCooldownMs(run: RogueRunState | null | undefined): number {
  const cooldownLevel = getRunPowerLevel(run, 'shop-cooldown');
  return getShotCooldownMsForLevel(cooldownLevel);
}

function getShotCooldownMsForLevel(level: number): number {
  const cooldownLevel = Math.max(0, Math.floor(level));
  return Math.max(
    WARDEN_SHOT_COOLDOWN_MIN_MS,
    BOARD_SHOT_COOLDOWN_MS - cooldownLevel * WARDEN_SHOT_COOLDOWN_STEP_MS
  );
}

function getWardenTearCountdownSec(detachAtSec: number, startupSec: number): number {
  const detachSec = Math.max(1, Math.floor(detachAtSec));
  const startup = Math.max(0, Math.floor(startupSec));
  return detachSec + startup;
}

function buildAimedVolleySpawns(options: {
  shotCount: number;
  baseAimAngle: number;
  baseSpeed: number;
  precisionWindowRadians: number;
  consistencyChance: number;
  critChance: number;
}): Array<{ vx: number; vy: number; isCritShot: boolean }> {
  const count = Math.max(0, Math.floor(options.shotCount));
  if (count === 0) {
    return [];
  }
  const precisionWindow = Math.max(0, options.precisionWindowRadians);
  const consistency = clampNumber(options.consistencyChance, 0, 1);
  const rollPrecisionOffset = () => (Math.random() * 2 - 1) * precisionWindow;
  const firstShotAngle = options.baseAimAngle + rollPrecisionOffset();
  return Array.from({ length: count }, (_, index) => {
    let shotAngle = firstShotAngle;
    if (index > 0) {
      const followsFirstShot = Math.random() < consistency;
      shotAngle = followsFirstShot ? firstShotAngle : firstShotAngle + rollPrecisionOffset();
    }
    const isCritShot = FORCE_ALL_CRIT_SHOTS_FOR_TESTING || Math.random() < options.critChance;
    return {
      vx: Math.cos(shotAngle) * options.baseSpeed,
      vy: Math.sin(shotAngle) * options.baseSpeed,
      isCritShot,
    };
  });
}

function drawBallRuntimeVisual(ctx: CanvasRenderingContext2D, ball: BallRuntime, now: number): void {
  if (ball.isCritShot) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.58)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius + 0.1, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (!ball.coreCharged) {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
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
    ball.radius + 1.2
  );
  chargedGradient.addColorStop(0, 'rgba(224, 242, 254, 1)');
  chargedGradient.addColorStop(0.35, 'rgba(125, 211, 252, 1)');
  chargedGradient.addColorStop(1, 'rgba(2, 132, 199, 1)');
  ctx.fillStyle = chargedGradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius + 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(186, 230, 253, 0.95)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius + 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
}

const POWER_POOL: RuntimePowerTemplate[] = [
  {
    id: 'arcane-volley',
    name: getDeepwoodLabel('arcane-volley', 'Briar Volley'),
    description: 'Improves first-shot precision by shrinking launch-angle variance.',
    baseManaCost: 30,
    maxLevel: BRIAR_VOLLEY_MAX_LEVEL,
    describeLevelImpact: (level) =>
      `First-shot precision window: ±${getBriarVolleyMaxOffsetDegrees(level).toFixed(1)}°`,
    apply: (run) => {
      incrementRunPowerLevel(run, 'arcane-volley', BRIAR_VOLLEY_MAX_LEVEL);
    },
  },
  {
    id: 'rune-edge',
    name: getDeepwoodLabel('rune-edge', 'Hunter\'s Draw'),
    description: 'Raises follow-through consistency so later shots match the first-shot release angle.',
    baseManaCost: 34,
    maxLevel: HUNTERS_DRAW_MAX_LEVEL,
    describeLevelImpact: (level) =>
      `Follow-first-shot consistency: ${Math.round(getHuntersDrawConsistencyChance(level) * 100)}%`,
    apply: (run) => {
      incrementRunPowerLevel(run, 'rune-edge', HUNTERS_DRAW_MAX_LEVEL);
    },
  },
  {
    id: 'siphon-shell',
    name: getDeepwoodLabel('siphon-shell', 'Root Siphon'),
    description: 'Boosts mana recovery from brick breaks during the run.',
    baseManaCost: 36,
    maxLevel: ROOT_SIPHON_MAX_LEVEL,
    describeLevelImpact: (level) => `Mana recovery bonus: +${getRootSiphonManaBonusPct(level)}%`,
    apply: (run) => {
      const previousLevel = getRunPowerLevel(run, 'siphon-shell');
      const nextLevel = incrementRunPowerLevel(run, 'siphon-shell', ROOT_SIPHON_MAX_LEVEL);
      applyRootSiphonLevel(run, nextLevel, previousLevel);
    },
  },
  {
    id: 'fortune-ricochet',
    name: getDeepwoodLabel('fortune-ricochet', 'Stillhand Omen'),
    description: 'Raises crit chance and adds clearer crit-laced projectile visuals.',
    baseManaCost: 38,
    maxLevel: STILLHAND_OMEN_MAX_LEVEL,
    describeLevelImpact: (level) => `Crit chance bonus: +${getStillhandOmenCritBonusPct(level)}%`,
    apply: (run) => {
      const previousLevel = getRunPowerLevel(run, 'fortune-ricochet');
      const nextLevel = incrementRunPowerLevel(run, 'fortune-ricochet', STILLHAND_OMEN_MAX_LEVEL);
      applyStillhandOmenLevel(run, nextLevel, previousLevel);
    },
  },
];

interface SpoilsTemplate {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  slotVariant?: CoreVariant;
  describeLevelImpact: (level: number, run: RogueRunState | null | undefined, profile: RogueBrickProfile | null) => string;
  apply: (run: RogueRunState) => void;
}

const SPOILS_POOL: SpoilsTemplate[] = [
  {
    id: 'shop-ball',
    name: 'Shot Slot Upgrade',
    description: 'Adds +1 Shot power slot capacity.',
    maxLevel: SPOILS_SLOT_MAX_BONUS,
    slotVariant: 'yellow',
    describeLevelImpact: (level, _run, profile) => {
      const nextBonus = Math.min(SPOILS_SLOT_MAX_BONUS, level);
      if (!profile) {
        return `${ORB_SKILL_GAUGE_BASE_SEGMENTS + nextBonus} Shots`;
      }
      const baseGauge = getOrbSkillGaugeMaxByColor(profile.permanentUpgrades).yellow;
      return `${baseGauge + nextBonus} Shots`;
    },
    apply: (run) => {
      const nextLevel = incrementRunPowerLevel(run, 'shop-ball', SPOILS_SLOT_MAX_BONUS);
      run.orbSlotBonusByColor.yellow = Math.min(SPOILS_SLOT_MAX_BONUS, nextLevel);
    },
  },
  {
    id: 'shop-damage',
    name: 'Strength Slot Upgrade',
    description: 'Adds +1 Strength power slot capacity.',
    maxLevel: SPOILS_SLOT_MAX_BONUS,
    slotVariant: 'green',
    describeLevelImpact: (level, _run, profile) => {
      const nextBonus = Math.min(SPOILS_SLOT_MAX_BONUS, level);
      if (!profile) {
        return `${ORB_SKILL_GAUGE_BASE_SEGMENTS + nextBonus} Strength`;
      }
      const baseGauge = getOrbSkillGaugeMaxByColor(profile.permanentUpgrades).green;
      return `${baseGauge + nextBonus} Strength`;
    },
    apply: (run) => {
      const nextLevel = incrementRunPowerLevel(run, 'shop-damage', SPOILS_SLOT_MAX_BONUS);
      run.orbSlotBonusByColor.green = Math.min(SPOILS_SLOT_MAX_BONUS, nextLevel);
    },
  },
  {
    id: 'shop-shield-slot',
    name: 'Shield Slot Upgrade',
    description: 'Adds +1 Shield power slot capacity.',
    maxLevel: SPOILS_SLOT_MAX_BONUS,
    slotVariant: 'blue',
    describeLevelImpact: (level, _run, profile) => {
      const nextBonus = Math.min(SPOILS_SLOT_MAX_BONUS, level);
      if (!profile) {
        return `${ORB_SKILL_GAUGE_BASE_SEGMENTS + nextBonus} Shield`;
      }
      const baseGauge = getOrbSkillGaugeMaxByColor(profile.permanentUpgrades).blue;
      return `${baseGauge + nextBonus} Shield`;
    },
    apply: (run) => {
      const nextLevel = incrementRunPowerLevel(run, 'shop-shield-slot', SPOILS_SLOT_MAX_BONUS);
      run.orbSlotBonusByColor.blue = Math.min(SPOILS_SLOT_MAX_BONUS, nextLevel);
    },
  },
  {
    id: 'shop-cooldown',
    name: 'Tempo Relay',
    description: 'Reduces shot cooldown by 0.2s.',
    maxLevel: WARDEN_SHOT_COOLDOWN_MAX_LEVEL,
    describeLevelImpact: (level) => {
      const currentCooldownMs = getShotCooldownMsForLevel(level);
      return `Shot cooldown: ${(currentCooldownMs / 1000).toFixed(1)}s`;
    },
    apply: (run) => {
      incrementRunPowerLevel(run, 'shop-cooldown', WARDEN_SHOT_COOLDOWN_MAX_LEVEL);
    },
  },
];

type PowerAspectBucket = 'shooting' | 'munitions' | 'powers';
type PowerRewardSource = 'mana' | 'warden' | 'permanent';

const POWER_DRAWER_BUCKET_ORDER: PowerAspectBucket[] = ['shooting', 'munitions', 'powers'];
const POWER_DRAWER_BUCKET_LABELS: Record<PowerAspectBucket, string> = {
  shooting: 'Shooting',
  munitions: 'Munitions',
  powers: 'Powers',
};
const POWER_REWARD_SOURCE_ORDER: PowerRewardSource[] = ['mana', 'warden', 'permanent'];
const POWER_REWARD_SOURCE_LABELS: Record<PowerRewardSource, string> = {
  mana: 'Mana rewards',
  warden: 'Warden rewards',
  permanent: 'Permanent upgrades',
};

interface ActivePowerIndicator {
  id: string;
  name: string;
  description: string;
  category: 'permanent' | 'run';
  rewardSource: PowerRewardSource;
  aspect: PowerAspectBucket;
  sourceOrder: number;
  currentLevel: number;
  barSlots: number;
  baseColor: string;
  backdropIcon: string;
  statusLabel: string;
  levelLabel: string;
  maxLevelLabel: string;
}

function getPowerAspectBucket(powerId: string): PowerAspectBucket {
  switch (powerId) {
    case 'startingBalls':
    case 'arcane-volley':
    case 'shop-ball':
      return 'munitions';
    case 'startingDamage':
    case 'rune-edge':
    case 'fortune-ricochet':
    case 'shop-damage':
      return 'shooting';
    case 'shop-shield-slot':
    case 'shop-cooldown':
      return 'powers';
    default:
      return 'powers';
  }
}

const ROGUE_BRICK_PROFILE_NORMALIZATION_OPTIONS = {
  orbSkillGaugeBaseSegments: ORB_SKILL_GAUGE_BASE_SEGMENTS,
  orbSkillGaugeMaxSegments: ORB_SKILL_GAUGE_MAX_SEGMENTS,
  ballRadiusMultiplierMin: BALL_RADIUS_MIN / BALL_RADIUS,
  ballRadiusMultiplierMax: BALL_RADIUS_MAX / BALL_RADIUS,
  ballMassMin: BALL_MASS_MIN,
  ballMassMax: BALL_MASS_MAX,
  ballSpeedMultiplierMin: BALL_SPEED_MULTIPLIER_MIN,
  ballSpeedMultiplierMax: BALL_SPEED_MULTIPLIER_MAX,
  launchSpreadMultiplierMin: 0.65,
  launchSpreadMultiplierMax: 1.75,
  launchCadenceMultiplierMin: 0.7,
  launchCadenceMultiplierMax: 1.9,
  yellowCoreConsumeResistanceMin: 0,
  yellowCoreConsumeResistanceMax: 0.45,
  coreDamageWeightMin: CORE_DAMAGE_WEIGHT_MIN,
  coreDamageWeightMax: CORE_DAMAGE_WEIGHT_MAX,
  getLaunchOriginX,
  ensureRunPathState,
  toDeepwoodDomainKey,
} as const;

function defaultProfile(): RogueBrickProfile {
  return createDefaultRogueBrickProfile();
}

function cloneProfile(profile: RogueBrickProfile): RogueBrickProfile {
  return cloneRogueBrickProfile(profile);
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

function getOrbSkillGaugeMaxByColor(
  permanentUpgrades: Record<PermanentUpgradeKey, PermanentUpgradeState>
): Record<CoreVariant, number> {
  return getRogueBrickOrbSkillGaugeMaxByColor(
    permanentUpgrades,
    ORB_SKILL_GAUGE_BASE_SEGMENTS,
    ORB_SKILL_GAUGE_MAX_SEGMENTS
  );
}

function getBrickWidth(): number {
  return (CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH * 2 - BRICK_GAP * (BRICK_COLUMNS + 1)) / BRICK_COLUMNS;
}

function clampLaunchOriginX(value: number): number {
  return clampCoordinate(value, BOARD_SIDE_CHANNEL_WIDTH, CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH);
}

function getLaunchOriginX(run: RogueRunState | null | undefined): number {
  if (!run || typeof run.launchOriginX !== 'number' || Number.isNaN(run.launchOriginX)) {
    return DEFAULT_LAUNCH_ORIGIN_X;
  }
  return clampLaunchOriginX(run.launchOriginX);
}

function getBrickX(col: number, brickWidth: number): number {
  return BOARD_SIDE_CHANNEL_WIDTH + BRICK_GAP + col * (brickWidth + BRICK_GAP);
}

function getRunBallRadius(run: RogueRunState): number {
  return clampNumber(BALL_RADIUS * run.ballRadiusMultiplier, BALL_RADIUS_MIN, BALL_RADIUS_MAX);
}

function getRunBallMass(run: RogueRunState): number {
  return clampNumber(run.ballMassMultiplier, BALL_MASS_MIN, BALL_MASS_MAX);
}

function getRunBallSpeed(run: RogueRunState): number {
  return BALL_SPEED * clampNumber(run.ballSpeedMultiplier, BALL_SPEED_MULTIPLIER_MIN, BALL_SPEED_MULTIPLIER_MAX);
}

function getCoreDamageWeight(run: RogueRunState, variant: CoreVariant): number {
  return clampNumber(run.coreDamageWeights[variant] ?? 1, CORE_DAMAGE_WEIGHT_MIN, CORE_DAMAGE_WEIGHT_MAX);
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
  return STANDARD_BRICK_MIN_SCALE + hpPct * (STANDARD_BRICK_MAX_SCALE - STANDARD_BRICK_MIN_SCALE);
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
      return 'Blue Orb';
    case 'green':
      return 'Green Orb';
    default:
      return 'Yellow Orb';
  }
}

function getNodeOrbCapabilityLabel(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return 'Shield';
    case 'green':
      return 'Strength';
    default:
      return 'Shot';
  }
}

function getCoreCapabilityMenuLabel(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return 'Shields';
    case 'green':
      return 'Strength';
    default:
      return 'Shots';
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

function getCoreDestructionMessage(coreVariant?: CoreVariant): string {
  switch (coreVariant) {
    case 'blue':
      return 'SHIELD SHATTERED';
    case 'green':
      return 'POWER SUBDUED';
    default:
      return 'ESSENCE CONSUMED';
  }
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
  // 1: symmetric shield
  ['ss.s.ss', 'srsssrs', 'ss.r.ss', 's.srs.s', '...C...', 's.srs.s', 'ss.r.ss', 'srsssrs', 'ss.s.ss'],
  // 2: dense columns
  ['sss.sss', '.sssss.', 'ssrssrs', 'sssssss', '...C...', 'sssssss', 'ssrssrs', '.sssss.', 'sss.sss'],
  // 3: alternating grid
  ['s.s.s.s', 'sssrsss', 's.sss.s', 'sssssss', '...C...', 'sssssss', 's.sss.s', 'sssrsss', 's.s.s.s'],
  // 4: fortress walls
  ['.sssss.', 'srsssrs', 'ss.r.ss', '.sssss.', '...C...', '.sssss.', 'ss.r.ss', 'srsssrs', '.sssss.'],
  // 5: gated approach
  ['srs.srs', 'ss.s.ss', 'sssssss', 'sr...rs', '...C...', 'sr...rs', 'sssssss', 'ss.s.ss', 'srs.srs'],
  // 6: chevron lattice
  ['.srsrs.', 'sssssss', 'ss.s.ss', 'srsrsrs', '...C...', 'srsrsrs', 'ss.s.ss', 'sssssss', '.srsrs.'],
  // 7: solid bracket
  ['sss.sss', 'srssrss', 'sssssss', 'ss.s.ss', '...C...', 'ss.s.ss', 'sssssss', 'srssrss', 'sss.sss'],
  // 8: flanking columns
  ['s.sss.s', 'ssrssrs', '.sssss.', 'sssssss', '...C...', 'sssssss', '.sssss.', 'ssrssrs', 's.sss.s'],
  // 9: reinforced shell
  ['srssrss', 'ss.r.ss', 'srsssrs', 'ss.s.ss', '...C...', 'ss.s.ss', 'srsssrs', 'ss.r.ss', 'srssrss'],
  // 10: solid waves
  ['sssssss', 'ss.r.ss', 'srssrss', '.srsrs.', '...C...', '.srsrs.', 'srssrss', 'ss.r.ss', 'sssssss'],
  // 11: prism crown
  ['ss.p.ss', 'sssssss', 'srssrss', 'ss.s.ss', '...C...', 'ss.s.ss', 'srssrss', 'sssssss', 'ss.p.ss'],
  // 12: chevron tower
  ['.srsrs.', 'ssrssrs', 'sssssss', 'ss.r.ss', '...C...', 'ss.r.ss', 'sssssss', 'ssrssrs', '.srsrs.'],
  // 13: dense wall
  ['sss.sss', 'ss.s.ss', 'srsssrs', 'sssssss', '...C...', 'sssssss', 'srsssrs', 'ss.s.ss', 'sss.sss'],
  // 14: flanked core
  ['s.sss.s', 'sssrsss', 'ssrssrs', '.sssss.', '...C...', '.sssss.', 'ssrssrs', 'sssrsss', 's.sss.s'],
  // 15: rampart
  ['srs.srs', 'sssssss', 'ss.r.ss', 'srsssrs', '...C...', 'srsssrs', 'ss.r.ss', 'sssssss', 'srs.srs'],
  // 16: prism fortress
  ['.sssss.', 'srssrss', 'sssssss', 'ss.p.ss', '...C...', 'ss.p.ss', 'sssssss', 'srssrss', '.sssss.'],
  // 17: crosshatch
  ['ssrssrs', 'ss.s.ss', 'srsssrs', 'sssssss', '...C...', 'sssssss', 'srsssrs', 'ss.s.ss', 'ssrssrs'],
  // 18: layered rings
  ['sss.sss', '.srsrs.', 'ssrssrs', 'srsssrs', '...C...', 'srsssrs', 'ssrssrs', '.srsrs.', 'sss.sss'],
  // 19: bracket grid
  ['ss.s.ss', 'sssrsss', '.srsrs.', 'sssssss', '...C...', 'sssssss', '.srsrs.', 'sssrsss', 'ss.s.ss'],
  // 20: reinforced column
  ['srsssrs', '.sssss.', 'ssrssrs', 'sss.sss', '...C...', 'sss.sss', 'ssrssrs', '.sssss.', 'srsssrs'],
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

function applyEarlyBoardBreathingRows(rows: string[], run: RogueRunState): string[] {
  const boardNumber = run.boardsCleared + 1;
  if (boardNumber > 8) {
    return rows;
  }

  const coreRow = rows.findIndex((row) => row.includes('C'));
  const coreCol = coreRow >= 0 ? rows[coreRow].indexOf('C') : Math.floor(BRICK_COLUMNS / 2);
  const laneSeed = hashStringToUint32(`${run.seed}|${run.level}|${run.boardsCleared}|breathing-lanes`);
  const sideDirection = laneSeed % 2 === 0 ? -1 : 1;
  const primaryLane = Math.max(0, Math.min(BRICK_COLUMNS - 1, coreCol));
  const secondaryLane = Math.max(0, Math.min(BRICK_COLUMNS - 1, coreCol + sideDirection * 2));
  const tertiaryLane = Math.max(0, Math.min(BRICK_COLUMNS - 1, coreCol - sideDirection));

  return rows.map((row, rowIndex) => {
    const chars = row.split('');
    const containsCore = chars.includes('C');

    if (!containsCore) {
      chars[primaryLane] = '.';
      if (boardNumber <= 4 || rowIndex % 2 === 0) {
        chars[secondaryLane] = '.';
      }
      if (boardNumber <= 3 && rowIndex >= Math.floor(rows.length * 0.35)) {
        chars[tertiaryLane] = '.';
      }
    }

    const occupiedCount = chars.reduce((count, cell) => count + (cell !== '.' ? 1 : 0), 0);
    if (occupiedCount >= 6) {
      const carveOrder = [
        Math.max(0, Math.min(BRICK_COLUMNS - 1, coreCol + 3)),
        Math.max(0, Math.min(BRICK_COLUMNS - 1, coreCol - 3)),
        Math.max(0, Math.min(BRICK_COLUMNS - 1, coreCol + 2)),
        Math.max(0, Math.min(BRICK_COLUMNS - 1, coreCol - 2)),
      ];
      for (const carveCol of carveOrder) {
        if (chars[carveCol] === '.' || chars[carveCol] === 'C') {
          continue;
        }
        chars[carveCol] = '.';
        const nextOccupied = chars.reduce((count, cell) => count + (cell !== '.' ? 1 : 0), 0);
        if (nextOccupied <= 5) {
          break;
        }
      }
    }

    return chars.join('');
  });
}

function applyEarlyBoardPreDamage(bricks: Brick[], run: RogueRunState): void {
  const boardNumber = run.boardsCleared + 1;
  if (boardNumber > 10) {
    return;
  }

  const breakableBricks = bricks.filter((brick) => {
    const kind = brick.kind ?? 'standard';
    return kind !== 'objective' && kind !== 'unbreakable';
  });
  if (breakableBricks.length === 0) {
    return;
  }

  const maxRow = breakableBricks.reduce((highest, brick) => Math.max(highest, brick.row), 0);
  const earlyBoardScale = clampNumber((11 - boardNumber) / 10, 0, 1);
  if (earlyBoardScale <= 0) {
    return;
  }

  for (const brick of breakableBricks) {
    const normalizedDepth = maxRow <= 0 ? 0 : clampNumber(brick.row / maxRow, 0, 1);
    const lowerBoardDepth = clampNumber((normalizedDepth - 0.28) / 0.72, 0, 1);
    if (lowerBoardDepth <= 0) {
      continue;
    }

    const kind = brick.kind ?? 'standard';
    const kindScale = kind === 'reinforced' ? 0.72 : kind === 'prism' ? 0.85 : 1;
    const damageRatio = clampNumber(
      (0.14 + Math.pow(lowerBoardDepth, 1.25) * 0.58) * earlyBoardScale * kindScale,
      0,
      0.78
    );
    const damageAmount = Math.floor(brick.maxHp * damageRatio);
    if (damageAmount <= 0) {
      continue;
    }

    brick.hp = Math.max(1, brick.maxHp - damageAmount);
  }
}

function getObjectiveSpawnRow(baseRow: number, run: RogueRunState): number {
  const boardNumber = run.boardsCleared + 1;
  if (boardNumber <= 4) {
    return -0.35;
  }
  if (boardNumber <= 10) {
    return Math.min(baseRow, 1);
  }
  if (boardNumber <= 18) {
    return Math.min(baseRow, 2);
  }
  return baseRow;
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
  const selectedIndex = selectCuratedBoardIndex(
    run.level,
    run.maxLevels,
    run.boardsCleared,
    challengeDefinition.boardPoolShift,
    CURATED_BOARD_CATALOG.length,
    randomInt(run, 0, 39)
  );
  const design = CURATED_BOARD_CATALOG[selectedIndex];
  const coreLaneOffset = pickCoreLaneOffset(design.rows, run);
  const shiftedRows = shiftCuratedRows(design.rows, coreLaneOffset);
  const breathingRows = applyEarlyBoardBreathingRows(shiftedRows, run);
  const baseRows = enforceIndirectCorePath(breathingRows);
  const boardRows = baseRows;

  const bricks: Brick[] = [];
  const hpBase = Math.max(1, Math.round((1 + run.level * 0.14) * challengeDefinition.hpMultiplier));
  let objectiveRow = Math.floor(boardRows.length / 2);
  let objectiveCol = Math.floor(BRICK_COLUMNS / 2);
  const objectiveVariants = getBoardObjectiveVariants(run, run.level, activePathNode.primaryCoreVariant);
  const targetObjectiveCount = objectiveVariants.length;
  const objectiveCoreVariant = objectiveVariants[0] ?? 'yellow';
  let objectiveMaxHp = getBoardObjectiveHp({
    level: run.level,
    maxLevels: run.maxLevels,
    objectiveHpMultiplier: challengeDefinition.objectiveHpMultiplier,
    difficulty: design.difficulty,
    variant: objectiveCoreVariant,
  });

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
        objectiveMaxHp = getBoardObjectiveHp({
          level: run.level,
          maxLevels: run.maxLevels,
          objectiveHpMultiplier: challengeDefinition.objectiveHpMultiplier,
          difficulty: design.difficulty,
          variant: objectiveCoreVariant,
        });
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

      const rowBias = Math.max(0, row - objectiveRow) * 0.2;
      const difficultyBias =
        design.difficulty === 'easy' ? -0.5 : design.difficulty === 'medium' ? 0 : 0.6;
      const hp =
        kind === 'unbreakable'
          ? 999
          : Math.max(
              1,
              Math.round(
                hpBase +
                rowBias +
                difficultyBias +
                (kind === 'reinforced' ? 1 : kind === 'prism' ? 0.45 : 0) +
                randomInt(run, 0, 1)
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

  const buildObjectiveHp = (variant: CoreVariant): number => {
    return getBoardObjectiveHp({
      level: run.level,
      maxLevels: run.maxLevels,
      objectiveHpMultiplier: challengeDefinition.objectiveHpMultiplier,
      difficulty: design.difficulty,
      variant,
    });
  };

  const preferredObjectiveRow = getObjectiveSpawnRow(objectiveRow, run);
  const brickWidth = getBrickWidth();
  const occupiedBrickBounds = bricks.map((brick) => {
    const brickX = getBrickX(brick.col, brickWidth);
    const brickY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
    return getBrickBounds(brick, brickX, brickY, brickWidth);
  });
  const objectiveSlotCandidatesByKey = new Map<string, { row: number; col: number }>();
  const rememberObjectiveSlot = (row: number, col: number) => {
    if (col < 0 || col >= BRICK_COLUMNS) {
      return;
    }
    const key = `${row}:${col}`;
    if (!objectiveSlotCandidatesByKey.has(key)) {
      objectiveSlotCandidatesByKey.set(key, { row, col });
    }
  };

  rememberObjectiveSlot(preferredObjectiveRow, objectiveCol);
  rememberObjectiveSlot(objectiveRow, objectiveCol);
  for (let row = 0; row < boardRows.length; row += 1) {
    const rowPattern = boardRows[row];
    for (let col = 0; col < BRICK_COLUMNS; col += 1) {
      if (rowPattern[col] === '.') {
        rememberObjectiveSlot(row, col);
      }
    }
  }

  const objectiveBrickIds: string[] = [];
  const placedObjectives: Array<{
    row: number;
    col: number;
    bounds: { x: number; y: number; width: number; height: number };
  }> = [];
  const objectiveSlotCandidates = Array.from(objectiveSlotCandidatesByKey.values());
  const isObjectiveSlotClear = (slot: { row: number; col: number }, variant: CoreVariant) => {
    const objectiveHp = buildObjectiveHp(variant);
    const previewBrick: Brick = {
      id: 'preview-objective',
      row: slot.row,
      col: slot.col,
      hp: objectiveHp,
      maxHp: objectiveHp,
      kind: 'objective',
      coreVariant: variant,
    };
    const objectiveX = getBrickX(slot.col, brickWidth);
    const objectiveY = BRICK_TOP + slot.row * (BRICK_HEIGHT + BRICK_GAP);
    const candidateBounds = getBrickBounds(previewBrick, objectiveX, objectiveY, brickWidth);
    if (occupiedBrickBounds.some((bounds) => doBrickBoundsOverlap(bounds, candidateBounds))) {
      return false;
    }
    if (placedObjectives.some((placed) => doBrickBoundsOverlap(placed.bounds, candidateBounds))) {
      return false;
    }
    // Reject slot if orb would be blocked on 3+ sides (unbreakable brick or canvas wall)
    const cardinalNeighbors = [
      { row: slot.row - 1, col: slot.col },
      { row: slot.row + 1, col: slot.col },
      { row: slot.row, col: slot.col - 1 },
      { row: slot.row, col: slot.col + 1 },
    ];
    let blockedSides = 0;
    for (const neighbor of cardinalNeighbors) {
      if (neighbor.col < 0 || neighbor.col >= BRICK_COLUMNS) {
        blockedSides += 1;
        continue;
      }
      const neighborBrick = bricks.find((b) => b.row === neighbor.row && b.col === neighbor.col);
      if (neighborBrick && (neighborBrick.kind ?? 'standard') === 'unbreakable') {
        blockedSides += 1;
      }
    }
    if (blockedSides >= 3) {
      return false;
    }
    return true;
  };

  const compareObjectiveSlots = (left: { row: number; col: number }, right: { row: number; col: number }) => {
    const leftDistanceFromPreferred = Math.abs(left.row - preferredObjectiveRow) + Math.abs(left.col - objectiveCol);
    const rightDistanceFromPreferred = Math.abs(right.row - preferredObjectiveRow) + Math.abs(right.col - objectiveCol);

    if (placedObjectives.length === 0) {
      if (leftDistanceFromPreferred !== rightDistanceFromPreferred) {
        return leftDistanceFromPreferred - rightDistanceFromPreferred;
      }
      if (left.row !== right.row) {
        return left.row - right.row;
      }
      return Math.abs(left.col - objectiveCol) - Math.abs(right.col - objectiveCol);
    }

    const getPlacementScore = (slot: { row: number; col: number }) => {
      const rowGaps = placedObjectives.map((placed) => Math.abs(slot.row - placed.row));
      const colGaps = placedObjectives.map((placed) => Math.abs(slot.col - placed.col));
      return {
        fullySeparated: placedObjectives.every((placed) => Math.abs(slot.row - placed.row) >= 3 && Math.abs(slot.col - placed.col) >= 3),
        minRowGap: Math.min(...rowGaps),
        minColGap: Math.min(...colGaps),
        distanceFromPreferred: Math.abs(slot.row - preferredObjectiveRow) + Math.abs(slot.col - objectiveCol),
      };
    };

    const leftScore = getPlacementScore(left);
    const rightScore = getPlacementScore(right);
    if (leftScore.fullySeparated !== rightScore.fullySeparated) {
      return leftScore.fullySeparated ? -1 : 1;
    }
    if (leftScore.minRowGap !== rightScore.minRowGap) {
      return rightScore.minRowGap - leftScore.minRowGap;
    }
    if (leftScore.minColGap !== rightScore.minColGap) {
      return rightScore.minColGap - leftScore.minColGap;
    }
    if (leftScore.distanceFromPreferred !== rightScore.distanceFromPreferred) {
      return leftScore.distanceFromPreferred - rightScore.distanceFromPreferred;
    }
    if (left.row !== right.row) {
      return left.row - right.row;
    }
    return Math.abs(left.col - objectiveCol) - Math.abs(right.col - objectiveCol);
  };

  const requiredPrimaryObjectivesForMajority = Math.floor(targetObjectiveCount / 2) + 1;
  let primaryObjectivesPlaced = 0;
  for (let objectiveIndex = 0; objectiveIndex < targetObjectiveCount; objectiveIndex += 1) {
    const plannedVariant = objectiveVariants[objectiveIndex] ?? objectiveCoreVariant;
    const variant =
      plannedVariant !== objectiveCoreVariant && primaryObjectivesPlaced < requiredPrimaryObjectivesForMajority
        ? objectiveCoreVariant
        : plannedVariant;
    const objectiveHp = objectiveIndex === 0 ? objectiveMaxHp : buildObjectiveHp(variant);
    const availableSlots = objectiveSlotCandidates
      .filter((slot) => !placedObjectives.some((placed) => placed.row === slot.row && placed.col === slot.col))
      .filter((slot) => isObjectiveSlotClear(slot, variant))
      .sort(compareObjectiveSlots);
    const selectedSlot = availableSlots[0];
    if (!selectedSlot) {
      continue;
    }

    const objectiveId = `${design.id}-objective-${run.level}-${selectedSlot.row}-${selectedSlot.col}-${Math.round(nextRandom(run) * 1_000_000)}`;
    const objectiveBrick: Brick = {
      id: objectiveId,
      row: selectedSlot.row,
      col: selectedSlot.col,
      hp: objectiveHp,
      maxHp: objectiveHp,
      kind: 'objective',
      coreVariant: variant,
    };
    const objectiveX = getBrickX(selectedSlot.col, brickWidth);
    const objectiveY = BRICK_TOP + selectedSlot.row * (BRICK_HEIGHT + BRICK_GAP);
    const objectiveBounds = getBrickBounds(objectiveBrick, objectiveX, objectiveY, brickWidth);

    bricks.push(objectiveBrick);
    objectiveBrickIds.push(objectiveId);
    placedObjectives.push({ row: selectedSlot.row, col: selectedSlot.col, bounds: objectiveBounds });
    if (variant === objectiveCoreVariant) {
      primaryObjectivesPlaced += 1;
    }
  }

  // Defensive pass: keep the selected map-node color as the majority whenever 2+ objectives spawn.
  if (objectiveBrickIds.length > 1) {
    const requiredPrimaryCount = Math.floor(objectiveBrickIds.length / 2) + 1;
    const primaryObjectiveIds = objectiveBrickIds.filter((objectiveId) => {
      const objectiveBrick = bricks.find((brick) => brick.id === objectiveId);
      return objectiveBrick?.kind === 'objective' && (objectiveBrick.coreVariant ?? 'yellow') === objectiveCoreVariant;
    });
    let primaryCount = primaryObjectiveIds.length;
    if (primaryCount < requiredPrimaryCount) {
      for (const objectiveId of objectiveBrickIds) {
        if (primaryCount >= requiredPrimaryCount) {
          break;
        }
        const objectiveBrick = bricks.find((brick) => brick.id === objectiveId);
        if (!objectiveBrick || objectiveBrick.kind !== 'objective') {
          continue;
        }
        if ((objectiveBrick.coreVariant ?? 'yellow') === objectiveCoreVariant) {
          continue;
        }
        const primaryObjectiveHp = buildObjectiveHp(objectiveCoreVariant);
        objectiveBrick.coreVariant = objectiveCoreVariant;
        objectiveBrick.maxHp = primaryObjectiveHp;
        objectiveBrick.hp = primaryObjectiveHp;
        primaryCount += 1;
      }
    }
  }

  applyEarlyBoardPreDamage(bricks, run);

  // Post-placement: ensure every orb has at least one brick below it in its column
  // to prevent a direct vertical shot from the launcher.
  for (const objId of objectiveBrickIds) {
    const orb = bricks.find((b) => b.id === objId);
    if (!orb) {
      continue;
    }
    const hasBrickBelow = bricks.some(
      (b) => b.col === orb.col && b.row > orb.row && b.id !== objId
    );
    if (!hasBrickBelow && orb.row + 1 < boardRows.length) {
      const blockerHp = Math.max(1, Math.round((1 + run.level * 0.14)));
      bricks.push({
        id: `lane-blocker-${run.level}-${orb.col}-${orb.row + 1}`,
        row: orb.row + 1,
        col: orb.col,
        hp: blockerHp,
        maxHp: blockerHp,
        kind: 'standard',
      });
    }
  }

  return {
    turn: 1,
    objectiveBrickId: objectiveBrickIds[0] ?? null,
    objectiveBrickIds,
    bricks,
  };
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

function getPowerOfferManaCost(nextLevel: number): number {
  const normalizedLevel = Math.max(1, Math.floor(nextLevel));
  return Math.max(
    BALANCE.powerOfferBaseManaCost,
    Math.round(BALANCE.powerOfferBaseManaCost * Math.pow(BALANCE.powerOfferCostGrowthRate, normalizedLevel - 1))
  );
}

function createPowerOffer(template: RuntimePowerTemplate, currentLevel: number): PowerOffer {
  const clampedCurrentLevel = Math.max(0, Math.floor(currentLevel));
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    manaCost: getPowerOfferManaCost(clampedCurrentLevel + 1),
  };
}

function canOfferPowerTemplate(template: RuntimePowerTemplate, run: RogueRunState): boolean {
  return getRunPowerLevel(run, template.id) < template.maxLevel;
}

function refreshPowerOffers(offers: PowerOffer[], run: RogueRunState): PowerOffer[] {
  const refreshed = offers.flatMap((offer) => {
    const template = POWER_POOL.find((item) => item.id === offer.id);
    if (!template || !canOfferPowerTemplate(template, run)) {
      return [];
    }

    return [createPowerOffer(template, run.powers[template.id] ?? 0)];
  });

  const pickedIds = new Set(refreshed.map((offer) => offer.id));
  const availableTemplates = POWER_POOL.filter(
    (template) => !pickedIds.has(template.id) && canOfferPowerTemplate(template, run)
  );
  while (refreshed.length < Math.min(BALANCE.powerOfferCount, POWER_POOL.length) && availableTemplates.length > 0) {
    const templateIndex = randomInt(run, 0, availableTemplates.length - 1);
    const [template] = availableTemplates.splice(templateIndex, 1);
    if (!template) {
      continue;
    }
    refreshed.push(createPowerOffer(template, run.powers[template.id] ?? 0));
  }
  return refreshed;
}

function makePowerOffers(run: RogueRunState): PowerOffer[] {
  const offers: PowerOffer[] = [];
  const picked = new Set<string>();
  const availableTemplates = POWER_POOL.filter((template) => canOfferPowerTemplate(template, run));
  const offerCount = Math.min(BALANCE.powerOfferCount, availableTemplates.length);

  while (offers.length < offerCount && picked.size < availableTemplates.length) {
    const template = availableTemplates[randomInt(run, 0, availableTemplates.length - 1)];
    if (picked.has(template.id)) {
      continue;
    }
    picked.add(template.id);
    offers.push(createPowerOffer(template, run.powers[template.id] ?? 0));
  }

  return offers;
}

function buildStartingRunPowerChoices(): string[] {
  return SPOILS_POOL.map((template) => template.id);
}

function upgradeCost(def: PermanentUpgradeDefinition, rank: number): number {
  return Math.round(def.baseCost * Math.pow(def.costScale, rank));
}

function buildBoardAchievements(summary: BoardSummary): string[] {
  const achievements: string[] = [];
  if (summary.shotsTaken === 1) {
    achievements.push('One Shot Wonder');
  }
  if (summary.bounceCount >= 30) {
    achievements.push('Ricochet Wizard');
  } else if (summary.bounceCount >= 16) {
    achievements.push('Bank Shot Specialist');
  }
  if (summary.shotsTaken <= 2 && summary.bounceCount >= 10) {
    achievements.push('Orb Killer');
  }
  if (summary.killShotBricksBeforeOrb >= TPose_THRESHOLD_BRICKS_BEFORE_ORB) {
    achievements.push('T Pose');
  }
  if (summary.slowAndSteadyShots > 0) {
    achievements.push('Slow and Steady');
  }
  if (summary.giggidyBalls > 0) {
    achievements.push('Giggidy');
  }
  return achievements;
}

function getShotEfficiencyMultiplier(shots: number): number {
  if (shots === 1) return 3.0;
  if (shots === 2) return 2.0;
  if (shots === 3) return 1.0;
  if (shots <= 9) return Math.max(0.1, 1.0 - (shots - 3) * 0.15);
  return 0.0;
}

function computeSkillBonuses(opts: {
  shotsTaken: number;
  manualBricksDestroyed: number;
  killShotBricksBeforeOrb: number;
  cleanPlateAwarded: boolean;
  slowAndSteadyShots: number;
  giggidyBalls: number;
  bestBallRebounds: number;
  manaRaw: number;
}): { bonuses: BoardSkillBonus[]; manaBonus: number } {
  const bonuses: BoardSkillBonus[] = [];

  // Shot efficiency: multiplier applied to raw board mana
  const shotMultiplier = getShotEfficiencyMultiplier(opts.shotsTaken);
  if (shotMultiplier !== 1.0) {
    const shotBonusMana = Math.round(opts.manaRaw * (shotMultiplier - 1.0));
    bonuses.push({
      id: 'efficiency',
      label: shotMultiplier >= 1 ? `${shotMultiplier}× Efficiency` : 'Shot Debt',
      detail: `${opts.shotsTaken} shot${opts.shotsTaken === 1 ? '' : 's'}`,
      mana: shotBonusMana,
    });
  }

  // T Pose: orb destroyed with many non-orb bricks in the same turn
  if (opts.killShotBricksBeforeOrb >= TPose_THRESHOLD_BRICKS_BEFORE_ORB) {
    bonuses.push({
      id: 'precision-kill',
      label: 'T Pose',
      detail: `${opts.killShotBricksBeforeOrb} bricks before Orb`,
      mana: 8,
    });
  }

  if (opts.cleanPlateAwarded) {
    bonuses.push({
      id: 'clean-plate',
      label: 'Clean Plate',
      detail: 'Cleared all breakable bricks before the final Orb',
      mana: 200,
    });
  }

  // Manual mastery: bricks broken without homing automation
  const manual = opts.manualBricksDestroyed;
  if (manual >= 20) {
    bonuses.push({ id: 'manual-mastery', label: 'Root Sapper III', detail: `${manual} manual breaks`, mana: 7 });
  } else if (manual >= 12) {
    bonuses.push({ id: 'manual-mastery', label: 'Root Sapper II', detail: `${manual} manual breaks`, mana: 4 });
  } else if (manual >= 6) {
    bonuses.push({ id: 'manual-mastery', label: 'Root Sapper I', detail: `${manual} manual breaks`, mana: 2 });
  }

  if (opts.slowAndSteadyShots > 0) {
    bonuses.push({
      id: 'slow-and-steady',
      label: 'Slow and Steady',
      detail: `${opts.slowAndSteadyShots} shot${opts.slowAndSteadyShots === 1 ? '' : 's'} over 10s`,
      mana: opts.slowAndSteadyShots * 100,
    });
  }

  if (opts.giggidyBalls > 0) {
    bonuses.push({
      id: 'giggidy',
      label: 'Giggidy',
      detail: `${opts.giggidyBalls} ball${opts.giggidyBalls === 1 ? '' : 's'} over 50 rebounds`,
      mana: opts.giggidyBalls * 500,
    });
  }

  const manaBonus = bonuses.reduce((sum, b) => sum + b.mana, 0);
  return { bonuses, manaBonus };
}

function parseProgress(json: string): RogueBrickProfile | null {
  return parseRogueBrickProgress(json, ROGUE_BRICK_PROFILE_NORMALIZATION_OPTIONS);
}

function getBrickAssetFileName(kind: BrickKind, state: BrickArtState, weakSide?: OneWaySide): string {
  if (kind === 'oneway') {
    const direction =
      weakSide === 'left'
        ? 'left'
        : weakSide === 'right'
          ? 'right'
          : weakSide === 'bottom'
            ? 'down'
            : 'up';
    return `brick_oneway_${direction}_${state}.png`;
  }
  const normalizedKind = kind === 'standard' ? 'standard' : kind;
  return `brick_${normalizedKind}_${state}.png`;
}

export default function RogueBrickPage() {
  const layoutShellRef = useRef<HTMLElement | null>(null);
  const brickLayoutRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const boardFrameRef = useRef<HTMLDivElement | null>(null);
  const brickAssetImageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const targetAtlasImageRef = useRef<HTMLImageElement | null>(null);
  const targetAtlasCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetAtlasTileBoundsRef = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const profileRef = useRef<RogueBrickProfile | null>(null);
  const animationRef = useRef<number | null>(null);
  const ballsRef = useRef<BallRuntime[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const launchQueueRef = useRef<LaunchQueueItem[]>([]);
  const launchElapsedRef = useRef(0);
  const pendingRewardsRef = useRef<TurnRewards>({ mana: 0, essenceByColor: { yellow: 0, blue: 0, green: 0 } });
  const pendingDestroyedBricksRef = useRef(0);
  const pendingBounceCountRef = useRef(0);
  const pendingManualBricksThisTurnRef = useRef(0);
  const pendingPreOrbBricksThisTurnRef = useRef(0);
  const pendingKillShotBricksBeforeOrbRef = useRef(0);
  const pendingCleanPlateAwardedRef = useRef(false);
  const pendingMaxBallReboundsThisTurnRef = useRef(0);
  const pendingGiggidyBallsThisTurnRef = useRef(0);
  const lastBottomCrossingXRef = useRef<number | null>(null);
  const coreChargeRef = useRef(0);
  const homingBarrageUsedRef = useRef(false);
  const homingBulletTimeHitsRef = useRef(0);
  const shotStartedAtMsRef = useRef<number | null>(null);
  const nextBoardShotAvailableAtMsRef = useRef(0);
  const nextWardenShotAvailableAtMsRef = useRef(0);
  const wardenVolleysFiredThisEncounterRef = useRef(0);
  const pendingShotLaunchesThisTurnRef = useRef(0);
  const finalBrickCinematicUntilRef = useRef(0);
  const brickVisualRef = useRef<Map<string, BrickVisualState>>(new Map());
  const breakParticlesRef = useRef<BreakParticle[]>([]);
  const manaBonusEventTextsRef = useRef<ManaBonusEventText[]>([]);
  const manaBonusEventTextLastUpdateAtRef = useRef<number | null>(null);
  const boardAdvanceAnimationRef = useRef<BoardAdvanceAnimationState | null>(null);
  const coreBreachFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbSlotUpgradeFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coreBreachLaunchFrameRef = useRef<number | null>(null);
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
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [aimPoint, setAimPoint] = useState<{ x: number; y: number } | null>(null);
  const aimPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const [shotInProgress, setShotInProgress] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPowerDrawerExpanded, setIsPowerDrawerExpanded] = useState(false);
  const [previewStartingPowerId, setPreviewStartingPowerId] = useState<string | null>(null);
  const [pendingStartingRunPowerId, setPendingStartingRunPowerId] = useState<string | null>(null);
  const [selectedPowerId, setSelectedPowerId] = useState<string | null>(null);
  const [selectedResourceHelp, setSelectedResourceHelp] = useState<ResourceHelpKey | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dismissedDefeatSummaryCompletedAt, setDismissedDefeatSummaryCompletedAt] = useState<number | null>(null);
  const [autoHomingLaunchPending, setAutoHomingLaunchPending] = useState(false);
  const [isCoreBreachFlashing, setIsCoreBreachFlashing] = useState(false);
  const [coreBreachFlashVariant, setCoreBreachFlashVariant] = useState<CoreVariant>('yellow');
  const [orbSlotUpgradeFlash, setOrbSlotUpgradeFlash] = useState<OrbSlotUpgradeFlash | null>(null);
  const [targetArtStyle, setTargetArtStyle] = useState<TargetArtStyle>('atlas');
  const [, setIsTargetAtlasReady] = useState(false);
  const [normalModeEssenceTopPx, setNormalModeEssenceTopPx] = useState<number | null>(null);
  const [normalModeEssenceLeftPx, setNormalModeEssenceLeftPx] = useState<number | null>(null);
  const [startingRunPowerChoices, setStartingRunPowerChoices] = useState<string[]>([]);
  const [powerPopoverLayout, setPowerPopoverLayout] = useState({ left: 8, top: 0, arrow: 136 });
  const [isPathSliding, setIsPathSliding] = useState(false);
  const [pendingPathNodeId, setPendingPathNodeId] = useState<string | null>(null);
  const [hoveredPathNodeId, setHoveredPathNodeId] = useState<string | null>(null);
  const [wardenSelectedShotCount, setWardenSelectedShotCount] = useState(WARDEN_SHOT_BASE_COUNT);
  const [wardenSelectedPower, setWardenSelectedPower] = useState(1);
  const [wardenEyeHp, setWardenEyeHp] = useState<number[]>([WARDEN_BLANK_HP_MAX]);
  const wardenEyeHpRef = useRef<number[]>([WARDEN_BLANK_HP_MAX]);
  const [wardenDefeatCinematicUntilMs, setWardenDefeatCinematicUntilMs] = useState<number | null>(null);
  const wardenDefeatResolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wardenBossHitFlashUntilMs, setWardenBossHitFlashUntilMs] = useState(0);
  const wardenNextTearSecRef = useRef(9); // countdown to next tear reach; drives tear falling progress
  const wardenNextTearEyeIndexRef = useRef(0);
  const wardenTearFallProgressRef = useRef(0);
  // Active independent tear drop (detached from Blank's position once released)
  const [, setWardenActiveTear] = useState<WardenActiveTear | null>(null);
  const wardenDisplayedLaunchOriginXRef = useRef(DEFAULT_LAUNCH_ORIGIN_X);
  const wardenLaunchOriginTweenRef = useRef<{
    startX: number;
    endX: number;
    startedAtMs: number;
    durationMs: number;
  } | null>(null);
  const wardenActiveTearRef = useRef<WardenActiveTear | null>(null);
  const wardenBodySpriteRef = useRef<HTMLImageElement | null>(null);
  const wardenTearSpriteRef = useRef<HTMLImageElement | null>(null);
  const wardenLidSpritesRef = useRef<{
    open: HTMLImageElement | null;
    lid25: HTMLImageElement | null;
    lid50: HTMLImageElement | null;
    lid75: HTMLImageElement | null;
    closed: HTMLImageElement | null;
  }>({ open: null, lid25: null, lid50: null, lid75: null, closed: null });
  const wardenBallLastFrameMsRef = useRef<number | null>(null);
  const wardenVolleyDamagePerHitRef = useRef(1);
  const wardenVolleyTearDamageRef = useRef(8);
  const wardenImpactParticlesRef = useRef<WardenImpactParticle[]>([]);
  const wardenLaunchConfigRef = useRef<{
    originX: number;
    direction: { x: number; y: number };
    baseSpeed: number;
    radius: number;
    mass: number;
    spreadScale: number;
    shotCount: number;
    shotCap: number;
  } | null>(null);
  const wardenShieldStartBlueRef = useRef(1);
  const wardenStartOrangeRef = useRef(1);
  const wardenStartGreenRef = useRef(1);
  const wardenPathTimeRef = useRef(0);
  const wardenPathLastFrameMsRef = useRef<number | null>(null);
  const [, setWardenShieldHp] = useState(WARDEN_SHIELD_BASE_PIPS);
  const wardenShieldHpRef = useRef(WARDEN_SHIELD_BASE_PIPS);
  const wardenShieldMaxRef = useRef(WARDEN_SHIELD_BASE_PIPS);
  const wardenShieldGraceUntilMsRef = useRef<number | null>(null);
  const wardenShieldRegenUsedSinceLastTearRef = useRef(false);
  const applyPrototypeWardenTearHitRef = useRef<() => void>(() => {});
  const triggerWardenTearShieldImpact = useCallback((tearX: number, impactY: number = LOSE_Y) => {
    const activeTear = wardenActiveTearRef.current;
    if (!activeTear || activeTear.phase !== 'falling') {
      return;
    }

    for (let index = 0; index < 14; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 155;
      wardenImpactParticlesRef.current.push({
        x: tearX,
        y: impactY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.4 + Math.random() * 2,
        ageMs: 0,
        lifeMs: 190 + Math.random() * 150,
        color: 'rgba(96, 210, 255, ALPHA)',
      });
    }

    const hitTear = { ...activeTear, phase: 'hit' as const };
    wardenActiveTearRef.current = hitTear;
    setWardenActiveTear(hitTear);
    applyPrototypeWardenTearHitRef.current();

    window.setTimeout(() => {
      if (wardenActiveTearRef.current?.phase === 'hit') {
        const goneTear = { ...wardenActiveTearRef.current, phase: 'gone' as const };
        wardenActiveTearRef.current = goneTear;
        setWardenActiveTear(goneTear);
      }
    }, 110);
  }, []);
  // Canvas-space refs for warden drawing (readable from draw() without stale closures)
  const blankCanvasPosRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT * 0.18 });
  const blankEyeCanvasPositionsRef = useRef<Array<{ x: number; y: number }>>([{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT * 0.18 }]);
  const isWardenLidClosedRef = useRef(false);
  const wardenLidProgressRef = useRef(0); // 0=open, 1=closed
  const isWardenSecondLidClosedRef = useRef(false);
  const wardenSecondLidProgressRef = useRef(0);
  const wardenAnimationRef = useRef<number | null>(null);
  const lastHubLevelRef = useRef<number | null>(null);
  const pathTreeScrollRef = useRef<HTMLDivElement | null>(null);
  const lastPathAutoScrollKeyRef = useRef<string | null>(null);
  const [liveHud, setLiveHud] = useState<LiveHudState>({
    destroyedBricks: 0,
    manaEarned: 0,
    remainingBricks: 0,
    essenceByColor: { yellow: 0, blue: 0, green: 0 },
  });
  const [, setFrameUpdateTrigger] = useState(0);

  const run = profile?.run ?? null;
  const targetArtStyleLabel = TARGET_ART_STYLE_LABELS[targetArtStyle];
  const playablePathNodeIds = (() => {
    if (!run || run.stage !== 'hub') {
      return null;
    }
    const currentNode = getCurrentPathNode(run);
    return new Set(derivePathChildren(run, currentNode).map((node) => node.id));
  })();
  const activePendingPathNodeId =
    pendingPathNodeId && playablePathNodeIds?.has(pendingPathNodeId) ? pendingPathNodeId : null;
  const activeHoveredPathNodeId = run?.stage === 'hub' ? hoveredPathNodeId : null;

  useEffect(() => {
    wardenEyeHpRef.current = wardenEyeHp;
  }, [wardenEyeHp]);

  useEffect(() => {
    if (run?.stage !== 'hub') {
      return;
    }
    const previousHubLevel = lastHubLevelRef.current;
    lastHubLevelRef.current = run.level;
    if (previousHubLevel === null || run.level <= previousHubLevel) {
      return;
    }
    setIsPathSliding(true);
    const timer = window.setTimeout(() => {
      setIsPathSliding(false);
    }, PATH_SLIDE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [run?.level, run?.stage]);

  const resetWardenEncounterState = useCallback(() => {
    if (wardenDefeatResolveTimeoutRef.current !== null) {
      window.clearTimeout(wardenDefeatResolveTimeoutRef.current);
      wardenDefeatResolveTimeoutRef.current = null;
    }
    const defaultEyeHp = [WARDEN_BLANK_HP_MAX];
    setWardenEyeHp(defaultEyeHp);
    wardenEyeHpRef.current = defaultEyeHp;
    setWardenDefeatCinematicUntilMs(null);
    isWardenLidClosedRef.current = false;
    wardenLidProgressRef.current = 0;
    isWardenSecondLidClosedRef.current = false;
    wardenSecondLidProgressRef.current = 0;
    wardenNextTearSecRef.current = getWardenTearCountdownSec(
      WARDEN_TEAR_DEFAULT_DETACH_SEC,
      WARDEN_TEAR_FIRST_STARTUP_SEC
    );
    wardenNextTearEyeIndexRef.current = 0;
    wardenTearFallProgressRef.current = 0;
    wardenBallLastFrameMsRef.current = null;
    wardenImpactParticlesRef.current = [];
    wardenLaunchConfigRef.current = null;
    wardenDisplayedLaunchOriginXRef.current = DEFAULT_LAUNCH_ORIGIN_X;
    wardenLaunchOriginTweenRef.current = null;
    ballsRef.current = [];
    launchQueueRef.current = [];
    launchElapsedRef.current = 0;
    shotInFlightRef.current = false;
    setShotInProgress(false);
    setWardenActiveTear(null);
    wardenActiveTearRef.current = null;
    const defaultShieldMax = WARDEN_SHIELD_BASE_PIPS;
    wardenShieldHpRef.current = defaultShieldMax;
    wardenShieldMaxRef.current = defaultShieldMax;
    wardenShieldGraceUntilMsRef.current = null;
    wardenShieldRegenUsedSinceLastTearRef.current = false;
    setWardenShieldHp(defaultShieldMax);
    wardenShieldStartBlueRef.current = 1;
    wardenStartOrangeRef.current = 1;
    wardenStartGreenRef.current = 1;
    wardenPathTimeRef.current = 0;
    wardenPathLastFrameMsRef.current = null;
    blankEyeCanvasPositionsRef.current = [{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT * 0.18 }];
  }, []);

  const initializeWardenEncounterState = useCallback((currentRun: RogueRunState) => {
    const encounterProfile = getBlankEncounterProfile(currentRun);
    const volleyCaps = getWardenVolleyCaps(currentRun, WARDEN_SHOT_BASE_COUNT);
    setWardenSelectedShotCount(volleyCaps.shotCap);
    setWardenSelectedPower(volleyCaps.powerCap);
    isWardenLidClosedRef.current = false;
    wardenLidProgressRef.current = 0;
    isWardenSecondLidClosedRef.current = false;
    wardenSecondLidProgressRef.current = 0;
    const initialEyeHp = normalizeBlankEyeHp([], encounterProfile.dualEyes, encounterProfile.hpPerEye);
    setWardenEyeHp(initialEyeHp);
    wardenEyeHpRef.current = initialEyeHp;
    if (wardenDefeatResolveTimeoutRef.current !== null) {
      window.clearTimeout(wardenDefeatResolveTimeoutRef.current);
      wardenDefeatResolveTimeoutRef.current = null;
    }
    setWardenDefeatCinematicUntilMs(null);
    setWardenBossHitFlashUntilMs(0);
    blankCanvasPosRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT * 0.18 };
    blankEyeCanvasPositionsRef.current = [{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT * 0.18 }];
    wardenNextTearSecRef.current = getWardenTearCountdownSec(
      encounterProfile.tearDetachAtSec,
      WARDEN_TEAR_FIRST_STARTUP_SEC
    );
    wardenNextTearEyeIndexRef.current = 0;
    wardenTearFallProgressRef.current = 0;
    wardenBallLastFrameMsRef.current = null;
    wardenImpactParticlesRef.current = [];
    wardenLaunchConfigRef.current = null;
    wardenDisplayedLaunchOriginXRef.current = getLaunchOriginX(currentRun);
    wardenLaunchOriginTweenRef.current = null;
    ballsRef.current = [];
    launchQueueRef.current = [];
    launchElapsedRef.current = 0;
    shotInFlightRef.current = false;
    setShotInProgress(false);
    setWardenActiveTear(null);
    wardenActiveTearRef.current = null;
    wardenShieldStartBlueRef.current = Math.max(0, Math.floor(currentRun.essenceByColor.blue));
    wardenStartOrangeRef.current = Math.max(1, Math.floor(currentRun.essenceByColor.yellow));
    wardenStartGreenRef.current = Math.max(1, Math.floor(currentRun.essenceByColor.green));
    wardenPathTimeRef.current = 0;
    wardenPathLastFrameMsRef.current = null;
    const initialShieldMax = WARDEN_SHIELD_BASE_PIPS + Math.max(0, Math.floor(currentRun.essenceByColor.blue));
    wardenShieldMaxRef.current = initialShieldMax;
    wardenShieldHpRef.current = initialShieldMax;
    wardenShieldGraceUntilMsRef.current = null;
    wardenShieldRegenUsedSinceLastTearRef.current = false;
    setWardenShieldHp(initialShieldMax);
    nextWardenShotAvailableAtMsRef.current = 0;
    wardenVolleysFiredThisEncounterRef.current = 0;
  }, []);

  useEffect(() => {
    if (run?.stage !== 'warden') {
      const frameId = window.requestAnimationFrame(() => {
        resetWardenEncounterState();
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    const currentRun = profileRef.current?.run;
    if (!currentRun || currentRun.stage !== 'warden') {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      initializeWardenEncounterState(currentRun);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [initializeWardenEncounterState, resetWardenEncounterState, run?.activeWardenId, run?.stage]);

  useEffect(() => {
    if (run?.stage !== 'warden') {
      return;
    }
    const currentRun = profileRef.current?.run;
    if (!currentRun || currentRun.stage !== 'warden') {
      return;
    }
    const encounterProfile = getBlankEncounterProfile(currentRun);

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    let secondBlinkOffsetTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleNextBlink = () => {
      isWardenLidClosedRef.current = !isWardenLidClosedRef.current;
      if (encounterProfile.dualEyes) {
        const offsetMs = 45 + Math.floor(Math.random() * 140);
        if (secondBlinkOffsetTimeout !== null) {
          window.clearTimeout(secondBlinkOffsetTimeout);
          secondBlinkOffsetTimeout = null;
        }
        secondBlinkOffsetTimeout = window.setTimeout(() => {
          isWardenSecondLidClosedRef.current = isWardenLidClosedRef.current;
          secondBlinkOffsetTimeout = null;
        }, offsetMs);
      } else {
        isWardenSecondLidClosedRef.current = isWardenLidClosedRef.current;
      }
      const hpPct = clampNumber(
        getBlankCombinedHp(wardenEyeHpRef.current, encounterProfile.dualEyes, encounterProfile.hpPerEye) /
          Math.max(1, getBlankEncounterHpMax(encounterProfile.dualEyes, encounterProfile.hpPerEye)),
        0,
        1
      );
      const aggression = 1 - hpPct;
      const minMs = Math.max(420, Math.round(1500 - aggression * 900));
      const maxMs = Math.max(minMs + 140, Math.round(2600 - aggression * 1300));
      const baseDelay = Math.round(minMs + Math.random() * (maxMs - minMs));
      const nextDelay = isWardenLidClosedRef.current ? Math.max(90, Math.round(baseDelay * 0.5)) : baseDelay;
      blinkTimeout = window.setTimeout(scheduleNextBlink, nextDelay);
    };
    blinkTimeout = window.setTimeout(scheduleNextBlink, 1100);

    const tearCadenceTickMs = 1000;
    const tearInterval = window.setInterval(() => {
      const encounterNow = performance.now();
      const combinedHp = getBlankCombinedHp(
        wardenEyeHpRef.current,
        encounterProfile.dualEyes,
        encounterProfile.hpPerEye
      );
      if (combinedHp <= 0) {
        if (wardenActiveTearRef.current) {
          wardenActiveTearRef.current = null;
          setWardenActiveTear(null);
          wardenTearFallProgressRef.current = 0;
        }
        return;
      }

      wardenNextTearSecRef.current = wardenNextTearSecRef.current - 1;
      const sec = wardenNextTearSecRef.current;

      if (sec <= 0) {
        if (wardenActiveTearRef.current?.phase === 'falling') {
          const activeTear = wardenActiveTearRef.current;
          const tearY =
            activeTear.yStartCanvas + wardenTearFallProgressRef.current * (LAUNCHER_Y - activeTear.yStartCanvas);
          triggerWardenTearShieldImpact(activeTear.xCanvas, Math.min(LOSE_Y, tearY));
        } else if (wardenActiveTearRef.current?.phase === 'gone') {
          setWardenActiveTear(null);
          wardenActiveTearRef.current = null;
          wardenTearFallProgressRef.current = 0;
        }
        const hpPct = clampNumber(
          getBlankCombinedHp(wardenEyeHpRef.current, encounterProfile.dualEyes, encounterProfile.hpPerEye) /
            Math.max(1, getBlankEncounterHpMax(encounterProfile.dualEyes, encounterProfile.hpPerEye)),
          0,
          1
        );
        const aggression = 1 - hpPct;
        const repeatStartupSec = Math.round(
          WARDEN_TEAR_REPEAT_STARTUP_SEC -
            (WARDEN_TEAR_REPEAT_STARTUP_SEC - WARDEN_TEAR_REPEAT_STARTUP_MIN_SEC) * aggression
        );
        wardenNextTearSecRef.current = getWardenTearCountdownSec(
          encounterProfile.tearDetachAtSec,
          clampNumber(
            repeatStartupSec,
            WARDEN_TEAR_REPEAT_STARTUP_MIN_SEC,
            WARDEN_TEAR_REPEAT_STARTUP_SEC
          )
        );
      } else if (sec === encounterProfile.tearDetachAtSec && !wardenActiveTearRef.current) {
        const blankEyePositions = blankEyeCanvasPositionsRef.current;
        const hasTwoEyes = encounterProfile.dualEyes && blankEyePositions.length > 1;
        const nextEyeIndex = hasTwoEyes ? wardenNextTearEyeIndexRef.current % blankEyePositions.length : 0;
        const blankPos = blankEyePositions[nextEyeIndex] ?? blankEyePositions[0] ?? blankCanvasPosRef.current;
        if (hasTwoEyes) {
          wardenNextTearEyeIndexRef.current = (nextEyeIndex + 1) % blankEyePositions.length;
        } else {
          wardenNextTearEyeIndexRef.current = 0;
        }
        const newTear = {
          xCanvas: blankPos.x + (Math.random() - 0.5) * 20,
          yStartCanvas: blankPos.y + CANVAS_HEIGHT * 0.07,
          sourceEyeIndex: nextEyeIndex,
          hp: WARDEN_TEAR_HP_MAX,
          phase: 'falling' as const,
          spawnedAtMs: encounterNow,
          revealDurationMs: 220,
        };
        setWardenActiveTear(newTear);
        wardenActiveTearRef.current = newTear;
        wardenTearFallProgressRef.current = 0;
      }
    }, tearCadenceTickMs);

    return () => {
      if (blinkTimeout !== null) {
        window.clearTimeout(blinkTimeout);
      }
      if (secondBlinkOffsetTimeout !== null) {
        window.clearTimeout(secondBlinkOffsetTimeout);
      }
      window.clearInterval(tearInterval);
    };
  }, [run?.activeWardenId, run?.stage, triggerWardenTearShieldImpact]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      targetAtlasImageRef.current = image;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const atlasCtx = canvas.getContext('2d');
      if (!atlasCtx) {
        setIsTargetAtlasReady(false);
        return;
      }
      atlasCtx.drawImage(image, 0, 0);
      const imageData = atlasCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const isLightCheckerPixel = (r: number, g: number, b: number, a: number) => {
        if (a <= 0) {
          return false;
        }
        const maxChannelDelta = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
        return r >= 236 && g >= 236 && b >= 236 && maxChannelDelta <= 7;
      };

      const tilesPerAxis = Math.max(1, Math.floor(canvas.width / TARGET_ATLAS_TILE_SIZE));
      for (let tileRow = 0; tileRow < tilesPerAxis; tileRow += 1) {
        for (let tileCol = 0; tileCol < tilesPerAxis; tileCol += 1) {
          const foreground = new Uint8Array(TARGET_ATLAS_TILE_SIZE * TARGET_ATLAS_TILE_SIZE);
          const protectedPixels = new Uint8Array(TARGET_ATLAS_TILE_SIZE * TARGET_ATLAS_TILE_SIZE);
          const visited = new Uint8Array(TARGET_ATLAS_TILE_SIZE * TARGET_ATLAS_TILE_SIZE);
          const queue: Array<{ x: number; y: number }> = [];
          const tileOriginX = tileCol * TARGET_ATLAS_TILE_SIZE;
          const tileOriginY = tileRow * TARGET_ATLAS_TILE_SIZE;

          for (let y = 0; y < TARGET_ATLAS_TILE_SIZE; y += 1) {
            for (let x = 0; x < TARGET_ATLAS_TILE_SIZE; x += 1) {
              const localIndex = y * TARGET_ATLAS_TILE_SIZE + x;
              const px = tileOriginX + x;
              const py = tileOriginY + y;
              const pixelIndex = (py * canvas.width + px) * 4;
              const r = data[pixelIndex] ?? 0;
              const g = data[pixelIndex + 1] ?? 0;
              const b = data[pixelIndex + 2] ?? 0;
              const a = data[pixelIndex + 3] ?? 0;
              if (!isLightCheckerPixel(r, g, b, a)) {
                foreground[localIndex] = 1;
              }
            }
          }

          for (let y = 0; y < TARGET_ATLAS_TILE_SIZE; y += 1) {
            for (let x = 0; x < TARGET_ATLAS_TILE_SIZE; x += 1) {
              const localIndex = y * TARGET_ATLAS_TILE_SIZE + x;
              if (!foreground[localIndex]) {
                continue;
              }
              for (let dy = -2; dy <= 2; dy += 1) {
                for (let dx = -2; dx <= 2; dx += 1) {
                  const nx = x + dx;
                  const ny = y + dy;
                  if (
                    nx < 0 ||
                    ny < 0 ||
                    nx >= TARGET_ATLAS_TILE_SIZE ||
                    ny >= TARGET_ATLAS_TILE_SIZE
                  ) {
                    continue;
                  }
                  if (dx * dx + dy * dy <= 5) {
                    protectedPixels[ny * TARGET_ATLAS_TILE_SIZE + nx] = 1;
                  }
                }
              }
            }
          }

          const enqueueIfChecker = (x: number, y: number) => {
            if (
              x < 0 ||
              y < 0 ||
              x >= TARGET_ATLAS_TILE_SIZE ||
              y >= TARGET_ATLAS_TILE_SIZE
            ) {
              return;
            }
            const localIndex = y * TARGET_ATLAS_TILE_SIZE + x;
            if (visited[localIndex]) {
              return;
            }
            if (protectedPixels[localIndex]) {
              return;
            }
            const px = tileOriginX + x;
            const py = tileOriginY + y;
            const pixelIndex = (py * canvas.width + px) * 4;
            const r = data[pixelIndex] ?? 0;
            const g = data[pixelIndex + 1] ?? 0;
            const b = data[pixelIndex + 2] ?? 0;
            const a = data[pixelIndex + 3] ?? 0;
            if (!isLightCheckerPixel(r, g, b, a)) {
              return;
            }
            visited[localIndex] = 1;
            queue.push({ x, y });
          };

          for (let edge = 0; edge < TARGET_ATLAS_TILE_SIZE; edge += 1) {
            enqueueIfChecker(edge, 0);
            enqueueIfChecker(edge, TARGET_ATLAS_TILE_SIZE - 1);
            enqueueIfChecker(0, edge);
            enqueueIfChecker(TARGET_ATLAS_TILE_SIZE - 1, edge);
          }

          while (queue.length > 0) {
            const current = queue.pop();
            if (!current) {
              break;
            }
            const px = tileOriginX + current.x;
            const py = tileOriginY + current.y;
            const pixelIndex = (py * canvas.width + px) * 4;
            data[pixelIndex + 3] = 0;

            enqueueIfChecker(current.x - 1, current.y);
            enqueueIfChecker(current.x + 1, current.y);
            enqueueIfChecker(current.x, current.y - 1);
            enqueueIfChecker(current.x, current.y + 1);
          }
        }
      }
      atlasCtx.putImageData(imageData, 0, 0);
      const nextBounds: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (let row = 0; row < tilesPerAxis; row += 1) {
        for (let col = 0; col < tilesPerAxis; col += 1) {
          const tileKey = `${row}-${col}`;
          let minX = TARGET_ATLAS_TILE_SIZE;
          let minY = TARGET_ATLAS_TILE_SIZE;
          let maxX = -1;
          let maxY = -1;
          for (let y = 0; y < TARGET_ATLAS_TILE_SIZE; y += 1) {
            for (let x = 0; x < TARGET_ATLAS_TILE_SIZE; x += 1) {
              const px = col * TARGET_ATLAS_TILE_SIZE + x;
              const py = row * TARGET_ATLAS_TILE_SIZE + y;
              const alphaIndex = (py * canvas.width + px) * 4 + 3;
              if ((data[alphaIndex] ?? 0) > 0) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (maxX < minX || maxY < minY) {
            nextBounds[tileKey] = { x: 0, y: 0, width: TARGET_ATLAS_TILE_SIZE, height: TARGET_ATLAS_TILE_SIZE };
          } else {
            nextBounds[tileKey] = {
              x: Math.max(0, minX - 1),
              y: Math.max(0, minY - 1),
              width: Math.min(TARGET_ATLAS_TILE_SIZE, maxX - minX + 3),
              height: Math.min(TARGET_ATLAS_TILE_SIZE, maxY - minY + 3),
            };
          }
        }
      }
      targetAtlasCanvasRef.current = canvas;
      targetAtlasTileBoundsRef.current = nextBounds;
      setIsTargetAtlasReady(true);
    };
    image.onerror = () => {
      targetAtlasImageRef.current = null;
      targetAtlasCanvasRef.current = null;
      targetAtlasTileBoundsRef.current = {};
      setIsTargetAtlasReady(false);
    };
    image.src = rogueBrickTargetAtlasUrl;
    return () => {
      targetAtlasImageRef.current = null;
      targetAtlasCanvasRef.current = null;
      targetAtlasTileBoundsRef.current = {};
    };
  }, []);

  const spawnManaBonusEventText = useCallback((label: string, x: number, y: number) => {
    const activeTextCount = manaBonusEventTextsRef.current.length;
    manaBonusEventTextsRef.current.push({
      label,
      x: clampCoordinate(x, BOARD_SIDE_CHANNEL_WIDTH + 16, CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH - 16),
      y: clampCoordinate(y - activeTextCount * 13, 34, CANVAS_HEIGHT - 50),
      ageMs: 0,
      lifeMs: BONUS_EVENT_TEXT_ANIMATION_MS,
    });
  }, []);

  useEffect(() => {
    const cache = brickAssetImageCacheRef.current;
    for (const [fileName, fileUrl] of Object.entries(BRICK_ASSET_URLS_BY_FILE)) {
      if (cache[fileName]) {
        continue;
      }
      const image = new Image();
      image.src = fileUrl;
      cache[fileName] = image;
    }
  }, []);

  useEffect(() => {
    const blankBodyImage = new Image();
    blankBodyImage.src = blankBodyIdle01Url;
    wardenBodySpriteRef.current = blankBodyImage;

    const openLidImage = new Image();
    openLidImage.src = blankLidOpenUrl;
    const lid25Image = new Image();
    lid25Image.src = blankLid25Url;
    const lid50Image = new Image();
    lid50Image.src = blankLid50Url;
    const lid75Image = new Image();
    lid75Image.src = blankLid75Url;
    const closedLidImage = new Image();
    closedLidImage.src = blankLidClosedUrl;
    wardenLidSpritesRef.current = {
      open: openLidImage,
      lid25: lid25Image,
      lid50: lid50Image,
      lid75: lid75Image,
      closed: closedLidImage,
    };

    const tearImage = new Image();
    tearImage.src = tearFall01Url;
    wardenTearSpriteRef.current = tearImage;
  }, []);

  useEffect(() => {
    const measureEssenceTop = () => {
      const layoutRect = brickLayoutRef.current?.getBoundingClientRect();
      const boardFrameRect = boardFrameRef.current?.getBoundingClientRect();
      if (!layoutRect || !boardFrameRect) {
        return;
      }
      const topPx = Math.round(boardFrameRect.top - layoutRect.top + boardFrameRect.height * 0.5);
      const leftPx = Math.round(boardFrameRect.left - layoutRect.left);
      setNormalModeEssenceTopPx(topPx);
      setNormalModeEssenceLeftPx(leftPx);
    };

    measureEssenceTop();
    window.addEventListener('resize', measureEssenceTop);
    return () => {
      window.removeEventListener('resize', measureEssenceTop);
    };
  }, [isFocusMode, isPowerDrawerExpanded, profile?.run?.stage]);

  useEffect(() => {
    if (run) {
      const timer = window.setTimeout(() => {
        if (startingRunPowerChoices.length > 0) {
          setStartingRunPowerChoices([]);
        }
        setPendingStartingRunPowerId(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (startingRunPowerChoices.length === 0) {
      const timer = window.setTimeout(() => {
        setStartingRunPowerChoices(buildStartingRunPowerChoices());
      }, 0);
      return () => window.clearTimeout(timer);
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
    ctx.fillStyle = 'rgba(26, 20, 16, 0.68)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const boardChannelLeftEdge = BOARD_SIDE_CHANNEL_WIDTH;
    const boardChannelRightEdge = CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH;
    const leftChannelGradient = ctx.createLinearGradient(0, 0, boardChannelLeftEdge, 0);
    leftChannelGradient.addColorStop(0, 'rgba(7, 6, 12, 0.1)');
    leftChannelGradient.addColorStop(0.62, 'rgba(7, 6, 12, 0.045)');
    leftChannelGradient.addColorStop(1, 'rgba(7, 6, 12, 0.008)');
    ctx.fillStyle = leftChannelGradient;
    ctx.fillRect(0, 0, boardChannelLeftEdge, CANVAS_HEIGHT);

    const rightChannelGradient = ctx.createLinearGradient(boardChannelRightEdge, 0, CANVAS_WIDTH, 0);
    rightChannelGradient.addColorStop(0, 'rgba(7, 6, 12, 0.008)');
    rightChannelGradient.addColorStop(0.38, 'rgba(7, 6, 12, 0.045)');
    rightChannelGradient.addColorStop(1, 'rgba(7, 6, 12, 0.1)');
    ctx.fillStyle = rightChannelGradient;
    ctx.fillRect(boardChannelRightEdge, 0, BOARD_SIDE_CHANNEL_WIDTH, CANVAS_HEIGHT);
    const now = performance.now();
    const bonusTextLastUpdateAt = manaBonusEventTextLastUpdateAtRef.current;
    const bonusTextDeltaMs =
      bonusTextLastUpdateAt === null ? 0 : Math.max(0, Math.min(64, now - bonusTextLastUpdateAt));
    manaBonusEventTextLastUpdateAtRef.current = now;
    if (bonusTextDeltaMs > 0 && manaBonusEventTextsRef.current.length > 0) {
      manaBonusEventTextsRef.current = manaBonusEventTextsRef.current
        .map((eventText) => ({ ...eventText, ageMs: eventText.ageMs + bonusTextDeltaMs }))
        .filter((eventText) => eventText.ageMs < eventText.lifeMs);
    }

    const profileSnapshot = profileRef.current;
    const runSnapshot = profileSnapshot?.run ?? null;
    if (!runSnapshot) {
      return;
    }

    const brickWidth = getBrickWidth();

    // In warden mode draw Blank + tear instead of bricks
    if (runSnapshot.stage === 'warden') {
      const blankEncounterProfile = getBlankEncounterProfile(runSnapshot);
      const normalizedEyeHp = normalizeBlankEyeHp(wardenEyeHp, blankEncounterProfile.dualEyes, blankEncounterProfile.hpPerEye);
      const combinedHp = getBlankCombinedHp(normalizedEyeHp, blankEncounterProfile.dualEyes, blankEncounterProfile.hpPerEye);
      const hpPct = clampNumber(
        combinedHp / Math.max(1, getBlankEncounterHpMax(blankEncounterProfile.dualEyes, blankEncounterProfile.hpPerEye)),
        0,
        1
      );
      const defeatRemainingMs =
        wardenDefeatCinematicUntilMs === null ? 0 : Math.max(0, wardenDefeatCinematicUntilMs - now);
      const defeatCinematicActive = defeatRemainingMs > 0;
      const defeatElapsedMs = defeatCinematicActive ? 4000 - defeatRemainingMs : 0;
      const shakeStrength = defeatCinematicActive ? Math.max(0, 1 - defeatElapsedMs / 1300) : 0;
      const shakeX = (Math.random() - 0.5) * 18 * shakeStrength;
      const shakeY = (Math.random() - 0.5) * 12 * shakeStrength;
      const blankFadeAlpha = defeatCinematicActive ? clampNumber(1 - defeatElapsedMs / 180, 0, 1) : 1;
      const cinematicTimeScale = defeatCinematicActive ? 0.18 : 1;
      const pathSpeedScale =
        blankEncounterProfile.pathSpeedAtFullHp +
        (blankEncounterProfile.pathSpeedAtLowHp - blankEncounterProfile.pathSpeedAtFullHp) * (1 - hpPct);
      const previousPathFrameMs = wardenPathLastFrameMsRef.current ?? now;
      const pathDtSeconds = Math.max(0, Math.min((now - previousPathFrameMs) / 1000, 0.05)) * cinematicTimeScale;
      wardenPathLastFrameMsRef.current = now;
      wardenPathTimeRef.current += pathDtSeconds * pathSpeedScale;
      const pathTime = wardenPathTimeRef.current;
      ctx.save();
      if (defeatCinematicActive) {
        ctx.translate(shakeX, shakeY);
      }
      const metrics = getBlankEyeRenderMetrics(CANVAS_WIDTH, blankEncounterProfile.dualEyes);
      const blankW = metrics.width;
      const blankH = metrics.height;
      const eyeSpacing = blankEncounterProfile.dualEyes ? Math.max(metrics.spacingPx, blankEncounterProfile.eyeSpacingPx) : 0;
      const blankBaseX = clampNumber(
        CANVAS_WIDTH / 2 + Math.sin(pathTime * 0.38) * (CANVAS_WIDTH * 0.22),
        blankW / 2 + BOARD_SIDE_CHANNEL_WIDTH + 8 + eyeSpacing / 2,
        CANVAS_WIDTH - blankW / 2 - BOARD_SIDE_CHANNEL_WIDTH - 8 - eyeSpacing / 2
      );
      const blankBaseY = CANVAS_HEIGHT * 0.18 + Math.sin(pathTime * 0.24 + 1.1) * (CANVAS_HEIGHT * 0.045);
      const hitJiggle = clampNumber((wardenBossHitFlashUntilMs - now) / 320, 0, 1);
      const blankCenterX = blankBaseX + Math.sin(now * 0.11) * 2.1 * hitJiggle;
      const blankCenterY = blankBaseY + Math.cos(now * 0.15) * 1.4 * hitJiggle;
      const eyeOffsets = blankEncounterProfile.dualEyes ? [-eyeSpacing / 2, eyeSpacing / 2] : [0];
      const blankEyePositions = eyeOffsets.map((offsetX) => ({ x: blankCenterX + offsetX, y: blankCenterY }));
      blankCanvasPosRef.current = blankEyePositions[0] ?? { x: blankCenterX, y: blankCenterY };
      blankEyeCanvasPositionsRef.current = blankEyePositions;

      if (blankFadeAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = blankFadeAlpha;
        if (!defeatCinematicActive) {
          const primaryLidTarget = isWardenLidClosedRef.current ? 1 : 0;
          wardenLidProgressRef.current =
            wardenLidProgressRef.current + (primaryLidTarget - wardenLidProgressRef.current) * 0.1;
          const secondaryLidTarget = isWardenSecondLidClosedRef.current ? 1 : 0;
          wardenSecondLidProgressRef.current =
            wardenSecondLidProgressRef.current + (secondaryLidTarget - wardenSecondLidProgressRef.current) * 0.1;
        }
        const lidSprites = wardenLidSpritesRef.current;
        const pickLidSprite = (lidPct: number) =>
          lidPct >= 0.88
            ? lidSprites.closed
            : lidPct >= 0.62
              ? lidSprites.lid75
              : lidPct >= 0.38
                ? lidSprites.lid50
                : lidPct >= 0.14
                  ? lidSprites.lid25
                  : lidSprites.open;

        for (let eyeIndex = 0; eyeIndex < blankEyePositions.length; eyeIndex += 1) {
          const eyePosition = blankEyePositions[eyeIndex];
          if (!eyePosition) {
            continue;
          }
          const eyeX = eyePosition.x;
          const eyeY = eyePosition.y;
          const blankBodySprite = wardenBodySpriteRef.current;
          if (blankBodySprite && blankBodySprite.complete && blankBodySprite.naturalWidth > 0) {
            ctx.save();
            ctx.shadowColor = 'rgba(100, 160, 255, 0.45)';
            ctx.shadowBlur = 14;
            ctx.drawImage(blankBodySprite, eyeX - blankW / 2, eyeY - blankH / 2, blankW, blankH);
            ctx.restore();
          } else {
            ctx.save();
            const bodyGrad = ctx.createRadialGradient(
              eyeX - blankW * 0.08,
              eyeY - blankH * 0.1,
              blankW * 0.04,
              eyeX,
              eyeY,
              blankW * 0.56
            );
            bodyGrad.addColorStop(0, 'rgba(240, 248, 255, 1)');
            bodyGrad.addColorStop(0.55, 'rgba(200, 225, 248, 0.96)');
            bodyGrad.addColorStop(1, 'rgba(140, 180, 220, 0.88)');
            ctx.fillStyle = bodyGrad;
            ctx.shadowColor = 'rgba(100, 160, 255, 0.45)';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.ellipse(eyeX, eyeY, blankW / 2, blankH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          const lidPct = eyeIndex === 0 ? wardenLidProgressRef.current : wardenSecondLidProgressRef.current;
          const lidSprite = pickLidSprite(lidPct);
          if (lidSprite && lidSprite.complete && lidSprite.naturalWidth > 0) {
            ctx.drawImage(lidSprite, eyeX - blankW / 2, eyeY - blankH / 2, blankW, blankH);
          }
          const eyeHpPct = clampNumber((normalizedEyeHp[eyeIndex] ?? 0) / Math.max(1, blankEncounterProfile.hpPerEye), 0, 1);
          const barW = blankW * 0.76;
          const barH = 7;
          const barX = eyeX - barW / 2;
          const barY = eyeY - blankH / 2 - 18;
          ctx.fillStyle = 'rgba(30, 30, 50, 0.7)';
          ctx.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
          ctx.fill();
          const hpFillWidth = Math.max(0, barW * eyeHpPct);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW, barH, 2);
          ctx.clip();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.fillRect(barX, barY, barW, barH);
          if (hpFillWidth > 0) {
            const hpGradient = ctx.createLinearGradient(barX, barY, barX + hpFillWidth, barY);
            hpGradient.addColorStop(0, 'rgba(167, 139, 250, 0.95)');
            hpGradient.addColorStop(1, 'rgba(109, 40, 217, 0.98)');
            ctx.fillStyle = hpGradient;
            ctx.fillRect(barX, barY, hpFillWidth, barH);
          }
          ctx.restore();
          if (now < wardenBossHitFlashUntilMs) {
            const flashAlpha = clampNumber((wardenBossHitFlashUntilMs - now) / 320, 0, 1);
            ctx.fillStyle = `rgba(255, 88, 88, ${(flashAlpha * 0.42).toFixed(3)})`;
            ctx.roundRect(barX, barY, barW, barH, 2);
            ctx.fill();
          }
        }
        if (import.meta.env.DEV) {
          const labelY = blankCenterY - blankH / 2 - 24;
          ctx.save();
          ctx.font = '600 11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = 'rgba(255, 209, 102, 0.95)';
          ctx.fillText(`DEV Blank #${blankEncounterProfile.encounterNumber}`, blankCenterX, labelY);
          ctx.restore();
        }
        ctx.restore();
      }
      // Tear
      const tear = wardenActiveTearRef.current;
      if (tear && tear.phase !== 'gone') {
        const prog = wardenTearFallProgressRef.current;
        const tearX = tear.xCanvas;
        const tearY = tear.yStartCanvas + prog * (LAUNCHER_Y - tear.yStartCanvas);
        const revealDurationMs = Math.max(1, tear.revealDurationMs);
        const revealProgress = clampNumber((now - tear.spawnedAtMs) / revealDurationMs, 0, 1);
        const revealAlpha = clampNumber(revealProgress * revealProgress, 0, 1);
        const revealHeightScale = clampNumber(Math.pow(revealProgress, 0.7), 0.06, 1);
        const tearSprite = wardenTearSpriteRef.current;
        if (tearSprite && tearSprite.complete && tearSprite.naturalWidth > 0) {
          const tearW = 32;
          const tearH = 56;
          ctx.save();
          ctx.globalAlpha = revealAlpha;
          if (tear.phase === 'hit') {
            ctx.globalAlpha *= 0.75;
          }
          ctx.beginPath();
          ctx.rect(tearX - tearW / 2, tearY - tearH / 2, tearW, tearH * revealHeightScale);
          ctx.clip();
          ctx.drawImage(tearSprite, tearX - tearW / 2, tearY - tearH / 2, tearW, tearH);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = revealAlpha;
          if (tear.phase === 'hit') {
            ctx.shadowColor = 'rgba(255, 120, 80, 0.8)';
            ctx.shadowBlur = 14;
            ctx.fillStyle = 'rgba(255, 120, 80, 0.95)';
          } else {
            ctx.shadowColor = 'rgba(80, 180, 255, 0.7)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = 'rgba(90, 200, 255, 0.92)';
          }
          ctx.beginPath();
          ctx.ellipse(tearX, tearY - (1 - revealHeightScale) * 11, 16, 24 * revealHeightScale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      for (const particle of wardenImpactParticlesRef.current) {
        const alpha = Math.max(0, 1 - particle.ageMs / particle.lifeMs);
        if (alpha <= 0) {
          continue;
        }
        ctx.fillStyle = particle.color.replace('ALPHA', alpha.toFixed(3));
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const ball of ballsRef.current) {
        if (!ball.active) {
          continue;
        }
        drawBallRuntimeVisual(ctx, ball, now);
      }

      // Skip brick drawing — fall through to ball + launcher rendering
      const objectiveCharge = runSnapshot.coreCharge ?? 1;
      const shooterGlow = Math.max(0, Math.min(1, objectiveCharge));
      const launcherVolleyCaps = getWardenVolleyCaps(runSnapshot, WARDEN_SHOT_BASE_COUNT);
      const launcherVolleySelection = normalizeWardenVolleySelection(
        wardenSelectedShotCount,
        wardenSelectedPower,
        launcherVolleyCaps,
        WARDEN_SHOT_BASE_COUNT
      );
      const launcherShotColor = getWardenShotColor(launcherVolleySelection.shotCount, launcherVolleyCaps.shotCap);
      const wardenPowerVisual = launcherVolleySelection.power;
      const wardenLoadedBallRadius = clampNumber(6 + (wardenPowerVisual - 1) * 0.52, 6, 10.7);
      const wardenTurretY = WARDEN_LAUNCHER_Y + WARDEN_TURRET_Y_OFFSET;
      const wardenCooldownRemainingMs = Math.max(0, nextWardenShotAvailableAtMsRef.current - now);
      const wardenCooldownProgress = clampNumber(
        1 - wardenCooldownRemainingMs / Math.max(1, getRunShotCooldownMs(runSnapshot)),
        0,
        1
      );
      const wardenShotReady = wardenCooldownRemainingMs <= 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(0, LOSE_Y);
      ctx.lineTo(CANVAS_WIDTH, LOSE_Y);
      ctx.stroke();
      const activeWardenGuide = aimPointRef.current ?? hoverPointRef.current;
      if (activeWardenGuide) {
        const launcherX = clampLaunchOriginX(wardenDisplayedLaunchOriginXRef.current);
        const dx = activeWardenGuide.x - launcherX;
        const dy = activeWardenGuide.y - wardenTurretY;
        let guideEndX = activeWardenGuide.x;
        let guideEndY = activeWardenGuide.y;
        if (dy < -0.001) {
          const leftWallX = BOARD_SIDE_CHANNEL_WIDTH;
          const rightWallX = CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH;
          const intersections: Array<{ t: number; x: number; y: number }> = [];
          const tTop = (0 - wardenTurretY) / dy;
          if (tTop > 0) intersections.push({ t: tTop, x: launcherX + dx * tTop, y: 0 });
          if (Math.abs(dx) > 0.001) {
            const tLeft = (leftWallX - launcherX) / dx;
            if (tLeft > 0) intersections.push({ t: tLeft, x: leftWallX, y: wardenTurretY + dy * tLeft });
            const tRight = (rightWallX - launcherX) / dx;
            if (tRight > 0) intersections.push({ t: tRight, x: rightWallX, y: wardenTurretY + dy * tRight });
          }
          const validHit = intersections.filter((h) => h.y >= 0 && h.y <= wardenTurretY).sort((a, b) => a.t - b.t)[0];
          if (validHit) { guideEndX = validHit.x; guideEndY = validHit.y; }
        }
        ctx.strokeStyle = wardenShotReady ? 'rgba(52, 255, 140, 0.95)' : 'rgba(90, 90, 90, 0.32)';
        ctx.lineWidth = wardenShotReady ? 3 : 1.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(launcherX, wardenTurretY);
        ctx.lineTo(guideEndX, guideEndY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }
      const launcherX2 = clampLaunchOriginX(wardenDisplayedLaunchOriginXRef.current);
      const shieldMax = wardenShieldMaxRef.current;
      const shieldCurrent = wardenShieldHpRef.current;
      const shieldGraceActive = wardenShieldGraceUntilMsRef.current !== null && now < wardenShieldGraceUntilMsRef.current;
      const shieldRailY = LOSE_Y - 10;
      const pipW = 14;
      const pipH = 8;
      const pipGap = 4;
      const totalPipRowW = shieldMax * pipW + (shieldMax - 1) * pipGap;
      const pipRowX = CANVAS_WIDTH / 2 - totalPipRowW / 2;
      for (let pip = 0; pip < shieldMax; pip += 1) {
        const pipX = pipRowX + pip * (pipW + pipGap);
        const active = pip < shieldCurrent;
        const graceFlash = shieldGraceActive && !active && (Math.floor(now / 200) % 2 === 0);
        ctx.fillStyle = active
          ? 'rgba(56, 189, 248, 0.92)'
          : graceFlash
          ? 'rgba(255, 80, 80, 0.85)'
          : 'rgba(30, 50, 70, 0.55)';
        ctx.beginPath();
        ctx.roundRect(pipX, shieldRailY, pipW, pipH, 2);
        ctx.fill();
        if (active) {
          ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
          ctx.fillRect(pipX + 2, shieldRailY + 1, pipW - 4, 2);
        }
      }
      if (shieldGraceActive && shieldCurrent <= 0 && wardenShieldGraceUntilMsRef.current !== null) {
        const remainingMs = Math.max(0, wardenShieldGraceUntilMsRef.current - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin(now / 170));
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '500 15px Inter, system-ui, sans-serif';
        ctx.shadowColor = `rgba(127, 29, 29, ${(0.4 + pulse * 0.4).toFixed(3)})`;
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(248, 113, 113, ${(0.7 + pulse * 0.3).toFixed(3)})`;
        ctx.fillText(`Strike Blank in ${remainingSeconds}s`, CANVAS_WIDTH / 2, shieldRailY - 14);
        ctx.restore();
      }
      if (defeatCinematicActive) {
        const fadeToSpoilsAlpha = clampNumber(1 - defeatRemainingMs / 600, 0, 1);
        if (fadeToSpoilsAlpha > 0) {
          ctx.fillStyle = `rgba(8, 4, 18, ${(fadeToSpoilsAlpha * 0.78).toFixed(3)})`;
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const shooterAura2 = ctx.createRadialGradient(
        launcherX2,
        wardenTurretY,
        2,
        launcherX2,
        wardenTurretY,
        24 + shooterGlow * 11 + (wardenLoadedBallRadius - 8) * 0.9
      );
      shooterAura2.addColorStop(
        0,
        wardenShotReady
          ? `rgba(254, 240, 138, ${0.1 + shooterGlow * 0.5})`
          : 'rgba(148, 163, 184, 0.32)'
      );
      shooterAura2.addColorStop(1, wardenShotReady ? 'rgba(254, 240, 138, 0)' : 'rgba(148, 163, 184, 0)');
      ctx.fillStyle = shooterAura2;
      ctx.beginPath();
      ctx.arc(launcherX2, wardenTurretY, 24 + shooterGlow * 11 + (wardenLoadedBallRadius - 8) * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const wardenTurretRadius = wardenLoadedBallRadius + 2;
      ctx.fillStyle = wardenShotReady ? launcherShotColor : 'rgba(75, 85, 99, 0.95)';
      ctx.beginPath();
      ctx.arc(launcherX2, wardenTurretY, wardenTurretRadius, 0, Math.PI * 2);
      ctx.fill();
      if (!wardenShotReady) {
        const cooldownSweepEnd = -Math.PI / 2 + Math.PI * 2 * wardenCooldownProgress;
        ctx.fillStyle = 'rgba(148, 224, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(launcherX2, wardenTurretY);
        ctx.arc(launcherX2, wardenTurretY, wardenTurretRadius, -Math.PI / 2, cooldownSweepEnd, false);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = wardenShotReady ? 'rgba(186, 230, 253, 0.88)' : 'rgba(203, 213, 225, 0.72)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(launcherX2, wardenTurretY, wardenTurretRadius + 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      return;
    }

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

    const drawNonOrbTargetStyleOverlay = (
      style: TargetArtStyle,
      kind: BrickKind,
      bounds: { x: number; y: number; width: number; height: number },
      center: { x: number; y: number },
      pulse: number,
      hitIntensity: number,
      hpPct: number,
      weakSide?: OneWaySide
    ) => {
      if (style === 'classic') {
        return;
      }

      const { x: left, y: top, width, height } = bounds;
      const { x: centerX, y: centerY } = center;

      if (style === 'atlas') {
        const visualState: BrickArtState = hitIntensity > 0.12 ? 'hit' : hpPct < 0.45 ? 'damaged' : 'idle';
        const fileName = getBrickAssetFileName(kind, visualState, weakSide);
        const cachedImage = brickAssetImageCacheRef.current[fileName];
        if (cachedImage && cachedImage.complete && cachedImage.naturalWidth > 0 && cachedImage.naturalHeight > 0) {
          const targetRatio = width / Math.max(1, height);
          const imageRatio = cachedImage.naturalWidth / Math.max(1, cachedImage.naturalHeight);
          const drawWidth = imageRatio > targetRatio ? height * imageRatio : width;
          const drawHeight = imageRatio > targetRatio ? height : width / Math.max(0.001, imageRatio);
          const drawX = left + (width - drawWidth) / 2;
          const drawY = top + (height - drawHeight) / 2;
          ctx.drawImage(cachedImage, drawX, drawY, drawWidth, drawHeight);
          return;
        }

        const atlasImage = targetAtlasImageRef.current;
        if (!atlasImage) {
          return;
        }
        const stateColumnOffset = hitIntensity > 0.12 ? 1 : hpPct < 0.45 ? 2 : 0;
        const atlasRowAndCol = (() => {
          if (kind === 'unbreakable') {
            return { row: 0, col: 3 + stateColumnOffset };
          }
          if (kind === 'prism') {
            return { row: 1, col: stateColumnOffset };
          }
          if (kind === 'exploding') {
            return { row: 1, col: 3 + stateColumnOffset };
          }
          if (kind === 'splinter') {
            return { row: 2, col: stateColumnOffset };
          }
          if (kind === 'reinforced') {
            return { row: 2, col: 3 + stateColumnOffset };
          }
          if (kind === 'oneway') {
            if (weakSide === 'bottom') {
              return { row: 3, col: 3 + stateColumnOffset };
            }
            if (weakSide === 'left') {
              return { row: 4, col: stateColumnOffset };
            }
            if (weakSide === 'right') {
              return { row: 4, col: 3 + stateColumnOffset };
            }
            return { row: 3, col: stateColumnOffset };
          }
          return { row: 0, col: stateColumnOffset };
        })();
        const sx = atlasRowAndCol.col * TARGET_ATLAS_TILE_SIZE;
        const sy = atlasRowAndCol.row * TARGET_ATLAS_TILE_SIZE;
        const tileBounds =
          targetAtlasTileBoundsRef.current[`${atlasRowAndCol.row}-${atlasRowAndCol.col}`] ?? {
            x: 0,
            y: 0,
            width: TARGET_ATLAS_TILE_SIZE,
            height: TARGET_ATLAS_TILE_SIZE,
          };
        const padX = Math.max(0, Math.round(width * 0.005));
        const padY = Math.max(0, Math.round(height * 0.005));
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.drawImage(
          atlasImage,
          sx + tileBounds.x,
          sy + tileBounds.y,
          tileBounds.width,
          tileBounds.height,
          left + padX,
          top + padY,
          width - padX * 2,
          height - padY * 2
        );
        ctx.restore();
        return;
      }

      if (style === 'sigil') {
        const ringRadius = Math.max(5, Math.min(width, height) * (0.26 + pulse * 0.05));
        const inset = Math.max(2, height * 0.14);
        ctx.save();
        ctx.strokeStyle = `rgba(254, 243, 199, ${0.42 + hitIntensity * 0.3})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.lineDashOffset = -now / 48;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 0.85;
        for (let index = 0; index < 4; index += 1) {
          const angle = now / 1250 + index * (Math.PI / 2);
          const runeX = centerX + Math.cos(angle) * (ringRadius + 1.3);
          const runeY = centerY + Math.sin(angle) * (ringRadius + 1.3);
          ctx.beginPath();
          ctx.moveTo(runeX - 1.3, runeY - 1.3);
          ctx.lineTo(runeX + 1.3, runeY + 1.3);
          ctx.moveTo(runeX + 1.3, runeY - 1.3);
          ctx.lineTo(runeX - 1.3, runeY + 1.3);
          ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.beginPath();
        ctx.roundRect(left + inset, top + inset, Math.max(2, width - inset * 2), Math.max(2, height - inset * 2), 3);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const frameInset = Math.max(1.4, height * 0.11);
      ctx.save();
      const frameGradient = ctx.createLinearGradient(left, top, left, top + height);
      frameGradient.addColorStop(0, 'rgba(241, 245, 249, 0.42)');
      frameGradient.addColorStop(1, 'rgba(100, 116, 139, 0.24)');
      ctx.strokeStyle = frameGradient;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(
        left + frameInset,
        top + frameInset,
        Math.max(2, width - frameInset * 2),
        Math.max(2, height - frameInset * 2),
        Math.max(2.2, height * 0.17)
      );
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
      ctx.beginPath();
      ctx.moveTo(centerX, top + frameInset + 1);
      ctx.lineTo(left + width - frameInset - 1, centerY);
      ctx.lineTo(centerX, top + height - frameInset - 1);
      ctx.lineTo(left + frameInset + 1, centerY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
      const studRadius = Math.max(0.9, Math.min(1.35, width * 0.03));
      for (const studX of [left + frameInset + 2, left + width - frameInset - 2]) {
        for (const studY of [top + frameInset + 2, top + height - frameInset - 2]) {
          ctx.beginPath();
          ctx.arc(studX, studY, studRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    for (const brick of bricksToDraw) {
      const visual = brickVisualRef.current.get(brick.id);
      const hitIntensity = visual ? Math.max(0, (visual.hitUntil - now) / 120) : 0;
      if (visual && hitIntensity <= 0) {
        brickVisualRef.current.delete(brick.id);
      }

      const x = getBrickX(brick.col, brickWidth);
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
            top: { r: 101, g: 67, b: 33 },
            bottom: { r: 62, g: 39, b: 20 },
            edge: 'rgba(214, 88, 38, 0.6)',
          };
        }
        if (kind === 'unbreakable') {
          return {
            top: { r: 78, g: 52, b: 35 },
            bottom: { r: 44, g: 29, b: 19 },
            edge: 'rgba(167, 107, 65, 0.6)',
          };
        }
        if (kind === 'oneway') {
          return {
            top: { r: 74, g: 105, b: 47 },
            bottom: { r: 42, g: 62, b: 26 },
            edge: 'rgba(148, 173, 92, 0.55)',
          };
        }
        if (kind === 'exploding') {
          return {
            top: { r: 127, g: 29, b: 29 },
            bottom: { r: 76, g: 17, b: 17 },
            edge: 'rgba(239, 68, 68, 0.55)',
          };
        }
        if (kind === 'prism') {
          return {
            top: { r: 152, g: 117, b: 68 },
            bottom: { r: 92, g: 71, b: 40 },
            edge: 'rgba(215, 158, 89, 0.55)',
          };
        }
        if (kind === 'reinforced') {
          return {
            top: { r: 67, g: 44, b: 29 },
            bottom: { r: 39, g: 26, b: 17 },
            edge: 'rgba(140, 92, 59, 0.6)',
          };
        }
        if (kind === 'splinter') {
          return {
            top: { r: 132, g: 157, b: 74 },
            bottom: { r: 91, g: 110, b: 48 },
            edge: 'rgba(187, 211, 102, 0.55)',
          };
        }
        return {
          top: { r: 92, g: 64, b: 51 },
          bottom: { r: 55, g: 38, b: 30 },
          edge: 'rgba(180, 124, 89, 0.55)',
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

      if (kind !== 'objective') {
        const targetPulse = 0.5 + Math.sin(now / 320 + brick.row * 0.31 + brick.col * 0.19) * 0.5;
        drawNonOrbTargetStyleOverlay(
          targetArtStyle,
          kind,
          { x, y, width: brickWidth, height: BRICK_HEIGHT },
          { x: centerX, y: centerY },
          targetPulse,
          hitIntensity,
          hpPct,
          brick.weakSide
        );
      }

      if (targetArtStyle !== 'atlas' && kind !== 'prism' && kind !== 'objective') {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + hitIntensity * 0.12})`;
        ctx.fillRect(x + 2, y + 2, brickWidth - 4, 3);
      }

      if (kind === 'unbreakable' && targetArtStyle !== 'atlas') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + brickWidth * 0.2, y + BRICK_HEIGHT * 0.3);
        ctx.lineTo(x + brickWidth * 0.8, y + BRICK_HEIGHT * 0.7);
        ctx.moveTo(x + brickWidth * 0.8, y + BRICK_HEIGHT * 0.3);
        ctx.lineTo(x + brickWidth * 0.2, y + BRICK_HEIGHT * 0.7);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (kind === 'oneway' && brick.weakSide && targetArtStyle !== 'atlas') {
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

      if (kind === 'unbreakable' && targetArtStyle !== 'atlas') {
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

    for (const eventText of manaBonusEventTextsRef.current) {
      const progress = Math.max(0, Math.min(1, eventText.ageMs / Math.max(1, eventText.lifeMs)));
      const driftY = progress * 34;
      const alpha = Math.max(0, 1 - progress);
      const scale = 1 + progress * 0.08;
      ctx.save();
      ctx.translate(eventText.x, eventText.y - driftY);
      ctx.scale(scale, scale);
      ctx.font = '600 15px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = `rgba(15, 23, 42, ${(alpha * 0.7).toFixed(3)})`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(254, 240, 138, ${alpha.toFixed(3)})`;
      ctx.fillText(eventText.label, 0, 0);
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    const loseY = LOSE_Y;
    ctx.moveTo(0, loseY);
    ctx.lineTo(CANVAS_WIDTH, loseY);
    ctx.stroke();

    const boardTurretY = LAUNCHER_Y + BOARD_TURRET_Y_OFFSET;
    const boardShotCooldownMs = getRunShotCooldownMs(runSnapshot);
    const cooldownRemainingMs = Math.max(0, nextBoardShotAvailableAtMsRef.current - now);
    const cooldownProgress = clampNumber(
      1 - cooldownRemainingMs / Math.max(1, boardShotCooldownMs),
      0,
      1
    );
    const boardShotReady = cooldownRemainingMs <= 0;

    const activeGuidePoint = aimPointRef.current ?? hoverPointRef.current;
    if (activeGuidePoint) {
      const launcherX = getLaunchOriginX(runSnapshot);
      const launcherY = boardTurretY;
      const dx = activeGuidePoint.x - launcherX;
      const dy = activeGuidePoint.y - launcherY;
      let guideEndX = activeGuidePoint.x;
      let guideEndY = activeGuidePoint.y;

      if (dy < -0.001) {
        const leftWallX = BOARD_SIDE_CHANNEL_WIDTH;
        const rightWallX = CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH;
        const intersections: Array<{ t: number; x: number; y: number }> = [];
        const tTop = (0 - launcherY) / dy;
        if (tTop > 0) {
          intersections.push({ t: tTop, x: launcherX + dx * tTop, y: 0 });
        }
        if (Math.abs(dx) > 0.001) {
          const tLeft = (leftWallX - launcherX) / dx;
          if (tLeft > 0) {
            intersections.push({ t: tLeft, x: leftWallX, y: launcherY + dy * tLeft });
          }
          const tRight = (rightWallX - launcherX) / dx;
          if (tRight > 0) {
            intersections.push({ t: tRight, x: rightWallX, y: launcherY + dy * tRight });
          }
        }
        const validHit = intersections
          .filter((hit) => hit.y >= 0 && hit.y <= launcherY)
          .sort((a, b) => a.t - b.t)[0];
        if (validHit) {
          guideEndX = validHit.x;
          guideEndY = validHit.y;
        }
      }

      ctx.strokeStyle = boardShotReady ? 'rgba(52, 255, 140, 0.95)' : 'rgba(90, 90, 90, 0.32)';
      ctx.lineWidth = boardShotReady ? 3 : 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(launcherX, launcherY);
      ctx.lineTo(guideEndX, guideEndY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    for (const ball of ballsRef.current) {
      if (!ball.active) {
        continue;
      }
      drawBallRuntimeVisual(ctx, ball, now);
    }

    const shooterGlow = Math.max(0, Math.min(1, objectiveCharge));
    const launcherX = getLaunchOriginX(runSnapshot);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const shooterAura = ctx.createRadialGradient(
      launcherX,
      boardTurretY,
      2,
      launcherX,
      boardTurretY,
      22 + shooterGlow * 10
    );
    shooterAura.addColorStop(
      0,
      boardShotReady
        ? `rgba(254, 240, 138, ${0.1 + shooterGlow * 0.5})`
        : 'rgba(148, 163, 184, 0.32)'
    );
    shooterAura.addColorStop(1, boardShotReady ? 'rgba(254, 240, 138, 0)' : 'rgba(148, 163, 184, 0)');
    ctx.fillStyle = shooterAura;
    ctx.beginPath();
    ctx.arc(launcherX, boardTurretY, 22 + shooterGlow * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const turretRadius = 12 + shooterGlow * 3.2;
    ctx.fillStyle = boardShotReady
      ? shooterGlow > 0.05
        ? `rgba(255, ${222 + Math.round(shooterGlow * 26)}, ${104 + Math.round(shooterGlow * 70)}, 1)`
        : '#22d3ee'
      : 'rgba(75, 85, 99, 0.95)';
    ctx.beginPath();
    ctx.arc(launcherX, boardTurretY, turretRadius, 0, Math.PI * 2);
    ctx.fill();
    if (!boardShotReady) {
      const cooldownSweepEnd = -Math.PI / 2 + Math.PI * 2 * cooldownProgress;
      ctx.fillStyle = 'rgba(148, 224, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(launcherX, boardTurretY);
      ctx.arc(launcherX, boardTurretY, turretRadius, -Math.PI / 2, cooldownSweepEnd, false);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = boardShotReady ? 'rgba(186, 230, 253, 0.88)' : 'rgba(203, 213, 225, 0.72)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(launcherX, boardTurretY, turretRadius + 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }, [
    targetArtStyle,
    wardenEyeHp,
    wardenBossHitFlashUntilMs,
    wardenDefeatCinematicUntilMs,
    wardenSelectedShotCount,
    wardenSelectedPower,
  ]);

  const spawnBreakParticles = useCallback((brick: Brick, slowCinematic = false) => {
    const brickWidth = getBrickWidth();
    const brickX = getBrickX(brick.col, brickWidth);
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
        setSaveStatus('saving');
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
  }, [profile, draw, shotInProgress]);

  useEffect(() => {
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
  }, [run]);

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
      const boardCooldownActive = timestamp < nextBoardShotAvailableAtMsRef.current;
      if (
        hasObjective ||
        boardAdvanceAnimationRef.current ||
        manaBonusEventTextsRef.current.length > 0 ||
        boardCooldownActive ||
        isDraggingRef.current ||
        hoverPointRef.current !== null
      ) {
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

  // Continuous draw loop for warden battle (Blank drifts, tear falls, aim guide updates)
  useEffect(() => {
    if (run?.stage !== 'warden') {
      if (wardenAnimationRef.current !== null) {
        cancelAnimationFrame(wardenAnimationRef.current);
        wardenAnimationRef.current = null;
      }
      if (wardenDefeatResolveTimeoutRef.current !== null) {
        window.clearTimeout(wardenDefeatResolveTimeoutRef.current);
        wardenDefeatResolveTimeoutRef.current = null;
      }
      wardenBallLastFrameMsRef.current = null;
      return;
    }
    const animate = (timestamp: number) => {
      const previousFrameTimestamp = wardenBallLastFrameMsRef.current ?? timestamp;
      const dtSeconds = Math.min((timestamp - previousFrameTimestamp) / 1000, 0.033);
      const defeatCinematicActive =
        wardenDefeatCinematicUntilMs !== null && timestamp < wardenDefeatCinematicUntilMs;
      const defeatTimeScale = defeatCinematicActive ? 0.2 : 1;
      wardenBallLastFrameMsRef.current = timestamp;
      frameNowRef.current = timestamp;
      const launchOriginTween = wardenLaunchOriginTweenRef.current;
      if (launchOriginTween) {
        const tweenProgress = clampNumber(
          (timestamp - launchOriginTween.startedAtMs) / Math.max(1, launchOriginTween.durationMs),
          0,
          1
        );
        const easedProgress = 1 - (1 - tweenProgress) * (1 - tweenProgress) * (1 - tweenProgress);
        wardenDisplayedLaunchOriginXRef.current = clampLaunchOriginX(
          launchOriginTween.startX + (launchOriginTween.endX - launchOriginTween.startX) * easedProgress
        );
        if (tweenProgress >= 1) {
          wardenDisplayedLaunchOriginXRef.current = clampLaunchOriginX(launchOriginTween.endX);
          wardenLaunchOriginTweenRef.current = null;
        }
      }
      for (const particle of wardenImpactParticlesRef.current) {
        particle.ageMs += dtSeconds * 1000 * defeatTimeScale;
        particle.x += particle.vx * dtSeconds * defeatTimeScale;
        particle.y += particle.vy * dtSeconds * defeatTimeScale;
        particle.vx *= 0.98;
        particle.vy *= 0.98;
      }
      wardenImpactParticlesRef.current = wardenImpactParticlesRef.current.filter(
        (particle) => particle.ageMs < particle.lifeMs
      );

      const spawnWardenImpactBurst = (x: number, y: number, color: string) => {
        for (let index = 0; index < 8; index += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 60 + Math.random() * 140;
          wardenImpactParticlesRef.current.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 1.2 + Math.random() * 1.7,
            ageMs: 0,
            lifeMs: 170 + Math.random() * 120,
            color,
          });
        }
      };
      const spawnWardenTearDestroyPuff = (x: number, y: number) => {
        for (let index = 0; index < 16; index += 1) {
          const angle = (index / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
          const speed = 26 + Math.random() * 46;
          wardenImpactParticlesRef.current.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (14 + Math.random() * 12),
            radius: 2.3 + Math.random() * 1.9,
            ageMs: 0,
            lifeMs: 300 + Math.random() * 180,
            color: 'rgba(188, 233, 255, ALPHA)',
          });
        }
      };

      if (!defeatCinematicActive && shotInFlightRef.current && (ballsRef.current.length > 0 || launchQueueRef.current.length > 0)) {
        const leftWallX = BOARD_SIDE_CHANNEL_WIDTH;
        const rightWallX = CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH;
        const blankEncounterProfile = getBlankEncounterProfile(profileRef.current?.run);
        const blankPositions = blankEyeCanvasPositionsRef.current.length > 0
          ? blankEyeCanvasPositionsRef.current
          : [blankCanvasPosRef.current];
        const metrics = getBlankEyeRenderMetrics(CANVAS_WIDTH, blankEncounterProfile.dualEyes);
        const blankW = metrics.width;
        const blankH = metrics.height;
        const ellipseRadiusX = blankW * 0.5;
        const ellipseRadiusY = blankH * 0.5;
        const tearSnapshot = wardenActiveTearRef.current;
        const tearProgress = wardenTearFallProgressRef.current;
        const tearX = tearSnapshot?.xCanvas ?? 0;
        const tearY = tearSnapshot
          ? tearSnapshot.yStartCanvas + tearProgress * (LAUNCHER_Y - tearSnapshot.yStartCanvas)
          : 0;
        const tearRadius = 24;
        const now = timestamp;
        const lidClosedByEye = [
          wardenLidProgressRef.current > 0.94,
          wardenSecondLidProgressRef.current > 0.94,
        ];

        launchElapsedRef.current += dtSeconds * 1000;
        const launchConfig = wardenLaunchConfigRef.current;
        while (
          launchConfig &&
          launchQueueRef.current.length > 0 &&
          launchElapsedRef.current >= launchQueueRef.current[0].delayMs
        ) {
          const queuedLaunch = launchQueueRef.current.shift();
          if (!queuedLaunch) {
            continue;
          }
          const scatter = (Math.random() - 0.5) * 0.05 * launchConfig.spreadScale;
          const spawn = queuedLaunch.spawn ?? {
            x: launchConfig.originX,
            y: WARDEN_LAUNCHER_Y + WARDEN_TURRET_Y_OFFSET,
            vx: (launchConfig.direction.x + scatter) * launchConfig.baseSpeed,
            vy: launchConfig.direction.y * launchConfig.baseSpeed,
            radius: launchConfig.radius,
            mass: launchConfig.mass,
          };
          ballsRef.current.push({
            x: spawn.x,
            y: spawn.y,
            vx: spawn.vx,
            vy: spawn.vy,
            radius: spawn.radius,
            mass: spawn.mass,
            active: true,
            coreCharged: false,
            isCritShot: spawn.isCritShot ?? false,
            reboundCount: 0,
          });
        }

        for (const ball of ballsRef.current) {
          if (!ball.active) {
            continue;
          }

          const previousX = ball.x;
          const previousY = ball.y;
          ball.x += ball.vx * dtSeconds;
          ball.y += ball.vy * dtSeconds;

          if (ball.x - ball.radius < leftWallX) {
            ball.x = leftWallX + ball.radius;
            ball.vx = Math.abs(ball.vx);
            ball.coreCharged = true;
          } else if (ball.x + ball.radius > rightWallX) {
            ball.x = rightWallX - ball.radius;
            ball.vx = -Math.abs(ball.vx);
            ball.coreCharged = true;
          }

          if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy);
            ball.coreCharged = true;
          }

          if (previousY < LOSE_Y && ball.y >= LOSE_Y) {
            const crossingProgress =
              ball.y === previousY ? 1 : clampNumber((LOSE_Y - previousY) / (ball.y - previousY), 0, 1);
            const crossingX = previousX + (ball.x - previousX) * crossingProgress;
            lastBottomCrossingXRef.current = clampLaunchOriginX(crossingX);
            ball.active = false;
            continue;
          }

          if (tearSnapshot && tearSnapshot.phase !== 'gone') {
            const tearDx = ball.x - tearX;
            const tearDy = ball.y - tearY;
            const tearHitRadius = ball.radius + tearRadius;
            const tearDistSq = tearDx * tearDx + tearDy * tearDy;
            const tearColliding = tearDistSq <= tearHitRadius * tearHitRadius;
            if (tearColliding) {
              if (!ball.wardenTouchingTear) {
                ball.wardenTouchingTear = true;
                const tearDist = Math.sqrt(tearDistSq) || 0.0001;
                const normalX = tearDx / tearDist;
                const normalY = tearDy / tearDist;
                const velocityDotNormal = ball.vx * normalX + ball.vy * normalY;
                if (velocityDotNormal < 0) {
                  ball.vx -= 2 * velocityDotNormal * normalX;
                  ball.vy -= 2 * velocityDotNormal * normalY;
                } else {
                  ball.vx += normalX * 48;
                  ball.vy += normalY * 48;
                }
                const penetration = tearHitRadius - tearDist;
                if (penetration > 0) {
                  ball.x += normalX * (penetration + 0.8);
                  ball.y += normalY * (penetration + 0.8);
                }

                if (wardenActiveTearRef.current && wardenActiveTearRef.current.phase !== 'gone') {
                  ball.coreCharged = true;
                  spawnWardenImpactBurst(ball.x, ball.y, 'rgba(120, 210, 255, ALPHA)');
                  const nextHp = wardenActiveTearRef.current.hp - wardenVolleyTearDamageRef.current;
                  if (nextHp <= 0) {
                    spawnWardenTearDestroyPuff(tearX, tearY);
                    const destroyed = { ...wardenActiveTearRef.current, hp: 0, phase: 'gone' as const };
                    wardenActiveTearRef.current = destroyed;
                    setWardenActiveTear(destroyed);
                  } else {
                    const hit = { ...wardenActiveTearRef.current, hp: nextHp, phase: 'hit' as const };
                    wardenActiveTearRef.current = hit;
                    setWardenActiveTear(hit);
                    window.setTimeout(() => {
                      if (wardenActiveTearRef.current?.phase === 'hit') {
                        const falling = { ...wardenActiveTearRef.current, phase: 'falling' as const };
                        wardenActiveTearRef.current = falling;
                        setWardenActiveTear(falling);
                      }
                    }, 150);
                  }
                }
              }
            } else {
              ball.wardenTouchingTear = false;
            }
          } else {
            ball.wardenTouchingTear = false;
          }

          const blankHitRadiusX = ellipseRadiusX + ball.radius;
          const blankHitRadiusY = ellipseRadiusY + ball.radius;
          let blankCollision:
            | { eyeIndex: number; eyePosition: { x: number; y: number }; normalizedX: number; normalizedY: number }
            | null = null;
          for (let eyeIndex = 0; eyeIndex < blankPositions.length; eyeIndex += 1) {
            const eyePosition = blankPositions[eyeIndex];
            if (!eyePosition) {
              continue;
            }
            const normalizedX = (ball.x - eyePosition.x) / blankHitRadiusX;
            const normalizedY = (ball.y - eyePosition.y) / blankHitRadiusY;
            if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
              blankCollision = { eyeIndex, eyePosition, normalizedX, normalizedY };
              break;
            }
          }
          const blankColliding = blankCollision !== null;
          if (blankColliding) {
            const collision = blankCollision;
            if (!collision) {
              continue;
            }
            if (!ball.wardenTouchingBlank) {
              ball.wardenTouchingBlank = true;
              const gradientX = (ball.x - collision.eyePosition.x) / (blankHitRadiusX * blankHitRadiusX);
              const gradientY = (ball.y - collision.eyePosition.y) / (blankHitRadiusY * blankHitRadiusY);
              const normalLength = Math.hypot(gradientX, gradientY) || 1;
              const normalX = gradientX / normalLength;
              const normalY = gradientY / normalLength;
              const velocityDotNormal = ball.vx * normalX + ball.vy * normalY;
              if (velocityDotNormal < 0) {
                ball.vx -= 2 * velocityDotNormal * normalX;
                ball.vy -= 2 * velocityDotNormal * normalY;
              } else {
                ball.vx += normalX * 32;
                ball.vy += normalY * 32;
              }
              ball.x += normalX * 2.2;
              ball.y += normalY * 2.2;

              const currentEyeLidClosed = lidClosedByEye[collision.eyeIndex] ?? lidClosedByEye[0] ?? false;
              if (!currentEyeLidClosed) {
                ball.coreCharged = true;
                spawnWardenImpactBurst(ball.x, ball.y, 'rgba(255, 184, 184, ALPHA)');
                const damagePerHit = Math.max(1, wardenVolleyDamagePerHitRef.current);
                setWardenEyeHp((previousEyeHp) => {
                  const nextEyeHp = normalizeBlankEyeHp(previousEyeHp, blankEncounterProfile.dualEyes, blankEncounterProfile.hpPerEye);
                  const eyeIndex = Math.max(0, Math.min(nextEyeHp.length - 1, collision.eyeIndex));
                  nextEyeHp[eyeIndex] = Math.max(0, nextEyeHp[eyeIndex] - damagePerHit);
                  wardenEyeHpRef.current = nextEyeHp;
                  return nextEyeHp;
                });
                // Regen 1 shield pip on hit (up to max)
                const shieldMax = wardenShieldMaxRef.current;
                const prevShield = wardenShieldHpRef.current;
                if (prevShield < shieldMax && !wardenShieldRegenUsedSinceLastTearRef.current) {
                  const nextShield = Math.min(shieldMax, prevShield + 1);
                  wardenShieldHpRef.current = nextShield;
                  wardenShieldGraceUntilMsRef.current = null;
                  wardenShieldRegenUsedSinceLastTearRef.current = true;
                  setWardenShieldHp(nextShield);
                }
                setWardenBossHitFlashUntilMs(now + 320);
              }
            }
          } else {
            ball.wardenTouchingBlank = false;
          }
        }

        ballsRef.current = ballsRef.current.filter((ball) => ball.active);
        if (ballsRef.current.length === 0 && launchQueueRef.current.length === 0) {
          const runState = profileRef.current?.run;
          if (runState && typeof lastBottomCrossingXRef.current === 'number') {
            const nextLaunchOriginX = clampLaunchOriginX(lastBottomCrossingXRef.current);
            runState.launchOriginX = nextLaunchOriginX;
            const currentTurretX = clampLaunchOriginX(wardenDisplayedLaunchOriginXRef.current);
            const slideDistance = Math.abs(nextLaunchOriginX - currentTurretX);
            if (slideDistance > 0.35) {
              wardenLaunchOriginTweenRef.current = {
                startX: currentTurretX,
                endX: nextLaunchOriginX,
                startedAtMs: timestamp,
                durationMs: Math.max(120, Math.min(320, WARDEN_TURRET_SLIDE_MS + slideDistance * 1.2)),
              };
            } else {
              wardenDisplayedLaunchOriginXRef.current = nextLaunchOriginX;
              wardenLaunchOriginTweenRef.current = null;
            }
          }
          lastBottomCrossingXRef.current = null;
          shotInFlightRef.current = false;
          wardenLaunchConfigRef.current = null;
          setShotInProgress(false);
        }
      }

      if (!defeatCinematicActive && wardenActiveTearRef.current?.phase === 'falling') {
        const activeTear = wardenActiveTearRef.current;
        const previousProgress = wardenTearFallProgressRef.current;
        const blankEncounterProfile = getBlankEncounterProfile(profileRef.current?.run);
        const hpPct = clampNumber(
          getBlankCombinedHp(wardenEyeHpRef.current, blankEncounterProfile.dualEyes, blankEncounterProfile.hpPerEye) /
            Math.max(1, getBlankEncounterHpMax(blankEncounterProfile.dualEyes, blankEncounterProfile.hpPerEye)),
          0,
          1
        );
        const aggression = 1 - hpPct;
        const tearFallDurationSec = clampNumber(
          blankEncounterProfile.tearFallDurationAtFullHp +
            (blankEncounterProfile.tearFallDurationAtLowHp - blankEncounterProfile.tearFallDurationAtFullHp) * aggression,
          0.8,
          blankEncounterProfile.tearFallDurationAtFullHp
        );
        wardenTearFallProgressRef.current = Math.min(
          1,
          wardenTearFallProgressRef.current + dtSeconds / tearFallDurationSec
        );
        const fallDistance = Math.max(1, LAUNCHER_Y - activeTear.yStartCanvas);
        const contactProgress = clampNumber((LOSE_Y - activeTear.yStartCanvas) / fallDistance, 0, 1);
        if (previousProgress < contactProgress && wardenTearFallProgressRef.current >= contactProgress) {
          const impactY = activeTear.yStartCanvas + contactProgress * (LAUNCHER_Y - activeTear.yStartCanvas);
          triggerWardenTearShieldImpact(activeTear.xCanvas, impactY);
        }
        if (wardenTearFallProgressRef.current >= 1) {
          triggerWardenTearShieldImpact(activeTear.xCanvas, LAUNCHER_Y);
        }
      } else if (wardenActiveTearRef.current?.phase === 'gone') {
        wardenTearFallProgressRef.current = 0;
      }

      draw();
      wardenAnimationRef.current = requestAnimationFrame(animate);
    };
    wardenAnimationRef.current = requestAnimationFrame(animate);
    return () => {
      if (wardenAnimationRef.current !== null) {
        cancelAnimationFrame(wardenAnimationRef.current);
        wardenAnimationRef.current = null;
      }
    };
  }, [draw, run?.stage, triggerWardenTearShieldImpact, wardenDefeatCinematicUntilMs]);

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
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const stored = await browserRogueBrickPersistence.load();
        if (cancelled) {
          return;
        }

        const storedProfile = stored?.progressJson ? parseProgress(stored.progressJson) : null;
        setProfile(storedProfile ?? defaultProfile());
        setSaveStatus(storedProfile ? 'saved' : 'idle');
      } catch {
        if (cancelled) {
          return;
        }

        setProfile(defaultProfile());
        setSaveStatus('error');
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
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await browserRogueBrickPersistence.save(JSON.stringify(profile));
        if (!cancelled) {
          setSaveStatus('saved');
        }
      } catch {
        if (!cancelled) {
          setSaveStatus('error');
        }
      }
    }, LOCAL_SAVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [profile]);

  const endRun = useCallback(
    (victory: boolean, defeatReason?: string) => {
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
          defeatReason: victory ? undefined : defeatReason,
          wardensDefeated: runState.wardensDefeated.length,
          manaBanked: Math.max(0, Math.floor(runState.mana)),
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
      remainingBricks: 0,
      essenceByColor: { yellow: 0, blue: 0, green: 0 },
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
    const manualBricksThisTurn = pendingManualBricksThisTurnRef.current;
    const killShotBricksBeforeOrb = pendingKillShotBricksBeforeOrbRef.current;
    const cleanPlateAwardedThisTurn = pendingCleanPlateAwardedRef.current;
    const maxBallReboundsThisTurn = pendingMaxBallReboundsThisTurnRef.current;
    const giggidyBallsThisTurn = pendingGiggidyBallsThisTurnRef.current;
    const shotsLaunchedThisTurn = Math.max(1, pendingShotLaunchesThisTurnRef.current);
    const lastBottomCrossingX = lastBottomCrossingXRef.current;
    const turnDurationMs =
      shotStartedAtMsRef.current === null ? 0 : Math.max(0, Math.round(performance.now() - shotStartedAtMsRef.current));
    const postTurnCoreCharge = coreChargeRef.current;
    const usedHomingBarrage = homingBarrageUsedRef.current;
    const handledCoreBreachThisTurn = coreBreachHandledThisTurnRef.current;
    homingBarrageUsedRef.current = false;
    pendingRewardsRef.current = { mana: 0, essenceByColor: { yellow: 0, blue: 0, green: 0 } };
    pendingDestroyedBricksRef.current = 0;
    pendingBounceCountRef.current = 0;
    pendingManualBricksThisTurnRef.current = 0;
    pendingPreOrbBricksThisTurnRef.current = 0;
    pendingKillShotBricksBeforeOrbRef.current = 0;
    pendingCleanPlateAwardedRef.current = false;
    pendingMaxBallReboundsThisTurnRef.current = 0;
    pendingGiggidyBallsThisTurnRef.current = 0;
    pendingShotLaunchesThisTurnRef.current = 0;
    lastBottomCrossingXRef.current = null;
    shotStartedAtMsRef.current = null;
    nextBoardShotAvailableAtMsRef.current = 0;

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
        const orbSkillGaugeMaxByColor = getRunOrbSkillGaugeMaxByColor(runState, draft.permanentUpgrades);
        for (const variant of CORE_VARIANTS) {
          runState.essenceByColor[variant] = clampNumber(
            (runState.essenceByColor[variant] ?? 0) + (rewards.essenceByColor[variant] ?? 0),
            0,
            orbSkillGaugeMaxByColor[variant]
          );
        }
        runState.board.bricks = brickSnapshot;
        runState.coreCharge = postTurnCoreCharge;
        if (usedHomingBarrage) {
          runState.homingBarrageReady = false;
        }
        runState.levelBricksDestroyed = (runState.levelBricksDestroyed ?? 0) + destroyedThisTurn;
        runState.boardShotsTaken = (runState.boardShotsTaken ?? 0) + shotsLaunchedThisTurn;
        if (typeof lastBottomCrossingX === 'number') {
          runState.launchOriginX = clampLaunchOriginX(lastBottomCrossingX);
        }
        runState.boardBounceCount = (runState.boardBounceCount ?? 0) + bounceCountThisTurn;
        runState.boardManaEarned = (runState.boardManaEarned ?? 0) + Math.round(rewards.mana);
        runState.boardManualBricksDestroyed = (runState.boardManualBricksDestroyed ?? 0) + manualBricksThisTurn;
        if (killShotBricksBeforeOrb > 0) {
          runState.boardKillShotBricksBeforeOrb = killShotBricksBeforeOrb;
        }
        if (cleanPlateAwardedThisTurn) {
          runState.boardCleanPlateAwarded = true;
        }
        runState.boardBestBallRebounds = Math.max(runState.boardBestBallRebounds ?? 0, maxBallReboundsThisTurn);
        runState.boardGiggidyBalls = (runState.boardGiggidyBalls ?? 0) + giggidyBallsThisTurn;
        if (turnDurationMs > 10_000) {
          runState.boardSlowAndSteadyShots = (runState.boardSlowAndSteadyShots ?? 0) + 1;
        }
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
              ? `${remainingObjectiveIds.length} orb${remainingObjectiveIds.length === 1 ? '' : 's'} remain.`
              : 'Orb drained.';
          shouldFlashCoreBreach = true;
          flashVariant = currentObjective?.coreVariant ?? flashVariant;
        }

        if (runState.board.bricks.length === 0) {
          const clearedBoardLevel = runState.level;
          const clearedPathNode = runState.pathNodesByLevel[clearedBoardLevel] ?? getCurrentPathNode(runState);
          const manaRaw = runState.boardManaEarned ?? 0;
          const { bonuses, manaBonus } = computeSkillBonuses({
            shotsTaken: runState.boardShotsTaken,
            manualBricksDestroyed: runState.boardManualBricksDestroyed ?? 0,
            killShotBricksBeforeOrb: runState.boardKillShotBricksBeforeOrb ?? 0,
            cleanPlateAwarded: runState.boardCleanPlateAwarded ?? false,
            slowAndSteadyShots: runState.boardSlowAndSteadyShots ?? 0,
            giggidyBalls: runState.boardGiggidyBalls ?? 0,
            bestBallRebounds: runState.boardBestBallRebounds ?? 0,
            manaRaw,
          });
          // Apply skill bonus mana (positive or negative), clamped so run mana doesn't go below 0
          const clampedBonus = Math.max(-runState.mana, manaBonus);
          runState.mana = Math.max(0, runState.mana + clampedBonus);
          const boardSummary: BoardSummary = {
            shotsTaken: runState.boardShotsTaken,
            bounceCount: runState.boardBounceCount,
            manualBricksDestroyed: runState.boardManualBricksDestroyed ?? 0,
            killShotBricksBeforeOrb: runState.boardKillShotBricksBeforeOrb ?? 0,
            slowAndSteadyShots: runState.boardSlowAndSteadyShots ?? 0,
            giggidyBalls: runState.boardGiggidyBalls ?? 0,
            bestBallRebounds: runState.boardBestBallRebounds ?? 0,
            manaRaw,
            skillBonuses: bonuses,
            manaBonus: clampedBonus,
            achievements: [],
          };
          boardSummary.achievements = buildBoardAchievements(boardSummary);
          runState.lastBoardSummary = boardSummary;
          runState.boardSummaryAcknowledged = false;
          runState.boardsCleared += 1;
          runState.level += 1;
          const clearedChallenge = getPathChallengeDefinition(clearedPathNode.challenge);
          const clearedDomain = getDeepwoodDomainDefinition(clearedChallenge.domain);
          const forecastWarden = clearedDomain.wardens[0];
          runState.hubMessage = `Board cleared. Press deeper to sector ${Math.min(runState.level, runState.maxLevels)} toward ${clearedDomain.name}.${forecastWarden ? ` Forecast warden pressure: ${forecastWarden.name}.` : ''}`;

          const firstWarden = getFirstWardenTrigger(runState, clearedBoardLevel);
          if (firstWarden) {
            runState.stage = 'warden';
            runState.activeWardenId = firstWarden.id;
            const triggerDomain =
              WARDEN_TRIGGERS.find((trigger) => trigger.level === clearedBoardLevel)?.domain ??
              clearedChallenge.domain;
            runState.activeWardenDomain = triggerDomain;
            runState.pendingPowerOffers = [];
            runState.pendingSpoilsOffers = [];
            runState.hubMessage = `${firstWarden.name} blocks the trail. Prototype encounter ready.`;
            runState.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
            runState.coreCharge = 0;
            runState.homingBarrageReady = false;
            return;
          }

          if (runState.level > runState.maxLevels) {
            runState.stage = 'hub';
            runState.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
            runState.coreCharge = 0;
            runState.homingBarrageReady = false;
            runState.boardShotsTaken = 0;
            runState.boardBounceCount = 0;
            runState.boardSlowAndSteadyShots = 0;
            runState.boardGiggidyBalls = 0;
            runState.boardBestBallRebounds = 0;
            runState.hubMessage = 'The final warden has fallen. Your trail is complete.';
            return;
          }

          if (runState.boardsCleared % BALANCE.powerChoiceEveryBoards === 0) {
            runState.stage = 'powerup';
            runState.pendingPowerOffers = makePowerOffers(runState);
          } else {
            runState.stage = 'hub';
            runState.pendingSpoilsOffers = [];
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
  }, [commitProfile, coreBreachFlashVariant]);

  useEffect(() => {
    if (!autoHomingLaunchPending) {
      return;
    }
  }, [autoHomingLaunchPending]);

  useEffect(() => {
    if (!profile?.run) {
      return;
    }
    if (
      profile.run.level > profile.run.maxLevels &&
      profile.run.stage === 'hub' &&
      !profile.run.activeWardenId
    ) {
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
      if (currentRun.board.bricks.length === 0) {
        return;
      }
      const now = performance.now();
      const forceHoming = Boolean(options?.forceHoming);
      if (!forceHoming && now < nextBoardShotAvailableAtMsRef.current) {
        return;
      }
      const continuingActiveShot = shotInFlightRef.current;

      setIsDragging(false);
      aimPointRef.current = null;
      setAimPoint(null);
      setAutoHomingLaunchPending(false);
      if (coreBreachFlashTimeoutRef.current !== null) {
        window.clearTimeout(coreBreachFlashTimeoutRef.current);
        coreBreachFlashTimeoutRef.current = null;
      }
      if (coreBreachLaunchFrameRef.current !== null) {
        window.cancelAnimationFrame(coreBreachLaunchFrameRef.current);
        coreBreachLaunchFrameRef.current = null;
      }
      boardAdvanceAnimationRef.current = null;
      const sourceBricks = continuingActiveShot
        ? bricksRef.current
        : options?.forceHoming
          ? bricksRef.current
          : currentRun.board.bricks;
      if (sourceBricks.length === 0) {
        return;
      }
      const launchOriginX = getLaunchOriginX(currentRun);
      const homingBarrageActive = Boolean(currentRun.homingBarrageReady || forceHoming);
      const launchBallRadius = getRunBallRadius(currentRun);
      const launchBallMass = getRunBallMass(currentRun);
      const baseBallSpeed = getRunBallSpeed(currentRun);
      const cadenceScale = clampNumber(currentRun.launchCadenceMultiplier, 0.7, 1.9);
      const launchDelayMs = Math.max(28, Math.round(BALANCE.launchStaggerMs / cadenceScale));
      if (!continuingActiveShot) {
        shotInFlightRef.current = true;
        setShotInProgress(true);
        lastBottomCrossingXRef.current = null;
        setLiveHud({
          destroyedBricks: 0,
          manaEarned: 0,
          remainingBricks: sourceBricks.length,
          essenceByColor: { yellow: 0, blue: 0, green: 0 },
        });
        ballsRef.current = [];
        bricksRef.current = sourceBricks.map((brick) => ({ ...brick }));
        launchQueueRef.current = [];
        launchElapsedRef.current = 0;
        pendingRewardsRef.current = { mana: 0, essenceByColor: { yellow: 0, blue: 0, green: 0 } };
        pendingDestroyedBricksRef.current = 0;
        pendingBounceCountRef.current = 0;
        manaBonusEventTextsRef.current = [];
        manaBonusEventTextLastUpdateAtRef.current = null;
        pendingMaxBallReboundsThisTurnRef.current = 0;
        pendingGiggidyBallsThisTurnRef.current = 0;
        pendingShotLaunchesThisTurnRef.current = 0;
        shotStartedAtMsRef.current = now;
        coreChargeRef.current = currentRun.coreCharge ?? 0;
        homingBulletTimeHitsRef.current = 0;
        finalBrickCinematicUntilRef.current = 0;
      }
      const launchQueueBaseDelayMs = Math.max(
        launchElapsedRef.current,
        launchQueueRef.current.length > 0
          ? launchQueueRef.current[launchQueueRef.current.length - 1].delayMs
          : launchElapsedRef.current
      );
      const briarVolleyLevel = getRunPowerLevel(currentRun, 'arcane-volley');
      const huntersDrawLevel = getRunPowerLevel(currentRun, 'rune-edge');
      const spreadScale = clampNumber(currentRun.launchSpreadMultiplier, 0.75, 1.9);
      const precisionWindowRadians =
        ((getBriarVolleyMaxOffsetDegrees(briarVolleyLevel) * spreadScale) * Math.PI) / 180;
      const consistencyChance = getHuntersDrawConsistencyChance(huntersDrawLevel);
      const baseAimAngle = Math.atan2(direction.y, direction.x);
      const aimedSpawns = homingBarrageActive
        ? []
        : buildAimedVolleySpawns({
            shotCount: currentRun.ballCount,
            baseAimAngle,
            baseSpeed: baseBallSpeed,
            precisionWindowRadians,
            consistencyChance,
            critChance: currentRun.critChance,
          });
      const queuedLaunches: LaunchQueueItem[] = Array.from({ length: currentRun.ballCount }, (_, index) => {
        const aimedSpawn = aimedSpawns[index];
        const isCritShot = aimedSpawn
          ? aimedSpawn.isCritShot
          : FORCE_ALL_CRIT_SHOTS_FOR_TESTING || Math.random() < currentRun.critChance;
        const vx = homingBarrageActive
          ? Math.cos(-Math.PI * 0.5 + (Math.random() - 0.5) * 0.8) * baseBallSpeed * 1.2
          : (aimedSpawn?.vx ?? direction.x * baseBallSpeed);
        const vy = homingBarrageActive
          ? Math.sin(-Math.PI * 0.5 + (Math.random() - 0.5) * 0.8) * baseBallSpeed * 1.2
          : (aimedSpawn?.vy ?? direction.y * baseBallSpeed);
        return {
          delayMs: launchQueueBaseDelayMs + index * launchDelayMs,
          spawn: {
            x: launchOriginX,
            y: LAUNCHER_Y + BOARD_TURRET_Y_OFFSET,
            vx,
            vy,
            radius: launchBallRadius,
            mass: launchBallMass,
            isCritShot,
          },
        };
      });
      launchQueueRef.current.push(...queuedLaunches);
      homingBarrageUsedRef.current = homingBarrageUsedRef.current || homingBarrageActive;
      pendingShotLaunchesThisTurnRef.current += 1;
      nextBoardShotAvailableAtMsRef.current = now + getRunShotCooldownMs(currentRun);

      if (continuingActiveShot) {
        return;
      }

      let noHitElapsedMs = 0;
      let speedMultiplier = 1;

      let previousTs = now;
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
          const queuedLaunch = launchQueueRef.current.shift();
          if (!queuedLaunch?.spawn) {
            continue;
          }
          ballsRef.current.push({
            x: queuedLaunch.spawn.x,
            y: queuedLaunch.spawn.y,
            vx: queuedLaunch.spawn.vx,
            vy: queuedLaunch.spawn.vy,
            radius: queuedLaunch.spawn.radius,
            mass: queuedLaunch.spawn.mass,
            active: true,
            coreCharged: false,
            isCritShot: queuedLaunch.spawn.isCritShot ?? false,
            reboundCount: 0,
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
          if (isObjective) {
            const coreVariant = brick.coreVariant ?? 'yellow';
            rewards.essenceByColor[coreVariant] += 1;
          }
          const bonusManaReward = isObjective
            ? 0.2 + Math.max(1, brick.maxHp) * 0.018
            : isUnbreakable
              ? 0.06
            : 0.06 + Math.max(1, brick.maxHp) * 0.008;
          rewards.mana +=
            activeRun.manaMultiplier *
            getManaYieldScale(activeRun.boardsCleared, BALANCE.manaRewardDecayPerBoard, BALANCE.manaRewardMinScale) *
            bonusManaReward;
          // Track skill bonus stats
          if (!homingBarrageActive) {
            pendingManualBricksThisTurnRef.current += 1;
          }
          if (!isObjective) {
            pendingPreOrbBricksThisTurnRef.current += 1;
          }
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
          const brickBounds = getBrickBounds(
            brick,
            getBrickX(brick.col, brickWidth),
            BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP),
            brickWidth
          );
          const eventTextX = brickBounds.x + brickBounds.width * 0.5;
          const eventTextY = brickBounds.y + brickBounds.height * 0.5;
          const remainingBreakableNonOrbBricks = bricksRef.current.reduce((count, entry) => {
            if (entry.id === brick.id || entry.hp <= 0) {
              return count;
            }
            const kind = entry.kind ?? 'standard';
            return kind === 'objective' || kind === 'unbreakable' ? count : count + 1;
          }, 0);
          if (
            !pendingCleanPlateAwardedRef.current &&
            !isObjective &&
            !isUnbreakable &&
            remainingBreakableNonOrbBricks === 0 &&
            remainingObjectiveCount > 0 &&
            !coreBreachHandledThisTurnRef.current
          ) {
            pendingCleanPlateAwardedRef.current = true;
            spawnManaBonusEventText('clean plate', eventTextX, eventTextY - 18);
          }
          if (isObjective && remainingObjectiveCount === 0) {
            // Capture how many non-orb bricks were cleared this turn before the orb died
            pendingKillShotBricksBeforeOrbRef.current = pendingPreOrbBricksThisTurnRef.current;
            if (pendingKillShotBricksBeforeOrbRef.current >= TPose_THRESHOLD_BRICKS_BEFORE_ORB) {
              spawnManaBonusEventText('t pose', eventTextX, eventTextY);
            }
            const remainingBricksToPop = bricksRef.current.filter((entry) => entry.id !== brick.id && entry.hp > 0);
            for (const remainingBrick of remainingBricksToPop) {
              remainingBrick.hp = 0;
              destroyBrick(remainingBrick, null);
            }
            ballsRef.current = [];
            launchQueueRef.current = [];
            coreBreachHandledThisTurnRef.current = true;
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
              const brickX = getBrickX(brick.col, brickWidth);
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
                  radius: clampNumber(sourceBall.radius * 0.94, BALL_RADIUS_MIN, BALL_RADIUS_MAX),
                  mass: clampNumber(sourceBall.mass * 0.92, BALL_MASS_MIN, BALL_MASS_MAX),
                  active: true,
                  coreCharged: sourceBall.coreCharged,
                  isCritShot: sourceBall.isCritShot,
                  reboundCount: sourceBall.reboundCount ?? 0,
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
              const neighborHpBeforeHit = neighbor.hp;
              neighbor.hp -= splashDamage;
              const neighborDamageApplied = Math.max(0, neighborHpBeforeHit - Math.max(0, neighbor.hp));
              if ((neighbor.kind ?? 'standard') === 'objective' && neighborDamageApplied > 0) {
                const neighborVariant = neighbor.coreVariant ?? 'yellow';
                rewards.essenceByColor[neighborVariant] += neighborDamageApplied;
              }
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
                getBrickX(blueCoreBrick.col, blueCoreWidth),
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
                getBrickX(nearestBlueCore.col, blueCoreWidth),
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
                const blueCoreSizePressure = clampNumber(
                  (blueCoreSizeScale - BLUE_CORE_MIN_SCALE) / (1 - BLUE_CORE_MIN_SCALE),
                  0,
                  1
                );
                const blueCoreForceScale = 0.2 + Math.pow(blueCoreSizePressure, 2) * 1.15;
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
                  const approachAmplifier = 0.78 + towardCoreAlignment * (1.1 + blueCoreSizePressure * 1.1);
                  const repelStrength =
                    proximity * proximity * 560 * blueCoreForceScale * approachAmplifier;
                  const massInfluence = clampNumber(1.18 / ball.mass, 0.62, 1.7);
                  const resistance = (ball.coreCharged ? 0.72 : 1) * massInfluence;
                  ball.vx += awayNormalX * repelStrength * resistance * dtSeconds;
                  ball.vy += awayNormalY * repelStrength * resistance * dtSeconds;

                  const tangentX = -awayNormalY;
                  const tangentY = awayNormalX;
                  const cross = ball.vx * awayNormalY - ball.vy * awayNormalX;
                  const swirlDirection = cross === 0 ? (ball.x < blueCoreCenterX ? -1 : 1) : Math.sign(cross);
                  const swerveStrength = proximity * 360 * blueCoreForceScale * approachAmplifier;
                  ball.vx += tangentX * swirlDirection * swerveStrength * resistance * dtSeconds;
                  ball.vy += tangentY * swirlDirection * swerveStrength * resistance * dtSeconds;
                  const towardCoreVelocity = ball.vx * toCoreNormalX + ball.vy * toCoreNormalY;
                  if (towardCoreVelocity > 0) {
                    const deflectionLock = 0.3 + blueCoreSizePressure * 0.55;
                    ball.vx -= toCoreNormalX * towardCoreVelocity * deflectionLock;
                    ball.vy -= toCoreNormalY * towardCoreVelocity * deflectionLock;
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
            const collisionBricks = [...bricksRef.current].sort((left, right) => {
              const leftObjective = (left.kind ?? 'standard') === 'objective' ? 1 : 0;
              const rightObjective = (right.kind ?? 'standard') === 'objective' ? 1 : 0;
              return leftObjective - rightObjective;
            });
            for (const brick of collisionBricks) {
              if (brick.hp <= 0) {
                continue;
              }
              const targetX = getBrickX(brick.col, brickWidth) + brickWidth * 0.5;
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
              const targetX = getBrickX(nearestBrick.col, brickWidth) + brickWidth * 0.5;
              const targetY = BRICK_TOP + nearestBrick.row * (BRICK_HEIGHT + BRICK_GAP) + BRICK_HEIGHT * 0.5;
              const toTargetX = targetX - ball.x;
              const toTargetY = targetY - ball.y;
              const toTargetLength = Math.hypot(toTargetX, toTargetY);
              if (toTargetLength > 0.001) {
                const homingSpeed = baseBallSpeed * 1.45;
                ball.vx = (toTargetX / toTargetLength) * homingSpeed;
                ball.vy = (toTargetY / toTargetLength) * homingSpeed;
              }
            }
          }

          const travelX = ball.vx * dtSeconds;
          const travelY = ball.vy * dtSeconds;
          const travelDistance = Math.hypot(travelX, travelY);
          const subSteps = Math.max(1, Math.min(6, Math.ceil(travelDistance / (ball.radius * 0.65))));
          const stepX = travelX / subSteps;
          const stepY = travelY / subSteps;

          for (let stepIndex = 0; stepIndex < subSteps; stepIndex += 1) {
            const previousX = ball.x;
            const previousY = ball.y;
            ball.x += stepX;
            ball.y += stepY;

            const leftWallX = BOARD_SIDE_CHANNEL_WIDTH;
            const rightWallX = CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH;
            if (ball.x <= leftWallX + ball.radius) {
              ball.x = leftWallX + ball.radius;
              ball.vx = Math.abs(ball.vx);
              ball.coreCharged = true;
              pendingBounceCountRef.current += 1;
            } else if (ball.x >= rightWallX - ball.radius) {
              ball.x = rightWallX - ball.radius;
              ball.vx = -Math.abs(ball.vx);
              ball.coreCharged = true;
              pendingBounceCountRef.current += 1;
            }

            if (ball.y <= ball.radius) {
              ball.y = ball.radius;
              ball.vy = Math.abs(ball.vy);
              ball.coreCharged = true;
              pendingBounceCountRef.current += 1;
            }
            if (homingBarrageActive && ball.y >= CANVAS_HEIGHT - ball.radius) {
              ball.y = CANVAS_HEIGHT - ball.radius;
              ball.vy = -Math.abs(ball.vy);
              pendingBounceCountRef.current += 1;
            }
            if (previousY < LOSE_Y && ball.y >= LOSE_Y) {
              const crossingProgress =
                ball.y === previousY ? 1 : clampNumber((LOSE_Y - previousY) / (ball.y - previousY), 0, 1);
              lastBottomCrossingXRef.current = clampLaunchOriginX(previousX + (ball.x - previousX) * crossingProgress);
            }

            let hitBrick = false;
            for (const brick of bricksRef.current) {
              if (brick.hp <= 0) {
                continue;
              }
              const brickX = getBrickX(brick.col, brickWidth);
              const brickY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
              const brickBounds = getBrickBounds(brick, brickX, brickY, brickWidth);
              const collisionX = brickBounds.x;
              const collisionY = brickBounds.y;
              const collisionWidth = brickBounds.width;
              const collisionHeight = brickBounds.height;
              if (
                ball.x + ball.radius < collisionX ||
                ball.x - ball.radius > collisionX + collisionWidth ||
                ball.y + ball.radius < collisionY ||
                ball.y - ball.radius > collisionY + collisionHeight
              ) {
                continue;
              }

              const nearestX = clampCoordinate(ball.x, collisionX, collisionX + collisionWidth);
              const nearestY = clampCoordinate(ball.y, collisionY, collisionY + collisionHeight);
              const deltaX = ball.x - nearestX;
              const deltaY = ball.y - nearestY;
              const distanceSq = deltaX * deltaX + deltaY * deltaY;
              const radiusSq = ball.radius * ball.radius;
              if (distanceSq > radiusSq) {
                continue;
              }
              const hitVerticalEdge =
                Math.abs(nearestX - collisionX) < 0.001 || Math.abs(nearestX - (collisionX + collisionWidth)) < 0.001;
              const hitHorizontalEdge =
                Math.abs(nearestY - collisionY) < 0.001 || Math.abs(nearestY - (collisionY + collisionHeight)) < 0.001;
              const cornerHit = hitVerticalEdge && hitHorizontalEdge;

              const isCrit = ball.isCritShot;
              const baseDamage = activeRun.damage * (isCrit ? 10 : 1);
              const chargedDamage = Math.max(1, Math.round(baseDamage * (1 + objectiveCharge * 1.4)));
              const variant = brick.kind ?? 'standard';
              const coreVariant = brick.coreVariant ?? 'yellow';
              if (variant !== 'objective') {
                ball.coreCharged = true;
              }
              const coreWeight = variant === 'objective' ? getCoreDamageWeight(activeRun, coreVariant) : 1;
              const profileCoreBonus =
                variant === 'objective'
                  ? coreVariant === 'green'
                    ? clampNumber((BALL_RADIUS / ball.radius) * 0.2 + 0.9, 0.8, 1.35)
                    : coreVariant === 'yellow'
                      ? clampNumber(ball.mass * 0.22 + 0.8, 0.78, 1.32)
                      : clampNumber(ball.mass * 0.25 + 0.82, 0.8, 1.34)
                  : 1;
              const damage =
                variant === 'reinforced'
                  ? Math.max(1, Math.round(chargedDamage * 0.75 * coreWeight * profileCoreBonus))
                  : variant === 'splinter'
                    ? Math.max(1, Math.round(chargedDamage * 0.9 * coreWeight * profileCoreBonus))
                    : Math.max(1, Math.round(chargedDamage * coreWeight * profileCoreBonus));

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
                ball.isCritShot ||
                coreVariant !== 'yellow';
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
                rewards.mana +=
                  activeRun.manaMultiplier *
                  getManaYieldScale(activeRun.boardsCleared, BALANCE.manaRewardDecayPerBoard, BALANCE.manaRewardMinScale) *
                  baseManaReward;
                if (brick.hp <= 0) {
                  destroyBrick(brick, ball);
                }
              } else {
                brickVisualRef.current.set(brick.id, { hitUntil: timestamp + 80 });
              }

              if (variant === 'objective' && coreVariant === 'yellow' && !homingBarrageActive && ball.active) {
                const lowMassPressure = clampNumber((1 / ball.mass - 0.55) * 0.28, 0, 0.3);
                const smallBallPressure = clampNumber((BALL_RADIUS - ball.radius) / BALL_RADIUS, -0.2, 0.35);
                const consumeChance = clampNumber(
                  0.08 + lowMassPressure + smallBallPressure - activeRun.yellowCoreConsumeResistance,
                  0.02,
                  0.46
                );
                if (Math.random() < consumeChance) {
                  ball.active = false;
                  hitBrick = true;
                  break;
                }
              }

              const penetration = ball.radius - Math.sqrt(Math.max(distanceSq, 0));
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
              ball.reboundCount = (ball.reboundCount ?? 0) + 1;
              pendingMaxBallReboundsThisTurnRef.current = Math.max(
                pendingMaxBallReboundsThisTurnRef.current,
                ball.reboundCount
              );
              if (ball.reboundCount === 51) {
                pendingGiggidyBallsThisTurnRef.current += 1;
                spawnManaBonusEventText('giggidy', ball.x, ball.y - ball.radius - 8);
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
            remainingBricks: bricksRef.current.length,
            essenceByColor: { ...rewards.essenceByColor },
          });
          // Sync HP changes back to profile state to keep UI in sync during shots
          if (profileRef.current?.run) {
            profileRef.current.run.board.bricks = bricksRef.current.map((brick) => ({ ...brick }));
          }
          // Trigger UI re-render to update orb indicators
          setFrameUpdateTrigger((t) => t + 1);
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
    [draw, finalizeTurn, spawnBreakParticles, spawnManaBonusEventText]
  );

  useEffect(
    () => () => {
      if (coreBreachFlashTimeoutRef.current !== null) {
        window.clearTimeout(coreBreachFlashTimeoutRef.current);
        coreBreachFlashTimeoutRef.current = null;
      }
      if (orbSlotUpgradeFlashTimeoutRef.current !== null) {
        window.clearTimeout(orbSlotUpgradeFlashTimeoutRef.current);
        orbSlotUpgradeFlashTimeoutRef.current = null;
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
    setOrbSlotUpgradeFlash(null);
    if (idleAnimationRef.current !== null) {
      cancelAnimationFrame(idleAnimationRef.current);
      idleAnimationRef.current = null;
    }
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (wardenAnimationRef.current !== null) {
      cancelAnimationFrame(wardenAnimationRef.current);
      wardenAnimationRef.current = null;
    }
    if (coreBreachFlashTimeoutRef.current !== null) {
      window.clearTimeout(coreBreachFlashTimeoutRef.current);
      coreBreachFlashTimeoutRef.current = null;
    }
    if (orbSlotUpgradeFlashTimeoutRef.current !== null) {
      window.clearTimeout(orbSlotUpgradeFlashTimeoutRef.current);
      orbSlotUpgradeFlashTimeoutRef.current = null;
    }
    if (coreBreachLaunchFrameRef.current !== null) {
      window.cancelAnimationFrame(coreBreachLaunchFrameRef.current);
      coreBreachLaunchFrameRef.current = null;
    }

    shotInFlightRef.current = false;
    setShotInProgress(false);
    setIsDragging(false);
    isDraggingRef.current = false;
    aimPointRef.current = null;
    setAimPoint(null);
    launchQueueRef.current = [];
    launchElapsedRef.current = 0;
    ballsRef.current = [];
    bricksRef.current = [];
    breakParticlesRef.current = [];
    brickVisualRef.current.clear();
    pendingRewardsRef.current = { mana: 0, essenceByColor: { yellow: 0, blue: 0, green: 0 } };
    pendingDestroyedBricksRef.current = 0;
    pendingBounceCountRef.current = 0;
    pendingManualBricksThisTurnRef.current = 0;
    pendingPreOrbBricksThisTurnRef.current = 0;
    pendingKillShotBricksBeforeOrbRef.current = 0;
    pendingCleanPlateAwardedRef.current = false;
    pendingMaxBallReboundsThisTurnRef.current = 0;
    pendingGiggidyBallsThisTurnRef.current = 0;
    pendingShotLaunchesThisTurnRef.current = 0;
    lastBottomCrossingXRef.current = null;
    coreChargeRef.current = 0;
    homingBarrageUsedRef.current = false;
    homingBulletTimeHitsRef.current = 0;
    shotStartedAtMsRef.current = null;
    nextBoardShotAvailableAtMsRef.current = 0;
    nextWardenShotAvailableAtMsRef.current = 0;
    wardenVolleysFiredThisEncounterRef.current = 0;
    finalBrickCinematicUntilRef.current = 0;
    boardAdvanceAnimationRef.current = null;
    manaBonusEventTextsRef.current = [];
    manaBonusEventTextLastUpdateAtRef.current = null;
    coreBreachHandledThisTurnRef.current = false;
    setWardenSelectedShotCount(WARDEN_SHOT_BASE_COUNT);
    setWardenSelectedPower(1);
    const resetEyeHp = [WARDEN_BLANK_HP_MAX];
    setWardenEyeHp(resetEyeHp);
    wardenEyeHpRef.current = resetEyeHp;
    setWardenDefeatCinematicUntilMs(null);
    setWardenBossHitFlashUntilMs(0);
    setWardenActiveTear(null);
    wardenActiveTearRef.current = null;
    wardenNextTearSecRef.current = getWardenTearCountdownSec(
      WARDEN_TEAR_DEFAULT_DETACH_SEC,
      WARDEN_TEAR_FIRST_STARTUP_SEC
    );
    wardenTearFallProgressRef.current = 0;
    wardenBallLastFrameMsRef.current = null;
    wardenImpactParticlesRef.current = [];
    wardenLaunchConfigRef.current = null;
    wardenShieldStartBlueRef.current = 1;
    wardenStartOrangeRef.current = 1;
    wardenStartGreenRef.current = 1;
    const abandonShield = WARDEN_SHIELD_BASE_PIPS;
    wardenShieldHpRef.current = abandonShield;
    wardenShieldMaxRef.current = abandonShield;
    wardenShieldGraceUntilMsRef.current = null;
    setWardenShieldHp(abandonShield);
    blankEyeCanvasPositionsRef.current = [{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT * 0.18 }];
    isWardenLidClosedRef.current = false;
    wardenLidProgressRef.current = 0;
    isWardenSecondLidClosedRef.current = false;
    wardenSecondLidProgressRef.current = 0;
    wardenNextTearEyeIndexRef.current = 0;
    setSelectedPowerId(null);
    setSelectedResourceHelp(null);
    setPreviewStartingPowerId(null);
    setPendingStartingRunPowerId(null);
    setStartingRunPowerChoices([]);
    setDismissedDefeatSummaryCompletedAt(null);
    setAutoHomingLaunchPending(false);
    setIsCoreBreachFlashing(false);
    setCoreBreachFlashVariant('yellow');
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      remainingBricks: 0,
      essenceByColor: { yellow: 0, blue: 0, green: 0 },
    });

    const resetProfile = defaultProfile();
    profileRef.current = resetProfile;
    setProfile(resetProfile);
    setSaveStatus('saving');
    void browserRogueBrickPersistence.clear().catch(() => {
      setSaveStatus('error');
    });
  }, []);

  const resetGame = useCallback(() => {
    setIsPowerDrawerExpanded(false);
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
    nextBoardShotAvailableAtMsRef.current = 0;
    nextWardenShotAvailableAtMsRef.current = 0;
    wardenVolleysFiredThisEncounterRef.current = 0;
    pendingShotLaunchesThisTurnRef.current = 0;
    commitProfile((draft) => {
      const startingTemplate = SPOILS_POOL.find((template) => template.id === startingPowerId);
      if (!startingTemplate) {
        return;
      }
      const seed = Math.floor(Math.random() * 4_000_000_000) >>> 0;
      const upgrades = draft.permanentUpgrades;
      const startingBalls =
        5 +
        (upgrades.startingBalls.enabled ? upgrades.startingBalls.rank * 2 : 0);
      const startingMana =
        upgrades.startingMana.enabled ? upgrades.startingMana.rank * 12 : 0;
      const startingDamage =
        1 + (upgrades.startingDamage.enabled ? upgrades.startingDamage.rank : 0);

      const runState: RogueRunState = {
        seed,
        rngState: seed,
        stage: 'hub',
        level: 1,
        maxLevels: BALANCE.maxLevels,
        boardsCleared: 0,
        nextSpoilsBoard: 0,
        mana: startingMana,
        essenceByColor: { yellow: 0, blue: 0, green: 0 },
        orbSlotBonusByColor: { yellow: 0, blue: 0, green: 0 },
        ballCount: startingBalls,
        damage: startingDamage,
        critChance: 0.01,
        manaMultiplier: 1,
        ballRadiusMultiplier: 1,
        ballMassMultiplier: 1,
        ballSpeedMultiplier: 1,
        launchSpreadMultiplier: 1,
        launchCadenceMultiplier: 1,
        yellowCoreConsumeResistance: 0,
        coreDamageWeights: { yellow: 1, blue: 1, green: 1 },
        powers: {},
        levelGoalBricks: 1,
        levelBricksDestroyed: 0,
        coreCharge: 0,
        homingBarrageReady: false,
        board: { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] },
        pendingPowerOffers: [],
        pendingSpoilsOffers: [],
        hubMessage: '',
        boardShotsTaken: 0,
        boardBounceCount: 0,
        boardManaEarned: 0,
        boardManualBricksDestroyed: 0,
        boardKillShotBricksBeforeOrb: 0,
        boardCleanPlateAwarded: false,
        boardSlowAndSteadyShots: 0,
        boardGiggidyBalls: 0,
        boardBestBallRebounds: 0,
        lastBoardSummary: null,
        boardSummaryAcknowledged: true,
        launchOriginX: DEFAULT_LAUNCH_ORIGIN_X,
        pathCurrentNodeId: '',
        pathNodesByLevel: {},
        activeWardenId: null,
        activeWardenDomain: null,
        wardensDefeated: [],
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
      remainingBricks: 0,
      essenceByColor: { yellow: 0, blue: 0, green: 0 },
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

  // ⚠️ DEV ONLY — remove before shipping
  const DEV_launchBlankBattle = useCallback((targetEncounterLevel?: number) => {
    commitProfile((draft) => {
      if (!draft.run) return;
      const runState = draft.run;
      if (typeof targetEncounterLevel === 'number' && Number.isFinite(targetEncounterLevel) && targetEncounterLevel > 0) {
        ensureRunPathState(runState);
        const normalizedLevel = Math.max(1, Math.floor(targetEncounterLevel));
        if (!runState.pathNodesByLevel[normalizedLevel]) {
          const fallbackParentNode =
            runState.pathNodesByLevel[normalizedLevel - 1] ??
            runState.pathNodesByLevel[Math.max(0, normalizedLevel - 2)] ??
            runState.pathNodesByLevel[0] ??
            createRootPathNode(runState.seed);
          const lane = normalizePathLaneForLevel(0, normalizedLevel, runState.seed, fallbackParentNode.id);
          const challenge: PathChallengeKey = 'balanced';
          runState.pathNodesByLevel[normalizedLevel] = {
            id: makePathNodeId(runState.seed, normalizedLevel, lane, fallbackParentNode.id, challenge),
            parentId: fallbackParentNode.id,
            level: normalizedLevel,
            lane,
            challenge,
            primaryCoreVariant: getPathNodePrimaryCoreVariant(runState.seed, normalizedLevel, lane),
          };
        }
        runState.pathCurrentNodeId = runState.pathNodesByLevel[normalizedLevel].id;
      }
      runState.stage = 'warden';
      runState.activeWardenId = 'blank';
      runState.activeWardenDomain = 'thorn-keep';
      runState.pendingPowerOffers = [];
      runState.pendingSpoilsOffers = [];
      runState.hubMessage =
        typeof targetEncounterLevel === 'number' && Number.isFinite(targetEncounterLevel)
          ? `[DEV] Blank battle forced (encounter level ${Math.max(1, Math.floor(targetEncounterLevel))}).`
          : '[DEV] Blank battle forced.';
      runState.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
      runState.coreCharge = 0;
      runState.homingBarrageReady = false;
      runState.boardShotsTaken = 0;
      runState.boardBounceCount = 0;
      runState.boardManaEarned = 0;
      runState.boardManualBricksDestroyed = 0;
      runState.boardKillShotBricksBeforeOrb = 0;
      runState.boardCleanPlateAwarded = false;
      runState.boardSlowAndSteadyShots = 0;
      runState.boardGiggidyBalls = 0;
      runState.boardBestBallRebounds = 0;
      runState.lastBoardSummary = null;
      runState.boardSummaryAcknowledged = true;
    }, true);
  }, [commitProfile]);

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
      if (draft.run.pendingSpoilsOffers.length > 0) {
        draft.run.hubMessage = 'Claim your warden spoil before advancing.';
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

      const wardenForecast = getPathNodeWardenForecast(runState, selectedNode);
      const wardenTrigger = WARDEN_TRIGGERS.find((t) => t.level === selectedNode.level);
      if (wardenForecast && wardenTrigger) {
        runState.stage = 'warden';
        runState.activeWardenId = wardenForecast.id;
        runState.activeWardenDomain = wardenTrigger.domain;
        runState.pendingPowerOffers = [];
        runState.pendingSpoilsOffers = [];
        runState.hubMessage = `${wardenForecast.name} blocks the trail. Prototype encounter ready.`;
        runState.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
        runState.coreCharge = 0;
        runState.homingBarrageReady = false;
        runState.boardShotsTaken = 0;
        runState.boardBounceCount = 0;
        runState.boardManaEarned = 0;
        runState.boardManualBricksDestroyed = 0;
        runState.boardKillShotBricksBeforeOrb = 0;
        runState.boardCleanPlateAwarded = false;
        runState.boardSlowAndSteadyShots = 0;
        runState.boardGiggidyBalls = 0;
        runState.boardBestBallRebounds = 0;
        runState.lastBoardSummary = null;
        runState.boardSummaryAcknowledged = true;
        return;
      }

      runState.stage = 'board';
      runState.board = generateBoard(runState);
      runState.levelGoalBricks = calculateLevelGoal(runState.board.bricks.length);
      runState.levelBricksDestroyed = 0;
      runState.coreCharge = 0;
      runState.homingBarrageReady = false;
      runState.launchOriginX = DEFAULT_LAUNCH_ORIGIN_X;
      runState.pendingPowerOffers = [];
      runState.pendingSpoilsOffers = [];
      const challenge = getPathChallengeDefinition(selectedNode.challenge);
      const challengeLabel = challenge.label;
      const domain = getDeepwoodDomainDefinition(challenge.domain);
      const forecastWarden = domain.wardens[0];
      runState.hubMessage = `Entering sector ${runState.level} of ${runState.maxLevels} via ${challengeLabel} (${domain.name}).${forecastWarden ? ` Forecast pressure: ${forecastWarden.name}.` : ''}`;
      runState.boardShotsTaken = 0;
      runState.boardBounceCount = 0;
      runState.boardManaEarned = 0;
      runState.boardManualBricksDestroyed = 0;
      runState.boardKillShotBricksBeforeOrb = 0;
      runState.boardCleanPlateAwarded = false;
      runState.boardSlowAndSteadyShots = 0;
      runState.boardGiggidyBalls = 0;
      runState.boardBestBallRebounds = 0;
      runState.lastBoardSummary = null;
      runState.boardSummaryAcknowledged = true;
    }, true);
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      remainingBricks: 0,
      essenceByColor: { yellow: 0, blue: 0, green: 0 },
    });
    setHoveredPathNodeId(null);
    setPendingPathNodeId(null);
  }, [commitProfile]);

  const previewPathNodeSelection = useCallback((nodeId: string) => {
    setPendingPathNodeId(nodeId);
    setHoveredPathNodeId(nodeId);
  }, []);

  const confirmPathNodeSelection = useCallback(() => {
    if (!activePendingPathNodeId) {
      return;
    }
    choosePathNode(activePendingPathNodeId);
    setHoveredPathNodeId(null);
    setPendingPathNodeId(null);
  }, [activePendingPathNodeId, choosePathNode]);

  const acknowledgeBoardSummary = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage === 'board') {
        return;
      }
      draft.run.boardSummaryAcknowledged = true;
    }, true);
  }, [commitProfile]);

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
        const currentLevel = getRunPowerLevel(runState, template.id);
        if (currentLevel >= template.maxLevel) {
          runState.pendingPowerOffers = refreshPowerOffers(runState.pendingPowerOffers, runState);
          runState.hubMessage = `${template.name} is already at max level.`;
          return;
        }
        runState.mana -= offer.manaCost;
        template.apply(runState);
        runState.pendingPowerOffers = refreshPowerOffers(runState.pendingPowerOffers, runState);
        runState.hubMessage = `${template.name} advanced to level ${getRunPowerLevel(runState, template.id)}.`;
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
      draft.run.stage = 'hub';
      draft.run.hubMessage = 'Skipped technique selection.';
    }, true);
  }, [commitProfile]);

  const claimWardenReward = useCallback(
    (offerId: string) => {
      let awardedSlotVariant: CoreVariant | null = null;
      let awardedSlotIndex = -1;
      commitProfile((draft) => {
        if (!draft.run || draft.run.stage !== 'hub') {
          return;
        }
        const runState = draft.run;
        const offer = runState.pendingSpoilsOffers.find((item) => item.id === offerId);
        if (!offer) {
          return;
        }

        const template = SPOILS_POOL.find((item) => item.id === offer.id);
        if (!template) {
          return;
        }
        const currentLevel = getRunPowerLevel(runState, template.id);
        if (currentLevel >= template.maxLevel) {
          runState.pendingSpoilsOffers = [];
          runState.hubMessage = `${template.name} is already at max level.`;
          return;
        }

        template.apply(runState);
        if (template.slotVariant) {
          const gaugeMaxByColor = getRunOrbSkillGaugeMaxByColor(runState, draft.permanentUpgrades);
          awardedSlotVariant = template.slotVariant;
          awardedSlotIndex = Math.max(0, gaugeMaxByColor[template.slotVariant] - 1);
        }
        runState.pendingSpoilsOffers = [];
        runState.hubMessage = `Claimed ${offer.name}. ${template.describeLevelImpact(getRunPowerLevel(runState, template.id), runState, draft)}`;
      }, true);
      if (awardedSlotVariant !== null && awardedSlotIndex >= 0) {
        if (orbSlotUpgradeFlashTimeoutRef.current !== null) {
          window.clearTimeout(orbSlotUpgradeFlashTimeoutRef.current);
        }
        setOrbSlotUpgradeFlash({
          variant: awardedSlotVariant,
          slotIndex: awardedSlotIndex,
          token: Date.now(),
        });
        orbSlotUpgradeFlashTimeoutRef.current = window.setTimeout(() => {
          orbSlotUpgradeFlashTimeoutRef.current = null;
          setOrbSlotUpgradeFlash(null);
        }, 950);
      }
    },
    [commitProfile]
  );

  const firePrototypeWardenVolley = useCallback(() => {
    const runSnapshot = profileRef.current?.run;
    if (!runSnapshot || runSnapshot.stage !== 'warden') {
      return { fired: false, shotCount: 0, power: 0 };
    }
    if (wardenDefeatCinematicUntilMs !== null && performance.now() < wardenDefeatCinematicUntilMs) {
      return { fired: false, shotCount: 0, power: 0 };
    }
    if (wardenVolleysFiredThisEncounterRef.current >= WARDEN_VOLLEY_HARD_CAP) {
      commitProfile((draft) => {
        if (!draft.run || draft.run.stage !== 'warden') {
          return;
        }
        draft.run.hubMessage = `Volley limit reached (${WARDEN_VOLLEY_HARD_CAP}).`;
      }, true);
      return { fired: false, shotCount: 0, power: 0 };
    }

    const volleyCaps = getWardenVolleyCaps(runSnapshot, WARDEN_SHOT_BASE_COUNT);
    const { shotCount: nextShotCount, power: nextPower } = normalizeWardenVolleySelection(
      wardenSelectedShotCount,
      wardenSelectedPower,
      volleyCaps,
      WARDEN_SHOT_BASE_COUNT
    );
    const volleyCount = wardenVolleysFiredThisEncounterRef.current + 1;
    const remainingVolleys = Math.max(0, WARDEN_VOLLEY_HARD_CAP - volleyCount);
    wardenVolleysFiredThisEncounterRef.current = volleyCount;
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'warden') {
        return;
      }
      draft.run.hubMessage = `Volley fired (${nextShotCount} ball${nextShotCount === 1 ? '' : 's'} • power ${nextPower} • ${remainingVolleys} left).`;
    }, true);

    const damageProfile = getWardenVolleyDamageProfile(nextPower);
    wardenVolleyDamagePerHitRef.current = damageProfile.damagePerHit;
    wardenVolleyTearDamageRef.current = damageProfile.tearDamage;

    return { fired: true, shotCount: nextShotCount, power: nextPower };
  }, [commitProfile, wardenDefeatCinematicUntilMs, wardenSelectedPower, wardenSelectedShotCount]);

  const launchPrototypeWardenVolley = useCallback((targetOverride?: { x: number; y: number }) => {
    const runSnapshot = profileRef.current?.run;
    if (!runSnapshot || runSnapshot.stage !== 'warden') {
      return;
    }
    const now = performance.now();
    if (now < nextWardenShotAvailableAtMsRef.current) {
      return;
    }
    const continuingActiveShot = shotInFlightRef.current;
    const wardenTurretY = WARDEN_LAUNCHER_Y + WARDEN_TURRET_Y_OFFSET;
    const launchOriginX = clampLaunchOriginX(wardenDisplayedLaunchOriginXRef.current);
    const targetPoint = targetOverride ?? aimPoint ?? { x: launchOriginX, y: wardenTurretY - 220 };
    const dx = targetPoint.x - launchOriginX;
    const dy = targetPoint.y - wardenTurretY;
    const length = Math.hypot(dx, dy);
    if (length < 10) {
      return;
    }
    let nx = dx / length;
    let ny = dy / length;
    if (ny >= MIN_LAUNCH_UPWARD_COMPONENT) {
      ny = -Math.max(0.24, Math.abs(ny));
      const norm = Math.hypot(nx, ny);
      nx /= norm;
      ny /= norm;
    }
    const volley = firePrototypeWardenVolley();
    if (!volley.fired) {
      return;
    }
    const baseSpeed = getRunBallSpeed(runSnapshot);
    const powerRatio = clampNumber(volley.power / 10, 0.1, 1);
    const volleyCaps = getWardenVolleyCaps(runSnapshot, WARDEN_SHOT_BASE_COUNT);
    const launchBallRadius = clampNumber(
      getRunBallRadius(runSnapshot) * (0.72 + powerRatio * 0.88),
      BALL_RADIUS_MIN,
      BALL_RADIUS_MAX
    );
    const launchBallMass = getRunBallMass(runSnapshot);
    const spreadScale = clampNumber(runSnapshot.launchSpreadMultiplier, 0.75, 1.9);
    const briarVolleyLevel = getRunPowerLevel(runSnapshot, 'arcane-volley');
    const huntersDrawLevel = getRunPowerLevel(runSnapshot, 'rune-edge');
    const precisionWindowRadians =
      ((getBriarVolleyMaxOffsetDegrees(briarVolleyLevel) * spreadScale) * Math.PI) / 180;
    const consistencyChance = getHuntersDrawConsistencyChance(huntersDrawLevel);
    const baseAimAngle = Math.atan2(ny, nx);
    if (!continuingActiveShot) {
      ballsRef.current = [];
      launchQueueRef.current = [];
      launchElapsedRef.current = 0;
    }
    const launchQueueBaseDelayMs = Math.max(
      launchElapsedRef.current,
      launchQueueRef.current.length > 0
        ? launchQueueRef.current[launchQueueRef.current.length - 1].delayMs
        : launchElapsedRef.current
    );
    const volleySpawns = buildAimedVolleySpawns({
      shotCount: volley.shotCount,
      baseAimAngle,
      baseSpeed,
      precisionWindowRadians,
      consistencyChance,
      critChance: runSnapshot.critChance,
    });
    const queuedLaunches: LaunchQueueItem[] = volleySpawns.map((spawn, index) => ({
      delayMs: launchQueueBaseDelayMs + index * 72,
      spawn: {
        x: launchOriginX,
        y: wardenTurretY,
        vx: spawn.vx,
        vy: spawn.vy,
        radius: launchBallRadius,
        mass: launchBallMass,
        isCritShot: spawn.isCritShot,
      },
    }));
    launchQueueRef.current.push(...queuedLaunches);
    wardenLaunchConfigRef.current = {
      originX: launchOriginX,
      direction: { x: nx, y: ny },
      baseSpeed,
      radius: launchBallRadius,
      mass: launchBallMass,
      spreadScale,
      shotCount: volley.shotCount,
      shotCap: volleyCaps.shotCap,
    };
    nextWardenShotAvailableAtMsRef.current = now + getRunShotCooldownMs(runSnapshot);
    if (!continuingActiveShot) {
      shotInFlightRef.current = true;
      setShotInProgress(true);
      lastBottomCrossingXRef.current = null;
      wardenBallLastFrameMsRef.current = null;
    }
  }, [aimPoint, firePrototypeWardenVolley]);

  const applyPrototypeWardenTearHit = useCallback(() => {
    const currentRun = profileRef.current?.run;
    if (!currentRun || currentRun.stage !== 'warden') {
      return;
    }
    const now = performance.now();
    const resolution = resolveWardenShieldTearHit(
      wardenShieldHpRef.current,
      wardenShieldGraceUntilMsRef.current,
      now,
      WARDEN_SHIELD_GRACE_MS
    );
    wardenShieldRegenUsedSinceLastTearRef.current = false;
    wardenShieldHpRef.current = resolution.nextShieldHp;
    wardenShieldGraceUntilMsRef.current = resolution.nextGraceUntilMs;
    setWardenShieldHp(resolution.nextShieldHp);

    const shieldHubMessage = resolution.hubMessage;
    if (shieldHubMessage) {
      commitProfile((draft) => {
        if (draft.run) {
          draft.run.hubMessage = shieldHubMessage;
        }
      }, true);
    }
    if (resolution.startedGraceWindow) {
      window.setTimeout(() => {
        if (wardenShieldHpRef.current <= 0) {
          endRun(false, 'Shield shattered');
        }
      }, WARDEN_SHIELD_GRACE_MS);
    }
  }, [commitProfile, endRun]);

  useEffect(() => {
    applyPrototypeWardenTearHitRef.current = applyPrototypeWardenTearHit;
  }, [applyPrototypeWardenTearHit]);

  const resolvePrototypeWardenEncounter = useCallback(() => {
      commitProfile((draft) => {
        if (!draft.run || draft.run.stage !== 'warden' || !draft.run.activeWardenId || !draft.run.activeWardenDomain) {
          return;
        }
        const runState = draft.run;
        const activeWardenId = runState.activeWardenId;
        const activeWardenDomain = runState.activeWardenDomain;
        if (!activeWardenId || !activeWardenDomain) {
          return;
        }
        const encounterLevel = getCurrentPathNode(runState).level;
        const encounterKey = makeWardenEncounterKey(encounterLevel, activeWardenId);
        if (!runState.wardensDefeated.includes(encounterKey)) {
          runState.wardensDefeated.push(encounterKey);
        }
        const availableSpoils = SPOILS_POOL.filter(
          (template) => getRunPowerLevel(runState, template.id) < template.maxLevel
        );
        const spoilsOffers = makeSpoilsOffers(
          BALANCE.spoilsOfferCount,
          availableSpoils,
          (maxIndex) => randomInt(runState, 0, maxIndex)
        );
        const cooldownTemplate = availableSpoils.find((template) => template.id === 'shop-cooldown');
        if (
          cooldownTemplate &&
          spoilsOffers.length > 0 &&
          !spoilsOffers.some((offer) => offer.id === cooldownTemplate.id)
        ) {
          spoilsOffers[spoilsOffers.length - 1] = {
            id: cooldownTemplate.id,
            name: cooldownTemplate.name,
            description: cooldownTemplate.description,
            purchased: false,
          };
        }
        runState.pendingSpoilsOffers = spoilsOffers;
        runState.hubMessage = '';
        runState.stage = 'hub';
        runState.activeWardenId = null;
        runState.activeWardenDomain = null;
      }, true);
    }, [commitProfile]);

  const beginWardenDefeatCinematic = useCallback(() => {
    const cinematicStart = performance.now();
    const cinematicDurationMs = 4000;
    const cinematicEnd = cinematicStart + cinematicDurationMs;
    setWardenDefeatCinematicUntilMs(cinematicEnd);
    setShotInProgress(false);
    shotInFlightRef.current = false;
    ballsRef.current = [];
    launchQueueRef.current = [];
    wardenActiveTearRef.current = null;
    setWardenActiveTear(null);
    wardenTearFallProgressRef.current = 0;
    const blankPosition = blankCanvasPosRef.current;
    for (let i = 0; i < 190; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 28 + Math.random() * 230;
    wardenImpactParticlesRef.current.push({
      x: blankPosition.x + (Math.random() - 0.5) * 18,
      y: blankPosition.y + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * (0.65 + Math.random() * 0.7),
      radius: 1.6 + Math.random() * 4.4,
      ageMs: 0,
      lifeMs: 680 + Math.random() * 1020,
      color: Math.random() < 0.38
        ? 'rgba(216, 180, 255, ALPHA)'
        : Math.random() < 0.7
          ? 'rgba(168, 85, 247, ALPHA)'
          : 'rgba(109, 40, 217, ALPHA)',
    });
    }
    if (wardenDefeatResolveTimeoutRef.current !== null) {
    window.clearTimeout(wardenDefeatResolveTimeoutRef.current);
    }
    wardenDefeatResolveTimeoutRef.current = window.setTimeout(() => {
    wardenDefeatResolveTimeoutRef.current = null;
    setWardenDefeatCinematicUntilMs(null);
    resolvePrototypeWardenEncounter();
    }, cinematicDurationMs);
  }, [resolvePrototypeWardenEncounter]);

  useEffect(() => {
    const encounterProfile = getBlankEncounterProfile(run);
    const combinedHp = getBlankCombinedHp(wardenEyeHp, encounterProfile.dualEyes, encounterProfile.hpPerEye);
    if (run?.stage !== 'warden' || combinedHp > 0 || wardenDefeatCinematicUntilMs !== null) {
    return;
    }
    const frameId = window.requestAnimationFrame(() => {
    beginWardenDefeatCinematic();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [beginWardenDefeatCinematic, run, wardenEyeHp, wardenDefeatCinematicUntilMs]);

  useEffect(() => {
    return () => {
      if (wardenDefeatResolveTimeoutRef.current !== null) {
        window.clearTimeout(wardenDefeatResolveTimeoutRef.current);
        wardenDefeatResolveTimeoutRef.current = null;
      }
    };
  }, []);

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
      if (!run || (run.stage !== 'board' && run.stage !== 'warden')) {
        return;
      }
      if (run.stage === 'warden' && wardenDefeatCinematicUntilMs !== null && performance.now() < wardenDefeatCinematicUntilMs) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = clampCoordinate(
        ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
        BOARD_SIDE_CHANNEL_WIDTH,
        CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH
      );
      const y = ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT;
      event.currentTarget.setPointerCapture(event.pointerId);
      isDraggingRef.current = true;
      setIsDragging(true);
      aimPointRef.current = { x, y };
      setAimPoint({ x, y });
    },
    [run, wardenDefeatCinematicUntilMs]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = clampCoordinate(
        ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
        BOARD_SIDE_CHANNEL_WIDTH,
        CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH
      );
      const y = ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT;
      hoverPointRef.current = { x, y };
      if (!isDraggingRef.current) {
        return;
      }
      aimPointRef.current = { x, y };
      setAimPoint({ x, y });
    },
    []
  );

  const clearAim = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
    aimPointRef.current = null;
    setAimPoint(null);
  }, []);

  const handlePointerLeave = useCallback(() => {
    hoverPointRef.current = null;
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || !run || (run.stage !== 'board' && run.stage !== 'warden')) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (run.stage === 'warden' && wardenDefeatCinematicUntilMs !== null && performance.now() < wardenDefeatCinematicUntilMs) {
        clearAim();
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();
      const releasePoint = {
        x: clampCoordinate(
          ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
          BOARD_SIDE_CHANNEL_WIDTH,
          CANVAS_WIDTH - BOARD_SIDE_CHANNEL_WIDTH
        ),
        y: ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
      };
      const targetPoint = aimPoint ?? releasePoint;

      if (run?.stage === 'warden') {
        clearAim();
        launchPrototypeWardenVolley(targetPoint);
        return;
      }

      const launchOriginX = getLaunchOriginX(run);
      const dx = targetPoint.x - launchOriginX;
      const dy = targetPoint.y - (LAUNCHER_Y + BOARD_TURRET_Y_OFFSET);
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
    [aimPoint, clearAim, launchPrototypeWardenVolley, launchShot, run, wardenDefeatCinematicUntilMs]
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
      const chipTop = chipRect.top - stripRect.top;
      const maxLeft = Math.max(8, stripRect.width - POWER_POPOVER_WIDTH_PX - 8);
      const left = Math.min(maxLeft, Math.max(8, chipCenter - POWER_POPOVER_WIDTH_PX / 2));
      const arrow = Math.min(POWER_POPOVER_WIDTH_PX - 18, Math.max(18, chipCenter - left));
      const top = Math.max(26, chipTop - 12);
      setPowerPopoverLayout({ left, top, arrow });
    }
    setSelectedPowerId(powerId);
  }, [selectedPowerId]);

  useEffect(() => {
    if (!run || run.stage === 'board') {
      const timer = window.setTimeout(() => {
        setSelectedResourceHelp(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [run]);


  useEffect(() => {
    if (
      !selectedPowerId &&
      !selectedResourceHelp &&
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
      setSelectedPowerId(null);
      setSelectedResourceHelp(null);
      setPendingStartingRunPowerId(null);
    };

    document.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
  }, [selectedPowerId, selectedResourceHelp, pendingStartingRunPowerId]);

  const saveLabel = useMemo(() => {
    if (isLoading) {
      return 'Loading local save...';
    }
    if (saveStatus === 'saving') {
      return 'Saving locally...';
    }
    if (saveStatus === 'error') {
      return 'Local save unavailable';
    }
    return 'Saved locally on this device';
  }, [isLoading, saveStatus]);

  const cycleTargetArtStyle = useCallback(() => {
    setTargetArtStyle((current) => {
      const currentIndex = TARGET_ART_STYLE_SEQUENCE.indexOf(current);
      if (currentIndex < 0) {
        return TARGET_ART_STYLE_SEQUENCE[0];
      }
      return TARGET_ART_STYLE_SEQUENCE[(currentIndex + 1) % TARGET_ART_STYLE_SEQUENCE.length];
    });
  }, []);

  useEffect(() => {
    if (!run || run.stage !== 'hub') {
      lastPathAutoScrollKeyRef.current = null;
      return;
    }
    const hasPendingWardenSpoils = (run.pendingSpoilsOffers.length ?? 0) > 0;
    const boardSummary = run.lastBoardSummary ?? null;
    const shouldGateBoardChoices =
      Boolean(boardSummary) &&
      run.boardSummaryAcknowledged === false;
    if (hasPendingWardenSpoils || shouldGateBoardChoices) {
      lastPathAutoScrollKeyRef.current = null;
      return;
    }
    const pathPreview = buildPathPreview(run, shouldGateBoardChoices);
    const scrollContainer = pathTreeScrollRef.current;
    if (!scrollContainer) {
      return;
    }
    const playableLevels = pathPreview.nodes
      .filter((node) => node.isPlayable)
      .map((node) => node.level);
    const fallbackNodeLevel =
      pathPreview.nodes.find((node) => node.level === run.level && node.isSelected)?.level ??
      pathPreview.nodes.find((node) => node.level === run.level)?.level ??
      run.level;
    const targetLevel =
      playableLevels.length > 0 ? Math.max(...playableLevels) : fallbackNodeLevel;
    const levelSpan = Math.max(1, pathPreview.endLevel - pathPreview.startLevel);
    const pathTopPct = 3;
    const pathHeightPct = 94;
    const targetYPct = pathTopPct + ((pathPreview.endLevel - targetLevel) / levelSpan) * pathHeightPct;
    const autoScrollKey = `${run.level}|${run.pathCurrentNodeId}|${targetLevel}|${pathPreview.endLevel}|${pathPreview.nodes.length}`;
    if (lastPathAutoScrollKeyRef.current === autoScrollKey) {
      return;
    }
    lastPathAutoScrollKeyRef.current = autoScrollKey;
    const frameId = window.requestAnimationFrame(() => {
      const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      const targetTopPx = (targetYPct / 100) * scrollContainer.scrollHeight;
      const desiredScrollTop = clampNumber(targetTopPx - scrollContainer.clientHeight * 0.55, 0, maxScrollTop);
      scrollContainer.scrollTop = desiredScrollTop;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [run]);

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
  const hasPendingWardenSpoils = (run?.pendingSpoilsOffers.length ?? 0) > 0;
  const startingRunPowerChoiceTemplates = startingRunPowerChoices
    .map((id) => SPOILS_POOL.find((template) => template.id === id) ?? null)
    .filter((template): template is SpoilsTemplate => Boolean(template));
  const pendingStartingRunPowerTemplate = pendingStartingRunPowerId
    ? SPOILS_POOL.find((template) => template.id === pendingStartingRunPowerId) ?? null
    : null;
  const previewStartingRunPowerTemplate = previewStartingPowerId
    ? SPOILS_POOL.find((template) => template.id === previewStartingPowerId) ?? null
    : null;
  const highlightedPowerChipId = previewStartingPowerId ? `run-${previewStartingPowerId}` : null;
  const runProgressPct = run
    ? Math.round((Math.max(0, run.level - 1) / Math.max(1, run.maxLevels)) * 100)
    : 0;
  const boardBricksRemaining = run?.board.bricks.length ?? 0;
  const displayBricksRemaining =
    shotInProgress && hasActiveRun ? liveHud.remainingBricks : boardBricksRemaining;
  const activeBoardBricks = run?.board.bricks ?? [];
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
  const objectiveHpLabel = objectiveBricks
    .map((brick, index) => `${getCoreVariantLabel(brick.coreVariant)} ${index + 1} ${Math.round(brick.hp)}/${Math.round(brick.maxHp)}`)
    .join(' • ');
  const objectiveStatusLabel = objectiveBricks.length
    ? `${objectiveCount > 1 ? `${objectiveCount} orbs active | ` : ''}${objectiveHpLabel} | Power Shot +${powerShotBonusPct}%`
    : hasActiveRun
      ? `Orb drained | Power Shot +${powerShotBonusPct}%${barrageReady ? ' | Barrage ready' : ''}`
      : 'No active orb';
  const coreProgressSlots = objectiveBricks.map((brick, index) => {
    const variant = brick.coreVariant ?? 'yellow';
    const maxHp = brick.maxHp ?? 1;
    const currentHp = brick.hp ?? 0;
    const hpPct = Math.max(0, Math.min(1, currentHp / Math.max(1, maxHp)));
    return {
      id: brick.id,
      variant,
      currentHp: Math.max(0, Math.round(currentHp)),
      maxHp: Math.round(maxHp),
      hpPct,
      label: `${getCoreVariantLabel(variant)} ${index + 1}`,
    };
  });
  const boardHpRemaining = run
    ? Math.round(run.board.bricks.reduce((sum, brick) => sum + Math.max(0, brick.hp), 0))
    : 0;
  const displayMana = hasActiveRun ? Math.floor((run?.mana ?? 0) + liveHud.manaEarned) : 0;
  const orbSkillGaugeMaxByColor = getRunOrbSkillGaugeMaxByColor(run, profile.permanentUpgrades);
  const displayEssenceByColor: Record<CoreVariant, number> = {
    yellow: clampNumber(
      Math.max(0, (run?.essenceByColor.yellow ?? 0) + liveHud.essenceByColor.yellow),
      0,
      orbSkillGaugeMaxByColor.yellow
    ),
    blue: clampNumber(
      Math.max(0, (run?.essenceByColor.blue ?? 0) + liveHud.essenceByColor.blue),
      0,
      orbSkillGaugeMaxByColor.blue
    ),
    green: clampNumber(
      Math.max(0, (run?.essenceByColor.green ?? 0) + liveHud.essenceByColor.green),
      0,
      orbSkillGaugeMaxByColor.green
    ),
  };
  const displayDestroyedBricks = (run?.levelBricksDestroyed ?? 0) + liveHud.destroyedBricks;
  const displayClimbProgressPct = run
    ? Math.min(
        100,
        Math.round((displayDestroyedBricks / Math.max(1, run.levelGoalBricks ?? 1)) * 100)
      )
    : 0;
  const activePathChallenge = run
    ? getPathChallengeDefinition((run.pathNodesByLevel[run.level] ?? getCurrentPathNode(run)).challenge)
    : null;
  const activeDomain = activePathChallenge ? getDeepwoodDomainDefinition(activePathChallenge.domain) : null;
  const activeDomainWarden = activeDomain?.wardens?.[0] ?? null;
  const overallScore = calculateOverallScore(run, liveHud);
  const overallProgressPct = calculateOverallProgress(run, liveHud);
  const showBoardOverlay = !hasActiveRun || (run?.stage !== 'board' && run?.stage !== 'warden');
  const isBetweenLevelHub = run?.stage === 'hub';
  const permanentPowerIndicators: ActivePowerIndicator[] = PERMANENT_UPGRADES.map((upgrade, index) => {
    const state = profile.permanentUpgrades[upgrade.key];
    return {
      id: `perm-${upgrade.key}`,
      name: upgrade.name,
      description: upgrade.description,
      category: 'permanent',
      rewardSource: 'permanent',
      aspect: getPowerAspectBucket(upgrade.key),
      sourceOrder: index,
      currentLevel: state.rank,
      barSlots: upgrade.maxRank,
      baseColor: POWER_BASE_COLORS[upgrade.key] ?? '#22d3ee',
      backdropIcon: POWER_BACKDROP_ICONS[upgrade.key] ?? '◌',
      levelLabel: `L${state.rank}`,
      statusLabel: state.rank > 0 ? (state.enabled ? 'Enabled' : 'Owned') : 'Not owned',
      maxLevelLabel: `L${upgrade.maxRank}`,
    };
  });
  const runPowerTemplates = [...POWER_POOL, ...SPOILS_POOL];
  const runPowerSourceOrder = new Map<string, number>();
  POWER_POOL.forEach((template, index) => {
    runPowerSourceOrder.set(template.id, index);
  });
  SPOILS_POOL.forEach((template, index) => {
    runPowerSourceOrder.set(template.id, POWER_POOL.length + index);
  });
  const wardenRewardIds = new Set(SPOILS_POOL.map((template) => template.id));
  const runPowerIndicators: ActivePowerIndicator[] = runPowerTemplates
    .map((template) => {
      const rank = getRunPowerLevel(run, template.id);
      const cappedRank = Math.min(rank, template.maxLevel);
      const templateOrder = runPowerSourceOrder.get(template.id) ?? Number.MAX_SAFE_INTEGER;
      const isAtMax = cappedRank >= template.maxLevel;
      return {
        id: `run-${template.id}`,
        name: template.name,
        description: template.description,
        category: 'run' as const,
        rewardSource: wardenRewardIds.has(template.id) ? 'warden' : 'mana',
        aspect: getPowerAspectBucket(template.id),
        sourceOrder: templateOrder,
        currentLevel: cappedRank,
        barSlots: template.maxLevel,
        baseColor: POWER_BASE_COLORS[template.id] ?? '#60a5fa',
        backdropIcon: POWER_BACKDROP_ICONS[template.id] ?? '◌',
        levelLabel: `L${cappedRank}`,
        statusLabel: cappedRank > 0 ? (isAtMax ? 'Maxed' : 'Owned') : 'Not purchased',
        maxLevelLabel: `L${template.maxLevel}`,
      };
    });
  const activePowerIndicators = [...permanentPowerIndicators, ...runPowerIndicators];
  const orderedPowerBuckets = POWER_DRAWER_BUCKET_ORDER.map((aspect) => {
    const powersForAspect = activePowerIndicators.filter((power) => power.aspect === aspect);
    const sourceGroups = POWER_REWARD_SOURCE_ORDER.map((source) => {
      const powers = powersForAspect
        .filter((power) => power.rewardSource === source)
        .sort((left, right) => {
          const ownedCompare = Number(right.currentLevel > 0) - Number(left.currentLevel > 0);
          if (ownedCompare !== 0) {
            return ownedCompare;
          }
          if (left.currentLevel !== right.currentLevel) {
            return right.currentLevel - left.currentLevel;
          }
          if (left.sourceOrder !== right.sourceOrder) {
            return left.sourceOrder - right.sourceOrder;
          }
          return left.name.localeCompare(right.name);
        });
      return {
        source,
        label: POWER_REWARD_SOURCE_LABELS[source],
        powers,
      };
    }).filter((group) => group.powers.length > 0);
    return {
      aspect,
      label: POWER_DRAWER_BUCKET_LABELS[aspect],
      sourceGroups,
    };
  }).filter((bucket) => bucket.sourceGroups.length > 0);
  const selectedPower =
    activePowerIndicators.find((power) => power.id === selectedPowerId) ?? null;
  const powerPopoverStyle = {
    '--power-popover-left': `${powerPopoverLayout.left}px`,
    '--power-popover-top': `${powerPopoverLayout.top}px`,
    '--power-popover-arrow': `${powerPopoverLayout.arrow}px`,
  } as CSSProperties;
  const boardSummary = run?.lastBoardSummary ?? null;
  const shouldGateBoardChoices =
    run?.stage !== 'board' &&
    Boolean(boardSummary) &&
    run?.boardSummaryAcknowledged === false;
  const pathPreview = run ? buildPathPreview(run, shouldGateBoardChoices) : null;
  const activePathFocusNodeId = activeHoveredPathNodeId ?? activePendingPathNodeId;
  const focusedPathSets =
    pathPreview &&
    activePathFocusNodeId &&
    pathPreview.nodes.some((node) => node.id === activePathFocusNodeId)
      ? buildPathFocusSets(pathPreview, activePathFocusNodeId)
      : null;
  const hasScrollablePathMap = Boolean(
    run?.stage === 'hub' &&
    !shouldGateBoardChoices &&
    !hasPendingWardenSpoils &&
    pathPreview
  );
  const pathGraphHeightRem = pathPreview
    ? Math.max(
      PATH_TREE_MIN_HEIGHT_REM,
      (pathPreview.endLevel - pathPreview.startLevel + 1) * PATH_TREE_LEVEL_HEIGHT_REM
    )
    : PATH_TREE_MIN_HEIGHT_REM;
  const pathGraphStyle = {
    height: `${pathGraphHeightRem}rem`,
  } as CSSProperties;
  const pathNodePositions: Record<string, { x: number; y: number }> = {};
  const pathPreviewNodeById = new Map<string, PathPreviewNode>();
  if (pathPreview) {
    for (const node of pathPreview.nodes) {
      pathPreviewNodeById.set(node.id, node);
    }
    const laneSpan = Math.max(1, pathPreview.maxLane - pathPreview.minLane);
    const levelSpan = Math.max(1, pathPreview.endLevel - pathPreview.startLevel);
    const pathLeftPct = 8;
    const pathWidthPct = 84;
    const pathTopPct = 3;
    const pathHeightPct = 94;
    const laneXByValue: Record<number, number> =
      PATH_MAX_LANE_ABS > 1
        ? {
          [-2]: 0,
          [-1]: 0.24,
          0: 0.5,
          1: 0.76,
          2: 1,
        }
        : {
          [-1]: 0.16,
          0: 0.5,
          1: 0.84,
        };
    for (const node of pathPreview.nodes) {
      const laneRatio = laneXByValue[node.lane] ?? ((node.lane - pathPreview.minLane) / laneSpan);
      const xPct = pathLeftPct + laneRatio * pathWidthPct;
      const yPct = pathTopPct + ((pathPreview.endLevel - node.level) / levelSpan) * pathHeightPct;
      pathNodePositions[node.id] = { x: xPct, y: yPct };
    }
  }
  const renderOfferCost = (
    amount: number,
    purchased = false,
  ) => {
    if (purchased) {
      return <span className="rogue-spoils-offer-cost-text">Purchased</span>;
    }

    const currencyIconClass = 'rogue-overlay-resource-icon-mana';

    return (
      <span className="rogue-spoils-offer-cost-text">
        <span
          className={`rogue-spoils-offer-currency-icon rogue-overlay-resource-icon ${currencyIconClass}`}
          aria-hidden="true"
        />
        <strong>{amount}</strong>
      </span>
    );
  };

  const formatLevelProgressLabel = (currentLevel: number, nextLevel: number, maxLevel: number): string => {
    if (currentLevel >= maxLevel) {
      return `Level ${maxLevel} (MAX)`;
    }
    return `Level ${currentLevel} -> Level ${nextLevel}`;
  };

  const renderSpoilsOfferCard = (offer: SpoilsOffer) => {
    const template = SPOILS_POOL.find((item) => item.id === offer.id);
    if (!template) {
      return null;
    }
    const currentLevel = getRunPowerLevel(run, offer.id);
    const nextLevel = Math.min(template.maxLevel, currentLevel + 1);
    const levelProgressLabel = formatLevelProgressLabel(currentLevel, nextLevel, template.maxLevel);
    const nextImpactLabel = template.describeLevelImpact(nextLevel, run, profile);
    const isAtMaxLevel = currentLevel >= template.maxLevel;
    const baseColor = POWER_BASE_COLORS[offer.id] ?? '#60a5fa';
    const backdropIcon = POWER_BACKDROP_ICONS[offer.id] ?? '◌';

    return (
      <button
        type="button"
        key={offer.id}
        className={`rogue-choice-card rogue-spoils-offer-card${isAtMaxLevel ? ' is-inactive' : ''}`}
        onClick={() => claimWardenReward(offer.id)}
        disabled={isAtMaxLevel}
        style={{ '--power-base-color': baseColor } as CSSProperties}
      >
        <span className="rogue-spoils-offer-corner-icon" aria-hidden="true">{backdropIcon}</span>
        <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-top">
          <div className="rogue-spoils-offer-title">
            <strong>{offer.name}</strong>
          </div>
        </div>
        <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-middle">
          <span>{offer.description}</span>
          <div className="rogue-spoils-offer-preview">
            <span className="rogue-spoils-offer-levels">{levelProgressLabel}</span>
          </div>
        </div>
        <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-bottom">
          <span className="rogue-spoils-offer-impact">{isAtMaxLevel ? 'Maxed' : nextImpactLabel}</span>
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
      {!hasActiveRun && previewStartingRunPowerTemplate && (
        <div className="rogue-active-powers-header">
          <span className="rogue-active-powers-preview" aria-live="polite">
            <span className="rogue-active-powers-preview-icon" aria-hidden="true">
              {POWER_BACKDROP_ICONS[previewStartingRunPowerTemplate.id] ?? '◌'}
            </span>
            <span>{previewStartingRunPowerTemplate.name}</span>
          </span>
        </div>
      )}
      <div className="rogue-active-powers-row">
        {orderedPowerBuckets.length > 0 ? (
          <div className="rogue-active-powers-buckets">
            {orderedPowerBuckets.map((bucket) => (
              <section key={bucket.aspect} className="rogue-active-powers-bucket">
                <h3 className="rogue-active-powers-bucket-title">{bucket.label}</h3>
                <div className="rogue-active-powers-source-groups">
                  {bucket.sourceGroups.map((group) => (
                    <div
                      key={`${bucket.aspect}-${group.source}`}
                      className={`rogue-active-powers-source-group is-${group.source}`}
                    >
                      <h4 className={`rogue-active-powers-source-title is-${group.source}`}>{group.label}</h4>
                      <div className="rogue-active-powers-grid" role="list">
                        {group.powers.map((power) => (
                          <button
                            type="button"
                            key={power.id}
                            className={`rogue-active-power-chip is-${power.category} is-${power.rewardSource}${selectedPowerId === power.id ? ' is-selected' : ''}${highlightedPowerChipId === power.id ? ' is-linked-highlight' : ''}`}
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
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="rogue-active-powers-empty">No upgrades or powers owned yet.</p>
        )}
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
          <div className="rogue-board-summary-mana-breakdown">
            <div className="rogue-board-summary-mana-row rogue-board-summary-mana-row-base">
              <span className="rogue-board-summary-mana-label">Mana Earned</span>
              <span className="rogue-board-summary-mana-value">{boardSummary.manaRaw}</span>
            </div>
            {boardSummary.skillBonuses.map((bonus) => (
              <div
                key={bonus.id}
                className={`rogue-board-summary-mana-row${bonus.mana >= 0 ? ' is-positive' : ' is-negative'}`}
              >
                <span className="rogue-board-summary-mana-label">
                  {bonus.label}
                  <span className="rogue-board-summary-mana-detail"> · {bonus.detail}</span>
                </span>
                <span className="rogue-board-summary-mana-value">
                  {bonus.mana >= 0 ? '+' : ''}{bonus.mana}
                </span>
              </div>
            ))}
            <div className="rogue-board-summary-mana-row rogue-board-summary-mana-row-total">
              <span className="rogue-board-summary-mana-label">Total Mana</span>
              <span className="rogue-board-summary-mana-value">
                {Math.max(0, boardSummary.manaRaw + boardSummary.manaBonus)}
              </span>
            </div>
          </div>
          <button type="button" className="btn-text rogue-board-summary-dismiss" onClick={acknowledgeBoardSummary}>
            Continue
          </button>
        </section>
      </div>
    );
  })();
  return (
    <div className="rogue-brick-page">
      <header className="rogue-brick-header">
        <div className="rogue-brick-header-copy">
          <h1>Deepwood</h1>
          <p className="rogue-brick-subtitle">
            Hidden mode: rogue-like brick breaker. Drag to aim and release to fire.
          </p>
        </div>
        <div className="rogue-brick-header-actions">
          <div className="rogue-brick-sync-status">{saveLabel}</div>
          <button
            type="button"
            className="btn-secondary"
            onClick={cycleTargetArtStyle}
            title="Cycle non-orb target art style"
          >
            Brick Art: {targetArtStyleLabel}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setIsFocusMode(true)}>
            Lock In Full Screen
          </button>
        </div>
      </header>

      <section
        ref={layoutShellRef}
        className={`rogue-brick-layout-shell${isFocusMode ? ' is-focus-mode' : ''}`}
      >
        <div 
          className={`rogue-brick-top-hud${shouldGateBoardChoices && boardSummary ? ' is-hidden' : ''}`} 
          aria-label="Current score and progress"
        >
          <div className="rogue-brick-top-hud-row">
            <div className="rogue-brick-top-hud-score-group">
              <strong className="rogue-brick-top-hud-score">{overallScore.toLocaleString()}</strong>
            </div>
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

        <div
          ref={brickLayoutRef}
          className={`rogue-brick-layout${isFocusMode ? ' is-focus-mode' : ''}`}
        >
          {hasActiveRun && (run?.stage === 'board' || run?.stage === 'hub') && (
            <aside
              className="rogue-essence-sidebar"
              style={
                normalModeEssenceTopPx === null || normalModeEssenceLeftPx === null
                  ? undefined
                  : {
                      position: 'absolute',
                      top: `${normalModeEssenceTopPx}px`,
                      left: `${normalModeEssenceLeftPx}px`,
                      transform: 'translate(-100%, -50%)',
                    }
              }
              aria-label="Orb skill gauges"
            >
              {CORE_VARIANTS.map((variant) => {
                const helpKey = `essence-${variant}` as ResourceHelpKey;
                const current = displayEssenceByColor[variant];
                const gaugeMax = orbSkillGaugeMaxByColor[variant];
                const litSegments = Math.max(0, Math.min(gaugeMax, Math.floor(current)));
                const capabilityMenuLabel = getCoreCapabilityMenuLabel(variant);
                const hasSlotUpgradeFlash = orbSlotUpgradeFlash?.variant === variant;
                const flashingSlotIndex = hasSlotUpgradeFlash ? orbSlotUpgradeFlash.slotIndex : -1;
                return (
                  <div
                    key={`essence-${variant}`}
                    className={`rogue-essence-gauge-wrap${hasSlotUpgradeFlash ? ' is-slot-upgrade-flash' : ''}`}
                  >
                    <button
                      type="button"
                      className={`rogue-essence-gauge-button is-${variant}`}
                      onClick={() => setSelectedResourceHelp(selectedResourceHelp === helpKey ? null : helpKey)}
                      title={`${capabilityMenuLabel} level`}
                      aria-label={`${capabilityMenuLabel} power gauge. Show current level.`}
                      data-popover-surface="true"
                    >
                      <span className="rogue-essence-gauge" aria-hidden="true">
                        {Array.from({ length: ORB_SKILL_GAUGE_MAX_SEGMENTS }, (_, index) => {
                          const segmentValue = index + 1;
                          const isLit = segmentValue <= litSegments;
                          const isUnlocked = segmentValue <= gaugeMax;
                          return (
                            <span
                              key={`${variant}-segment-${segmentValue}`}
                              className={`rogue-essence-gauge-segment${isUnlocked ? ' is-unlocked' : ' is-locked'}${isLit ? ' is-lit' : ''}${segmentValue - 1 === flashingSlotIndex ? ' is-new-slot' : ''}`}
                              style={isLit ? { background: getCoreVariantColor(variant) } : undefined}
                            />
                          );
                        })}
                      </span>
                    </button>
                    {hasSlotUpgradeFlash && (
                      <span className="rogue-essence-slot-upgrade-burst" aria-hidden="true" key={`slot-burst-${variant}-${orbSlotUpgradeFlash?.token ?? 0}`}>
                        {Array.from({ length: 6 }, (_, sparkIndex) => (
                          <span key={`slot-spark-${variant}-${orbSlotUpgradeFlash?.token ?? 0}-${sparkIndex}`} className={`rogue-essence-slot-upgrade-spark spark-${sparkIndex + 1}`} />
                        ))}
                      </span>
                    )}
                    {selectedResourceHelp === helpKey && (
                      <section
                        className="rogue-overlay-resource-popover rogue-essence-popover"
                        role="dialog"
                        aria-label={`${capabilityMenuLabel} details`}
                        data-popover-surface="true"
                      >
                        <div className="rogue-overlay-resource-popover-head">
                          <strong>{capabilityMenuLabel}</strong>
                        </div>
                        <p>Level {Math.floor(current).toLocaleString()} / {gaugeMax.toLocaleString()}</p>
                      </section>
                    )}
                  </div>
                );
              })}
            </aside>
          )}
        <div
          ref={canvasWrapRef}
          className={`rogue-brick-canvas-wrap${isPowerDrawerExpanded ? ' is-power-drawer-expanded' : ''}`}
        >
            <div
              ref={boardFrameRef}
              className={`rogue-brick-board-frame${isBetweenLevelHub ? ' is-between-level' : ''}`}
            >
              {hasActiveRun && run?.stage === 'board' && (
                <div className="rogue-core-progress-board" aria-label="Orb progress">
                  {coreProgressSlots.map((slot) => {
                    const variantColor = getCoreVariantColor(slot.variant);
                    return (
                      <span
                        key={slot.id}
                        className="rogue-core-progress-ring"
                        style={{
                          background: `conic-gradient(${variantColor} ${slot.hpPct * 360}deg, rgb(51 65 85 / 0.9) 0deg)`,
                        }}
                        aria-label={`${slot.label} ${slot.currentHp}/${slot.maxHp} HP`}
                        title={`${slot.label} ${slot.currentHp}/${slot.maxHp} HP`}
                      >
                        <span className="rogue-core-progress-ring-value">{slot.currentHp}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              {showBoardOverlay && (
                <div className={`rogue-board-overlay${hasScrollablePathMap ? ' has-scrollable-path-map' : ''}`}>
                  <section
                    className={`rogue-board-overlay-content${isBetweenLevelHub ? ' is-between-level' : ''}${hasScrollablePathMap ? ' has-scrollable-path-map' : ''}`}
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
                              </div>
                              <p>Mana is spent on between-board technique choices to improve your current run.</p>
                            </section>
                          )}
                        </div>
                      </div>
                    )}

                    {shouldShowStartingRunSelection && (
                      <>
                        <h2 className="rogue-starting-run-title">Lexor&apos;s Gift</h2>
                        <div className="rogue-choice-grid rogue-choice-grid-spoils">
                          {startingRunPowerChoiceTemplates.map((offer) => {
                            const backdropIcon = POWER_BACKDROP_ICONS[offer.id] ?? '◌';
                            const baseColor = POWER_BASE_COLORS[offer.id] ?? '#60a5fa';
                            const currentLevel = 0;
                            const nextLevel = Math.min(offer.maxLevel, currentLevel + 1);
                            const levelProgressLabel = formatLevelProgressLabel(currentLevel, nextLevel, offer.maxLevel);
                            const nextImpactLabel = offer.describeLevelImpact(nextLevel, null, profile);
                            return (
                              <button
                                type="button"
                                key={`start-power-${offer.id}`}
                                className="rogue-choice-card rogue-spoils-offer-card"
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
                                <span className="rogue-spoils-offer-corner-icon" aria-hidden="true">{backdropIcon}</span>
                                <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-top">
                                  <div className="rogue-spoils-offer-title">
                                    <strong>{offer.name}</strong>
                                  </div>
                                </div>
                                <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-middle">
                                  <span>{offer.description}</span>
                                  <div className="rogue-spoils-offer-preview">
                                    <span className="rogue-spoils-offer-levels">{levelProgressLabel}</span>
                                  </div>
                                </div>
                                <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-bottom">
                                  <span className="rogue-spoils-offer-impact">{nextImpactLabel}</span>
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
                          aria-label="Confirm starting run technique"
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

                    {run?.stage === 'hub' && !shouldGateBoardChoices && !hasPendingWardenSpoils && pathPreview && (
                      <>
                        <div className="rogue-path-tree-panel" aria-label="Deepwood trail path selector">
                          <div className="rogue-path-tree-graph-scroll" ref={pathTreeScrollRef}>
                            <div
                              className={`rogue-path-tree-graph${isPathSliding ? ' is-sliding' : ''}`}
                              style={pathGraphStyle}
                            >
                              <div className="rogue-path-tree-stage">
                              {/* TODO: replace SVG connector lines with themed path art segments. */}
                              <svg className="rogue-path-tree-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                {pathPreview.edges.map((edge) => {
                                  const from = pathNodePositions[edge.fromId];
                                  const to = pathNodePositions[edge.toId];
                                  if (!from || !to) {
                                    return null;
                                  }
                                  const fromNode = pathPreviewNodeById.get(edge.fromId);
                                  const toNode = pathPreviewNodeById.get(edge.toId);
                                  const edgeKey = `${edge.fromId}->${edge.toId}`;
                                  const isDimmed = Boolean(focusedPathSets && !focusedPathSets.edgeKeys.has(edgeKey));
                                  const isPastEdge = fromNode?.relation === 'past' && toNode?.relation === 'past';
                                  return (
                                    <line
                                      key={`${edge.fromId}-${edge.toId}`}
                                      x1={from.x}
                                      y1={from.y}
                                      x2={to.x}
                                      y2={to.y}
                                      className={`rogue-path-tree-line${isPastEdge ? ' is-past' : ''}${isDimmed ? ' is-dimmed' : ''}`}
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
                                const domain = getDeepwoodDomainDefinition(challenge.domain);
                                const forecastEncounterWarden = getPathNodeWardenForecast(run, node);
                                const orbCapabilityLabel = getNodeOrbCapabilityLabel(node.primaryCoreVariant);
                                const isDimmed = Boolean(focusedPathSets && !focusedPathSets.nodeIds.has(node.id));
                                const nodeClassName = [
                                  'rogue-path-tree-node',
                                  `is-${node.relation}`,
                                  forecastEncounterWarden ? 'is-warden-encounter' : '',
                                  `is-core-${node.primaryCoreVariant}`,
                                  node.isSelected ? 'is-selected' : '',
                                  node.isPlayable ? 'is-playable' : '',
                                  activePendingPathNodeId === node.id ? 'is-path-target' : '',
                                  isDimmed ? 'is-dimmed' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ');
                                const style = {
                                  left: `${position.x}%`,
                                  top: `${position.y}%`,
                                };
                                const nodeShapeCue =
                                  !forecastEncounterWarden &&
                                  (node.primaryCoreVariant === 'blue' || node.primaryCoreVariant === 'green')
                                    ? <span className={`rogue-path-tree-node-shape is-${node.primaryCoreVariant}`} aria-hidden="true" />
                                    : null;
                                const canDevLaunchBlank = import.meta.env.DEV && Boolean(forecastEncounterWarden);

                                if (node.isPlayable) {
                                  return (
                                    <button
                                      type="button"
                                      key={node.id}
                                      className={nodeClassName}
                                      style={style}
                                      onClick={() => previewPathNodeSelection(node.id)}
                                      onMouseEnter={() => setHoveredPathNodeId(node.id)}
                                      onMouseLeave={() => setHoveredPathNodeId(null)}
                                      onFocus={() => setHoveredPathNodeId(node.id)}
                                      onBlur={() => setHoveredPathNodeId(null)}
                                      aria-label={`Choose level ${node.level} node (${challenge.label}, ${domain.name}, ${orbCapabilityLabel}${forecastEncounterWarden ? ', Warden encounter' : ''})`}
                                      title={orbCapabilityLabel}
                                    >
                                      {nodeShapeCue}
                                      {forecastEncounterWarden && (
                                        <img className="rogue-path-tree-node-warden-eye" src={blankBodyIdle01Url} alt="" aria-hidden="true" />
                                      )}
                                    </button>
                                  );
                                }

                                return (
                                  <div
                                    key={node.id}
                                    className={nodeClassName}
                                    style={style}
                                    title={orbCapabilityLabel}
                                    // ⚠️ DEV ONLY — click any warden eye to force the battle
                                    onClick={canDevLaunchBlank ? () => DEV_launchBlankBattle(node.level) : undefined}
                                    onMouseEnter={() => setHoveredPathNodeId(node.id)}
                                    onMouseLeave={() => setHoveredPathNodeId(null)}
                                    role={canDevLaunchBlank ? 'button' : undefined}
                                    tabIndex={canDevLaunchBlank ? 0 : undefined}
                                  >
                                    {nodeShapeCue}
                                    {forecastEncounterWarden && (
                                      <img className="rogue-path-tree-node-warden-eye" src={blankBodyIdle01Url} alt="" aria-hidden="true" />
                                    )}
                                  </div>
                                );
                              })}
                              </div>
                            </div>
                          </div>
                          <div className="rogue-path-tree-confirm-row">
                            <button
                              type="button"
                              className="rogue-path-tree-confirm-button"
                              onClick={confirmPathNodeSelection}
                              disabled={!activePendingPathNodeId}
                            >
                              Go
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {run?.stage === 'powerup' && !shouldGateBoardChoices && (
                      <>
                        <h2>Mana Store</h2>
                        <div className="rogue-choice-grid rogue-choice-grid-spoils">
                          {run.pendingPowerOffers.map((offer) => (
                            (() => {
                              const template = POWER_POOL.find((item) => item.id === offer.id);
                              if (!template) {
                                return null;
                              }
                              const currentLevel = getRunPowerLevel(run, offer.id);
                              const nextLevel = Math.min(template.maxLevel, currentLevel + 1);
                              const levelProgressLabel = formatLevelProgressLabel(currentLevel, nextLevel, template.maxLevel);
                              const nextImpactLabel = template.describeLevelImpact(nextLevel);
                              const isInactive = offer.manaCost > run.mana;
                              const isAtMaxLevel = currentLevel >= template.maxLevel;
                              const baseColor = POWER_BASE_COLORS[offer.id] ?? '#60a5fa';
                              const backdropIcon = POWER_BACKDROP_ICONS[offer.id] ?? '◌';

                              return (
                                <button
                                  type="button"
                                  key={offer.id}
                                  className={`rogue-choice-card rogue-spoils-offer-card${isInactive || isAtMaxLevel ? ' is-inactive' : ''}`}
                                  onClick={() => choosePowerUp(offer.id)}
                                  disabled={isInactive || isAtMaxLevel}
                                  style={{ '--power-base-color': baseColor } as CSSProperties}
                                >
                                  <span className="rogue-spoils-offer-corner-icon" aria-hidden="true">{backdropIcon}</span>
                                  <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-top">
                                    <div className="rogue-spoils-offer-title">
                                      <strong>{offer.name}</strong>
                                    </div>
                                  </div>
                                  <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-middle">
                                    <span>{offer.description}</span>
                                    <div className="rogue-spoils-offer-preview">
                                      <span className="rogue-spoils-offer-levels">{levelProgressLabel}</span>
                                      <span className="rogue-spoils-offer-impact">{nextImpactLabel}</span>
                                    </div>
                                  </div>
                                  <div className="rogue-spoils-offer-segment rogue-spoils-offer-segment-bottom">
                                    {isAtMaxLevel ? <span className="rogue-spoils-offer-cost-text">Maxed</span> : renderOfferCost(offer.manaCost)}
                                  </div>
                                </button>
                              );
                            })()
                          ))}
                        </div>
                        <button type="button" className="btn-text" onClick={skipPowerUp}>
                          Leave store
                        </button>
                      </>
                    )}

                    {run?.stage === 'hub' && !shouldGateBoardChoices && run.pendingSpoilsOffers.length > 0 && (
                      <>
                        <h2>Warden Spoils</h2>
                        <div className="rogue-choice-grid rogue-choice-grid-spoils">
                          {run.pendingSpoilsOffers.map((offer) => renderSpoilsOfferCard(offer))}
                        </div>
                      </>
                    )}
                  </section>
                </div>
              )}
              {boardSummaryModalElement}
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
                  <span>{getCoreDestructionMessage(coreBreachFlashVariant)}</span>
                </div>
              )}
              {run?.stage === 'warden' && wardenDefeatCinematicUntilMs !== null && (
                <div className="rogue-warden-defeat-flash" aria-hidden="true" />
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
                onPointerLeave={handlePointerLeave}
              />
              {shotInProgress && run?.stage === 'board' && (
                <button
                  type="button"
                  className="rogue-brick-shooting-reclaim"
                  onClick={reclaimShot}
                  aria-label="Recall shots"
                  title="Recall shots"
                >
                  ⇊
                </button>
              )}
            </div>
            {run?.stage !== 'warden' && (
              isFocusMode && typeof document !== 'undefined'
                ? createPortal(powerStripElement, document.body)
                : powerStripElement
            )}
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
                  <span>Trail Progress to Next Sector</span>
                  <strong>{displayDestroyedBricks}/{run?.levelGoalBricks ?? 0} bricks</strong>
                </div>
                <div className="rogue-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayClimbProgressPct}>
                  <div className="rogue-progress-fill rogue-progress-fill-climb" style={{ width: `${displayClimbProgressPct}%` }} />
                </div>
                <ul className="rogue-stat-list">
                  <li>Level: {run?.level}/{run?.maxLevels}</li>
                  <li>Boards Cleared: {run?.boardsCleared}</li>
                  <li>Route: {activePathChallenge?.label ?? 'Unknown Trail'}</li>
                  <li>Domain Trend: {activeDomain?.name ?? 'Uncharted'}</li>
                  <li>Forecast Warden: {activeDomainWarden?.name ?? 'Unknown'}</li>
                  <li>{objectiveStatusLabel}</li>
                  <li>Bricks Remaining: {displayBricksRemaining}</li>
                  <li>Board HP Remaining: {boardHpRemaining}</li>
                  <li>Mana: {displayMana}</li>
                  <li>Shots: {run?.ballCount}</li>
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
            <h2>Doctrine Progress</h2>
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
              <p>Wardens Defeated: {lastRunSummary.wardensDefeated ?? 0}</p>
              <p>Mana Banked: {lastRunSummary.manaBanked ?? 0}</p>
              <p>Meta Earned: +{lastRunSummary.metaEarned}</p>
            </section>
          )}
        </aside>
        </div>
      </section>

      {shouldShowStartingRunSelection && (
        <section className="rogue-brick-panel">
          <h2>Persistent Doctrine</h2>
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
                  <div className="rogue-spoils-offer-preview">
                    <span className="rogue-spoils-offer-preview-label">
                      {state.enabled ? 'Meta power enabled' : state.rank > 0 ? 'Owned but disabled' : 'Not owned yet'}
                    </span>
                    <div className="rogue-spoils-offer-bars" aria-hidden="true">
                      <span
                        className="rogue-active-power-chip rogue-spoils-power-chip"
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
                      <span className="rogue-spoils-power-arrow">→</span>
                      <span
                        className="rogue-active-power-chip rogue-spoils-power-chip is-after"
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
                    <span className="rogue-spoils-offer-levels">
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
            {lastRunSummary.defeatReason && (
              <p className="rogue-gamble-modal-copy">{lastRunSummary.defeatReason}.</p>
            )}
            <p className="rogue-gamble-modal-copy">Wardens defeated: {lastRunSummary.wardensDefeated ?? 0}</p>
            <p className="rogue-gamble-modal-copy">Mana banked: {lastRunSummary.manaBanked ?? 0}</p>
            <p className="rogue-gamble-modal-copy">Your run is gone. You salvaged +{lastRunSummary.metaEarned} meta.</p>
            <div className="rogue-gamble-modal-actions">
              <button
                type="button"
                className="rogue-defeat-dismiss"
                onClick={() => setDismissedDefeatSummaryCompletedAt(lastRunSummary.completedAt)}
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
