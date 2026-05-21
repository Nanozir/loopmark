// Creates a Stripe Checkout Session for a paid 4K download.
//
// SECURITY NOTES:
// - We never echo the YouTube URL back through `success_url`. Anything we
//   read from the URL on the success page would be untrusted. Instead we
//   stash the URL in `metadata` server-side, and the success page calls
//   `verify-session.js` to retrieve it after Stripe confirms payment.
// - STRIPE_SECRET_KEY MUST be set in Netlify env vars. We refuse to start
//   if it's missing so we never silently issue real charges with a bad key.

const { guardedHandler, rateLimit } = require('./_lib');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_KEY ? require('stripe')(STRIPE_KEY) : null;

const SITE_URL = process.env.SITE_URL || 'https://loopmark.se';

exports.handler = guardedHandler(async (body, event) => {
  if (!stripe) {
    return { statusCode: 503, body: { error: 'Payments are not configured.' } };
  }

  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  if (!rateLimit(ip, { windowMs: 60_000, max: 4 })) {
    return { statusCode: 429, body: { error: 'Too many requests' } };
  }

  const { url, quality, title } = body;
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, body: { error: 'Invalid url' } };
  }
  if (!/youtu\.?be/i.test(url)) {
    return { statusCode: 400, body: { error: 'Only YouTube URLs are supported' } };
  }
  const safeQuality = ['4K', '1080p', 'MP3'].includes(quality) ? quality : '4K';
  const safeTitle = String(title || 'video').slice(0, 80);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `LoopMark: ${safeTitle.slice(0, 40)} (${safeQuality})`,
            description: 'High-quality MP4 download'
          },
          unit_amount: 100
        },
        quantity: 1
      }],
      mode: 'payment',
      // Stash the request payload server-side. The client does NOT need to
      // re-send the URL to the success page.
      metadata: { youtube_url: url, quality: safeQuality, title: safeTitle },
      success_url: `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/`
    });

    return { statusCode: 200, body: { url: session.url } };
  } catch (err) {
    console.error('stripe error:', err && err.message);
    return { statusCode: 500, body: { error: 'Checkout creation failed' } };
  }
});
