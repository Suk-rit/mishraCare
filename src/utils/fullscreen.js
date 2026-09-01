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
