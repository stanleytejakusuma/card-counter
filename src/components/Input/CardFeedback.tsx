import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

const SUIT_SYMBOL = '\u2660';

const PHASE_LABELS: Record<string, { text: string; color: string }> = {
  dealer: { text: 'DEALER', color: 'text-amber-600' },
  player: { text: 'PLAYER', color: 'text-amber-600' },
  table: { text: 'TABLE', color: 'text-cyan-500' },
};

export function CardFeedback() {
  const cardHistory = useGameStore((s) => s.cardHistory);
  const handPhase = useGameStore((s) => s.handPhase);
  const playerSeatNumbers = useGameStore((s) => s.playerSeatNumbers);
  const seats = useGameStore((s) => s.seats);
  const activeSeatIndex = useGameStore((s) => s.activeSeatIndex);
  const dealerS17 = useSettingsStore((s) => s.rules.dealerStandsOnSoft17);
  const lastCard = cardHistory.length > 0 ? cardHistory[cardHistory.length - 1] : null;

  const multiSeat = playerSeatNumbers.length > 1;
  const phaseLabel = PHASE_LABELS[handPhase];
  const activeSeat = seats[activeSeatIndex];
  const showSeatLabel = (multiSeat || (activeSeat && activeSeat.hands.length > 1)) && handPhase === 'player';

  let playerLabel = '';
  if (showSeatLabel && activeSeat) {
    if (activeSeat.hands.length > 1) {
      playerLabel = `PLAYER (Seat ${activeSeat.seatNumber}.${activeSeat.activeHandIndex + 1})`;
    } else {
      playerLabel = `PLAYER (Seat ${activeSeat.seatNumber})`;
    }
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-neutral-500">
        {lastCard ? (
          <span>
            Last: <span className="text-neutral-300 font-mono font-bold">{lastCard.rank}{SUIT_SYMBOL}</span>
          </span>
        ) : (
          <span>No cards</span>
        )}
        {phaseLabel && (
          <span className={`ml-3 text-xs uppercase font-semibold ${phaseLabel.color}`}>
            {showSeatLabel ? playerLabel : phaseLabel.text}
          </span>
        )}
      </div>
      <div className="text-neutral-600 font-mono text-xs">
        {multiSeat && handPhase === 'idle' && (
          <span className="text-neutral-500 mr-2">
            {playerSeatNumbers.length} seats ({playerSeatNumbers.join(',')})
          </span>
        )}
        {dealerS17 ? 'S17' : 'H17'}
      </div>
    </div>
  );
}
