# MFH Hair mobile app

This Expo / React Native app is the phone companion to the MFH Hair website. It uses the same Supabase Google account, product catalog, checkout, order history, and shared cart endpoints as the website at `https://mfh-hair-shop.vercel.app`.

## One-time setup

1. Install Node.js 22 LTS or newer, then run `npm install` from this folder.
2. Copy `.env.example` to `.env.local`. Fill in the **Project URL** and **anon/publishable key** from Supabase → Project Settings → API. Do not use a service-role key.
3. In Supabase Dashboard → SQL Editor, run the root project file `supabase/cart_sync.sql`. This creates the owner-protected shared cart table. Existing accounts and orders are unchanged.
4. In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add `mfhair://auth/callback` and save.
5. In Supabase Dashboard → Authentication → Providers → Google, confirm Google is enabled and uses the same OAuth client already configured for the website. Supabase remains the OAuth callback URL in Google Cloud Console.

Before a cloud APK build, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS project environment variables for the `preview` environment. They are public client values; never upload a service-role key. Expo local runs read them from `.env.local`.

The URL must be your actual Supabase project URL (`https://<project-ref>.supabase.co`), not the `example.supabase.co` fallback. The app now refuses Google sign-in when those values are missing. If the sign-in error displays `example.supabase.co`, the installed build did not receive the EAS preview variables (or was built before they were added); set them in EAS and build a fresh APK.

## Start on a phone

For quick local preview, start Expo with `npm start` and open the QR code with Expo Go. OAuth deep-link behavior must be tested with the installed development build (Expo Go uses a different redirect URL).

For an installable app icon, sign in to Expo Application Services and build a fresh Android APK after changing EAS values or native sign-in code:

```sh
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Download the APK from the build page and install it on the physical phone. The first cloud build prompts for Expo/Android signing setup if needed.

## Two-way cart demo

Use one Google account in both the production website and the installed mobile app. Add a product on the website and wait up to four seconds for the phone cart to refresh. Add a different product on the phone and wait up to four seconds for the website cart to refresh. The cart table is per Supabase user and protected by Row Level Security. Record one continuous video showing both directions on the physical phone as the assignment requires.

If cart requests report that sync is not configured, run `supabase/cart_sync.sql` in the same Supabase project used by the website. Do not put Supabase service-role or Mailgun keys in this app.
