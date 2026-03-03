import { useHistoryViewStore } from '../../stores/historyViewStore.js';
import { SessionListView } from './SessionListView.js';
import { SessionDetailView } from './SessionDetailView.js';
import { ShoeDetailView } from './ShoeDetailView.js';
import { HandDetailView } from './HandDetailView.js';

export function HistoryOverlay() {
  const isOpen = useHistoryViewStore((s) => s.isOpen);
  const view = useHistoryViewStore((s) => s.view);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-neutral-950/95 overflow-y-auto">
      <div className="max-w-lg mx-auto p-4 min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-neutral-200">
            {view.type === 'sessions' && 'Session History'}
            {view.type === 'session-detail' && 'Session Detail'}
            {view.type === 'shoe-detail' && 'Shoe Detail'}
            {view.type === 'hand-detail' && 'Hand Replay'}
          </h1>
          <span className="text-neutral-600 text-xs">
            {view.type !== 'sessions' && 'Backspace: back | '}Esc: close
          </span>
        </div>

        {view.type === 'sessions' && <SessionListView />}
        {view.type === 'session-detail' && <SessionDetailView />}
        {view.type === 'shoe-detail' && <ShoeDetailView />}
        {view.type === 'hand-detail' && <HandDetailView />}
      </div>
    </div>
  );
}
