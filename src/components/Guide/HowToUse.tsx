import { useState } from 'react';

type Section = 'flow' | 'keys' | 'concepts' | 'outcomes' | 'splits' | 'seats';

const SECTIONS: { id: Section; title: string }[] = [
  { id: 'flow', title: 'Round Flow' },
  { id: 'keys', title: 'Keyboard' },
  { id: 'seats', title: 'Seats & Bets' },
  { id: 'splits', title: 'Split & Double' },
  { id: 'outcomes', title: 'Outcomes' },
  { id: 'concepts', title: 'Counting 101' },
];

function SectionContent({ id }: { id: Section }) {
  switch (id) {
    case 'flow':
      return (
        <div className="space-y-2">
          <Step n={1} title="Dealer upcard">
            Tap the dealer's face-up card. This auto-advances to player phase.
          </Step>
          <Step n={2} title="Your cards">
            Tap your 2 cards. Strategy advice appears after the 2nd card.
          </Step>
          <Step n={3} title="Follow advice">
            The big HIT / STAND / DOUBLE / SPLIT / SURRENDER tells you what to do.
            Pulsing amber = index deviation (count-based override).
          </Step>
          <Step n={4} title="Confirm hand">
            Press <Key>Enter</Key> or tap Confirm when you're done hitting.
          </Step>
          <Step n={5} title="Table cards">
            Now count the rest of the table — other players' cards and dealer hits.
            Press <Key>Enter</Key> to move to the next hand.
          </Step>
          <Step n={6} title="Record outcome">
            After confirming, outcome buttons appear. Tap W/L/P/BJ/EM/SR or use keyboard.
          </Step>
          <div className="text-neutral-600 text-[10px] mt-2 border-t border-neutral-800 pt-2">
            Press <Key>S</Key> for a new shoe. Press <Key>W</Key> to toggle wong in/out.
          </div>
        </div>
      );

    case 'keys':
      return (
        <div className="space-y-0.5">
          <KeyGroup title="Card Input">
            <KeyRow keys="0-9" desc="Card by value (0 = 10)" />
            <KeyRow keys="A" desc="Ace" />
            <KeyRow keys="J Q K" desc="Face cards (= 10)" />
          </KeyGroup>
          <KeyGroup title="Navigation">
            <KeyRow keys="Tab" desc="Next phase / hand / seat" />
            <KeyRow keys="Enter" desc="Confirm hand / next hand" />
            <KeyRow keys="T" desc="Jump to table phase" />
            <KeyRow keys="Backspace" desc="Undo last card" />
            <KeyRow keys="Ctrl+Z" desc="Undo entire hand" />
          </KeyGroup>
          <KeyGroup title="Actions">
            <KeyRow keys="P" desc="Split (pair, 2 cards)" />
            <KeyRow keys="D" desc="Double down (2 cards)" />
            <KeyRow keys="S" desc="New shoe" />
            <KeyRow keys="W" desc="Wong in/out" />
            <KeyRow keys="Shift+1-7" desc="Toggle seat" />
          </KeyGroup>
          <KeyGroup title="Outcomes">
            <KeyRow keys="[" desc="Win" />
            <KeyRow keys="]" desc="Loss" />
            <KeyRow keys="\" desc="Push" />
            <KeyRow keys="=" desc="Blackjack (3:2)" />
            <KeyRow keys="/" desc="Even money (1:1)" />
            <KeyRow keys="-" desc="Surrender" />
          </KeyGroup>
          <KeyGroup title="Other">
            <KeyRow keys="H" desc="History viewer" />
            <KeyRow keys="Esc" desc="Stealth mode" />
          </KeyGroup>
        </div>
      );

    case 'seats':
      return (
        <div className="space-y-2">
          <P>
            Evolution tables have 7 seats. You can occupy up to 4.
          </P>
          <P>
            <Key>Shift+1</Key> through <Key>Shift+7</Key> toggles a seat on/off
            (only when idle — between hands).
          </P>
          <P>
            Or click the seat badges in the scoreboard panel. Right-click a seat
            to mark it as occupied by another player (amber).
          </P>
          <div className="flex items-center gap-3 text-[11px] my-1">
            <span><span className="text-blue-400 font-bold">Blue</span> = yours</span>
            <span><span className="text-amber-400 font-bold">Amber</span> = other player</span>
            <span><span className="text-neutral-600 font-bold">Gray</span> = empty</span>
          </div>
          <P>
            Each seat can have its own bet override — click the seat bet amount
            in the bet display to set it. Blank = use Kelly default.
          </P>
          <P>
            <Key>Tab</Key> advances through hands within a seat, then to the next
            seat, then to table phase.
          </P>
        </div>
      );

    case 'splits':
      return (
        <div className="space-y-2">
          <div>
            <H>Split</H>
            <P>
              When you have a pair (2 cards, same value), press <Key>P</Key>.
              The pair splits into 2 hands. Input cards for hand 1, then hand 2.
            </P>
            <P>
              You can re-split up to 4 hands per seat. Split aces get 1 card each
              and auto-advance.
            </P>
            <P>
              <Key>Backspace</Key> after a fresh split un-splits back to the pair.
            </P>
          </div>
          <div>
            <H>Double Down</H>
            <P>
              With exactly 2 cards, press <Key>D</Key>. The hand is marked doubled (2x bet).
              The next card input auto-advances — you only get 1 more card.
            </P>
            <P>
              <Key>Backspace</Key> on a doubled hand un-doubles it.
            </P>
          </div>
        </div>
      );

    case 'outcomes':
      return (
        <div className="space-y-2">
          <P>After confirming, record each hand's result:</P>
          <div className="space-y-1">
            <OutcomeRow label="W" name="Win" desc="+1x bet" color="text-green-400" />
            <OutcomeRow label="L" name="Loss" desc="-1x bet" color="text-red-400" />
            <OutcomeRow label="P" name="Push" desc="$0" color="text-neutral-400" />
            <OutcomeRow label="BJ" name="Blackjack" desc="+1.5x bet (3:2)" color="text-yellow-400" />
            <OutcomeRow label="EM" name="Even Money" desc="+1x bet (BJ vs Ace)" color="text-emerald-400" />
            <OutcomeRow label="SR" name="Surrender" desc="-0.5x bet" color="text-orange-400" />
          </div>
          <P>
            With multiple seats/splits, outcomes are recorded one at a time —
            the label shows which hand you're recording for.
          </P>
          <P>
            Typing a card key while awaiting outcome skips recording and starts
            the next hand.
          </P>
        </div>
      );

    case 'concepts':
      return (
        <div className="space-y-2">
          <div>
            <H>Hi-Lo Count</H>
            <P>
              2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1.
              Running Count (RC) is the raw sum. True Count (TC) = RC / decks remaining.
            </P>
          </div>
          <div>
            <H>When to Bet Big</H>
            <P>
              TC {'>'}= +2 means player has an edge. The Kelly bet sizes your wager
              proportional to your edge and bankroll.
            </P>
          </div>
          <div>
            <H>Index Plays</H>
            <P>
              The Illustrious 18 + Fab 4 are count-dependent strategy deviations.
              When the TC crosses a threshold, basic strategy changes — e.g. stand
              on 16 vs 10 at TC {'>'}= 0. Shown as pulsing amber alerts.
            </P>
          </div>
          <div>
            <H>Insurance / Even Money</H>
            <P>
              Take insurance when TC {'>'}= +3. If you have BJ vs dealer Ace,
              it's called "even money" — same math, guaranteed 1:1 payout.
            </P>
          </div>
          <div>
            <H>Wong In/Out</H>
            <P>
              Back-counting: watch the shoe without playing. Wong in when TC rises
              (usually +1), wong out when it drops. Press <Key>W</Key> to toggle.
            </P>
          </div>
        </div>
      );
  }
}

// --- Sub-components ---

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-blue-500 font-bold text-xs w-4 flex-shrink-0">{n}.</span>
      <div>
        <span className="text-neutral-300 text-xs font-semibold">{title}</span>
        <div className="text-neutral-500 text-[11px] leading-snug">{children}</div>
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[10px] text-neutral-300 font-mono">
      {children}
    </kbd>
  );
}

function KeyGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{title}</div>
      {children}
    </div>
  );
}

function KeyRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] leading-relaxed">
      <span className="text-neutral-300 font-mono w-20 flex-shrink-0 text-right">{keys}</span>
      <span className="text-neutral-500">{desc}</span>
    </div>
  );
}

function OutcomeRow({ label, name, desc, color }: { label: string; name: string; desc: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={`font-mono font-bold w-6 text-right ${color}`}>{label}</span>
      <span className="text-neutral-300 w-20">{name}</span>
      <span className="text-neutral-600">{desc}</span>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <div className="text-neutral-300 text-xs font-semibold mb-0.5">{children}</div>;
}

function P({ children }: { children: React.ReactNode }) {
  return <div className="text-neutral-500 text-[11px] leading-snug">{children}</div>;
}

// --- Main component ---

export function HowToUse() {
  const [activeSection, setActiveSection] = useState<Section>('flow');

  return (
    <div className="border border-neutral-800 rounded-lg p-3 space-y-2">
      <div className="text-center text-xs text-neutral-500 font-semibold uppercase tracking-wider">
        How to Use
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 justify-center">
        {SECTIONS.map(({ id, title }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              id === activeSection
                ? 'bg-blue-900/60 border border-blue-600 text-blue-300'
                : 'bg-neutral-800/50 border border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-700'
            }`}
          >
            {title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
        <SectionContent id={activeSection} />
      </div>
    </div>
  );
}
