import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { rogueBrickApi } from '../../api/rogueBrickApi';
import { useWpdAuth } from '../../features/auth/AuthContext';
import './RogueBrickPage.css';

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 720;
const BRICK_COLUMNS = 7;
const BRICK_GAP = 6;
const BRICK_HEIGHT = 36;
const BRICK_TOP = 90;
const LAUNCHER_Y = CANVAS_HEIGHT - 42;
const BALL_RADIUS = 6.5;
const BALL_SPEED = 630;
const MAX_ACTIVE_BALLS = 280;
const MIN_LAUNCH_UPWARD_COMPONENT = -0.08;
const LOSE_ROW = 13;
const LOCAL_STORAGE_PREFIX = 'wpd:rogue-brick:';

type RunStage = 'board' | 'hub' | 'powerup' | 'store';
type BrickKind =
  | 'standard'
  | 'reinforced'
  | 'orb'
  | 'prism'
  | 'unbreakable'
  | 'oneway'
  | 'exploding'
  | 'splinter';
type OneWaySide = 'top' | 'bottom' | 'left' | 'right';

interface Brick {
  id: string;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  kind?: BrickKind;
  weakSide?: OneWaySide;
}

interface BoardState {
  turn: number;
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

interface RogueRunState {
  seed: number;
  rngState: number;
  stage: RunStage;
  level: number;
  maxLevels: number;
  boardsCleared: number;
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
  board: BoardState;
  pendingPowerOffers: PowerOffer[];
  pendingStoreOffers: StoreOffer[];
  hubMessage: string;
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

interface BreakParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lifeMs: number;
  ageMs: number;
  color: string;
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
    baseManaCost: 16,
    apply: (run) => {
      run.ballCount += 2;
      run.powers['arcane-volley'] = (run.powers['arcane-volley'] ?? 0) + 1;
    },
  },
  {
    id: 'rune-edge',
    name: 'Rune Edge',
    description: '+1 damage this run.',
    baseManaCost: 18,
    apply: (run) => {
      run.damage += 1;
      run.powers['rune-edge'] = (run.powers['rune-edge'] ?? 0) + 1;
    },
  },
  {
    id: 'siphon-shell',
    name: 'Siphon Shell',
    description: '+20% mana gained this run.',
    baseManaCost: 20,
    apply: (run) => {
      run.manaMultiplier += 0.2;
      run.powers['siphon-shell'] = (run.powers['siphon-shell'] ?? 0) + 1;
    },
  },
  {
    id: 'golden-thread',
    name: 'Golden Thread',
    description: '+20% coin gains this run.',
    baseManaCost: 18,
    apply: (run) => {
      run.coinMultiplier += 0.2;
      run.powers['golden-thread'] = (run.powers['golden-thread'] ?? 0) + 1;
    },
  },
  {
    id: 'fortune-ricochet',
    name: 'Fortune Ricochet',
    description: '+7% critical chance this run.',
    baseManaCost: 21,
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
    baseCoinCost: 16,
    apply: (run) => {
      run.ballCount += 1;
    },
  },
  {
    id: 'shop-damage',
    name: 'Sharpening Glyph',
    description: '+1 damage',
    baseCoinCost: 20,
    apply: (run) => {
      run.damage += 1;
    },
  },
  {
    id: 'shop-crit',
    name: 'Lucky Sigil',
    description: '+5% crit chance',
    baseCoinCost: 18,
    apply: (run) => {
      run.critChance += 0.05;
    },
  },
  {
    id: 'shop-mana',
    name: 'Mana Flask',
    description: '+15 mana now',
    baseCoinCost: 10,
    apply: (run) => {
      run.mana += 15;
    },
  },
];

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

function getBrickWidth(): number {
  return (CANVAS_WIDTH - BRICK_GAP * (BRICK_COLUMNS + 1)) / BRICK_COLUMNS;
}

function pickBrickKind(run: RogueRunState): BrickKind {
  const roll = nextRandom(run);
  if (run.level >= 6 && roll < 0.08) {
    return 'splinter';
  }
  if (run.level >= 5 && roll < 0.17) {
    return 'exploding';
  }
  if (run.level >= 4 && roll < 0.29) {
    return 'oneway';
  }
  if (run.level >= 3 && roll < 0.37) {
    return 'unbreakable';
  }
  if (roll < 0.5) {
    return 'reinforced';
  }
  if (roll < 0.63) {
    return 'prism';
  }
  if (roll < 0.74) {
    return 'orb';
  }
  return 'standard';
}

function pickWeakSide(run: RogueRunState): OneWaySide {
  const sides: OneWaySide[] = ['top', 'right', 'bottom', 'left'];
  return sides[randomInt(run, 0, sides.length - 1)];
}

function isBreakableBrick(brick: Brick): boolean {
  return (brick.kind ?? 'standard') !== 'unbreakable';
}

function countBreakableBricks(bricks: Brick[]): number {
  return bricks.filter(isBreakableBrick).length;
}

function getImpactSideFromVelocity(ball: BallRuntime): OneWaySide {
  if (Math.abs(ball.vx) > Math.abs(ball.vy)) {
    return ball.vx > 0 ? 'left' : 'right';
  }
  return ball.vy > 0 ? 'top' : 'bottom';
}

function generateBoard(run: RogueRunState): BoardState {
  const bricks: Brick[] = [];
  const initialRows = run.level <= 2 ? 3 : Math.min(4 + Math.floor(run.level / 4), 8);
  const density = run.level <= 2 ? 0.62 : Math.min(0.68 + run.level * 0.018, 0.92);
  const hpBase = run.level <= 2 ? 2 : 2 + Math.floor(run.level * 1.05);

  for (let row = 0; row < initialRows; row += 1) {
    for (let col = 0; col < BRICK_COLUMNS; col += 1) {
      if (nextRandom(run) > density) {
        continue;
      }
      const kind = pickBrickKind(run);
      const hpVariance = run.level <= 3 ? randomInt(run, 1, 3) : randomInt(run, 1, 6 + Math.floor(run.level / 3));
      const variantBonus =
        kind === 'reinforced' ? 2 + Math.floor(run.level * 0.25)
          : kind === 'prism' ? 1 + Math.floor(run.level * 0.15)
            : kind === 'orb' ? Math.floor(run.level * 0.1)
              : kind === 'exploding' ? 1
                : kind === 'splinter' ? 2
                  : kind === 'oneway' ? 3
                    : kind === 'unbreakable' ? 999
              : 0;
      const hp = hpBase + hpVariance + row + variantBonus;
      bricks.push({
        id: `${run.level}-${row}-${col}-${Math.round(nextRandom(run) * 1_000_000)}`,
        row,
        col,
        hp,
        maxHp: hp,
        kind,
        weakSide: kind === 'oneway' ? pickWeakSide(run) : undefined,
      });
    }
  }

  if (countBreakableBricks(bricks) === 0) {
    const col = randomInt(run, 0, BRICK_COLUMNS - 1);
    bricks.push({
      id: `${run.level}-fallback-${col}-${Math.round(nextRandom(run) * 1_000_000)}`,
      row: 0,
      col,
      hp: hpBase,
      maxHp: hpBase,
      kind: 'standard',
    });
  }

  return {
    turn: 1,
    bricks,
  };
}

function calculateLevelGoal(initialBrickCount: number): number {
  return Math.max(1, Math.min(initialBrickCount, Math.round(initialBrickCount * 0.9)));
}

function appendDifficultyRow(run: RogueRunState, board: BoardState): void {
  const hpBase = Math.max(3, 2 + Math.floor(run.level * 1.05) + Math.floor(board.turn * 0.4));
  for (const brick of board.bricks) {
    brick.row += 1;
  }

  const newRow: Brick[] = [];
  for (let col = 0; col < BRICK_COLUMNS; col += 1) {
    if (nextRandom(run) < 0.14) {
      continue;
    }

    const kind = pickBrickKind(run);
    const variantBonus =
      kind === 'reinforced' ? 2 + Math.floor(run.level * 0.25)
        : kind === 'prism' ? 1 + Math.floor(run.level * 0.15)
          : kind === 'orb' ? Math.floor(run.level * 0.1)
            : kind === 'exploding' ? 1
              : kind === 'splinter' ? 2
                : kind === 'oneway' ? 3
                  : kind === 'unbreakable' ? 999
            : 0;
    const hp = hpBase + randomInt(run, 1, 5 + Math.floor(run.level / 4)) + variantBonus;
    newRow.push({
      id: `${run.level}-turn-${board.turn}-${col}-${Math.round(nextRandom(run) * 1_000_000)}`,
      row: 0,
      col,
      hp,
      maxHp: hp,
      kind,
      weakSide: kind === 'oneway' ? pickWeakSide(run) : undefined,
    });
  }

  board.bricks.push(...newRow);
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
    const levelScale = 1 + Math.floor(run.level / 4) * 0.12;
    offers.push({
      id: template.id,
      name: template.name,
      description: template.description,
      manaCost: Math.max(8, Math.round(template.baseManaCost * levelScale)),
    });
  }

  return offers;
}

function makeStoreOffers(run: RogueRunState): StoreOffer[] {
  const offers: StoreOffer[] = [];
  const picked = new Set<string>();

  while (offers.length < 4 && picked.size < STORE_POOL.length) {
    const template = STORE_POOL[randomInt(run, 0, STORE_POOL.length - 1)];
    if (picked.has(template.id)) {
      continue;
    }
    picked.add(template.id);
    const levelScale = 1 + Math.floor(run.level / 5) * 0.15;
    offers.push({
      id: template.id,
      name: template.name,
      description: template.description,
      coinCost: Math.max(8, Math.round(template.baseCoinCost * levelScale)),
      purchased: false,
    });
  }

  return offers;
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

function parseProgress(json: string): RogueBrickProfile | null {
  try {
    const parsed = JSON.parse(json) as RogueBrickProfile;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (!parsed.permanentUpgrades || typeof parsed.permanentUpgrades !== 'object') {
      return null;
    }
    if (parsed.run?.board?.bricks) {
      parsed.run.board.bricks = parsed.run.board.bricks.map((brick) => ({
        ...brick,
        kind: brick.kind ?? 'standard',
      }));
    }
    return parsed;
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
  const brickVisualRef = useRef<Map<string, BrickVisualState>>(new Map());
  const breakParticlesRef = useRef<BreakParticle[]>([]);
  const frameNowRef = useRef(0);
  const shotInFlightRef = useRef(false);
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
    const now = frameNowRef.current || performance.now();

    const profileSnapshot = profileRef.current;
    const runSnapshot = profileSnapshot?.run ?? null;
    if (!runSnapshot) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Start a run to begin.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      return;
    }

    const brickWidth = getBrickWidth();
    const bricksToDraw = shotInFlightRef.current ? bricksRef.current : runSnapshot.board.bricks;

    for (const brick of bricksToDraw) {
      const visual = brickVisualRef.current.get(brick.id);
      const hitIntensity = visual ? Math.max(0, (visual.hitUntil - now) / 120) : 0;
      if (visual && hitIntensity <= 0) {
        brickVisualRef.current.delete(brick.id);
      }

      const x = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
      const y = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
      const kind = brick.kind ?? 'standard';
      const hpPct = Math.max(0, Math.min(1, brick.hp / Math.max(1, brick.maxHp)));
      const red = Math.round(
        (kind === 'reinforced' || kind === 'unbreakable'
          ? 185
          : kind === 'orb' || kind === 'splinter'
            ? 145
            : kind === 'exploding'
              ? 238
              : 220) - hpPct * 115
      );
      const green = Math.round(
        (kind === 'reinforced'
          ? 120
          : kind === 'prism'
            ? 90
            : kind === 'exploding'
              ? 140
              : kind === 'splinter'
                ? 110
                : 105) + hpPct * 105
      );
      const blue = 240;
      const centerX = x + brickWidth / 2;
      const centerY = y + BRICK_HEIGHT / 2;
      const hitScale = 1 + hitIntensity * 0.06;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(hitScale, hitScale);
      ctx.translate(-centerX, -centerY);

      const gradient = ctx.createLinearGradient(x, y, x, y + BRICK_HEIGHT);
      gradient.addColorStop(
        0,
        `rgba(${Math.min(255, red + 20)}, ${Math.min(255, green + 35)}, ${Math.min(255, blue + 10)}, 1)`
      );
      gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 1)`);

      ctx.fillStyle = gradient;
      ctx.strokeStyle = `rgba(9, 12, 20, ${0.4 - hitIntensity * 0.14})`;

      if (kind === 'orb') {
        const radius = Math.min(brickWidth, BRICK_HEIGHT) * 0.42;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.68, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === 'prism') {
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

      if (kind !== 'orb' && kind !== 'prism') {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.11 + hitIntensity * 0.18})`;
        ctx.fillRect(x + 2, y + 2, brickWidth - 4, 5);
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
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        const side = brick.weakSide;
        if (side === 'top') {
          ctx.beginPath();
          ctx.moveTo(centerX, y + 5);
          ctx.lineTo(centerX - 6, y + 12);
          ctx.lineTo(centerX + 6, y + 12);
          ctx.closePath();
          ctx.fill();
        } else if (side === 'bottom') {
          ctx.beginPath();
          ctx.moveTo(centerX, y + BRICK_HEIGHT - 5);
          ctx.lineTo(centerX - 6, y + BRICK_HEIGHT - 12);
          ctx.lineTo(centerX + 6, y + BRICK_HEIGHT - 12);
          ctx.closePath();
          ctx.fill();
        } else if (side === 'left') {
          ctx.beginPath();
          ctx.moveTo(x + 5, centerY);
          ctx.lineTo(x + 12, centerY - 6);
          ctx.lineTo(x + 12, centerY + 6);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(x + brickWidth - 5, centerY);
          ctx.lineTo(x + brickWidth - 12, centerY - 6);
          ctx.lineTo(x + brickWidth - 12, centerY + 6);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (brick.hp <= Math.ceil(brick.maxHp * 0.45)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(x + brickWidth * 0.25, y + BRICK_HEIGHT * 0.25);
        ctx.lineTo(x + brickWidth * 0.55, y + BRICK_HEIGHT * 0.55);
        ctx.lineTo(x + brickWidth * 0.72, y + BRICK_HEIGHT * 0.35);
        ctx.stroke();
      }

      const label = kind === 'unbreakable' ? 'LOCK' : String(Math.max(0, Math.ceil(brick.hp)));
      ctx.font = kind === 'unbreakable' ? 'bold 11px monospace' : 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = 'rgba(4, 8, 18, 0.92)';
      ctx.lineWidth = 3.2;
      ctx.lineJoin = 'round';

      // Soft halo behind number for dark-mode readability without a hard badge box.
      ctx.shadowColor = 'rgba(4, 8, 18, 0.85)';
      ctx.shadowBlur = 7;
      ctx.strokeText(label, centerX, centerY);
      ctx.shadowBlur = 0;
      ctx.fillText(label, centerX, centerY);
      ctx.restore();
    }

    for (const particle of breakParticlesRef.current) {
      const alpha = Math.max(0, 1 - particle.ageMs / particle.lifeMs);
      if (alpha <= 0) {
        continue;
      }
      ctx.fillStyle = particle.color.replace('ALPHA', alpha.toFixed(3));
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    const loseY = BRICK_TOP + LOSE_ROW * (BRICK_HEIGHT + BRICK_GAP);
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

    ctx.fillStyle = '#f8fafc';
    for (const ball of ballsRef.current) {
      if (!ball.active) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, LAUNCHER_Y, 8, 0, Math.PI * 2);
    ctx.fill();
  }, [aimPoint, isDragging]);

  const spawnBreakParticles = useCallback((brick: Brick) => {
    const brickWidth = getBrickWidth();
    const x = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
    const y = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
    const hpPct = Math.max(0, Math.min(1, brick.hp / Math.max(1, brick.maxHp)));
    const red = Math.round(220 - hpPct * 120);
    const green = Math.round(90 + hpPct * 110);
    const blue = 240;

    for (let i = 0; i < 7; i += 1) {
      const speed = 80 + Math.random() * 110;
      const angle = Math.random() * Math.PI * 2;
      breakParticlesRef.current.push({
        x: x + brickWidth * (0.2 + Math.random() * 0.6),
        y: y + BRICK_HEIGHT * (0.2 + Math.random() * 0.6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        radius: 1.8 + Math.random() * 2.6,
        lifeMs: 210 + Math.random() * 140,
        ageMs: 0,
        color: `rgba(${red}, ${green}, ${blue}, ALPHA)`,
      });
    }
  }, []);

  const commitProfile = useCallback(
    (mutate: (draft: RogueBrickProfile) => void, markDirty: boolean) => {
      setProfile((prev) => {
        const base = prev ? cloneProfile(prev) : defaultProfile();
        mutate(base);
        base.updatedAt = Date.now();
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
    }
    draw();
  }, [profile, draw, shotInProgress]);

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
          if (parsed?.profile?.permanentUpgrades) {
            localEnvelope = parsed;
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
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const brickSnapshot = bricksRef.current.map((brick) => ({ ...brick }));
    const rewards = { ...pendingRewardsRef.current };
    const destroyedThisTurn = pendingDestroyedBricksRef.current;
    pendingRewardsRef.current = { mana: 0, coins: 0 };
    pendingDestroyedBricksRef.current = 0;

    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'board') {
        return;
      }

      const runState = draft.run;
      runState.mana += Math.round(rewards.mana);
      runState.coins += Math.round(rewards.coins);
      runState.board.bricks = brickSnapshot;
      runState.levelBricksDestroyed = (runState.levelBricksDestroyed ?? 0) + destroyedThisTurn;
      runState.levelGoalBricks = Math.max(
        1,
        runState.levelGoalBricks ?? calculateLevelGoal(Math.max(1, countBreakableBricks(runState.board.bricks)))
      );

      if (runState.levelBricksDestroyed >= runState.levelGoalBricks || runState.board.bricks.length === 0) {
        runState.boardsCleared += 1;
        runState.level += 1;
        runState.hubMessage = `Climb target reached. Ascend to level ${runState.level}. +${Math.round(rewards.mana)} mana, +${Math.round(rewards.coins)} coins.`;

        if (runState.level > runState.maxLevels) {
          runState.stage = 'hub';
          runState.board = { turn: 1, bricks: [] };
          return;
        }

        if (runState.boardsCleared % 3 === 0) {
          runState.stage = 'powerup';
          runState.pendingPowerOffers = makePowerOffers(runState);
          runState.pendingStoreOffers = [];
        } else {
          runState.stage = 'hub';
          runState.pendingStoreOffers = makeStoreOffers(runState);
          runState.pendingPowerOffers = [];
        }

        runState.board = { turn: 1, bricks: [] };
        return;
      }

      appendDifficultyRow(runState, runState.board);
      if (runState.board.bricks.some((brick) => brick.row >= LOSE_ROW)) {
        runState.stage = 'hub';
        runState.hubMessage = 'A brick crossed the threshold.';
      }
    }, true);
  }, [commitProfile]);

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
    (direction: { x: number; y: number }) => {
      const currentRun = profileRef.current?.run;
      if (!currentRun || currentRun.stage !== 'board') {
        return;
      }
      if (shotInFlightRef.current || currentRun.board.bricks.length === 0) {
        return;
      }

      setIsDragging(false);
      setAimPoint(null);
      shotInFlightRef.current = true;
      setShotInProgress(true);
      setLiveHud({
        destroyedBricks: 0,
        manaEarned: 0,
        coinsEarned: 0,
        remainingBricks: currentRun.board.bricks.length,
      });
      ballsRef.current = [];
      bricksRef.current = currentRun.board.bricks.map((brick) => ({ ...brick }));
      launchQueueRef.current = Array.from({ length: currentRun.ballCount }, (_, index) => ({
        delayMs: index * 70,
      }));
      launchDirectionRef.current = direction;
      launchElapsedRef.current = 0;
      pendingRewardsRef.current = { mana: 0, coins: 0 };
      pendingDestroyedBricksRef.current = 0;
      let noHitElapsedMs = 0;
      let speedMultiplier = 1;

      let previousTs = performance.now();
      const frame = (timestamp: number) => {
        frameNowRef.current = timestamp;
        const activeRun = profileRef.current?.run;
        if (!shotInFlightRef.current || !activeRun || activeRun.stage !== 'board') {
          return;
        }

        const dtSeconds = Math.min((timestamp - previousTs) / 1000, 0.033) * speedMultiplier;
        previousTs = timestamp;
        launchElapsedRef.current += dtSeconds * 1000;
        let touchedBrickThisFrame = false;

        while (
          launchQueueRef.current.length > 0 &&
          launchElapsedRef.current >= launchQueueRef.current[0].delayMs
        ) {
          launchQueueRef.current.shift();
          const scatter = (Math.random() - 0.5) * 0.05;
          const vx = (launchDirectionRef.current.x + scatter) * BALL_SPEED;
          const vy = launchDirectionRef.current.y * BALL_SPEED;
          ballsRef.current.push({
            x: CANVAS_WIDTH / 2,
            y: LAUNCHER_Y,
            vx,
            vy,
            active: true,
          });
        }

        const rewards = pendingRewardsRef.current;
        const brickWidth = getBrickWidth();
        const processedExplosions = new Set<string>();

        for (const particle of breakParticlesRef.current) {
          particle.ageMs += dtSeconds * 1000;
          particle.x += particle.vx * dtSeconds;
          particle.y += particle.vy * dtSeconds;
          particle.vy += 280 * dtSeconds;
        }
        breakParticlesRef.current = breakParticlesRef.current.filter(
          (particle) => particle.ageMs < particle.lifeMs
        );

        const destroyBrick = (brick: Brick, sourceBall: BallRuntime | null) => {
          pendingDestroyedBricksRef.current += 1;
          rewards.coins += activeRun.coinMultiplier * (2 + Math.max(1, brick.maxHp) * 0.2);
          spawnBreakParticles(brick);
          brickVisualRef.current.delete(brick.id);

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

          ball.x += ball.vx * dtSeconds;
          ball.y += ball.vy * dtSeconds;

          if (ball.x <= BALL_RADIUS) {
            ball.x = BALL_RADIUS;
            ball.vx = Math.abs(ball.vx);
          } else if (ball.x >= CANVAS_WIDTH - BALL_RADIUS) {
            ball.x = CANVAS_WIDTH - BALL_RADIUS;
            ball.vx = -Math.abs(ball.vx);
          }

          if (ball.y <= BALL_RADIUS) {
            ball.y = BALL_RADIUS;
            ball.vy = Math.abs(ball.vy);
          }

          for (const brick of bricksRef.current) {
            if (brick.hp <= 0) {
              continue;
            }
            const brickX = BRICK_GAP + brick.col * (brickWidth + BRICK_GAP);
            const brickY = BRICK_TOP + brick.row * (BRICK_HEIGHT + BRICK_GAP);
            if (
              ball.x + BALL_RADIUS < brickX ||
              ball.x - BALL_RADIUS > brickX + brickWidth ||
              ball.y + BALL_RADIUS < brickY ||
              ball.y - BALL_RADIUS > brickY + BRICK_HEIGHT
            ) {
              continue;
            }

            const isCrit = Math.random() < activeRun.critChance;
            const baseDamage = activeRun.damage * (isCrit ? 2 : 1);
            const variant = brick.kind ?? 'standard';
            const damage =
              variant === 'reinforced'
                ? Math.max(1, Math.round(baseDamage * 0.75))
                : variant === 'orb'
                  ? Math.max(1, Math.round(baseDamage * 1.1))
                  : variant === 'splinter'
                  ? Math.max(1, Math.round(baseDamage * 0.9))
                  : baseDamage;
            const impactSide = getImpactSideFromVelocity(ball);
            const canDamage =
              variant !== 'unbreakable' &&
              (variant !== 'oneway' || !brick.weakSide || brick.weakSide === impactSide);

            if (canDamage) {
              brick.hp -= damage;
              touchedBrickThisFrame = true;
              brickVisualRef.current.set(brick.id, { hitUntil: timestamp + 120 });
              rewards.mana += activeRun.manaMultiplier * (isCrit ? 1.5 : 1);
              if (brick.hp <= 0) {
                destroyBrick(brick, ball);
              }
            } else {
              brickVisualRef.current.set(brick.id, { hitUntil: timestamp + 80 });
            }

            const centerX = brickX + brickWidth / 2;
            const centerY = brickY + BRICK_HEIGHT / 2;
            if (Math.abs(ball.x - centerX) > Math.abs(ball.y - centerY)) {
              ball.vx *= -1;
            } else {
              ball.vy *= -1;
            }
            break;
          }

          if (ball.y >= CANVAS_HEIGHT + 12) {
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
        if (finished) {
          finalizeTurn();
          return;
        }

        animationRef.current = requestAnimationFrame(frame);
      };

      animationRef.current = requestAnimationFrame(frame);
    },
    [draw, finalizeTurn, spawnBreakParticles]
  );

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startRun = useCallback(() => {
    commitProfile((draft) => {
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
        stage: 'board',
        level: 1,
        maxLevels: 18,
        boardsCleared: 0,
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
        board: { turn: 1, bricks: [] },
        pendingPowerOffers: [],
        pendingStoreOffers: [],
        hubMessage: 'Run started.',
      };

      runState.board = generateBoard(runState);
      runState.levelGoalBricks = calculateLevelGoal(countBreakableBricks(runState.board.bricks));
      runState.levelBricksDestroyed = 0;
      draft.run = runState;
      draft.lastRunSummary = null;
    }, true);
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      coinsEarned: 0,
      remainingBricks: 0,
    });
  }, [commitProfile]);

  const continueToBoard = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run) {
        return;
      }
      if (draft.run.level > draft.run.maxLevels) {
        return;
      }
      draft.run.stage = 'board';
      draft.run.board = generateBoard(draft.run);
      draft.run.levelGoalBricks = calculateLevelGoal(countBreakableBricks(draft.run.board.bricks));
      draft.run.levelBricksDestroyed = 0;
      draft.run.pendingPowerOffers = [];
      draft.run.pendingStoreOffers = [];
      draft.run.hubMessage = `Entering board ${draft.run.level} of ${draft.run.maxLevels}.`;
    }, true);
    setLiveHud({
      destroyedBricks: 0,
      manaEarned: 0,
      coinsEarned: 0,
      remainingBricks: 0,
    });
  }, [commitProfile]);

  const visitStore = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'hub') {
        return;
      }
      draft.run.stage = 'store';
      if (draft.run.pendingStoreOffers.length === 0) {
        draft.run.pendingStoreOffers = makeStoreOffers(draft.run);
      }
    }, true);
  }, [commitProfile]);

  const gambleForPower = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'hub') {
        return;
      }
      const runState = draft.run;
      const gambleCost = 20;
      if (runState.coins < gambleCost) {
        runState.hubMessage = 'Not enough coins to gamble.';
        return;
      }
      runState.coins -= gambleCost;
      const lucky = nextRandom(runState) < 0.7;
      if (!lucky) {
        runState.hubMessage = 'The gamble failed. Better luck next time.';
        return;
      }

      const template = POWER_POOL[randomInt(runState, 0, POWER_POOL.length - 1)];
      template.apply(runState);
      runState.hubMessage = `Gamble success: ${template.name}.`;
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

        runState.mana -= offer.manaCost;
        template.apply(runState);
        runState.pendingPowerOffers = [];
        runState.stage = 'hub';
        runState.pendingStoreOffers = makeStoreOffers(runState);
        runState.hubMessage = `${template.name} acquired.`;
      }, true);
    },
    [commitProfile]
  );

  const skipPowerUp = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'powerup') {
        return;
      }
      draft.run.pendingPowerOffers = [];
      draft.run.stage = 'hub';
      draft.run.pendingStoreOffers = makeStoreOffers(draft.run);
      draft.run.hubMessage = 'Skipped power-up selection.';
    }, true);
  }, [commitProfile]);

  const buyStoreOffer = useCallback(
    (offerId: string) => {
      commitProfile((draft) => {
        if (!draft.run || draft.run.stage !== 'store') {
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
        offer.purchased = true;
        runState.hubMessage = `Purchased ${offer.name}.`;
      }, true);
    },
    [commitProfile]
  );

  const leaveStore = useCallback(() => {
    commitProfile((draft) => {
      if (!draft.run || draft.run.stage !== 'store') {
        return;
      }
      draft.run.stage = 'hub';
      draft.run.hubMessage = 'Left the store.';
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

  if (isLoading || !profile) {
    return <div className="loading">Loading hidden module...</div>;
  }

  const canStartRun = !profile.run && !shotInProgress;
  const hasActiveRun = !!profile.run;
  const runProgressPct = run
    ? Math.round((Math.max(0, run.level - 1) / Math.max(1, run.maxLevels)) * 100)
    : 0;
  const boardBricksRemaining = run?.board.bricks.length ?? 0;
  const displayBricksRemaining =
    shotInProgress && hasActiveRun ? liveHud.remainingBricks : boardBricksRemaining;
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
                  className="btn-secondary rogue-brick-focus-exit"
                  onClick={() => setIsFocusMode(false)}
                >
                  Exit
                </button>
              )}
            </div>
          </div>
          <div className="rogue-brick-top-hud-row">
            <span className="rogue-brick-top-hud-label">
              Progress {overallProgressPct}%
              {hasActiveRun ? ` - Level ${run?.level}/${run?.maxLevels}` : ''}
            </span>
            {hasActiveRun && (
              <span className="rogue-brick-top-hud-meta">
                {displayDestroyedBricks}/{run?.levelGoalBricks ?? 0} bricks
              </span>
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

        <div className={`rogue-brick-layout${isFocusMode ? ' is-focus-mode' : ''}`}>
          <div className="rogue-brick-canvas-wrap">
            {showBoardOverlay && (
              <div className="rogue-board-overlay">
                <section className="rogue-board-overlay-content">
                  {!hasActiveRun && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={startRun}
                      disabled={!canStartRun}
                    >
                      Start New Run
                    </button>
                  )}

                {run?.stage === 'hub' && (
                  <div className="rogue-choice-grid">
                    <button type="button" className="btn-primary" onClick={continueToBoard}>
                      Face Next Board
                    </button>
                    <button type="button" className="btn-secondary" onClick={gambleForPower}>
                      Gamble for Power (20 coins)
                    </button>
                    <button type="button" className="btn-secondary" onClick={visitStore}>
                      Visit Store
                    </button>
                  </div>
                )}

                {run?.stage === 'powerup' && (
                  <>
                    <h2>Choose a Power-Up (Mana)</h2>
                    <div className="rogue-choice-grid">
                      {run.pendingPowerOffers.map((offer) => (
                        <button
                          type="button"
                          key={offer.id}
                          className="rogue-choice-card"
                          onClick={() => choosePowerUp(offer.id)}
                        >
                          <strong>{offer.name}</strong>
                          <span>{offer.description}</span>
                          <span>Cost: {offer.manaCost} mana</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="btn-text" onClick={skipPowerUp}>
                      Skip choice
                    </button>
                  </>
                )}

                {run?.stage === 'store' && (
                  <>
                    <h2>Store</h2>
                    <div className="rogue-choice-grid">
                      {run.pendingStoreOffers.map((offer) => (
                        <button
                          type="button"
                          key={offer.id}
                          className="rogue-choice-card"
                          onClick={() => buyStoreOffer(offer.id)}
                          disabled={offer.purchased}
                        >
                          <strong>{offer.name}</strong>
                          <span>{offer.description}</span>
                          <span>{offer.purchased ? 'Purchased' : `Cost: ${offer.coinCost} coins`}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="btn-primary" onClick={leaveStore}>
                      Return
                    </button>
                  </>
                )}

                {run?.hubMessage && <p className="rogue-hub-message">{run.hubMessage}</p>}
              </section>
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
                  <li>Bricks Remaining: {displayBricksRemaining}</li>
                  <li>Board HP Remaining: {boardHpRemaining}</li>
                  <li>Mana: {displayMana}</li>
                  <li>Coins: {displayCoins}</li>
                  <li>Balls: {run?.ballCount}</li>
                  <li>Damage: {run?.damage}</li>
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
          </section>

          {!hasActiveRun && profile.lastRunSummary && (
            <section className="rogue-brick-panel">
              <h2>Last Run</h2>
              <p>{profile.lastRunSummary.victory ? 'Victory' : 'Defeat'}</p>
              <p>Level Reached: {profile.lastRunSummary.levelReached}</p>
              <p>Boards Cleared: {profile.lastRunSummary.boardsCleared}</p>
              <p>Meta Earned: +{profile.lastRunSummary.metaEarned}</p>
            </section>
          )}
        </aside>
        </div>
      </section>

      {!hasActiveRun && (
        <section className="rogue-brick-panel">
          <h2>Permanent Upgrades</h2>
          <div className="rogue-choice-grid">
            {PERMANENT_UPGRADES.map((upgrade) => {
              const state = profile.permanentUpgrades[upgrade.key];
              const cost = upgradeCost(upgrade, state.rank);
              const atMax = state.rank >= upgrade.maxRank;
              return (
                <div key={upgrade.key} className="rogue-upgrade-card">
                  <strong>{upgrade.name}</strong>
                  <span>{upgrade.description}</span>
                  <span>Rank: {state.rank}/{upgrade.maxRank}</span>
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
    </div>
  );
}
