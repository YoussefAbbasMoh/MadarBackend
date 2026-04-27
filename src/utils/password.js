const bcrypt = require('bcryptjs');

/** Must match everywhere we persist `passwordHash` (seed, auth, admin, init). */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash a plaintext password for storage on `User.passwordHash`.
 * Same algorithm/cost as all seed paths and as checked by {@link comparePassword}.
 */
async function hashPassword(plain) {
  if (plain === undefined || plain === null) {
    throw new Error('hashPassword: plain password is required');
  }
  const s = String(plain);
  return bcrypt.hash(s, BCRYPT_SALT_ROUNDS);
}

/**
 * Check plaintext against a bcrypt hash (e.g. login).
 * Works for any hash produced by {@link hashPassword} or bcrypt with compatible rounds.
 */
async function comparePassword(plain, passwordHash) {
  if (plain === undefined || plain === null || !passwordHash) return false;
  try {
    return await bcrypt.compare(String(plain), String(passwordHash));
  } catch {
    // Corrupt or non-bcrypt `passwordHash` in DB must not take down login with 500.
    return false;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  BCRYPT_SALT_ROUNDS,
};
