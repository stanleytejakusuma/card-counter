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
  const { seats, playerSeatNumbers, occupiedSeatNumbers, dealerUpcard, handPhase, lastConfirmedRound, shoeRoundHistory, cardContextHistory, _activePlaySeat, _dealerHits, _occupiedSplitSeats, _occupiedActiveSubHand, tableName } = useGameStore();

  const showDealer = dealerUpcard ?? lastConfirmedRound?.dealerUpcard ?? null;

  // Derive occupied seat cards from cardContextHistory (current round only)
  // Scope to entries after the last table-phase ('T') target to avoid previous round bleed
  const ctxHistory = cardContextHistory ?? [];
  let roundStart = 0;
  for (let i = ctxHistory.length - 1; i >= 0; i--) {
    if (ctxHistory[i].target === 'T') {
      roundStart = i + 1;
      break;
    }
  }
  const currentRoundCtx = ctxHistory.slice(roundStart);
  // Parse occupied seat cards, handling splits (S{n}.1 / S{n}.2)
  const occupiedHands: Record<number, string[][]> = {};
  for (const seatNum of occupiedSeatNumbers) {
    const isSplit = _occupiedSplitSeats.includes(seatNum);
    const seatTag = `S${seatNum}`;
    const baseEntries = currentRoundCtx.filter((e) => e.target === seatTag);

    if (isSplit && baseEntries.length >= 2) {
      const h1Hits = currentRoundCtx.filter((e) => e.target === `${seatTag}.1`).map((e) => e.rank);
      const h2Hits = currentRoundCtx.filter((e) => e.target === `${seatTag}.2`).map((e) => e.rank);
      occupiedHands[seatNum] = [
        [baseEntries[0].rank, ...h1Hits],
        [baseEntries[1].rank, ...h2Hits],
      ];
    } else {
      occupiedHands[seatNum] = [baseEntries.map((e) => e.rank)];
    }
  }

  // All active seats sorted by seat number
  const allActiveSeats = [
    ...playerSeatNumbers.map((n) => ({ seatNumber: n, isPlayer: true as const })),
    ...occupiedSeatNumbers.map((n) => ({ seatNumber: n, isPlayer: false as const })),
  ].sort((a, b) => a.seatNumber - b.seatNumber);

  return (
    <div className="border border-neutral-800 rounded-lg p-3 space-y-3">
      {/* Table header + name input */}
      <div className="space-y-1.5">
        <div className="text-center text-xs text-neutral-500 font-semibold uppercase tracking-wider">
          Table
        </div>
        <input
          type="text"
          value={tableName}
          onChange={(e) => useGameStore.getState().setTableName(e.target.value)}
          placeholder="Table name..."
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-300 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none text-center"
        />
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

            // Occupied seat — show cards from context history (supports splits)
            const hands = occupiedHands[seatNumber] ?? [[]];
            const isSplit = _occupiedSplitSeats.includes(seatNumber);
            const isActiveSeat = seatNumber === _activePlaySeat && handPhase === 'player';
            return (
              <div key={seatNumber} className={`text-xs font-mono rounded px-2 py-1 ${
                isActiveSeat ? 'bg-amber-950/30 border border-amber-800' : ''
              }`}>
                <span className="text-amber-400">S{seatNumber}</span>
                <span className="text-neutral-600"> (OTHER): </span>
                {hands.map((ranks, hi) => {
                  if (ranks.length === 0) return hi === 0 ? <span key={hi} className="text-neutral-600">-</span> : null;
                  const { total } = occupiedTotal(ranks);
                  const isActiveHand = isActiveSeat && isSplit && hi === _occupiedActiveSubHand;
                  return (
                    <span key={hi} className="mr-2">
                      {hi > 0 && <span className="text-neutral-600">| </span>}
                      <span className={isActiveHand ? 'text-amber-200' : 'text-amber-300/70'}>
                        [{ranks.join('')}]={total}
                      </span>
                      {total > 21 && <span className="text-red-400 ml-0.5">BUST</span>}
                      {!isSplit && ranks.length === 2 && total === 21 && (
                        <span className="text-yellow-400 ml-0.5">BJ</span>
                      )}
                      {isSplit && <span className="text-purple-400 ml-0.5">sp</span>}
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
