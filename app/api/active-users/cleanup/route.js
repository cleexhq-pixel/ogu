import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env" }),
        { status: 500 }
      );
    }
    const supabase = createClient(url, key);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("active_users")
      .delete()
      .lt("last_seen", fiveMinAgo);
    if (error) {
      console.error("active_users cleanup error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: "Cleanup failed" }),
      { status: 500 }
    );
  }
}
