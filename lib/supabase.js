import { createBrowserClient } from "@supabase/ssr";

let browserClient = null;

export const getSupabase = () => {
  if (typeof window === "undefined") return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
};

export const supabase = typeof window !== "undefined" ? getSupabase() : null;
