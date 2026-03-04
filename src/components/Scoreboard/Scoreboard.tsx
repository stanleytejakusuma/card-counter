import { useGameStore } from '../../stores/gameStore.js';
import { calculateHandTotal } from '../../engine/hand.js';
import { createCard } from '../../engine/counting.js';
import type { Card, Rank } from '../../engine/types.js';
import { RoundHistory } from './RoundHistory.js';

function occupiedTotal(ranks: string[]): { total: number; cards: Card[] } {
  const cards = ranks.map((r) => createCard((r === 'T' ? '10' : r) as Rank));
  return { total: calculateHandTotal(cards).total, cards };
}

const ALL_SEATS = [7, 6, 5, 4, 3, 2, 1] as const;

function cardStr(card: Card): string {
  return card.rank === '10' ? 'T' : card.rank;
}

export function Scoreboard() {
  const { seats, playerSeatNumbers, occupiedSeatNumbers, dealerUpcard, handPhase, lastConfirmedRound, shoeRoundHistory, cardContextHistory, _activePlaySeat, _dealerHits } = useGameStore();

  const showDealer = dealerUpcard ?? lastConfirmedRound?.dealerUpcard ?? null;

  // Derive occupied seat cards from cardContextHistory (current round spans both sides of D)
  const ctxHistory = cardContextHistory ?? [];
  let dealerIdx = -1;
  for (let i = ctxHistory.length - 1; i >= 0; i--) {
    if (ctxHistory[i].target === 'D') { dealerIdx = i; break; }
  }
  // Round starts at first consecutive S entry before D (or trailing S entries if no D yet)
  let roundStart = dealerIdx >= 0 ? dealerIdx : ctxHistory.length;
  for (let i = (dealerIdx >= 0 ? dealerIdx : ctxHistory.length) - 1; i >= 0; i--) {
    if (ctxHistory[i].target.startsWith('S')) roundStart = i;
    else break;
  }
  const currentRoundCtx = ctxHistory.slice(roundStart);
  const occupiedCards: Record<number, string[]> = {};
  for (const entry of currentRoundCtx) {
    const match = entry.target.match(/^S(\d+)$/);
    if (match) {
      const seatNum = parseInt(match[1]);
      if (occupiedSeatNumbers.includes(seatNum)) {
        if (!occupiedCards[seatNum]) occupiedCards[seatNum] = [];
        occupiedCards[seatNum].push(entry.rank);
      }
    }
  }

  // All active seats sorted by seat number
  const allActiveSeats = [
    ...playerSeatNumbers.map((n) => ({ seatNumber: n, isPlayer: true as const })),
    ...occupiedSeatNumbers.map((n) => ({ seatNumber: n, isPlayer: false as const })),
  ].sort((a, b) => a.seatNumber - b.seatNumber);

  return (
    <div className="border border-neutral-800 rounded-lg p-3 space-y-3">
      {/* Table header */}
      <div className="text-center text-xs text-neutral-500 font-semibold uppercase tracking-wider">
        Table
      </div>

      {/* 7 seat badges */}
      <div className="flex justify-center gap-1">
        {ALL_SEATS.map((n) => {
          const isOurs = playerSeatNumbers.includes(n);
          const isOccupied = occupiedSeatNumbers.includes(n);
          const isActive = (isOurs || isOccupied) && n === _activePlaySeat && handPhase === 'player';

          function handleClick() {
            if (isOurs) {
              // Your seat — toggle off (idle only)
              if (handPhase === 'idle') {
                useGameStore.getState().toggleSeat(n);
              }
            } else if (isOccupied) {
              // Occupied → empty
              useGameStore.getState().toggleOccupiedSeat(n);
            } else {
              // Empty → try to claim as yours first (idle), else mark occupied
              if (handPhase === 'idle' && playerSeatNumbers.length < 4) {
                useGameStore.getState().toggleSeat(n);
              } else {
                useGameStore.getState().toggleOccupiedSeat(n);
              }
            }
          }

          function handleRightClick(e: React.MouseEvent) {
            e.preventDefault();
            if (isOurs) return; // can't mark your seat as occupied
            useGameStore.getState().toggleOccupiedSeat(n);
          }

          let title: string;
          if (isOurs) title = `Seat ${n} (yours) — click to remove`;
          else if (isOccupied) title = `Seat ${n} (other player) — click to clear`;
          else title = `Seat ${n} (empty) — click to claim, right-click for other player`;

          return (
            <button
              key={n}
              onClick={handleClick}
              onContextMenu={handleRightClick}
              className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                isActive
                  ? isOccupied
                    ? 'bg-amber-700 border-2 border-amber-400 text-white'
                    : 'bg-blue-700 border-2 border-blue-400 text-white'
                  : isOurs
                    ? 'bg-blue-900/60 border border-blue-600 text-blue-300'
                    : isOccupied
                      ? 'bg-amber-900/40 border border-amber-700 text-amber-400'
                      : 'bg-neutral-800/50 border border-neutral-700 text-neutral-600'
              } cursor-pointer hover:brightness-125`}
              title={title}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-3 text-[10px]">
        <span className="text-blue-400">You</span>
        <span className="text-amber-400">Other</span>
        <span className="text-neutral-600">Empty</span>
      </div>

      {/* Current round — dealer + all active seats' hands */}
      {handPhase !== 'idle' && (
        <div className="space-y-1.5 border-t border-neutral-800 pt-2">
          {/* Dealer row */}
          <div className={`text-xs font-mono rounded px-2 py-1 ${
            handPhase === 'table' ? 'bg-red-950/30 border border-red-800' : ''
          }`}>
            <span className="text-red-400">DEALER</span>
            <span className="text-neutral-600">: </span>
            {showDealer ? (
              <span className="text-red-300">
                [{cardStr(showDealer)}{_dealerHits.map(cardStr).join('')}]
                ={calculateHandTotal([showDealer, ..._dealerHits]).total}
                {calculateHandTotal([showDealer, ..._dealerHits]).total > 21 && (
                  <span className="text-red-400 ml-0.5">BUST</span>
                )}
              </span>
            ) : (
              <span className="text-neutral-600">-</span>
            )}
          </div>

          {allActiveSeats.map(({ seatNumber, isPlayer }) => {
            if (isPlayer) {
              const seat = seats.find((s) => s.seatNumber === seatNumber);
              if (!seat) return null;
              const isActiveSeat = seatNumber === _activePlaySeat && handPhase === 'player';
              return (
                <div
                  key={seatNumber}
                  className={`text-xs font-mono rounded px-2 py-1 ${
                    isActiveSeat ? 'bg-blue-950/30 border border-blue-800' : ''
                  }`}
                >
                  <span className="text-blue-400">S{seatNumber}</span>
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
                        {total.total > 21 && <span className="text-red-400 ml-0.5">BUST</span>}
                        {hand.cards.length === 2 && total.total === 21 && !hand.fromSplit && (
                          <span className="text-yellow-400 ml-0.5">BJ</span>
                        )}
                        {hand.doubled && <span className="text-blue-400 ml-0.5">2x</span>}
                        {hand.fromSplit && <span className="text-purple-400 ml-0.5">sp</span>}
                      </span>
                    );
                  })}
                </div>
              );
            }

            // Occupied seat — show cards from context history
            const cards = occupiedCards[seatNumber];
            return (
              <div key={seatNumber} className={`text-xs font-mono rounded px-2 py-1 ${
                seatNumber === _activePlaySeat && handPhase === 'player'
                  ? 'bg-amber-950/30 border border-amber-800' : ''
              }`}>
                <span className="text-amber-400">S{seatNumber}</span>
                <span className="text-neutral-600"> (OTHER): </span>
                {cards && cards.length > 0 ? (() => {
                  const { total } = occupiedTotal(cards);
                  return (
                    <span className="text-amber-300/70">
                      [{cards.join('')}]={total}
                      {total > 21 && <span className="text-red-400 ml-0.5">BUST</span>}
                      {cards.length === 2 && total === 21 && (
                        <span className="text-yellow-400 ml-0.5">BJ</span>
                      )}
                    </span>
                  );
                })() : (
                  <span className="text-neutral-600">-</span>
                )}
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
