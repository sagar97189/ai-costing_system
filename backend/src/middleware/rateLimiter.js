const rateLimitMap = new Map();

/**
 * Checks rate limits for a given key.
 * @param {string} key Unique tracking key (e.g. `login:127.0.0.1` or `resend:user@email.com`)
 * @param {number} maxRequests Maximum requests allowed
 * @param {number} windowMs Window duration in milliseconds
 * @returns {object} { limited: boolean, resetTime: number, remaining: number }
 */
function checkRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitMap.set(key, record);
    return { limited: false, resetTime: record.resetTime, remaining: maxRequests - 1 };
  }

  record.count += 1;
  rateLimitMap.set(key, record);

  if (record.count > maxRequests) {
    return { limited: true, resetTime: record.resetTime, remaining: 0 };
  }

  return { limited: false, resetTime: record.resetTime, remaining: maxRequests - record.count };
}

module.exports = { checkRateLimit };
