import type { Rank } from '../../engine/types.js';
import type { HandOutcome } from '../../engine/historyTypes.js';
import { useGameStore } from '../../stores/gameStore.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateHandTotal } from '../../engine/hand.js';

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

  const multiSeat = playerSeatNumbers.length > 1;
  const activeSeat = seats[activeSeatIndex];
  const activeHand = activeSeat?.hands[activeSeat?.activeHandIndex ?? 0];

  // Build outcomes list dynamically
  const dealerWasAce = lastConfirmedRound?.dealerUpcard?.rank === 'A';
  let outcomes = [...BASE_OUTCOMES];
  if (dealerWasAce) outcomes.push(EM_OUTCOME);
  if (lateSurrender) outcomes.push(SR_OUTCOME);

  // Check for split/double eligibility
  const canSplit = handPhase === 'player' && activeHand && activeHand.cards.length === 2 &&
    !activeHand.doubled && activeSeat.hands.length < 4 &&
    calculateHandTotal(activeHand.cards).isPair;
  const canDouble = handPhase === 'player' && activeHand && activeHand.cards.length === 2 &&
    !activeHand.doubled;

  function handleCardClick(rank: Rank) {
    if (awaitingOutcome) {
      useSessionStore.getState().clearAwaitingOutcome();
    }
    useGameStore.getState().inputCard(rank);
    useSessionStore.getState().startSession();
  }

  function handleConfirm() {
    const { handPhase, confirmHand } = useGameStore.getState();
    if (handPhase !== 'idle' && handPhase !== 'table') {
      confirmHand();
      useSessionStore.getState().incrementHands();
    }
  }

  function handleUndo() {
    useGameStore.getState().undoLastCard();
  }

  function handleNewShoe() {
    useGameStore.getState().newShoe();
  }

  function handleNextHand() {
    useGameStore.getState().nextHand();
  }

  function handleTableMode() {
    useGameStore.getState().setHandPhase('table');
  }

  function handleNextHandOrSeat() {
    useGameStore.getState().nextHandOrSeat();
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

  // Has more hands/seats to advance to?
  const hasMoreHands = activeSeat && (
    activeSeat.activeHandIndex < activeSeat.hands.length - 1 ||
    activeSeatIndex < seats.length - 1
  );

  return (
    <div className="space-y-2">
      {/* Phase indicator for table mode */}
      {handPhase === 'table' && (
        <div className="text-center text-xs text-cyan-400 font-semibold">
          Table Cards — count other players & dealer
        </div>
      )}

      {/* Seat/hand selector tabs */}
      {(multiSeat || (activeSeat && activeSeat.hands.length > 1)) && handPhase === 'player' && (
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
                    // Also set hand index
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

      {/* Split/Double action buttons */}
      {handPhase === 'player' && (canSplit || canDouble) && (
        <div className="flex gap-1.5 justify-center">
          {canSplit && (
            <button
              onClick={() => useGameStore.getState().splitHand()}
              className="px-4 py-1.5 bg-purple-900/40 border border-purple-700 rounded-lg text-xs font-bold text-purple-300 uppercase hover:bg-purple-800/40 active:scale-95 transition-all"
            >
              Split (P)
            </button>
          )}
          {canDouble && (
            <button
              onClick={() => useGameStore.getState().doubleDown()}
              className="px-4 py-1.5 bg-blue-900/40 border border-blue-700 rounded-lg text-xs font-bold text-blue-300 uppercase hover:bg-blue-800/40 active:scale-95 transition-all"
            >
              Double (D)
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
                ? 'bg-cyan-900/30 border-cyan-800 text-cyan-200 hover:bg-cyan-800/40 hover:border-cyan-600'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-200 hover:bg-neutral-700/80 hover:border-neutral-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {handPhase === 'table' ? (
          <button
            onClick={handleNextHand}
            className="col-span-2 bg-blue-900/50 border border-blue-600 rounded-lg py-2.5 text-xs font-bold text-blue-300 uppercase hover:bg-blue-800/50 active:scale-95 transition-all"
          >
            Next Hand
          </button>
        ) : (
          <>
            <button
              onClick={handleConfirm}
              disabled={handPhase === 'idle'}
              className={`border rounded-lg py-2.5 text-xs font-bold uppercase transition-all active:scale-95 ${
                handPhase !== 'idle'
                  ? 'bg-blue-900/50 border-blue-600 text-blue-300 hover:bg-blue-800/50'
                  : 'bg-neutral-900/50 border-neutral-800 text-neutral-600 cursor-not-allowed'
              }`}
            >
              Confirm
            </button>
            {hasMoreHands && handPhase === 'player' ? (
              <button
                onClick={handleNextHandOrSeat}
                className="bg-purple-900/40 border border-purple-700 rounded-lg py-2.5 text-xs font-bold text-purple-300 uppercase hover:bg-purple-800/40 hover:border-purple-500 active:scale-95 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleTableMode}
                className="bg-cyan-900/30 border border-cyan-800 rounded-lg py-2.5 text-xs font-bold text-cyan-400 uppercase hover:bg-cyan-800/40 hover:border-cyan-600 active:scale-95 transition-all"
              >
                Table
              </button>
            )}
          </>
        )}
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
      </div>
    </div>
  );
}
