import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import type { CardContext } from '../../stores/gameStore.js';

const SUIT_SYMBOL = '\u2660';

const PHASE_LABELS: Record<string, { text: string; color: string }> = {
  deal: { text: 'DEAL', color: 'text-amber-600' },
  dealer: { text: 'DEALER', color: 'text-amber-600' },
  player: { text: 'PLAYER', color: 'text-amber-600' },
  table: { text: 'DEALER', color: 'text-red-400' },
};

function getTargetColor(target: string, playerSeatNumbers: number[]): string {
  if (target === 'D') return 'text-red-400 bg-red-900/30 border-red-800';
  if (target === 'T') return 'text-red-400 bg-red-900/30 border-red-800';
  if (target.startsWith('S')) {
    const match = target.match(/^S(\d+)/);
    if (match) {
      const seatNum = parseInt(match[1]);
      if (playerSeatNumbers.includes(seatNum)) {
        return 'text-blue-400 bg-blue-900/30 border-blue-800';
      }
      return 'text-amber-400 bg-amber-900/30 border-amber-800';
    }
  }
  return 'text-neutral-400 bg-neutral-800/30 border-neutral-700';
}

export function CardFeedback() {
  const cardHistory = useGameStore((s) => s.cardHistory);
  const cardContextHistory = useGameStore((s) => s.cardContextHistory) ?? [];
  const handPhase = useGameStore((s) => s.handPhase);
  const playerSeatNumbers = useGameStore((s) => s.playerSeatNumbers);
  const seats = useGameStore((s) => s.seats);
  const activeSeatIndex = useGameStore((s) => s.activeSeatIndex);
  const dealerS17 = useSettingsStore((s) => s.rules.dealerStandsOnSoft17);
  const _dealOrderIndex = useGameStore((s) => s._dealOrderIndex);
  const occupiedSeatNumbers = useGameStore((s) => s.occupiedSeatNumbers);
  const _activePlaySeat = useGameStore((s) => s._activePlaySeat);
  const lastCard = cardHistory.length > 0 ? cardHistory[cardHistory.length - 1] : null;

  const multiSeat = playerSeatNumbers.length > 1;
  const activeSeat = seats[activeSeatIndex];

  // Determine effective phase label
  const dealOrder = [...playerSeatNumbers, ...occupiedSeatNumbers].sort((a, b) => a - b);
  const inDealMode = handPhase === 'player' && dealOrder.length > 0 && _dealOrderIndex < dealOrder.length * 2;
  const effectivePhase = inDealMode ? 'deal' : handPhase;
  const phaseLabel = PHASE_LABELS[effectivePhase];

  // Show seat label only in play mode (not deal mode)
  const isOccupiedActive = _activePlaySeat > 0 && occupiedSeatNumbers.includes(_activePlaySeat);
  const showSeatLabel = !inDealMode && handPhase === 'player' && (
    isOccupiedActive || multiSeat || (activeSeat && activeSeat.hands.length > 1)
  );

  let playerLabel = '';
  if (showSeatLabel) {
    if (isOccupiedActive) {
      playerLabel = `OTHER (Seat ${_activePlaySeat})`;
    } else if (activeSeat) {
      if (activeSeat.hands.length > 1) {
        playerLabel = `PLAYER (Seat ${activeSeat.seatNumber}.${activeSeat.activeHandIndex + 1})`;
      } else {
        playerLabel = `PLAYER (Seat ${activeSeat.seatNumber})`;
      }
    }
  }

  // Draw history — last 10 entries
  const historySlice = cardContextHistory.slice(-10);

  return (
    <div className="space-y-1">
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

      {/* Draw history strip */}
      {historySlice.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {historySlice.map((entry: CardContext, i: number) => (
            <span
              key={i}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${getTargetColor(entry.target, playerSeatNumbers)}`}
            >
              <span className="opacity-70">{entry.target === 'T' ? 'D' : entry.target}:</span>{entry.rank}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
