"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

const PREVIEW_LEN = 120;

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso || "";
  }
}

export default function BoardPage() {
  const [language, setLanguage] = useState("en");
  const [posts, setPosts] = useState([]);
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterError, setFilterError] = useState(null);
  const [likingId, setLikingId] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const lang = params.get("lang");
    if (lang === "ko" || lang === "id") setLanguage(lang);
  }, []);

  const fetchPosts = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("posts")
      .select("id, nickname, title, content, language, likes, created_at")
      .order("created_at", { ascending: false });
    if (!error) setPosts(data ?? []);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimNick = nickname.trim();
    const trimTitle = title.trim();
    const trimContent = content.trim();
    if (!trimNick || !trimTitle || !trimContent) return;

    setFilterError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimTitle, content: trimContent })
      });
      const data = await res.json();

      if (!data.allowed) {
        const reason = language === "ko" ? data.reason_ko : language === "id" ? (data.reason_id || data.reason_en) : data.reason_en;
        setFilterError(reason || (language === "ko" ? "게시할 수 없는 내용이에요." : language === "id" ? "Konten ini tidak dapat diposting." : "This content cannot be posted."));
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        setFilterError(language === "ko" ? "저장할 수 없어요." : language === "id" ? "Tidak bisa menyimpan." : "Could not save.");
        return;
      }

      const { error } = await supabase.from("posts").insert({
        nickname: trimNick,
        title: trimTitle,
        content: trimContent,
        language: language
      });

      if (error) {
        setFilterError(language === "ko" ? "저장에 실패했어요." : language === "id" ? "Gagal menyimpan postingan." : "Failed to save post.");
        return;
      }

      setNickname("");
      setTitle("");
      setContent("");
      await fetchPosts();
    } catch (err) {
      console.error(err);
      setFilterError(language === "ko" ? "오류가 났어요. 다시 시도해주세요." : language === "id" ? "Terjadi kesalahan. Silakan coba lagi." : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (post) => {
    const supabase = getSupabase();
    if (!supabase || likingId) return;
    setLikingId(post.id);
    try {
      await supabase
        .from("posts")
        .update({ likes: (post.likes ?? 0) + 1 })
        .eq("id", post.id);
      await fetchPosts();
    } catch (_) {}
    setLikingId(null);
  };

  return (
    <main className="min-h-screen bg-[#F9FAFB] px-4 py-6 text-[#0F172A]">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-[#64748B] transition hover:text-[#4F46E5]"
              aria-label={language === "ko" ? "메인으로" : language === "id" ? "Kembali ke beranda" : "Back to home"}
            >
              ←
            </Link>
            <h1 className="text-xl font-bold text-[#0F172A]">
              {language === "ko" ? "📋 유저 게시판" : language === "id" ? "📋 Forum Komunitas" : "📋 Community Board"}
            </h1>
          </div>
          <div className="inline-flex rounded-full border border-[#E5E7EB] bg-[#FFFFFF] p-1 text-[11px] shadow-sm">
            <button
              type="button"
              onClick={() => setLanguage("ko")}
              className={`rounded-full px-2.5 py-1 transition ${language === "ko" ? "bg-[#4F46E5] text-white" : "text-[#64748B] hover:bg-[#EEF2FF]"}`}
            >
              🇰🇷 한국어
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-2.5 py-1 transition ${language === "en" ? "bg-[#4F46E5] text-white" : "text-[#64748B] hover:bg-[#EEF2FF]"}`}
            >
              🇺🇸 English
            </button>
            <button
              type="button"
              onClick={() => setLanguage("id")}
              className={`rounded-full px-2.5 py-1 transition ${language === "id" ? "bg-[#4F46E5] text-white" : "text-[#64748B] hover:bg-[#EEF2FF]"}`}
            >
              🇮🇩 Indonesia
            </button>
          </div>
        </header>

        {/* 작성 폼 */}
        <section className="rounded-3xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <h2 className="mb-3 text-sm font-semibold text-[#0F172A]">
            {language === "ko" ? "글 쓰기" : language === "id" ? "Tulis Postingan" : "New Post"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={language === "ko" ? "닉네임" : language === "id" ? "Nama panggilan" : "Nickname"}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              maxLength={30}
            />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === "ko" ? "제목" : language === "id" ? "Judul" : "Title"}
              className="w-full rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              maxLength={200}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={language === "ko" ? "내용 (한국어 학습·문화 관련 이야기를 나눠주세요)" : language === "id" ? "Isi (bagikan tentang belajar Korea, budaya, dll.)" : "Content (share about Korean learning, culture, etc.)"}
              rows={4}
              className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
            />
            {filterError && (
              <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#DC2626]">
                {filterError}
              </p>
            )}
            {isSubmitting && (
              <p className="rounded-xl bg-[#FFFBEB] px-3 py-2 text-sm text-[#D97706]">
                🐥 {language === "ko" ? "오구오구가 검토 중이에요..." : language === "id" ? "OguOgu sedang memeriksa postingan Anda..." : "OguOgu is reviewing your post..."}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting || !nickname.trim() || !title.trim() || !content.trim()}
              className="w-full rounded-xl bg-[#4F46E5] py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.3)] transition disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] disabled:shadow-none hover:bg-[#4338CA]"
            >
              {language === "ko" ? "등록하기" : language === "id" ? "Posting" : "Post"}
            </button>
          </form>
        </section>

        {/* 게시물 목록 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            {language === "ko" ? "최신 글" : language === "id" ? "Postingan Terbaru" : "Latest Posts"}
          </h2>
          {posts.length === 0 ? (
            <p className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-8 text-center text-sm text-[#64748B]">
              {language === "ko" ? "아직 글이 없어요. 첫 글을 남겨보세요!" : language === "id" ? "Belum ada postingan. Jadilah yang pertama!" : "No posts yet. Be the first to post!"}
            </p>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => {
                const preview = post.content.length > PREVIEW_LEN ? post.content.slice(0, PREVIEW_LEN) + "…" : post.content;
                return (
                  <li
                    key={post.id}
                    className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium text-[#0F172A]">{post.nickname}</span>
                      <span className="text-[11px] text-[#64748B]">{formatDate(post.created_at)}</span>
                    </div>
                    <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-[#0F172A]">{post.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#64748B]">{preview}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLike(post)}
                        disabled={likingId === post.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-medium text-[#4F46E5] transition hover:bg-[#E0E7FF] disabled:opacity-60"
                      >
                        ♥ {post.likes ?? 0}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
