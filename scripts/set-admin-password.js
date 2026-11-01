// Create an admin, or change an existing admin's password, in the `admins` collection.
//   npm run admin:password -- <username> <password>
// Changing a password logs that admin out everywhere.
// Also adds a JWT_SECRET to .env if it's missing (needed to sign login cookies).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../lib/db');
const Admin = require('../models/Admin');

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: npm run admin:password -- <username> <password>');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Use a password of at least 10 characters.');
    process.exit(1);
  }

  const envPath = path.join(__dirname, '..', '.env');
  const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (!/^JWT_SECRET=.{32,}$/m.test(env)) {
    fs.writeFileSync(envPath, env.replace(/\n?$/, '\n') + `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}\n`);
    console.log('Added a JWT_SECRET to .env.');
  }

  await connectDB();
  await Admin.init();
  const name = username.trim().toLowerCase();
  const existing = await Admin.findOne({ username: name });
  await Admin.updateOne(
    { username: name },
    { $set: { passwordHash: bcrypt.hashSync(password, 12), passwordChangedAt: new Date() } },
    { upsert: true }
  );
  console.log(`${existing ? 'Updated password for' : 'Created'} admin "${name}" in ${mongoose.connection.name}.admins`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
