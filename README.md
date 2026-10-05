# MFH Hair Shop

An HNG 15 Lesson 2 shop project for ponytails, wigs, and hair extensions. The storefront, responsive catalog, cart, checkout form, Supabase/Google auth code, order tables, and server-side Mailgun sender are now scaffolded.

## Project documents

- [Product requirements](PRD.md) — MVP scope, proposed stack, integration requirements, and delivery phases.
- [Agent instructions](AGENTS.md) — project context, beginner-friendly working conventions, and security expectations.
- [Setup checklist](SETUP.md) — the account setup steps only the project owner can complete.

## Current status

The storefront is deployed at [mfh-hair-shop.vercel.app](https://mfh-hair-shop.vercel.app/). Sign-in, checkout, and order history use the configured Supabase account; there is no browser-local order or checkout fallback. The shop catalog now has 12 sample products and uses product-listing photos linked from third-party retailers for the demonstration. These images are not owned by MFH Hair; replace them with owner or supplier-approved photos before commercial use. Product prices and specifications also need the owner's final confirmation before real sales.

## Stack

Next.js App Router, React, Supabase (Postgres and Auth), Mailgun, and Vercel. See the PRD before changing scope or stack.

## Local start

1. Install Node.js 22 or newer (the `.nvmrc` file specifies 22).
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add your own Supabase and Mailgun values (see [SETUP.md](SETUP.md)). Leave these values private.
4. Run `npm run dev` and open `http://localhost:3000`.

## Market-based price notes

The sample price points are informed by current Nigerian online listings: Jumia lists synthetic drawstring ponytails around ₦6,800–₦12,000; Blvck Hair lists a human-hair kinky-straight ponytail from ₦123,500; Pleroma lists a human-hair ponytail at ₦35,000 and a bone-straight wig at ₦155,000. These are comparisons, not MFH Hair supplier quotes or confirmed prices. See [Jumia ponytails](https://www.jumia.com.ng/slp/curly-hair-extension-ponytale), [Blvck Hair ponytails](https://www.blvckhairng.com/collections/ponytails), and [Pleroma](https://www.pleromastores.com/).

Keep `.env.local` private; it is excluded by `.gitignore`. Never put credentials in source code or commit them. For deployment, enter them in the hosting provider’s environment-variable settings.

## Catalog update

After deploying a catalog change, run [`supabase/catalog_update.sql`](supabase/catalog_update.sql) in Supabase Dashboard → SQL Editor. The checkout endpoint calculates prices from Supabase, so new product IDs must be present there before those products can be ordered. The catalog and all prices are still examples pending MFH Hair approval.
