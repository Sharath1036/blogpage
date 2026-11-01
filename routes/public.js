const express = require('express');
const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const Media = require('../models/Media');
const { CATEGORIES } = require('../lib/categories');

const router = express.Router();

const LIST_FIELDS = 'title slug category excerpt coverImage publishedAt readTime featured';

// Home: featured post on top (explicitly featured, else the latest), the rest below.
router.get('/', async (req, res, next) => {
  try {
    const blogs = await Blog.find({ status: 'published' })
      .select(LIST_FIELDS)
      .sort({ publishedAt: -1 })
      .lean();
    const featured = blogs.find((b) => b.featured) || blogs[0] || null;
    const others = featured ? blogs.filter((b) => !b._id.equals(featured._id)) : [];
    res.render('home', {
      title: "Sharath's Blogspot",
      style: 'home.css',
      featured,
      blogs: others,
    });
  } catch (err) {
    next(err);
  }
});

// Category pages: /life, /cs, /professional, /bookshelf
Object.entries(CATEGORIES).forEach(([key, cat]) => {
  router.get(cat.path, async (req, res, next) => {
    try {
      const blogs = await Blog.find({ status: 'published', category: key })
        .select(LIST_FIELDS)
        .sort({ publishedAt: -1 })
        .lean();
      res.render('category', { title: cat.title, style: 'home.css', heading: cat.title, blogs });
    } catch (err) {
      next(err);
    }
  });
});

// Uploaded images.
router.get('/media/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
    const media = await Media.findById(req.params.id).lean();
    if (!media) return res.sendStatus(404);
    res.set('Content-Type', media.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(media.data.buffer ? Buffer.from(media.data.buffer) : media.data);
  } catch (err) {
    next(err);
  }
});

// Individual blog posts. Deleted posts 404 for visitors; the admin can still view them.
router.get('/:slug', async (req, res, next) => {
  try {
    const query = { slug: req.params.slug.toLowerCase() };
    if (!req.isAdmin) query.status = 'published';
    const blog = await Blog.findOne(query).lean();
    if (!blog) return res.status(404).render('404', { title: 'Not found', style: 'blogs.css' });
    res.render('blog', { title: blog.title, style: 'blogs.css', blog, description: blog.excerpt });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
