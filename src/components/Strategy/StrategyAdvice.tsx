import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateTrueCount } from '../../engine/counting.js';
import { getStrategyAdvice } from '../../engine/strategy.js';
import type { StrategyAction } from '../../engine/types.js';

const ACTION_LABELS: Record<StrategyAction, string> = {
  H: 'HIT',
  S: 'STAND',
  D: 'DOUBLE',
  P: 'SPLIT',
  R: 'SURRENDER',
};

const ACTION_COLORS: Record<StrategyAction, string> = {
  H: 'text-yellow-400',
  S: 'text-green-400',
  D: 'text-blue-400',
  P: 'text-purple-400',
  R: 'text-red-400',
};

export function StrategyAdvice() {
  const { seats, activeSeatIndex, playerSeatNumbers, dealerUpcard, runningCount, cardsSeen, handPhase } = useGameStore();
  const rules = useSettingsStore((s) => s.rules);
  const multiSeat = playerSeatNumbers.length > 1;

  const seat = seats[activeSeatIndex];
  const hand = seat?.hands[seat.activeHandIndex];
  const playerCards = hand?.cards ?? [];

  if (handPhase !== 'player' || !dealerUpcard || playerCards.length < 2) {
    return (
      <div className="text-center py-4">
        <div className="text-3xl font-bold text-neutral-700">—</div>
        <div className="text-xs text-neutral-600 mt-1">Enter dealer + 2 player cards</div>
      </div>
    );
  }

  const tc = calculateTrueCount(runningCount, cardsSeen, rules.decks);
  const advice = getStrategyAdvice(playerCards, dealerUpcard, tc, rules);

  const seatLabel = multiSeat || seat.hands.length > 1
    ? (seat.hands.length > 1
      ? `Seat ${seat.seatNumber}.${seat.activeHandIndex + 1}`
      : `Seat ${seat.seatNumber}`)
    : null;

  // Compact advice for non-active seats (multi-seat only)
  const otherSeatsAdvice = multiSeat
    ? seats
        .map((s, si) => {
          if (si === activeSeatIndex) return null;
          const h = s.hands[s.activeHandIndex];
          if (!h || h.cards.length < 2) return null;
          const a = getStrategyAdvice(h.cards, dealerUpcard, tc, rules);
          return { seatNumber: s.seatNumber, action: a.action, doubled: h.doubled };
        })
        .filter(Boolean) as { seatNumber: number; action: StrategyAction; doubled: boolean }[]
    : [];

  return (
    <div className="text-center py-2">
      {otherSeatsAdvice.length > 0 && (
        <div className="flex justify-center gap-3 mb-2">
          {otherSeatsAdvice.map((o) => (
            <span key={o.seatNumber} className="text-xs">
              <span className="text-neutral-500">S{o.seatNumber}: </span>
              <span className={o.doubled ? 'text-blue-400' : ACTION_COLORS[o.action]}>
                {o.doubled ? '2x' : ACTION_LABELS[o.action]}
              </span>
            </span>
          ))}
        </div>
      )}
      {seatLabel && (
        <div className="text-xs text-neutral-500 mb-1">{seatLabel}</div>
      )}
      {hand.doubled ? (
        <div className="text-4xl font-bold text-blue-400">DOUBLED</div>
      ) : (
        <div className={`text-4xl font-bold ${ACTION_COLORS[advice.action]}`}>
          {ACTION_LABELS[advice.action]}
        </div>
      )}
      {advice.isDeviation && !hand.doubled && (
        <div className="mt-1 px-3 py-1 bg-amber-900/50 border border-amber-600 rounded text-amber-300 text-xs font-semibold inline-block animate-pulse">
          INDEX PLAY: {advice.deviationName}
        </div>
      )}
    </div>
  );
}
