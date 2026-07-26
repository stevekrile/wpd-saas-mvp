import { describe, expect, it } from 'vitest';

import {
  buildPathPreview,
  createRootPathNode,
  derivePathChildren,
  ensureRunPathState,
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
