require('dotenv').config();

const express = require('express');
const path = require('path');
const { engine } = require('express-handlebars');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./lib/db');
const { loadAdmin } = require('./lib/auth');
const { CATEGORIES } = require('./lib/categories');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const app = express();
app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'images')));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

app.engine(
  'handlebars',
  engine({
    defaultLayout: 'main',
    helpers: {
      // 8 MAR 2025
      formatDate: (d) => {
        if (!d) return '';
        const date = new Date(d);
        return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
      },
      categoryLabel: (key) => (CATEGORIES[key] ? CATEGORIES[key].label : key),
      categoryPath: (key) => (CATEGORIES[key] ? CATEGORIES[key].path : '/'),
      // Image paths: absolute URLs and /paths pass through; bare filenames are served from /images.
      imgSrc: (src) => {
        if (!src) return '/blogLogo.png';
        return /^(https?:)?\/\//i.test(src) || src.startsWith('/') ? src : '/' + src;
      },
      eq: (a, b) => a === b,
      year: () => new Date().getFullYear(),
    },
  })
);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(loadAdmin);

// Static (non-DB) pages.
app.get('/about', (req, res) => res.render('about', { title: 'About', style: 'about.css' }));
app.get('/socials', (req, res) => res.render('socials', { title: 'Socials', style: 'about.css' }));

// Everything below needs MongoDB.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    res.status(503).send('Database unavailable. Please try again shortly.');
  }
});

app.use('/admin', adminRoutes); // must come before the /:slug catch-all
app.use('/', publicRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
