import { useSessionStore } from '../../stores/sessionStore.js';
import { formatCurrency } from '../../utils/formatters.js';

export function SessionStats() {
  const { bankroll, startingBankroll, handsWon, handsLost, handsPlayed, shoesPlayed, sessionStartTime } = useSessionStore();

  if (!sessionStartTime) return null;

  const pnl = bankroll - startingBankroll;
  const totalDecided = handsWon + handsLost;
  const winRate = totalDecided > 0 ? (handsWon / totalDecided) * 100 : 0;
  const hoursElapsed = (Date.now() - sessionStartTime) / 3600000;
  const hourlyRate = hoursElapsed > 0.01 ? pnl / hoursElapsed : 0;
  const handsPerHour = hoursElapsed > 0.01 ? handsPlayed / hoursElapsed : 0;
  const handsPerShoe = shoesPlayed > 0 ? handsPlayed / shoesPlayed : 0;

  const pnlColor = pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-neutral-500';

  return (
    <div className="px-1 py-0.5 space-y-0.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-bold font-mono ${pnlColor}`}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</span>
        <span className="text-neutral-500 text-xs">{winRate.toFixed(0)}% W</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-neutral-600">
        <span>{formatCurrency(Math.round(hourlyRate))}/h</span>
        <span>{Math.round(handsPerHour)} hands/h</span>
        {shoesPlayed > 0 && <span>{handsPerShoe.toFixed(0)}/shoe</span>}
      </div>
    </div>
  );
}
