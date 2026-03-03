import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateTrueCount } from '../../engine/counting.js';
import { formatTrueCount } from '../../utils/formatters.js';

function getTrueCountColor(tc: number): string {
  if (tc >= 2) return 'text-green-400';
  if (tc >= 1) return 'text-green-700';
  if (tc > -1) return 'text-neutral-300';
  return 'text-red-500';
}

export function TrueCountDisplay() {
  const { runningCount, cardsSeen } = useGameStore();
  const decks = useSettingsStore((s) => s.rules.decks);

  const tc = calculateTrueCount(runningCount, cardsSeen, decks);
  const color = getTrueCountColor(tc);

  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-widest text-neutral-500">True Count</div>
      <div className={`text-7xl font-bold font-mono leading-none ${color}`}>
        {formatTrueCount(tc)}
      </div>
    </div>
  );
}
