import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { mission: 0, conversation: 0, total: 0 },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const date = searchParams.get("date") || getTodayISO();

    if (!userId) {
      return NextResponse.json(
        { mission: 0, conversation: 0, total: 0 },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("usage_counter")
      .select("mission_count, conversation_count")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { mission: 0, conversation: 0, total: 0 },
        { status: 200 }
      );
    }

    const mission = data.mission_count ?? 0;
    const conversation = data.conversation_count ?? 0;
    const total = mission + conversation;

    return NextResponse.json(
      { mission, conversation, total },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { mission: 0, conversation: 0, total: 0 },
      { status: 200 }
    );
  }
}

export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { allowed: true, total: 0 },
        { status: 200 }
      );
    }

    const body = await request.json();
    const userId = body?.userId;
    const type = body?.type;
    const today = getTodayISO();

    if (!userId || !["mission", "conversation"].includes(type)) {
      return NextResponse.json(
        { allowed: true, total: 0 },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("usage_counter")
      .select("id, mission_count, conversation_count")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    let mission = data?.mission_count ?? 0;
    let conversation = data?.conversation_count ?? 0;

    if (type === "mission") mission += 1;
    if (type === "conversation") conversation += 1;

    const total = mission + conversation;

    if (!data) {
      await supabase.from("usage_counter").insert({
        user_id: userId,
        date: today,
        mission_count: mission,
        conversation_count: conversation
      });
    } else {
      await supabase
        .from("usage_counter")
        .update({
          mission_count: mission,
          conversation_count: conversation
        })
        .eq("id", data.id);
    }

    const allowed = total <= 5;

    return NextResponse.json(
      { allowed, total, mission, conversation },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { allowed: true, total: 0 },
      { status: 200 }
    );
  }
}

