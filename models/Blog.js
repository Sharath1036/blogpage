const mongoose = require('mongoose');
const { CATEGORY_KEYS } = require('../lib/categories');

const RESERVED_SLUGS = ['admin', 'about', 'socials', 'life', 'cs', 'professional', 'bookshelf', 'media', 'css', 'js'];

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and hyphens'],
      validate: {
        validator: (v) => !RESERVED_SLUGS.includes(v),
        message: (p) => `"${p.value}" is a reserved URL`,
      },
    },
    category: { type: String, enum: CATEGORY_KEYS, required: true },
    excerpt: { type: String, trim: true, maxlength: 400 },
    coverImage: { type: String, trim: true, default: '' },

    // What the author typed, and how to interpret it.
    content: { type: String, required: true },
    contentFormat: { type: String, enum: ['markdown', 'html'], default: 'markdown' },
    // Rendered + sanitized HTML (computed on save).
    contentHtml: { type: String, required: true },

    wordCount: { type: Number, default: 0 },
    readTime: { type: Number, default: 1 },

    publishedAt: { type: Date, default: Date.now },
    featured: { type: Boolean, default: false },

    status: { type: String, enum: ['published', 'deleted'], default: 'published', index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'blogData' }
);

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ status: 1, category: 1, publishedAt: -1 });

blogSchema.statics.RESERVED_SLUGS = RESERVED_SLUGS;

module.exports = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
