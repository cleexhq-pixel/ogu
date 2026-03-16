"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MISSIONS } from "@/app/data/missions";
import { pageview, trackStartMission } from "@/app/lib/gtag";

const CATEGORY_TABS = [
  { id: "all", category: null },
  { id: "daily", category: "daily" },
  { id: "work", category: "work" },
  { id: "drama", category: "drama" }
];

function getTodayLang() {
  if (typeof window === "undefined") return "en";
  try {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get("lang");
    if (lang === "ko" || lang === "id" || lang === "en") return lang;
  } catch {
    // ignore
  }
  return "en";
}

export default function MissionPage() {
  const router = useRouter();
  const [language, setLanguage] = useState("en");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lang = getTodayLang();
    setLanguage(lang);
    pageview(window.location.pathname + window.location.search);
  }, []);

  const labels = useMemo(
    () => ({
      header:
        language === "ko"
          ? "미션 선택"
          : language === "id"
          ? "Pilih Misi"
          : "Choose a Mission",
      back:
        language === "ko"
          ? "← 홈으로"
          : language === "id"
          ? "← Kembali ke Beranda"
          : "← Back Home",
      tabs: {
        all: language === "ko" ? "전체" : language === "id" ? "Semua" : "All",
        daily: language === "ko" ? "일상" : language === "id" ? "Harian" : "Daily",
        work: language === "ko" ? "직장" : language === "id" ? "Kerja" : "Work",
        drama: language === "ko" ? "드라마" : language === "id" ? "Drama" : "Drama"
      },
      level: {
        beginner: language === "ko" ? "왕초보" : language === "id" ? "Pemula" : "Beginner",
        elementary: language === "ko" ? "초급" : language === "id" ? "Dasar" : "Elementary",
        intermediate: language === "ko" ? "중급" : language === "id" ? "Menengah" : "Intermediate"
      },
      start:
        language === "ko"
          ? "미션 시작"
          : language === "id"
          ? "Mulai Misi"
          : "Start Mission",
      stepsLabel:
        language === "ko"
          ? "단계 미리보기"
          : language === "id"
          ? "Langkah singkat"
          : "Steps preview"
    }),
    [language]
  );

  const filteredMissions = useMemo(() => {
    if (categoryFilter === "all") return MISSIONS;
    return MISSIONS.filter((m) => m.category === categoryFilter);
  }, [categoryFilter]);

  const handleStartMission = (missionId) => {
    trackStartMission(missionId);
    const params = new URLSearchParams();
    params.set("mission", missionId);
    params.set("lang", language);
    router.push(`/chat?${params.toString()}`);
  };

  const handleBackHome = () => {
    const params = new URLSearchParams();
    params.set("lang", language);
    router.push("/" + (language && language !== "en" ? `?lang=${language}` : ""));
  };

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6 text-[#3D2010]">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* 헤더 */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBackHome}
            className="text-[13px] text-[#9A7060] transition hover:text-[#FF6B4A]"
          >
            {labels.back}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              🐥
            </span>
            <h1 className="text-lg font-bold">{labels.header}</h1>
          </div>
          <div className="inline-flex rounded-full border border-[#FFE0D0] bg-[#FFFFFF] p-1 text-[11px] font-medium shadow-sm">
            <button
              type="button"
              onClick={() => setLanguage("ko")}
              className={`rounded-full px-2.5 py-1 transition ${
                language === "ko" ? "bg-[#FF6B4A] text-white" : "text-[#FF6B4A] hover:bg-[#FFF0E8]"
              }`}
            >
              🇰🇷
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-2.5 py-1 transition ${
                language === "en" ? "bg-[#FF6B4A] text-white" : "text-[#FF6B4A] hover:bg-[#FFF0E8]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("id")}
              className={`rounded-full px-2.5 py-1 transition ${
                language === "id" ? "bg-[#FF6B4A] text-white" : "text-[#FF6B4A] hover:bg-[#FFF0E8]"
              }`}
            >
              ID
            </button>
          </div>
        </header>

        {/* 카테고리 탭 */}
        <nav className="flex gap-2 overflow-x-auto text-[12px]">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`rounded-full border px-3 py-1.5 transition ${
                categoryFilter === tab.id
                  ? "border-[#FF6B4A] bg-[#FF6B4A] text-white"
                  : "border-[#FFE0D0] bg-[#FFFFFF] text-[#3D2010] hover:border-[#FF6B4A]/60"
              }`}
            >
              {tab.id === "all"
                ? labels.tabs.all
                : tab.id === "daily"
                ? labels.tabs.daily
                : tab.id === "work"
                ? labels.tabs.work
                : labels.tabs.drama}
            </button>
          ))}
        </nav>

        {/* 미션 카드 그리드 */}
        <section className="grid gap-4 sm:grid-cols-2">
          {filteredMissions.map((mission) => {
            const title =
              language === "ko" ? mission.title.ko : language === "id" ? mission.title.id : mission.title.en;
            const steps = mission.steps[language] || mission.steps.en;
            const levelLabel = labels.level[mission.level] || mission.level;
            const categoryBadge =
              mission.category === "daily"
                ? labels.tabs.daily
                : mission.category === "work"
                ? labels.tabs.work
                : labels.tabs.drama;

            return (
              <article
                key={mission.id}
                className="flex flex-col justify-between rounded-3xl border border-[#FFE0D0] bg-[#FFFFFF] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[10px] font-semibold text-[#FF6B4A]">
                      {categoryBadge}
                    </span>
                    <span className="text-[11px] text-[#9A7060]">{levelLabel}</span>
                  </div>
                  <h2 className="text-sm font-semibold text-[#3D2010]">{title}</h2>
                  <div className="mt-1 space-y-1 rounded-2xl bg-[#FFF8F0] px-3 py-2">
                    <p className="text-[11px] font-medium text-[#9A7060]">{labels.stepsLabel}</p>
                    <p className="text-[11px] text-[#3D2010]">
                      {Array.isArray(steps) ? steps.join(" → ") : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartMission(mission.id)}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-[#FF6B4A] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(255,107,74,0.4)] transition hover:bg-[#ff5a33] active:scale-[0.98]"
                >
                  {labels.start}
                </button>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

