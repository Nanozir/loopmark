# LoopMark

Precision audio/video segment player with loop control. Mark in/out points, loop segments forever or N times, autosave sessions, install as a PWA.

Live: <https://loopmark.se>

## Features

- Load any audio or video by URL (YouTube, mp3, mp4, direct file links, blob URLs) or local file
- Mark start/end points on a scrubbable timeline; segments are color-coded
- Per-segment volume, pause-between-segments, infinite or N-loop count
- Autosave sessions to localStorage
- Light / dark theme, English / Swedish translation
- Community comments (Supabase) with star ratings, like + report
- PWA: installable, offline-capable via service worker
- Keyboard shortcuts: `Space` play/pause, `S` mark start, `E` mark end + save

## Tech

- Single-file vanilla HTML/CSS/JS app — no build step
- Comments backed by [Supabase](https://supabase.com) (REST + RLS)
- Optional report-emails via [EmailJS](https://www.emailjs.com)
- Optional 4K paid downloads via Stripe + Netlify Functions (currently disabled — see `IMPROVEMENTS.md`)

## Local development

```bash
# anything that serves static files works
npx serve .
```

To exercise the Netlify functions locally:

```bash
npm install -g netlify-cli
netlify dev
```

## Deploy

Hosted on Netlify. Required environment variables:

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (test or live). Without this, `create-checkout` and `verify-session` return 503. |
| `SITE_URL` | Public URL, e.g. `https://loopmark.se`. Used in Stripe `success_url`. |
| `SUPABASE_URL` | Supabase project URL (for the admin delete function). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for moderation only — **never** ship this to the browser. |
| `ADMIN_TOKEN` | Long random secret you'll paste when deleting a comment. |

Public keys (Supabase anon, EmailJS public key) live in the `CONFIG` block of `index.html`.

## Database

Run [`supabase-setup.sql`](./supabase-setup.sql) once in the Supabase SQL editor. It creates the `comments` table, RLS policies, and a trigger that prevents anon clients from rewriting fields they shouldn't.

## What still needs doing

See [`IMPROVEMENTS.md`](./IMPROVEMENTS.md) for the punch list of items that need user action (env vars, Supabase RLS, GDPR copy, yt-dlp host migration, etc.) and the full changelog from the 2026-05 review.

## License

ISC
