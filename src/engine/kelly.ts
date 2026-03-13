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
 * 2-tier TC spread:
 *   TC < 1.5  → minBet (1 unit, no edge)
 *   TC ≥ 1.5  → minBet + floor(TC) × unitSize, capped at maxBet
 */
export function calculateSpreadBet(params: SpreadParams): BetRecommendation {
  const { trueCount, minBet, maxBet, unitSize } = params;
  const edge = calculateEdge(trueCount);

  if (trueCount < 1.5) {
    return {
      amount: minBet,
      units: 1,
      edge,
      fullKellyBet: 0,
      hasEdge: false,
    };
  }

  let bet = minBet + Math.floor(trueCount) * unitSize;
  bet = Math.max(minBet, Math.min(maxBet, bet));

  return {
    amount: bet,
    units: Math.round(bet / unitSize * 10) / 10,
    edge,
    fullKellyBet: 0,
    hasEdge: true,
  };
}

export interface HandsRecommendation {
  /** Number of hands/boxes to play this round */
  hands: number;
  /** Per-hand bet amount (adjusted for correlation) */
  perHandBet: number;
  /** Total exposure across all hands */
  totalExposure: number;
  /** Reason for the recommendation */
  reason: string;
}

export interface HandsParams extends SpreadParams {
  /** Current bankroll — used to gate multi-hand behind minimum unit threshold */
  bankroll: number;
}

/**
 * Recommended number of simultaneous hands based on true count and bankroll.
 *
 * At negative/neutral counts: minimize exposure (1 hand, min bet).
 * At positive counts: spread to more hands with Kelly-adjusted per-hand bets.
 * Multi-hand requires 100+ units (bankroll/minBet) — below that, stay single hand.
 * 3-hand requires 200+ units.
 * Multi-hand correlation factor: hands share the dealer's hand, so optimal
 * per-hand bet is reduced (70% for 2 hands, 50% for 3 hands).
 */
export function calculateRecommendedHands(params: HandsParams): HandsRecommendation {
  const { trueCount, minBet, maxBet, unitSize, bankroll } = params;
  const unitsAvailable = bankroll / minBet;

  // No edge — 1 hand, min bet
  if (trueCount < 1.5) {
    return {
      hands: 1,
      perHandBet: minBet,
      totalExposure: minBet,
      reason: 'No edge — minimum bet',
    };
  }

  // Bankroll gates: need 100 units for 2 hands, 200 units for 3 hands
  const canPlayTwo = unitsAvailable >= 100;
  const canPlayThree = unitsAvailable >= 200;

  if (!canPlayTwo) {
    // Bankroll too thin for multi-hand — single hand with spread bet
    const singleBet = Math.max(minBet, Math.min(maxBet, minBet + Math.floor(trueCount) * unitSize));
    return {
      hands: 1,
      perHandBet: singleBet,
      totalExposure: singleBet,
      reason: `+EV but bankroll thin (${Math.floor(unitsAvailable)}u) — single hand`,
    };
  }

  let hands: number;
  let correlationFactor: number;

  if (trueCount < 3) {
    hands = 2;
    correlationFactor = 0.7;
  } else if (trueCount < 5) {
    hands = 2;
    correlationFactor = 0.7;
  } else {
    hands = canPlayThree ? 3 : 2;
    correlationFactor = canPlayThree ? 0.5 : 0.7;
  }

  // Base single-hand bet from spread
  const singleBet = Math.max(minBet, Math.min(maxBet, minBet + Math.floor(trueCount) * unitSize));

  // Adjust per-hand bet for multi-hand correlation
  let perHandBet = Math.round(singleBet * correlationFactor / unitSize) * unitSize;
  perHandBet = Math.max(minBet, Math.min(maxBet, perHandBet));

  const totalExposure = perHandBet * hands;

  const reasons: Record<number, string> = {
    2: 'Edge emerging — spread to 2 hands',
    3: 'Solid edge — 2 hands, 70% per-hand',
    4: 'Strong edge — 2 hands, max exposure',
    5: `Very strong — ${hands} hands, ${hands === 3 ? '50%' : '70%'} per-hand`,
  };

  return {
    hands,
    perHandBet,
    totalExposure,
    reason: reasons[Math.min(Math.floor(trueCount), 5)] ?? `TC +${Math.floor(trueCount)} — ${hands} hands, max exposure`,
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
