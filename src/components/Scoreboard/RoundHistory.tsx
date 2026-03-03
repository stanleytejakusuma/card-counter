import type { RoundSnapshot } from '../../stores/gameStore.js';
import { formatCurrency, formatOutcome } from '../../utils/formatters.js';
import type { Card } from '../../engine/types.js';

function cardStr(card: Card): string {
  return card.rank === '10' ? 'T' : card.rank;
}

function outcomeColor(outcome?: string): string {
  if (!outcome) return 'text-neutral-600';
  switch (outcome) {
    case 'win':
    case 'blackjack':
    case 'even_money':
      return 'text-green-400';
    case 'loss':
    case 'surrender':
      return 'text-red-400';
    case 'push':
      return 'text-neutral-400';
    default:
      return 'text-neutral-600';
  }
}

export function RoundHistory({ rounds }: { rounds: RoundSnapshot[] }) {
  // Show most recent first, scrollable
  const reversed = [...rounds].reverse();

  return (
    <div className="max-h-48 overflow-y-auto space-y-1 text-[11px] font-mono">
      {reversed.map((round, ri) => {
        const roundNum = rounds.length - ri;
        return (
          <div key={ri} className="text-neutral-400 leading-tight">
            <span className="text-neutral-600">R{roundNum}: </span>
            <span className="text-red-300">D:[{cardStr(round.dealerUpcard)}]</span>
            {round.seats.map((seat, si) => (
              <span key={si} className="ml-1.5">
                {seat.hands.map((hand, hi) => {
                  const oc = hand.outcome;
                  const ocStr = oc ? formatOutcome(oc) : '--';
                  const netStr = hand.netResult != null
                    ? ` ${hand.netResult >= 0 ? '+' : ''}${formatCurrency(hand.netResult)}`
                    : '';
                  return (
                    <span key={hi}>
                      {hi > 0 && <span className="text-neutral-600"> | </span>}
                      <span className="text-blue-400">S{seat.seatNumber}</span>
                      {hand.fromSplit && <span className="text-purple-400">s</span>}
                      :<span className="text-neutral-300">[{hand.cards.map(cardStr).join('')}]={hand.total}</span>
                      {hand.doubled && <span className="text-blue-400"> 2x</span>}
                      {' '}
                      <span className={outcomeColor(oc)}>{ocStr}</span>
                      {netStr && <span className={outcomeColor(oc)}>{netStr}</span>}
                    </span>
                  );
                })}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
