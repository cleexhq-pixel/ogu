import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { normalizeLang } from '@/app/lib/i18n';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const scenarioContext = {
  compliment: '아이돌의 노래와 무대를 칭찬하고 싶은 팬',
  birthday: '아이돌 생일을 축하하고 싶은 팬',
  encouragement: '아이돌에게 진심 어린 응원과 감사의 마음을 전하고 싶은 팬',
  game: '아이돌과 가벼운 게임을 하고 싶은 팬',
  request: '아이돌에게 볼하트나 이름 불러주기를 요청하고 싶은 팬',
  question: '아이돌에게 궁금한 것을 물어보고 싶은 팬',
  ask: '아이돌에게 궁금한 것을 물어보고 싶은 팬',
  confession: '아이돌에 대한 마음을 전하고 싶은 팬',
};

/** @returns {{ korean?: string; romanization?: string; translation?: string } | undefined} */
function pickLine(parsed, labels) {
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
  for (const want of labels) {
    const w = String(want || '').toUpperCase();
    const hit = lines.find(
      (L) =>
        typeof L?.label === 'string' &&
        L.label.trim().toUpperCase() === w,
    );
    if (hit) return hit;
  }
  const byIndex = typeof labels[0] === 'number' ? lines[labels[0]] : undefined;
  return byIndex;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const scenarioIdRaw = body.scenarioId;
    const scenarioId =
      scenarioIdRaw == null ? '' : String(scenarioIdRaw).trim().toLowerCase();

    const lang = normalizeLang(
      typeof body.lang === 'string' ? body.lang : 'en',
    );

    const uiLangBlock =
      `사용자 인터페이스 언어: ${lang}\n` +
      `설명, 힌트, 번역 텍스트는 반드시 ${lang} 언어로 출력하세요.\n` +
      `단, 한국어 대사(Korean lines) 자체는 항상 한국어로 유지하세요.\n`;

    if (!scenarioId) {
      return NextResponse.json(
        { error: 'scenarioId is required' },
        { status: 400 },
      );
    }

    const context =
      scenarioContext[scenarioId] || scenarioContext.question || '아이돌과 대화하고 싶은 팬';

    const prompt =
      `${uiLangBlock}\n` +
      `당신은 K-pop 영통팬싸 90초 연습을 도와주는 코치입니다.\n` +
      `아래 상황에 맞는 한국어 대화 스크립트 4문장을 생성해주세요.\n\n` +
      `상황: ${context}\n\n` +
      `규칙:\n` +
      `- 반드시 한국어 초급 학습자도 발음할 수 있는 짧고 단순한 문장\n` +
      `- 한 문장은 최대 8음절. 절대 초과 금지\n` +
      `- 단어 수 5개 이하\n` +
      `- 어렵거나 생소한 단어 사용 금지\n` +
      `- 주어 생략 가능 (구어체이므로)\n` +
      `- 실제 팬이 쓰는 자연스러운 구어체\n` +
      `- 외모, 사생활, 연애 관련 질문 금지\n` +
      `- LINE 1: 인사 (안녕하세요로 시작, 5음절 이하)\n` +
      `- LINE 2: 핵심 메시지 (가장 하고 싶은 말 하나만, 짧게)\n` +
      `- LINE 3: 대화 이어가기 (LINE 2와 자연스럽게 연결, 짧게)\n` +
      `- LINE 4: 마무리 (감사 또는 재회 약속, 짧게)\n` +
      `- romanization 필드는 개정 로마자 표기\n` +
      `- translation 필드만 UI 언어(${lang})로 작성, 한국어 대사(korean 필드)는 한국어만\n\n` +
      `좋은 예시 (이 수준으로):\n` +
      `- "안녕하세요!" (5음절)\n` +
      `- "노래 진짜 좋아요!" (7음절)\n` +
      `- "항상 응원해요!" (6음절)\n` +
      `- "또 봬요!" (4음절)\n\n` +
      `나쁜 예시 (이런 문장 생성 금지):\n` +
      `- "오빠 무대가 너무 멋있어서 눈물 날 뻔했어요!" (너무 길고 복잡)\n` +
      `- "저는 오빠 팬이 된 지 3년이 됐어요!" (길고 숫자 포함)\n\n` +
      `JSON만 응답하세요:\n` +
      '{"lines":[{"label":"GREETING","korean":"","romanization":"","translation":""},{"label":"MAIN","korean":"","romanization":"","translation":""},{"label":"FOLLOW","korean":"","romanization":"","translation":""},{"label":"CLOSING","korean":"","romanization":"","translation":""}]}';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text;

    let parsed;
    try {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 });
    }

    const main = pickLine(parsed, ['MAIN', 'LINE 2']);
    const follow = pickLine(parsed, ['FOLLOW', 'LINE 3']);

    return NextResponse.json({
      lines: parsed.lines,
      line2: main ?? pickLine(parsed, [1]),
      line3: follow ?? pickLine(parsed, [2]),
    });
  } catch (error) {
    console.error('generate-script error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
