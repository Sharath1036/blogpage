const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

const WORDS_PER_MINUTE = 200;

marked.setOptions({ gfm: true, breaks: false });

const SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'h1', 'h2', 'del', 'ins', 'mark', 'figure', 'figcaption', 'iframe', 'span', 'u',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class', 'id'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title'],
    code: ['class'],
  },
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  transformTags: {
    // Open external links in a new tab safely.
    a: (tagName, attribs) => {
      if (/^https?:\/\//i.test(attribs.href || '')) {
        attribs.target = '_blank';
        attribs.rel = 'noopener noreferrer';
      }
      return { tagName, attribs };
    },
    // Make inline images responsive by default.
    img: (tagName, attribs) => {
      attribs.class = [attribs.class, 'img-fluid d-block mx-auto my-3'].filter(Boolean).join(' ');
      attribs.loading = 'lazy';
      return { tagName, attribs };
    },
  },
};

/** Markdown (with optional inline HTML) -> sanitized HTML. */
function markdownToHtml(markdown) {
  const raw = marked.parse(markdown || '');
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}

/** Strip tags and collapse whitespace to get readable plain text. */
function htmlToText(html) {
  return sanitizeHtml(html || '', { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const matches = (text || '').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function readTimeFor(wordCount) {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/** Build an excerpt of roughly `maxWords` words ending in "...". */
function makeExcerpt(text, maxWords = 22) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ').replace(/[.,;:!?]+$/, '') + '...';
}

/**
 * Turn the raw form content into everything the templates need.
 * format: 'markdown' (default, from the admin form) or 'html' (legacy posts).
 */
function buildContent(source, format = 'markdown') {
  const html = format === 'html' ? source || '' : markdownToHtml(source);
  const text = htmlToText(html);
  const wordCount = countWords(text);
  return { html, text, wordCount, readTime: readTimeFor(wordCount) };
}

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

module.exports = {
  WORDS_PER_MINUTE,
  markdownToHtml,
  htmlToText,
  countWords,
  readTimeFor,
  makeExcerpt,
  buildContent,
  slugify,
};
