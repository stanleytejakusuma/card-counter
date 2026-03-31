import { useGameStore } from '../../stores/gameStore.js';

export function RunningCount() {
  const rc = useGameStore((s) => s.runningCount);

  return (
    <div className="text-center text-xs text-neutral-600">
      RC: <span className="font-mono font-bold text-neutral-400">{rc >= 0 ? `+${rc}` : rc}</span>
    </div>
  );
}
