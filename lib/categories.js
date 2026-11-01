// Single source of truth for blog categories.
const CATEGORIES = {
  life: { label: 'LIFE', title: 'Life', path: '/life' },
  cs: { label: 'COMPUTER SCIENCE', title: 'Computer Science', path: '/cs' },
  professional: { label: 'PROFESSIONAL', title: 'Professional', path: '/professional' },
  bookshelf: { label: 'BOOKSHELF📖', title: 'Bookshelf📖', path: '/bookshelf' },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

module.exports = { CATEGORIES, CATEGORY_KEYS };
