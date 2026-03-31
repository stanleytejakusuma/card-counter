import { HUDLayout } from './components/Layout/HUDLayout.js';
import { StealthOverlay } from './components/Layout/StealthOverlay.js';
import { SessionBar } from './components/Session/SessionBar.js';
import { ShoeProgress } from './components/Session/ShoeProgress.js';
import { SessionStats } from './components/Session/SessionStats.js';
import { CompactCountStrip } from './components/HUD/CompactCountStrip.js';
import { RunningCount } from './components/HUD/RunningCount.js';
import { HandDisplay } from './components/Input/HandDisplay.js';
import { CardFeedback } from './components/Input/CardFeedback.js';
import { CardButtons } from './components/Input/CardButtons.js';
import { HistoryOverlay } from './components/History/HistoryOverlay.js';
import { Scoreboard } from './components/Scoreboard/Scoreboard.js';
import { HowToUse } from './components/Guide/HowToUse.js';
import { Analytics } from './components/Analytics/Analytics.js';
import { CardDistribution } from './components/Analytics/CardDistribution.js';
import { shouldTakeInsurance } from './engine/strategy.js';
import { calculateTrueCount } from './engine/counting.js';
import { calculateHandTotal } from './engine/hand.js';
import { useGameStore } from './stores/gameStore.js';
import { useSettingsStore } from './stores/settingsStore.js';

function InsuranceIndicator() {
  const { runningCount, cardsSeen, seats, activeSeatIndex, dealerUpcard, lastConfirmedRound } = useGameStore();
  const decks = useSettingsStore((s) => s.rules.decks);
  const tc = calculateTrueCount(runningCount, cardsSeen, decks);

  if (!shouldTakeInsurance(tc)) return null;

  // Check if active hand is blackjack + dealer Ace → even money
  const activeSeat = seats[activeSeatIndex];
  const activeHand = activeSeat?.hands[activeSeat.activeHandIndex];
  const showDealer = dealerUpcard ?? lastConfirmedRound?.dealerUpcard;
  const dealerIsAce = showDealer?.rank === 'A';
  const isBlackjack = activeHand && activeHand.cards.length === 2 && calculateHandTotal(activeHand.cards).isBlackjack;

  if (dealerIsAce && isBlackjack) {
    return (
      <div className="text-center py-1">
        <span className="px-3 py-1 bg-emerald-900/50 border border-emerald-600 rounded text-emerald-300 text-xs font-semibold uppercase">
          Take Even Money
        </span>
      </div>
    );
  }

  return (
    <div className="text-center py-1">
      <span className="px-3 py-1 bg-green-900/50 border border-green-600 rounded text-green-300 text-xs font-semibold uppercase">
        Take Insurance
      </span>
    </div>
  );
}

export default function App() {
  return (
    <>
      <StealthOverlay />
      <HistoryOverlay />
      <HUDLayout guide={<><HowToUse /><Analytics /></>} scoreboard={<><Scoreboard /><CardDistribution /></>}>
        {/* TOP: Session telemetry — compact, always visible */}
        <div className="flex-shrink-0 space-y-1">
          <SessionBar />
          <ShoeProgress />
          <SessionStats />
        </div>

        {/* CENTER: Decision info + input zone */}
        <div className="flex-1 flex flex-col justify-center min-h-0 overflow-y-auto space-y-2">
          <CompactCountStrip />
          <InsuranceIndicator />
          <HandDisplay />
          <CardFeedback />
          <div className="border-t border-neutral-800" />
          <CardButtons />
        </div>

        {/* BOTTOM: RC only */}
        <div className="flex-shrink-0 pt-1">
          <RunningCount />
        </div>
      </HUDLayout>
    </>
  );
}
