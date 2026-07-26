import { describe, expect, it } from 'vitest';

import {
  buildPathPreview,
  createRootPathNode,
  derivePathChildren,
  ensureRunPathState,
  getBlankEncounterProfile,
  getCurrentPathNode,
  type RoguePathRunState,
} from './rogueBrickPathing';

function makeRunState(partial?: Partial<RoguePathRunState>): RoguePathRunState {
  return {
    seed: 42424242,
    stage: 'hub',
    level: 1,
    maxLevels: 21,
    pathCurrentNodeId: '',
    pathNodesByLevel: {},
    activeWardenId: null,
    wardensDefeated: [],
    ...partial,
  };
}

describe('pathing selection consistency', () => {
  it('selecting a playable child updates selected level node and current-node pointer', () => {
    const run = makeRunState();
    ensureRunPathState(run);
    const currentNode = getCurrentPathNode(run);
    const playableChildren = derivePathChildren(run, currentNode);
    const selectedNode = playableChildren[0];

    expect(selectedNode).toBeDefined();

    run.pathNodesByLevel[run.level] = selectedNode;
    run.pathCurrentNodeId = selectedNode.id;

    expect(run.pathNodesByLevel[run.level]?.id).toBe(selectedNode.id);
    expect(run.pathNodesByLevel[run.level]?.parentId).toBe(currentNode.id);
    expect(getCurrentPathNode(run).id).toBe(selectedNode.id);
  });

  describe('blank encounter hp tuning', () => {
    it('uses stronger baseline hp per encounter tier', () => {
      const encounterOne = getBlankEncounterProfile(makeRunState());
      const encounterTwo = getBlankEncounterProfile(makeRunState({ wardensDefeated: ['7:blank'] }));
      const encounterThree = getBlankEncounterProfile(makeRunState({ wardensDefeated: ['7:blank', '14:blank'] }));
      const encounterFour = getBlankEncounterProfile(makeRunState({ wardensDefeated: ['7:blank', '14:blank', '21:blank'] }));

      expect(encounterOne.hpPerEye).toBe(320);
      expect(encounterTwo.hpPerEye).toBe(640);
      expect(encounterThree.hpPerEye).toBe(980);
      expect(encounterFour.hpPerEye).toBe(1320);
    });

    it('adds hp pressure as ball and damage stats rise', () => {
      const baseline = getBlankEncounterProfile(makeRunState({ wardensDefeated: ['7:blank'] }));
      const scaled = getBlankEncounterProfile(
        makeRunState({
          wardensDefeated: ['7:blank'],
          ballCount: 9,
          damage: 4,
        })
      );

      expect(scaled.hpPerEye).toBeGreaterThan(baseline.hpPerEye);
    });

    it('caps momentum bonus so hp does not run away', () => {
      const capped = getBlankEncounterProfile(
        makeRunState({
          wardensDefeated: ['7:blank', '14:blank', '21:blank'],
          ballCount: 99,
          damage: 99,
        })
      );

      expect(capped.hpPerEye).toBe(1840);
    });
  });

  it('path preview marks exactly the current children as playable when board choices are available', () => {
    const run = makeRunState();
    const root = createRootPathNode(run.seed);
    run.pathNodesByLevel[0] = root;
    run.pathCurrentNodeId = root.id;
    ensureRunPathState(run);

    const currentNode = getCurrentPathNode(run);
    const expectedPlayableIds = new Set(derivePathChildren(run, currentNode).map((node) => node.id));
    const preview = buildPathPreview(run, false);
    const actualPlayableIds = new Set(preview.nodes.filter((node) => node.isPlayable).map((node) => node.id));

    expect(actualPlayableIds.size).toBe(expectedPlayableIds.size);
    for (const nodeId of expectedPlayableIds) {
      expect(actualPlayableIds.has(nodeId)).toBe(true);
    }
  });
});
