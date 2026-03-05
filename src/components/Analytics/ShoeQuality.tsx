import { useSessionStore } from '../../stores/sessionStore.js';
import { useGameStore } from '../../stores/gameStore.js';

export function ShoeQuality() {
  const shoePeakTCs = useSessionStore((s) => s.shoePeakTCs);
  const currentPeakTC = useGameStore((s) => s.peakTrueCount);
  const shoesPlayed = useSessionStore((s) => s.shoesPlayed);

  // Include current shoe's peak if in progress
  const allPeaks = shoesPlayed > shoePeakTCs.length
    ? [...shoePeakTCs, currentPeakTC]
    : shoePeakTCs;

  if (allPeaks.length === 0) return null;

  const avgPeak = allPeaks.reduce((a, b) => a + b, 0) / allPeaks.length;
  const profitableShoes = allPeaks.filter((tc) => tc >= 2).length;
  const profitablePct = (profitableShoes / allPeaks.length) * 100;
  const bestShoe = Math.max(...allPeaks);

  return (
    <div className="space-y-1.5">
      <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Shoe Quality</div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-500">
          Avg peak <span className="text-neutral-300">+{avgPeak.toFixed(1)}</span>
        </span>
        <span className="text-neutral-500">
          Best <span className="text-neutral-300">+{bestShoe.toFixed(1)}</span>
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-500">
          TC{'\u22652'} shoes <span className={profitablePct >= 50 ? 'text-green-400' : 'text-amber-400'}>{profitablePct.toFixed(0)}%</span>
        </span>
        <span className="text-neutral-600 text-[10px]">
          {profitableShoes}/{allPeaks.length}
        </span>
      </div>
      {/* Mini sparkline of peak TCs */}
      {allPeaks.length > 1 && (
        <div className="flex items-end gap-px h-4">
          {allPeaks.map((tc, i) => {
            const h = Math.max(2, Math.min(16, (tc / Math.max(bestShoe, 1)) * 16));
            const color = tc >= 2 ? 'bg-green-500/60' : 'bg-neutral-700';
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm ${color}`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
