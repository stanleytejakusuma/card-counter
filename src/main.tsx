import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initHistoryRecorder } from './db/historyRecorder.js'

// Initialize history recorder before React mounts
initHistoryRecorder();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
