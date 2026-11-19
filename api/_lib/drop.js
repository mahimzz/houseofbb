// Shared drop settings and stock counting. Files under api/_lib are helpers, not web addresses.
//
// Stock is counted straight from Stripe, so no database is needed:
//   sold     = tees in paid checkouts for this drop
//   reserved = tees in checkouts still open (someone is paying right now, held for 30 minutes)
import Stripe from 'stripe';

export const DROP = {
  id: process.env.DROP_ID || 'drop-01',
  limit: parseInt(process.env.DROP_LIMIT || '50', 10),
  // Only orders from this date onwards count towards the drop (ISO date, e.g. 2026-12-01).
  start: process.env.DROP_START ? Math.floor(new Date(process.env.DROP_START).getTime() / 1000) : 0,
  // Optional closing date/time (ISO, e.g. 2026-12-14T23:59:00Z). Leave empty for no deadline.
  endsAt: process.env.DROP_ENDS ? new Date(process.env.DROP_ENDS) : null,
};

export function isConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.PRICE_PENCE);
}

export async function getStock() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let sold = 0;
  let reserved = 0;

  const params = { limit: 100, expand: ['data.line_items'] };
  if (DROP.start) params.created = { gte: DROP.start };

  for await (const session of stripe.checkout.sessions.list(params)) {
    if (session.metadata?.drop !== DROP.id) continue;
    const qty = (session.line_items?.data || []).reduce((n, li) => n + (li.quantity || 0), 0);
    if (session.status === 'complete' && session.payment_status === 'paid') sold += qty;
    else if (session.status === 'open') reserved += qty;
  }

  const remaining = Math.max(0, DROP.limit - sold - reserved);
  const ended = DROP.endsAt ? Date.now() >= DROP.endsAt.getTime() : false;
  return {
    drop: DROP.id,
    limit: DROP.limit,
    sold,
    remaining,
    soldOut: sold >= DROP.limit,
    // Every tee is held by someone mid-checkout: not sold out yet, but nothing to buy right now.
    allReserved: remaining === 0 && sold < DROP.limit,
    endsAt: DROP.endsAt ? DROP.endsAt.toISOString() : null,
    ended,
  };
}
