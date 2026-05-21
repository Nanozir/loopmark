// Verifies a Stripe Checkout Session server-side. Call this from the success
// page (or your fulfilment worker) to confirm payment succeeded BEFORE
// delivering anything paid. Never trust the client to tell you it paid.
//
// Returns: { paid: bool, url: string|null, quality: string|null, sessionId: string }

const { guardedHandler } = require('./_lib');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_KEY ? require('stripe')(STRIPE_KEY) : null;

exports.handler = guardedHandler(async (body) => {
  if (!stripe) {
    return { statusCode: 503, body: { error: 'Payments are not configured.' } };
  }

  const { session_id } = body;
  if (!session_id || typeof session_id !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(session_id)) {
    return { statusCode: 400, body: { error: 'Invalid session id' } };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paid = session && session.payment_status === 'paid';
    const meta = (session && session.metadata) || {};
    return {
      statusCode: 200,
      body: {
        paid: !!paid,
        sessionId: session_id,
        url: paid ? (meta.youtube_url || null) : null,
        quality: paid ? (meta.quality || null) : null
      }
    };
  } catch (_) {
    return { statusCode: 404, body: { error: 'Session not found' } };
  }
});
