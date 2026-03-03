import { useHistoryViewStore } from '../../stores/historyViewStore.js';
import { formatCurrency } from '../../utils/formatters.js';
import { formatOutcome } from '../../utils/formatters.js';
import type { Card } from '../../engine/types.js';

function cardDisplay(card: Card): string {
  return card.rank;
}

export function HandDetailView() {
  const hand = useHistoryViewStore((s) => s.currentHand);

  if (!hand) {
    return <div className="text-neutral-500 text-sm">Loading hand...</div>;
  }

  const isDeviation = hand.strategyAdvice.includes('(');
  const adviceParts = hand.strategyAdvice.match(/^(\w+)\s*\((.+)\)$/);
  const action = adviceParts ? adviceParts[1] : hand.strategyAdvice;
  const deviationName = adviceParts ? adviceParts[2] : null;

  const seatLabel = hand.seatNumber != null
    ? (hand.handIndex != null ? `Seat ${hand.seatNumber}.${hand.handIndex + 1}` : `Seat ${hand.seatNumber}`)
    : null;

  return (
    <div className="space-y-4">
      {/* Hand cards */}
      <div className="border border-neutral-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-xs">Hand #{hand.handNumber}</span>
            {seatLabel && <span className="text-blue-400 text-xs">{seatLabel}</span>}
            {hand.doubled && <span className="text-blue-400 text-xs font-bold">2x</span>}
            {hand.fromSplit && <span className="text-purple-400 text-xs">split</span>}
          </div>
          <span className="text-neutral-600 text-xs">
            {new Date(hand.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className="flex items-center justify-center gap-8">
          {/* Dealer */}
          <div className="text-center">
            <div className="text-neutral-500 text-xs mb-1">Dealer</div>
            <div className="text-2xl font-bold text-neutral-200 font-mono">
              {cardDisplay(hand.dealerUpcard)}
            </div>
          </div>

          <div className="text-neutral-600 text-lg">vs</div>

          {/* Player */}
          <div className="text-center">
            <div className="text-neutral-500 text-xs mb-1">Player</div>
            <div className="text-2xl font-bold text-neutral-200 font-mono">
              {hand.playerCards.map(cardDisplay).join(' ')}
            </div>
            <div className="text-neutral-400 text-sm mt-0.5">= {hand.handTotal}</div>
          </div>
        </div>
      </div>

      {/* Strategy advice */}
      <div className="border border-neutral-800 rounded-lg p-3">
        <div className="text-neutral-500 text-xs mb-1">Strategy Advice</div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${isDeviation ? 'text-purple-400' : 'text-blue-400'}`}>
            {action}
          </span>
          {deviationName && (
            <span className="px-2 py-0.5 bg-purple-900/30 border border-purple-700/50 rounded text-purple-300 text-xs">
              {deviationName}
            </span>
          )}
        </div>
      </div>

      {/* Count state */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-neutral-800 rounded-lg p-3 text-center">
          <div className="text-neutral-500 text-xs">RC</div>
          <div className="text-neutral-200 font-mono font-bold">
            {hand.runningCount >= 0 ? '+' : ''}{hand.runningCount}
          </div>
        </div>
        <div className="border border-neutral-800 rounded-lg p-3 text-center">
          <div className="text-neutral-500 text-xs">TC</div>
          <div className={`font-mono font-bold ${
            hand.trueCount >= 2 ? 'text-green-400' : hand.trueCount <= -1 ? 'text-red-400' : 'text-neutral-200'
          }`}>
            {hand.trueCount >= 0 ? '+' : ''}{hand.trueCount.toFixed(1)}
          </div>
        </div>
        <div className="border border-neutral-800 rounded-lg p-3 text-center">
          <div className="text-neutral-500 text-xs">Decks Left</div>
          <div className="text-neutral-200 font-mono font-bold">
            {hand.decksRemaining.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Bet & outcome */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-neutral-800 rounded-lg p-3">
          <div className="text-neutral-500 text-xs">Bet Recommendation</div>
          <div className="text-neutral-200 font-mono font-bold">
            {formatCurrency(hand.betRecommendation)}
          </div>
        </div>
        <div className="border border-neutral-800 rounded-lg p-3">
          <div className="text-neutral-500 text-xs">Outcome</div>
          {hand.outcome ? (
            <div className="flex items-center gap-2">
              <span className={`font-bold ${
                hand.outcome === 'win' || hand.outcome === 'blackjack' || hand.outcome === 'even_money' ? 'text-green-400'
                  : hand.outcome === 'loss' || hand.outcome === 'surrender' ? 'text-red-400'
                  : 'text-neutral-400'
              }`}>
                {formatOutcome(hand.outcome)}
              </span>
              {hand.netResult != null && (
                <span className={`font-mono text-sm ${
                  hand.netResult > 0 ? 'text-green-400' : hand.netResult < 0 ? 'text-red-400' : 'text-neutral-400'
                }`}>
                  {hand.netResult >= 0 ? '+' : ''}{formatCurrency(hand.netResult)}
                </span>
              )}
            </div>
          ) : (
            <div className="text-neutral-600">Not recorded</div>
          )}
        </div>
      </div>
    </div>
  );
}
