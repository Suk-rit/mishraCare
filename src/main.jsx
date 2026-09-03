import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { getSession } from './utils/session.js';
import { enterFullscreen, startFullscreenGuard } from './utils/fullscreen.js';

// ── On every page load: if user is logged in, restore fullscreen guard ────────
// This handles: browser refresh, back/forward navigation, direct URL access.
const session = getSession();
if (session?.role) {
  // Re-enter fullscreen and restart guard automatically
  enterFullscreen()
    .then(() => { startFullscreenGuard(); })
    .catch(() => {
      // Browser blocked auto-fullscreen on load (requires user gesture).
      // Start the guard anyway — it will show the overlay immediately
      // so user sees the "Click to re-enter" prompt on first interaction.
      startFullscreenGuard();
    });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
