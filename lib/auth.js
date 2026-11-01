const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const { connectDB } = require('./db');

const COOKIE_NAME = 'admin_token';
const SESSION_HOURS = 12;
// Compared against when the username doesn't exist, so response time doesn't reveal valid usernames.
let dummyHash = null;
const getDummyHash = () => dummyHash || (dummyHash = bcrypt.hashSync('not-a-real-password', 12));

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
  }
  return secret;
}

/** Returns the admin document if the credentials are valid, otherwise null. */
async function verifyCredentials(username, password) {
  const admin = await Admin.findOne({ username: String(username || '').trim().toLowerCase() });
  const ok = await bcrypt.compare(String(password || ''), admin ? admin.passwordHash : getDummyHash());
  return admin && ok ? admin : null;
}

function issueSession(res, admin) {
  const token = jwt.sign({ sub: String(admin._id), role: 'admin' }, jwtSecret(), { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict', // blocks cross-site form posts (CSRF) to admin routes
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Sets req.isAdmin / res.locals.isAdmin on every request.
 * Only requests carrying the admin cookie hit the database, so visitors pay nothing.
 */
async function loadAdmin(req, res, next) {
  req.isAdmin = false;
  req.admin = null;
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, jwtSecret());
      if (payload.role === 'admin' && mongoose.isValidObjectId(payload.sub)) {
        await connectDB();
        const admin = await Admin.findById(payload.sub).select('username passwordChangedAt').lean();
        // Reject tokens for removed admins or issued before the last password change.
        if (admin && payload.iat * 1000 >= new Date(admin.passwordChangedAt).getTime() - 1000) {
          req.isAdmin = true;
          req.admin = admin;
        }
      }
      if (!req.isAdmin) clearSession(res);
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') clearSession(res);
      else console.error('Admin session check failed:', err.message);
    }
  }
  res.locals.isAdmin = req.isAdmin;
  next();
}

function requireAdmin(req, res, next) {
  if (req.isAdmin) return next();
  if (req.accepts(['html', 'json']) === 'json' || req.xhr) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

// Naive in-memory brute-force protection (per instance).
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function loginRateLimit(req, res, next) {
  const entry = attempts.get(req.ip);
  if (entry && Date.now() - entry.first < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    return res.status(429).render('admin/login', {
      title: 'Admin login',
      style: 'admin.css',
      error: 'Too many failed attempts. Try again in 15 minutes.',
    });
  }
  next();
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first >= WINDOW_MS) attempts.set(ip, { first: now, count: 1 });
  else entry.count += 1;
}

function clearFailedLogins(ip) {
  attempts.delete(ip);
}

module.exports = {
  verifyCredentials,
  issueSession,
  clearSession,
  loadAdmin,
  requireAdmin,
  loginRateLimit,
  recordFailedLogin,
  clearFailedLogins,
};
