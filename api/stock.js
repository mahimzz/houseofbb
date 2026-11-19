// GET /api/stock  ->  { limit, remaining, soldOut, ended, endsAt, ... }
// The product page calls this to show "X left" and switch to "Sold out".
import { DROP, getStock, isConfigured } from './_lib/drop.js';

export async function GET() {
  if (!isConfigured()) {
    // Payments not set up yet: show the drop label only.
    return Response.json({ configured: false, limit: DROP.limit, endsAt: DROP.endsAt?.toISOString() || null });
  }
  try {
    const stock = await getStock();
    const { sold, ...publicStock } = stock;
    return Response.json({ configured: true, ...publicStock }, {
      headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' },
    });
  } catch (err) {
    console.error('Stock check failed:', err);
    return Response.json({ configured: true, error: 'unavailable', limit: DROP.limit }, { status: 500 });
  }
}
