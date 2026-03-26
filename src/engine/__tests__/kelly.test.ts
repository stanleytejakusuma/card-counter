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
  const params = { minBet: 5, maxBet: 50, unitSize: 5 };

  it('returns minBet ($5) at TC < -0.5', () => {
    expect(calculateSpreadBet({ ...params, trueCount: -2 }).amount).toBe(5);
    expect(calculateSpreadBet({ ...params, trueCount: -1 }).amount).toBe(5);
    expect(calculateSpreadBet({ ...params, trueCount: -0.51 }).amount).toBe(5);
  });

  it('returns $10 base bet at TC -0.5 to 0.5', () => {
    expect(calculateSpreadBet({ ...params, trueCount: -0.49 }).amount).toBe(10);
    expect(calculateSpreadBet({ ...params, trueCount: 0 }).amount).toBe(10);
    expect(calculateSpreadBet({ ...params, trueCount: 0.49 }).amount).toBe(10);
  });

  it('ramps $5 per TC level: 6-tier spread', () => {
    // TC 0.5: $15
    expect(calculateSpreadBet({ ...params, trueCount: 0.5 }).amount).toBe(15);
    // TC 1.0: $15
    expect(calculateSpreadBet({ ...params, trueCount: 1.0 }).amount).toBe(15);
    // TC 1.5: $20
    expect(calculateSpreadBet({ ...params, trueCount: 1.5 }).amount).toBe(20);
    // TC 2.0: $20
    expect(calculateSpreadBet({ ...params, trueCount: 2.0 }).amount).toBe(20);
    // TC 2.5: $25
    expect(calculateSpreadBet({ ...params, trueCount: 2.5 }).amount).toBe(25);
    // TC 3.5: $30
    expect(calculateSpreadBet({ ...params, trueCount: 3.5 }).amount).toBe(30);
    // TC 4.5: $35
    expect(calculateSpreadBet({ ...params, trueCount: 4.5 }).amount).toBe(35);
  });

  it('clamps to maxBet', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 25 }).amount).toBe(50);
  });

  it('reports hasEdge correctly', () => {
    expect(calculateSpreadBet({ ...params, trueCount: -1 }).hasEdge).toBe(false);
    expect(calculateSpreadBet({ ...params, trueCount: 0 }).hasEdge).toBe(false);
    expect(calculateSpreadBet({ ...params, trueCount: 1.0 }).hasEdge).toBe(false);
    expect(calculateSpreadBet({ ...params, trueCount: 1.5 }).hasEdge).toBe(true);
    expect(calculateSpreadBet({ ...params, trueCount: 3 }).hasEdge).toBe(true);
  });

  it('reports correct units', () => {
    // TC -1: $5/$5 = 1u
    expect(calculateSpreadBet({ ...params, trueCount: -1 }).units).toBe(1);
    // TC 0: $10/$5 = 2u
    expect(calculateSpreadBet({ ...params, trueCount: 0 }).units).toBe(2);
    // TC 1.0: $15/$5 = 3u
    expect(calculateSpreadBet({ ...params, trueCount: 1.0 }).units).toBe(3);
    // TC 3.5: $30/$5 = 6u
    expect(calculateSpreadBet({ ...params, trueCount: 3.5 }).units).toBe(6);
  });
});
