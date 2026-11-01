const mongoose = require('mongoose');

// Images uploaded from the admin form. Stored in MongoDB so uploads work on
// read-only hosts like Vercel (max ~4 MB each, see routes/admin.js).
const mediaSchema = new mongoose.Schema(
  {
    filename: String,
    contentType: { type: String, required: true },
    size: Number,
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Media || mongoose.model('Media', mediaSchema);
