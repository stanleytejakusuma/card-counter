import { useEffect } from 'react';
import type { Rank } from '../engine/types.js';
import type { HandOutcome } from '../engine/historyTypes.js';
import { useGameStore } from '../stores/gameStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useSessionStore } from '../stores/sessionStore.js';
import { useHistoryViewStore } from '../stores/historyViewStore.js';

const KEY_TO_RANK: Record<string, Rank> = {
  '1': 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '0': '10',
  a: 'A',
  j: '10',
  q: '10',
  k: '10',
};

const KEY_TO_OUTCOME: Record<string, HandOutcome> = {
  '[': 'win',
  ']': 'loss',
  '\\': 'push',
  '=': 'blackjack',
  '-': 'surrender',
  '/': 'even_money',
};

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const historyView = useHistoryViewStore.getState();

      // --- History viewer navigation ---
      if (historyView.isOpen) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            historyView.close();
            return;
          case 'Backspace':
            e.preventDefault();
            historyView.goBack();
            return;
          case 'ArrowUp':
            e.preventDefault();
            historyView.moveSelection(-1);
            return;
          case 'ArrowDown':
            e.preventDefault();
            historyView.moveSelection(1);
            return;
          case 'Enter':
            e.preventDefault();
            historyView.drillIn();
            return;
        }
        return;
      }

      // --- Outcome recording ---
      const session = useSessionStore.getState();
      if (session.awaitingOutcome) {
        const outcome = KEY_TO_OUTCOME[e.key];
        if (outcome) {
          if (outcome === 'surrender' && !useSettingsStore.getState().rules.lateSurrender) {
            // Ignore — surrender not allowed
          } else if (outcome === 'even_money') {
            // Even money only valid when dealer had Ace
            const game = useGameStore.getState();
            const dealerUpcard = game.lastConfirmedRound?.dealerUpcard;
            if (dealerUpcard?.rank === 'A') {
              e.preventDefault();
              session.recordOutcome(outcome);
              return;
            }
          } else {
            e.preventDefault();
            session.recordOutcome(outcome);
            return;
          }
        }
        if (KEY_TO_RANK[key]) {
          session.clearAwaitingOutcome();
        }
      }

      // --- Shift+1-7: Seat toggle (idle only) ---
      if (e.shiftKey && e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        const game = useGameStore.getState();
        if (game.handPhase === 'idle') {
          game.toggleSeat(parseInt(e.key, 10));
        }
        return;
      }

      // --- Card input ---
      const rank = KEY_TO_RANK[key];
      if (rank) {
        e.preventDefault();
        useGameStore.getState().inputCard(rank);
        useSessionStore.getState().startSession();
        return;
      }

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          {
            const game = useGameStore.getState();
            if (game.handPhase === 'idle') {
              game.setHandPhase('dealer');
            } else if (game.handPhase === 'dealer') {
              game.setHandPhase('player');
            } else if (game.handPhase === 'player') {
              // Advance hand within seat, then seat, then table
              const seat = game.seats[game.activeSeatIndex];
              if (seat.activeHandIndex < seat.hands.length - 1) {
                game.nextHandOrSeat();
              } else if (game.activeSeatIndex < game.seats.length - 1) {
                game.nextHandOrSeat();
              } else {
                game.setHandPhase('table');
              }
            } else if (game.handPhase === 'table') {
              game.setHandPhase('dealer');
            }
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          {
            const game = useGameStore.getState();
            if (game.handPhase === 'table') {
              game.nextHand();
            } else if (game.handPhase !== 'idle') {
              game.confirmHand();
              useSessionStore.getState().incrementHands();
            }
          }
          break;

        case 'Backspace':
          e.preventDefault();
          useGameStore.getState().undoLastCard();
          break;

        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            useGameStore.getState().undoCurrentHand();
          }
          break;

        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            useGameStore.getState().newShoe();
          }
          break;

        case 'w':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            useGameStore.getState().toggleWong();
          }
          break;

        case 'p':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            useGameStore.getState().splitHand();
          }
          break;

        case 'd':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            useGameStore.getState().doubleDown();
          }
          break;

        case 't':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            useGameStore.getState().setHandPhase('table');
          }
          break;

        case 'h':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            useHistoryViewStore.getState().toggle();
          }
          break;

        case 'Escape':
          e.preventDefault();
          useSettingsStore.getState().toggleStealth();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
