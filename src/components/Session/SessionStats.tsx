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
    <div className="flex items-center justify-between text-[11px] px-1 py-0.5">
      <span className={pnlColor}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</span>
      <span className="text-neutral-500">{winRate.toFixed(0)}%W</span>
      <span className="text-neutral-500">{formatCurrency(Math.round(hourlyRate))}/h</span>
      <span className="text-neutral-500">{Math.round(handsPerHour)}/h</span>
      {shoesPlayed > 0 && (
        <span className="text-neutral-500">{handsPerShoe.toFixed(0)}/shoe</span>
      )}
    </div>
  );
}
