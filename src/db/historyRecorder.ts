import type { HandRecord, ShoeRecord, SessionRecord } from '../engine/historyTypes.js';
import { putHand, putShoe, putSession, updateShoeEnd } from './historyDb.js';
import { useGameStore } from '../stores/gameStore.js';
import { useSessionStore } from '../stores/sessionStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { calculateHandTotal } from '../engine/hand.js';
import { calculateTrueCount, calculateDecksRemaining } from '../engine/counting.js';
import { getStrategyAdvice } from '../engine/strategy.js';
import { calculateKellyBet } from '../engine/kelly.js';

let initialized = false;

export function initHistoryRecorder() {
  if (initialized) return;
  initialized = true;

  let prevShoeId = useGameStore.getState().currentShoeId;

  // Watch for lastConfirmedRound changes → write HandRecords
  useGameStore.subscribe((state, prevState) => {
    // --- Hand recording ---
    if (state.lastConfirmedRound && state.lastConfirmedRound !== prevState.lastConfirmedRound) {
      const session = useSessionStore.getState();
      const settings = useSettingsStore.getState();
      const shoeId = state.currentShoeId;
      const sessionId = session.currentSessionId;

      if (!shoeId || !sessionId) return;

      const { dealerUpcard, seats } = state.lastConfirmedRound;
      const decks = settings.rules.decks;
      const tc = calculateTrueCount(state.runningCount, state.cardsSeen, decks);
      const dr = calculateDecksRemaining(state.cardsSeen, decks);

      state.updateTrueCountExtremes(tc);

      const kellyBet = calculateKellyBet({
        bankroll: session.bankroll,
        trueCount: tc,
        minBet: session.minBet,
        maxBet: session.maxBet,
        kellyFraction: session.kellyFraction,
        baseHouseEdge: 0.005,
        edgePerTrueCount: 0.005,
        unitSize: session.unitSize,
      });

      const pendingOutcomes: { handId: string; betAmount: number; seatIndex: number; seatNumber: number; handIndex: number; label: string }[] = [];
      let hasDeviation = false;
      let handCounter = 0;

      // Nested loop: seat → hand
      for (let i = 0; i < seats.length; i++) {
        const seat = seats[i];
        const baseBet = seat.betOverride ?? kellyBet.amount;

        for (let j = 0; j < seat.hands.length; j++) {
          const hand = seat.hands[j];
          if (hand.cards.length === 0) continue;

          const actualBet = hand.doubled ? baseBet * 2 : baseBet;
          const handTotal = calculateHandTotal(hand.cards);
          const advice = getStrategyAdvice(hand.cards, dealerUpcard, tc, settings.rules);

          const adviceStr = advice.isDeviation
            ? `${advice.action} (${advice.deviationName})`
            : advice.action;

          if (advice.isDeviation) hasDeviation = true;

          const record: HandRecord = {
            id: hand.id,
            sessionId,
            shoeId,
            handNumber: state.shoeHandCount - countTotalHands(seats) + handCounter + 1,
            timestamp: Date.now(),
            dealerUpcard,
            playerCards: hand.cards,
            handTotal: handTotal.total,
            runningCount: state.runningCount,
            trueCount: tc,
            decksRemaining: dr,
            strategyAdvice: adviceStr,
            betRecommendation: kellyBet.amount,
            outcome: null,
            betAmount: actualBet,
            netResult: null,
            boxIndex: i,
            seatNumber: seat.seatNumber,
            handIndex: seat.hands.length > 1 ? j : undefined,
            doubled: hand.doubled || undefined,
            fromSplit: hand.fromSplit || undefined,
          };

          putHand(record).catch(console.error);

          const label = seat.hands.length > 1
            ? `Seat ${seat.seatNumber}.${j + 1}`
            : `Seat ${seat.seatNumber}`;

          pendingOutcomes.push({
            handId: hand.id,
            betAmount: actualBet,
            seatIndex: i,
            seatNumber: seat.seatNumber,
            handIndex: j,
            label,
          });

          handCounter++;
        }
      }

      if (pendingOutcomes.length > 0) {
        session.setAwaitingOutcomes(pendingOutcomes);
      }

      if (hasDeviation) {
        session.incrementDeviations();
      }

      // Update round snapshot bet amounts
      const roundHistory = state.shoeRoundHistory;
      if (roundHistory.length > 0) {
        const lastRound = roundHistory[roundHistory.length - 1];
        const updatedSeats = lastRound.seats.map((s, idx) => {
          const confirmedSeat = seats[idx];
          const baseBet = confirmedSeat?.betOverride ?? kellyBet.amount;
          return { ...s, betAmount: baseBet };
        });
        const updatedRound = { ...lastRound, seats: updatedSeats, trueCount: tc };
        const newHistory = [...roundHistory];
        newHistory[newHistory.length - 1] = updatedRound;
        // Use set directly via the store
        useGameStore.setState({ shoeRoundHistory: newHistory });
      }
    }

    // --- Shoe change recording ---
    const currentShoeId = state.currentShoeId;
    if (currentShoeId !== prevShoeId) {
      const session = useSessionStore.getState();
      const sessionId = session.currentSessionId;

      if (prevShoeId && sessionId) {
        updateShoeEnd(
          prevShoeId,
          Date.now(),
          prevState.shoeHandCount,
          prevState.cardsSeen,
        ).catch(console.error);
      }

      if (currentShoeId && sessionId) {
        const shoe: ShoeRecord = {
          id: currentShoeId,
          sessionId,
          startTime: Date.now(),
          endTime: null,
          totalHands: 0,
          cardsDealt: 0,
          peakTrueCount: 0,
          minTrueCount: 0,
        };
        putShoe(shoe).catch(console.error);
      }

      prevShoeId = currentShoeId;
    }
  });

  // Watch for session start → write SessionRecord
  useSessionStore.subscribe((state, prevState) => {
    if (state.currentSessionId && state.currentSessionId !== prevState.currentSessionId) {
      const settings = useSettingsStore.getState();
      const record: SessionRecord = {
        id: state.currentSessionId,
        startTime: state.sessionStartTime ?? Date.now(),
        endTime: null,
        startingBankroll: state.startingBankroll,
        endingBankroll: null,
        netPnL: null,
        totalHands: 0,
        totalShoes: 0,
        rules: { ...settings.rules },
        handsWon: 0,
        handsLost: 0,
        handsPushed: 0,
        blackjacks: 0,
        deviationsTaken: 0,
      };
      putSession(record).catch(console.error);
    }
  });
}

function countTotalHands(seats: { hands: { cards: any[] }[] }[]): number {
  let count = 0;
  for (const seat of seats) {
    for (const hand of seat.hands) {
      if (hand.cards.length > 0) count++;
    }
  }
  return count;
}
