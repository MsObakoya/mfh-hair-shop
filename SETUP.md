# MFH Hair — account setup checklist

The app code is ready for your account settings. Keep all secret values in your own `.env.local` file and the hosting provider’s private environment settings. Never paste the Mailgun private API key or Google client secret into chat or commit them to Git.

## 1. Create Supabase project and database

1. Create a Supabase project and save its database password somewhere private.
2. In **Project Settings → API**, copy the Project URL and the publishable key (older projects may call this the `anon` key).
3. In **SQL Editor**, open a new query, paste the contents of `supabase/schema.sql`, and run it. This creates the product catalog, order tables, and customer-ownership Row Level Security policies.
4. Create `.env.local` in the project root from `.env.example`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the values from step 2.

## 2. Configure Google sign-in

1. In Google Cloud Console, create/select a project and configure the OAuth consent screen / Google Auth Platform. For the task, use the testing audience unless you specifically need public sign-in; add the test Google account(s).
2. Create an OAuth client ID of type **Web application**.
3. Add `http://localhost:3000` under **Authorized JavaScript origins**.
4. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and copy the displayed Supabase callback URL.
5. In Google Cloud, add that exact Supabase callback URL under **Authorized redirect URIs**, then paste the Google client ID and client secret into Supabase’s Google provider settings and save.
6. In Supabase **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL.

## 3. Configure Mailgun

1. Create a Mailgun account and add a sending domain. Complete the DNS verification steps Mailgun provides for that domain.
2. Copy the private API key and sending domain from the Mailgun dashboard.
3. Add these server-only values to `.env.local`:

   ```env
   MAILGUN_API_KEY=your-private-api-key
   MAILGUN_DOMAIN=your-verified-domain
   MAILGUN_FROM=MFH Hair <orders@your-verified-domain>
   ```

4. Mailgun accounts that have not been fully approved may only send to authorized recipient addresses. Add your own inbox as a test recipient if the dashboard asks you to do so.

## 4. Run locally

1. Use Node.js 22 or newer.
2. Run `npm install`, then `npm run dev`.
3. Visit `http://localhost:3000`, add an item, sign in with Google, and submit a test order to your own email/address.
4. Confirm the order appears on **My orders** after signing out and signing back in, and confirm the message is actually received.

## 5. Production setup

1. Deploy the repository to Vercel (or another Next.js host) and set the production environment variables from `.env.local` in that host’s private settings.
2. In Google Cloud, add the production site origin to **Authorized JavaScript origins**.
3. In Supabase **Authentication → URL Configuration**, set the production Site URL and add `https://YOUR-PRODUCTION-DOMAIN/auth/callback` to the redirect allow list.
4. Update the app’s post-login callback is handled on the same production domain. Keep the Supabase callback URI in Google Cloud exactly as Supabase displays it.
5. Place a real end-to-end test order on the production URL and verify sign-in, saved history after re-entry, and a received Mailgun message.

## Before accepting real orders

Confirm product availability, materials/grades, lengths, photos, final prices, shipping charges and areas, return policy, customer contact details, and delivery timing with MFH Hair. The current storefront uses clearly labeled illustrative products and sample prices.
