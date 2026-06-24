class OTPCache {
  constructor() {
    this.cache = new Map();
    // Default to 5 minutes if not defined in .env
    this.expiryMs = (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5) * 60 * 1000;
  }

  /**
   * Caches an OTP for a given email address.
   * Clears any previous OTP and associated expiration timer.
   * @param {string} email 
   * @param {string} otp 
   */
  setOTP(email, otp) {
    const key = email.toLowerCase().trim();
    const expiresAt = Date.now() + this.expiryMs;

    const existing = this.cache.get(key);
    if (existing && existing.timer) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.deleteOTP(key);
    }, this.expiryMs);

    this.cache.set(key, {
      otp,
      expiresAt,
      attempts: 0,
      timer
    });
  }

  /**
   * Retrieves the OTP cached entry for a given email address.
   * @param {string} email 
   * @returns {object|null} The OTP record or null if not found/expired.
   */
  getOTP(email) {
    const key = email.toLowerCase().trim();
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.deleteOTP(key);
      return null;
    }
    return entry;
  }

  /**
   * Increments verification attempts for a given email address.
   * @param {string} email 
   */
  incrementAttempts(email) {
    const key = email.toLowerCase().trim();
    const entry = this.cache.get(key);
    if (entry) {
      entry.attempts += 1;
    }
  }

  /**
   * Deletes cached OTP entry and clears its timer.
   * @param {string} email 
   */
  deleteOTP(email) {
    const key = email.toLowerCase().trim();
    const entry = this.cache.get(key);
    if (entry) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      this.cache.delete(key);
    }
  }
}

module.exports = new OTPCache();
