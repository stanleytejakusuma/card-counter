export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface Card {
  rank: Rank;
  /** Numeric value: 2-10 face value, J/Q/K = 10, A = 11 */
  value: CardValue;
}

export interface HandTotal {
  hard: number;
  soft: number;
  /** True if the hand has a usable ace (soft total ≤ 21) */
  isSoft: boolean;
  /** Best playable total (soft if ≤ 21, else hard) */
  total: number;
  isPair: boolean;
  pairRank: Rank | null;
  isBusted: boolean;
  isBlackjack: boolean;
}

export type StrategyAction = 'H' | 'S' | 'D' | 'P' | 'R';

/**
 * Conditional actions that depend on game rules:
 * Dh = Double if allowed, else Hit
 * Ds = Double if allowed, else Stand
 * Rh = Surrender if allowed, else Hit
 * Rs = Surrender if allowed, else Stand
 * Rp = Surrender if allowed, else Split
 * Ph = Split if DAS allowed, else Hit
 */
export type ConditionalAction = 'Dh' | 'Ds' | 'Rh' | 'Rs' | 'Rp' | 'Ph';

export type TableAction = StrategyAction | ConditionalAction;

export interface GameRules {
  decks: number;
  /** Dealer stands on soft 17 */
  dealerStandsOnSoft17: boolean;
  /** Double after split allowed */
  doubleAfterSplit: boolean;
  /** Late surrender allowed */
  lateSurrender: boolean;
  /** Can double on any two cards (vs restricted) */
  doubleAnyTwo: boolean;
}

export interface ResolvedAction {
  action: StrategyAction;
  /** The raw table action before resolution */
  rawAction: TableAction;
  /** True if this came from an index deviation, not basic strategy */
  isDeviation: boolean;
  /** Description of the deviation if applicable */
  deviationName: string | null;
}

export interface IndexPlay {
  /** Player hand total or description (e.g., "16vT", "15v10") */
  name: string;
  /** Player hard total (for hard hands) */
  playerTotal: number;
  /** Whether the player hand is a pair or soft hand */
  handType: 'hard' | 'soft' | 'pair';
  /** Dealer upcard value (2-11, 11=Ace) */
  dealerUpcard: number;
  /** True count threshold: deviate when TC >= this (or <= for negative) */
  threshold: number;
  /** Action when the deviation triggers */
  deviationAction: StrategyAction;
  /** Normal basic strategy action (what you'd do without counting) */
  basicAction: StrategyAction;
}

export interface PlayerBox {
  cards: Card[];
}

export interface PlayerHand {
  cards: Card[];
  doubled: boolean;
  fromSplit: boolean;
}

export interface PlayerSeat {
  seatNumber: number;           // 1-7
  hands: PlayerHand[];          // 1-4 hands (splits)
  activeHandIndex: number;
  betOverride: number | null;   // null = Kelly default
}

export type HandPhase = 'idle' | 'dealer' | 'player' | 'table';

export interface ShoeState {
  runningCount: number;
  cardsSeen: number;
  totalDecks: number;
  cardHistory: Card[];
}
