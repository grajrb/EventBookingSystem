import { storage } from './storage';
import { hashPassword } from './services/auth';
import { logger } from './logger';

/**
 * ensureAdmin
 * Idempotently provisions (or updates) a single administrative user based on env vars.
 *
 * Environment Variables:
 *  ADMIN_EMAIL            (required to activate provisioning)
 *  ADMIN_PASSWORD         (required on first creation; optional on subsequent runs unless ADMIN_FORCE_RESET=true)
 *  ADMIN_NAME             (optional; defaults to 'Platform Admin')
 *  ADMIN_FORCE_RESET      (optional; if 'true', resets password & increments tokenVersion)
 *  ADMIN_AUTO_PROMOTE     (optional; if 'true', will set isAdmin=true even if user exists as non-admin)
 *  DISABLE_ENSURE_ADMIN   (optional; if 'true', skips execution entirely)
 *
 * Behavior:
 *  - If DISABLE_ENSURE_ADMIN=true -> skip.
 *  - If ADMIN_EMAIL missing -> skip quietly (feature opt-in).
 *  - Create user if not present (requires ADMIN_PASSWORD).
 *  - If exists and ADMIN_FORCE_RESET=true and ADMIN_PASSWORD provided -> update password & bump tokenVersion.
 *  - If exists and ADMIN_AUTO_PROMOTE=true -> set isAdmin=true.
 *  - Never logs passwords. Masks length only.
 */
export async function ensureAdmin() {
  if (process.env.DISABLE_ENSURE_ADMIN === 'true') {
    logger.info({ msg: 'ensureAdmin skipped (disabled by env)' });
    return;
  }

  const email = process.env.ADMIN_EMAIL?.trim();
  if (!email) {
    logger.debug({ msg: 'ensureAdmin skipped (no ADMIN_EMAIL set)' });
    return;
  }

  const name = process.env.ADMIN_NAME?.trim() || 'Platform Admin';
  const forceReset = process.env.ADMIN_FORCE_RESET === 'true';
  const autoPromote = process.env.ADMIN_AUTO_PROMOTE === 'true';
  const rawPassword = process.env.ADMIN_PASSWORD;

  try {
    const existing = await storage.getUserByEmail(email);
    if (!existing) {
      if (!rawPassword) {
        logger.error({ msg: 'ensureAdmin cannot create admin: ADMIN_PASSWORD missing' });
        return;
      }
      const hashed = await hashPassword(rawPassword);
      const created = await storage.createUser({ email, password: hashed, name, isAdmin: true });
      logger.warn({ msg: 'Admin user created', email, id: created.id, name });
      return;
    }

    const updates: any = {};
    let changed = false;

    if (forceReset) {
      if (!rawPassword) {
        logger.error({ msg: 'ensureAdmin force reset requested but ADMIN_PASSWORD missing', email });
      } else {
        updates.password = await hashPassword(rawPassword);
        // tokenVersion bump ensures existing JWTs become invalid
        updates.tokenVersion = (existing.tokenVersion || 0) + 1;
        changed = true;
      }
    }

    if (autoPromote && !existing.isAdmin) {
      updates.isAdmin = true;
      changed = true;
    }

    if (Object.keys(updates).length > 0) {
      await storage.updateUser(existing.id, updates);
      logger.warn({ msg: 'Admin user updated', email, forceReset, autoPromote, bumpedTokenVersion: !!updates.tokenVersion });
    } else {
      logger.info({ msg: 'ensureAdmin no changes required', email });
    }
  } catch (err) {
    logger.error({ msg: 'ensureAdmin failed', error: (err as Error).message });
  }
}
