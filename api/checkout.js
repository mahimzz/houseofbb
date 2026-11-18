// POST /api/checkout  { size: "M" }  ->  { url: "https://checkout.stripe.com/..." }
// Creates a Stripe Checkout session for the À la Turca tee in the chosen size.
import Stripe from 'stripe';

const SIZES = ['S', 'M', 'L', 'XL', '2XL'];

export async function POST(request) {
  try {
    const { size } = await request.json().catch(() => ({}));
    if (!SIZES.includes(size)) {
      return Response.json({ error: 'Please choose a valid size.' }, { status: 400 });
    }

    // Not set up yet: tell the page so it can show "coming soon" instead of an error.
    if (!process.env.STRIPE_SECRET_KEY || !process.env.PRICE_PENCE) {
      return Response.json({ error: 'not_configured' }, { status: 503 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const site = process.env.SITE_URL || new URL(request.url).origin;
    const price = parseInt(process.env.PRICE_PENCE, 10);
    const shipping = parseInt(process.env.SHIPPING_PENCE || '0', 10);
    if (!price) throw new Error('PRICE_PENCE is not set');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
        price_data: {
          currency: 'gbp',
          unit_amount: price,
          product_data: {
            name: `À la Turca Tee (${size})`,
            description: 'White premium cotton tee · House of BB',
            images: [`${site}/images/a-la-turca.jpg`],
            metadata: { size },
          },
        },
      }],
      metadata: { size },
      shipping_address_collection: { allowed_countries: ['GB'] },
      shipping_options: [{
        shipping_rate_data: {
          display_name: 'Free tracked UK delivery',
          type: 'fixed_amount',
          fixed_amount: { amount: shipping, currency: 'gbp' },
        },
      }],
      phone_number_collection: { enabled: true },
      success_url: `${site}/success`,
      cancel_url: `${site}/`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Checkout is unavailable right now.' }, { status: 500 });
  }
}
