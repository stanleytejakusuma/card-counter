import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Card, HandPhase, PlayerHand, PlayerSeat, Rank } from '../engine/types.js';
import type { HandOutcome } from '../engine/historyTypes.js';
import { createCard, getCardCountValue } from '../engine/counting.js';
import { calculateHandTotal, determineOutcome } from '../engine/hand.js';
import { useSessionStore } from './sessionStore.js';

let _nextId = 0;
function generateId(): string {
  return `${Date.now()}-${++_nextId}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyHand(fromSplit = false): PlayerHand {
  return { cards: [], doubled: false, fromSplit };
}

/** Returns the full play/deal order. In observe mode, only occupied seats (no player seats). */
function getPlayOrder(state: { playerSeatNumbers: number[]; occupiedSeatNumbers: number[]; _observeRound?: boolean }): number[] {
  if (state._observeRound) {
    return [...state.occupiedSeatNumbers].sort((a, b) => a - b);
  }
  return [...state.playerSeatNumbers, ...state.occupiedSeatNumbers].sort((a, b) => a - b);
}

function createEmptySeats(seatNumbers: number[]): PlayerSeat[] {
  return seatNumbers.map((n) => ({
    seatNumber: n,
    hands: [createEmptyHand()],
    activeHandIndex: 0,
    betOverride: null,
  }));
}

interface ConfirmedSeatHand {
  id: string;
  cards: Card[];
  doubled: boolean;
  fromSplit: boolean;
}

interface LastConfirmedRound {
  dealerUpcard: Card;
  seats: {
    seatNumber: number;
    hands: ConfirmedSeatHand[];
    betOverride: number | null;
  }[];
}

export interface RoundSnapshot {
  dealerUpcard: Card;
  seats: {
    seatNumber: number;
    hands: {
      id: string;
      cards: Card[];
      doubled: boolean;
      fromSplit: boolean;
      total: number;
      outcome?: HandOutcome;
      netResult?: number;
    }[];
    betAmount: number;
  }[];
  tableCards: Card[];
  runningCount: number;
  trueCount: number;
  timestamp: number;
}

export interface CardContext {
  rank: string;
  target: string;  // 'D' = dealer, 'S1' / 'S1.2' = seat+hand, 'T' = table
}

interface GameState {
  runningCount: number;
  cardsSeen: number;
  cardHistory: Card[];
  cardContextHistory: CardContext[];

  handPhase: HandPhase;
  dealerUpcard: Card | null;
  seats: PlayerSeat[];
  activeSeatIndex: number;
  playerSeatNumbers: number[];
  occupiedSeatNumbers: number[];  // other players' seats (visual only)

  isWongedOut: boolean;

  _dealOrderIndex: number;
  _activePlaySeat: number;  // current seat in full play order (0 = not in play yet)
  _dealerHits: Card[];  // cards entered during table phase (dealer cards)
  _splitDealInProgress: boolean;  // true while dealing second cards to split hands
  _occupiedSplitSeats: number[];  // occupied seats that split this round
  _occupiedActiveSubHand: number;  // 0 or 1 — which sub-hand receives cards
  _observeRound: boolean;  // observe mode — track cards only, no player hands

  currentShoeId: string | null;
  shoeHandCount: number;
  lastConfirmedRound: LastConfirmedRound | null;
  tableCards: Card[];
  peakTrueCount: number;
  minTrueCount: number;

  shoeRoundHistory: RoundSnapshot[];

  inputCard: (rank: Rank) => void;
  undoLastCard: () => void;
  undoCurrentHand: () => void;
  confirmHand: () => void;
  setHandPhase: (phase: HandPhase) => void;
  toggleWong: () => void;
  newShoe: () => void;
  nextHand: () => void;
  updateTrueCountExtremes: (tc: number) => void;

  splitHand: () => void;
  splitOccupied: () => void;
  doubleDown: () => void;
  setBetOverride: (seatIndex: number, amount: number | null) => void;
  setPlayerSeats: (seatNumbers: number[]) => void;
  toggleSeat: (seatNumber: number) => void;
  toggleOccupiedSeat: (seatNumber: number) => void;
  setActiveSeat: (index: number) => void;
  nextHandOrSeat: () => void;
  updateRoundOutcome: (roundIndex: number, seatIndex: number, handIndex: number, outcome: HandOutcome, netResult: number) => void;
  toggleObserveRound: () => void;

  // Legacy compat — point to seat equivalents
  readonly numBoxes: number;
  setNumBoxes: (n: number) => void;
  setActiveBox: (index: number) => void;
  nextBox: () => void;
}

/** Recompute _dealOrderIndex from the remaining cardContextHistory after undo.
 *  New deal order: S..S, D, S..S  (players first round, dealer, players second round)
 *  Index = total deal entries (S and D) from the current round start. */
function recomputeDealOrderIndex(ctx: CardContext[]): number {
  // Find the dealer entry (marks the boundary between first and second player rounds)
  let dIdx = -1;
  for (let i = ctx.length - 1; i >= 0; i--) {
    if (ctx[i].target === 'D') { dIdx = i; break; }
  }

  if (dIdx < 0) {
    // No dealer card yet — count trailing S entries (first round in progress)
    let count = 0;
    for (let i = ctx.length - 1; i >= 0; i--) {
      if (ctx[i].target.startsWith('S')) count++;
      else break;
    }
    return count;
  }

  // D found: count consecutive S before D + 1 (D itself) + consecutive S after D
  let sBefore = 0;
  for (let i = dIdx - 1; i >= 0; i--) {
    if (ctx[i].target.startsWith('S')) sBefore++;
    else break;
  }
  let sAfter = 0;
  for (let i = dIdx + 1; i < ctx.length; i++) {
    if (ctx[i].target.startsWith('S')) sAfter++;
    else break;
  }
  return sBefore + 1 + sAfter;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      runningCount: 0,
      cardsSeen: 0,
      cardHistory: [],
      cardContextHistory: [],

      handPhase: 'idle',
      dealerUpcard: null,
      seats: [{ seatNumber: 1, hands: [createEmptyHand()], activeHandIndex: 0, betOverride: null }],
      activeSeatIndex: 0,
      playerSeatNumbers: [1],
      occupiedSeatNumbers: [],
      isWongedOut: false,

      _dealOrderIndex: 0,
      _activePlaySeat: 0,
      _dealerHits: [],
      _splitDealInProgress: false,
      _occupiedSplitSeats: [],
      _occupiedActiveSubHand: 0,
      _observeRound: false,

      currentShoeId: null,
      shoeHandCount: 0,
      lastConfirmedRound: null,
      tableCards: [],
      peakTrueCount: 0,
      minTrueCount: 0,

      shoeRoundHistory: [],

      // Legacy compat
      get numBoxes(): number {
        return get().playerSeatNumbers.length;
      },

      inputCard: (rank: Rank) => {
        const card = createCard(rank);
        const countDelta = getCardCountValue(rank);
        const state = get();

        const updates: Partial<GameState> = {
          runningCount: state.runningCount + countDelta,
          cardsSeen: state.cardsSeen + 1,
          cardHistory: [...state.cardHistory, card],
        };

        if (!state.currentShoeId) {
          updates.currentShoeId = generateId();
        }

        if (state.handPhase === 'idle' && state.lastConfirmedRound) {
          updates.lastConfirmedRound = null;
        }

        // Build context label for draw history
        let contextTarget: string;

        if (state.handPhase === 'table') {
          updates.tableCards = [...state.tableCards, card];
          const newDealerHits = [...state._dealerHits, card];
          updates._dealerHits = newDealerHits;
          contextTarget = 'T';

          // Check dealer bust
          if (state.dealerUpcard) {
            const dealerTotal = calculateHandTotal([state.dealerUpcard, ...newDealerHits]).total;
            if (dealerTotal > 21) {
              updates.cardContextHistory = [...state.cardContextHistory, { rank: rank === '10' ? 'T' : rank, target: contextTarget }];
              set(updates);
              get().confirmHand();
              useSessionStore.getState().incrementHands();
              get().nextHand();
              return;
            }
          }
        } else if (state.handPhase === 'idle') {
          // First card of the round goes to the first seat (not dealer)
          const dealOrder = getPlayOrder(state);
          const targetSeatNum = dealOrder[0];

          updates.handPhase = 'player';
          updates._dealOrderIndex = 1;
          updates.activeSeatIndex = 0;

          const playerSeatIdx = state.seats.findIndex((s) => s.seatNumber === targetSeatNum);
          if (playerSeatIdx >= 0) {
            const seat = state.seats[playerSeatIdx];
            const hand = seat.hands[seat.activeHandIndex];
            contextTarget = `S${seat.seatNumber}`;
            const newHand: PlayerHand = { ...hand, cards: [...hand.cards, card] };
            const newHands = seat.hands.map((h, j) => j === seat.activeHandIndex ? newHand : h);
            const newSeat: PlayerSeat = { ...seat, hands: newHands };
            updates.seats = state.seats.map((s, i) => i === playerSeatIdx ? newSeat : s);
            updates.activeSeatIndex = playerSeatIdx;
          } else {
            updates.tableCards = [...state.tableCards, card];
            contextTarget = `S${targetSeatNum}`;
          }
        } else if (state.handPhase === 'player') {
          const dealOrder = getPlayOrder(state);
          const N = dealOrder.length;
          const inDealMode = N > 0 && state._dealOrderIndex > 0 && state._dealOrderIndex < N * 2 + 1;

          if (inDealMode) {
            // DEAL MODE — order: S..S (first round), D (dealer), S..S (second round)
            const idx = state._dealOrderIndex;

            if (idx < N) {
              // First round — seat card
              const targetSeatNum = dealOrder[idx];
              const playerSeatIdx = state.seats.findIndex((s) => s.seatNumber === targetSeatNum);

              if (playerSeatIdx >= 0) {
                const seat = state.seats[playerSeatIdx];
                const hand = seat.hands[seat.activeHandIndex];
                contextTarget = seat.hands.length > 1
                  ? `S${seat.seatNumber}.${seat.activeHandIndex + 1}`
                  : `S${seat.seatNumber}`;
                const newHand: PlayerHand = { ...hand, cards: [...hand.cards, card] };
                const newHands = seat.hands.map((h, j) => j === seat.activeHandIndex ? newHand : h);
                const newSeat: PlayerSeat = { ...seat, hands: newHands };
                updates.seats = state.seats.map((s, i) => i === playerSeatIdx ? newSeat : s);
                updates.activeSeatIndex = playerSeatIdx;
              } else {
                updates.tableCards = [...state.tableCards, card];
                contextTarget = `S${targetSeatNum}`;
              }
            } else if (idx === N) {
              // Dealer upcard
              updates.dealerUpcard = card;
              contextTarget = 'D';
            } else {
              // Second round — seat card (idx > N)
              const targetSeatNum = dealOrder[idx - N - 1];
              const playerSeatIdx = state.seats.findIndex((s) => s.seatNumber === targetSeatNum);

              if (playerSeatIdx >= 0) {
                const seat = state.seats[playerSeatIdx];
                const hand = seat.hands[seat.activeHandIndex];
                contextTarget = seat.hands.length > 1
                  ? `S${seat.seatNumber}.${seat.activeHandIndex + 1}`
                  : `S${seat.seatNumber}`;
                const newHand: PlayerHand = { ...hand, cards: [...hand.cards, card] };
                const newHands = seat.hands.map((h, j) => j === seat.activeHandIndex ? newHand : h);
                const newSeat: PlayerSeat = { ...seat, hands: newHands };
                updates.seats = state.seats.map((s, i) => i === playerSeatIdx ? newSeat : s);
                updates.activeSeatIndex = playerSeatIdx;
              } else {
                updates.tableCards = [...state.tableCards, card];
                contextTarget = `S${targetSeatNum}`;
              }
            }

            const newDealIdx = state._dealOrderIndex + 1;
            updates._dealOrderIndex = newDealIdx;

            // Check if deal is now complete (2N+1 cards: N seats + dealer + N seats)
            if (newDealIdx >= N * 2 + 1) {
              const finalSeats = updates.seats ?? state.seats;
              // Only use current round's context (last 2N+1 entries) — not previous rounds
              const fullCtx = [...state.cardContextHistory, { rank: (rank === '10' ? 'T' : rank) as CardContext['rank'], target: contextTarget }];
              const roundCtx = fullCtx.slice(-(N * 2 + 1));

              const seatHas21 = (sn: number): boolean => {
                const psi = finalSeats.findIndex((s) => s.seatNumber === sn);
                if (psi >= 0) {
                  const h = finalSeats[psi].hands[0];
                  return h.cards.length >= 2 && calculateHandTotal(h.cards).total >= 21;
                }
                if (state.occupiedSeatNumbers.includes(sn)) {
                  const tag = `S${sn}`;
                  const seatRanks = roundCtx.filter((e) => e.target === tag).map((e) => (e.rank === 'T' ? '10' : e.rank) as Rank);
                  return seatRanks.length >= 2 && calculateHandTotal(seatRanks.map((r) => createCard(r))).total >= 21;
                }
                return false;
              };

              // Find first seat that doesn't already have 21/BJ
              let startSeatNum = dealOrder[0];
              let allHave21 = true;
              for (const sn of dealOrder) {
                if (!seatHas21(sn)) {
                  startSeatNum = sn;
                  allHave21 = false;
                  break;
                }
              }

              if (allHave21) {
                // All seats have 21/BJ — go straight to table phase
                updates.handPhase = 'table';
                updates._activePlaySeat = 0;
                updates._dealerHits = [];
              } else {
                updates._activePlaySeat = startSeatNum;
                const firstPlayerIdx = finalSeats.findIndex((s) => s.seatNumber === startSeatNum);
                if (firstPlayerIdx >= 0) {
                  updates.activeSeatIndex = firstPlayerIdx;
                }
              }
            }
          } else if (state._activePlaySeat > 0 && state.occupiedSeatNumbers.includes(state._activePlaySeat)) {
            // PLAY MODE — active seat is an occupied (non-player) seat: cards go to tableCards
            updates.tableCards = [...state.tableCards, card];
            const seatTag = `S${state._activePlaySeat}`;
            const isSplit = state._occupiedSplitSeats.includes(state._activePlaySeat);

            if (isSplit) {
              contextTarget = `${seatTag}.${state._occupiedActiveSubHand + 1}`;
            } else {
              contextTarget = seatTag;
            }

            // Compute occupied seat/sub-hand total from context history + new card
            const ctxH = state.cardContextHistory;
            let dIdx = -1;
            for (let ci = ctxH.length - 1; ci >= 0; ci--) {
              if (ctxH[ci].target === 'D') { dIdx = ci; break; }
            }
            let roundStart = dIdx >= 0 ? dIdx : 0;
            for (let ci = roundStart - 1; ci >= 0; ci--) {
              if (ctxH[ci].target.startsWith('S')) roundStart = ci;
              else break;
            }
            const roundCtx = ctxH.slice(roundStart);

            let occTotal: number;
            if (isSplit) {
              // Sub-hand total: deal card (nth S{n} entry) + S{n}.{h} hit cards + new card
              const dealEntries = roundCtx.filter((e) => e.target === seatTag);
              const dealCard = dealEntries[state._occupiedActiveSubHand];
              const subTag = `${seatTag}.${state._occupiedActiveSubHand + 1}`;
              const hitEntries = roundCtx.filter((e) => e.target === subTag);
              const subRanks = [dealCard, ...hitEntries]
                .filter(Boolean)
                .map((e) => (e.rank === 'T' ? '10' : e.rank) as Rank);
              occTotal = calculateHandTotal([...subRanks, rank].map((r) => createCard(r))).total;
            } else {
              const seatRanks = roundCtx
                .filter((e) => e.target === seatTag)
                .map((e) => (e.rank === 'T' ? '10' : e.rank) as Rank);
              occTotal = calculateHandTotal([...seatRanks, rank].map((r) => createCard(r))).total;
            }

            if (occTotal >= 21) {
              if (isSplit && state._occupiedActiveSubHand === 0) {
                // Advance to second sub-hand
                updates._occupiedActiveSubHand = 1;
              } else {
                // Advance to next seat or table
                const playOrder = getPlayOrder(state);
                const currentIdx = playOrder.indexOf(state._activePlaySeat);
                if (currentIdx >= 0 && currentIdx < playOrder.length - 1) {
                  const nextSeatNum = playOrder[currentIdx + 1];
                  updates._activePlaySeat = nextSeatNum;
                  updates._occupiedActiveSubHand = 0;
                  const nextPlayerIdx = (updates.seats ?? state.seats).findIndex((s) => s.seatNumber === nextSeatNum);
                  if (nextPlayerIdx >= 0) updates.activeSeatIndex = nextPlayerIdx;
                } else {
                  updates.handPhase = 'table';
                  updates._activePlaySeat = 0;
                  updates._dealerHits = [];
                }
              }
            }
          } else if (state._splitDealInProgress) {
            // SPLIT DEAL MODE — dealing second cards to split hands
            const seat = state.seats[state.activeSeatIndex];
            const hand = seat.hands[seat.activeHandIndex];
            contextTarget = `S${seat.seatNumber}.${seat.activeHandIndex + 1}`;

            const newHand: PlayerHand = { ...hand, cards: [...hand.cards, card] };
            const newHands = seat.hands.map((h, j) => j === seat.activeHandIndex ? newHand : h);
            const newSeat: PlayerSeat = { ...seat, hands: newHands };
            const newSeats = state.seats.map((s, i) => i === state.activeSeatIndex ? newSeat : s);
            updates.seats = newSeats;

            if (newHand.cards.length === 2) {
              // This split hand is dealt — find next hand needing a card
              let nextIdx = -1;
              for (let hi = seat.activeHandIndex + 1; hi < newHands.length; hi++) {
                if (newHands[hi].fromSplit && newHands[hi].cards.length === 1) {
                  nextIdx = hi;
                  break;
                }
              }
              if (nextIdx >= 0) {
                // Advance to next undealt split hand
                const advSeat = { ...newSeat, activeHandIndex: nextIdx };
                updates.seats = newSeats.map((s, i) =>
                  i === state.activeSeatIndex ? advSeat : s,
                );
              } else {
                // All split hands dealt — find first playable split hand
                let firstPlayable = -1;
                for (let hi = 0; hi < newHands.length; hi++) {
                  if (newHands[hi].fromSplit && (hi === seat.activeHandIndex ? newHand : newHands[hi]).cards.length === 2) {
                    firstPlayable = hi;
                    break;
                  }
                }
                if (firstPlayable >= 0) {
                  const advSeat = { ...newSeat, activeHandIndex: firstPlayable };
                  updates.seats = newSeats.map((s, i) =>
                    i === state.activeSeatIndex ? advSeat : s,
                  );
                }
                updates._splitDealInProgress = false;

                // Auto-complete split aces: if first card is A, hand is done
                if (firstPlayable >= 0) {
                  const fpHand = firstPlayable === seat.activeHandIndex ? newHand : newHands[firstPlayable];
                  if (fpHand.cards[0]?.rank === 'A') {
                    // All split ace hands auto-complete — advance past them all
                    // Find next non-ace split hand, or advance seat
                    let allAces = true;
                    for (let hi = 0; hi < newHands.length; hi++) {
                      const h = hi === seat.activeHandIndex ? newHand : newHands[hi];
                      if (h.fromSplit && h.cards.length === 2 && h.cards[0]?.rank !== 'A') {
                        allAces = false;
                        break;
                      }
                    }
                    if (allAces && state._activePlaySeat > 0) {
                      // All hands are split aces — advance to next seat or table
                      const playOrder = getPlayOrder(state);
                      const currentIdx = playOrder.indexOf(state._activePlaySeat);
                      if (currentIdx >= 0 && currentIdx < playOrder.length - 1) {
                        const nextSeatNum = playOrder[currentIdx + 1];
                        updates._activePlaySeat = nextSeatNum;
                        const nextPlayerIdx = newSeats.findIndex((s) => s.seatNumber === nextSeatNum);
                        if (nextPlayerIdx >= 0) updates.activeSeatIndex = nextPlayerIdx;
                      } else {
                        updates.handPhase = 'table';
                        updates._activePlaySeat = 0;
                        updates._dealerHits = [];
                      }
                    }
                  }
                }
              }
            }
          } else {
            // PLAY MODE — hits on active player seat
            const seat = state.seats[state.activeSeatIndex];
            const hand = seat.hands[seat.activeHandIndex];
            contextTarget = seat.hands.length > 1
              ? `S${seat.seatNumber}.${seat.activeHandIndex + 1}`
              : `S${seat.seatNumber}`;

            const newHand: PlayerHand = { ...hand, cards: [...hand.cards, card] };
            const newHands = seat.hands.map((h, j) => j === seat.activeHandIndex ? newHand : h);
            const newSeat: PlayerSeat = { ...seat, hands: newHands };
            const newSeats = state.seats.map((s, i) => i === state.activeSeatIndex ? newSeat : s);
            updates.seats = newSeats;

            // Auto-advance for double/split aces/bust/21
            const newTotal = calculateHandTotal(newHand.cards).total;
            const shouldAdvance =
              (newHand.doubled && newHand.cards.length === 3) ||
              (newHand.fromSplit && hand.cards.length === 1 && newHand.cards[0]?.rank === 'A' && newHand.cards.length === 2) ||
              (state._activePlaySeat > 0 && newTotal >= 21);

            if (shouldAdvance) {
              if (seat.activeHandIndex < newHands.length - 1) {
                const advSeat = { ...newSeat, activeHandIndex: seat.activeHandIndex + 1 };
                updates.seats = newSeats.map((s, i) =>
                  i === state.activeSeatIndex ? advSeat : s,
                );
              } else if (state._activePlaySeat > 0) {
                // Advance through full play order (player + occupied seats)
                const playOrder = getPlayOrder(state);
                const currentIdx = playOrder.indexOf(state._activePlaySeat);
                if (currentIdx >= 0 && currentIdx < playOrder.length - 1) {
                  const nextSeatNum = playOrder[currentIdx + 1];
                  updates._activePlaySeat = nextSeatNum;
                  const nextPlayerIdx = newSeats.findIndex((s) => s.seatNumber === nextSeatNum);
                  if (nextPlayerIdx >= 0) updates.activeSeatIndex = nextPlayerIdx;
                } else {
                  // Last seat → table phase
                  updates.handPhase = 'table';
                  updates._activePlaySeat = 0;
                  updates._dealerHits = [];
                }
              } else if (state.activeSeatIndex < state.seats.length - 1) {
                // Fallback: advance by player seat index (deal mode)
                updates.activeSeatIndex = state.activeSeatIndex + 1;
                const nextSeat = state.seats[state.activeSeatIndex + 1];
                const resetSeat = { ...nextSeat, activeHandIndex: 0 };
                updates.seats = (updates.seats ?? newSeats).map((s, i) =>
                  i === state.activeSeatIndex + 1 ? resetSeat : s,
                );
              }
            }
          }
        } else {
          contextTarget = '?';
        }

        updates.cardContextHistory = [...state.cardContextHistory, { rank: rank === '10' ? 'T' : rank, target: contextTarget }];
        set(updates);
      },

      undoLastCard: () => {
        const state = get();

        // Undo during split deal: remove the dealt card from a split hand
        if (state.handPhase === 'player' && state._splitDealInProgress) {
          const seat = state.seats[state.activeSeatIndex];
          const hand = seat.hands[seat.activeHandIndex];
          if (hand && hand.fromSplit && hand.cards.length === 2) {
            // Remove the split-dealt card (drop hand back to 1 card)
            const lastCard = hand.cards[hand.cards.length - 1];
            const countDelta = getCardCountValue(lastCard.rank);
            const newHand: PlayerHand = { ...hand, cards: hand.cards.slice(0, -1) };
            const newHands = seat.hands.map((h, j) => j === seat.activeHandIndex ? newHand : h);

            // Scan backward for previous fromSplit hand that already has 2 cards
            if (seat.activeHandIndex > 0) {
              let prevIdx = -1;
              for (let hi = seat.activeHandIndex - 1; hi >= 0; hi--) {
                if (newHands[hi].fromSplit && newHands[hi].cards.length === 2) {
                  prevIdx = hi;
                  break;
                }
              }
              if (prevIdx >= 0) {
                const regressSeat: PlayerSeat = { ...seat, hands: newHands, activeHandIndex: prevIdx };
                set({
                  runningCount: state.runningCount - countDelta,
                  cardsSeen: state.cardsSeen - 1,
                  cardHistory: state.cardHistory.slice(0, -1),
                  cardContextHistory: state.cardContextHistory.slice(0, -1),
                  seats: state.seats.map((s, i) => i === state.activeSeatIndex ? regressSeat : s),
                });
                return;
              }
            }
            // activeHandIndex === 0 or no previous dealt hand: drop back to first split hand
            const regressSeat: PlayerSeat = { ...seat, hands: newHands, activeHandIndex: 0 };
            set({
              runningCount: state.runningCount - countDelta,
              cardsSeen: state.cardsSeen - 1,
              cardHistory: state.cardHistory.slice(0, -1),
              cardContextHistory: state.cardContextHistory.slice(0, -1),
              seats: state.seats.map((s, i) => i === state.activeSeatIndex ? regressSeat : s),
              _splitDealInProgress: false,
              // Next undo will trigger the existing merge-back logic
            });
            return;
          }
        }

        // Undo split decision: if two adjacent hands each have 1 card and fromSplit, merge back
        if (state.handPhase === 'player') {
          const seat = state.seats[state.activeSeatIndex];
          const hi = seat.activeHandIndex;
          const hand = seat.hands[hi];
          if (hand && hand.fromSplit && hand.cards.length === 1 && hi + 1 < seat.hands.length) {
            const nextHand = seat.hands[hi + 1];
            if (nextHand.fromSplit && nextHand.cards.length === 1) {
              // Merge back into a single pair hand
              const merged: PlayerHand = {
                cards: [hand.cards[0], nextHand.cards[0]],
                doubled: false,
                fromSplit: false,
              };
              const newHands = [...seat.hands];
              newHands.splice(hi, 2, merged);
              const newSeat: PlayerSeat = { ...seat, hands: newHands, activeHandIndex: hi };
              set({ seats: state.seats.map((s, i) => i === state.activeSeatIndex ? newSeat : s) });
              return;
            }
          }

          // Undo double decision: if active hand is doubled with only 2 cards, just clear doubled flag
          if (hand && hand.doubled && hand.cards.length === 2) {
            const newHand: PlayerHand = { ...hand, doubled: false };
            const newHands = seat.hands.map((h, j) => j === seat.activeHandIndex ? newHand : h);
            const newSeat: PlayerSeat = { ...seat, hands: newHands };
            set({ seats: state.seats.map((s, i) => i === state.activeSeatIndex ? newSeat : s) });
            return;
          }
        }

        // Undo navigation ("stand"): if in play mode and the last card in history
        // wasn't entered for the current seat's play turn, revert to previous seat
        if (state.handPhase === 'player' && state._activePlaySeat > 0) {
          const playOrder = getPlayOrder(state);
          // Only N deal entries come after D in S..D..S order
          const dealCardCount = playOrder.length;
          const ctxH = state.cardContextHistory;
          let lastDIdx = -1;
          for (let ci = ctxH.length - 1; ci >= 0; ci--) {
            if (ctxH[ci].target === 'D') { lastDIdx = ci; break; }
          }
          const afterDealer = lastDIdx >= 0 ? ctxH.slice(lastDIdx + 1) : ctxH;
          const hasPlayCards = afterDealer.length > dealCardCount;

          let shouldRevertNav = false;
          if (!hasPlayCards) {
            // No play-mode cards at all — last card is from deal
            shouldRevertNav = true;
          } else {
            // Check if the last entry is a play card for the current seat
            const lastEntry = ctxH[ctxH.length - 1];
            const currentTag = `S${state._activePlaySeat}`;
            shouldRevertNav = !(
              lastEntry.target === currentTag ||
              lastEntry.target.startsWith(currentTag + '.')
            );
          }

          if (shouldRevertNav) {
            const currentIdx = playOrder.indexOf(state._activePlaySeat);
            if (currentIdx > 0) {
              const prevSeatNum = playOrder[currentIdx - 1];

              // Check if prev seat busted (auto-advance) — if so, the last card
              // caused the bust and should be removed, not just nav-reverted
              let prevSeatBusted = false;
              const prevTag = `S${prevSeatNum}`;
              if (state.occupiedSeatNumbers.includes(prevSeatNum)) {
                // Occupied seat: compute total from context
                let roundStart = lastDIdx >= 0 ? lastDIdx : ctxH.length;
                for (let ci = roundStart - 1; ci >= 0; ci--) {
                  if (ctxH[ci].target.startsWith('S')) roundStart = ci;
                  else break;
                }
                const roundCtx = ctxH.slice(roundStart);

                if (state._occupiedSplitSeats.includes(prevSeatNum)) {
                  // Split: check the sub-hand that was last active
                  const lastEntry = ctxH[ctxH.length - 1];
                  const subMatch = lastEntry.target.match(/^S\d+\.(\d+)$/);
                  const subIdx = subMatch ? parseInt(subMatch[1]) - 1 : 1;
                  const dealEntries = roundCtx.filter((e) => e.target === prevTag);
                  const subTag = `${prevTag}.${subIdx + 1}`;
                  const hitEntries = roundCtx.filter((e) => e.target === subTag);
                  const allRanks = [dealEntries[subIdx], ...hitEntries]
                    .filter(Boolean)
                    .map((e) => (e.rank === 'T' ? '10' : e.rank) as Rank);
                  if (allRanks.length > 0) {
                    prevSeatBusted = calculateHandTotal(allRanks.map((r) => createCard(r))).total >= 21;
                  }
                } else {
                  const seatRanks = roundCtx
                    .filter((e) => e.target === prevTag)
                    .map((e) => (e.rank === 'T' ? '10' : e.rank) as Rank);
                  if (seatRanks.length > 0) {
                    prevSeatBusted = calculateHandTotal(seatRanks.map((r) => createCard(r))).total >= 21;
                  }
                }
              } else {
                // Player seat: check hand total
                const prevSeatData = state.seats.find((s) => s.seatNumber === prevSeatNum);
                if (prevSeatData) {
                  const hand = prevSeatData.hands[prevSeatData.activeHandIndex];
                  if (hand.cards.length > 0) {
                    prevSeatBusted = calculateHandTotal(hand.cards).total > 21;
                  }
                }
              }

              if (!prevSeatBusted) {
                // Manual "Next" — just revert navigation, don't remove card
                const prevPlayerIdx = state.seats.findIndex((s) => s.seatNumber === prevSeatNum);
                set({
                  _activePlaySeat: prevSeatNum,
                  ...(prevPlayerIdx >= 0 ? { activeSeatIndex: prevPlayerIdx } : {}),
                });
                return;
              }
              // Bust auto-advance — fall through to remove the card that caused the bust
            }
            // First seat in play order → fall through to normal card undo
          }
        }

        if (state.cardHistory.length === 0) return;

        const lastCard = state.cardHistory[state.cardHistory.length - 1];
        const countDelta = getCardCountValue(lastCard.rank);

        const updates: Partial<GameState> = {
          runningCount: state.runningCount - countDelta,
          cardsSeen: state.cardsSeen - 1,
          cardHistory: state.cardHistory.slice(0, -1),
          cardContextHistory: state.cardContextHistory.slice(0, -1),
        };

        if (state.handPhase === 'table') {
          if (state._dealerHits.length > 0) {
            // Remove last dealer hit card
            updates.tableCards = state.tableCards.slice(0, -1);
            updates._dealerHits = state._dealerHits.slice(0, -1);
          } else {
            // No dealer hits — regress to player phase (pure navigation undo)
            const playOrder = getPlayOrder(state);
            const lastSeat = playOrder.length > 0 ? playOrder[playOrder.length - 1] : 0;
            // Restore _occupiedSplitSeats from context history
            const splitSeats: number[] = [];
            for (const sn of state.occupiedSeatNumbers) {
              if (state.cardContextHistory.some((e) => e.target.startsWith(`S${sn}.`))) {
                splitSeats.push(sn);
              }
            }
            set({
              handPhase: 'player',
              _activePlaySeat: lastSeat,
              _occupiedSplitSeats: splitSeats,
              ...(state.seats.findIndex((s) => s.seatNumber === lastSeat) >= 0
                ? { activeSeatIndex: state.seats.findIndex((s) => s.seatNumber === lastSeat) }
                : {}),
            });
            return;
          }
        } else if (state.handPhase === 'player') {
          // Use cardContextHistory to determine where the last card went
          const lastCtx = state.cardContextHistory.length > 0
            ? state.cardContextHistory[state.cardContextHistory.length - 1]
            : null;
          const lastTarget = lastCtx?.target ?? '';
          const seatMatch = lastTarget.match(/^S(\d+)/);
          const targetSeatNum = seatMatch ? parseInt(seatMatch[1]) : -1;

          if (targetSeatNum > 0 && state.occupiedSeatNumbers.includes(targetSeatNum)) {
            // Card went to an occupied seat (stored in tableCards) — remove from tableCards
            updates.tableCards = state.tableCards.slice(0, -1);
          } else if (targetSeatNum > 0 && state.playerSeatNumbers.includes(targetSeatNum)) {
            // Card went to a player seat — find and remove from that seat
            const targetSeatIdx = state.seats.findIndex((s) => s.seatNumber === targetSeatNum);
            if (targetSeatIdx >= 0) {
              const targetSeat = state.seats[targetSeatIdx];
              // Find the hand that has cards (use hand index from context if available)
              const handMatch = lastTarget.match(/^S\d+\.(\d+)$/);
              const handIdx = handMatch ? parseInt(handMatch[1]) - 1 : targetSeat.activeHandIndex;
              const targetHand = targetSeat.hands[handIdx];

              if (targetHand && targetHand.cards.length > 0) {
                let newHand = { ...targetHand, cards: targetHand.cards.slice(0, -1) };

                // Un-double: if was doubled and removing the 3rd card
                if (targetHand.doubled && targetHand.cards.length === 3) {
                  newHand = { ...newHand, doubled: false };
                }

                // Un-split check: merge back into pair hand
                if (newHand.cards.length === 0 && newHand.fromSplit && targetSeat.hands.length > 1) {
                  const prevHandIdx = handIdx - 1;
                  if (prevHandIdx >= 0) {
                    const prevHand = targetSeat.hands[prevHandIdx];
                    if (prevHand.fromSplit && prevHand.cards.length === 1) {
                      const mergedHand: PlayerHand = {
                        cards: [prevHand.cards[0], lastCard],
                        doubled: false,
                        fromSplit: false,
                      };
                      const newHands = targetSeat.hands.filter((_, j) => j !== handIdx);
                      newHands[prevHandIdx] = mergedHand;
                      const newSeat: PlayerSeat = { ...targetSeat, hands: newHands, activeHandIndex: prevHandIdx };
                      updates.seats = state.seats.map((s, i) =>
                        i === targetSeatIdx ? newSeat : s,
                      );
                      updates.activeSeatIndex = targetSeatIdx;
                      // Recompute deal order index + _activePlaySeat for early return
                      const earlyCtx = updates.cardContextHistory ?? state.cardContextHistory.slice(0, -1);
                      updates._dealOrderIndex = recomputeDealOrderIndex(earlyCtx);
                      const dealOrderLen = getPlayOrder(state).length;
                      if (updates._dealOrderIndex < dealOrderLen * 2 + 1) {
                        updates._activePlaySeat = 0;
                      } else if (targetSeatNum > 0) {
                        updates._activePlaySeat = targetSeatNum;
                      }
                      set(updates);
                      return;
                    }
                  }
                }

                const newHands = targetSeat.hands.map((h, j) =>
                  j === handIdx ? newHand : h,
                );
                const newSeat: PlayerSeat = { ...targetSeat, hands: newHands, activeHandIndex: handIdx };
                updates.seats = state.seats.map((s, i) =>
                  i === targetSeatIdx ? newSeat : s,
                );
                updates.activeSeatIndex = targetSeatIdx;
              }
            }
          } else if (lastTarget === 'D') {
            // Undo dealer card — stay in deal mode (mid-deal, not idle)
            updates.dealerUpcard = null;
          } else {
            // Fallback: undo from active seat
            const seat = state.seats[state.activeSeatIndex];
            const hand = seat.hands[seat.activeHandIndex];
            if (hand.cards.length > 0) {
              const newHand = { ...hand, cards: hand.cards.slice(0, -1) };
              const newHands = seat.hands.map((h, j) =>
                j === seat.activeHandIndex ? newHand : h,
              );
              const newSeat: PlayerSeat = { ...seat, hands: newHands };
              updates.seats = state.seats.map((s, i) =>
                i === state.activeSeatIndex ? newSeat : s,
              );
            } else {
              updates.dealerUpcard = null;
              updates.handPhase = 'idle';
            }
          }

          // Recompute _dealOrderIndex from remaining context (single point of truth)
          const remainingCtx = updates.cardContextHistory ?? state.cardContextHistory.slice(0, -1);
          updates._dealOrderIndex = recomputeDealOrderIndex(remainingCtx);

          // Fix _activePlaySeat: back to deal mode or restore to undone seat
          const dealOrderLen = getPlayOrder(state).length;
          if (updates._dealOrderIndex < dealOrderLen * 2 + 1) {
            updates._activePlaySeat = 0;  // back in deal mode
          } else if (targetSeatNum > 0) {
            updates._activePlaySeat = targetSeatNum;  // restore to undone seat
          }

          // If we've undone back to the start, return to idle
          if (updates._dealOrderIndex === 0) {
            updates.handPhase = 'idle';
          }
        }

        set(updates);
      },

      undoCurrentHand: () => {
        const state = get();
        const handCards: Card[] = [];
        if (state.dealerUpcard) handCards.push(state.dealerUpcard);
        for (const seat of state.seats) {
          for (const hand of seat.hands) {
            handCards.push(...hand.cards);
          }
        }
        // Include deal-mode tableCards (occupied seat cards dealt during deal mode)
        handCards.push(...state.tableCards);

        if (handCards.length === 0) return;

        let rc = state.runningCount;
        for (const card of handCards) {
          rc -= getCardCountValue(card.rank);
        }

        set({
          runningCount: rc,
          cardsSeen: state.cardsSeen - handCards.length,
          cardHistory: state.cardHistory.slice(0, -handCards.length),
          cardContextHistory: state.cardContextHistory.slice(0, -handCards.length),
          handPhase: 'idle',
          dealerUpcard: null,
          seats: createEmptySeats(state.playerSeatNumbers),
          activeSeatIndex: 0,
          tableCards: [],
          _dealOrderIndex: 0,
          _activePlaySeat: 0,
          _dealerHits: [],
          _splitDealInProgress: false,
          _occupiedSplitSeats: [],
          _occupiedActiveSubHand: 0,
          _observeRound: false,
        });
      },

      confirmHand: () => {
        const state = get();

        let lastConfirmedRound: LastConfirmedRound | null = null;
        const hasCards = state.seats.some((s) => s.hands.some((h) => h.cards.length > 0));
        if (state.dealerUpcard && hasCards) {
          lastConfirmedRound = {
            dealerUpcard: state.dealerUpcard,
            seats: state.seats.map((seat) => ({
              seatNumber: seat.seatNumber,
              hands: seat.hands
                .filter((h) => h.cards.length > 0)
                .map((h) => ({
                  id: generateId(),
                  cards: [...h.cards],
                  doubled: h.doubled,
                  fromSplit: h.fromSplit,
                })),
              betOverride: seat.betOverride,
            })),
          };
        }

        // Count total hands across all seats
        let totalHands = 0;
        for (const seat of state.seats) {
          for (const hand of seat.hands) {
            if (hand.cards.length > 0) totalHands++;
          }
        }

        // Push RoundSnapshot with auto-determined outcomes
        let newHistory = state.shoeRoundHistory;
        if (lastConfirmedRound && state.dealerUpcard) {
          const dealerCards = [state.dealerUpcard, ...state._dealerHits];
          const canDetermineOutcome = dealerCards.length >= 2;
          const snapshot: RoundSnapshot = {
            dealerUpcard: state.dealerUpcard,
            seats: lastConfirmedRound.seats.map((s) => ({
              seatNumber: s.seatNumber,
              hands: s.hands.map((h) => ({
                id: h.id,
                cards: h.cards,
                doubled: h.doubled,
                fromSplit: h.fromSplit,
                total: calculateHandTotal(h.cards).total,
                outcome: canDetermineOutcome && state.playerSeatNumbers.includes(s.seatNumber)
                  ? determineOutcome(h.cards, dealerCards, h.fromSplit)
                  : undefined,
              })),
              betAmount: 0, // Will be set by historyRecorder
            })),
            tableCards: [],
            runningCount: state.runningCount,
            trueCount: 0, // Will be calculated by consumer
            timestamp: Date.now(),
          };
          newHistory = [...state.shoeRoundHistory, snapshot];
        }

        // Preserve betOverride across rounds
        const newSeats = state.playerSeatNumbers.map((n) => {
          const oldSeat = state.seats.find((s) => s.seatNumber === n);
          return {
            seatNumber: n,
            hands: [createEmptyHand()],
            activeHandIndex: 0,
            betOverride: oldSeat?.betOverride ?? null,
          };
        });

        set({
          handPhase: 'table',
          dealerUpcard: null,
          seats: newSeats,
          activeSeatIndex: 0,
          tableCards: [],
          lastConfirmedRound,
          shoeHandCount: state.shoeHandCount + totalHands,
          shoeRoundHistory: newHistory,
          _dealOrderIndex: 0,
          _activePlaySeat: 0,
          _dealerHits: [],
          _splitDealInProgress: false,
          _occupiedSplitSeats: [],
          _occupiedActiveSubHand: 0,
        });
      },

      nextHand: () => set((state) => ({
        handPhase: 'idle',
        tableCards: [],
        lastConfirmedRound: null,
        seats: createEmptySeats(state.playerSeatNumbers).map((s) => {
          const old = state.seats.find((os) => os.seatNumber === s.seatNumber);
          return old ? { ...s, betOverride: old.betOverride } : s;
        }),
        activeSeatIndex: 0,
        _dealOrderIndex: 0,
        _activePlaySeat: 0,
        _dealerHits: [],
        _splitDealInProgress: false,
        _occupiedSplitSeats: [],
        _occupiedActiveSubHand: 0,
        _observeRound: false,
      })),

      setHandPhase: (phase: HandPhase) => {
        const updates: Partial<GameState> = { handPhase: phase };
        if (phase === 'player') {
          updates.activeSeatIndex = 0;
        }
        if (phase === 'table') {
          updates._activePlaySeat = 0;
          updates._dealerHits = [];
          updates._occupiedSplitSeats = [];
          updates._occupiedActiveSubHand = 0;
        } else if (phase === 'idle') {
          updates._activePlaySeat = 0;
        }
        set(updates);
      },

      toggleWong: () => set((state) => ({ isWongedOut: !state.isWongedOut })),

      toggleObserveRound: () => {
        const state = get();
        if (state.handPhase !== 'idle' || state.playerSeatNumbers.length > 0) return;
        set({ _observeRound: !state._observeRound });
      },

      newShoe: () =>
        set((state) => ({
          runningCount: 0,
          cardsSeen: 0,
          cardHistory: [],
          cardContextHistory: [],
          handPhase: 'idle',
          dealerUpcard: null,
          seats: createEmptySeats(state.playerSeatNumbers).map((s) => {
            const old = state.seats.find((os) => os.seatNumber === s.seatNumber);
            return old ? { ...s, betOverride: old.betOverride } : s;
          }),
          activeSeatIndex: 0,
          tableCards: [],
          isWongedOut: false,
          currentShoeId: generateId(),
          shoeHandCount: 0,
          lastConfirmedRound: null,
          peakTrueCount: 0,
          minTrueCount: 0,
          shoeRoundHistory: [],
          _dealOrderIndex: 0,
          _activePlaySeat: 0,
          _dealerHits: [],
          _splitDealInProgress: false,
          _occupiedSplitSeats: [],
          _occupiedActiveSubHand: 0,
          _observeRound: false,
        })),

      updateTrueCountExtremes: (tc: number) => {
        const state = get();
        const updates: Partial<GameState> = {};
        if (tc > state.peakTrueCount) updates.peakTrueCount = tc;
        if (tc < state.minTrueCount) updates.minTrueCount = tc;
        if (Object.keys(updates).length > 0) set(updates);
      },

      splitHand: () => {
        const state = get();
        if (state.handPhase !== 'player') return;

        const seat = state.seats[state.activeSeatIndex];
        const hand = seat.hands[seat.activeHandIndex];

        if (hand.cards.length !== 2) return;
        if (seat.hands.length >= 2) return;

        // Check if pair (same value)
        const total = calculateHandTotal(hand.cards);
        if (!total.isPair) return;

        const card0 = hand.cards[0];
        const card1 = hand.cards[1];

        const newHand0: PlayerHand = { cards: [card0], doubled: false, fromSplit: true };
        const newHand1: PlayerHand = { cards: [card1], doubled: false, fromSplit: true };

        const newHands = [...seat.hands];
        newHands.splice(seat.activeHandIndex, 1, newHand0, newHand1);

        const newSeat: PlayerSeat = { ...seat, hands: newHands, activeHandIndex: seat.activeHandIndex };
        set({
          seats: state.seats.map((s, i) =>
            i === state.activeSeatIndex ? newSeat : s,
          ),
          _splitDealInProgress: true,
        });
      },

      splitOccupied: () => {
        const state = get();
        if (state.handPhase !== 'player') return;
        if (!state.occupiedSeatNumbers.includes(state._activePlaySeat)) return;
        if (state._occupiedSplitSeats.includes(state._activePlaySeat)) return;

        // Check occupied seat has exactly 2 cards that form a pair
        const seatTag = `S${state._activePlaySeat}`;
        const ctxH = state.cardContextHistory;
        let dIdx = -1;
        for (let ci = ctxH.length - 1; ci >= 0; ci--) {
          if (ctxH[ci].target === 'D') { dIdx = ci; break; }
        }
        let roundStart = dIdx >= 0 ? dIdx : 0;
        for (let ci = roundStart - 1; ci >= 0; ci--) {
          if (ctxH[ci].target.startsWith('S')) roundStart = ci;
          else break;
        }
        const roundCtx = ctxH.slice(roundStart);
        const seatEntries = roundCtx.filter((e) => e.target === seatTag);
        if (seatEntries.length !== 2) return;

        const r0 = (seatEntries[0].rank === 'T' ? '10' : seatEntries[0].rank) as Rank;
        const r1 = (seatEntries[1].rank === 'T' ? '10' : seatEntries[1].rank) as Rank;
        if (createCard(r0).value !== createCard(r1).value) return;

        set({
          _occupiedSplitSeats: [...state._occupiedSplitSeats, state._activePlaySeat],
          _occupiedActiveSubHand: 0,
        });
      },

      doubleDown: () => {
        const state = get();
        if (state.handPhase !== 'player') return;

        const seat = state.seats[state.activeSeatIndex];
        const hand = seat.hands[seat.activeHandIndex];

        if (hand.cards.length !== 2) return;
        if (hand.doubled) return;

        const newHand: PlayerHand = { ...hand, doubled: true };
        const newHands = seat.hands.map((h, j) =>
          j === seat.activeHandIndex ? newHand : h,
        );
        const newSeat: PlayerSeat = { ...seat, hands: newHands };
        set({
          seats: state.seats.map((s, i) =>
            i === state.activeSeatIndex ? newSeat : s,
          ),
        });
      },

      setBetOverride: (seatIndex: number, amount: number | null) => {
        const state = get();
        if (seatIndex < 0 || seatIndex >= state.seats.length) return;
        const newSeats = state.seats.map((s, i) =>
          i === seatIndex ? { ...s, betOverride: amount } : s,
        );
        set({ seats: newSeats });
      },

      setPlayerSeats: (seatNumbers: number[]) => {
        const state = get();
        if (state.handPhase !== 'idle') return;
        const clamped = seatNumbers.filter((n) => n >= 1 && n <= 7).slice(0, 4);
        if (clamped.length === 0) return;
        const sorted = [...new Set(clamped)].sort((a, b) => a - b);
        // Preserve betOverrides
        const newSeats = sorted.map((n) => {
          const old = state.seats.find((s) => s.seatNumber === n);
          return {
            seatNumber: n,
            hands: [createEmptyHand()],
            activeHandIndex: 0,
            betOverride: old?.betOverride ?? null,
          };
        });
        set({
          playerSeatNumbers: sorted,
          seats: newSeats,
          activeSeatIndex: 0,
        });
      },

      toggleSeat: (seatNumber: number) => {
        const state = get();
        if (state.handPhase !== 'idle') return;
        if (seatNumber < 1 || seatNumber > 7) return;

        let newNumbers: number[];
        if (state.playerSeatNumbers.includes(seatNumber)) {
          // Remove — but don't allow removing last seat
          if (state.playerSeatNumbers.length <= 1) return;
          newNumbers = state.playerSeatNumbers.filter((n) => n !== seatNumber);
        } else {
          // Add — max 4
          if (state.playerSeatNumbers.length >= 4) return;
          newNumbers = [...state.playerSeatNumbers, seatNumber].sort((a, b) => a - b);
        }

        const newSeats = newNumbers.map((n) => {
          const old = state.seats.find((s) => s.seatNumber === n);
          return old
            ? { ...old, hands: [createEmptyHand()], activeHandIndex: 0 }
            : { seatNumber: n, hands: [createEmptyHand()], activeHandIndex: 0, betOverride: null };
        });

        // Also remove from occupied if it was there
        set({
          playerSeatNumbers: newNumbers,
          occupiedSeatNumbers: state.occupiedSeatNumbers.filter((n) => !newNumbers.includes(n)),
          seats: newSeats,
          activeSeatIndex: 0,
        });
      },

      toggleOccupiedSeat: (seatNumber: number) => {
        const state = get();
        if (seatNumber < 1 || seatNumber > 7) return;
        // Can't mark your own seat as occupied
        if (state.playerSeatNumbers.includes(seatNumber)) return;

        if (state.occupiedSeatNumbers.includes(seatNumber)) {
          set({ occupiedSeatNumbers: state.occupiedSeatNumbers.filter((n) => n !== seatNumber) });
        } else {
          set({ occupiedSeatNumbers: [...state.occupiedSeatNumbers, seatNumber].sort((a, b) => a - b) });
        }
      },

      setActiveSeat: (index: number) => {
        const state = get();
        if (index >= 0 && index < state.seats.length) {
          set({ activeSeatIndex: index });
        }
      },

      nextHandOrSeat: () => {
        const state = get();
        const seat = state.seats[state.activeSeatIndex];

        if (seat.activeHandIndex < seat.hands.length - 1) {
          // Advance hand within seat
          const newSeat: PlayerSeat = { ...seat, activeHandIndex: seat.activeHandIndex + 1 };
          set({
            seats: state.seats.map((s, i) =>
              i === state.activeSeatIndex ? newSeat : s,
            ),
          });
        } else if (state.activeSeatIndex < state.seats.length - 1) {
          // Advance to next seat
          const nextIdx = state.activeSeatIndex + 1;
          const nextSeat = state.seats[nextIdx];
          const resetSeat = { ...nextSeat, activeHandIndex: 0 };
          set({
            activeSeatIndex: nextIdx,
            seats: state.seats.map((s, i) =>
              i === nextIdx ? resetSeat : s,
            ),
          });
        }
        // else: at last hand of last seat — stay
      },

      updateRoundOutcome: (roundIndex: number, seatIndex: number, handIndex: number, outcome: HandOutcome, netResult: number) => {
        const state = get();
        if (roundIndex < 0 || roundIndex >= state.shoeRoundHistory.length) return;

        const newHistory = [...state.shoeRoundHistory];
        const round = { ...newHistory[roundIndex] };
        const newSeats = [...round.seats];
        const seat = { ...newSeats[seatIndex] };
        const newHands = [...seat.hands];
        newHands[handIndex] = { ...newHands[handIndex], outcome, netResult };
        seat.hands = newHands;
        newSeats[seatIndex] = seat;
        round.seats = newSeats;
        newHistory[roundIndex] = round;
        set({ shoeRoundHistory: newHistory });
      },

      // Legacy compat
      setNumBoxes: (n: number) => {
        const state = get();
        if (state.handPhase !== 'idle') return;
        const clamped = Math.max(1, Math.min(4, n));
        const seatNumbers = Array.from({ length: clamped }, (_, i) => i + 1);
        state.setPlayerSeats(seatNumbers);
      },

      setActiveBox: (index: number) => {
        get().setActiveSeat(index);
      },

      nextBox: () => {
        get().nextHandOrSeat();
      },
    }),
    {
      name: 'card-counter-game',
      version: 3,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          return {
            ...persisted,
            playerSeatNumbers: [1],
            occupiedSeatNumbers: [],
            shoeRoundHistory: [],
            lastConfirmedRound: null,
          };
        }
        if (version < 3) {
          const numBoxes = persisted.numBoxes ?? 1;
          return {
            ...persisted,
            playerSeatNumbers: Array.from({ length: numBoxes }, (_, i) => i + 1),
            occupiedSeatNumbers: [],
            shoeRoundHistory: [],
            lastConfirmedRound: null,
          };
        }
        if (!persisted.occupiedSeatNumbers) {
          persisted.occupiedSeatNumbers = [];
        }
      },
      partialize: (state) => ({
        runningCount: state.runningCount,
        cardsSeen: state.cardsSeen,
        cardHistory: state.cardHistory,
        isWongedOut: state.isWongedOut,
        currentShoeId: state.currentShoeId,
        shoeHandCount: state.shoeHandCount,
        peakTrueCount: state.peakTrueCount,
        minTrueCount: state.minTrueCount,
        playerSeatNumbers: state.playerSeatNumbers,
        occupiedSeatNumbers: state.occupiedSeatNumbers,
      }),
    },
  ),
);
