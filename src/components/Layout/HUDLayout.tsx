import type { ReactNode } from 'react';

export function HUDLayout({ children, guide, scoreboard }: { children: ReactNode; guide?: ReactNode; scoreboard?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono flex items-start justify-center p-3 select-none">
      <div className="flex gap-3 w-full max-w-7xl justify-center">
        {/* Left column: guide — visible at xl (1280px+) */}
        {guide && (
          <div className="hidden xl:block w-64 flex-shrink-0 sticky top-3">
            {guide}
          </div>
        )}
        {/* Center column: main HUD */}
        <div className="w-full max-w-lg space-y-3 flex-shrink-0">
          {children}
        </div>
        {/* Right column: scoreboard — visible at lg (1024px+) */}
        {scoreboard && (
          <div className="hidden lg:block w-80 flex-shrink-0 sticky top-3">
            {scoreboard}
          </div>
        )}
      </div>
    </div>
  );
}
