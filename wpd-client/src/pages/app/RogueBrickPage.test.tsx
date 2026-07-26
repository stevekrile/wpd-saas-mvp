import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultRogueBrickProfile } from '../../features/rogueBrick/rogueBrickSaveModel';
import RogueBrickPage from './RogueBrickPage';

const { mockLoad, mockSave, mockClear } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockSave: vi.fn(),
  mockClear: vi.fn(),
}));

vi.mock('../../features/rogueBrick/rogueBrickPersistence', () => ({
  browserRogueBrickPersistence: {
    load: mockLoad,
    save: mockSave,
    clear: mockClear,
  },
}));

describe('RogueBrickPage run lifecycle UI', () => {
  beforeEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
    mockClear.mockReset();
    mockSave.mockResolvedValue({ progressJson: '{}', updatedAtEpochMs: Date.now() });
    mockClear.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows abandon confirmation for an active run and clears the run on confirm', async () => {
    mockLoad.mockResolvedValue(null);
    const user = userEvent.setup();
    const { container } = render(<RogueBrickPage />);

    await screen.findByText("Lexor's Gift");
    let abandonButton = screen.getByRole('button', { name: /abandon current run/i }) as HTMLButtonElement;
    expect(abandonButton.disabled).toBe(true);

    await waitFor(() => {
      const cards = container.querySelectorAll('.rogue-choice-grid-spoils button');
      expect(cards.length).toBeGreaterThan(0);
    });
    const startingPowerCard = container.querySelector('.rogue-choice-grid-spoils button') as HTMLButtonElement | null;
    expect(startingPowerCard).not.toBeNull();
    await user.click(startingPowerCard!);
    await screen.findByRole('dialog', { name: /confirm starting run technique/i });
    await user.click(screen.getByRole('button', { name: /^start run$/i }));

    await waitFor(() => {
      abandonButton = screen.getByRole('button', { name: /abandon current run/i }) as HTMLButtonElement;
      expect(abandonButton.disabled).toBe(false);
    });

    await user.click(abandonButton);
    const abandonDialog = await screen.findByRole('dialog', { name: /confirm abandon run/i });
    await user.click(within(abandonDialog).getByRole('button', { name: /^abandon run$/i }));

    await waitFor(() => {
      abandonButton = screen.getByRole('button', { name: /abandon current run/i }) as HTMLButtonElement;
      expect(abandonButton.disabled).toBe(true);
      expect(screen.queryByRole('dialog', { name: /confirm abandon run/i })).toBeNull();
    });
  });

  it('renders defeat summary from last run and dismisses it', async () => {
    const profile = createDefaultRogueBrickProfile();
    profile.metaCurrency = 64;
    profile.totalRuns = 3;
    profile.bestLevel = 8;
    profile.lastRunSummary = {
      victory: false,
      boardsCleared: 5,
      levelReached: 6,
      metaEarned: 42,
      completedAt: 123456,
      defeatReason: 'The line collapsed',
      wardensDefeated: 1,
      manaBanked: 12,
    };
    mockLoad.mockResolvedValue({
      progressJson: JSON.stringify(profile),
      updatedAtEpochMs: Date.now(),
    });

    const user = userEvent.setup();
    render(<RogueBrickPage />);

    await screen.findByRole('dialog', { name: /run ended in defeat/i });
    expect(screen.getByText(/The line collapsed\./i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /run ended in defeat/i })).toBeNull();
    });
  });
});
