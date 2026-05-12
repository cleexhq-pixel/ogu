import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { normalizeLang } from '@/app/lib/i18n';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FALLBACK_REVIEW = {
  best_moment: {
    you_said_korean: '오빠를 정말 좋아해요',
    you_said_translation: 'I really like you',
    you_said_romanization: 'Oppareul jeongmal joahaeyo',
    idol_replied_korean: '고마워요~ 너무 행복해요',
    idol_replied_translation: "Thank you~ I'm so happy",
    idol_replied_romanization: 'Gomawoyo~ neomu haengbokhaeyo',
    moment_type: 'core_message',
  },
  missed_moment: {
    korean: '다음에 또 만나요',
    translation: "Let's meet again next time",
    romanization: 'Daeume tto mannayo',
    tip: 'Practice with confidence — your Korean is already understandable.',
  },
  share_quote: '고마워요~ 너무 행복해요',
  share_quote_translation: "Thank you~ I'm so happy",
  share_quote_romanization: 'Gomawoyo~ neomu haengbokhaeyo',
};

const scenarioContext = {
  compliment: 'expressing love and appreciation to their bias',
  birthday: 'celebrating idol birthday',
  game: 'playing a fun game with idol',
  request: 'asking idol for a special action',
  ask: 'asking a meaningful question',
  question: 'asking a meaningful question',
  confession: 'confessing love and gratitude',
};

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      scenario,
      voiceGender,
      positiveMoments,
      completedLines,
      totalLines,
      idolName: idolNameRaw,
      lang: langRaw,
    } = body || {};

    const lang = normalizeLang(typeof langRaw === 'string' ? langRaw : 'en');

    const trimmedIdol =
      typeof idolNameRaw === 'string' ? idolNameRaw.trim() : '';

    const vgLower = String(voiceGender || '').toLowerCase();
    const displayIdolName =
      trimmedIdol.length > 0
        ? trimmedIdol
        : vgLower === 'male' || vgLower === 'm'
          ? 'JISUNG'
          : 'WONYOUNG';

    const scenarioKey = scenario && scenarioContext[scenario] ? scenario : 'compliment';
    const scenarioLine =
      scenarioContext[scenarioKey] || String(scenario || 'practice session');

    const uiLangInstructions =
      `사용자 인터페이스 언어: ${lang}\n` +
      `피드백, 코멘트, 설명은 반드시 ${lang} 언어로 출력하세요.\n\n`;

    const prompt = `${uiLangInstructions}You are an AI coach helping international K-pop fans practice for fansign video calls.

Scenario: ${scenarioLine}
Idol: ${displayIdolName}
User completed ${completedLines ?? 4}/${totalLines ?? 5} prepared lines.
Positive moments triggered: ${JSON.stringify(positiveMoments ?? [])}

Generate a review JSON in this exact format:

{
  "best_moment": {
    "you_said_korean": "Korean line user delivered well",
    "you_said_translation": "Short meaning in UI language (${lang}); not Korean unless UI is Korean",
    "you_said_romanization": "Romanization of Korean (e.g. Annyeonghaseyo)",
    "idol_replied_korean": "Idol natural Korean reaction",
    "idol_replied_translation": "Short meaning in UI language (${lang})",
    "idol_replied_romanization": "Romanization of Korean reaction",
    "moment_type": "core_message" | "first_korean" | "name_remembered"
  },
  "missed_moment": {
    "korean": "Korean line that needed practice",
    "translation": "Short meaning in UI language (${lang})",
    "romanization": "Romanization of Korean",
    "tip": "One short encouraging note in UI language (${lang}), max ~20 words, no mention of AI or technology"
  },
  "share_quote": "Most shareable moment as a single Korean phrase, under ~15 syllables",
  "share_quote_translation": "Short meaning in UI language (${lang})",
  "share_quote_romanization": "Romanization of share quote"
}

Rules:
- Use realistic, casual Korean fan-idol speech (반말+존댓말 mix)
- Idol replies should be warm, short (under 10 syllables)
- Tip text must follow UI language (${lang}); do not mention AI, apps, or technology
- If user did well (4+/5 lines), make best_moment about the core emotional message
- If user struggled, make best_moment about their first Korean attempt
- All Korean must be authentic, not literal translations
- Romanization should follow Revised Romanization (e.g. 안녕하세요 → Annyeonghaseyo)

Return ONLY the JSON, no other text.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const cleanText = text.replace(/```json|```/g, '').trim();
    const reviewData = JSON.parse(cleanText);

    return NextResponse.json({ success: true, review: reviewData });
  } catch (error) {
    console.error('Review generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        review: FALLBACK_REVIEW,
      },
      { status: 500 },
    );
  }
}
