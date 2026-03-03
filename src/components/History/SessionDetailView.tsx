import { useHistoryViewStore } from '../../stores/historyViewStore.js';
import { formatCurrency } from '../../utils/formatters.js';
import { formatDate, formatDuration } from '../../utils/formatters.js';

export function SessionDetailView() {
  const view = useHistoryViewStore((s) => s.view);
  const sessions = useHistoryViewStore((s) => s.sessions);
  const shoes = useHistoryViewStore((s) => s.shoes);
  const selectedIndex = useHistoryViewStore((s) => s.selectedIndex);

  if (view.type !== 'session-detail') return null;

  const session = sessions.find((s) => s.id === view.sessionId);
  if (!session) return <div className="text-neutral-500">Session not found</div>;

  const pnl = session.netPnL ?? (session.endingBankroll != null ? session.endingBankroll - session.startingBankroll : null);
  const totalOutcomed = session.handsWon + session.handsLost + session.handsPushed;
  const winRate = totalOutcomed > 0 ? ((session.handsWon / totalOutcomed) * 100).toFixed(1) : '--';
  const duration = session.endTime
    ? session.endTime - session.startTime
    : Date.now() - session.startTime;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="border border-neutral-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">{formatDate(session.startTime)}</span>
          <span className="text-neutral-400 text-sm">{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-neutral-500 text-xs">Bankroll</div>
            <div className="text-neutral-200 font-mono">
              {formatCurrency(session.startingBankroll)}
              {session.endingBankroll != null && (
                <span className="text-neutral-500"> → {formatCurrency(session.endingBankroll)}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-neutral-500 text-xs">Net P&L</div>
            <div className={`font-mono font-bold text-lg ${
              pnl != null && pnl > 0 ? 'text-green-400' : pnl != null && pnl < 0 ? 'text-red-400' : 'text-neutral-500'
            }`}>
              {pnl != null ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '--'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <div className="text-neutral-500">Won</div>
            <div className="text-green-400 font-mono">{session.handsWon}</div>
          </div>
          <div>
            <div className="text-neutral-500">Lost</div>
            <div className="text-red-400 font-mono">{session.handsLost}</div>
          </div>
          <div>
            <div className="text-neutral-500">Push</div>
            <div className="text-neutral-400 font-mono">{session.handsPushed}</div>
          </div>
          <div>
            <div className="text-neutral-500">BJ</div>
            <div className="text-yellow-400 font-mono">{session.blackjacks}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Win rate: <span className="text-neutral-300">{winRate}%</span></span>
          <span>Deviations: <span className="text-neutral-300">{session.deviationsTaken}</span></span>
          <span>Hands: <span className="text-neutral-300">{session.totalHands}</span></span>
        </div>
      </div>

      {/* Shoe list */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-400 mb-2">
          Shoes ({shoes.length})
        </h2>
        {shoes.length === 0 ? (
          <div className="text-neutral-600 text-sm">No shoes recorded</div>
        ) : (
          <div className="space-y-1">
            {shoes.map((shoe, i) => {
              const isSelected = i === selectedIndex;
              const shoeDuration = shoe.endTime
                ? shoe.endTime - shoe.startTime
                : Date.now() - shoe.startTime;

              return (
                <div
                  key={shoe.id}
                  className={`px-3 py-2 rounded border text-sm cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-950/40'
                      : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">Shoe #{i + 1}</span>
                    <span className="text-neutral-500 text-xs">
                      {shoe.totalHands} hands | {shoe.cardsDealt} cards
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                    <span>{formatDuration(shoeDuration)}</span>
                    <span>Peak TC: <span className="text-green-400">{shoe.peakTrueCount.toFixed(1)}</span></span>
                    <span>Min TC: <span className="text-red-400">{shoe.minTrueCount.toFixed(1)}</span></span>
                    {!shoe.endTime && <span className="text-amber-500">active</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
