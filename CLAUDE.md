# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Next.js 14, App Router)
npm run build    # production build
npm run start    # run production build
npm run lint     # next lint
```

There is no test suite configured in this repo.

Required env vars (see `.env.local`, not committed): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_TTS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`.

## Product

Package name `kkobi`, deployed as **talk.kkobi.app**. It's a K-pop-fan-focused Korean speaking practice app bundling several distinct experiences under one Next.js app:

- **My 90 Seconds** (`app/my-90-seconds/*`) — simulates a fansign video call with an idol: prep 4 lines → speak them (STT) → 90-second timed call with idol audio responses → AI-generated review of the user's performance.
- **First Line** (`app/first-line/*`) — a separate onboarding/practice flow (`FirstLineFlow.js`).
- **Mission** (`app/mission/*`) — scenario-based chat missions (café ordering, self-intro, etc.) defined in `app/data/missions.js`, played out via `app/chat/*` against an idol persona.
- **Phrases**, **Report**, **Board**, **Redeem** — daily phrase practice, streak/report cards, a community board (Supabase-backed), and reward-code redemption.

## Architecture: where things live (important, non-obvious)

Next.js routing comes **only from the root `app/` directory**. There is also a `src/app/*` tree that duplicates several `my-90-seconds` pages/layouts — this is **dead/orphaned code**, not a second route source; Next.js never sees it because a root `app/` dir takes precedence. Don't "fix" things there and don't assume it's live.

`src/` (outside `src/app`) is very much alive, though: `src/data`, `src/lib`, `src/hooks`, `src/styles` hold shared modules that the live pages in root `app/` import via relative paths or the `@/src/...` alias. So a single feature (e.g. My 90 Seconds) is assembled from:
- routes/UI: `app/my-90-seconds/**`
- domain data: `src/data/idol-scripts.js`, `src/data/scenarios.js`
- domain logic: `src/lib/generateScript.js`, `src/lib/generateReview.js`, `src/lib/selectIdolResponse.js`, `src/lib/saveSimulationLog.js`, `src/lib/dday.js`
- hooks: `src/hooks/useSpeechRecognition.js`, `src/hooks/useTimer.js`
- styles: `src/styles/my90sec.css`

There are also **near-duplicate lib files at different roots** (e.g. `lib/freeLimit.js` vs `src/lib/freeLimit.js`; `app/api/generate-review/route.js` vs the dead `src/app/api/generate-review/route.js`). Always check the actual `import` path in the file you're editing rather than assuming which copy is used — `@/lib/*` and `@/app/lib/*` are different directories (root `lib/` vs `app/lib/`), both in active use.

Path alias: `@/*` maps to the repo root (`jsconfig.json`), so `@/lib/x` = `lib/x.js`, `@/app/lib/x` = `app/lib/x.js`, `@/src/data/x` = `src/data/x.js`.

## i18n

UI copy is not in a single i18n framework — it's split across plain JS string tables, keyed by language (`en`, `ko`, `id`, and sometimes `fr`/`pt`):
- `app/lib/i18n.js` — core helpers (`normalizeLang`, `isValidLang`, `OGU_LANG_KEY`, language resolution from URL/localStorage) plus re-exports of the string tables below.
- `app/lib/journey-ui-strings.js`, `app/lib/fl5-strings.js`, `app/lib/i18n-str-ko.js` — per-flow string tables.
- Individual pages (e.g. `app/my-90-seconds/prep/page.js`) also inline their own per-page `*_COPY` objects rather than pulling everything from the shared tables.

Language is persisted in `localStorage` under `ogu_lang` and threaded through via `?lang=` query params; `normalizeLang` is the standard entry point for coercing any raw value into a supported lang code.

## AI/voice pipeline

- **Chat/scenario responses & script/review generation**: Anthropic (`@anthropic-ai/sdk`) via `app/api/chat/route.js`, `app/api/chat/fansign/route.js`, `app/api/generate-script/route.js`, `app/api/generate-review/route.js`, `app/api/filter/route.js` (content filtering), `app/api/report/route.js`.
- **Speech-to-text**: OpenAI Whisper via `app/api/transcribe/route.js`. Handles iOS audio format quirks (mp4/aac) — see `src/hooks/useSpeechRecognition.js`.
- **Text-to-speech**: two paths coexist —
  - Pre-generated static audio for idol scripted lines, produced offline by `scripts/generate-audio.js` (Google TTS, Neural2 Korean voices) into `public/audio/{male,female}/{id}.mp3` (plus `public/audio/fillers/`). Regenerate with `GOOGLE_TTS_API_KEY=... node scripts/generate-audio.js` after editing `src/data/idol-scripts.js`.
  - Runtime TTS via `app/api/tts/route.js` for dynamically generated text.

## Supabase

Client creation is centralized in `lib/supabase.js` (`getSupabase()` — browser-only, memoized `createBrowserClient`) and `lib/auth-config.js` (OAuth/magic-link redirect URL resolution, must match Supabase Dashboard auth config). Several pages also instantiate their own client directly with `createClient` from `@supabase/supabase-js` (e.g. `app/page.js`, `app/api/usage/route.js`) rather than going through `lib/supabase.js` — be consistent with whichever pattern the file you're editing already uses.

Table schemas (run manually in Supabase SQL Editor, not migrated automatically) live in `supabase/*.sql`:
- `active_users.sql` — realtime presence for the live "N people practicing now" indicator (`hooks/useActiveSession.js`, 30s keepalive heartbeat, 5min stale cutoff).
- `posts.sql` — community board (`app/board/page.js`).
- `streaks.sql` — daily streak tracking.

## Free-tier gating

Daily session limits are enforced client-side via `localStorage`, keyed per-day per-user (guest vs authenticated), in `lib/freeLimit.js` (`DAILY_LIMIT = { guest: 1, member: 3 }`). Limits are bypassed entirely in `NODE_ENV === 'development'`. Functions prefixed `@deprecated` in that file are legacy guest-only helpers kept for an older KO-only page — prefer `getSessionsRemaining`/`hasReachedDailyLimit` for new code. `app/api/redeem/route.js` handles reward codes that presumably grant paid/unlimited status server-side.

## Analytics

`lib/analytics.ts` (generic `trackEvent`) and `app/lib/gtag.js` (GA4 pageview + named event helpers like `trackStartMission`, `trackSendVoice`, `trackReachDailyLimit`) are both used — check which one a given page already imports before adding new tracking calls. GA is wired globally in `app/layout.js` via `Analytics`/`GAPageView` components.

---

# Working agreement (READ THIS FIRST)

## Who you are working with

The repo owner is a solo non-engineer founder. They plan, write copy, and make product decisions; they do not read code fluently.

Therefore:
- Explain every change in plain language first, code second.
  Bad:  "Refactored useSpeechRecognition to normalize the MIME type."
  Good: "아이폰에서 녹음이 안 되던 문제를 고쳤습니다. 아이폰이 다른 형식으로 녹음하는데 서버가 그걸 못 알아듣고 있었습니다."
- Always report which files you changed, and one line on why, per file.
- Never say "as you know" or assume prior technical knowledge.
- If a task requires a decision the owner should make (product, copy, pricing, UX), stop and ask. Do not decide it silently.
- Korean is the working language for all explanations. Code, variable names, and commit messages stay in English.

## Git rules

- You MAY commit. Commit messages in English, imperative mood.
- You MUST NOT run `git push`. Ever. Only the owner pushes, manually.
- You MUST NOT run `git reset --hard`, `git rebase`, `git checkout .`, or anything that discards uncommitted work, without explicit approval.
- Do not delete files in bulk. Ask first, always.
- `before-claude-code` is the safety tag marking the state before AI-assisted development began. Never delete or move it.

## Scope discipline

- Change only what the task asks for. Do not opportunistically refactor, rename, reformat, or "clean up" adjacent code.
- If you notice something worth fixing outside the task, mention it in your summary as a suggestion. Do not act on it.
- Prefer the smallest diff that solves the problem.

---

# Do not touch without explicit approval

These areas are load-bearing. Breaking them is silent — the UI still looks fine while real users lose access, lose money, or lose data. If a task appears to require changing any of these, STOP and ask first.

| Area | Files | Why it's dangerous |
|---|---|---|
| Paid access check | `kkobi_pass_tier` logic, `app/api/redeem/route.js` | A paying user silently loses access. Refunds and trust damage. |
| Free-tier gating | `lib/freeLimit.js` (note: `src/lib/freeLimit.js` also exists — check imports) | Either everyone gets unlimited free use, or paying users get blocked. |
| iOS speech-to-text | `src/hooks/useSpeechRecognition.js`, `app/api/transcribe/route.js` | iOS audio format handling (mp4/aac) is fragile and was hard-won. Cannot be verified without a physical iPhone. |
| UTM capture | `hooks/useUtmCapture.js` | Marketing attribution breaks silently; the damage is only visible weeks later in GA4. |
| GA4 event names | `lib/analytics.ts`, `app/lib/gtag.js` | Renaming an event severs it from all historical data. Event names are effectively permanent. |
| Idol script data | `src/data/idol-scripts.js` | Editing a line does NOT update its audio. Pre-generated MP3s live in `public/audio/{male,female}/{id}.mp3`. After any edit you MUST tell the owner to run `GOOGLE_TTS_API_KEY=... node scripts/generate-audio.js`. Forgetting this ships silent lines — the UI looks fine and no audio plays. |
| Dead duplicate tree | `src/app/*` | It is orphaned, but deleting it is a large uncheckable change. Leave it alone until there is a test/preview setup. Do not "clean it up." |

GA4 property is `G-S1MBTN4PQ8`, shared by both `my90sec.app` (landing) and `talk.kkobi.app` (app) under one stream. Do not create a second property or stream. Host-name filtering is how landing vs app data is separated.

Rule of thumb: if a change could affect **money, access, or measurement**, it needs approval regardless of how small the diff looks.

---

# Korean generation principles

The Korean the product produces is the product. If it reads like AI wrote it, the product has failed — fans notice immediately.

## Hard rules

- **Spoken Korean only (구어체), never written/formal Korean (문어체).** Target register: how a Korean idol actually talks to a fan on a video call — warm, casual, slightly hurried, 반말/존댓말 mixed the way real people mix them.
- **Style reference is `src/data/idol-scripts.js`.** Before generating any new Korean line, read existing lines in that file and match their rhythm, length, and vocabulary. Treat them as few-shot examples. Do not invent a new register.
- Lines must be **speakable in one breath**. If a line cannot be said comfortably in 3–5 seconds, it is too long.

## Banned patterns (these are the AI tells)

- 문어체 종결: `~하였습니다`, `~인 것 같습니다`, `~라고 할 수 있습니다`
- Textbook phrasing: `저는 ~을 좋아합니다`, `당신은 ~하십니까`
- Over-explained politeness: stacking `정말 너무 진짜` or excessive `~시`
- Translated-English rhythm: `그것은 매우 흥미로운 질문이네요`
- Any sentence that sounds like a language-learning textbook rather than a person

## Reference standard

구어 말뭉치 기준 (국립국어원 spoken-corpus register) — meaning: prefer the forms that appear in real recorded speech, not in written text. When in doubt, ask: "would someone actually say this out loud, or only write it?"

## Idol names and identity

- Never use real idol names, real group names, or real member identities.
- Personas are generic (male/female idol). Keep it that way.

---

# i18n rules

Supported languages: **en (default) / ko / id / pt / fr**

- **Every new user-facing string must ship in all 5 languages.** No English fallback, no TODO placeholders.
- Some existing string tables only contain `en, ko, id`. When you touch such a table, fill in `pt` and `fr` for the keys you touch. Do not backfill the whole file unless asked.
- Translations must read naturally in each language. Do not translate word-for-word from English.
- **Korean study content stays Korean regardless of UI language** — the idol's lines are the thing being learned. Only the surrounding UI translates.
- Romanized pronunciation is always shown, in every language.
- After any i18n work, output a checklist: which keys, which languages, which files.

Language resolution: `normalizeLang` in `app/lib/i18n.js` is the single entry point. Persisted in localStorage as `ogu_lang`, threaded via `?lang=`.

---

# Copy tone

The product's voice is **"we," not "you."** It sells solidarity, not self-improvement. Written by fans who have stood in that line themselves.

North star: *"We built it so the next fan doesn't have to walk away wishing."*

## Never write

- `Master`, `Perfect`, `Fluent`, `Improve your Korean` — language-app tone
- `AI coach`, `AI analyzing`, `Powered by AI` — the product is preparation for 90 seconds, not a technology demo
- `Sign up now`, `Get the app`, `Limited time offer` — ad tone
- `Don't be that fan`, `You wasted your 90 seconds` — shame
- Money math in the paywall ("50 albums = $500") — emotional framing only
- The brand name (`Kkobi` / `my90sec`) in the first line — the promise comes before the brand
- Emoji spam (an occasional 💜 is the ceiling)

## Instead

- `We've all stood there` / `You're not alone` / `Made by fans`
- Paywall: `Stay with us for 7 days. We'll be here every time you want to try again.` — not `Unlimited practice — $9.99`

If you are writing user-facing copy and unsure, draft it and ask before committing. Copy is a product decision, not an implementation detail.

---

# Verification

자동 테스트 스위트는 아직 없다. 하지만 preview 배포는 구축되어 있다. main이 아닌 브랜치에 push하면 Vercel이 preview URL을 자동으로 만든다. 검증은 diff를 읽는 것이 아니라 preview URL을 휴대폰에서 직접 확인하는 방식으로 이루어진다. 구체적인 절차는 아래 Pre-deploy checklist 섹션을 따른다.

모든 변경 후에는 반드시 한국어로, 오너가 무엇을 클릭하고 무엇을 보아야 하는지 화면과 예상 결과를 구체적으로 알려야 한다. 브라우저에서 데스크톱으로 검증할 수 없는 것은 명확히 표시해야 한다. 되돌리기 쉬운 변경을 선호한다.

---

# Pre-deploy checklist

## 원칙

모든 변경은 preview 브랜치를 거쳐서 production으로 간다. 오너는 diff를 읽지 못하므로 이 체크리스트가 실질적인 검증 수단이다.

## 작업 순서

1. main에서 새 브랜치를 딴다 (`git checkout -b 작업이름`).
2. Claude Code가 작업하고 커밋한다.
3. `git push -u origin 작업이름` 으로 올리면 Vercel이 preview URL을 만든다.
4. 그 URL을 반드시 휴대폰으로 열어서 아래 A 항목을 확인한다.
5. 통과하면 `git checkout main`, `git merge 작업이름`, `git push` 순으로 production에 반영한다.
6. 하나라도 실패하면 merge하지 않고 브랜치를 버리고 다시 한다. main은 그대로 유지된다.

## A. 항상 확인 (휴대폰에서 2분)

1. 첫 화면이 로드된다.
2. 언어를 바꾸면 UI 텍스트가 바뀐다.
3. 시나리오를 하나 시작하면 아이돌 음성이 재생된다.
4. 마이크 권한 요청이 뜬다.

## B. 건드린 영역에 따라 추가 확인

- **`src/data/idol-scripts.js`를 건드렸으면**: 새 대사의 음성이 실제로 재생되는지 확인한다. 재생되지 않으면 MP3가 재생성되지 않은 것이므로 `GOOGLE_TTS_API_KEY` 환경변수와 함께 `node scripts/generate-audio.js` 를 실행해야 한다.
- **UI 문자열을 건드렸으면**: en, ko, id, pt, fr 5개 언어가 모두 렌더링되는지, 영어 fallback이나 누락된 키가 없는지 확인한다.
- **`lib/freeLimit.js`를 건드렸으면**: 시크릿 창에서 일일 제한을 소진시켜 정확한 횟수에서 페이월이 뜨는지 확인한다.

## B-2. preview에서 절대 테스트하면 안 되는 것

이것들은 preview에서 실행하면 실제 데이터가 오염된다.

1. **redeem 코드** (`app/api/redeem/route.js`). preview에서 코드를 사용하면 그 코드가 소진된다. 코드를 눈으로만 검토하고, 배포 후 production에서 조심스럽게 확인한다.
2. **GA4 이벤트** (`lib/analytics.ts`, `app/lib/gtag.js`). preview 이벤트가 실제 통계에 섞인다. 코드를 눈으로만 검토하고, 배포 후 GA4 실시간 보고서에서 확인한다.

이 둘 중 하나를 건드리는 변경이면, 검증되지 않은 배포임을 요약에 명시적으로 알려야 한다.

## C. 데스크톱에서 검증 불가 — 배포 후 휴대폰으로 재확인

- iOS 음성 인식 (`src/hooks/useSpeechRecognition.js`), Safari/iOS 오디오 포맷 처리.
- 인앱 브라우저 (`lib/inAppBrowser.js`), 트위터나 인스타그램에서 링크를 열었을 때.

이 영역을 건드리면 항상 알려야 한다.

## Claude Code가 모든 작업 후 반드시 출력할 것

1. 어떤 파일을 바꿨는지와 각각 왜 바꿨는지 한 줄씩.
2. 이 체크리스트의 어느 항목이 해당되는지 (A만인지, A와 B의 어느 행인지).
3. B-2나 C에 해당해서 배포 전에 검증할 수 없는 것이 있는지.
4. 한국어로 쉽게, 무엇을 클릭하고 무엇이 보여야 하는지.
