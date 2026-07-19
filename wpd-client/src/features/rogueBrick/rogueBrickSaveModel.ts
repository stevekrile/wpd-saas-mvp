import type { CoreVariant, DeepwoodDomainKey, RoguePathRunState } from './rogueBrickPathing';

export type BrickKind =
  | 'standard'
  | 'reinforced'
  | 'prism'
  | 'objective'
  | 'unbreakable'
  | 'oneway'
  | 'exploding'
  | 'splinter';

export type OneWaySide = 'top' | 'bottom' | 'left' | 'right';

export interface Brick {
  id: string;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  kind?: BrickKind;
  coreVariant?: CoreVariant;
  weakSide?: OneWaySide;
}

export interface BoardState {
  turn: number;
  objectiveBrickId: string | null;
  objectiveBrickIds: string[];
  bricks: Brick[];
}

export interface PowerOffer {
  id: string;
  name: string;
  description: string;
  manaCost: number;
}

export interface SpoilsOffer {
  id: string;
  name: string;
  description: string;
  purchased: boolean;
}

export interface RunSummary {
  victory: boolean;
  boardsCleared: number;
  levelReached: number;
  metaEarned: number;
  completedAt: number;
  defeatReason?: string;
  wardensDefeated?: number;
  manaBanked?: number;
}

export interface BoardSkillBonus {
  id: string;
  label: string;
  detail: string;
  mana: number;
}

export interface BoardSummary {
  shotsTaken: number;
  bounceCount: number;
  manualBricksDestroyed: number;
  killShotBricksBeforeOrb: number;
  slowAndSteadyShots: number;
  giggidyBalls: number;
  bestBallRebounds: number;
  manaRaw: number;
  skillBonuses: BoardSkillBonus[];
  manaBonus: number;
  achievements: string[];
}

export type PermanentUpgradeKey = 'startingBalls' | 'startingMana' | 'startingDamage';

export interface PermanentUpgradeState {
  rank: number;
  enabled: boolean;
}

export interface RogueRunState extends RoguePathRunState {
  rngState: number;
  boardsCleared: number;
  nextSpoilsBoard: number;
  mana: number;
  essenceByColor: Record<CoreVariant, number>;
  orbSlotBonusByColor: Record<CoreVariant, number>;
  ballCount: number;
  damage: number;
  critChance: number;
  manaMultiplier: number;
  ballRadiusMultiplier: number;
  ballMassMultiplier: number;
  ballSpeedMultiplier: number;
  launchSpreadMultiplier: number;
  launchCadenceMultiplier: number;
  yellowCoreConsumeResistance: number;
  coreDamageWeights: Record<CoreVariant, number>;
  powers: Record<string, number>;
  levelGoalBricks: number;
  levelBricksDestroyed: number;
  coreCharge: number;
  homingBarrageReady: boolean;
  board: BoardState;
  pendingPowerOffers: PowerOffer[];
  pendingSpoilsOffers: SpoilsOffer[];
  hubMessage: string;
  boardShotsTaken: number;
  boardBounceCount: number;
  boardManaEarned: number;
  boardManualBricksDestroyed: number;
  boardKillShotBricksBeforeOrb: number;
  boardCleanPlateAwarded: boolean;
  boardSlowAndSteadyShots: number;
  boardGiggidyBalls: number;
  boardBestBallRebounds: number;
  lastBoardSummary: BoardSummary | null;
  boardSummaryAcknowledged: boolean;
  launchOriginX: number;
  activeWardenDomain: DeepwoodDomainKey | null;
}

export interface RogueBrickProfile {
  version: number;
  updatedAt: number;
  metaCurrency: number;
  totalRuns: number;
  bestLevel: number;
  permanentUpgrades: Record<PermanentUpgradeKey, PermanentUpgradeState>;
  run: RogueRunState | null;
  lastRunSummary: RunSummary | null;
}

export interface RogueBrickProfileNormalizationOptions {
  orbSkillGaugeBaseSegments: number;
  orbSkillGaugeMaxSegments: number;
  ballRadiusMultiplierMin: number;
  ballRadiusMultiplierMax: number;
  ballMassMin: number;
  ballMassMax: number;
  ballSpeedMultiplierMin: number;
  ballSpeedMultiplierMax: number;
  launchSpreadMultiplierMin: number;
  launchSpreadMultiplierMax: number;
  launchCadenceMultiplierMin: number;
  launchCadenceMultiplierMax: number;
  yellowCoreConsumeResistanceMin: number;
  yellowCoreConsumeResistanceMax: number;
  coreDamageWeightMin: number;
  coreDamageWeightMax: number;
  getLaunchOriginX: (run: RogueRunState | null | undefined) => number;
  ensureRunPathState: (run: RogueRunState) => void;
  toDeepwoodDomainKey: (value: unknown) => DeepwoodDomainKey | null;
}

const DEFAULT_PERMANENT_UPGRADES: Record<PermanentUpgradeKey, PermanentUpgradeState> = {
  startingBalls: { rank: 0, enabled: false },
  startingMana: { rank: 0, enabled: false },
  startingDamage: { rank: 0, enabled: false },
};

const PERMANENT_UPGRADE_KEYS: PermanentUpgradeKey[] = ['startingBalls', 'startingMana', 'startingDamage'];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function cloneRogueBrickProfile(profile: RogueBrickProfile): RogueBrickProfile {
  return JSON.parse(JSON.stringify(profile)) as RogueBrickProfile;
}

export function createDefaultRogueBrickProfile(now = Date.now()): RogueBrickProfile {
  return {
    version: 1,
    updatedAt: now,
    metaCurrency: 0,
    totalRuns: 0,
    bestLevel: 0,
    permanentUpgrades: {
      startingBalls: { ...DEFAULT_PERMANENT_UPGRADES.startingBalls },
      startingMana: { ...DEFAULT_PERMANENT_UPGRADES.startingMana },
      startingDamage: { ...DEFAULT_PERMANENT_UPGRADES.startingDamage },
    },
    run: null,
    lastRunSummary: null,
  };
}

export function getOrbSkillGaugeMaxByColor(
  permanentUpgrades: Record<PermanentUpgradeKey, PermanentUpgradeState>,
  baseSegments: number,
  maxSegments: number
): Record<CoreVariant, number> {
  const yellowBonus = permanentUpgrades.startingBalls.enabled ? permanentUpgrades.startingBalls.rank : 0;
  const blueBonus = permanentUpgrades.startingMana.enabled ? permanentUpgrades.startingMana.rank : 0;
  const greenBonus = permanentUpgrades.startingDamage.enabled ? permanentUpgrades.startingDamage.rank : 0;

  return {
    yellow: clampNumber(baseSegments + yellowBonus, baseSegments, maxSegments),
    blue: clampNumber(baseSegments + blueBonus, baseSegments, maxSegments),
    green: clampNumber(baseSegments + greenBonus, baseSegments, maxSegments),
  };
}

export function normalizeRogueBrickProfile(
  profile: RogueBrickProfile,
  options: RogueBrickProfileNormalizationOptions
): RogueBrickProfile {
  const normalized = cloneRogueBrickProfile(profile);
  const defaults = createDefaultRogueBrickProfile();

  normalized.permanentUpgrades = {
    ...defaults.permanentUpgrades,
    ...normalized.permanentUpgrades,
  };

  for (const key of PERMANENT_UPGRADE_KEYS) {
    const state = normalized.permanentUpgrades[key];
    if (!state || typeof state !== 'object') {
      normalized.permanentUpgrades[key] = { ...defaults.permanentUpgrades[key] };
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

    const existingEssenceByColor: Partial<Record<CoreVariant, number>> =
      normalized.run.essenceByColor && typeof normalized.run.essenceByColor === 'object'
        ? normalized.run.essenceByColor
        : {};

    const orbSkillGaugeMaxByColor = getOrbSkillGaugeMaxByColor(
      normalized.permanentUpgrades,
      options.orbSkillGaugeBaseSegments,
      options.orbSkillGaugeMaxSegments
    );

    normalized.run.essenceByColor = {
      yellow: clampNumber(
        Math.max(0, Math.floor(typeof existingEssenceByColor.yellow === 'number' ? existingEssenceByColor.yellow : 0)),
        0,
        orbSkillGaugeMaxByColor.yellow
      ),
      blue: clampNumber(
        Math.max(0, Math.floor(typeof existingEssenceByColor.blue === 'number' ? existingEssenceByColor.blue : 0)),
        0,
        orbSkillGaugeMaxByColor.blue
      ),
      green: clampNumber(
        Math.max(0, Math.floor(typeof existingEssenceByColor.green === 'number' ? existingEssenceByColor.green : 0)),
        0,
        orbSkillGaugeMaxByColor.green
      ),
    };

    const existingOrbSlotBonusByColor: Partial<Record<CoreVariant, number>> =
      normalized.run.orbSlotBonusByColor && typeof normalized.run.orbSlotBonusByColor === 'object'
        ? normalized.run.orbSlotBonusByColor
        : {};
    normalized.run.orbSlotBonusByColor = {
      yellow: Math.max(0, Math.floor(typeof existingOrbSlotBonusByColor.yellow === 'number' ? existingOrbSlotBonusByColor.yellow : 0)),
      blue: Math.max(0, Math.floor(typeof existingOrbSlotBonusByColor.blue === 'number' ? existingOrbSlotBonusByColor.blue : 0)),
      green: Math.max(0, Math.floor(typeof existingOrbSlotBonusByColor.green === 'number' ? existingOrbSlotBonusByColor.green : 0)),
    };

    if (typeof normalized.run.ballRadiusMultiplier !== 'number' || Number.isNaN(normalized.run.ballRadiusMultiplier)) {
      normalized.run.ballRadiusMultiplier = 1;
    }
    normalized.run.ballRadiusMultiplier = clampNumber(
      normalized.run.ballRadiusMultiplier,
      options.ballRadiusMultiplierMin,
      options.ballRadiusMultiplierMax
    );

    if (typeof normalized.run.ballMassMultiplier !== 'number' || Number.isNaN(normalized.run.ballMassMultiplier)) {
      normalized.run.ballMassMultiplier = 1;
    }
    normalized.run.ballMassMultiplier = clampNumber(
      normalized.run.ballMassMultiplier,
      options.ballMassMin,
      options.ballMassMax
    );

    if (typeof normalized.run.ballSpeedMultiplier !== 'number' || Number.isNaN(normalized.run.ballSpeedMultiplier)) {
      normalized.run.ballSpeedMultiplier = 1;
    }
    normalized.run.ballSpeedMultiplier = clampNumber(
      normalized.run.ballSpeedMultiplier,
      options.ballSpeedMultiplierMin,
      options.ballSpeedMultiplierMax
    );

    if (typeof normalized.run.launchSpreadMultiplier !== 'number' || Number.isNaN(normalized.run.launchSpreadMultiplier)) {
      normalized.run.launchSpreadMultiplier = 1;
    }
    normalized.run.launchSpreadMultiplier = clampNumber(
      normalized.run.launchSpreadMultiplier,
      options.launchSpreadMultiplierMin,
      options.launchSpreadMultiplierMax
    );

    if (typeof normalized.run.launchCadenceMultiplier !== 'number' || Number.isNaN(normalized.run.launchCadenceMultiplier)) {
      normalized.run.launchCadenceMultiplier = 1;
    }
    normalized.run.launchCadenceMultiplier = clampNumber(
      normalized.run.launchCadenceMultiplier,
      options.launchCadenceMultiplierMin,
      options.launchCadenceMultiplierMax
    );

    if (
      typeof normalized.run.yellowCoreConsumeResistance !== 'number' ||
      Number.isNaN(normalized.run.yellowCoreConsumeResistance)
    ) {
      normalized.run.yellowCoreConsumeResistance = 0;
    }
    normalized.run.yellowCoreConsumeResistance = clampNumber(
      normalized.run.yellowCoreConsumeResistance,
      options.yellowCoreConsumeResistanceMin,
      options.yellowCoreConsumeResistanceMax
    );

    const existingCoreWeights: Partial<Record<CoreVariant, number>> =
      normalized.run.coreDamageWeights && typeof normalized.run.coreDamageWeights === 'object'
        ? normalized.run.coreDamageWeights
        : {};

    normalized.run.coreDamageWeights = {
      yellow: clampNumber(
        typeof existingCoreWeights.yellow === 'number' ? existingCoreWeights.yellow : 1,
        options.coreDamageWeightMin,
        options.coreDamageWeightMax
      ),
      blue: clampNumber(
        typeof existingCoreWeights.blue === 'number' ? existingCoreWeights.blue : 1,
        options.coreDamageWeightMin,
        options.coreDamageWeightMax
      ),
      green: clampNumber(
        typeof existingCoreWeights.green === 'number' ? existingCoreWeights.green : 1,
        options.coreDamageWeightMin,
        options.coreDamageWeightMax
      ),
    };

    normalized.run.pendingPowerOffers = Array.isArray(normalized.run.pendingPowerOffers)
      ? normalized.run.pendingPowerOffers
      : [];
    normalized.run.pendingSpoilsOffers = Array.isArray(normalized.run.pendingSpoilsOffers)
      ? normalized.run.pendingSpoilsOffers
      : [];

    if (!normalized.run.board || !Array.isArray(normalized.run.board.bricks)) {
      normalized.run.board = { turn: 1, objectiveBrickId: null, objectiveBrickIds: [], bricks: [] };
    }
    if (typeof normalized.run.board.turn !== 'number' || Number.isNaN(normalized.run.board.turn)) {
      normalized.run.board.turn = 1;
    }
    if (!Array.isArray(normalized.run.board.objectiveBrickIds)) {
      normalized.run.board.objectiveBrickIds = [];
    }
    if (typeof normalized.run.board.objectiveBrickId !== 'string') {
      normalized.run.board.objectiveBrickId = null;
    }

    normalized.run.board.bricks = normalized.run.board.bricks.map((brick) => ({
      ...brick,
      kind: brick.kind ?? 'standard',
      coreVariant: brick.kind === 'objective' ? (brick.coreVariant ?? 'yellow') : brick.coreVariant,
    }));

    const objectiveBrickIds = normalized.run.board.objectiveBrickIds
      .filter((id): id is string => typeof id === 'string')
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .filter((id) => normalized.run?.board.bricks.some((brick) => brick.id === id));

    const fallbackObjectiveIds = normalized.run.board.objectiveBrickId
      ? [normalized.run.board.objectiveBrickId]
      : normalized.run.board.bricks.filter((brick) => brick.kind === 'objective').map((brick) => brick.id);

    normalized.run.board.objectiveBrickIds = objectiveBrickIds.length > 0 ? objectiveBrickIds : fallbackObjectiveIds;
    normalized.run.board.objectiveBrickId = normalized.run.board.objectiveBrickIds[0] ?? null;

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

    normalized.run.launchOriginX = options.getLaunchOriginX(normalized.run);

    if (typeof normalized.run.boardBounceCount !== 'number' || Number.isNaN(normalized.run.boardBounceCount)) {
      normalized.run.boardBounceCount = 0;
    }
    if (typeof normalized.run.boardManaEarned !== 'number' || Number.isNaN(normalized.run.boardManaEarned)) {
      normalized.run.boardManaEarned = 0;
    }
    if (
      typeof normalized.run.boardManualBricksDestroyed !== 'number' ||
      Number.isNaN(normalized.run.boardManualBricksDestroyed)
    ) {
      normalized.run.boardManualBricksDestroyed = 0;
    }
    if (
      typeof normalized.run.boardKillShotBricksBeforeOrb !== 'number' ||
      Number.isNaN(normalized.run.boardKillShotBricksBeforeOrb)
    ) {
      normalized.run.boardKillShotBricksBeforeOrb = 0;
    }
    if (typeof normalized.run.boardCleanPlateAwarded !== 'boolean') {
      normalized.run.boardCleanPlateAwarded = false;
    }
    if (
      typeof normalized.run.boardSlowAndSteadyShots !== 'number' ||
      Number.isNaN(normalized.run.boardSlowAndSteadyShots)
    ) {
      normalized.run.boardSlowAndSteadyShots = 0;
    }
    if (typeof normalized.run.boardGiggidyBalls !== 'number' || Number.isNaN(normalized.run.boardGiggidyBalls)) {
      normalized.run.boardGiggidyBalls = 0;
    }
    if (
      typeof normalized.run.boardBestBallRebounds !== 'number' ||
      Number.isNaN(normalized.run.boardBestBallRebounds)
    ) {
      normalized.run.boardBestBallRebounds = 0;
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
      if (typeof normalized.run.lastBoardSummary.manualBricksDestroyed !== 'number') {
        normalized.run.lastBoardSummary.manualBricksDestroyed = 0;
      }
      if (typeof normalized.run.lastBoardSummary.killShotBricksBeforeOrb !== 'number') {
        normalized.run.lastBoardSummary.killShotBricksBeforeOrb = 0;
      }
      if (typeof normalized.run.lastBoardSummary.slowAndSteadyShots !== 'number') {
        normalized.run.lastBoardSummary.slowAndSteadyShots = 0;
      }
      if (typeof normalized.run.lastBoardSummary.giggidyBalls !== 'number') {
        normalized.run.lastBoardSummary.giggidyBalls = 0;
      }
      if (typeof normalized.run.lastBoardSummary.bestBallRebounds !== 'number') {
        normalized.run.lastBoardSummary.bestBallRebounds = 0;
      }
      if (typeof normalized.run.lastBoardSummary.manaRaw !== 'number') {
        normalized.run.lastBoardSummary.manaRaw = 0;
      }
      if (!Array.isArray(normalized.run.lastBoardSummary.skillBonuses)) {
        normalized.run.lastBoardSummary.skillBonuses = [];
      }
      if (typeof normalized.run.lastBoardSummary.manaBonus !== 'number') {
        normalized.run.lastBoardSummary.manaBonus = 0;
      }
      if (!Array.isArray(normalized.run.lastBoardSummary.achievements)) {
        normalized.run.lastBoardSummary.achievements = [];
      }
    }

    if (typeof normalized.run.boardSummaryAcknowledged !== 'boolean') {
      normalized.run.boardSummaryAcknowledged = normalized.run.lastBoardSummary ? false : true;
    }

    normalized.run.activeWardenDomain = options.toDeepwoodDomainKey(normalized.run.activeWardenDomain);
    if (typeof normalized.run.activeWardenId !== 'string') {
      normalized.run.activeWardenId = null;
    }
    normalized.run.wardensDefeated = Array.isArray(normalized.run.wardensDefeated)
      ? normalized.run.wardensDefeated.filter((id): id is string => typeof id === 'string')
      : [];

    if (
      normalized.run.stage === 'warden' &&
      (!normalized.run.activeWardenId || normalized.run.activeWardenDomain === null)
    ) {
      normalized.run.stage = 'hub';
      normalized.run.activeWardenId = null;
      normalized.run.activeWardenDomain = null;
    }
    if (
      normalized.run.stage !== 'board' &&
      normalized.run.stage !== 'hub' &&
      normalized.run.stage !== 'powerup' &&
      normalized.run.stage !== 'warden'
    ) {
      normalized.run.stage = 'hub';
    }

    options.ensureRunPathState(normalized.run);
  }

  return normalized;
}

export function parseRogueBrickProgress(
  json: string,
  options: RogueBrickProfileNormalizationOptions
): RogueBrickProfile | null {
  try {
    const parsed = JSON.parse(json) as RogueBrickProfile;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (!parsed.permanentUpgrades || typeof parsed.permanentUpgrades !== 'object') {
      return null;
    }

    const normalized = normalizeRogueBrickProfile(parsed, options);
    if (normalized.run && (typeof normalized.run.nextSpoilsBoard !== 'number' || Number.isNaN(normalized.run.nextSpoilsBoard))) {
      normalized.run.nextSpoilsBoard = 0;
    }

    return normalized;
  } catch {
    return null;
  }
}
