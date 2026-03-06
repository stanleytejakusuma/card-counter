import { describe, it, expect } from 'vitest';
import { calculateEdge, calculateKellyBet, calculateSpreadBet, TABLE_MIN } from '../kelly.js';

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
  const params = { minBet: 8, maxBet: 80, unitSize: 8 };

  it('returns TABLE_MIN ($5) at TC < 0.5', () => {
    expect(calculateSpreadBet({ ...params, trueCount: -2 }).amount).toBe(TABLE_MIN);
    expect(calculateSpreadBet({ ...params, trueCount: 0 }).amount).toBe(TABLE_MIN);
    expect(calculateSpreadBet({ ...params, trueCount: 0.4 }).amount).toBe(TABLE_MIN);
    expect(calculateSpreadBet({ ...params, trueCount: 0.49 }).amount).toBe(TABLE_MIN);
  });

  it('returns minBet ($8) at TC 0.5–1.5', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 0.5 }).amount).toBe(8);
    expect(calculateSpreadBet({ ...params, trueCount: 1.0 }).amount).toBe(8);
    expect(calculateSpreadBet({ ...params, trueCount: 1.49 }).amount).toBe(8);
  });

  it('spreads at TC >= 1.5: minBet + floor(TC) × unitSize', () => {
    // TC 1.5: $8 + 1×$8 = $16
    expect(calculateSpreadBet({ ...params, trueCount: 1.5 }).amount).toBe(16);
    // TC 2.0: $8 + 2×$8 = $24
    expect(calculateSpreadBet({ ...params, trueCount: 2.0 }).amount).toBe(24);
    // TC 2.9: floor(2.9)=2, $8 + 2×$8 = $24
    expect(calculateSpreadBet({ ...params, trueCount: 2.9 }).amount).toBe(24);
    // TC 3.0: $8 + 3×$8 = $32
    expect(calculateSpreadBet({ ...params, trueCount: 3.0 }).amount).toBe(32);
    // TC 5.0: $8 + 5×$8 = $48
    expect(calculateSpreadBet({ ...params, trueCount: 5.0 }).amount).toBe(48);
  });

  it('clamps to maxBet', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 25 }).amount).toBe(80);
  });

  it('reports hasEdge correctly', () => {
    expect(calculateSpreadBet({ ...params, trueCount: 0 }).hasEdge).toBe(false);
    expect(calculateSpreadBet({ ...params, trueCount: 1.0 }).hasEdge).toBe(false);
    expect(calculateSpreadBet({ ...params, trueCount: 1.5 }).hasEdge).toBe(true);
    expect(calculateSpreadBet({ ...params, trueCount: 3 }).hasEdge).toBe(true);
  });

  it('reports correct units', () => {
    // TC<0.5: $5/$8 = 0.6u
    expect(calculateSpreadBet({ ...params, trueCount: 0 }).units).toBe(0.6);
    // TC 1.0: $8/$8 = 1u
    expect(calculateSpreadBet({ ...params, trueCount: 1.0 }).units).toBe(1);
    // TC 3.0: $32/$8 = 4u
    expect(calculateSpreadBet({ ...params, trueCount: 3.0 }).units).toBe(4);
  });
});
