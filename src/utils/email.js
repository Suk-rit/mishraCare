import { supabase } from './supabase';

/**
 * Sends a welcome email to a newly created admin or store manager.
 * Fires-and-forgets — a failure never blocks the main flow.
 *
 * @param {object} params
 * @param {string} params.email       - recipient email
 * @param {string} params.password    - plain-text password (from the creation form)
 * @param {string} params.name        - full name
 * @param {'admin'|'store_manager'} params.role
 * @param {string} [params.store_name] - only for store_manager role
 */
export async function sendWelcomeEmail({ email, password, name, role, store_name }) {
  try {
    const { error } = await supabase.functions.invoke('send-welcome', {
      body: { email, password, name, role, store_name: store_name || null },
    });
    if (error) console.warn('Welcome email failed (non-blocking):', error.message);
  } catch (err) {
    // Never let email failure break the creation flow
    console.warn('Welcome email error (non-blocking):', err);
  }
}
