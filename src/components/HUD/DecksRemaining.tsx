import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateDecksRemaining } from '../../engine/counting.js';

export function DecksRemaining() {
  const { cardsSeen } = useGameStore();
  const totalDecks = useSettingsStore((s) => s.rules.decks);
  const decksLeft = calculateDecksRemaining(cardsSeen, totalDecks);
  const penetration = ((totalDecks - decksLeft) / totalDecks) * 100;

  return (
    <>
      <div>
        <span className="text-neutral-500 text-sm">Decks: </span>
        <span className="font-mono font-bold text-lg text-neutral-300">{decksLeft.toFixed(1)}</span>
      </div>
      <div>
        <span className="font-mono font-bold text-lg text-neutral-300">{penetration.toFixed(0)}%</span>
      </div>
    </>
  );
}
