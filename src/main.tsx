import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initHistoryRecorder } from './db/historyRecorder.js'
import { hydrateFromFiles, hydrateHistoryFromFiles, initStoreSync } from './db/fileSync.js'

async function boot() {
  // Seed browser storage from file API before stores initialize
  await hydrateFromFiles();
  await hydrateHistoryFromFiles();

  // Start recorders and sync
  initHistoryRecorder();
  initStoreSync();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot().catch((err) => {
  console.error('Boot hydration failed, rendering anyway:', err);
  initHistoryRecorder();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
