import { useState } from 'react';
import { SessionPnL } from './SessionPnL.js';
import { TCBracketStats } from './TCBracketStats.js';
import { ShoeQuality } from './ShoeQuality.js';

export function Analytics() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-neutral-800 rounded-lg p-3 space-y-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">
          Analytics
        </span>
        <span className="text-[10px] text-neutral-700">{collapsed ? '+' : '-'}</span>
      </button>

      {!collapsed && (
        <>
          <SessionPnL />
          <TCBracketStats />
          <ShoeQuality />
        </>
      )}
    </div>
  );
}
