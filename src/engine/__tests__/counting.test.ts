import { describe, it, expect } from 'vitest';
import { getCardCountValue, calculateTrueCount, calculateDecksRemaining, createCard } from '../counting.js';
import type { Rank } from '../types.js';

describe('getCardCountValue', () => {
  it('returns +1 for low cards (2-6)', () => {
    const lowCards: Rank[] = ['2', '3', '4', '5', '6'];
    for (const rank of lowCards) {
      expect(getCardCountValue(rank)).toBe(1);
    }
  });

  it('returns 0 for neutral cards (7-9)', () => {
    const neutralCards: Rank[] = ['7', '8', '9'];
    for (const rank of neutralCards) {
      expect(getCardCountValue(rank)).toBe(0);
    }
  });

  it('returns -1 for high cards (10, J, Q, K, A)', () => {
    const highCards: Rank[] = ['10', 'J', 'Q', 'K', 'A'];
    for (const rank of highCards) {
      expect(getCardCountValue(rank)).toBe(-1);
    }
  });
});

describe('calculateDecksRemaining', () => {
  it('returns total decks when no cards seen', () => {
    expect(calculateDecksRemaining(0, 8)).toBe(8);
  });

  it('returns correct value mid-shoe', () => {
    // 2 decks (104 cards) into an 8-deck shoe
    expect(calculateDecksRemaining(104, 8)).toBe(6);
  });

  it('returns correct value near end of shoe', () => {
    // 364 of 416 cards seen = 52 remaining = 1 deck
    expect(calculateDecksRemaining(364, 8)).toBe(1);
  });

  it('handles 6-deck shoe', () => {
    expect(calculateDecksRemaining(0, 6)).toBe(6);
    expect(calculateDecksRemaining(156, 6)).toBe(3);
  });
});

describe('calculateTrueCount', () => {
  it('returns 0 when RC is 0', () => {
    expect(calculateTrueCount(0, 0, 8)).toBe(0);
  });

  it('calculates TC correctly with full shoe', () => {
    // RC +8 with 8 decks remaining = TC +1
    expect(calculateTrueCount(8, 0, 8)).toBe(1);
  });

  it('calculates TC correctly mid-shoe', () => {
    // RC +10 with 5 decks remaining = TC +2
    expect(calculateTrueCount(10, 156, 8)).toBe(2);
  });

  it('handles negative running count', () => {
    // RC -12 with 4 decks remaining = TC -3
    expect(calculateTrueCount(-12, 208, 8)).toBe(-3);
  });

  it('TC increases as decks decrease with same RC', () => {
    const rc = 10;
    const tc8 = calculateTrueCount(rc, 0, 8);     // 10/8 = 1.25
    const tc4 = calculateTrueCount(rc, 208, 8);   // 10/4 = 2.5
    const tc2 = calculateTrueCount(rc, 312, 8);   // 10/2 = 5
    expect(tc4).toBeGreaterThan(tc8);
    expect(tc2).toBeGreaterThan(tc4);
  });

  it('returns 0 when no decks remaining', () => {
    expect(calculateTrueCount(10, 416, 8)).toBe(0);
  });
});

describe('createCard', () => {
  it('creates Ace with value 11', () => {
    const card = createCard('A');
    expect(card.rank).toBe('A');
    expect(card.value).toBe(11);
  });

  it('creates face cards with value 10', () => {
    for (const rank of ['J', 'Q', 'K'] as Rank[]) {
      const card = createCard(rank);
      expect(card.value).toBe(10);
    }
  });

  it('creates number cards with face value', () => {
    for (let i = 2; i <= 9; i++) {
      const card = createCard(String(i) as Rank);
      expect(card.value).toBe(i);
    }
  });
});

describe('undo correctness', () => {
  it('adding and undoing N cards returns count to 0', () => {
    const cards: Rank[] = ['2', '5', '10', 'A', '7', 'K', '3', '9', '6', 'J'];
    let rc = 0;
    for (const rank of cards) {
      rc += getCardCountValue(rank);
    }
    // Undo all
    for (const rank of [...cards].reverse()) {
      rc -= getCardCountValue(rank);
    }
    expect(rc).toBe(0);
  });
});
