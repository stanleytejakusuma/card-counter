import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateTrueCount } from '../../engine/counting.js';
import { calculateSpreadBet, calculateRecommendedHands, TABLE_MIN } from '../../engine/kelly.js';
import { formatCurrency } from '../../utils/formatters.js';

export function BetDisplay() {
  const { runningCount, cardsSeen, seats, playerSeatNumbers } = useGameStore();
  const { minBet, maxBet, unitSize, bankroll } = useSessionStore();
  const decks = useSettingsStore((s) => s.rules.decks);
  const [editing, setEditing] = useState(false);
  const [editUnit, setEditUnit] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editMax, setEditMax] = useState('');
  const unitRef = useRef<HTMLInputElement>(null);

  const multiSeat = playerSeatNumbers.length > 1;

  const tc = calculateTrueCount(runningCount, cardsSeen, decks);
  const bet = calculateSpreadBet({ trueCount: tc, minBet, maxBet, unitSize });
  const handsRec = calculateRecommendedHands({ trueCount: tc, minBet, maxBet, unitSize, bankroll });

  useEffect(() => {
    if (editing && unitRef.current) {
      unitRef.current.focus();
      unitRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setEditUnit(String(unitSize));
    setEditMin(String(minBet));
    setEditMax(String(maxBet));
    setEditing(true);
  }

  function commitEdit() {
    const u = parseInt(editUnit, 10);
    const mn = parseInt(editMin, 10);
    const mx = parseInt(editMax, 10);
    if (!isNaN(u) && u > 0) useSessionStore.getState().setUnitSize(u);
    if (!isNaN(mn) && !isNaN(mx) && mn > 0 && mx >= mn) {
      useSessionStore.getState().setBettingLimits(mn, mx);
    }
    setEditing(false);
  }

  function handleSeatBetClick(seatIndex: number) {
    const seat = seats[seatIndex];
    const current = seat.betOverride;
    const input = window.prompt(
      `Bet override for Seat ${seat.seatNumber} (blank = Kelly default):`,
      current != null ? String(current) : '',
    );
    if (input === null) return; // cancelled
    if (input.trim() === '') {
      useGameStore.getState().setBetOverride(seatIndex, null);
    } else {
      const val = parseInt(input.trim(), 10);
      if (!isNaN(val) && val > 0) {
        useGameStore.getState().setBetOverride(seatIndex, val);
      }
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 py-1">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-neutral-500 mb-0.5">Unit ($)</div>
            <input
              ref={unitRef}
              type="number"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
                e.stopPropagation();
              }}
              className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1.5 text-neutral-200 font-mono text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <div className="text-neutral-500 mb-0.5">Min bet</div>
            <input
              type="number"
              value={editMin}
              onChange={(e) => setEditMin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
                e.stopPropagation();
              }}
              className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1.5 text-neutral-200 font-mono text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <div className="text-neutral-500 mb-0.5">Max bet</div>
            <input
              type="number"
              value={editMax}
              onChange={(e) => setEditMax(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
                e.stopPropagation();
              }}
              className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1.5 text-neutral-200 font-mono text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-center gap-2">
          <button
            onClick={commitEdit}
            className="px-4 py-1 bg-blue-900/50 border border-blue-600 rounded text-blue-300 text-xs font-bold"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Calculate total exposure
  const seatBets = seats.map((s) => s.betOverride ?? bet.amount);
  const totalExposure = seatBets.reduce((sum, b) => sum + b, 0);

  return (
    <div className="text-center">
      <div className={`text-5xl font-bold font-mono ${bet.hasEdge ? 'text-green-300' : 'text-neutral-500'}`}>
        BET: {formatCurrency(bet.amount)}
        <span
          className="text-2xl ml-2 text-neutral-500 cursor-pointer hover:text-blue-400 transition-colors"
          onClick={startEdit}
          title="Click to edit unit size & bet limits"
        >
          ({bet.amount === TABLE_MIN ? 'tbl min' : `${bet.units}u`})
        </span>
      </div>
      {multiSeat && (
        <div className="flex items-center justify-center gap-2 mt-1">
          {seats.map((seat, i) => (
            <button
              key={seat.seatNumber}
              onClick={() => handleSeatBetClick(i)}
              className="text-xs text-neutral-400 hover:text-blue-300 transition-colors cursor-pointer"
              title={`Click to set bet override for Seat ${seat.seatNumber}`}
            >
              S{seat.seatNumber}: {formatCurrency(seat.betOverride ?? bet.amount)}
              {seat.betOverride != null && <span className="text-blue-400 ml-0.5">*</span>}
            </button>
          ))}
          <span className="text-xs text-neutral-500">
            = {formatCurrency(totalExposure)} total
          </span>
        </div>
      )}
      {bet.hasEdge && (
        <div className="text-xs text-green-600 mt-1">
          Edge: {(bet.edge * 100).toFixed(2)}%
        </div>
      )}
      <div className={`text-sm font-bold mt-2 ${handsRec.hands > 1 ? 'text-green-300' : 'text-neutral-500'}`}>
        {handsRec.hands > 1 ? (
          <>
            PLAY {handsRec.hands} HANDS
            <span className="text-xs font-normal ml-1.5 text-neutral-400">
              {formatCurrency(handsRec.perHandBet)}/hand = {formatCurrency(handsRec.totalExposure)}
            </span>
          </>
        ) : (
          <>PLAY 1 HAND</>
        )}
      </div>
      <div className="text-[10px] text-neutral-600 mt-0.5">
        {handsRec.reason}
      </div>
    </div>
  );
}
