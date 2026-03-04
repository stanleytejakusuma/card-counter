import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateHandTotal } from '../../engine/hand.js';
import { calculateTrueCount } from '../../engine/counting.js';
import { formatTrueCount } from '../../utils/formatters.js';
import type { Card } from '../../engine/types.js';

function cardLabel(card: Card): string {
  return card.rank === '10' ? 'T' : card.rank;
}

function CardChip({ card, color = 'text-neutral-200' }: { card: Card; color?: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-xs font-mono font-bold ${color}`}>
      {cardLabel(card)}
    </span>
  );
}

function seatLabel(seatNumber: number, handIndex: number, totalHands: number): string {
  if (totalHands > 1) return `Seat ${seatNumber}.${handIndex + 1}`;
  return `Seat ${seatNumber}`;
}

export function HandDisplay() {
  const { seats, activeSeatIndex, playerSeatNumbers, dealerUpcard, handPhase, runningCount, cardsSeen, lastConfirmedRound, tableCards } = useGameStore();
  const decks = useSettingsStore((s) => s.rules.decks);
  const tc = calculateTrueCount(runningCount, cardsSeen, decks);
  const multiSeat = playerSeatNumbers.length > 1;

  const showDealer = dealerUpcard ?? lastConfirmedRound?.dealerUpcard ?? null;

  // Active hand for summary line
  const activeSeat = seats[activeSeatIndex];
  const activeHand = activeSeat?.hands[activeSeat.activeHandIndex];
  const activeCards = activeHand?.cards ?? [];

  // Fall back to last confirmed round
  const showPlayer = activeCards.length > 0
    ? activeCards
    : (lastConfirmedRound?.seats[activeSeatIndex]?.hands[0]?.cards ?? []);
  const playerTotal = showPlayer.length > 0 ? calculateHandTotal(showPlayer) : null;

  const hasAnySeatCards = seats.some((s) => s.hands.some((h) => h.cards.length > 0)) ||
    (lastConfirmedRound?.seats.some((s) => s.hands.some((h) => h.cards.length > 0)) ?? false);
  const hasHand = showDealer || hasAnySeatCards;

  if (!hasHand && handPhase !== 'table') {
    return (
      <div className="text-neutral-600 text-sm">
        Tap a card to deal{multiSeat ? ` (${playerSeatNumbers.length} seats: ${playerSeatNumbers.join(',')})` : ''}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Your hand vs dealer */}
      {hasHand && (
        <div className="flex items-center justify-between">
          <div className="font-mono text-lg">
            {playerTotal ? (
              <span className="text-neutral-200">
                {multiSeat && (
                  <span className="text-neutral-500 text-sm">
                    {seatLabel(activeSeat.seatNumber, activeSeat.activeHandIndex, activeSeat.hands.length)}:{' '}
                  </span>
                )}
                You: <span className="font-bold">{playerTotal.total}</span>
                {playerTotal.total > 21 && <span className="text-red-400 text-sm ml-1">BUST</span>}
                {playerTotal.isSoft && <span className="text-neutral-500 text-sm ml-1">(soft)</span>}
                {activeHand?.doubled && <span className="text-blue-400 text-sm ml-1">2x</span>}
                {' vs '}
                <span className="font-bold text-red-300">{showDealer ? showDealer.rank : '?'}</span>
              </span>
            ) : showDealer ? (
              <span className="text-neutral-400">
                Dealer: <span className="font-bold text-red-300">{showDealer.rank}</span>
              </span>
            ) : null}
          </div>
          <div className="text-neutral-500 text-sm font-mono">
            TC: {formatTrueCount(tc)}
          </div>
        </div>
      )}

      {/* Card breakdown per seat */}
      {hasHand && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {/* Dealer upcard */}
          {showDealer && (
            <div className="flex items-center gap-1">
              <span className="text-red-400/70">D:</span>
              <CardChip card={showDealer} color="text-red-300" />
            </div>
          )}

          {/* Player seats + hands */}
          {seats.map((seat, si) => {
            return seat.hands.map((hand, hi) => {
              const cards = hand.cards.length > 0
                ? hand.cards
                : (lastConfirmedRound?.seats[si]?.hands[hi]?.cards ?? []);
              if (cards.length === 0 && !multiSeat && seat.hands.length === 1) return null;

              const isActive = si === activeSeatIndex && hi === seat.activeHandIndex && handPhase === 'player';
              const labelColor = isActive ? 'text-blue-400' : 'text-blue-400/50';
              const chipColor = isActive ? 'text-blue-200' : 'text-blue-200/60';

              let label: string;
              if (multiSeat || seat.hands.length > 1) {
                label = seat.hands.length > 1
                  ? `S${seat.seatNumber}.${hi + 1}:`
                  : `S${seat.seatNumber}:`;
              } else {
                label = 'You:';
              }

              return (
                <div key={`${si}-${hi}`} className="flex items-center gap-1">
                  <span className={labelColor}>{label}</span>
                  {cards.map((c, j) => (
                    <CardChip key={j} card={c} color={chipColor} />
                  ))}
                  {hand.doubled && <span className="text-blue-400 text-[10px] font-bold">2x</span>}
                  {hand.fromSplit && cards.length > 0 && <span className="text-purple-400 text-[10px]">sp</span>}
                  {cards.length === 0 && <span className="text-neutral-600">-</span>}
                </div>
              );
            });
          })}
        </div>
      )}

      {/* Table cards */}
      {tableCards.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap text-xs">
          <span className="text-red-400/70">Dealer:</span>
          {tableCards.map((c, i) => (
            <CardChip key={i} card={c} color="text-red-300" />
          ))}
        </div>
      )}

      {/* Table mode hint */}
      {handPhase === 'table' && tableCards.length === 0 && !hasHand && (
        <div className="text-red-400/70 text-sm">
          Enter dealer cards, then End Round
        </div>
      )}
    </div>
  );
}
