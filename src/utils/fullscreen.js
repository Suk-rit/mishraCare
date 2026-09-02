/**
 * Fullscreen utility for JanSwasthya
 *
 * Browser rule: requestFullscreen() MUST be called from a direct user gesture.
 * The fullscreenchange event is NOT a user gesture, so calling requestFullscreen
 * inside it is blocked silently.
 *
 * Solution: when fullscreen is exited (Esc or otherwise), show a full-screen
 * overlay that the user must click — that click IS a user gesture, so
 * requestFullscreen() succeeds.
 */

export function enterFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
             el.mozRequestFullScreen || el.msRequestFullscreen;
  return fn ? fn.call(el) : Promise.resolve();
}

export function exitFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen ||
             document.mozCancelFullScreen || document.msExitFullscreen;
  return fn ? fn.call(document) : Promise.resolve();
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);
}

// ── Overlay element ───────────────────────────────────────────────────────────
let _overlay = null;
let _guarding = false;

function createOverlay() {
  if (_overlay) return;
  const div = document.createElement('div');
  div.id = '__fs_overlay';
  div.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.82);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Inter', -apple-system, sans-serif;
    cursor: pointer;
  `;
  div.innerHTML = `
    <div style="text-align:center; color:#fff; padding:0 24px;">
      <div style="font-size:52px; margin-bottom:18px">🔒</div>
      <div style="font-size:22px; font-weight:800; margin-bottom:10px; letter-spacing:-0.3px">
        Fullscreen Required
      </div>
      <div style="font-size:15px; color:rgba(255,255,255,0.65); margin-bottom:32px; max-width:320px; line-height:1.6">
        This app runs in fullscreen mode.<br>Click anywhere to continue.
      </div>
      <div style="background:rgba(255,255,255,0.15); border:1.5px solid rgba(255,255,255,0.3);
        border-radius:14px; padding:14px 36px; font-size:16px; font-weight:700;
        color:#fff; letter-spacing:0.2px;">
        Click to re-enter fullscreen
      </div>
    </div>
  `;
  div.addEventListener('click', () => {
    enterFullscreen()
      .then(() => { hideOverlay(); })
      .catch(() => { hideOverlay(); }); // if still blocked, just hide overlay
  });
  _overlay = div;
}

function showOverlay() {
  createOverlay();
  if (!document.body.contains(_overlay)) {
    document.body.appendChild(_overlay);
  }
  _overlay.style.display = 'flex';
}

function hideOverlay() {
  if (_overlay) _overlay.style.display = 'none';
}

// ── Guard ─────────────────────────────────────────────────────────────────────
let _handler = null;
let _intentionalExit = false;

export function startFullscreenGuard() {
  if (_guarding) return;
  _guarding = true;
  _intentionalExit = false;

  _handler = () => {
    if (_intentionalExit) return;
    if (!isFullscreen()) {
      // Show overlay — user must click to re-enter (satisfies browser gesture requirement)
      showOverlay();
    } else {
      hideOverlay();
    }
  };

  document.addEventListener('fullscreenchange',       _handler);
  document.addEventListener('webkitfullscreenchange', _handler);
  document.addEventListener('mozfullscreenchange',    _handler);
  document.addEventListener('MSFullscreenChange',     _handler);
}

export function stopFullscreenGuard() {
  _guarding = false;
  _intentionalExit = true;
  hideOverlay();

  if (_handler) {
    document.removeEventListener('fullscreenchange',       _handler);
    document.removeEventListener('webkitfullscreenchange', _handler);
    document.removeEventListener('mozfullscreenchange',    _handler);
    document.removeEventListener('MSFullscreenChange',     _handler);
    _handler = null;
  }
}
