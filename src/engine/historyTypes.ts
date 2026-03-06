import type { Card, GameRules } from './types.js';

export type HandOutcome = 'win' | 'loss' | 'push' | 'blackjack' | 'surrender' | 'even_money';

export interface HandRecord {
  id: string;
  sessionId: string;
  shoeId: string;
  handNumber: number;
  timestamp: number;
  dealerUpcard: Card;
  playerCards: Card[];
  handTotal: number;
  runningCount: number;
  trueCount: number;
  decksRemaining: number;
  strategyAdvice: string;
  betRecommendation: number;
  outcome: HandOutcome | null;
  betAmount: number;
  netResult: number | null;
  boxIndex?: number;
  seatNumber?: number;
  handIndex?: number;
  doubled?: boolean;
  fromSplit?: boolean;
  dealerCards?: Card[];
}

export interface ShoeRecord {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number | null;
  totalHands: number;
  cardsDealt: number;
  peakTrueCount: number;
  minTrueCount: number;
  cardDistribution?: Record<string, number>;
  tableName?: string;
}

export interface SessionRecord {
  id: string;
  startTime: number;
  endTime: number | null;
  startingBankroll: number;
  endingBankroll: number | null;
  netPnL: number | null;
  totalHands: number;
  totalShoes: number;
  rules: GameRules;
  handsWon: number;
  handsLost: number;
  handsPushed: number;
  blackjacks: number;
  deviationsTaken: number;
}

export type HistoryView =
  | { type: 'sessions' }
  | { type: 'session-detail'; sessionId: string }
  | { type: 'shoe-detail'; shoeId: string; sessionId: string }
  | { type: 'hand-detail'; handId: string; shoeId: string; sessionId: string };
