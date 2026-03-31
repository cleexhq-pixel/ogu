import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next") || "/";
  const origin = requestUrl.origin;
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  const successUrl = new URL(safeNext, origin);
  successUrl.searchParams.set("oauth_complete", "1");
  const redirectResponse = NextResponse.redirect(successUrl.toString());

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          redirectResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(origin);
  }

  return redirectResponse;
}
