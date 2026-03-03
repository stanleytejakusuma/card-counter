import { useHistoryViewStore } from '../../stores/historyViewStore.js';
import { formatCurrency } from '../../utils/formatters.js';
import { formatDate, formatDuration } from '../../utils/formatters.js';

export function SessionListView() {
  const sessions = useHistoryViewStore((s) => s.sessions);
  const selectedIndex = useHistoryViewStore((s) => s.selectedIndex);

  if (sessions.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-12">
        No sessions recorded yet. Play some hands to build history.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((session, i) => {
        const isSelected = i === selectedIndex;
        const pnl = session.netPnL ?? (session.endingBankroll != null ? session.endingBankroll - session.startingBankroll : null);
        const totalOutcomed = session.handsWon + session.handsLost + session.handsPushed;
        const winRate = totalOutcomed > 0 ? session.handsWon / totalOutcomed : null;
        const duration = session.endTime
          ? session.endTime - session.startTime
          : Date.now() - session.startTime;

        return (
          <div
            key={session.id}
            className={`px-3 py-2 rounded border text-sm cursor-pointer transition-colors ${
              isSelected
                ? 'border-blue-600 bg-blue-950/40'
                : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-neutral-300 font-medium">
                {formatDate(session.startTime)}
              </span>
              <span className={`font-mono font-bold ${
                pnl != null && pnl > 0 ? 'text-green-400' : pnl != null && pnl < 0 ? 'text-red-400' : 'text-neutral-500'
              }`}>
                {pnl != null ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '--'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
              <span>{session.totalHands} hands</span>
              <span>{formatDuration(duration)}</span>
              {winRate != null && (
                <span>{(winRate * 100).toFixed(0)}% win</span>
              )}
              {!session.endTime && (
                <span className="text-amber-500">active</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
