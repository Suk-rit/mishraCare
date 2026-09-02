const SESSION_KEY = 'janswasthya_session';

/**
 * Save session to localStorage so it persists across browser tabs and restarts.
 * @param {{ role: string, email: string, name?: string, id?: string }} userData
 */
export function saveSession(userData) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
}

/**
 * Read current session. Returns null if not logged in.
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clear session (logout).
 */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Returns the home route for a given role.
 * Roles: 'vishnu' | 'admin' | 'store_manager' | 'devta'
 */
export function roleHome(role) {
  switch (role) {
    case 'vishnu':        return '/vishnu';
    case 'admin':         return '/admin/dashboard';
    case 'store_manager': return '/store/dashboard';
    case 'devta':         return '/devta';
    default:              return '/login';
  }
}
