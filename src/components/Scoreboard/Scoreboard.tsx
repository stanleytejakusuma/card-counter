import { useGameStore } from '../../stores/gameStore.js';
import { calculateHandTotal } from '../../engine/hand.js';
import type { Card } from '../../engine/types.js';
import { RoundHistory } from './RoundHistory.js';

const ALL_SEATS = [1, 2, 3, 4, 5, 6, 7] as const;

function cardStr(card: Card): string {
  return card.rank === '10' ? 'T' : card.rank;
}

export function Scoreboard() {
  const { seats, activeSeatIndex, playerSeatNumbers, dealerUpcard, handPhase, lastConfirmedRound, shoeRoundHistory } = useGameStore();

  const showDealer = dealerUpcard ?? lastConfirmedRound?.dealerUpcard ?? null;

  return (
    <div className="border border-neutral-800 rounded-lg p-3 space-y-3">
      {/* Table header */}
      <div className="text-center text-xs text-neutral-500 font-semibold uppercase tracking-wider">
        Table
      </div>

      {/* Dealer */}
      <div className="text-center">
        <span className="text-neutral-500 text-xs">DEALER: </span>
        <span className="text-red-300 font-mono font-bold">
          {showDealer ? `[${cardStr(showDealer)}]` : '[ ]'}
        </span>
      </div>

      {/* 7 seat badges */}
      <div className="flex justify-center gap-1">
        {ALL_SEATS.map((n) => {
          const isOurs = playerSeatNumbers.includes(n);
          const seatIdx = seats.findIndex((s) => s.seatNumber === n);
          const isActive = isOurs && seatIdx === activeSeatIndex && handPhase === 'player';

          return (
            <button
              key={n}
              onClick={() => {
                if (handPhase === 'idle') {
                  useGameStore.getState().toggleSeat(n);
                }
              }}
              className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                isActive
                  ? 'bg-blue-700 border-2 border-blue-400 text-white'
                  : isOurs
                    ? 'bg-blue-900/60 border border-blue-600 text-blue-300'
                    : 'bg-neutral-800/50 border border-neutral-700 text-neutral-600'
              } ${handPhase === 'idle' ? 'cursor-pointer hover:border-blue-500' : ''}`}
              title={isOurs ? `Seat ${n} (yours)` : `Seat ${n}`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Current round — active seats' hands */}
      {handPhase !== 'idle' && (
        <div className="space-y-1.5 border-t border-neutral-800 pt-2">
          {seats.map((seat, si) => {
            const isActiveSeat = si === activeSeatIndex && handPhase === 'player';
            return (
              <div
                key={seat.seatNumber}
                className={`text-xs font-mono rounded px-2 py-1 ${
                  isActiveSeat ? 'bg-blue-950/30 border border-blue-800' : ''
                }`}
              >
                <span className="text-blue-400">S{seat.seatNumber}</span>
                <span className="text-neutral-600"> (YOU): </span>
                {seat.hands.map((hand, hi) => {
                  if (hand.cards.length === 0) return <span key={hi} className="text-neutral-600">- </span>;
                  const total = calculateHandTotal(hand.cards);
                  const isActiveHand = isActiveSeat && hi === seat.activeHandIndex;
                  return (
                    <span key={hi} className="mr-2">
                      {hi > 0 && <span className="text-neutral-600">| </span>}
                      <span className={isActiveHand ? 'text-neutral-200' : 'text-neutral-400'}>
                        [{hand.cards.map(cardStr).join('')}]={total.total}
                      </span>
                      {hand.doubled && <span className="text-blue-400 ml-0.5">2x</span>}
                      {hand.fromSplit && <span className="text-purple-400 ml-0.5">sp</span>}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Round history */}
      {shoeRoundHistory.length > 0 && (
        <div className="border-t border-neutral-800 pt-2">
          <div className="text-xs text-neutral-500 font-semibold mb-1">Shoe History</div>
          <RoundHistory rounds={shoeRoundHistory} />
        </div>
      )}
    </div>
  );
}
