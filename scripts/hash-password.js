// For phpMyAdmin-only setups: prints a bcrypt hash + a ready-to-paste SQL INSERT for the admin user.
// Usage: node scripts/hash-password.js you@example.com 'your long password'
const bcrypt = require('bcryptjs');
const [email, pw] = process.argv.slice(2);
if (!email || !pw || pw.length < 10) { console.error("Usage: node scripts/hash-password.js email 'password (10+ chars)'"); process.exit(1); }
const hash = bcrypt.hashSync(pw, 12);
console.log(`\nINSERT INTO admin_users (email, password_hash) VALUES ('${email.toLowerCase().replace(/'/g, "''")}', '${hash}');\n`);
