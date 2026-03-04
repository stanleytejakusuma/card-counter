export interface KellyParams {
  bankroll: number;
  trueCount: number;
  minBet: number;
  maxBet: number;
  /** Fraction of full Kelly to use (default 0.25 = quarter Kelly) */
  kellyFraction: number;
  /** Base house edge as a positive number (default 0.005 = 0.5%) */
  baseHouseEdge: number;
  /** Edge gained per true count unit (default 0.005 = 0.5%) */
  edgePerTrueCount: number;
  /** Betting unit size (for unit display) */
  unitSize: number;
}

export interface BetRecommendation {
  /** Recommended bet amount in dollars */
  amount: number;
  /** Number of units */
  units: number;
  /** Player edge at this true count (negative = house edge) */
  edge: number;
  /** Full Kelly bet before fraction/clamping */
  fullKellyBet: number;
  /** Whether the player has an edge (should bet more than minimum) */
  hasEdge: boolean;
}

export function calculateEdge(
  trueCount: number,
  baseHouseEdge: number = 0.005,
  edgePerTrueCount: number = 0.005,
): number {
  // Player edge = (TC * edgePerTC) - houseEdge
  // At TC=0, edge = -0.5% (house edge)
  // At TC=1, edge = 0% (breakeven)
  // At TC=2, edge = +0.5% (player advantage)
  return trueCount * edgePerTrueCount - baseHouseEdge;
}

export function calculateKellyBet(params: KellyParams): BetRecommendation {
  const {
    bankroll,
    trueCount,
    minBet,
    maxBet,
    kellyFraction = 0.25,
    baseHouseEdge = 0.005,
    edgePerTrueCount = 0.005,
    unitSize,
  } = params;

  const edge = calculateEdge(trueCount, baseHouseEdge, edgePerTrueCount);
  const hasEdge = edge > 0;

  if (!hasEdge) {
    // No edge — bet minimum
    return {
      amount: minBet,
      units: Math.round(minBet / unitSize * 10) / 10,
      edge,
      fullKellyBet: 0,
      hasEdge: false,
    };
  }

  // Full Kelly: bet = edge * bankroll
  // With blackjack variance adjustment (approx 1.1 variance ratio):
  // bet = edge / variance * bankroll ≈ edge * bankroll (simplified)
  const fullKellyBet = edge * bankroll;
  let bet = fullKellyBet * kellyFraction;

  // Round to nearest unit
  bet = Math.round(bet / unitSize) * unitSize;

  // Clamp to min/max
  bet = Math.max(minBet, Math.min(maxBet, bet));

  return {
    amount: bet,
    units: Math.round(bet / unitSize * 10) / 10,
    edge,
    fullKellyBet,
    hasEdge: true,
  };
}

export interface SpreadParams {
  trueCount: number;
  minBet: number;
  maxBet: number;
  unitSize: number;
}

/**
 * Simple TC spread: bet = floor(TC) × unitSize when TC >= 2, else minBet.
 * Practical for small bankrolls where Kelly fractions round to minimum.
 */
export function calculateSpreadBet(params: SpreadParams): BetRecommendation {
  const { trueCount, minBet, maxBet, unitSize } = params;
  const edge = calculateEdge(trueCount);

  if (trueCount < 2) {
    return {
      amount: minBet,
      units: Math.round(minBet / unitSize * 10) / 10,
      edge,
      fullKellyBet: 0,
      hasEdge: false,
    };
  }

  let bet = Math.floor(trueCount) * unitSize;
  bet = Math.max(minBet, Math.min(maxBet, bet));

  return {
    amount: bet,
    units: Math.round(bet / unitSize * 10) / 10,
    edge,
    fullKellyBet: 0,
    hasEdge: true,
  };
}

export const DEFAULT_KELLY_PARAMS: Omit<KellyParams, 'trueCount'> = {
  bankroll: 400,
  minBet: 1,
  maxBet: 100,
  kellyFraction: 0.25,
  baseHouseEdge: 0.005,
  edgePerTrueCount: 0.005,
  unitSize: 1,
};
