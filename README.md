# Sharath's Blogspot

Express + Handlebars blog. Posts are stored in MongoDB and written from a private admin page.

## Setup

1. MongoDB: run it locally (Windows service `MongoDB`, `mongodb://127.0.0.1:27017/blogpage`), or set a MongoDB Atlas URI.
2. `npm install`
3. Create an admin (stored, bcrypt-hashed, in the `admins` collection; also adds `JWT_SECRET` to `.env` if missing):
   `npm run admin:password -- <username> <password>`. Re-run it to change a password, which logs that admin out everywhere.
4. One-time import of the old hand-written posts in `legacy/`: `npm run migrate:legacy`
5. `npm run dev` → http://localhost:8080

## Admin

- `/admin/login` → dashboard at `/admin` (not linked publicly; an **ADMIN** nav link appears only after login).
- **New blog**: title, section, slug (auto), date, cover image (upload or filename/URL), excerpt (auto if empty), featured flag,
  and Markdown content with live preview, word count and read time (200 wpm).
- **Delete** is a soft delete: `status` is set to `deleted`, so the post is hidden from the site but kept in MongoDB.
  Restore it from the dashboard's *Deleted* tab.
- Home page: the post marked *Featured* (or the latest one) is shown on top, followed by every other published post.

## Deploying to Vercel

Set `MONGODB_URI` (Atlas) and `JWT_SECRET` in the project's environment variables,
then run `npm run migrate:legacy` once against the Atlas database.
