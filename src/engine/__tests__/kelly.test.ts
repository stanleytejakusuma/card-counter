import { describe, it, expect } from 'vitest';
import { calculateEdge, calculateKellyBet, calculateSpreadBet } from '../kelly.js';

describe('calculateEdge', () => {
  it('returns -0.5% at TC 0 (house edge)', () => {
    expect(calculateEdge(0)).toBeCloseTo(-0.005);
  });

  it('returns 0% at TC +1 (breakeven)', () => {
    expect(calculateEdge(1)).toBeCloseTo(0);
  });

  it('returns +0.5% at TC +2', () => {
    expect(calculateEdge(2)).toBeCloseTo(0.005);
  });

  it('returns +1.5% at TC +4', () => {
    expect(calculateEdge(4)).toBeCloseTo(0.015);
  });

  it('returns -1.5% at TC -2', () => {
    expect(calculateEdge(-2)).toBeCloseTo(-0.015);
  });
});

describe('calculateKellyBet', () => {
  const baseParams = {
    bankroll: 10000,
    minBet: 20,
    maxBet: 500,
    kellyFraction: 0.25,
    baseHouseEdge: 0.005,
    edgePerTrueCount: 0.005,
    unitSize: 20,
  };

  it('returns min bet at TC -2 (no edge)', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: -2 });
    expect(result.amount).toBe(20);
    expect(result.hasEdge).toBe(false);
  });

  it('returns min bet at TC 0 (no edge)', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: 0 });
    expect(result.amount).toBe(20);
    expect(result.hasEdge).toBe(false);
  });

  it('returns min bet at TC +1 (breakeven)', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: 1 });
    expect(result.amount).toBe(20);
    expect(result.hasEdge).toBe(false);
  });

  it('calculates correct bet at TC +2', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: 2 });
    // Edge = 0.5%, Full Kelly = 0.005 * 10000 = $50, Quarter Kelly = $12.50 → rounds to $20
    expect(result.amount).toBe(20);
    expect(result.hasEdge).toBe(true);
    expect(result.edge).toBeCloseTo(0.005);
  });

  it('calculates correct bet at TC +4', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: 4 });
    // Edge = 1.5%, Full Kelly = 0.015 * 10000 = $150, Quarter Kelly = $37.50 → rounds to $40
    expect(result.amount).toBe(40);
    expect(result.hasEdge).toBe(true);
    expect(result.units).toBe(2);
  });

  it('respects max bet', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: 10, bankroll: 100000 });
    expect(result.amount).toBe(500); // Capped at maxBet
  });

  it('rounds to unit size', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: 3, bankroll: 20000 });
    // Edge = 1%, Full Kelly = $200, Quarter = $50 → should be round multiple of $20
    expect(result.amount % 20).toBe(0);
  });

  it('reports full Kelly bet before clamping', () => {
    const result = calculateKellyBet({ ...baseParams, trueCount: 4 });
    expect(result.fullKellyBet).toBeCloseTo(150);
  });
});

describe('calculateSpreadBet', () => {
  const params = { minBet: 1, maxBet: 20, unitSize: 1 };

  it('returns min bet at TC < 2', () => {
    expect(calculateSpreadBet({ ...params, trueCount: -1 }).amount).toBe(1);
    expect(calculateSpreadBet({ ...params, trueCount: 0 }).amount).toBe(1);
    expect(calculateSpreadBet({ ...params, trueCount: 1 }).amount).toBe(1);
    expect(calculateSpreadBet({ ...params, trueCount: 1.9 }).amount).toBe(1);
  });

  it('bets floor(TC) × unit at TC >= 2', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 2 }).amount).toBe(2);
    expect(calculateSpreadBet({ ...params, trueCount: 3 }).amount).toBe(3);
    expect(calculateSpreadBet({ ...params, trueCount: 5 }).amount).toBe(5);
    expect(calculateSpreadBet({ ...params, trueCount: 5.8 }).amount).toBe(5);
  });

  it('clamps to maxBet', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 25 }).amount).toBe(20);
  });

  it('reports edge and hasEdge correctly', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 1 }).hasEdge).toBe(false);
    expect(calculateSpreadBet({ ...params, trueCount: 3 }).hasEdge).toBe(true);
    expect(calculateSpreadBet({ ...params, trueCount: 3 }).edge).toBeCloseTo(0.01);
  });

  it('reports correct units', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 5 }).units).toBe(5);
    expect(calculateSpreadBet({ ...params, trueCount: 2, unitSize: 2 }).units).toBe(2);
  });
});
