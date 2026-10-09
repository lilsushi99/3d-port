require('dotenv').config();
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), rateLimit = require('express-rate-limit'), db = require('./db');
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 24) { console.error('JWT_SECRET must be set (24+ chars). Admin login is disabled until it is.'); }
const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600 * 1000, path: '/' };
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
async function login(req, res) {
  if (!SECRET) return res.status(503).json({ error: 'Admin not configured' });
  const { email = '', password = '' } = req.body || {};
  const [[u]] = await db.query('SELECT * FROM admin_users WHERE email=?', [String(email).toLowerCase()]);
  const ok = u && await bcrypt.compare(String(password), u.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  res.cookie('adm', jwt.sign({ id: u.id, email: u.email }, SECRET, { expiresIn: '8h' }), cookieOpts);
  res.json({ email: u.email });
}
function requireAuth(req, res, next) {
  try {
    if (!SECRET) throw 0;
    req.admin = jwt.verify(req.cookies.adm, SECRET);
    // CSRF guard on top of SameSite=strict: state-changing calls must carry this custom header (browsers can't send it cross-site without CORS preflight)
    if (req.method !== 'GET' && req.get('X-Admin') !== '1') return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch { res.status(401).json({ error: 'Not signed in' }); }
}
module.exports = { login, loginLimiter, requireAuth, cookieOpts };
