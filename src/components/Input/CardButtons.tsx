import type { Rank } from '../../engine/types.js';
import type { HandOutcome } from '../../engine/historyTypes.js';
import { useGameStore } from '../../stores/gameStore.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateHandTotal } from '../../engine/hand.js';
import { createCard } from '../../engine/counting.js';

const CARD_RANKS: { label: string; rank: Rank }[] = [
  { label: 'A', rank: 'A' },
  { label: '2', rank: '2' },
  { label: '3', rank: '3' },
  { label: '4', rank: '4' },
  { label: '5', rank: '5' },
  { label: '6', rank: '6' },
  { label: '7', rank: '7' },
  { label: '8', rank: '8' },
  { label: '9', rank: '9' },
  { label: '10', rank: '10' },
];

const BASE_OUTCOMES: { label: string; outcome: HandOutcome; color: string }[] = [
  { label: 'W', outcome: 'win', color: 'bg-green-800/60 border-green-600 text-green-300' },
  { label: 'L', outcome: 'loss', color: 'bg-red-800/60 border-red-600 text-red-300' },
  { label: 'P', outcome: 'push', color: 'bg-neutral-700/60 border-neutral-500 text-neutral-300' },
  { label: 'BJ', outcome: 'blackjack', color: 'bg-yellow-800/60 border-yellow-600 text-yellow-300' },
];

const SR_OUTCOME = { label: 'SR', outcome: 'surrender' as HandOutcome, color: 'bg-orange-800/60 border-orange-600 text-orange-300' };
const EM_OUTCOME = { label: 'EM', outcome: 'even_money' as HandOutcome, color: 'bg-emerald-800/60 border-emerald-600 text-emerald-300' };

export function CardButtons() {
  const handPhase = useGameStore((s) => s.handPhase);
  const seats = useGameStore((s) => s.seats);
  const activeSeatIndex = useGameStore((s) => s.activeSeatIndex);
  const playerSeatNumbers = useGameStore((s) => s.playerSeatNumbers);
  const lastConfirmedRound = useGameStore((s) => s.lastConfirmedRound);
  const awaitingOutcomes = useSessionStore((s) => s.awaitingOutcomes);
  const activeOutcomeIndex = useSessionStore((s) => s.activeOutcomeIndex);
  const awaitingOutcome = useSessionStore((s) => s.awaitingOutcome);
  const lateSurrender = useSettingsStore((s) => s.rules.lateSurrender);

  const _activePlaySeat = useGameStore((s) => s._activePlaySeat);
  const occupiedSeatNumbers = useGameStore((s) => s.occupiedSeatNumbers);
  const _splitDealInProgress = useGameStore((s) => s._splitDealInProgress);

  const multiSeat = playerSeatNumbers.length > 1;
  const activeSeat = seats[activeSeatIndex];
  const activeHand = activeSeat?.hands[activeSeat?.activeHandIndex ?? 0];

  // Build outcomes list dynamically
  const dealerWasAce = lastConfirmedRound?.dealerUpcard?.rank === 'A';
  let outcomes = [...BASE_OUTCOMES];
  if (dealerWasAce) outcomes.push(EM_OUTCOME);
  if (lateSurrender) outcomes.push(SR_OUTCOME);

  const isOccupiedSeatActive = _activePlaySeat > 0 && occupiedSeatNumbers.includes(_activePlaySeat);
  const occupiedSplitSeats = useGameStore((s) => s._occupiedSplitSeats);
  const _observeRound = useGameStore((s) => s._observeRound);

  // Check for split/double eligibility
  const canSplit = !isOccupiedSeatActive && handPhase === 'player' && activeHand && activeHand.cards.length === 2 &&
    !activeHand.doubled && activeSeat.hands.length < 2 &&
    calculateHandTotal(activeHand.cards).isPair;
  const canDouble = !isOccupiedSeatActive && handPhase === 'player' && activeHand && activeHand.cards.length === 2 &&
    !activeHand.doubled;

  // Occupied seat split eligibility: 2 cards, pair, not already split
  let canSplitOccupied = false;
  if (isOccupiedSeatActive && !occupiedSplitSeats.includes(_activePlaySeat)) {
    const game = useGameStore.getState();
    const ctxH = game.cardContextHistory;
    const seatTag = `S${_activePlaySeat}`;
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
    if (seatEntries.length === 2) {
      const r0 = (seatEntries[0].rank === 'T' ? '10' : seatEntries[0].rank) as Rank;
      const r1 = (seatEntries[1].rank === 'T' ? '10' : seatEntries[1].rank) as Rank;
      canSplitOccupied = createCard(r0).value === createCard(r1).value;
    }
  }

  function handleCardClick(rank: Rank) {
    if (awaitingOutcome) {
      useSessionStore.getState().clearAwaitingOutcome();
    }
    useGameStore.getState().inputCard(rank);
    useSessionStore.getState().startSession();
  }

  const activeSeatReady = handPhase === 'player' &&
    !_splitDealInProgress &&
    (isOccupiedSeatActive || (activeHand && activeHand.cards.length >= 2));

  function handleUndo() {
    useGameStore.getState().undoLastCard();
  }

  function handleNewShoe() {
    useGameStore.getState().newShoe();
    useSessionStore.getState().incrementShoes();
  }

  function handleNext() {
    const game = useGameStore.getState();
    const playOrder = game._observeRound
      ? [...game.occupiedSeatNumbers].sort((a, b) => a - b)
      : [...game.playerSeatNumbers, ...game.occupiedSeatNumbers].sort((a, b) => a - b);
    const currentSeat = game._activePlaySeat;

    // If occupied seat is split, advance sub-hand before advancing seat
    if (currentSeat > 0 && game.occupiedSeatNumbers.includes(currentSeat) &&
        game._occupiedSplitSeats.includes(currentSeat) && game._occupiedActiveSubHand === 0) {
      useGameStore.setState({ _occupiedActiveSubHand: 1 });
      return;
    }

    // If activePlaySeat is a player seat, check for split hands first
    if (currentSeat > 0 && game.playerSeatNumbers.includes(currentSeat)) {
      const seatIdx = game.seats.findIndex((s) => s.seatNumber === currentSeat);
      if (seatIdx >= 0) {
        const seat = game.seats[seatIdx];
        if (seat.activeHandIndex < seat.hands.length - 1) {
          // Advance within split hands
          game.nextHandOrSeat();
          return;
        }
      }
    }

    // Advance to next seat in play order
    const currentIdx = playOrder.indexOf(currentSeat);
    if (currentIdx >= 0 && currentIdx < playOrder.length - 1) {
      const nextSeatNum = playOrder[currentIdx + 1];
      const nextPlayerIdx = game.seats.findIndex((s) => s.seatNumber === nextSeatNum);
      useGameStore.setState({
        _activePlaySeat: nextSeatNum,
        _occupiedActiveSubHand: 0,
        ...(nextPlayerIdx >= 0 ? { activeSeatIndex: nextPlayerIdx } : {}),
      });
    } else {
      // Last seat — transition to table phase
      game.setHandPhase('table');
    }
  }

  function handleEndRound() {
    const game = useGameStore.getState();
    game.confirmHand();
    useSessionStore.getState().incrementHands();
    game.nextHand();
  }

  function handleOutcome(outcome: HandOutcome) {
    useSessionStore.getState().recordOutcome(outcome);
  }

  // Show outcome buttons when awaiting
  if (awaitingOutcome) {
    const totalPending = awaitingOutcomes.length;
    const current = awaitingOutcomes[activeOutcomeIndex];
    const label = current?.label ?? `Hand ${activeOutcomeIndex + 1}`;

    return (
      <div className="space-y-2">
        <div className="text-center text-xs text-amber-400 font-semibold">
          Record Outcome{totalPending > 1 && ` — ${label} (${activeOutcomeIndex + 1}/${totalPending})`}
        </div>
        <div className={`grid gap-1.5 grid-cols-${outcomes.length}`}>
          {outcomes.map(({ label: btnLabel, outcome, color }) => (
            <button
              key={outcome}
              onClick={() => handleOutcome(outcome)}
              className={`${color} border rounded-lg py-3 text-sm font-bold font-mono active:scale-95 transition-transform`}
            >
              {btnLabel}
            </button>
          ))}
        </div>
        <button
          onClick={() => useSessionStore.getState().clearAwaitingOutcome()}
          className="w-full text-neutral-600 text-xs py-1 hover:text-neutral-400 transition-colors"
        >
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Phase indicator for table mode */}
      {handPhase === 'table' && !_observeRound && (
        <div className="text-center text-xs text-red-400 font-semibold">
          Dealer — enter dealer cards
        </div>
      )}
      {_observeRound && (
        <div className="text-center text-xs text-amber-400 font-semibold">
          Observe Round — tracking cards only
        </div>
      )}

      {/* Seat/hand selector tabs — when active seat has 2+ cards */}
      {(multiSeat || (activeSeat && activeSeat.hands.length > 1)) && activeSeatReady && (
        <div className="flex gap-1 justify-center flex-wrap">
          {seats.map((seat, si) =>
            seat.hands.map((hand, hi) => {
              const isActive = si === activeSeatIndex && hi === seat.activeHandIndex;
              const label = seat.hands.length > 1
                ? `S${seat.seatNumber}.${hi + 1}`
                : `S${seat.seatNumber}`;
              return (
                <button
                  key={`${si}-${hi}`}
                  onClick={() => {
                    useGameStore.getState().setActiveSeat(si);
                    const s = useGameStore.getState().seats[si];
                    if (s) {
                      const newSeats = useGameStore.getState().seats.map((seat, i) =>
                        i === si ? { ...seat, activeHandIndex: hi } : seat,
                      );
                      useGameStore.setState({ seats: newSeats, activeSeatIndex: si });
                    }
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-800/60 border border-blue-500 text-blue-200'
                      : 'bg-neutral-800/50 border border-neutral-700 text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {label}
                  {hand.doubled && ' 2x'}
                </button>
              );
            }),
          )}
        </div>
      )}

      {/* Split/Double action buttons — when active seat has 2+ cards */}
      {activeSeatReady && (canSplit || canDouble || canSplitOccupied) && (
        <div className="flex gap-1.5 justify-center">
          {(canSplit || canSplitOccupied) && (
            <button
              onClick={() => canSplitOccupied
                ? useGameStore.getState().splitOccupied()
                : useGameStore.getState().splitHand()
              }
              className="px-4 py-1.5 bg-purple-900/40 border border-purple-700 rounded-lg text-xs font-bold text-purple-300 uppercase hover:bg-purple-800/40 active:scale-95 transition-all"
            >
              Split
            </button>
          )}
          {canDouble && (
            <button
              onClick={() => useGameStore.getState().doubleDown()}
              className="px-4 py-1.5 bg-blue-900/40 border border-blue-700 rounded-lg text-xs font-bold text-blue-300 uppercase hover:bg-blue-800/40 active:scale-95 transition-all"
            >
              Double
            </button>
          )}
        </div>
      )}

      {/* Card buttons - 2 rows of 5 */}
      <div className="grid grid-cols-5 gap-1.5">
        {CARD_RANKS.map(({ label, rank }) => (
          <button
            key={label}
            onClick={() => handleCardClick(rank)}
            className={`border rounded-lg py-3 text-sm font-bold font-mono active:scale-95 transition-all ${
              handPhase === 'table'
                ? 'bg-red-900/30 border-red-800 text-red-200 hover:bg-red-800/40 hover:border-red-600'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-200 hover:bg-neutral-700/80 hover:border-neutral-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons — 4-col grid, layout varies by phase */}
      <div className="grid grid-cols-4 gap-1.5">
        {handPhase === 'table' ? (
          /* Table phase: End Round (x2) + Undo + New Shoe */
          <>
            <button
              onClick={handleEndRound}
              className="col-span-2 bg-green-900/50 border border-green-600 rounded-lg py-2.5 text-xs font-bold text-green-300 uppercase hover:bg-green-800/50 active:scale-95 transition-all"
            >
              End Round
            </button>
            <button
              onClick={handleUndo}
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg py-2.5 text-xs font-bold text-neutral-400 uppercase hover:bg-neutral-700/50 hover:border-neutral-500 active:scale-95 transition-all"
            >
              Undo
            </button>
            <button
              onClick={handleNewShoe}
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg py-2.5 text-xs font-bold text-neutral-400 uppercase hover:bg-neutral-700/50 hover:border-neutral-500 active:scale-95 transition-all"
            >
              New Shoe
            </button>
          </>
        ) : activeSeatReady ? (
          /* Active seat ready: Next (x2) + Undo + New Shoe */
          <>
            <button
              onClick={handleNext}
              className="col-span-2 bg-purple-900/50 border border-purple-600 rounded-lg py-2.5 text-xs font-bold text-purple-300 uppercase hover:bg-purple-800/50 active:scale-95 transition-all"
            >
              Next
            </button>
            <button
              onClick={handleUndo}
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg py-2.5 text-xs font-bold text-neutral-400 uppercase hover:bg-neutral-700/50 hover:border-neutral-500 active:scale-95 transition-all"
            >
              Undo
            </button>
            <button
              onClick={handleNewShoe}
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg py-2.5 text-xs font-bold text-neutral-400 uppercase hover:bg-neutral-700/50 hover:border-neutral-500 active:scale-95 transition-all"
            >
              New Shoe
            </button>
          </>
        ) : (
          /* Idle / deal mode: Observe + Undo + New Shoe */
          <>
            <button
              onClick={() => useGameStore.getState().toggleObserveRound()}
              className={`${_observeRound ? 'bg-amber-900/60 border-amber-500' : 'bg-amber-900/40 border-amber-700'} border rounded-lg py-2.5 text-xs font-bold text-amber-300 uppercase hover:bg-amber-800/40 active:scale-95 transition-all`}
            >
              {_observeRound ? 'Observing' : 'Observe'}
            </button>
            <button
              onClick={handleUndo}
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg py-2.5 text-xs font-bold text-neutral-400 uppercase hover:bg-neutral-700/50 hover:border-neutral-500 active:scale-95 transition-all"
            >
              Undo
            </button>
            <button
              onClick={handleNewShoe}
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg py-2.5 text-xs font-bold text-neutral-400 uppercase hover:bg-neutral-700/50 hover:border-neutral-500 active:scale-95 transition-all"
            >
              New Shoe
            </button>
          </>
        )}
      </div>
    </div>
  );
}
