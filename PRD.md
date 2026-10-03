# MFH Hair — Product Requirements Document

**Status:** MVP deployed; production integration setup completed; end-to-end order verification pending
**Product:** MFH Hair shop website  
**Owner:** MFH Hair (business details to confirm)  
**Last updated:** 2026-10-03

## 1. Product idea

MFH Hair is an online storefront for ponytails, wigs, and hair extensions. Customers can browse products, add items to a cart, check out, and later sign back in to see their saved order history. A successful order is saved in the database and triggers a clear email confirmation.

The project should feel like a real, polished small-business shop while demonstrating the separate integrations required by HNG Lesson 2.

## 2. Goals

- Make it easy for a customer to understand the products and place an order.
- Support Google sign-in and sign-out.
- Save customer orders in Supabase so they remain available after logout and returning later.
- Send a nicely formatted confirmation email after an order has been saved successfully.
- Deliver a responsive, trustworthy storefront with a clear path from browsing to checkout.
- Keep the code and setup approachable for a beginner, with secrets handled safely.

## 3. Out of scope for the first version

- Live payment processing. Payments are optional for the assignment; checkout will record an order without charging a card.
- Inventory management, discount codes, shipping integrations, reviews, and admin dashboards.
- Multiple currencies or complex tax/shipping calculations.

## 4. Intended users and main journey

**Customer:** A person shopping for a wig, ponytail, or extension.

1. Browse the shop and product details.
2. Add a product to the cart and adjust quantities.
3. Sign in with Google when proceeding to checkout.
4. Review the order and provide the required contact/shipping details.
5. Place the order and see a success confirmation.
6. Receive a confirmation email.
7. Open the site later, sign in again, and view the order in order history.
8. Sign out.

## 5. MVP requirements

### Storefront and products

- A clear MFH Hair landing/shop page with product cards and a useful empty/loading state.
- Product details include name, image, description, category, and price.
- Categories cover ponytails, wigs, and extensions.
- Product content and prices are sample content until MFH Hair confirms the real catalog. The proposed samples use competitor price comparisons, not supplier quotes.
- Mobile and desktop layouts are usable and visually consistent.

### Cart and checkout

- Add products to cart, change quantity, remove items, and see a subtotal.
- Keep the cart available while navigating the site. Cross-device cart sync is not required in the MVP.
- Checkout requires a signed-in customer and captures the customer’s name, email, and delivery address/contact details needed by the business.
- Validate required fields and show clear errors.
- Show an order confirmation page only after the order has been stored successfully.
- Prevent accidental duplicate submissions where practical.

### Authentication

- Google sign-in through Supabase Auth using Google OAuth configured in Google Cloud Console.
- A signed-in customer can sign out.
- Authentication state survives closing and reopening the browser according to Supabase’s session behavior.
- The site explains how to sign in if a customer opens order history while signed out.

### Orders and persistence

- Store orders and their line items in Supabase.
- Each order belongs to the authenticated customer and includes item name/price/quantity snapshots, totals, delivery details, status, and creation time.
- Customers can see only their own orders and order details.
- Row Level Security (RLS) protects customer data; do not rely only on hiding UI elements.
- Order history remains after logout and a later sign-in.

### Confirmation email

- After the order is successfully saved, send a formatted confirmation email through Mailgun.
- Include the order reference, purchased items, quantities, total, and next-step/contact information.
- Keep Mailgun credentials on the server in environment variables; never expose them in browser code.
- An email failure must not silently pretend that the order was not saved. Show a clear order success state and record/log email delivery failure for debugging.

## 6. Quality requirements

- Responsive and accessible basics: semantic controls, labels, keyboard operation, readable contrast, and useful focus states.
- Clear loading, success, and error states for sign-in, checkout, and order history.
- Never commit secrets, OAuth client secrets, or service-role keys.
- Validate data on the server before saving orders or sending email.
- Use RLS and server-side checks so a customer cannot create an order for another user or read another customer’s order.

## 7. Proposed stack

- **Next.js (App Router) + TypeScript** for the storefront and server-side checkout/email endpoint.
- **Custom responsive CSS** for the storefront styling.
- **Supabase** for Postgres database, authentication, and Google OAuth integration.
- **Mailgun** for transactional confirmation email, called only from server-side code.
- **Vercel** as the initial deployment target.

This stack keeps the required integrations in one beginner-friendly application while still teaching the separate services. Confirm the installed project structure before implementation begins.

## 8. Data model (initial proposal)

- `products`: id, name, description, category, image URL, price, active flag.
- `orders`: id, customer user id, customer name/email, delivery details, status, subtotal/total, created timestamp.
- `order_items`: id, order id, product id (nullable if a product is later removed), product name/price snapshot, quantity, line total.

Use integer minor units (for example, kobo) for prices rather than floating-point arithmetic. Final currency and actual prices must be confirmed with the business before launch.

## 9. Success criteria / acceptance checklist

- [ ] A visitor can browse products and use the cart.
- [ ] Checkout asks a signed-out visitor to authenticate with Google.
- [ ] A signed-in customer can place an order and see a success page.
- [ ] The order and its items are persisted in Supabase.
- [ ] The customer receives a well-formatted Mailgun confirmation email after a successful order.
- [ ] The customer can sign out, close/reopen the site, sign in again, and still see the order.
- [ ] One customer cannot read another customer’s orders.
- [ ] The deployed site works with production callback URLs and environment variables.
- [ ] No credentials or secrets are present in Git history or client-side bundles.

## 10. Delivery phases

1. Confirm business identity, brand direction, product catalog, currency, contact and delivery details.
2. Build and refine the storefront with realistic sample product content.
3. Create Supabase project, configure Google OAuth, and implement sign-in/sign-out.
4. Create database schema and RLS policies; persist and list orders.
5. Build cart and checkout, with server-side validation.
6. Add Mailgun confirmation email and verify a real received message.
7. Deploy, configure production OAuth redirect URLs and environment variables, then complete the full sign-in/order/logout/re-entry journey.

## 11. External setup owned by the project owner

The project owner must create/configure the Supabase, Google Cloud, and Mailgun accounts and supply their own project values. Keep actual secrets in local environment files (ignored by Git) and the deployment provider’s secret settings. Use placeholders in documentation and never paste secrets into source files.

## 12. Open decisions

- MFH Hair logo, preferred colors, and brand tone.
- Actual product names, photos, descriptions, prices, and availability.
- Currency, accepted delivery areas, delivery fees, and delivery/contact instructions.
- Business contact details to show in the order email and storefront.
- Whether to add test-mode payments after the required integrations work.

## 13. Initial sample catalog

The initial catalog and Supabase seed data are stored in `app/page.jsx` and `supabase/schema.sql`. Price references checked on 2026-10-02 include synthetic drawstring ponytails around ₦6,800–₦12,000 on [Jumia](https://www.jumia.com.ng/slp/curly-hair-extension-ponytale), a human-hair kinky-straight ponytail from ₦123,500 at [Blvck Hair](https://www.blvckhairng.com/collections/ponytails), and a bone-straight wig at ₦155,000 at [Pleroma](https://www.pleromastores.com/). Confirm actual inventory, materials, lengths, and final prices with MFH Hair before real sales.

## 14. Implementation status

- Responsive shop page, brand assets, filters, and cart: deployed.
- Checkout saves orders through the authenticated Supabase API only; browser-local pretend orders have been removed.
- Supabase schema and RLS, Google OAuth code flow, customer order history, and Mailgun email endpoint: implemented and production variables configured; verify with an end-to-end order and received email.
- Vercel production deployment: https://mfh-hair-shop.vercel.app/.
