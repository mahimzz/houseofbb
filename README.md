# House of BB website

Your shop, as real code. Customers pick a size and pay on your site through Stripe. Behind the scenes, the order is sent to Printful, who print the tee and post it to the customer. Customers never see Printful.

```
Customer clicks "Buy now"
   → /api/checkout   opens a Stripe payment page
   → customer pays
   → Stripe calls /api/webhook
   → webhook sends the order to Printful (name, address, size, quantity)
   → Printful prints and ships it, unbranded
```

## What's in the folder

| Path | What it is |
|---|---|
| `public/index.html` | Product page (À la Turca) |
| `public/about.html` | About us |
| `public/shipping.html` | Shipping, returns and size guide |
| `public/success.html` | "Thank you" page after payment |
| `public/styles.css`, `public/app.js` | Look and the Buy button |
| `api/checkout.js` | Starts a Stripe payment |
| `api/webhook.js` | Sends paid orders to Printful |
| `.env.example` | The settings (keys, price) you'll enter in Vercel |

## Setting it up (about an afternoon)

### 1. Printful
1. Create a free account at printful.com.
2. Go to **Stores → Add store → Manual order platform / API**.
3. In that store, **add a product**: pick the white tee you want, upload your **print file** (the artwork on its own, at high resolution, not the photo of the shirt), and enable sizes S–2XL.
4. Turn on **white-label packing** under settings, so parcels carry no Printful branding. Add a packing slip with your House of BB logo and return address if you want one.
5. Go to the **Printful Developer Portal** (developers.printful.com) and create a **private token** with access to orders and that store. That's your `PRINTFUL_API_KEY`.
6. Find the **sync variant ID** for each size. In a terminal (or ask me to help):
   ```
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.printful.com/store/products
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.printful.com/store/products/PRODUCT_ID
   ```
   Each size in `sync_variants` has an `id`. Put them in `PRINTFUL_VARIANTS`, e.g. `{"S":4012345,"M":4012346,...}`.
7. Add a payment card to Printful billing. Printful charges you the base cost when an order is confirmed, and the customer pays you through Stripe.

### 2. Stripe
1. Create an account at stripe.com and fill in your business details (needed to receive payouts).
2. Copy your **secret key** (start with the `sk_test_...` test key).

### 3. Put the code on GitHub and Vercel
1. Create a free GitHub account and a new repository, and upload this folder (GitHub's website lets you drag and drop).
2. Create a free account at vercel.com, click **Add New → Project**, and import the repository. Leave the framework as **Other**.
3. Under **Settings → Environment Variables**, add every line from `.env.example` with your real values.
4. Deploy. You'll get a link like `house-of-bb.vercel.app`.

### 4. Connect Stripe to your site
1. In Stripe, go to **Developers → Webhooks → Add endpoint**.
2. URL: `https://YOUR-SITE/api/webhook`. Event: `checkout.session.completed`.
3. Copy the **signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` in Vercel, then redeploy.

### 5. Test it end to end
1. Keep `PRINTFUL_CONFIRM=false` and Stripe in test mode.
2. Buy a tee on your site with Stripe's test card `4242 4242 4242 4242`, any future date and any CVC.
3. Check that a **draft order** appears in Printful with the right size and address. If it doesn't, look at **Vercel → your project → Logs** for the error.

### 6. Go live
1. Switch Stripe to live mode: replace `STRIPE_SECRET_KEY` with the `sk_live_...` key, create the webhook again in live mode, and update `STRIPE_WEBHOOK_SECRET`.
2. Set `PRINTFUL_CONFIRM=true` so paid orders go straight to print. You can leave it `false` for the first few orders and confirm each one by hand in Printful.
3. Buy your domain (e.g. houseofbb.co.uk), add it in **Vercel → Settings → Domains**, follow the DNS instructions, and update `SITE_URL`.
4. Order one real tee yourself to check the print and the delivery.

## Before launch: fill in the placeholders

Search the `public` folder for `[`. You'll find:
- the product page price, now £20 (must match `PRICE_PENCE=2000`)
- fabric, fit and delivery days
- the About us story: `[YEAR]`, `[FOUNDER NAME]`, `[CITY]`, `[WHAT BB STANDS FOR]`. The story is a draft, so make it true to you.
- `[YOUR EMAIL]`, the size chart (use Printful's chart for your tee) and delivery times
- `[NEWSLETTER_FORM_URL]`: the form address from an email service like Mailchimp or Kit

You'll also want a **privacy policy** and **terms** page before selling. The site takes customer names, addresses and emails, so UK law needs one.

## Limited drops

Each design sells a set number of pieces (default 100), then the site switches to **Sold out** automatically.

- **How it counts:** straight from Stripe. Paid orders count as sold. Someone partway through checkout holds their tee for 30 minutes, so the 100 can't be oversold.
- **What visitors see:** a "Limited to 100 pieces" badge. "Only X of 100 left" appears once 20 or fewer remain. At zero, the button becomes **Sold out** and points people to the email sign-up.
- **Settings in Vercel:** `DROP_LIMIT` (pieces), `DROP_START` (your launch date, so test orders don't count), and optionally `DROP_ENDS` to close the drop at a date and time, e.g. `2026-12-14T23:59:00Z`.
- **Launching the next drop:** change `DROP_ID` (e.g. `drop-02`) so the count restarts, update `DROP_START`, then swap the product details. Ask Claude to set up the new design.
- **Keep it honest:** once a drop sells out, don't reprint that design. The site promises each one is made once.

## Changing things later
- **Price or delivery cost:** change `PRICE_PENCE` / `SHIPPING_PENCE` in Vercel and the price on `index.html`.
- **Using Printify instead:** only `api/webhook.js` changes. The order goes to Printify's API instead of Printful's.
- **More designs:** each new tee needs its own page or a product grid, and its own Printful variant IDs. I can add this when you're ready.
