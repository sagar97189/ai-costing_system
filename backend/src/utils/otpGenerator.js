const crypto = require("crypto");

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * @returns {string} 6-digit numeric code (e.g., "749204")
 */
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = { generateOTP };
