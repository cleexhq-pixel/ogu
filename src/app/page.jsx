"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRemainingCount } from "@/lib/freeLimit";

const SCENARIOS = [
  { emoji: "💝", ko: "칭찬", id: "compliment" },
  { emoji: "🎂", ko: "생일 축하", id: "birthday" },
  { emoji: "🎮", ko: "게임", id: "game" },
  { emoji: "🎤", ko: "멘트 요청", id: "request" },
  { emoji: "💬", ko: "질문", id: "question" },
  { emoji: "💗", ko: "사랑 고백", id: "confession" },
];

export default function HomePage() {
  const [remaining, setRemaining] = useState(3);

  useEffect(() => {
    setRemaining(getRemainingCount());
  }, []);

  return (
    <div style={{
      background: "#0E0E0F",
      minHeight: "100vh",
      maxWidth: 390,
      margin: "0 auto",
      fontFamily: "'Inter', sans-serif",
      color: "#F2F0F4",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Spotlight 배경 */}
      <div style={{
        position: "absolute",
        width: 320, height: 320,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(158,143,253,0.14) 0%, transparent 70%)",
        top: -80, right: -80,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        width: 240, height: 240,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,138,169,0.08) 0%, transparent 70%)",
        top: 200, left: -60,
        pointerEvents: "none",
      }} />

      {/* 상단 헤더 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 22px 0",
        position: "relative", zIndex: 1,
      }}>
        <span style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 16, fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#F2F0F4",
        }}>
          Kkobi
        </span>
        <Link href="/first-line" style={{
          fontSize: 11, color: "#5C5A62",
          textDecoration: "none",
          padding: "6px 12px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 9999,
        }}>
          한국어 학습
        </Link>
      </div>

      {/* 히어로 섹션 */}
      <div style={{
        padding: "48px 22px 0",
        position: "relative", zIndex: 1,
      }}>
        {/* 남은 횟수 */}
        <div style={{
          display: "inline-flex",
          alignItems: "center", gap: 6,
          background: "rgba(0,227,253,0.08)",
          borderRadius: 9999, padding: "5px 12px",
          marginBottom: 24,
        }}>
          <div style={{
            display: "flex", gap: 4,
          }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: i < remaining ? "#00E3FD" : "rgba(255,255,255,0.1)",
              }} />
            ))}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "#00E3FD",
          }}>
            오늘 {remaining}회 남음
          </span>
        </div>

        {/* 메인 카피 */}
        <h1 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 34, fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 16,
          color: "#F2F0F4",
        }}>
          그 90초,<br />
          <span style={{
            background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            제대로 써보세요
          </span>
        </h1>

        {/* 서브 카피 */}
        <p style={{
          fontSize: 15, color: "#9E9BA4",
          lineHeight: 1.65, marginBottom: 36,
          letterSpacing: "-0.01em",
        }}>
          팬싸인회 영상통화는 단 90초.<br />
          하고 싶은 말을 미리 연습하고<br />
          후회 없는 순간을 만들어요.
        </p>

        {/* 메인 CTA */}
        <Link href="/my-90-seconds" style={{
          display: "block",
          padding: "17px 0",
          borderRadius: 9999,
          background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
          color: "#fff",
          fontFamily: "'Manrope', sans-serif",
          fontSize: 15, fontWeight: 700,
          letterSpacing: "0.02em",
          textDecoration: "none",
          textAlign: "center",
          marginBottom: 12,
        }}>
          지금 연습 시작하기
        </Link>

        <p style={{
          textAlign: "center",
          fontSize: 11, color: "#5C5A62",
          marginBottom: 48,
        }}>
          무료 · 하루 3회 · 계정 불필요
        </p>
      </div>

      {/* 시나리오 카드 섹션 */}
      <div style={{
        padding: "0 22px",
        position: "relative", zIndex: 1,
        marginBottom: 40,
      }}>
        <p style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#5C5A62", marginBottom: 14,
        }}>
          어떤 순간을 연습할까요
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
        }}>
          {SCENARIOS.map((s) => (
            <Link key={s.id} href={`/my-90-seconds?scenario=${s.id}`} style={{
              background: "#1A191B",
              borderRadius: 14,
              padding: "14px 10px",
              textDecoration: "none",
              display: "block",
              textAlign: "center",
              transition: "background 0.15s",
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 11, fontWeight: 700,
                color: "#F2F0F4",
              }}>
                {s.ko}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 3가지 이유 섹션 */}
      <div style={{
        padding: "0 22px",
        position: "relative", zIndex: 1,
        marginBottom: 40,
      }}>
        <p style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#5C5A62", marginBottom: 14,
        }}>
          왜 연습해야 할까요
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            {
              title: "머리가 하얘질 수 있어요",
              desc: "준비 없이 들어가면 90초가 10초처럼 끝나요.",
            },
            {
              title: "아이돌은 대화를 기다려요",
              desc: "침묵이 길어지면 양쪽 모두 어색해져요.",
            },
            {
              title: "한 번뿐인 기회예요",
              desc: "연습한 사람과 안 한 사람의 차이는 분명해요.",
            },
          ].map((item, i) => (
            <div key={i} style={{
              background: "#1A191B",
              borderRadius: 14, padding: "16px",
              borderLeft: "2px solid rgba(255,138,169,0.4)",
            }}>
              <p style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 13, fontWeight: 700,
                color: "#F2F0F4", marginBottom: 4,
              }}>
                {item.title}
              </p>
              <p style={{
                fontSize: 12, color: "#9E9BA4",
                lineHeight: 1.6,
              }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 CTA */}
      <div style={{
        padding: "0 22px 48px",
        position: "relative", zIndex: 1,
      }}>
        <Link href="/my-90-seconds" style={{
          display: "block",
          padding: "17px 0",
          borderRadius: 9999,
          background: "linear-gradient(135deg, #FF8AA9, #FF719B)",
          color: "#fff",
          fontFamily: "'Manrope', sans-serif",
          fontSize: 15, fontWeight: 700,
          textDecoration: "none",
          textAlign: "center",
          marginBottom: 16,
        }}>
          지금 연습 시작하기
        </Link>

        {/* 기존 꼬비 학습 링크 */}
        <div style={{
          background: "#131314",
          borderRadius: 14, padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <p style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 12, fontWeight: 700,
              color: "#9E9BA4", marginBottom: 2,
            }}>
              한국어도 함께 배우고 싶다면
            </p>
            <p style={{ fontSize: 11, color: "#5C5A62" }}>
              꼬비 Day 1~30 학습 플로우
            </p>
          </div>
          <Link href="/first-line" style={{
            fontSize: 11, fontWeight: 600,
            color: "#9E9BA4",
            textDecoration: "none",
            padding: "6px 12px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 9999,
            whiteSpace: "nowrap",
          }}>
            이동하기
          </Link>
        </div>
      </div>

    </div>
  );
}
