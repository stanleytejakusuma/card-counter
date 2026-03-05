import type { HandRecord, ShoeRecord, SessionRecord } from '../engine/historyTypes.js';
import {
  putHand, putShoe, putSession,
  updateShoeEnd, updateSessionEnd,
  getAllSessions, getHandsBySession, getShoesBySession,
  deleteSession,
} from './historyDb.js';
import { useGameStore } from '../stores/gameStore.js';
import { useSessionStore } from '../stores/sessionStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { calculateHandTotal } from '../engine/hand.js';
import { calculateTrueCount, calculateDecksRemaining } from '../engine/counting.js';
import { getStrategyAdvice } from '../engine/strategy.js';
import { calculateSpreadBet } from '../engine/kelly.js';

let initialized = false;
let _finalizingSessionId: string | null = null;

/**
 * Finalize a session: close current shoe, tally stats from IDB hands, write session end.
 * Guards against double-finalization.
 */
export async function finalizeSession(sessionId: string): Promise<void> {
  if (_finalizingSessionId === sessionId) return;
  _finalizingSessionId = sessionId;

  try {
    // Finalize current shoe if still open
    const gameState = useGameStore.getState();
    if (gameState.currentShoeId) {
      await updateShoeEnd(
        gameState.currentShoeId,
        Date.now(),
        gameState.shoeHandCount,
        gameState.cardsSeen,
      ).catch(console.error);
    }

    // Query all hands for this session from IndexedDB (source of truth)
    const hands = await getHandsBySession(sessionId);
    const shoes = await getShoesBySession(sessionId);

    const stats = tallyHandStats(hands);
    const sessionStore = useSessionStore.getState();

    await updateSessionEnd(sessionId, Date.now(), sessionStore.bankroll, {
      totalHands: stats.totalHands,
      totalShoes: shoes.length,
      handsWon: stats.handsWon,
      handsLost: stats.handsLost,
      handsPushed: stats.handsPushed,
      blackjacks: stats.blackjacks,
      deviationsTaken: sessionStore.deviationsTaken,
    });
  } finally {
    _finalizingSessionId = null;
  }
}

function tallyHandStats(hands: HandRecord[]) {
  let handsWon = 0, handsLost = 0, handsPushed = 0, blackjacks = 0;
  for (const h of hands) {
    if (!h.outcome) continue;
    switch (h.outcome) {
      case 'win': case 'even_money': handsWon++; break;
      case 'loss': case 'surrender': handsLost++; break;
      case 'push': handsPushed++; break;
      case 'blackjack': blackjacks++; handsWon++; break;
    }
  }
  return { totalHands: hands.length, handsWon, handsLost, handsPushed, blackjacks };
}

/**
 * Boot-time cleanup: delete empty orphan sessions, retroactively finalize sessions with hands but no endTime.
 */
export async function cleanupOrphanSessions(): Promise<void> {
  const sessions = await getAllSessions();

  for (const session of sessions) {
    const hands = await getHandsBySession(session.id);

    if (hands.length === 0 && !session.endTime) {
      // Empty orphan — delete entirely
      await deleteSession(session.id).catch(console.error);
      continue;
    }

    if (hands.length > 0 && !session.endTime) {
      // Has hands but never finalized — retroactively compute stats
      const shoes = await getShoesBySession(session.id);
      const stats = tallyHandStats(hands);
      let netResult = 0;
      for (const h of hands) {
        if (h.netResult != null) netResult += h.netResult;
      }
      const endingBankroll = session.startingBankroll + netResult;
      const lastHandTime = Math.max(...hands.map((h) => h.timestamp));

      await updateSessionEnd(session.id, lastHandTime, endingBankroll, {
        totalHands: stats.totalHands,
        totalShoes: shoes.length,
        handsWon: stats.handsWon,
        handsLost: stats.handsLost,
        handsPushed: stats.handsPushed,
        blackjacks: stats.blackjacks,
        deviationsTaken: session.deviationsTaken,
      }).catch(console.error);
    }
  }
}

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

      const spreadBet = calculateSpreadBet({
        trueCount: tc,
        minBet: session.minBet,
        maxBet: session.maxBet,
        unitSize: session.unitSize,
      });

      // Get snapshot outcomes (computed in confirmHand)
      const snapshotHistory = state.shoeRoundHistory;
      const lastSnapshot = snapshotHistory.length > 0 ? snapshotHistory[snapshotHistory.length - 1] : null;

      const pendingOutcomes: { handId: string; betAmount: number; seatIndex: number; seatNumber: number; handIndex: number; label: string }[] = [];
      let hasDeviation = false;
      let handCounter = 0;

      // Nested loop: seat → hand
      for (let i = 0; i < seats.length; i++) {
        const seat = seats[i];
        const baseBet = seat.betOverride ?? spreadBet.amount;

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

          // Use auto-determined outcome from snapshot if available
          const snapshotOutcome = lastSnapshot?.seats[i]?.hands[j]?.outcome ?? null;

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
            betRecommendation: spreadBet.amount,
            outcome: snapshotOutcome,
            betAmount: actualBet,
            netResult: null,
            boxIndex: i,
            seatNumber: seat.seatNumber,
            handIndex: seat.hands.length > 1 ? j : undefined,
            doubled: hand.doubled || undefined,
            fromSplit: hand.fromSplit || undefined,
          };

          putHand(record).catch(console.error);

          // Only track outcomes/bets for player seats (not occupied/other)
          if (state.playerSeatNumbers.includes(seat.seatNumber)) {
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
          }

          handCounter++;
        }
      }

      // Auto-record outcomes if available, otherwise prompt UI
      if (pendingOutcomes.length > 0 && lastSnapshot && pendingOutcomes.every((p) => lastSnapshot.seats[p.seatIndex]?.hands[p.handIndex]?.outcome)) {
        session.setAwaitingOutcomes(pendingOutcomes);
        for (const pending of pendingOutcomes) {
          const outcome = lastSnapshot.seats[pending.seatIndex].hands[pending.handIndex].outcome!;
          session.recordOutcome(outcome);
        }
      } else if (pendingOutcomes.length > 0) {
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
          const baseBet = confirmedSeat?.betOverride ?? spreadBet.amount;
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

  // Watch for session start + session end → write/finalize SessionRecord
  useSessionStore.subscribe((state, prevState) => {
    // Session created
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

    // Session ended (resetSession was called — currentSessionId went from value to null)
    if (prevState.currentSessionId && !state.currentSessionId) {
      finalizeSession(prevState.currentSessionId).catch(console.error);
    }
  });

  // --- Page lifecycle handlers ---

  let visibilityTimer: ReturnType<typeof setTimeout> | null = null;

  window.addEventListener('visibilitychange', () => {
    const sessionId = useSessionStore.getState().currentSessionId;

    if (document.visibilityState === 'hidden' && sessionId) {
      // Delayed finalization — 30s grace period for brief tab switches
      visibilityTimer = setTimeout(() => {
        visibilityTimer = null;
        const currentId = useSessionStore.getState().currentSessionId;
        if (currentId === sessionId) {
          finalizeSession(sessionId).catch(console.error);
        }
      }, 30_000);
    } else if (document.visibilityState === 'visible' && visibilityTimer) {
      // Came back before timeout — cancel finalization
      clearTimeout(visibilityTimer);
      visibilityTimer = null;
    }
  });

  window.addEventListener('pagehide', () => {
    const session = useSessionStore.getState();
    if (!session.currentSessionId) return;

    // Best-effort sync using store stats (synchronous — can't read IDB during pagehide)
    const shoes = useGameStore.getState().currentShoeId ? 1 : 0; // approximate
    const payload: Partial<SessionRecord> = {
      id: session.currentSessionId,
      endTime: Date.now(),
      endingBankroll: session.bankroll,
      netPnL: session.bankroll - session.startingBankroll,
      totalHands: session.handsPlayed,
      totalShoes: shoes,
      handsWon: session.handsWon,
      handsLost: session.handsLost,
      handsPushed: session.handsPushed,
      blackjacks: session.blackjacks,
      deviationsTaken: session.deviationsTaken,
    };

    // keepalive fetch survives page close
    fetch(`/__data/history/sessions`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
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
