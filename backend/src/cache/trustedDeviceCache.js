const crypto = require("crypto");

class TrustedDeviceCache {
  constructor() {
    this.sessions = new Map(); // Hashed token -> { email, userId, expiresAt }
  }

  /**
   * Hashes the raw token using SHA-256 for secure storage.
   * @param {string} token 
   * @returns {string} Hashed token
   */
  hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generates a secure random token, hashes it, and stores the session.
   * @param {string} email 
   * @param {number} userId 
   * @returns {object} { rawToken, expiresAt }
   */
  createSession(email, userId) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = this.hashToken(rawToken);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    this.sessions.set(hashed, { email, userId, expiresAt });

    // Periodically clean up expired sessions
    this.cleanup();

    return { rawToken, expiresAt };
  }

  /**
   * Retrieves and validates a session using the raw token.
   * @param {string} rawToken 
   * @returns {object|null} The session details or null if invalid/expired.
   */
  getSession(rawToken) {
    if (!rawToken) return null;
    const hashed = this.hashToken(rawToken);
    const session = this.sessions.get(hashed);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(hashed);
      return null;
    }

    return session;
  }

  /**
   * Invalidates a session by raw token.
   * @param {string} rawToken 
   */
  invalidateSession(rawToken) {
    if (!rawToken) return;
    const hashed = this.hashToken(rawToken);
    this.sessions.delete(hashed);
  }

  /**
   * Invalidates all sessions associated with a specific email (e.g. on password reset).
   * @param {string} email 
   */
  invalidateUserSessions(email) {
    if (!email) return;
    const emailLower = email.toLowerCase().trim();
    for (const [hashed, session] of this.sessions.entries()) {
      if (session.email.toLowerCase().trim() === emailLower) {
        this.sessions.delete(hashed);
      }
    }
  }

  /**
   * Deletes all expired sessions from memory.
   */
  cleanup() {
    const now = Date.now();
    for (const [hashed, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(hashed);
      }
    }
  }
}

module.exports = new TrustedDeviceCache();
