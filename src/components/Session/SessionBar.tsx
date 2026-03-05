import { useEffect, useState, useRef } from 'react';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useGameStore } from '../../stores/gameStore.js';
import { formatCurrency, formatElapsedTime } from '../../utils/formatters.js';

export function SessionBar() {
  const { bankroll, startingBankroll, handsPlayed, shoesPlayed, sessionStartTime } = useSessionStore();
  const isWongedOut = useGameStore((s) => s.isWongedOut);
  const [, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Update elapsed time every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setEditValue(String(startingBankroll));
    setEditing(true);
  }

  function commitEdit() {
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val > 0) {
      useSessionStore.getState().setStartingBankroll(val);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between text-sm px-1">
      <div className="text-neutral-400">
        {editing ? (
          <span className="inline-flex items-center gap-1">
            <span className="text-neutral-500">$</span>
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
                e.stopPropagation();
              }}
              className="w-20 bg-neutral-800 border border-neutral-600 rounded px-1 py-0.5 text-neutral-200 font-mono font-bold text-sm outline-none focus:border-blue-500"
            />
          </span>
        ) : (
          <span
            className="font-mono font-bold text-neutral-200 cursor-pointer hover:text-blue-400 transition-colors"
            onClick={startEdit}
            title="Click to edit starting bankroll"
          >
            {formatCurrency(bankroll)}
          </span>
        )}
      </div>
      <div className="text-neutral-500">
        Hands: <span className="font-mono text-neutral-300">{handsPlayed}</span>
        {shoesPlayed > 0 && (
          <span className="ml-2">Shoes: <span className="font-mono text-neutral-300">{shoesPlayed}</span></span>
        )}
      </div>
      <div className="text-neutral-500">
        {sessionStartTime ? formatElapsedTime(sessionStartTime) : '0m'}
      </div>
      {isWongedOut && (
        <div className="text-amber-500 font-semibold text-xs uppercase animate-pulse">
          WONG OUT
        </div>
      )}
    </div>
  );
}
