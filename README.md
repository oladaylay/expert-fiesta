# Chow Republic Ltd — Website

Marketing website for Chow Republic Ltd, a protein value-add distribution business.

## Structure

- `index.html` — page content (about, products, why-us, coverage, contact)
- `styles.css` — styling
- `script.js` — mobile nav toggle + contact form (opens a pre-filled email)
- `.github/workflows/deploy.yml` — auto-deploys the site to GitHub Pages on every push to `main`

## Local preview

No build step needed — just open `index.html` in a browser, or serve the folder:

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

Contact details (phone, email, Instagram) are live. Product line copy is written generically for a protein value-add distributor — update `index.html` under `#products` with your actual product names, cuts, and pack sizes when ready.
