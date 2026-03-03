import type { Card, HandTotal, Rank } from './types.js';

export function calculateHandTotal(cards: Card[]): HandTotal {
  if (cards.length === 0) {
    return { hard: 0, soft: 0, isSoft: false, total: 0, isPair: false, pairRank: null, isBusted: false, isBlackjack: false };
  }

  let aceCount = 0;
  let total = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aceCount++;
      total += 11;
    } else {
      total += card.value;
    }
  }

  // Soft total is with aces as 11 (as many as possible)
  const softTotal = total;

  // Hard total: reduce aces from 11 to 1 as needed
  let hardAdjustments = 0;
  while (total > 21 && hardAdjustments < aceCount) {
    total -= 10;
    hardAdjustments++;
  }

  const hard = softTotal - aceCount * 10; // All aces as 1
  const soft = aceCount > 0 ? hard + 10 : hard; // One ace as 11 if possible
  const isSoft = aceCount > 0 && soft <= 21;
  const bestTotal = isSoft ? soft : hard;

  const isPair = cards.length === 2 && cards[0].value === cards[1].value;
  const pairRank: Rank | null = isPair ? cards[0].rank : null;

  const isBlackjack = cards.length === 2 && bestTotal === 21;

  return {
    hard,
    soft,
    isSoft,
    total: bestTotal,
    isPair,
    pairRank,
    isBusted: bestTotal > 21,
    isBlackjack,
  };
}
