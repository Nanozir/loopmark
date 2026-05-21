# LoopMark — Improvements changelog & open items

This document tracks the security, accessibility, and quality changes from the 2026-05-21 review, and lists everything that still needs your action (because it requires credentials, third-party setup, or business decisions I can't make for you).

---

## ✅ What was changed in code

### Critical security
- **Disabled the broken $1 4K download tier.** The buttons are now visibly disabled with a "coming soon" tooltip, and `success.html` no longer simulates a download. The old success page would have let anyone with a crafted URL "claim" a download without paying.
- **Removed the hardcoded admin password** from `index.html`. Admin actions now go through a new Netlify function (`admin-delete-comment.js`) that checks `ADMIN_TOKEN` from server env vars and uses the Supabase service-role key to actually delete.
- **Removed the admin email address** from public source. Move the destination email into your EmailJS template's "To Email" field instead — see "Open items" below.
- **Stripe success_url no longer carries the YouTube URL** as a query parameter. The URL is stashed in the Stripe session `metadata` server-side. A new `verify-session.js` function retrieves it after confirming `payment_status === 'paid'`. Use this function once the real download backend is live.
- **XSS hardening of comment rendering.** The old `renderComments()` interpolated user input into a JS template literal inside an `onclick` HTML attribute — a comment containing `${alert(1)}` could escape and execute. The new version uses `createElement` + `textContent` and a single delegated click listener.
- **Comment image whitelist.** `<img src>` is now restricted to `data:image/(jpeg|png|gif|webp)` or `https?://` — `data:image/svg+xml` (which can carry script) is rejected.
- **Hardened Netlify functions.** A shared `_lib.js` adds: origin allow-list (so random sites can't burn your Stripe quota), JSON parsing, OPTIONS/CORS preflight, in-memory IP rate limiting, and centralised error responses that don't leak internals.
- **Profanity filter rewritten** with `\b` word boundaries and a small leetspeak normaliser. The old filter blocked "Mitchell", "assassin", "Scunthorpe", etc. Mild words (damn, hell, crap) were dropped — they generate too many false positives.
- **Comment image uploads** are capped at 5 MB raw, downscaled to fit 1280×1280, and re-encoded as JPEG (quality 0.82). A typical row now stays under ~250 KB instead of growing unboundedly.

### Accessibility
- `aria-label` on every icon-only button (transport, theme, language, install, dismiss, stop, delete-session).
- `aria-hidden="true"` and `focusable="false"` on decorative SVGs.
- Logo is now a focusable `role="button"` with Enter/Space handlers.
- Star rating got `role="radiogroup"`, arrow-key navigation, number-key shortcuts, `aria-checked`, and roving `tabindex`.
- Visible `:focus-visible` outline ring across the app.
- Autosave toggle is now a real `<button>` with `aria-pressed`, instead of a `<div>` with onclick.

### PWA / SEO
- `manifest.json` icon path fixed (`icon192.png` → `icons/icon-512.png`); split into `any` and `maskable` purposes for proper Android mask handling.
- Service worker `{{BUILD_TIME}}` placeholder replaced with a real `APP_VERSION` constant. Bump it on every deploy that ships changed assets (or sed-replace it in CI). Also: skip caching for `/.netlify/functions/*`, Supabase, and YouTube.
- Open Graph + Twitter Card meta tags on `index.html`. Better link previews when shared.
- Canonical URLs and `robots` tags on all pages.
- `success.html` is `noindex,nofollow` (it's a transactional page, no point being indexed).

### Code quality
- `uid()` was defined twice and used 30 bits of entropy. Replaced with `crypto.randomUUID()` plus a fallback for ancient browsers.
- `setInterval(ytTick, 150)` was leaked on every YouTube reload. Now tracked in `ytTickInterval` and cleared in `resetZones()` and before re-init.
- `checkConfig` IIFE no longer crashes if the optional `configBanner` element is absent.
- Comment pagination: 25 per page with "Load older" button instead of a hard 50-cap.

### New files
- `netlify/functions/_lib.js` — shared origin-check / rate-limit / handler helpers
- `netlify/functions/verify-session.js` — server-side Stripe payment verification
- `netlify/functions/admin-delete-comment.js` — token-gated admin moderation
- `privacy.html`, `terms.html` — placeholder legal pages (you must fill these in)
- `supabase-setup.sql` — one-shot setup script with RLS policies + an immutability trigger
- `README.md` — proper project overview
- `IMPROVEMENTS.md` — this file

---

## ⚠️ Open items — these need YOU

I've ranked these by urgency. Items 1–4 should happen before you accept any more real traffic.

### 1. Rotate the leaked Supabase anon key (low urgency) and admin secrets (high urgency)

**Anon key:** the value committed in `index.html` is *meant* to be public, but if you'd prefer a fresh one, regenerate it in Supabase → Settings → API. The new key needs to be pasted into the `CONFIG.SUPABASE_ANON` line.

**Admin password:** assume it's compromised. It's been in your public Git history. Pick a new long random `ADMIN_TOKEN` (e.g. `openssl rand -hex 32`) and set it as a Netlify env var.

**Service-role key:** generate or note your Supabase service-role key (Settings → API → `service_role` secret) and set it as `SUPABASE_SERVICE_ROLE_KEY` in Netlify.

### 2. Run `supabase-setup.sql` in your Supabase project

Open Supabase dashboard → SQL → New query → paste the contents of `supabase-setup.sql` → Run. This adds the right Row-Level-Security so:

- Anyone can read comments and post new ones (subject to size/rating constraints).
- Anyone can `UPDATE` the `likes` field via the rename-me feature (and only that).
- **Nobody anon can DELETE.** Only the service-role key (used by `admin-delete-comment.js`) can delete.

After running it, try deleting a comment via the UI. You should be prompted for the `ADMIN_TOKEN`; on success, the comment disappears. Without RLS, anyone could currently delete every row — please don't put this off.

### 3. Set Netlify environment variables

In Netlify → Site settings → Environment variables, add:

```
STRIPE_SECRET_KEY            sk_test_...     (or sk_live_... when ready)
SITE_URL                     https://loopmark.se
SUPABASE_URL                 https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY    <from Supabase API settings>
ADMIN_TOKEN                  <a long random string>
```

After saving, redeploy.

### 4. Fix the EmailJS report destination

In your EmailJS dashboard, edit template `template_qskjz2o` and hardcode the recipient address there (the **To Email** field). The client no longer passes `to_email` for report submissions, so reports will fail until the template has a destination configured. Hardcoding it server-side is also better security — your inbox stops being publicly visible in the page source.

### 5. Replace the placeholder Privacy & Terms

`privacy.html` and `terms.html` are stubs. With a `.se` domain you fall under GDPR. Either:

- Pay a service like [Termly](https://termly.io), [iubenda](https://www.iubenda.com), or a lawyer to draft them, or
- Adapt a template from the [EU Commission's GDPR guidance](https://commission.europa.eu/law/law-topic/data-protection_en).

Don't ship a real Stripe live key while these say "[your contact email here]".

### 6. Decide on cookie / consent UX

You only use `localStorage` for app preferences (no third-party tracking), so under GDPR you probably don't need a full cookie banner — but you do need to disclose this in your privacy policy. If you ever add analytics (Plausible, Umami, GA4), revisit.

### 7. yt-dlp on Netlify almost certainly will not work

`youtube-dl-exec` shells out to a Python binary which Netlify's Lambda runtime doesn't have, *and* a 10-second function timeout is much too short for a 4K extract. Two viable paths:

- **Move processing off Netlify.** Run a tiny worker on Fly.io / Railway / Render / a $5 VPS that exposes `/process` and `/check`. Have the Netlify functions proxy to it via an internal token.
- **Skip the paid 4K tier entirely** and just keep LoopMark as a player. (Probably the cleaner option until you have demand.)

I've left the buttons disabled with "coming soon" so you can decide later without breaking anything.

### 8. Bump `APP_VERSION` on every deploy

In `sw.js`. If you deploy through GitHub + Netlify, add a build step:

```toml
# netlify.toml
[build]
  command = "sed -i \"s/const APP_VERSION = '.*';/const APP_VERSION = '$(date -u +%Y-%m-%d-%H%M%S)';/\" sw.js"
  publish = "."
```

Otherwise edit it by hand. Without bumping, returning visitors will keep their cached old app indefinitely.

### 9. Migrate comment images to Supabase Storage (nice to have)

Currently I downscale and re-encode client-side, so each row is ~250 KB max. That's tolerable for a few hundred comments but will get heavy at thousands. When you're ready:

1. In Supabase Storage, create a public bucket `comment-images`.
2. Switch the upload code to use `supabase-js` to upload to that bucket and store the public URL in `image_url`.
3. `comments_anon_insert` policy already accepts URL-style `image_url`, no change needed.

### 10. Optional further hardening

- **Image moderation.** No NSFW detection runs on uploads. Hive, Sightengine, or AWS Rekognition can plug into the upload path.
- **Server-side rate limiting for comments.** The in-memory limiter in `_lib.js` resets per cold-start. For real durability, a Supabase RPC that checks counts in a `comment_post_log` table is best.
- **Switch all inline `onclick` to `addEventListener`.** I converted the comment section; the rest is fine but a cleanup pass would let you ship a stricter Content-Security-Policy header.
- **Add a `netlify.toml`** with a `Content-Security-Policy` header to lock down script sources. Once you remove the remaining inline handlers, you can flip on `script-src 'self'`.

---

## Smoke-test checklist after deploy

- [ ] Mark a segment, refresh, see it restored from autosave.
- [ ] Switch language and theme via the topbar.
- [ ] Post a comment without a name → appears as "Anonymous".
- [ ] Try posting "Mitchell scored a hat-trick" → goes through (no false-positive profanity).
- [ ] Try posting a slur → blocked.
- [ ] Try posting a 5 MB JPEG → uploads, but appears small in the comment.
- [ ] Click `🗑 Delete` on a comment → prompted for admin token → token works → comment gone.
- [ ] Try the same delete with a wrong token → rejected, comment stays.
- [ ] On a phone, Add to Home Screen → app installs with the correct icon.
- [ ] Run Lighthouse → accessibility ≥ 95, PWA passes.
