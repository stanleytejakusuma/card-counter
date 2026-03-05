import { useSessionStore } from '../../stores/sessionStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function SessionPnL() {
  const { bankroll, startingBankroll, handsWon, handsLost, handsPushed, blackjacks, sessionStartTime } = useSessionStore();

  const pnl = bankroll - startingBankroll;
  const roi = startingBankroll > 0 ? (pnl / startingBankroll) * 100 : 0;
  const totalDecided = handsWon + handsLost;
  const winRate = totalDecided > 0 ? (handsWon / totalDecided) * 100 : 0;

  const hoursElapsed = sessionStartTime ? (Date.now() - sessionStartTime) / 3600000 : 0;
  const hourlyRate = hoursElapsed > 0.01 ? pnl / hoursElapsed : 0;

  const pnlColor = pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-neutral-400';

  return (
    <div className="space-y-1.5">
      <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Session P&L</div>

      {/* Main P&L + ROI */}
      <div className="flex items-baseline justify-between">
        <span className={`text-sm font-bold ${pnlColor}`}>
          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
        </span>
        <span className="text-[11px] text-neutral-500">
          ROI <span className={pnlColor}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span>
        </span>
      </div>

      {/* Win rate + hourly */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-500">
          Win rate <span className="text-neutral-300">{winRate.toFixed(1)}%</span>
        </span>
        <span className="text-neutral-500">
          {formatCurrency(Math.round(hourlyRate))}/hr
        </span>
      </div>

      {/* W/L/P/BJ breakdown */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-green-400">{handsWon}W</span>
        <span className="text-red-400">{handsLost}L</span>
        <span className="text-neutral-500">{handsPushed}P</span>
        <span className="text-yellow-400">{blackjacks}BJ</span>
      </div>
    </div>
  );
}
