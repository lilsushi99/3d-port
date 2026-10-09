require('dotenv').config();
const multer = require('multer'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const OK = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'video/mp4': '.mp4', 'video/webm': '.webm' };
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + OK[f.mimetype]) }),
  fileFilter: (_q, f, cb) => OK[f.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Unsupported file type'), { status: 400 })),
  limits: { fileSize: 80 * 1024 * 1024 }
});
module.exports = { upload, UPLOAD_DIR };
