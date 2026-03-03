import type { IndexPlay } from '../types.js';

/**
 * Illustrious 18: The 18 most valuable index play deviations for Hi-Lo counting.
 * Ordered by estimated value (most valuable first).
 *
 * "threshold" means: deviate when TC >= threshold (for positive thresholds)
 * or when TC <= threshold (for negative, meaning always deviate at that count).
 *
 * Source: Don Schlesinger's "Blackjack Attack" / Stanford Wong's "Professional Blackjack"
 */
export const illustrious18: IndexPlay[] = [
  // 1. Insurance — take insurance when TC >= +3
  {
    name: 'Insurance',
    playerTotal: 0,  // N/A — insurance is independent of player hand
    handType: 'hard',
    dealerUpcard: 11, // Ace
    threshold: 3,
    deviationAction: 'S', // Represents "take insurance" (special case)
    basicAction: 'H',     // Represents "decline insurance" (special case)
  },
  // 2. 16 vs 10 — Stand when TC >= 0 (basic says Hit)
  {
    name: '16v10',
    playerTotal: 16,
    handType: 'hard',
    dealerUpcard: 10,
    threshold: 0,
    deviationAction: 'S',
    basicAction: 'H',
  },
  // 3. 15 vs 10 — Stand when TC >= +4 (basic says Hit)
  {
    name: '15v10',
    playerTotal: 15,
    handType: 'hard',
    dealerUpcard: 10,
    threshold: 4,
    deviationAction: 'S',
    basicAction: 'H',
  },
  // 4. 10,10 vs 5 — Split when TC >= +5 (basic says Stand)
  {
    name: 'TT v5',
    playerTotal: 20,
    handType: 'pair',
    dealerUpcard: 5,
    threshold: 5,
    deviationAction: 'P',
    basicAction: 'S',
  },
  // 5. 10,10 vs 6 — Split when TC >= +4 (basic says Stand)
  {
    name: 'TT v6',
    playerTotal: 20,
    handType: 'pair',
    dealerUpcard: 6,
    threshold: 4,
    deviationAction: 'P',
    basicAction: 'S',
  },
  // 6. 10 vs 10 — Double when TC >= +4 (basic says Hit)
  {
    name: '10v10',
    playerTotal: 10,
    handType: 'hard',
    dealerUpcard: 10,
    threshold: 4,
    deviationAction: 'D',
    basicAction: 'H',
  },
  // 7. 12 vs 3 — Stand when TC >= +2 (basic says Hit)
  {
    name: '12v3',
    playerTotal: 12,
    handType: 'hard',
    dealerUpcard: 3,
    threshold: 2,
    deviationAction: 'S',
    basicAction: 'H',
  },
  // 8. 12 vs 2 — Stand when TC >= +3 (basic says Hit)
  {
    name: '12v2',
    playerTotal: 12,
    handType: 'hard',
    dealerUpcard: 2,
    threshold: 3,
    deviationAction: 'S',
    basicAction: 'H',
  },
  // 9. 11 vs A — Double when TC >= +1 (basic says Hit in S17)
  {
    name: '11vA',
    playerTotal: 11,
    handType: 'hard',
    dealerUpcard: 11,
    threshold: 1,
    deviationAction: 'D',
    basicAction: 'H',
  },
  // 10. 9 vs 2 — Double when TC >= +1 (basic says Hit)
  {
    name: '9v2',
    playerTotal: 9,
    handType: 'hard',
    dealerUpcard: 2,
    threshold: 1,
    deviationAction: 'D',
    basicAction: 'H',
  },
  // 11. 10 vs A — Double when TC >= +4 (basic says Hit)
  {
    name: '10vA',
    playerTotal: 10,
    handType: 'hard',
    dealerUpcard: 11,
    threshold: 4,
    deviationAction: 'D',
    basicAction: 'H',
  },
  // 12. 9 vs 7 — Double when TC >= +3 (basic says Hit)
  {
    name: '9v7',
    playerTotal: 9,
    handType: 'hard',
    dealerUpcard: 7,
    threshold: 3,
    deviationAction: 'D',
    basicAction: 'H',
  },
  // 13. 16 vs 9 — Stand when TC >= +5 (basic says Hit)
  {
    name: '16v9',
    playerTotal: 16,
    handType: 'hard',
    dealerUpcard: 9,
    threshold: 5,
    deviationAction: 'S',
    basicAction: 'H',
  },
  // 14. 13 vs 2 — Hit when TC <= -1 (basic says Stand)
  {
    name: '13v2',
    playerTotal: 13,
    handType: 'hard',
    dealerUpcard: 2,
    threshold: -1,
    deviationAction: 'H',
    basicAction: 'S',
  },
  // 15. 12 vs 4 — Hit when TC <= 0 (basic says Stand)
  {
    name: '12v4',
    playerTotal: 12,
    handType: 'hard',
    dealerUpcard: 4,
    threshold: 0,
    deviationAction: 'H',
    basicAction: 'S',
  },
  // 16. 12 vs 5 — Hit when TC <= -2 (basic says Stand)
  {
    name: '12v5',
    playerTotal: 12,
    handType: 'hard',
    dealerUpcard: 5,
    threshold: -2,
    deviationAction: 'H',
    basicAction: 'S',
  },
  // 17. 12 vs 6 — Hit when TC <= -1 (basic says Stand)
  {
    name: '12v6',
    playerTotal: 12,
    handType: 'hard',
    dealerUpcard: 6,
    threshold: -1,
    deviationAction: 'H',
    basicAction: 'S',
  },
  // 18. 13 vs 3 — Hit when TC <= -2 (basic says Stand)
  {
    name: '13v3',
    playerTotal: 13,
    handType: 'hard',
    dealerUpcard: 3,
    threshold: -2,
    deviationAction: 'H',
    basicAction: 'S',
  },
];

/**
 * Fab 4: The 4 most valuable surrender deviations.
 * These only apply when late surrender is available.
 */
export const fab4: IndexPlay[] = [
  // 1. 14 vs 10 — Surrender when TC >= +3
  {
    name: '14v10 Sur',
    playerTotal: 14,
    handType: 'hard',
    dealerUpcard: 10,
    threshold: 3,
    deviationAction: 'R',
    basicAction: 'H',
  },
  // 2. 15 vs 10 — Surrender when TC >= 0 (enhances basic surrender)
  {
    name: '15v10 Sur',
    playerTotal: 15,
    handType: 'hard',
    dealerUpcard: 10,
    threshold: 0,
    deviationAction: 'R',
    basicAction: 'H',
  },
  // 3. 15 vs 9 — Surrender when TC >= +2
  {
    name: '15v9 Sur',
    playerTotal: 15,
    handType: 'hard',
    dealerUpcard: 9,
    threshold: 2,
    deviationAction: 'R',
    basicAction: 'H',
  },
  // 4. 15 vs A — Surrender when TC >= +1 (S17)
  {
    name: '15vA Sur',
    playerTotal: 15,
    handType: 'hard',
    dealerUpcard: 11,
    threshold: 1,
    deviationAction: 'R',
    basicAction: 'H',
  },
];
