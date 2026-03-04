import type { Card, GameRules, HandTotal, ResolvedAction, StrategyAction, TableAction, IndexPlay } from './types.js';
import { hardTable as s17Hard, softTable as s17Soft, pairsTable as s17Pairs } from './tables/basicStrategyS17.js';
import { hardTable as h17Hard, softTable as h17Soft, pairsTable as h17Pairs } from './tables/basicStrategyH17.js';
import { illustrious18, fab4 } from './tables/indexPlays.js';
import { calculateHandTotal } from './hand.js';

function resolveConditionalAction(action: TableAction, rules: GameRules): StrategyAction {
  switch (action) {
    case 'Dh': return rules.doubleAnyTwo ? 'D' : 'H';
    case 'Ds': return rules.doubleAnyTwo ? 'D' : 'S';
    case 'Rh': return rules.lateSurrender ? 'R' : 'H';
    case 'Rs': return rules.lateSurrender ? 'R' : 'S';
    case 'Rp': return rules.lateSurrender ? 'R' : 'P';
    case 'Ph': return rules.doubleAfterSplit ? 'P' : 'H';
    default: return action;
  }
}

function getDealerUpcardValue(card: Card): number {
  // Ace = 11 for table lookup
  return card.rank === 'A' ? 11 : card.value;
}

function checkIndexDeviations(
  hand: HandTotal,
  dealerUpcardValue: number,
  trueCount: number,
  rules: GameRules,
): { play: IndexPlay; action: StrategyAction } | null {
  const allPlays = rules.lateSurrender ? [...illustrious18, ...fab4] : illustrious18;

  for (const play of allPlays) {
    // Skip insurance (handled separately)
    if (play.name === 'Insurance') continue;

    // Match hand type
    if (play.dealerUpcard !== dealerUpcardValue) continue;

    if (play.handType === 'pair') {
      if (!hand.isPair) continue;
      if (hand.total !== play.playerTotal) continue;
    } else if (play.handType === 'soft') {
      if (!hand.isSoft) continue;
      if (hand.soft !== play.playerTotal) continue;
    } else {
      // Hard hand — match on hard total (or total if not soft)
      const matchTotal = hand.isSoft ? hand.soft : hand.hard;
      if (matchTotal !== play.playerTotal) continue;
      // For hard-type deviations, skip if hand is soft (different strategy)
      if (hand.isSoft && hand.soft <= 21) continue;
    }

    // Check threshold direction
    // Positive threshold: deviate when TC >= threshold (we're doing better than expected)
    // Negative threshold: deviate when TC <= threshold (deck is poor)
    // Zero threshold: special — for 16v10 (TC >= 0 means stand), for 12v4 (TC <= 0 means hit)
    if (play.deviationAction !== play.basicAction) {
      // Determine direction: if deviation changes from basic, check which way
      // Plays where basic is Hit/Surrender and deviation is Stand/Double → high count helps → TC >= threshold
      // Plays where basic is Stand and deviation is Hit → low count hurts → TC <= threshold (threshold is negative)
      const isHighCountDeviation = play.threshold >= 0 && play.deviationAction !== 'H';
      const isLowCountDeviation = play.threshold <= 0 && play.deviationAction === 'H';

      if (isHighCountDeviation && trueCount >= play.threshold) {
        return { play, action: play.deviationAction };
      }
      if (isLowCountDeviation && trueCount <= play.threshold) {
        return { play, action: play.deviationAction };
      }
    }
  }

  return null;
}

function lookupBasicStrategy(
  hand: HandTotal,
  dealerUpcardValue: number,
  rules: GameRules,
): { rawAction: TableAction; resolved: StrategyAction } {
  const tables = rules.dealerStandsOnSoft17
    ? { hard: s17Hard, soft: s17Soft, pairs: s17Pairs }
    : { hard: h17Hard, soft: h17Soft, pairs: h17Pairs };

  let rawAction: TableAction;

  // Check pairs first
  if (hand.isPair && hand.pairRank) {
    const pairValue = hand.pairRank === 'A' ? 11 :
      (['J', 'Q', 'K', '10'] as const).includes(hand.pairRank as '10') ? 10 :
      parseInt(hand.pairRank, 10);
    rawAction = tables.pairs[pairValue]?.[dealerUpcardValue] ?? 'H';
  }
  // Check soft hands
  else if (hand.isSoft && hand.soft >= 13 && hand.soft <= 21) {
    rawAction = tables.soft[hand.soft]?.[dealerUpcardValue] ?? 'H';
  }
  // Hard hands
  else {
    const total = Math.min(hand.total, 21);
    const clampedTotal = Math.max(total, 5);
    rawAction = tables.hard[clampedTotal]?.[dealerUpcardValue] ?? 'H';
  }

  return { rawAction, resolved: resolveConditionalAction(rawAction, rules) };
}

export function getStrategyAdvice(
  playerCards: Card[],
  dealerUpcard: Card,
  trueCount: number,
  rules: GameRules,
): ResolvedAction {
  const hand = calculateHandTotal(playerCards);
  const dealerValue = getDealerUpcardValue(dealerUpcard);

  // Check index deviations first
  const deviation = checkIndexDeviations(hand, dealerValue, trueCount, rules);
  if (deviation) {
    const result: ResolvedAction = {
      action: deviation.action,
      rawAction: deviation.action,
      isDeviation: true,
      deviationName: deviation.play.name,
    };
    applyAvailabilityConstraints(result, playerCards.length);
    return result;
  }

  // Fall back to basic strategy
  const { rawAction, resolved } = lookupBasicStrategy(hand, dealerValue, rules);
  const result: ResolvedAction = {
    action: resolved,
    rawAction,
    isDeviation: false,
    deviationName: null,
  };
  applyAvailabilityConstraints(result, playerCards.length);
  return result;
}

/** When double/split/surrender aren't available, fall back to the next best action. */
function applyAvailabilityConstraints(result: ResolvedAction, numCards: number): void {
  if (numCards <= 2) return;
  // Can't double with 3+ cards: Dh→H, Ds→S
  if (result.action === 'D') {
    result.action = (result.rawAction === 'Ds') ? 'S' : 'H';
  }
  // Can't split with 3+ cards
  if (result.action === 'P') {
    result.action = 'H';
  }
  // Can't surrender after hitting
  if (result.action === 'R') {
    result.action = 'H';
  }
}

export function shouldTakeInsurance(trueCount: number): boolean {
  return trueCount >= 3;
}

export { resolveConditionalAction, lookupBasicStrategy };
