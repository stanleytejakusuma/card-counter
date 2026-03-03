import { useGameStore } from '../../stores/gameStore.js';

export function RunningCount() {
  const rc = useGameStore((s) => s.runningCount);

  return (
    <div>
      <span className="text-neutral-500 text-sm">RC: </span>
      <span className="font-mono font-bold text-lg text-neutral-300">
        {rc >= 0 ? `+${rc}` : rc}
      </span>
    </div>
  );
}
