import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

const SHUFFLE_ZONE = 75;

export function ShoeProgress() {
  const cardsSeen = useGameStore((s) => s.cardsSeen);
  const totalDecks = useSettingsStore((s) => s.rules.decks);
  const totalCards = totalDecks * 52;
  const percent = (cardsSeen / totalCards) * 100;
  const nearShuffle = percent >= SHUFFLE_ZONE;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-200 ${nearShuffle ? 'bg-amber-500' : 'bg-neutral-500'}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
          {/* Shuffle zone marker */}
          <div
            className="absolute top-0 h-full w-px bg-amber-600/60"
            style={{ left: `${SHUFFLE_ZONE}%` }}
          />
        </div>
        <span className={`text-[10px] tabular-nums min-w-[2.5ch] text-right ${nearShuffle ? 'text-amber-400' : 'text-neutral-600'}`}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}
