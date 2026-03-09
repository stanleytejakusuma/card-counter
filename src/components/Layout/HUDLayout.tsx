import type { ReactNode } from 'react';

export function HUDLayout({ children, guide, scoreboard }: { children: ReactNode; guide?: ReactNode; scoreboard?: ReactNode }) {
  return (
    <div className="h-dvh bg-[#0a0a0a] text-white font-mono flex items-start justify-center p-3 select-none overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex gap-3 w-full max-w-7xl justify-center h-full">
        {/* Left column: guide — visible at xl (1280px+) */}
        {guide && (
          <div className="hidden xl:block w-64 flex-shrink-0 overflow-y-auto h-full">
            {guide}
          </div>
        )}
        {/* Center column: main HUD — flex column, buttons pinned to bottom */}
        <div className="w-full max-w-lg flex flex-col flex-shrink-0 h-full">
          {children}
        </div>
        {/* Right column: scoreboard — visible at lg (1024px+) */}
        {scoreboard && (
          <div className="hidden lg:block w-80 flex-shrink-0 overflow-y-auto h-full">
            {scoreboard}
          </div>
        )}
      </div>
    </div>
  );
}
