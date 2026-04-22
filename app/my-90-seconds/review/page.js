"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import scenarios from "../../../src/data/scenarios";
import { generateReview } from "../../../src/lib/generateReview";
import { saveSimulationLog } from "../../../src/lib/saveSimulationLog";

export default function ReviewPage() {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario") || "compliment";
  const logParam = searchParams.get("log");

  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];

  const [log, setLog] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bestMoment, setBestMoment] = useState(null);

  useEffect(() => {
    if (!logParam) return;

    let parsed;
    try {
      parsed = JSON.parse(decodeURIComponent(logParam));
      setLog(parsed);
    } catch {
      parsed = { linesDelivered: 0, totalTurns: 0, starredTurns: [] };
      setLog(parsed);
    }

    async function load() {
      try {
        const result = await generateReview({
          scenarioId,
          linesDelivered: parsed.linesDelivered || 0,
          totalTurns: parsed.totalTurns || 0,
        });
        setReview(result);

        // Supabase 로그 저장
        await saveSimulationLog({
          scenarioId,
          turnsCompleted: parsed.totalTurns || 0,
          totalTimeUsed: 90,
          linesDelivered: parsed.linesDelivered || 0,
          linesTotal: 4,
          idolResponses: parsed.starredTurns || [],
          shared: false,
          retried: false,
        });
      } catch {
        setReview({
          tip: "더 짧고 간단하게 말해봐요!",
          example_before: "저는 오빠를 정말 많이 좋아해요",
          example_after: "오빠 진짜 좋아요~",
          encouragement: "You did amazing! Keep practicing!",
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [logParam]);

  function handleRetry() {
    window.location.href = `/my-90-seconds/prep?scenario=${scenarioId}`;
  }

  function handleShare() {
    const text = `🎤 나 방금 AI 아이돌이랑 팬싸 연습했어!\n${log?.linesDelivered || 0}/4 라인 전달 성공!\n\nKkobi로 90초 연습하기 → talk.kkobi.app`;
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      alert("클립보드에 복사됐어요!");
    }
  }

  // 점수 계산
  const score = log ? Math.round((log.linesDelivered / 4) * 100) : 0;
  const timeUsed = 90;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--m-font-display)", fontSize: 22, fontWeight: 800, color: "var(--m-text-primary)", marginBottom: 8 }}>
            결과 분석 중...
          </div>
          <div style={{ fontSize: 13, color: "var(--m-text-dim)" }}>AI 코치가 피드백을 작성하고 있어요</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "44px 22px 40px", position: "relative" }}>

      {/* Spotlight */}
      <div className="m-spotlight" style={{ top: -80, right: -60 }} />

      {/* 완료 배지 */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "rgba(0,227,253,0.1)", borderRadius: 9999,
        padding: "5px 12px", marginBottom: 16,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--m-secondary)" }} />
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--m-secondary)" }}>
          완료
        </span>
      </div>

      {/* 타이틀 */}
      <h1 style={{
        fontFamily: "var(--m-font-display)", fontSize: 26, fontWeight: 800,
        letterSpacing: "-0.02em", color: "var(--m-text-primary)",
        lineHeight: 1.2, marginBottom: 6,
      }}>
        90초를<br />
        <span style={{
          background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          잘 해냈어요!
        </span>
      </h1>
      {review?.encouragement && (
        <p style={{ fontSize: 13, color: "var(--m-text-secondary)", marginBottom: 24 }}>
          {review.encouragement}
        </p>
      )}

      {/* 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { num: `${log?.linesDelivered || 0}/4`, label: "전달한 라인" },
          { num: `${timeUsed}s`, label: "사용한 시간" },
          { num: `${score}%`, label: "전달률" },
          { num: `${log?.starredTurns?.length || 0}개`, label: "⭐ 좋았던 순간" },
        ].map((stat, i) => (
          <div key={i} className="m-card" style={{ padding: "14px 12px" }}>
            <div style={{
              fontFamily: "var(--m-font-display)", fontSize: 26, fontWeight: 800,
              background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: 3,
            }}>
              {stat.num}
            </div>
            <div style={{ fontSize: 10, color: "var(--m-text-dim)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* AI 팁 */}
      {review && (
        <div className="m-card m-card-featured" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--m-secondary)", marginBottom: 8 }}>
            💡 더 자연스럽게
          </p>
          <p style={{ fontSize: 13, color: "var(--m-text-primary)", fontWeight: 600, marginBottom: 10 }}>
            {review.tip}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: "var(--m-text-dim)", minWidth: 24 }}>전</span>
              <span style={{ fontSize: 12, color: "var(--m-text-secondary)",
                background: "var(--m-surface-low)", padding: "4px 10px", borderRadius: 8 }}>
                {review.example_before}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: "var(--m-secondary)", minWidth: 24 }}>후</span>
              <span style={{ fontSize: 12, color: "var(--m-text-primary)",
                background: "rgba(0,227,253,0.08)", padding: "4px 10px", borderRadius: 8 }}>
                {review.example_after}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 가장 좋았던 순간 선택 */}
      <div className="m-card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--m-text-dim)", marginBottom: 8 }}>
          이 연습에서 가장 좋았던 순간은?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["아이돌이 내 말을 알아들었을 때", "한국어가 자연스럽게 나왔을 때", "역질문에 대답했을 때"].map((m, i) => (
            <button key={i} onClick={() => setBestMoment(i)} style={{
              padding: "8px 12px", borderRadius: 10, textAlign: "left",
              background: bestMoment === i ? "rgba(255,138,169,0.15)" : "var(--m-surface-low)",
              border: bestMoment === i ? "1.5px solid rgba(255,138,169,0.4)" : "1.5px solid transparent",
              color: bestMoment === i ? "var(--m-primary)" : "var(--m-text-secondary)",
              fontSize: 12, fontFamily: "var(--m-font-body)", cursor: "pointer",
              transition: "all 0.15s",
            }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* CTA 버튼 */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleRetry} className="m-btn-primary" style={{ flex: 1 }}>
          다시 연습하기
        </button>
        <button onClick={handleShare} className="m-btn-secondary" style={{ flex: 1 }}>
          공유하기
        </button>
      </div>
    </div>
  );
}
