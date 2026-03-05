import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import type { Rank } from '../../engine/types.js';

// Only ranks that are actually input — J/Q/K all go through '10'
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export function CardDistribution() {
  const cardHistory = useGameStore((s) => s.cardHistory);
  const cardsSeen = useGameStore((s) => s.cardsSeen);
  const decks = useSettingsStore((s) => s.rules.decks);

  const anomalyThreshold = decks * 20;

  // Count occurrences per rank
  const counts = new Map<Rank, number>();
  for (const rank of RANKS) counts.set(rank, 0);
  for (const card of cardHistory) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }

  // Expected per rank: 4 per deck, except 10 which covers 10/J/Q/K = 16 per deck
  function expectedForRank(rank: Rank): number {
    return rank === '10' ? decks * 16 : decks * 4;
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">Card Distribution</span>
        <span className="text-[10px] text-neutral-600">{cardsSeen} dealt</span>
      </div>

      <div className="space-y-0.5">
        {RANKS.map((rank) => {
          const seen = counts.get(rank) ?? 0;
          const expected = expectedForRank(rank);
          const pct = expected > 0 ? (seen / expected) * 100 : 0;
          const isAnomaly = seen === 0 && cardsSeen > anomalyThreshold;
          const isLow = seen > 0 && pct < 30 && cardsSeen > anomalyThreshold;

          const barColor = isAnomaly ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-blue-500';
          const textColor = isAnomaly ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-neutral-400';

          return (
            <div key={rank} className="flex items-center gap-1.5">
              <span className={`text-[10px] font-mono w-5 text-right ${textColor}`}>{rank}</span>
              <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className={`text-[9px] font-mono w-12 text-right ${textColor}`}>
                {seen}/{expected}
              </span>
            </div>
          );
        })}
      </div>

      {cardsSeen > anomalyThreshold && RANKS.some((r) => counts.get(r) === 0) && (
        <div className="text-[10px] text-red-400 border border-red-900/50 rounded px-2 py-1 bg-red-900/20">
          Missing ranks detected — possible anomaly
        </div>
      )}
    </div>
  );
}
