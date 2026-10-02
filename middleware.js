import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
  } catch (error) {
    // Keep the public shop available if an auth refresh fails; protected API routes
    // still validate the user independently before reading or writing order data.
    console.error("Supabase session refresh failed in middleware", error);
  }

  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
