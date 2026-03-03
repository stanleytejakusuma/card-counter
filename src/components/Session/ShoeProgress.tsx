import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

export function ShoeProgress() {
  const cardsSeen = useGameStore((s) => s.cardsSeen);
  const totalDecks = useSettingsStore((s) => s.rules.decks);
  const totalCards = totalDecks * 52;
  const percent = (cardsSeen / totalCards) * 100;

  return (
    <div className="w-full">
      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-neutral-500 rounded-full transition-all duration-200"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
