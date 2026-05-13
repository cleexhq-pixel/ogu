import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { normalizeLang } from '@/app/lib/i18n';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const scenarioContext = {
  compliment: 'expressing love and appreciation to their bias',
  birthday: 'celebrating idol birthday',
  game: 'playing a fun game with idol',
  request: 'asking idol for a special action',
  ask: 'asking a meaningful question',
  question: 'asking a meaningful question',
  confession: 'confessing love and gratitude',
};

function parseConversationHistory(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parsePhaseLog(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** User utterances only; placeholder failures still count as attempts */
function countUserTurns(hist) {
  if (!Array.isArray(hist)) return 0;
  return hist.filter((m) => m.role === 'user').length;
}

function shouldUseSparseFallback(hist) {
  return !Array.isArray(hist) || hist.length === 0 || countUserTurns(hist) <= 1;
}

function clampScore(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 3;
  return Math.min(5, Math.max(1, Math.round(x)));
}

function normalizeScores(scoresRaw) {
  const s = scoresRaw && typeof scoresRaw === 'object' ? scoresRaw : {};
  const communication = clampScore(s.communication ?? 3);
  const korean_attempts = clampScore(s.korean_attempts ?? 3);
  const conversation_flow = clampScore(s.conversation_flow ?? 3);
  const time_used = clampScore(s.time_used ?? 3);
  const totalRaw = s.total;
  const totalNum = Number(totalRaw);
  const total =
    Number.isFinite(totalNum) && totalRaw !== undefined && totalRaw !== null
      ? Math.round(Math.min(5, Math.max(1, totalNum)) * 10) / 10
      : Math.round(
          ((communication +
            korean_attempts +
            conversation_flow +
            time_used) /
            4) *
            10,
        ) / 10;
  return {
    communication,
    korean_attempts,
    conversation_flow,
    time_used,
    total,
  };
}

function sparseFallbackReview(lang) {
  const isKo = lang === 'ko';
  return {
    scores: normalizeScores({
      communication: 1,
      korean_attempts: 1,
      conversation_flow: 1,
      time_used: 1,
      total: 1,
    }),
    encouragement: isKo ? '다음엔 더 길게 대화해봐요' : 'Next time, try having a longer conversation.',
    best_moment: null,
    missed_moment: {
      korean: '마이크 버튼을 눌러 한국어로 말해보세요',
      translation: isKo
        ? '대화를 시작하려면 말하기 버튼을 눌러 보세요.'
        : 'Tap the mic button to start speaking.',
      romanization: '',
      tip: 'Tap to speak 버튼을 눌러 첫 한국어를 말해보세요',
    },
    share_quote: isKo ? '다음에 또 할 수 있어요!' : 'You can try again!',
    share_quote_translation: isKo ? '다음에 또 할 수 있어요!' : 'You can try again!',
    share_quote_romanization: '',
  };
}

/** Network / Claude failure — keep shape compatible with new schema */
function errorFallbackReview(lang) {
  const base = sparseFallbackReview(lang);
  return {
    ...base,
    scores: normalizeScores({
      communication: 3,
      korean_attempts: 3,
      conversation_flow: 3,
      time_used: 3,
      total: 3,
    }),
    encouragement:
      lang === 'ko'
        ? '리뷰를 불러오지 못했어요. 잠시 후 다시 시도해 보세요.'
        : 'We could not load your review. Please try again later.',
    best_moment: {
      you_said_korean: '오빠를 정말 좋아해요',
      you_said_translation: 'I really like you',
      you_said_romanization: 'Oppareul jeongmal joahaeyo',
      idol_replied_korean: '고마워요~ 너무 행복해요',
      idol_replied_translation: "Thank you~ I'm so happy",
      idol_replied_romanization: 'Gomawoyo~ neomu haengbokhaeyo',
      moment_type: 'core_message',
    },
  };
}

export async function POST(req) {
  let lang = normalizeLang('en');
  try {
    const body = await req.json().catch(() => ({}));
    const {
      scenario,
      voiceGender,
      positiveMoments,
      completedLines,
      totalLines,
      idolName: idolNameRaw,
      lang: langRaw,
      conversationHistory: conversationHistoryRaw,
      phaseLog: phaseLogRaw,
    } = body || {};

    lang = normalizeLang(typeof langRaw === 'string' ? langRaw : 'en');
    const conversationHistory = parseConversationHistory(conversationHistoryRaw);
    const phaseLog = parsePhaseLog(phaseLogRaw);

    const trimmedIdol =
      typeof idolNameRaw === 'string' ? idolNameRaw.trim() : '';

    const vgLower = String(voiceGender || '').toLowerCase();
    const displayIdolName =
      trimmedIdol.length > 0
        ? trimmedIdol
        : vgLower === 'male' || vgLower === 'm'
          ? 'JISUNG'
          : 'WONYOUNG';

    const scenarioKey =
      scenario && scenarioContext[scenario] ? scenario : 'compliment';
    const scenarioLine =
      scenarioContext[scenarioKey] || String(scenario || 'practice session');

    if (shouldUseSparseFallback(conversationHistory)) {
      return NextResponse.json({
        success: true,
        review: sparseFallbackReview(lang),
        sparse: true,
      });
    }

    const uiLangInstructions =
      `사용자 인터페이스 언어: ${lang}\n` +
      `encouragement, missed_moment.translation, missed_moment.tip 등 사용자에게 보이는 설명은 반드시 ${lang} 로 작성하세요.\n` +
      `(best_moment 필드의 한국어 대사 you_said_korean, idol_replied_korean 등은 실제 한국어로 유지)\n\n`;

    const prompt = `${uiLangInstructions}You are an expert coach for international K-pop fans practicing a fansign videocall (90 seconds).

## Session context
Scenario: ${scenarioLine}
Idol name: ${displayIdolName}
Prepared lines checkpoint (legacy UI): ${completedLines ?? '?'}/${totalLines ?? '?'}
Positive/emotional cues from app (moment_type hints): ${JSON.stringify(positiveMoments ?? [])}

Phase timing (elapsed seconds within the 90s call when each phase ended; keys may be missing):
${JSON.stringify(phaseLog)}

## Full conversation (chronological)
Each item: role "user"|"idol", text string, timestamp optional millis.
Analyze ONLY real content from this transcript for scoring and coaching.
${JSON.stringify(conversationHistory)}

## Tasks

### A) Score four dimensions — each MUST be integer 1 to 5

1. communication (USER Korean naturalness / clarity)
   - 5: speaks naturally in Korean
   - 4: Korean attempted and meaning comes across
   - 3: Korean attempted but unclear or fragmentary
   - 2: mostly English or very short Korean scraps
   - 1: almost no usable speech from user

2. korean_attempts (share of USER lines that contain Hangul; ignore idol lines)
   - 5: all user lines include Korean
   - 4: roughly 80%+ of user lines Korean
   - 3: roughly 50%+ Korean
   - 2: roughly 30%+ Korean
   - 1: English-heavy

3. conversation_flow (does USER answer after idol and keep the exchange going?)
   - 5: responds to idol prompts and adds their own lines
   - 4: responds to most prompts
   - 3: responds to some prompts
   - 2: frequent silence, fillers, or minimal replies
   - 1: almost no back-and-forth

4. time_used (count USER messages that are real attempts; treat entries like "(…)" and "(인식 실패)" as non-substantive unless they are the only data)
   - 5: 8+ substantive user turns
   - 4: 6–7 user turns
   - 3: 4–5 user turns
   - 2: 2–3 user turns
   - 1: 0–1 user turns

Then set scores.total = round the average of the four scores to 1 decimal (e.g. 4.25 → 4.3).

### B) best_moment
Pick the single best REAL user–idol pair from the transcript where the user did well in Korean. Use actual lines or close paraphrases from the transcript. If there is no viable success, set best_moment to null.

### C) missed_moment
One Korean line or habit to practice, or a gap they did not try. tip: concrete, practical, in UI language (${lang}). Never mention AI, apps, or chatbots.

### D) encouragement
One warm sentence in UI language (${lang}), aligned with scores.total:
- total >= 4.0: along the lines of "팬싸 준비 완료! 자신감 가져요"
- 3.0–3.9: "좋은 시작이에요. 한 번만 더 연습해봐요" tone
- 2.0–2.9: "괜찮아요, 누구나 처음엔 어려워요" tone
- below 2.0: "오늘은 워밍업이에요. 다음에 다시 도전!" tone

### E) share_quote
Short shareable Korean phrase; include romanization in share_quote_romanization.

Return ONLY valid JSON (no markdown) with this exact structure:

{
  "scores": {
    "communication": 1,
    "korean_attempts": 1,
    "conversation_flow": 1,
    "time_used": 1,
    "total": 1.0
  },
  "encouragement": "string in UI language",
  "best_moment": null,
  "missed_moment": {
    "korean": "...",
    "translation": "...",
    "romanization": "...",
    "tip": "..."
  },
  "share_quote": "...",
  "share_quote_translation": "...",
  "share_quote_romanization": "..."
}

If best_moment is non-null, use object:
{
  "you_said_korean": "...",
  "you_said_translation": "...",
  "you_said_romanization": "...",
  "idol_replied_korean": "...",
  "idol_replied_translation": "...",
  "idol_replied_romanization": "...",
  "moment_type": "core_message" | "first_korean" | "name_remembered"
}

Romanization: Revised Romanization (e.g. 안녕하세요 → Annyeonghaseyo). Korean dialogue: natural casual fan–idol speech.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const cleanText = text.replace(/```json|```/g, '').trim();
    const reviewData = JSON.parse(cleanText);

    const scores = normalizeScores(reviewData.scores);
    const out = {
      ...reviewData,
      scores,
    };

    if (out.best_moment === undefined) out.best_moment = null;

    return NextResponse.json({ success: true, review: out });
  } catch (error) {
    console.error('Review generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        review: errorFallbackReview(lang),
      },
      { status: 500 },
    );
  }
}
