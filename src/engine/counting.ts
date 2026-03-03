import type { Card, Rank, CardValue } from './types.js';

/** Hi-Lo count values: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1 */
const HI_LO_VALUES: Record<Rank, number> = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1,
};

export function getCardCountValue(rank: Rank): number {
  return HI_LO_VALUES[rank];
}

export function calculateDecksRemaining(cardsSeen: number, totalDecks: number): number {
  const totalCards = totalDecks * 52;
  const remaining = totalCards - cardsSeen;
  return remaining / 52;
}

export function calculateTrueCount(runningCount: number, cardsSeen: number, totalDecks: number): number {
  const decksRemaining = calculateDecksRemaining(cardsSeen, totalDecks);
  if (decksRemaining <= 0) return 0;
  return runningCount / decksRemaining;
}

/** Map a rank to its numeric card value (A=11, face=10) */
export function rankToValue(rank: Rank): CardValue {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return parseInt(rank, 10) as CardValue;
}

export function createCard(rank: Rank): Card {
  return { rank, value: rankToValue(rank) };
}
