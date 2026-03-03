import { useSessionStore } from '../../stores/sessionStore.js';

export function OutcomePrompt() {
  const awaitingOutcome = useSessionStore((s) => s.awaitingOutcome);

  if (!awaitingOutcome) return null;

  return (
    <div className="text-center py-1.5">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-900/30 border border-amber-700/50 rounded text-xs">
        <span className="text-amber-400 font-semibold">Outcome:</span>
        <span className="text-amber-200/70 font-mono">
          <span className="text-green-400">[</span>W{' '}
          <span className="text-red-400">]</span>L{' '}
          <span className="text-neutral-400">\</span>P{' '}
          <span className="text-yellow-400">=</span>BJ{' '}
          <span className="text-orange-400">-</span>SR
        </span>
      </div>
    </div>
  );
}
