import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { calculateTrueCount } from '../../engine/counting.js';
import { calculateSpreadBet, calculateRecommendedHands } from '../../engine/kelly.js';
import { getStrategyAdvice } from '../../engine/strategy.js';
import { formatTrueCount, formatCurrency } from '../../utils/formatters.js';
import type { StrategyAction } from '../../engine/types.js';

function getTrueCountColor(tc: number): string {
  if (tc >= 2) return 'text-green-400';
  if (tc >= 1) return 'text-green-700';
  if (tc > -1) return 'text-neutral-300';
  return 'text-red-500';
}

const ACTION_LABELS: Record<StrategyAction, string> = {
  H: 'HIT',
  S: 'STAND',
  D: 'DOUBLE',
  P: 'SPLIT',
  R: 'SURRENDER',
};

const ACTION_COLORS: Record<StrategyAction, string> = {
  H: 'text-yellow-400',
  S: 'text-green-400',
  D: 'text-blue-400',
  P: 'text-purple-400',
  R: 'text-red-400',
};

export function CompactCountStrip() {
  const { runningCount, cardsSeen, seats, activeSeatIndex, playerSeatNumbers, dealerUpcard, handPhase } = useGameStore();
  const { minBet, maxBet, unitSize, bankroll } = useSessionStore();
  const rules = useSettingsStore((s) => s.rules);

  const [editing, setEditing] = useState(false);
  const [editUnit, setEditUnit] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editMax, setEditMax] = useState('');
  const unitRef = useRef<HTMLInputElement>(null);

  const tc = calculateTrueCount(runningCount, cardsSeen, rules.decks);
  const tcColor = getTrueCountColor(tc);
  const bet = calculateSpreadBet({ trueCount: tc, minBet, maxBet, unitSize });
  const handsRec = calculateRecommendedHands({ trueCount: tc, minBet, maxBet, unitSize, bankroll });
  const multiSeat = playerSeatNumbers.length > 1;

  // Effective per-hand bet: multi-hand adjusted when playing multiple seats
  const effectiveBet = multiSeat && handsRec.hands > 1 ? handsRec.perHandBet : bet.amount;

  // Strategy advice
  const seat = seats[activeSeatIndex];
  const hand = seat?.hands[seat.activeHandIndex];
  const playerCards = hand?.cards ?? [];
  const hasAdvice = handPhase === 'player' && dealerUpcard && playerCards.length >= 2;

  let actionLabel = '—';
  let actionColor = 'text-neutral-700';
  let isDeviation = false;
  let deviationName = '';

  if (hasAdvice && !hand?.doubled) {
    const advice = getStrategyAdvice(playerCards, dealerUpcard!, tc, rules);
    actionLabel = ACTION_LABELS[advice.action];
    actionColor = ACTION_COLORS[advice.action];
    isDeviation = advice.isDeviation;
    deviationName = advice.deviationName ?? '';
  } else if (hand?.doubled) {
    actionLabel = 'DOUBLED';
    actionColor = 'text-blue-400';
  }

  // Other seats advice (multi-seat)
  const otherSeatsAdvice = multiSeat && hasAdvice
    ? seats
        .map((s, si) => {
          if (si === activeSeatIndex) return null;
          const h = s.hands[s.activeHandIndex];
          if (!h || h.cards.length < 2 || !dealerUpcard) return null;
          const a = getStrategyAdvice(h.cards, dealerUpcard, tc, rules);
          return { seatNumber: s.seatNumber, action: a.action, doubled: h.doubled };
        })
        .filter(Boolean) as { seatNumber: number; action: StrategyAction; doubled: boolean }[]
    : [];

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

  if (editing) {
    return (
      <div className="border border-neutral-800 rounded-lg px-3 py-2 space-y-2">
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

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 items-center border border-neutral-800 rounded-lg px-3 py-2">
        {/* Left: TC */}
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-widest text-neutral-600">TC</div>
          <div className={`text-4xl font-bold font-mono leading-none ${tcColor}`}>
            {formatTrueCount(tc)}
          </div>
        </div>

        {/* Center: Strategy action */}
        <div className="text-center">
          <div className={`text-3xl font-bold ${actionColor}`}>
            {actionLabel}
          </div>
          {isDeviation && (
            <div className="px-2 py-0.5 bg-amber-900/50 border border-amber-600 rounded text-amber-300 text-[10px] font-semibold inline-block animate-pulse">
              INDEX: {deviationName}
            </div>
          )}
        </div>

        {/* Right: Bet */}
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-neutral-600">BET</div>
          <div className={`text-2xl font-bold font-mono leading-none ${bet.hasEdge ? 'text-green-300' : 'text-neutral-500'}`}>
            {formatCurrency(effectiveBet)}
          </div>
          <span
            className="text-xs text-neutral-500 cursor-pointer hover:text-blue-400 transition-colors"
            onClick={startEdit}
          >
            ({`${Math.round(effectiveBet / unitSize)}u`})
          </span>
        </div>
      </div>

      {/* Multi-seat per-seat bets */}
      {multiSeat && (
        <div className="flex items-center justify-center gap-2 text-xs">
          {seats.map((s, i) => (
            <button
              key={s.seatNumber}
              onClick={() => {
                const current = s.betOverride;
                const input = window.prompt(
                  `Bet override for Seat ${s.seatNumber} (blank = default):`,
                  current != null ? String(current) : '',
                );
                if (input === null) return;
                if (input.trim() === '') {
                  useGameStore.getState().setBetOverride(i, null);
                } else {
                  const val = parseInt(input.trim(), 10);
                  if (!isNaN(val) && val > 0) useGameStore.getState().setBetOverride(i, val);
                }
              }}
              className="text-neutral-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              S{s.seatNumber}: {formatCurrency(s.betOverride ?? effectiveBet)}
              {s.betOverride != null && <span className="text-blue-400 ml-0.5">*</span>}
            </button>
          ))}
        </div>
      )}

      {/* Play X hands recommendation */}
      {handsRec.hands > 1 && (
        <div className="text-center text-sm font-bold text-green-300">
          PLAY {handsRec.hands} HANDS
          <span className="text-xs font-normal ml-1.5 text-neutral-400">
            {formatCurrency(handsRec.perHandBet)}/hand = {formatCurrency(handsRec.totalExposure)}
          </span>
        </div>
      )}

      {/* Other seats advice */}
      {otherSeatsAdvice.length > 0 && (
        <div className="flex justify-center gap-3">
          {otherSeatsAdvice.map((o) => (
            <span key={o.seatNumber} className="text-xs">
              <span className="text-neutral-500">S{o.seatNumber}: </span>
              <span className={o.doubled ? 'text-blue-400' : ACTION_COLORS[o.action]}>
                {o.doubled ? '2x' : ACTION_LABELS[o.action]}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Edge info */}
      {bet.hasEdge && (
        <div className="text-center text-[10px] text-green-600">
          Edge: {(bet.edge * 100).toFixed(2)}%
        </div>
      )}
    </div>
  );
}
