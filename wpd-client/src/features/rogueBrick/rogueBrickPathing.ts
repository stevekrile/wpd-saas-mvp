export const CORE_VARIANTS = ['yellow', 'blue', 'green'] as const;
export const PATH_MAX_LANE_ABS = 1;
export const PATH_WARDEN_INTERVAL_LEVELS = 7;
export const PATH_WARDEN_TOTAL = 4;

export type RunStage = 'board' | 'hub' | 'powerup' | 'warden';
export type PathChallengeKey = 'balanced' | 'swarm' | 'fortified' | 'gauntlet';
export type DeepwoodDomainKey = 'black-bog' | 'crow-spire' | 'thorn-keep' | 'ash-castle';
export type CoreVariant = (typeof CORE_VARIANTS)[number];

export interface PathNodeState {
  id: string;
  parentId: string | null;
  level: number;
  lane: number;
  challenge: PathChallengeKey;
  primaryCoreVariant: CoreVariant;
}

export interface PathChallengeDefinition {
  key: PathChallengeKey;
  label: string;
  description: string;
  domain: DeepwoodDomainKey;
  boardPoolShift: number;
  hpMultiplier: number;
  objectiveHpMultiplier: number;
  objectiveCountBonus: number;
  unbreakableShareMultiplier: number;
}

export interface DeepwoodWardenDefinition {
  id: string;
  name: string;
  pressure: string;
  counterHint: string;
}

export interface DeepwoodDomainDefinition {
  key: DeepwoodDomainKey;
  name: string;
  summary: string;
  pressureTags: string[];
  wardens: DeepwoodWardenDefinition[];
}

export interface PathPreviewNode extends PathNodeState {
  relation: 'past' | 'current' | 'future';
  isSelected: boolean;
  isPlayable: boolean;
}

export interface PathPreviewEdge {
  fromId: string;
  toId: string;
}

export interface PathPreview {
  startLevel: number;
  endLevel: number;
  minLane: number;
  maxLane: number;
  nodes: PathPreviewNode[];
  edges: PathPreviewEdge[];
}

export interface PathFocusSets {
  nodeIds: Set<string>;
  edgeKeys: Set<string>;
}

export interface RoguePathRunState {
  seed: number;
  stage: RunStage;
  level: number;
  maxLevels: number;
  pathCurrentNodeId: string;
  pathNodesByLevel: Record<number, PathNodeState>;
  activeWardenId: string | null;
  wardensDefeated: string[];
}

export interface BlankEncounterProfile {
  encounterNumber: 1 | 2 | 3 | 4;
  hpPerEye: number;
  pathSpeedAtFullHp: number;
  pathSpeedAtLowHp: number;
  tearRespawnMinAtFullHp: number;
  tearRespawnMaxAtFullHp: number;
  tearRespawnMinAtLowHp: number;
  tearRespawnMaxAtLowHp: number;
  tearDetachAtSec: number;
  tearFallDurationAtFullHp: number;
  tearFallDurationAtLowHp: number;
  dualEyes: boolean;
  eyeSpacingPx: number;
}

export interface PathWardenTrigger {
  level: number;
  domain: DeepwoodDomainKey;
  wardenIndex: number;
}

const PRIMARY_WARDEN_DOMAIN: DeepwoodDomainKey = 'thorn-keep';

export const WARDEN_TRIGGERS: PathWardenTrigger[] = Array.from({ length: PATH_WARDEN_TOTAL }, (_, index) => ({
  level: (index + 1) * PATH_WARDEN_INTERVAL_LEVELS,
  domain: PRIMARY_WARDEN_DOMAIN,
  wardenIndex: 0,
}));

const DEEPWOOD_DOMAINS: Record<DeepwoodDomainKey, DeepwoodDomainDefinition> = {
  'black-bog': {
    key: 'black-bog',
    name: 'Black Bog',
    summary: 'Attrition-heavy marsh hunted by absorb and decay pressure.',
    pressureTags: ['Absorb', 'Decay', 'Resource Drain'],
    wardens: [
      {
        id: 'mire-heart',
        name: 'The Mire Heart',
        pressure: 'Absorbs light shots unless primed by heavier impacts.',
        counterHint: 'Bring burst windows or layered hit sequencing.',
      },
      {
        id: 'fen-maw',
        name: 'Fen Maw',
        pressure: 'Consumes nearby munitions before unloading a shockwave.',
        counterHint: 'Control spacing and hold burst for post-consume windows.',
      },
    ],
  },
  'crow-spire': {
    key: 'crow-spire',
    name: 'Crow Spire',
    summary: 'Evasive aerial swarms that punish narrow firing lanes.',
    pressureTags: ['Evasion', 'Aerial Swarm', 'Aim Tax'],
    wardens: [
      {
        id: 'murder-king',
        name: 'Murder King',
        pressure: 'Summons flock waves with erratic movement bursts.',
        counterHint: 'Use spread saturation and multi-contact munitions.',
      },
      {
        id: 'glass-beak',
        name: 'Glass Beak',
        pressure: 'Dive armor phases require timed heavy responses.',
        counterHint: 'Build momentum for phase-break bursts.',
      },
    ],
  },
  'thorn-keep': {
    key: 'thorn-keep',
    name: 'Thorn Keep',
    summary: 'Armored, retaliatory strongholds that reward controlled impact.',
    pressureTags: ['Armor', 'Retaliation', 'Position Lock'],
    wardens: [
      {
        id: 'blank',
        name: 'Blank',
        pressure: 'Alternates open-fire windows with full lid immunity while tear drops threaten your shield line.',
        counterHint: 'Burst while the eye is open, clear tears early, and keep blue reserve buffered.',
      },
      {
        id: 'siege-idol',
        name: 'Siege Idol',
        pressure: 'Segmented plating must be broken in sequence.',
        counterHint: 'Use repeatable heavy contact and targeted lanes.',
      },
    ],
  },
  'ash-castle': {
    key: 'ash-castle',
    name: 'Ash Castle',
    summary: 'Heat and tempo disruption that deny clean cadence.',
    pressureTags: ['Heat', 'Cadence Disruption', 'Zone Denial'],
    wardens: [
      {
        id: 'cinder-regent',
        name: 'Cinder Regent',
        pressure: 'Heat pulses desync rapid-fire patterns.',
        counterHint: 'Draft cooldown stability and deliberate bursts.',
      },
      {
        id: 'kiln-engine',
        name: 'Kiln Engine',
        pressure: 'Rotating denial rings open brief vent windows.',
        counterHint: 'Plan timing discipline around vent cycles.',
      },
    ],
  },
};

const PATH_CHALLENGES: PathChallengeDefinition[] = [
  {
    key: 'balanced',
    label: 'Ashwood Passage',
    description: 'Steady trail with tempo disruptions and heat pockets.',
    domain: 'ash-castle',
    boardPoolShift: 0,
    hpMultiplier: 1,
    objectiveHpMultiplier: 1,
    objectiveCountBonus: 0,
    unbreakableShareMultiplier: 1,
  },
  {
    key: 'swarm',
    label: 'Murmuration Trail',
    description: 'Aerial density with evasive orb pressure.',
    domain: 'crow-spire',
    boardPoolShift: 8,
    hpMultiplier: 0.95,
    objectiveHpMultiplier: 1,
    objectiveCountBonus: 1,
    unbreakableShareMultiplier: 1.08,
  },
  {
    key: 'fortified',
    label: 'Bramble Bastion',
    description: 'Armored lanes with heavy objective durability.',
    domain: 'thorn-keep',
    boardPoolShift: 12,
    hpMultiplier: 1.22,
    objectiveHpMultiplier: 1.35,
    objectiveCountBonus: 0,
    unbreakableShareMultiplier: 1.25,
  },
  {
    key: 'gauntlet',
    label: 'Fen Gauntlet',
    description: 'Attrition-heavy marsh with oppressive control.',
    domain: 'black-bog',
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

const PATH_BALANCED_COLOR_SEQUENCE: CoreVariant[] = ['yellow', 'green', 'blue'];

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

export function getPathChallengeDefinition(challenge: PathChallengeKey): PathChallengeDefinition {
  return PATH_CHALLENGE_BY_KEY[challenge] ?? PATH_CHALLENGE_BY_KEY.balanced;
}

export function getDeepwoodDomainDefinition(domain: DeepwoodDomainKey): DeepwoodDomainDefinition {
  return DEEPWOOD_DOMAINS[domain];
}

export function toDeepwoodDomainKey(value: unknown): DeepwoodDomainKey | null {
  if (
    value === 'black-bog' ||
    value === 'crow-spire' ||
    value === 'thorn-keep' ||
    value === 'ash-castle'
  ) {
    return value;
  }
  return null;
}

export function getPathNodePrimaryCoreVariant(seed: number, level: number, lane: number): CoreVariant {
  const colorIndex = hashStringToUint32(`${seed}|${level}|${lane}|core-variant`) % CORE_VARIANTS.length;
  return CORE_VARIANTS[colorIndex] ?? 'yellow';
}

function getBalancedPathCoreVariant(seed: number, level: number): CoreVariant {
  const offset = hashStringToUint32(`${seed}|balanced-color-offset`) % PATH_BALANCED_COLOR_SEQUENCE.length;
  const colorIndex = (Math.max(1, level) - 1 + offset) % PATH_BALANCED_COLOR_SEQUENCE.length;
  return PATH_BALANCED_COLOR_SEQUENCE[colorIndex] ?? 'yellow';
}

function getOverloadPathDominantVariant(seed: number, lane: number): CoreVariant {
  if (lane < 0) {
    return 'yellow';
  }
  if (lane > 0) {
    return hashStringToUint32(`${seed}|right-overload-color`) % 2 === 0 ? 'blue' : 'green';
  }
  return getBalancedPathCoreVariant(seed, 1);
}

function getOverloadPathCoreVariant(seed: number, lane: number, level: number): CoreVariant {
  const dominantVariant = getOverloadPathDominantVariant(seed, lane);
  const shouldInjectOffColor = hashStringToUint32(`${seed}|${level}|${lane}|overload-off-color`) % 4 === 0;
  if (!shouldInjectOffColor) {
    return dominantVariant;
  }
  const offColors = CORE_VARIANTS.filter((variant) => variant !== dominantVariant);
  const offColorIndex = hashStringToUint32(`${seed}|${level}|${lane}|off-color-index`) % offColors.length;
  return offColors[offColorIndex] ?? dominantVariant;
}

function getPathChallengeForBranch(mode: 'balanced' | 'overload', overloadVariant: CoreVariant): PathChallengeKey {
  if (mode === 'balanced') {
    return 'balanced';
  }
  if (overloadVariant === 'yellow') {
    return 'swarm';
  }
  if (overloadVariant === 'green') {
    return 'fortified';
  }
  return 'gauntlet';
}

export function isWardenLevel(level: number): boolean {
  return level > 0 && level % PATH_WARDEN_INTERVAL_LEVELS === 0;
}

function isPathChoiceLevel(level: number): boolean {
  if (isWardenLevel(level)) {
    return false;
  }
  const segmentStartLevel =
    Math.floor((Math.max(1, level) - 1) / PATH_WARDEN_INTERVAL_LEVELS) * PATH_WARDEN_INTERVAL_LEVELS + 1;
  const rowWithinSegment = level - segmentStartLevel + 1;
  const rowWithinSection = ((Math.max(1, rowWithinSegment) - 1) % 5) + 1;
  return rowWithinSection === 2 || rowWithinSection === 4;
}

function getPathChildBlueprints(
  run: RoguePathRunState,
  parentNode: PathNodeState
): Array<{ lane: number; mode: 'balanced' | 'overload' }> {
  const level = parentNode.level + 1;
  if (level > run.maxLevels) {
    return [];
  }
  if (isWardenLevel(level)) {
    return [{ lane: 0, mode: 'balanced' }];
  }
  if (!isPathChoiceLevel(level)) {
    if (parentNode.lane === 0) {
      return [{ lane: 0, mode: 'balanced' }];
    }
    return [{ lane: parentNode.lane, mode: 'overload' }];
  }
  if (parentNode.lane < 0) {
    return [
      { lane: -1, mode: 'overload' },
      { lane: 0, mode: 'balanced' },
    ];
  }
  if (parentNode.lane > 0) {
    return [
      { lane: 0, mode: 'balanced' },
      { lane: 1, mode: 'overload' },
    ];
  }
  return [
    { lane: -1, mode: 'overload' },
    { lane: 1, mode: 'overload' },
  ];
}

export function normalizePathLaneForLevel(rawLane: number, level: number, seed: number, parentId: string | null): number {
  if (isWardenLevel(level)) {
    return 0;
  }
  const clampedLane = clampPathLane(rawLane);
  if (!Number.isFinite(clampedLane)) {
    const laneRoll = hashStringToUint32(`${seed}|${level}|${parentId ?? 'root'}|lane-fallback`) % 3;
    return laneRoll === 0 ? -1 : laneRoll === 1 ? 0 : 1;
  }
  if (clampedLane < 0) {
    return -1;
  }
  if (clampedLane > 0) {
    return 1;
  }
  return 0;
}

function hasDefeatedWardenEncounter(run: RoguePathRunState, level: number, wardenId: string): boolean {
  const encounterKey = makeWardenEncounterKey(level, wardenId);
  if (run.wardensDefeated.includes(encounterKey)) {
    return true;
  }
  return run.wardensDefeated.includes(wardenId) && level < run.level;
}

export function getFirstWardenTrigger(run: RoguePathRunState, clearedLevel: number): DeepwoodWardenDefinition | null {
  const trigger = WARDEN_TRIGGERS.find((candidate) => candidate.level === clearedLevel);
  if (!trigger) {
    return null;
  }
  const domain = getDeepwoodDomainDefinition(trigger.domain);
  const warden = domain.wardens[trigger.wardenIndex];
  if (!warden || hasDefeatedWardenEncounter(run, clearedLevel, warden.id)) {
    return null;
  }
  return warden;
}

export function getPathNodeWardenForecast(run: RoguePathRunState, node: PathNodeState): DeepwoodWardenDefinition | null {
  const trigger = WARDEN_TRIGGERS.find((candidate) => candidate.level === node.level);
  if (!trigger) {
    return null;
  }
  const domain = getDeepwoodDomainDefinition(trigger.domain);
  const warden = domain.wardens[trigger.wardenIndex];
  if (!warden || hasDefeatedWardenEncounter(run, node.level, warden.id)) {
    return null;
  }
  return warden;
}

export function makeWardenEncounterKey(level: number, wardenId: string): string {
  return `${Math.max(0, Math.floor(level))}:${wardenId}`;
}

function getBlankEncounterNumber(run: RoguePathRunState | null | undefined): 1 | 2 | 3 | 4 {
  if (!run) {
    return 1;
  }
  if (run.stage === 'warden' && run.activeWardenId === 'blank') {
    const encounterLevel = getCurrentPathNode(run).level;
    const blankTriggerLevels = WARDEN_TRIGGERS
      .filter((trigger) => {
        const domain = getDeepwoodDomainDefinition(trigger.domain);
        const warden = domain.wardens[trigger.wardenIndex];
        return warden?.id === 'blank';
      })
      .map((trigger) => trigger.level)
      .sort((left, right) => left - right);
    const encounterIndex = blankTriggerLevels.findIndex((level) => level === encounterLevel);
    if (encounterIndex >= 0) {
      return Math.min(4, encounterIndex + 1) as 1 | 2 | 3 | 4;
    }
  }
  const defeatedBlankCount = run.wardensDefeated.reduce((count, key) => {
    if (key === 'blank' || key.endsWith(':blank')) {
      return count + 1;
    }
    return count;
  }, 0);
  if (defeatedBlankCount >= 3) {
    return 4;
  }
  if (defeatedBlankCount === 2) {
    return 3;
  }
  if (defeatedBlankCount === 1) {
    return 2;
  }
  return 1;
}

export function getBlankEncounterProfile(run: RoguePathRunState | null | undefined): BlankEncounterProfile {
  const encounterNumber = getBlankEncounterNumber(run);
  if (encounterNumber === 1) {
    return {
      encounterNumber,
      hpPerEye: 200,
      pathSpeedAtFullHp: 1,
      pathSpeedAtLowHp: 1.35,
      tearRespawnMinAtFullHp: 4,
      tearRespawnMaxAtFullHp: 5,
      tearRespawnMinAtLowHp: 3,
      tearRespawnMaxAtLowHp: 4,
      tearDetachAtSec: 3,
      tearFallDurationAtFullHp: 3,
      tearFallDurationAtLowHp: 1.5,
      dualEyes: false,
      eyeSpacingPx: 0,
    };
  }
  if (encounterNumber === 2) {
    return {
      encounterNumber,
      hpPerEye: 400,
      pathSpeedAtFullHp: 1.8,
      pathSpeedAtLowHp: 3.8,
      tearRespawnMinAtFullHp: 4,
      tearRespawnMaxAtFullHp: 5,
      tearRespawnMinAtLowHp: 2,
      tearRespawnMaxAtLowHp: 3,
      tearDetachAtSec: 3,
      tearFallDurationAtFullHp: 2.6,
      tearFallDurationAtLowHp: 1.1,
      dualEyes: false,
      eyeSpacingPx: 0,
    };
  }
  if (encounterNumber === 3) {
    return {
      encounterNumber,
      hpPerEye: 550,
      pathSpeedAtFullHp: 1.05,
      pathSpeedAtLowHp: 2.1,
      tearRespawnMinAtFullHp: 4,
      tearRespawnMaxAtFullHp: 6,
      tearRespawnMinAtLowHp: 3,
      tearRespawnMaxAtLowHp: 4,
      tearDetachAtSec: 3,
      tearFallDurationAtFullHp: 3.4,
      tearFallDurationAtLowHp: 1.5,
      dualEyes: true,
      eyeSpacingPx: 108,
    };
  }
  return {
    encounterNumber,
    hpPerEye: 750,
    pathSpeedAtFullHp: 2.1,
    pathSpeedAtLowHp: 4.3,
    tearRespawnMinAtFullHp: 4,
    tearRespawnMaxAtFullHp: 5,
    tearRespawnMinAtLowHp: 2,
    tearRespawnMaxAtLowHp: 3,
    tearDetachAtSec: 2,
    tearFallDurationAtFullHp: 2.6,
    tearFallDurationAtLowHp: 1.1,
    dualEyes: true,
    eyeSpacingPx: 108,
  };
}

export function makePathNodeId(
  seed: number,
  level: number,
  lane: number,
  _parentId: string | null,
  challenge: PathChallengeKey
): string {
  const token = hashStringToUint32(`${seed}|${level}|${lane}|${challenge}`)
    .toString(16)
    .padStart(8, '0');
  return `path-${level}-${lane}-${challenge}-${token.slice(0, 8)}`;
}

export function createRootPathNode(seed: number): PathNodeState {
  return {
    id: makePathNodeId(seed, 0, 0, null, 'balanced'),
    parentId: null,
    level: 0,
    lane: 0,
    challenge: 'balanced',
    primaryCoreVariant: getPathNodePrimaryCoreVariant(seed, 0, 0),
  };
}

export function ensureRunPathState(run: RoguePathRunState): void {
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
    const parentId = typeof node.parentId === 'string' ? node.parentId : null;
    const rawLane = Math.round(typeof node.lane === 'number' ? node.lane : 0);
    const lane = normalizePathLaneForLevel(rawLane, nodeLevel, run.seed, parentId);
    const challenge = toPathChallengeKey(node.challenge);
    const primaryCoreVariant =
      node.primaryCoreVariant === 'yellow' || node.primaryCoreVariant === 'blue' || node.primaryCoreVariant === 'green'
        ? node.primaryCoreVariant
        : getPathNodePrimaryCoreVariant(run.seed, nodeLevel, lane);
    const id =
      typeof node.id === 'string' && node.id.length > 0
        ? node.id
        : makePathNodeId(run.seed, nodeLevel, lane, parentId, challenge);
    sanitizedByLevel[nodeLevel] = {
      id,
      parentId,
      level: nodeLevel,
      lane,
      challenge,
      primaryCoreVariant,
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
    const lane = normalizePathLaneForLevel(parentNode.lane, level, run.seed, parentNode.id);
    run.pathNodesByLevel[level] = {
      id: makePathNodeId(run.seed, level, lane, parentNode.id, 'balanced'),
      parentId: parentNode.id,
      level,
      lane,
      challenge: 'balanced',
      primaryCoreVariant: getPathNodePrimaryCoreVariant(run.seed, level, lane),
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

export function getCurrentPathNode(run: RoguePathRunState): PathNodeState {
  const nodeById = Object.values(run.pathNodesByLevel ?? {}).find((item) => item.id === run.pathCurrentNodeId);
  if (nodeById) {
    return nodeById;
  }
  const inferredLevel = run.stage === 'board' ? Math.max(1, run.level) : Math.max(0, run.level - 1);
  return run.pathNodesByLevel?.[inferredLevel] ?? run.pathNodesByLevel?.[1] ?? run.pathNodesByLevel?.[0] ?? createRootPathNode(run.seed);
}

export function derivePathChildren(run: RoguePathRunState, parentNode: PathNodeState): PathNodeState[] {
  const level = parentNode.level + 1;
  if (level > run.maxLevels) {
    return [];
  }
  return getPathChildBlueprints(run, parentNode)
    .map(({ lane, mode }) => {
      const overloadVariant = getOverloadPathDominantVariant(run.seed, lane);
      const primaryCoreVariant =
        mode === 'balanced'
          ? getBalancedPathCoreVariant(run.seed, level)
          : getOverloadPathCoreVariant(run.seed, lane, level);
      const challenge = getPathChallengeForBranch(mode, overloadVariant);
      return {
        id: makePathNodeId(run.seed, level, lane, parentNode.id, challenge),
        parentId: parentNode.id,
        level,
        lane,
        challenge,
        primaryCoreVariant,
      };
    })
    .sort((left, right) => left.lane - right.lane);
}

export function buildPathPreview(run: RoguePathRunState, shouldGateBoardChoices: boolean): PathPreview {
  const anchorNode = getCurrentPathNode(run);
  const rootNode = run.pathNodesByLevel?.[0] ?? createRootPathNode(run.seed);
  const startLevel = 0;
  const endLevel = run.maxLevels;
  const nodesById = new Map<string, PathPreviewNode>();
  const edges: PathPreviewEdge[] = [];
  const playableNodeIds = new Set<string>(
    run.stage === 'hub' && !shouldGateBoardChoices && run.level <= run.maxLevels
      ? derivePathChildren(run, anchorNode).map((node) => node.id)
      : []
  );

  const getNodeRelation = (node: PathNodeState): PathPreviewNode['relation'] => {
    if (node.id === anchorNode.id) {
      return 'current';
    }
    if (node.level <= anchorNode.level) {
      return 'past';
    }
    return 'future';
  };

  const addNode = (node: PathNodeState, relation: PathPreviewNode['relation']) => {
    const selectedNodeAtLevel = run.pathNodesByLevel[node.level];
    const isSelected = selectedNodeAtLevel?.id === node.id;
    const isPlayable = playableNodeIds.has(node.id);
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

  addNode(rootNode, getNodeRelation(rootNode));
  addNode(anchorNode, 'current');

  let frontier: PathNodeState[] = [rootNode];
  for (let level = 1; level <= endLevel; level += 1) {
    const generated: PathNodeState[] = [];
    if (isWardenLevel(level) && frontier.length > 0) {
      const collapseParent = [...frontier].sort((left, right) => left.id.localeCompare(right.id))[0];
      const collapseChild = collapseParent ? derivePathChildren(run, collapseParent)[0] : null;
      if (collapseChild) {
        generated.push(collapseChild);
        addNode(collapseChild, getNodeRelation(collapseChild));
        for (const parentNode of frontier) {
          edges.push({ fromId: parentNode.id, toId: collapseChild.id });
        }
      }
    } else {
      for (const parentNode of frontier) {
        const children = derivePathChildren(run, parentNode);
        for (const child of children) {
          generated.push(child);
          addNode(child, getNodeRelation(child));
          edges.push({ fromId: parentNode.id, toId: child.id });
        }
      }
      const generatedById = new Map<string, PathNodeState>();
      for (const node of generated) {
        if (!generatedById.has(node.id)) {
          generatedById.set(node.id, node);
        }
      }
      frontier = Array.from(generatedById.values());
      continue;
    }

    const selectedNode = run.pathNodesByLevel[level];
    if (selectedNode && selectedNode.parentId && nodesById.has(selectedNode.parentId)) {
      addNode(selectedNode, getNodeRelation(selectedNode));
      const hasExistingEdge = edges.some(
        (edge) => edge.fromId === selectedNode.parentId && edge.toId === selectedNode.id
      );
      if (!hasExistingEdge) {
        edges.push({ fromId: selectedNode.parentId, toId: selectedNode.id });
      }
    }
    const generatedById = new Map<string, PathNodeState>();
    for (const node of generated) {
      if (!generatedById.has(node.id)) {
        generatedById.set(node.id, node);
      }
    }
    frontier = Array.from(generatedById.values());
  }

  const connectedNodeIds = new Set<string>([rootNode.id]);
  const queue: string[] = [rootNode.id];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }
    for (const edge of edges) {
      if (edge.fromId !== currentId || connectedNodeIds.has(edge.toId)) {
        continue;
      }
      connectedNodeIds.add(edge.toId);
      queue.push(edge.toId);
    }
  }

  const nodes = Array.from(nodesById.values())
    .filter((node) => connectedNodeIds.has(node.id))
    .filter((node) => node.level >= startLevel && node.level <= endLevel)
    .sort((left, right) => {
      if (left.level !== right.level) {
        return right.level - left.level;
      }
      return left.lane - right.lane;
    });

  const connectedEdges = edges.filter(
    (edge) => connectedNodeIds.has(edge.fromId) && connectedNodeIds.has(edge.toId)
  );

  return {
    startLevel,
    endLevel,
    minLane: -PATH_MAX_LANE_ABS,
    maxLane: PATH_MAX_LANE_ABS,
    nodes,
    edges: connectedEdges,
  };
}

export function buildPathFocusSets(pathPreview: PathPreview, focusNodeId: string): PathFocusSets {
  const nodeIds = new Set<string>([focusNodeId]);
  const edgeKeys = new Set<string>();
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of pathPreview.edges) {
    const edgeKey = `${edge.fromId}->${edge.toId}`;
    const out = outgoing.get(edge.fromId) ?? [];
    out.push(edge.toId);
    outgoing.set(edge.fromId, out);
    const inc = incoming.get(edge.toId) ?? [];
    inc.push(edge.fromId);
    incoming.set(edge.toId, inc);
    if (edge.fromId === focusNodeId || edge.toId === focusNodeId) {
      edgeKeys.add(edgeKey);
    }
  }

  const descendantQueue: string[] = [focusNodeId];
  while (descendantQueue.length > 0) {
    const fromId = descendantQueue.shift();
    if (!fromId) {
      continue;
    }
    for (const toId of outgoing.get(fromId) ?? []) {
      const edgeKey = `${fromId}->${toId}`;
      edgeKeys.add(edgeKey);
      if (!nodeIds.has(toId)) {
        nodeIds.add(toId);
        descendantQueue.push(toId);
      }
    }
  }

  const ancestorQueue: string[] = [focusNodeId];
  while (ancestorQueue.length > 0) {
    const toId = ancestorQueue.shift();
    if (!toId) {
      continue;
    }
    for (const fromId of incoming.get(toId) ?? []) {
      const edgeKey = `${fromId}->${toId}`;
      edgeKeys.add(edgeKey);
      if (!nodeIds.has(fromId)) {
        nodeIds.add(fromId);
        ancestorQueue.push(fromId);
      }
    }
  }

  return {
    nodeIds,
    edgeKeys,
  };
}
