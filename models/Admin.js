const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true }, // bcrypt
    // Sessions issued before this moment are rejected (logs out other devices on password change).
    passwordChangedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'admins' }
);

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
