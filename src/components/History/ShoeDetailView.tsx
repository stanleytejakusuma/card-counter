import { useHistoryViewStore } from '../../stores/historyViewStore.js';
import { formatCurrency } from '../../utils/formatters.js';
import { formatOutcome } from '../../utils/formatters.js';
import type { Card } from '../../engine/types.js';

function cardStr(card: Card): string {
  return card.rank === '10' ? 'T' : card.rank;
}

function handSummary(playerCards: Card[], dealerUpcard: Card, handTotal: number): string {
  const playerStr = playerCards.map(cardStr).join('');
  return `${handTotal} vs ${cardStr(dealerUpcard)}  [${playerStr}]`;
}

export function ShoeDetailView() {
  const hands = useHistoryViewStore((s) => s.hands);
  const shoes = useHistoryViewStore((s) => s.shoes);
  const view = useHistoryViewStore((s) => s.view);
  const selectedIndex = useHistoryViewStore((s) => s.selectedIndex);

  const shoe = view.type === 'shoe-detail' ? shoes.find((s) => s.id === view.shoeId) : null;

  if (hands.length === 0) {
    return <div className="text-neutral-500 text-sm">No hands recorded in this shoe</div>;
  }

  return (
    <div className="space-y-1">
      {shoe?.tableName && (
        <div className="text-xs text-neutral-400 px-2 pb-1">
          <span className="text-neutral-600">Table: </span>{shoe.tableName}
        </div>
      )}
      <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3.5rem] gap-1 text-xs text-neutral-500 px-2 pb-1 border-b border-neutral-800">
        <span>#</span>
        <span>Hand</span>
        <span className="text-right">RC</span>
        <span className="text-right">TC</span>
        <span className="text-right">Bet</span>
        <span className="text-right">Result</span>
      </div>

      {hands.map((hand, i) => {
        const isSelected = i === selectedIndex;
        const isDeviation = hand.strategyAdvice.includes('(');

        return (
          <div
            key={hand.id}
            className={`grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3.5rem] gap-1 items-center px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
              isSelected
                ? 'bg-blue-950/40 border border-blue-600'
                : 'hover:bg-neutral-900/50 border border-transparent'
            }`}
          >
            <span className="text-neutral-600 font-mono">{hand.handNumber}</span>
            <span className="text-neutral-300 font-mono truncate">
              {handSummary(hand.playerCards, hand.dealerUpcard, hand.handTotal)}
              {isDeviation && <span className="text-purple-400 ml-1">*</span>}
              {hand.doubled && <span className="text-blue-400 ml-1">2x</span>}
              {hand.fromSplit && <span className="text-purple-400 ml-1">sp</span>}
            </span>
            <span className="text-right text-neutral-400 font-mono">
              {hand.runningCount >= 0 ? '+' : ''}{hand.runningCount}
            </span>
            <span className={`text-right font-mono ${
              hand.trueCount >= 2 ? 'text-green-400' : hand.trueCount <= -1 ? 'text-red-400' : 'text-neutral-400'
            }`}>
              {hand.trueCount >= 0 ? '+' : ''}{hand.trueCount.toFixed(1)}
            </span>
            <span className="text-right text-neutral-400 font-mono">
              {formatCurrency(hand.betRecommendation)}
            </span>
            <span className={`text-right font-mono font-bold ${
              hand.outcome === 'win' || hand.outcome === 'blackjack' || hand.outcome === 'even_money' ? 'text-green-400'
                : hand.outcome === 'loss' || hand.outcome === 'surrender' ? 'text-red-400'
                : hand.outcome === 'push' ? 'text-neutral-400'
                : 'text-neutral-600'
            }`}>
              {hand.outcome ? formatOutcome(hand.outcome) : '--'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
