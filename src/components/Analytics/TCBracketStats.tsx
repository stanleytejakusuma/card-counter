import { useSessionStore } from '../../stores/sessionStore.js';

const BRACKETS = [
  { key: 'deepNeg' as const, label: '<-½', bet: '$5' },
  { key: 'neutral' as const, label: '±0', bet: '$10' },
  { key: 'low' as const, label: '½‑1½', bet: '$15' },
  { key: 'mid' as const, label: '1½‑2½', bet: '$20' },
  { key: 'high' as const, label: '2½‑3½', bet: '$25' },
  { key: 'veryHigh' as const, label: '3½+', bet: '$30' },
];

export function TCBracketStats() {
  const tcBrackets = useSessionStore((s) => s.tcBrackets);

  const rows = BRACKETS.map(({ key, label, bet }) => {
    const b = tcBrackets[key];
    const total = b.w + b.l + b.p;
    const winPct = total > 0 ? (b.w / total) * 100 : 0;
    const lossPct = total > 0 ? (b.l / total) * 100 : 0;
    const pushPct = total > 0 ? (b.p / total) * 100 : 0;
    return { label, bet, total, winPct, lossPct, pushPct };
  });

  const hasData = rows.some((r) => r.total > 0);
  if (!hasData) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Win Rate by TC</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 w-7 text-right tabular-nums">{row.label}</span>
          <span className="text-[10px] text-neutral-600 w-6 text-right tabular-nums">{row.bet}</span>
          <div className="flex-1 h-3 bg-neutral-800 rounded-sm overflow-hidden flex">
            {row.total > 0 ? (
              <>
                <div className="h-full bg-green-500/70" style={{ width: `${row.winPct}%` }} />
                <div className="h-full bg-red-500/70" style={{ width: `${row.lossPct}%` }} />
                <div className="h-full bg-neutral-600" style={{ width: `${row.pushPct}%` }} />
              </>
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
          <span className="text-[10px] text-neutral-600 w-6 text-right tabular-nums">{row.total}</span>
        </div>
      ))}
      <div className="flex items-center gap-3 text-[9px] text-neutral-600">
        <span><span className="inline-block w-2 h-2 bg-green-500/70 rounded-sm mr-0.5" />W</span>
        <span><span className="inline-block w-2 h-2 bg-red-500/70 rounded-sm mr-0.5" />L</span>
        <span><span className="inline-block w-2 h-2 bg-neutral-600 rounded-sm mr-0.5" />P</span>
      </div>
    </div>
  );
}
