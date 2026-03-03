import type { TableAction } from '../types.js';

/**
 * Basic strategy tables for 8-deck, S17 (dealer Stands on soft 17), DAS allowed.
 * Cross-referenced with Wizard of Odds.
 *
 * Table keys: [playerTotal][dealerUpcard]
 * Dealer upcard: 2-11 (11 = Ace)
 *
 * Actions:
 *   H = Hit, S = Stand, D = Double, P = Split, R = Surrender
 *   Dh = Double if allowed, else Hit
 *   Ds = Double if allowed, else Stand
 *   Rh = Surrender if allowed, else Hit
 *   Rs = Surrender if allowed, else Stand
 *   Ph = Split if DAS allowed, else Hit
 */

// Hard totals: player total 5-21 vs dealer 2-11
//                           2     3     4     5     6     7     8     9    10    A(11)
export const hardTable: Record<number, Record<number, TableAction>> = {
  5:  { 2: 'H',  3: 'H',  4: 'H',  5: 'H',  6: 'H',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  6:  { 2: 'H',  3: 'H',  4: 'H',  5: 'H',  6: 'H',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  7:  { 2: 'H',  3: 'H',  4: 'H',  5: 'H',  6: 'H',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  8:  { 2: 'H',  3: 'H',  4: 'H',  5: 'H',  6: 'H',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  9:  { 2: 'H',  3: 'Dh', 4: 'Dh', 5: 'Dh', 6: 'Dh', 7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  10: { 2: 'Dh', 3: 'Dh', 4: 'Dh', 5: 'Dh', 6: 'Dh', 7: 'Dh', 8: 'Dh', 9: 'Dh', 10: 'H',  11: 'H' },
  11: { 2: 'Dh', 3: 'Dh', 4: 'Dh', 5: 'Dh', 6: 'Dh', 7: 'Dh', 8: 'Dh', 9: 'Dh', 10: 'Dh', 11: 'Dh' },
  12: { 2: 'H',  3: 'H',  4: 'S',  5: 'S',  6: 'S',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  13: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  14: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  15: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'H',  8: 'H',  9: 'H',  10: 'Rh', 11: 'H' },
  16: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'H',  8: 'H',  9: 'Rh', 10: 'Rh', 11: 'Rh' },
  17: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
  18: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
  19: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
  20: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
  21: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
};

// Soft totals: player soft total 13-21 vs dealer 2-11 (soft 13 = A+2, etc.)
//                           2     3     4     5     6     7     8     9    10    A(11)
export const softTable: Record<number, Record<number, TableAction>> = {
  13: { 2: 'H',  3: 'H',  4: 'H',  5: 'Dh', 6: 'Dh', 7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  14: { 2: 'H',  3: 'H',  4: 'H',  5: 'Dh', 6: 'Dh', 7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  15: { 2: 'H',  3: 'H',  4: 'Dh', 5: 'Dh', 6: 'Dh', 7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  16: { 2: 'H',  3: 'H',  4: 'Dh', 5: 'Dh', 6: 'Dh', 7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  17: { 2: 'H',  3: 'Dh', 4: 'Dh', 5: 'Dh', 6: 'Dh', 7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  18: { 2: 'Ds', 3: 'Ds', 4: 'Ds', 5: 'Ds', 6: 'Ds', 7: 'S',  8: 'S',  9: 'H',  10: 'H',  11: 'H' },
  19: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'Ds', 7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
  20: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
  21: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
};

// Pairs: player pair card value vs dealer 2-11
// Pair of 10s represented as value 10 (covers 10/J/Q/K)
// Pair of Aces represented as value 11
//                           2     3     4     5     6     7     8     9    10    A(11)
export const pairsTable: Record<number, Record<number, TableAction>> = {
  2:  { 2: 'Ph', 3: 'Ph', 4: 'P',  5: 'P',  6: 'P',  7: 'P',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  3:  { 2: 'Ph', 3: 'Ph', 4: 'P',  5: 'P',  6: 'P',  7: 'P',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  4:  { 2: 'H',  3: 'H',  4: 'H',  5: 'Ph', 6: 'Ph', 7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  5:  { 2: 'Dh', 3: 'Dh', 4: 'Dh', 5: 'Dh', 6: 'Dh', 7: 'Dh', 8: 'Dh', 9: 'Dh', 10: 'H',  11: 'H' },
  6:  { 2: 'Ph', 3: 'P',  4: 'P',  5: 'P',  6: 'P',  7: 'H',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  7:  { 2: 'P',  3: 'P',  4: 'P',  5: 'P',  6: 'P',  7: 'P',  8: 'H',  9: 'H',  10: 'H',  11: 'H' },
  8:  { 2: 'P',  3: 'P',  4: 'P',  5: 'P',  6: 'P',  7: 'P',  8: 'P',  9: 'P',  10: 'P',  11: 'P' },
  9:  { 2: 'P',  3: 'P',  4: 'P',  5: 'P',  6: 'P',  7: 'S',  8: 'P',  9: 'P',  10: 'S',  11: 'S' },
  10: { 2: 'S',  3: 'S',  4: 'S',  5: 'S',  6: 'S',  7: 'S',  8: 'S',  9: 'S',  10: 'S',  11: 'S' },
  11: { 2: 'P',  3: 'P',  4: 'P',  5: 'P',  6: 'P',  7: 'P',  8: 'P',  9: 'P',  10: 'P',  11: 'P' },
};
