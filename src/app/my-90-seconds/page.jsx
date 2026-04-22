"use client";

import { useState, useEffect } from "react";
import scenarios from "@/data/scenarios";
import { checkFreeLimit, markOneUsed, getRemainingCount } from "@/lib/freeLimit";

export default function ScenarioSelectPage() {
  const [selected, setSelected] = useState(null);
  const [limitStatus, setLimitStatus] = useState(null);

  useEffect(() => {
    const status = checkFreeLimit();
    setLimitStatus(status);
  }, []);

  function handleStart() {
    if (!selected) return;

    const status = checkFreeLimit();
    if (!status.canPlay) return;

    // 사용 횟수 차감
    markOneUsed();

    window.location.href = `/my-90-seconds/prep?scenario=${selected}`;
  }

  const selectedScenario = scenarios.find((s) => s.id === selected);
  const remaining = getRemainingCount();

  return (
    <div style={{ padding: "44px 22px 32px", position: "relative", minHeight: "100vh" }}>

      {/* Spotlight */}
      <div className="m-spotlight" style={{ top: -60, right: -80 }} />
      <div className="m-spotlight" style={{
        bottom: -80, left: -60,
        background: "radial-gradient(circle, rgba(255,138,169,0.08) 0%, transparent 70%)",
      }} />

      {/* 상단 eyebrow */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 16, height: 1.5, background: "var(--m-secondary)", opacity: 0.6 }} />
          <span className="m-eyebrow">My 90 Seconds</span>
        </div>

        {/* 타이틀 */}
        <h1 style={{
          fontFamily: "var(--m-font-display)",
          fontSize: 28, fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--m-text-primary)",
          lineHeight: 1.15, marginBottom: 6,
        }}>
          어떤 순간을<br />
          <span style={{
            background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            연습할까요?
          </span>
        </h1>
        <p style={{ fontSize: 13, color: "var(--m-text-secondary)", marginBottom: 28, lineHeight: 1.5 }}>
          하나를 선택하면 AI가<br />맞춤 스크립트를 만들어드려요
        </p>
      </div>

      {/* 시나리오 그리드 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 8, marginBottom: 20,
        position: "relative", zIndex: 1,
      }}>
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            style={{
              background: selected === s.id ? "#221e23" : "var(--m-surface-card)",
              borderRadius: 16, padding: "14px 12px",
              border: "none", cursor: "pointer",
              textAlign: "left", position: "relative",
              overflow: "hidden", transition: "background 0.15s",
            }}
          >
            {selected === s.id && (
              <div style={{
                position: "absolute", left: 0, top: 12, bottom: 12,
                width: 2, borderRadius: "0 2px 2px 0",
                background: "var(--m-secondary)",
              }} />
            )}
            <span style={{ fontSize: 20, marginBottom: 8, display: "block" }}>{s.emoji}</span>
            <p style={{
              fontFamily: "var(--m-font-display)",
              fontSize: 12, fontWeight: 700,
              color: "var(--m-text-primary)", marginBottom: 2,
            }}>
              {s.titleKo}
            </p>
            <p style={{
              fontSize: 10,
              color: selected === s.id ? "var(--m-text-secondary)" : "var(--m-text-dim)",
            }}>
              {s.titleEn}
            </p>
          </button>
        ))}
      </div>

      {/* 선택된 시나리오 설명 */}
      {selectedScenario && (
        <div style={{
          background: "var(--m-surface-card)",
          borderRadius: 14, padding: "12px 16px",
          marginBottom: 16, position: "relative", zIndex: 1,
          borderLeft: "2px solid var(--m-primary)",
        }}>
          <p style={{ fontSize: 11, color: "var(--m-text-secondary)", lineHeight: 1.5 }}>
            {selectedScenario.emoji} {selectedScenario.descKo}
          </p>
        </div>
      )}

      {/* 남은 횟수 표시 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, marginBottom: 12,
        position: "relative", zIndex: 1,
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: i < remaining
              ? "linear-gradient(135deg, #FF8AA9, #FF719B)"
              : "var(--m-surface-bright)",
            transition: "background 0.3s",
          }} />
        ))}
        <span style={{ fontSize: 11, color: "var(--m-text-dim)", marginLeft: 4 }}>
          오늘 {remaining}회 남음
        </span>
      </div>

      {/* CTA */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {limitStatus?.canPlay === false ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              background: "var(--m-surface-card)",
              borderRadius: 14, padding: "16px",
              marginBottom: 12,
            }}>
              <p style={{
                fontFamily: "var(--m-font-display)",
                fontSize: 14, fontWeight: 700,
                color: "var(--m-text-primary)", marginBottom: 4,
              }}>
                오늘 연습을 다 했어요!
              </p>
              <p style={{ fontSize: 12, color: "var(--m-text-secondary)" }}>
                내일 다시 3회 충전돼요 🌙
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="m-btn-primary"
            style={{ opacity: selected ? 1 : 0.4 }}
            disabled={!selected}
          >
            {selected
              ? `${selectedScenario?.titleKo} 연습 시작하기 →`
              : "시나리오를 선택해주세요"}
          </button>
        )}

        <p style={{
          textAlign: "center", fontSize: 11,
          color: "var(--m-text-dim)", marginTop: 12,
        }}>
          무료 · 하루 3회 · 계정 불필요
        </p>
      </div>
    </div>
  );
}
