const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

// 20 AI calls per hour per user (falls back to IP if no user)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Key by authenticated user id if available, else by IP (using helper for IPv6 compatibility)
    const userId = req.user?.id || req.user?.userId;
    return userId ? `user_${userId}` : ipKeyGenerator(req.ip);
  },
  message: {
    error: 'AI rate limit exceeded. Maximum 20 AI calls per hour. Please try again later.'
  },
  skip: (req) => {
    return req.user?.role === 'admin';
  }
});

// General API rate limiter — 200 requests per 15 minutes
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

module.exports = { aiRateLimiter, generalRateLimiter };
