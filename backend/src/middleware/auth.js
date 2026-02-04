const jwt = require('jsonwebtoken');

const AUTH_URL = process.env.AUTH_URL || 'https://auth.atap.solar';
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Require authentication middleware
 * Redirects to auth hub if not authenticated
 */
const requireAuth = (req, res, next) => {
  // Get token from cookie
  const token = req.cookies?.auth_token;

  if (!token) {
    // Redirect to Auth Hub with Return URL
    const returnTo = encodeURIComponent(
      req.protocol + '://' + req.get('host') + req.originalUrl
    );
    return res.redirect(`${AUTH_URL}/?return_to=${returnTo}`);
  }

  try {
    // Verify token
    if (!JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Auth configuration error' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user to request
    // decoded = { userId, phone, role, isAdmin, name }
    req.user = decoded;
    req.userId = decoded.userId;

    next();
  } catch (err) {
    // Token invalid or expired - redirect to login
    console.error('Auth token verification failed:', err.message);
    const returnTo = encodeURIComponent(
      req.protocol + '://' + req.get('host') + req.originalUrl
    );
    return res.redirect(`${AUTH_URL}/?return_to=${returnTo}`);
  }
};

/**
 * Optional auth middleware - attaches user if logged in, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  const token = req.cookies?.auth_token;

  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      req.userId = decoded.userId;
    } catch (err) {
      // Invalid token, continue without user
      req.user = null;
      req.userId = null;
    }
  } else {
    req.user = null;
    req.userId = null;
  }

  next();
};

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user.isAdmin && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

/**
 * API auth middleware - returns 401 instead of redirect (for API routes)
 */
const requireApiAuth = (req, res, next) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      loginUrl: `${AUTH_URL}/?return_to=${encodeURIComponent(req.headers.referer || '/')}`
    });
  }

  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Auth configuration error' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.userId = decoded.userId;

    next();
  } catch (err) {
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      loginUrl: `${AUTH_URL}/?return_to=${encodeURIComponent(req.headers.referer || '/')}`
    });
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireApiAuth,
  AUTH_URL
};
