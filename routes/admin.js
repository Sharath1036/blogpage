const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Blog = require('../models/Blog');
const Media = require('../models/Media');
const { CATEGORIES, CATEGORY_KEYS } = require('../lib/categories');
const { buildContent, makeExcerpt, slugify, WORDS_PER_MINUTE } = require('../lib/content');
const {
  verifyCredentials,
  issueSession,
  clearSession,
  requireAdmin,
  loginRateLimit,
  recordFailedLogin,
  clearFailedLogins,
} = require('../lib/auth');

const router = express.Router();

// Admin pages are private: never index or cache them.
router.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store');
  next();
});

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|gif|webp|avif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only PNG, JPEG, GIF, WebP or AVIF images are allowed'), ok);
  },
});

/** Run multer but turn its errors into a form error instead of a 500. */
function optionalUpload(field) {
  return (req, res, next) =>
    upload.single(field)(req, res, (err) => {
      if (err) req.uploadError = err.message;
      next();
    });
}

async function saveMedia(file) {
  const media = await Media.create({
    filename: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    data: file.buffer,
  });
  return `/media/${media._id}`;
}

const categoryOptions = (selected) =>
  CATEGORY_KEYS.map((key) => ({ value: key, label: CATEGORIES[key].title, selected: key === selected }));

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

function renderForm(res, { blog = {}, errors = [], isEdit = false, status = 200 }) {
  res.status(status).render('admin/form', {
    title: isEdit ? 'Edit blog' : 'New blog',
    style: 'admin.css',
    blog,
    errors,
    isEdit,
    categories: categoryOptions(blog.category),
    publishedDate: toDateInput(blog.publishedAt),
    wordsPerMinute: WORDS_PER_MINUTE,
  });
}

/** Validate + normalise the submitted form. Returns { data, errors }. */
async function readBlogForm(req, existing) {
  const b = req.body || {};
  const errors = [];
  const title = (b.title || '').trim();
  const content = b.content || '';
  const category = b.category;
  const slug = slugify(b.slug || title);

  if (!title) errors.push('Title is required.');
  if (!content.trim()) errors.push('Content is required.');
  if (!CATEGORY_KEYS.includes(category)) errors.push('Pick a category.');
  if (!slug) errors.push('Slug is required.');
  if (Blog.RESERVED_SLUGS.includes(slug)) errors.push(`"${slug}" is a reserved URL, choose another slug.`);
  if (req.uploadError) errors.push(req.uploadError);

  if (slug) {
    const clash = await Blog.findOne({ slug, _id: { $ne: existing ? existing._id : null } }).select('_id').lean();
    if (clash) errors.push(`Another blog already uses the URL "/${slug}".`);
  }

  const format = existing && existing.contentFormat === 'html' && b.contentFormat === 'html' ? 'html' : 'markdown';
  const built = buildContent(content, format);

  let coverImage = (b.coverImage || '').trim();
  if (req.file && !req.uploadError && errors.length === 0) coverImage = await saveMedia(req.file);

  const publishedAt = b.publishedAt ? new Date(b.publishedAt + 'T12:00:00') : new Date();

  const data = {
    title,
    slug,
    category,
    content,
    contentFormat: format,
    contentHtml: built.html,
    wordCount: built.wordCount,
    readTime: built.readTime,
    excerpt: (b.excerpt || '').trim() || makeExcerpt(built.text),
    coverImage,
    featured: b.featured === 'on' || b.featured === 'true',
    publishedAt: isNaN(publishedAt) ? new Date() : publishedAt,
  };
  return { data, errors };
}

async function loadBlog(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
    req.blog = await Blog.findById(req.params.id);
    if (!req.blog) return res.sendStatus(404);
    next();
  } catch (err) {
    next(err);
  }
}

// ---------- Auth ----------

router.get('/login', (req, res) => {
  if (req.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin login', style: 'admin.css', next: req.query.next });
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const admin = await verifyCredentials(username, password);
    if (!admin) {
      recordFailedLogin(req.ip);
      return res.status(401).render('admin/login', {
        title: 'Admin login',
        style: 'admin.css',
        error: 'Invalid username or password.',
        username,
        next: req.body.next,
      });
    }
    clearFailedLogins(req.ip);
    admin.lastLoginAt = new Date();
    await admin.save();
    issueSession(res, admin);
    const dest = typeof req.body.next === 'string' && /^\/(?!\/)/.test(req.body.next) ? req.body.next : '/admin';
    res.redirect(dest);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.redirect('/');
});

// Everything below requires the admin session.
router.use(requireAdmin);

// ---------- Dashboard ----------

router.get('/', async (req, res, next) => {
  try {
    const show = req.query.show === 'deleted' ? 'deleted' : 'published';
    const [blogs, publishedCount, deletedCount] = await Promise.all([
      Blog.find({ status: show }).select('title slug category publishedAt readTime wordCount featured status deletedAt').sort({ publishedAt: -1 }).lean(),
      Blog.countDocuments({ status: 'published' }),
      Blog.countDocuments({ status: 'deleted' }),
    ]);
    blogs.forEach((b) => (b.categoryTitle = CATEGORIES[b.category] ? CATEGORIES[b.category].title : b.category));
    res.render('admin/dashboard', {
      title: 'Admin dashboard',
      style: 'admin.css',
      blogs,
      showDeleted: show === 'deleted',
      publishedCount,
      deletedCount,
      flash: req.query.msg,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Create ----------

router.get('/blogs/new', (req, res) => renderForm(res, { blog: { category: 'life' } }));

router.post('/blogs', optionalUpload('coverFile'), async (req, res, next) => {
  try {
    const { data, errors } = await readBlogForm(req, null);
    if (errors.length) return renderForm(res, { blog: { ...req.body, ...data }, errors, status: 422 });
    const blog = await Blog.create(data);
    if (blog.featured) await Blog.updateMany({ _id: { $ne: blog._id } }, { featured: false });
    res.redirect(`/${blog.slug}`);
  } catch (err) {
    next(err);
  }
});

// ---------- Edit ----------

router.get('/blogs/:id/edit', loadBlog, (req, res) => renderForm(res, { blog: req.blog.toObject(), isEdit: true }));

router.post('/blogs/:id', loadBlog, optionalUpload('coverFile'), async (req, res, next) => {
  try {
    const { data, errors } = await readBlogForm(req, req.blog);
    if (errors.length) {
      return renderForm(res, { blog: { ...req.blog.toObject(), ...data }, errors, isEdit: true, status: 422 });
    }
    req.blog.set(data);
    await req.blog.save();
    if (req.blog.featured) await Blog.updateMany({ _id: { $ne: req.blog._id } }, { featured: false });
    res.redirect(`/${req.blog.slug}`);
  } catch (err) {
    next(err);
  }
});

// ---------- Soft delete / restore ----------

router.post('/blogs/:id/delete', loadBlog, async (req, res, next) => {
  try {
    req.blog.status = 'deleted';
    req.blog.deletedAt = new Date();
    req.blog.featured = false;
    await req.blog.save();
    res.redirect('/admin?msg=' + encodeURIComponent(`Deleted "${req.blog.title}". You can restore it from the Deleted tab.`));
  } catch (err) {
    next(err);
  }
});

router.post('/blogs/:id/restore', loadBlog, async (req, res, next) => {
  try {
    req.blog.status = 'published';
    req.blog.deletedAt = null;
    await req.blog.save();
    res.redirect('/admin?msg=' + encodeURIComponent(`Restored "${req.blog.title}".`));
  } catch (err) {
    next(err);
  }
});

// ---------- Editor helpers (JSON) ----------

// Live preview: markdown -> HTML + word count + read time.
router.post('/preview', express.json({ limit: '2mb' }), (req, res) => {
  const { html, wordCount, readTime } = buildContent(req.body.content || '', req.body.format === 'html' ? 'html' : 'markdown');
  res.json({ html, wordCount, readTime });
});

// Inline image upload from the editor; returns a URL to drop into the markdown.
router.post('/media', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    try {
      res.json({ url: await saveMedia(req.file) });
    } catch (e) {
      res.status(500).json({ error: 'Upload failed' });
    }
  });
});

module.exports = router;
