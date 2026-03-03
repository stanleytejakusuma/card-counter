import { describe, it, expect } from 'vitest';
import { getStrategyAdvice, shouldTakeInsurance } from '../strategy.js';
import { createCard } from '../counting.js';
import type { GameRules, Card } from '../types.js';

const defaultRules: GameRules = {
  decks: 8,
  dealerStandsOnSoft17: true,
  doubleAfterSplit: true,
  lateSurrender: true,
  doubleAnyTwo: true,
};

const noSurrenderRules: GameRules = {
  ...defaultRules,
  lateSurrender: false,
};

function cards(...ranks: string[]): Card[] {
  return ranks.map(r => createCard(r as import('../types.js').Rank));
}

describe('basic strategy - hard hands (S17)', () => {
  // TC=0 means no deviations apply for most hands
  const tc = -0.5; // Slightly negative to avoid 0-threshold deviations

  it('hard 16 vs 10: surrender (with late surrender)', () => {
    const result = getStrategyAdvice(cards('10', '6'), createCard('10'), tc, defaultRules);
    expect(result.action).toBe('R');
  });

  it('hard 16 vs 10: hit (without late surrender)', () => {
    const result = getStrategyAdvice(cards('10', '6'), createCard('10'), tc, noSurrenderRules);
    expect(result.action).toBe('H');
  });

  it('hard 16 vs 7: hit', () => {
    const result = getStrategyAdvice(cards('10', '6'), createCard('7'), tc, defaultRules);
    expect(result.action).toBe('H');
  });

  it('hard 12 vs 4: stand', () => {
    // Use TC=0.5 to avoid the 12v4 index deviation (Hit at TC<=0)
    const result = getStrategyAdvice(cards('10', '2'), createCard('4'), 0.5, defaultRules);
    expect(result.action).toBe('S');
  });

  it('hard 12 vs 3: hit', () => {
    const result = getStrategyAdvice(cards('10', '2'), createCard('3'), tc, defaultRules);
    expect(result.action).toBe('H');
  });

  it('hard 11 vs 10: double', () => {
    const result = getStrategyAdvice(cards('8', '3'), createCard('10'), tc, defaultRules);
    expect(result.action).toBe('D');
  });

  it('hard 10 vs 9: double', () => {
    const result = getStrategyAdvice(cards('6', '4'), createCard('9'), tc, defaultRules);
    expect(result.action).toBe('D');
  });

  it('hard 9 vs 3: double', () => {
    const result = getStrategyAdvice(cards('5', '4'), createCard('3'), tc, defaultRules);
    expect(result.action).toBe('D');
  });

  it('hard 9 vs 2: hit (basic, TC below deviation)', () => {
    const result = getStrategyAdvice(cards('5', '4'), createCard('2'), -1, defaultRules);
    expect(result.action).toBe('H');
  });

  it('hard 13 vs 6: stand', () => {
    const result = getStrategyAdvice(cards('10', '3'), createCard('6'), tc, defaultRules);
    expect(result.action).toBe('S');
  });

  it('hard 13 vs 7: hit', () => {
    const result = getStrategyAdvice(cards('10', '3'), createCard('7'), tc, defaultRules);
    expect(result.action).toBe('H');
  });

  it('hard 17 always stands', () => {
    for (let dealer = 2; dealer <= 11; dealer++) {
      const dealerRank = dealer === 10 ? '10' : dealer === 11 ? 'A' : String(dealer);
      const result = getStrategyAdvice(cards('10', '7'), createCard(dealerRank as import('../types.js').Rank), tc, defaultRules);
      expect(result.action).toBe('S');
    }
  });

  it('hard 8 always hits', () => {
    for (let dealer = 2; dealer <= 11; dealer++) {
      const dealerRank = dealer === 10 ? '10' : dealer === 11 ? 'A' : String(dealer);
      const result = getStrategyAdvice(cards('5', '3'), createCard(dealerRank as import('../types.js').Rank), tc, defaultRules);
      expect(result.action).toBe('H');
    }
  });
});

describe('basic strategy - soft hands (S17)', () => {
  const tc = -0.5;

  it('soft 18 vs 6: double (or stand)', () => {
    const result = getStrategyAdvice(cards('A', '7'), createCard('6'), tc, defaultRules);
    expect(result.action).toBe('D');
  });

  it('soft 18 vs 7: stand', () => {
    const result = getStrategyAdvice(cards('A', '7'), createCard('7'), tc, defaultRules);
    expect(result.action).toBe('S');
  });

  it('soft 18 vs 9: hit', () => {
    const result = getStrategyAdvice(cards('A', '7'), createCard('9'), tc, defaultRules);
    expect(result.action).toBe('H');
  });

  it('soft 17 vs 3: double', () => {
    const result = getStrategyAdvice(cards('A', '6'), createCard('3'), tc, defaultRules);
    expect(result.action).toBe('D');
  });

  it('soft 17 vs 2: hit', () => {
    const result = getStrategyAdvice(cards('A', '6'), createCard('2'), tc, defaultRules);
    expect(result.action).toBe('H');
  });

  it('soft 13 vs 5: double', () => {
    const result = getStrategyAdvice(cards('A', '2'), createCard('5'), tc, defaultRules);
    expect(result.action).toBe('D');
  });

  it('soft 13 vs 4: hit', () => {
    const result = getStrategyAdvice(cards('A', '2'), createCard('4'), tc, defaultRules);
    expect(result.action).toBe('H');
  });

  it('soft 19 always stands (except Ds vs 6)', () => {
    const result = getStrategyAdvice(cards('A', '8'), createCard('6'), tc, defaultRules);
    expect(result.action).toBe('D');
    const result2 = getStrategyAdvice(cards('A', '8'), createCard('7'), tc, defaultRules);
    expect(result2.action).toBe('S');
  });
});

describe('basic strategy - pairs (S17)', () => {
  const tc = -0.5;

  it('AA vs any: split', () => {
    const result = getStrategyAdvice(cards('A', 'A'), createCard('7'), tc, defaultRules);
    expect(result.action).toBe('P');
  });

  it('88 vs 10: split', () => {
    const result = getStrategyAdvice(cards('8', '8'), createCard('10'), tc, defaultRules);
    expect(result.action).toBe('P');
  });

  it('TT vs any: stand', () => {
    const result = getStrategyAdvice(cards('10', 'K'), createCard('6'), tc, defaultRules);
    expect(result.action).toBe('S');
  });

  it('99 vs 7: stand', () => {
    const result = getStrategyAdvice(cards('9', '9'), createCard('7'), tc, defaultRules);
    expect(result.action).toBe('S');
  });

  it('99 vs 8: split', () => {
    const result = getStrategyAdvice(cards('9', '9'), createCard('8'), tc, defaultRules);
    expect(result.action).toBe('P');
  });

  it('22 vs 7: split (DAS)', () => {
    const result = getStrategyAdvice(cards('2', '2'), createCard('7'), tc, defaultRules);
    expect(result.action).toBe('P');
  });

  it('22 vs 8: hit', () => {
    const result = getStrategyAdvice(cards('2', '2'), createCard('8'), tc, defaultRules);
    expect(result.action).toBe('H');
  });

  it('55 never splits — treated as hard 10', () => {
    const result = getStrategyAdvice(cards('5', '5'), createCard('5'), tc, defaultRules);
    expect(result.action).toBe('D');
  });
});

describe('Illustrious 18 deviations', () => {
  it('16v10: Stand at TC >= 0', () => {
    const result = getStrategyAdvice(cards('10', '6'), createCard('10'), 0, defaultRules);
    expect(result.action).toBe('S');
    expect(result.isDeviation).toBe(true);
    expect(result.deviationName).toBe('16v10');
  });

  it('16v10: Hit at TC < 0', () => {
    const result = getStrategyAdvice(cards('10', '6'), createCard('10'), -0.5, defaultRules);
    // With late surrender, basic says Rh → Surrender
    expect(result.action).toBe('R');
    expect(result.isDeviation).toBe(false);
  });

  it('15v10: Stand at TC >= +4', () => {
    const result = getStrategyAdvice(cards('10', '5'), createCard('10'), 4, defaultRules);
    expect(result.action).toBe('S');
    expect(result.isDeviation).toBe(true);
    expect(result.deviationName).toBe('15v10');
  });

  it('15v10: Hit at TC < +4', () => {
    const result = getStrategyAdvice(cards('10', '5'), createCard('10'), 3, defaultRules);
    // With surrender: Rh → R at TC 3
    expect(['H', 'R']).toContain(result.action);
  });

  it('12v3: Stand at TC >= +2', () => {
    const result = getStrategyAdvice(cards('10', '2'), createCard('3'), 2, defaultRules);
    expect(result.action).toBe('S');
    expect(result.isDeviation).toBe(true);
  });

  it('12v3: Hit at TC < +2', () => {
    const result = getStrategyAdvice(cards('10', '2'), createCard('3'), 1, defaultRules);
    expect(result.action).toBe('H');
    expect(result.isDeviation).toBe(false);
  });

  it('12v2: Stand at TC >= +3', () => {
    const result = getStrategyAdvice(cards('10', '2'), createCard('2'), 3, defaultRules);
    expect(result.action).toBe('S');
    expect(result.isDeviation).toBe(true);
  });

  it('11vA: Double at TC >= +1', () => {
    const result = getStrategyAdvice(cards('8', '3'), createCard('A'), 1, defaultRules);
    expect(result.action).toBe('D');
    expect(result.isDeviation).toBe(true);
  });

  it('9v2: Double at TC >= +1', () => {
    const result = getStrategyAdvice(cards('5', '4'), createCard('2'), 1, defaultRules);
    expect(result.action).toBe('D');
    expect(result.isDeviation).toBe(true);
  });

  it('10v10: Double at TC >= +4', () => {
    const result = getStrategyAdvice(cards('6', '4'), createCard('10'), 4, defaultRules);
    expect(result.action).toBe('D');
    expect(result.isDeviation).toBe(true);
  });

  it('10vA: Double at TC >= +4', () => {
    const result = getStrategyAdvice(cards('6', '4'), createCard('A'), 4, defaultRules);
    expect(result.action).toBe('D');
    expect(result.isDeviation).toBe(true);
  });

  it('9v7: Double at TC >= +3', () => {
    const result = getStrategyAdvice(cards('5', '4'), createCard('7'), 3, defaultRules);
    expect(result.action).toBe('D');
    expect(result.isDeviation).toBe(true);
  });

  it('16v9: Stand at TC >= +5', () => {
    const result = getStrategyAdvice(cards('10', '6'), createCard('9'), 5, defaultRules);
    expect(result.action).toBe('S');
    expect(result.isDeviation).toBe(true);
  });

  it('13v2: Hit at TC <= -1', () => {
    const result = getStrategyAdvice(cards('10', '3'), createCard('2'), -1, defaultRules);
    expect(result.action).toBe('H');
    expect(result.isDeviation).toBe(true);
  });

  it('12v4: Hit at TC <= 0 (negative)', () => {
    const result = getStrategyAdvice(cards('10', '2'), createCard('4'), -0.5, defaultRules);
    expect(result.action).toBe('H');
    expect(result.isDeviation).toBe(true);
  });

  it('12v5: Hit at TC <= -2', () => {
    const result = getStrategyAdvice(cards('10', '2'), createCard('5'), -2, defaultRules);
    expect(result.action).toBe('H');
    expect(result.isDeviation).toBe(true);
  });

  it('12v6: Hit at TC <= -1', () => {
    const result = getStrategyAdvice(cards('10', '2'), createCard('6'), -1, defaultRules);
    expect(result.action).toBe('H');
    expect(result.isDeviation).toBe(true);
  });

  it('13v3: Hit at TC <= -2', () => {
    const result = getStrategyAdvice(cards('10', '3'), createCard('3'), -2, defaultRules);
    expect(result.action).toBe('H');
    expect(result.isDeviation).toBe(true);
  });
});

describe('insurance', () => {
  it('should take insurance at TC >= +3', () => {
    expect(shouldTakeInsurance(3)).toBe(true);
    expect(shouldTakeInsurance(5)).toBe(true);
  });

  it('should not take insurance at TC < +3', () => {
    expect(shouldTakeInsurance(2.9)).toBe(false);
    expect(shouldTakeInsurance(0)).toBe(false);
    expect(shouldTakeInsurance(-1)).toBe(false);
  });
});
