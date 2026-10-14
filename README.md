# Chow Republic Ltd — Website

Marketing + e-commerce website for Chow Republic Ltd, a protein value-add distribution business serving both retail (households) and bulk/wholesale customers.

## Structure

- `index.html` — homepage (about, product teaser, why-us, coverage, contact)
- `shop.html` — product catalog with category filters and "Add to Cart"
- `checkout.html` — cart review, delivery details form, and Paystack payment
- `products.js` — **product data** (name, price, unit, category, description) — edit this to change what's for sale
- `config.js` — **Paystack public key** goes here
- `cart.js` — shared cart logic (localStorage-based, works across all pages)
- `common.js` — shared header behavior (mobile nav, footer year) on every page
- `shop.js` / `checkout.js` / `script.js` — page-specific behavior
- `styles.css` — all styling
- `.github/workflows/deploy.yml` — auto-deploys the site to GitHub Pages on every push to `main`

## Setting up real payments (required before going live)

The site currently ships with a **placeholder** Paystack key, so checkout is intentionally disabled (visitors see a clear "payments not yet configured" message instead of a broken button).

1. Create a free account at [paystack.com](https://paystack.com) and complete business verification.
2. Go to **Settings → API Keys & Webhooks** and copy your **Public Key** (test key starts with `pk_test_`, live key with `pk_live_`).
3. Open `config.js` and replace the placeholder:
   ```js
   const PAYSTACK_PUBLIC_KEY = "pk_test_...your real key...";
   ```
4. Test with a `pk_test_` key first using [Paystack's test cards](https://paystack.com/docs/payments/test-payments/), then swap in the `pk_live_` key once you're ready to accept real payments.

**Important:** this is a static site with no backend, so order fulfillment relies on Paystack's own transaction records and email receipts — there's no database of orders. Every purchase's customer name, phone, delivery address and item list is attached as **metadata** on the Paystack transaction, visible in your Paystack dashboard under that transaction. Check your dashboard (or enable Paystack email notifications) regularly to catch new orders. If order volume grows, consider adding a small backend or Paystack webhook to auto-email/log orders — ask if you want that built.

## Editing the product catalog

Edit the `PRODUCTS` array in `products.js` — each product needs `id`, `name`, `category`, `price` (₦, whole number), `unit`, `image` (emoji or swap for a real photo path), and `description`. Categories are derived automatically from whatever you use, so adding a new category is just a matter of tagging a product with it.

## Local preview

No build step needed — just serve the folder (opening `index.html` directly also works, but Paystack's script prefers `http://`):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Going live (GitHub Pages)

1. Merge this branch into `main`.
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source** → select **GitHub Actions**.
3. Push to `main` (or re-run the "Deploy static site to GitHub Pages" workflow) — the site will be published at
   `https://<your-github-username>.github.io/expert-fiesta/`.

## Getting Chow Republic onto Google Maps

Google Maps listings come from a **Google Business Profile**, not from web hosting. Since Chow Republic has no public storefront:

1. Go to [business.google.com](https://business.google.com) and sign in with the business's Google account.
2. Choose **"I deliver goods and services to my customers"** (service-area business) instead of a storefront address — this keeps your exact address private while still showing a service-area pin.
3. Enter the business name (Chow Republic Ltd), category (e.g. "Food Products Supplier" / "Distributor"), phone (`+234 907 905 1194`), and the site URL from the step above.
4. Verify via the method Google offers (usually phone or postcard).
5. Once verified, add the website link, hours, photos, and a short description matching the site content.

## Content notes

Contact details (phone, email, Instagram) are live. Product catalog (`products.js`) has real Chow Republic products and pricing from invoice history — update prices there as they change, and swap in real photos when ready.
