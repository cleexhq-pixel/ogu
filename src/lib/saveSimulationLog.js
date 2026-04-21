import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function saveSimulationLog({
  scenarioId,
  turnsCompleted,
  totalTimeUsed,
  linesDelivered,
  linesTotal,
  idolResponses,
  shared,
  retried,
}) {
  try {
    // 유저 ID: 로그인 유저는 auth.uid, 비로그인은 localStorage ID
    let userId = null;
    if (typeof window !== "undefined") {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || localStorage.getItem("ogu_user_id") || generateAnonymousId();
    }

    // 익명화된 대화 패턴만 저장 — 실제 발화 내용 저장 금지
    const conversationLog = {
      scenario: scenarioId,
      turns: turnsCompleted,
      completed: linesDelivered >= linesTotal,
      starred_count: Array.isArray(idolResponses) ? idolResponses.length : 0,
    };

    const { error } = await supabase.from("simulation_logs").insert({
      user_id: userId,
      scenario_id: scenarioId,
      turns_completed: turnsCompleted,
      total_time_used: totalTimeUsed,
      lines_delivered: linesDelivered,
      lines_total: linesTotal,
      conversation_log: conversationLog,
      idol_responses: idolResponses || [],
      shared,
      retried,
    });

    if (error) {
      console.error("saveSimulationLog error:", error);
    }
  } catch (err) {
    // 로깅 실패가 앱 동작을 막으면 안 됨
    console.error("saveSimulationLog failed silently:", err);
  }
}

// 비로그인 유저 익명 ID 생성 및 저장
function generateAnonymousId() {
  if (typeof window === "undefined") return null;
  const existing = localStorage.getItem("ogu_user_id");
  if (existing) return existing;
  const newId = "anon_" + Math.random().toString(36).slice(2, 11);
  localStorage.setItem("ogu_user_id", newId);
  return newId;
}
