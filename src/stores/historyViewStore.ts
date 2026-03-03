import { create } from 'zustand';
import type { HistoryView, SessionRecord, ShoeRecord, HandRecord } from '../engine/historyTypes.js';
import {
  getAllSessions,
  getShoesBySession,
  getHandsByShoe,
  getHandById,
} from '../db/historyDb.js';

interface HistoryViewState {
  isOpen: boolean;
  view: HistoryView;
  selectedIndex: number;

  // Loaded data
  sessions: SessionRecord[];
  shoes: ShoeRecord[];
  hands: HandRecord[];
  currentHand: HandRecord | null;

  toggle: () => void;
  close: () => void;
  goBack: () => void;
  moveSelection: (delta: number) => void;
  drillIn: () => void;
  navigateTo: (view: HistoryView) => void;
}

export const useHistoryViewStore = create<HistoryViewState>()((set, get) => ({
  isOpen: false,
  view: { type: 'sessions' },
  selectedIndex: 0,

  sessions: [],
  shoes: [],
  hands: [],
  currentHand: null,

  toggle: () => {
    const state = get();
    if (state.isOpen) {
      set({ isOpen: false });
    } else {
      set({ isOpen: true, view: { type: 'sessions' }, selectedIndex: 0 });
      getAllSessions()
        .then((sessions) =>
          set({ sessions: sessions.sort((a, b) => b.startTime - a.startTime) }),
        )
        .catch(console.error);
    }
  },

  close: () => set({ isOpen: false }),

  goBack: () => {
    const { view } = get();
    switch (view.type) {
      case 'sessions':
        set({ isOpen: false });
        break;
      case 'session-detail':
        set({ view: { type: 'sessions' }, selectedIndex: 0 });
        getAllSessions()
          .then((sessions) =>
            set({ sessions: sessions.sort((a, b) => b.startTime - a.startTime) }),
          )
          .catch(console.error);
        break;
      case 'shoe-detail':
        set({
          view: { type: 'session-detail', sessionId: view.sessionId },
          selectedIndex: 0,
        });
        getShoesBySession(view.sessionId)
          .then((shoes) => set({ shoes: shoes.sort((a, b) => a.startTime - b.startTime) }))
          .catch(console.error);
        break;
      case 'hand-detail':
        set({
          view: { type: 'shoe-detail', shoeId: view.shoeId, sessionId: view.sessionId },
          selectedIndex: 0,
        });
        getHandsByShoe(view.shoeId)
          .then((hands) => set({ hands: hands.sort((a, b) => a.timestamp - b.timestamp) }))
          .catch(console.error);
        break;
    }
  },

  moveSelection: (delta: number) => {
    const state = get();
    let maxIndex = 0;
    switch (state.view.type) {
      case 'sessions':
        maxIndex = state.sessions.length - 1;
        break;
      case 'session-detail':
        maxIndex = state.shoes.length - 1;
        break;
      case 'shoe-detail':
        maxIndex = state.hands.length - 1;
        break;
    }
    const newIndex = Math.max(0, Math.min(maxIndex, state.selectedIndex + delta));
    set({ selectedIndex: newIndex });
  },

  drillIn: () => {
    const state = get();
    switch (state.view.type) {
      case 'sessions': {
        const session = state.sessions[state.selectedIndex];
        if (!session) return;
        set({
          view: { type: 'session-detail', sessionId: session.id },
          selectedIndex: 0,
        });
        getShoesBySession(session.id)
          .then((shoes) => set({ shoes: shoes.sort((a, b) => a.startTime - b.startTime) }))
          .catch(console.error);
        break;
      }
      case 'session-detail': {
        const shoe = state.shoes[state.selectedIndex];
        if (!shoe) return;
        set({
          view: {
            type: 'shoe-detail',
            shoeId: shoe.id,
            sessionId: (state.view as { sessionId: string }).sessionId,
          },
          selectedIndex: 0,
        });
        getHandsByShoe(shoe.id)
          .then((hands) => set({ hands: hands.sort((a, b) => a.timestamp - b.timestamp) }))
          .catch(console.error);
        break;
      }
      case 'shoe-detail': {
        const hand = state.hands[state.selectedIndex];
        if (!hand) return;
        set({
          view: {
            type: 'hand-detail',
            handId: hand.id,
            shoeId: (state.view as { shoeId: string }).shoeId,
            sessionId: (state.view as { sessionId: string }).sessionId,
          },
        });
        getHandById(hand.id)
          .then((h) => set({ currentHand: h ?? null }))
          .catch(console.error);
        break;
      }
    }
  },

  navigateTo: (view: HistoryView) => {
    set({ view, selectedIndex: 0 });
    switch (view.type) {
      case 'sessions':
        getAllSessions()
          .then((sessions) =>
            set({ sessions: sessions.sort((a, b) => b.startTime - a.startTime) }),
          )
          .catch(console.error);
        break;
      case 'session-detail':
        getShoesBySession(view.sessionId)
          .then((shoes) => set({ shoes: shoes.sort((a, b) => a.startTime - b.startTime) }))
          .catch(console.error);
        break;
      case 'shoe-detail':
        getHandsByShoe(view.shoeId)
          .then((hands) => set({ hands: hands.sort((a, b) => a.timestamp - b.timestamp) }))
          .catch(console.error);
        break;
      case 'hand-detail':
        getHandById(view.handId)
          .then((h) => set({ currentHand: h ?? null }))
          .catch(console.error);
        break;
    }
  },
}));
