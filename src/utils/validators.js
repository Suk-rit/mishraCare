/**
 * Shared field validators for JanSwasthya staff forms.
 * Every exported function returns a string error message or null if valid.
 */

/** 10-digit Indian mobile number (leading 6-9) */
export function validatePhone(v) {
  if (!v?.trim()) return 'Phone number is required';
  const digits = v.trim().replace(/\s+/g, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return 'Enter a valid 10-digit mobile number (starts with 6-9)';
  return null;
}

/** 12-digit Aadhaar number (no letters) */
export function validateAadhar(v) {
  if (!v?.trim()) return 'Aadhaar number is required';
  const digits = v.trim().replace(/\s+/g, '');
  if (!/^\d{12}$/.test(digits)) return 'Aadhaar must be exactly 12 digits';
  return null;
}

/** PAN: 5 letters + 4 digits + 1 letter */
export function validatePAN(v) {
  if (!v?.trim()) return 'PAN number is required';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.trim().toUpperCase()))
    return 'Invalid PAN format (e.g. ABCDE1234F)';
  return null;
}

/** Basic email format */
export function validateEmail(v) {
  if (!v?.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address';
  return null;
}

/** 6-digit Indian pincode */
export function validatePincode(v) {
  if (!v?.trim()) return null; // pincode optional unless called with required=true
  if (!/^\d{6}$/.test(v.trim())) return 'Pincode must be exactly 6 digits';
  return null;
}

/** Salary — positive number */
export function validateSalary(v) {
  if (!v && v !== 0) return 'Salary is required';
  if (parseFloat(v) <= 0) return 'Salary must be greater than 0';
  return null;
}

/** Required text — not empty */
export function validateRequired(v, label = 'This field') {
  if (!v?.trim()) return `${label} is required`;
  return null;
}

/** Password — min 8 chars */
export function validatePassword(v) {
  if (!v?.trim()) return 'Password is required';
  if (v.trim().length < 8) return 'Password must be at least 8 characters';
  return null;
}

/**
 * Run a map of { fieldKey: validatorFn } and return an errors object.
 * Only includes fields with non-null errors.
 *
 * @param {Record<string, () => string|null>} checks
 * @returns {Record<string, string>}
 */
export function runValidations(checks) {
  const errors = {};
  for (const [key, fn] of Object.entries(checks)) {
    const msg = fn();
    if (msg) errors[key] = msg;
  }
  return errors;
}
