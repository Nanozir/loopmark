// Note: We use process.env so you don't accidentally leak your real key to the public!
// You will paste your real key into your Netlify dashboard later.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_TEST_KEY_HERE'); 

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { url, quality, title } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `LoopMark: ${title.slice(0, 40)}... (${quality})`,
              description: `High-quality MP4 download`,
            },
            unit_amount: 100, // 100 cents = $1.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Send them to a success page after paying
      success_url: `https://loopmark.se/success.html?session_id={CHECKOUT_SESSION_ID}&url=${encodeURIComponent(url)}`,
      cancel_url: `https://loopmark.se/`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};