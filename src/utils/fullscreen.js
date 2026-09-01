/**
 * Fullscreen utility
 * requestFullscreen() — enters fullscreen (call on login success)
 * exitFullscreen()    — exits fullscreen (call on logout)
 */

export function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen)       return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen(); // Safari
  if (el.mozRequestFullScreen)    return el.mozRequestFullScreen();    // Firefox old
  if (el.msRequestFullscreen)     return el.msRequestFullscreen();     // IE/Edge old
}

export function exitFullscreen() {
  if (document.exitFullscreen)       return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen)  return document.mozCancelFullScreen();
  if (document.msExitFullscreen)     return document.msExitFullscreen();
}

export function isFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

/**
 * Start watching fullscreen state.
 * If the user presses Esc or otherwise exits fullscreen,
 * we immediately re-enter fullscreen.
 * Returns a cleanup function — call it on logout.
 */
let _watching = false;
let _intentionalExit = false; // set to true only on our own logout

export function startFullscreenGuard() {
  if (_watching) return;
  _watching = true;
  _intentionalExit = false;

  const handler = () => {
    if (_intentionalExit) return; // we triggered the exit — don't re-enter
    if (!isFullscreen()) {
      // Small delay so the browser fully processes the Esc event first
      setTimeout(() => {
        enterFullscreen().catch(() => {});
      }, 120);
    }
  };

  document.addEventListener('fullscreenchange',       handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange',    handler);
  document.addEventListener('MSFullscreenChange',     handler);

  // Store handler reference so we can remove it
  window.__fullscreenHandler = handler;
}

export function stopFullscreenGuard() {
  _watching = false;
  _intentionalExit = true;

  const handler = window.__fullscreenHandler;
  if (handler) {
    document.removeEventListener('fullscreenchange',       handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange',    handler);
    document.removeEventListener('MSFullscreenChange',     handler);
    window.__fullscreenHandler = null;
  }
}
