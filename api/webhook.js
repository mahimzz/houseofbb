// POST /api/webhook  (called by Stripe, never by customers)
// When a payment succeeds, this sends the order to Printful to be printed and
// posted straight to the customer. This is the "behind the scenes" step.
import Stripe from 'stripe';

const PRINTFUL_API = 'https://api.printful.com';

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. Check the message really came from Stripe.
  let event;
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature check failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('Ignored', { status: 200 });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return new Response('Not paid yet', { status: 200 });
  }

  try {
    // 2. Work out what was bought.
    const size = session.metadata?.size;
    const variants = JSON.parse(process.env.PRINTFUL_VARIANTS || '{}');
    const syncVariantId = variants[size];
    if (!syncVariantId) throw new Error(`No Printful variant set for size "${size}"`);

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const quantity = lineItems.data.reduce((n, item) => n + (item.quantity || 0), 0) || 1;

    // 3. Where it's going.
    const shipping = session.collected_information?.shipping_details || session.shipping_details;
    const customer = session.customer_details || {};
    const address = shipping?.address || customer.address;
    if (!address) throw new Error('No shipping address on session');

    const order = {
      external_id: session.id.slice(-32), // stops the same order being sent twice
      shipping: 'STANDARD',
      recipient: {
        name: shipping?.name || customer.name,
        address1: address.line1,
        address2: address.line2 || undefined,
        city: address.city,
        state_code: address.state || undefined,
        country_code: address.country,
        zip: address.postal_code,
        email: customer.email,
        phone: customer.phone || undefined,
      },
      items: [{ sync_variant_id: Number(syncVariantId), quantity }],
      retail_costs: {
        currency: 'GBP',
        subtotal: (session.amount_subtotal / 100).toFixed(2),
        shipping: ((session.total_details?.amount_shipping || 0) / 100).toFixed(2),
        total: (session.amount_total / 100).toFixed(2),
      },
    };

    // 4. Send it to Printful. PRINTFUL_CONFIRM=true sends it straight to print;
    //    anything else leaves it as a draft for you to check in the Printful dashboard.
    const confirm = process.env.PRINTFUL_CONFIRM === 'true';
    const headers = {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
    };
    if (process.env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;

    const res = await fetch(`${PRINTFUL_API}/orders?confirm=${confirm}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(order),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = JSON.stringify(data?.error || data);
      // Already sent (Stripe retried): that's fine.
      if (/external.?id/i.test(message) && /exist|already|unique/i.test(message)) {
        return new Response('Order already sent', { status: 200 });
      }
      throw new Error(`Printful ${res.status}: ${message}`);
    }

    console.log(`Printful order ${data.result?.id} created for ${session.id} (${size} x${quantity}, confirm=${confirm})`);
    return new Response('OK', { status: 200 });
  } catch (err) {
    // A 500 makes Stripe retry later, so a brief Printful outage doesn't lose the order.
    console.error('Failed to send order to Printful:', err);
    return new Response('Order forwarding failed', { status: 500 });
  }
}
