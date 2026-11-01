// One-time import of the old hand-written Handlebars posts (legacy/*.handlebars) into MongoDB.
// Safe to re-run: existing slugs are skipped unless you pass --force.
//   npm run migrate:legacy            # import missing posts
//   npm run migrate:legacy -- --force # overwrite posts with the same slug
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../lib/db');
const Blog = require('../models/Blog');
const { buildContent } = require('../lib/content');

const LEGACY_DIR = path.join(__dirname, '..', 'legacy');
const force = process.argv.includes('--force');

// slug -> legacy partial (from the old index.js routes)
const POSTS = {
  'dealing-with-a-stranger': 'stranger',
  'organize-your-linkedin': 'orglinkedin',
  'reactjs-guide': 'reactjs',
  'artificial-intelligence-roadmap': 'airoadmap',
  'from-a-community-to-a-startup': 'community',
  'things-i-let-go-off-in-2023': 'letgo',
  'effective-resume-tips-for-software-engineers': 'resume',
  'best-data-science-youtuber': 'bestdsyt',
  'wish-i-had-this-college-life': 'wishIHad',
  'first-stadium-game-experience': 'firststadium',
  'deleting-past-github-commits': 'deletecommits',
  '2023-unwrapped': '2023unwrapped',
  'internship-scam': 'internshipscam',
  'journey-into-django': 'djangoJourney',
  'end-of-an-era': 'endOfAnEra',
  'the-truth-behind-ai-engineer-role': 'AIEngineer',
  'is-masters-in-data-science-in-india-worth-it': 'Masters_DS',
  'journey-from-ece-to-ai-engineering': 'ece_to_ai',
  '2024-unwrapped': '2024unwrapped',
  'i-came-upon-a-lighthouse': 'i_came_upon_a_lighthouse',
};

// The old orglinkedin page had the resume post's title copy-pasted into it.
const TITLE_OVERRIDES = { 'organize-your-linkedin': 'Organize your LinkedIn' };

const CATEGORY_BY_PATH = { '/life': 'life', '/cs': 'cs', '/professional': 'professional', '/bookshelf': 'bookshelf' };
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/** Excerpts + listing order from the old home page listing. */
function parseListing() {
  const html = fs.readFileSync(path.join(LEGACY_DIR, 'blogData.handlebars'), 'utf8').replace(/\{\{!--[\s\S]*?--\}\}/g, '');
  const result = {};
  const re = /<p style="font-size: 18px;">([\s\S]*?)<\/p>[\s\S]*?href="([a-z0-9-]+)"/g;
  let m;
  let order = 0;
  while ((m = re.exec(html))) {
    if (!result[m[2]]) result[m[2]] = { excerpt: decode(m[1]), order: order++ };
  }
  return result;
}

function parsePost(file) {
  const src = fs.readFileSync(path.join(LEGACY_DIR, file + '.handlebars'), 'utf8');
  const category = CATEGORY_BY_PATH[(src.match(/class="h6 pt-3"><a href="(\/[a-z]+)"/) || [])[1]];
  const title = decode((src.match(/class="h1 text-white"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
  const dateMatch = src.match(/(\d{1,2}) ([A-Z]{3}) (\d{4}) · \d+ MIN READ/);
  const cover = src.match(/<img[^>]*class="[^"]*blogimg[^"]*"[^>]*src="([^"]+)"[^>]*\/?>/);

  // Body = everything after the cover image, minus the closing container </div>.
  const afterCover = src.slice(cover.index + cover[0].length);
  const body = afterCover
    .replace(/<\/div>\s*$/, '')
    .replace(/^\s*(<br\s*\/?>\s*)+/, '')
    .trim();

  if (!category || !title || !dateMatch) throw new Error(`Could not parse ${file}`);
  // Noon UTC so the date doesn't shift across time zones.
  const publishedAt = new Date(Date.UTC(+dateMatch[3], MONTHS[dateMatch[2]], +dateMatch[1], 12));
  return { category, title, publishedAt, coverImage: cover[1], body };
}

async function main() {
  await connectDB();
  await Blog.init(); // ensure unique index on slug
  const listing = parseListing();
  let created = 0, updated = 0, skipped = 0;

  for (const [slug, file] of Object.entries(POSTS)) {
    const post = parsePost(file);
    const meta = listing[slug] || {};
    const { html, wordCount, readTime } = buildContent(post.body, 'html');
    // Keep the old home-page ordering for posts published on the same day.
    const publishedAt = new Date(post.publishedAt.getTime() - (meta.order || 0) * 1000);

    const doc = {
      title: TITLE_OVERRIDES[slug] || post.title,
      slug,
      category: post.category,
      excerpt: meta.excerpt || '',
      coverImage: post.coverImage,
      content: post.body,
      contentFormat: 'html',
      contentHtml: html,
      wordCount,
      readTime,
      publishedAt,
      status: 'published',
    };

    const existing = await Blog.findOne({ slug });
    if (existing && !force) {
      skipped++;
      continue;
    }
    if (existing) {
      existing.set(doc);
      await existing.save();
      updated++;
    } else {
      await Blog.create(doc);
      created++;
    }
    console.log(`${existing ? 'updated' : 'created'}  /${slug}  (${post.category}, ${wordCount} words, ${readTime} min)`);
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} skipped (already in DB).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
