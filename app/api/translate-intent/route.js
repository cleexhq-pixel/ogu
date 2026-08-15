import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const rawText = typeof body?.text === 'string' ? body.text : '';
    const trimmed = rawText.trim().slice(0, 500);
    const lang = typeof body?.lang === 'string' && body.lang.trim() ? body.lang.trim() : 'en';

    if (!trimmed) {
      return NextResponse.json({ error: 'text_required' }, { status: 400 });
    }

    const prompt =
      `당신은 K-pop 팬사인회 영상통화에서, 팬이 아이돌에게 90초 안에 직접 하고 싶은 말을 한국어로 옮겨주는 통역가입니다.\n` +
      `아래는 팬이 자신의 언어(${lang})로 적은, 아이돌에게 실제로 하고 싶은 말입니다.\n` +
      `이걸 팬사인회 그 자리에서 소리 내어 말하는 것처럼, 자연스러운 한국어 구어체 한 문장으로 옮겨주세요.\n\n` +
      `사용자 문장: ${JSON.stringify(trimmed)}\n\n` +
      `규칙:\n` +
      `- 반드시 존댓말 -요체로 끝낼 것 (반말 금지, ~합니다체 금지)\n` +
      `- 문어체 금지: "~하였습니다", "~인 것 같습니다", "~라고 할 수 있습니다" 같은 표현 쓰지 말 것\n` +
      `- 번역투·교과서 말투 금지: "저는 ~을 좋아합니다", "당신은 ~하십니까" 같은 표현 쓰지 말 것\n` +
      `- 실제 한국 사람이 소리 내어 말하듯 자연스러운 구어체로만 쓸 것\n` +
      `- 한 호흡에 말할 수 있는 길이로: 20자를 넘으면 핵심만 남기고 줄일 것 (엄격한 글자 제한은 아님)\n` +
      `- 문장에 아이돌 실명이나 그룹명이 있으면 전부 빼거나 "오빠"/"언니" 같은 중립적인 호칭으로 바꿀 것\n` +
      `- romanized 필드는 개정 로마자 표기법을 따를 것\n\n` +
      `JSON만 응답하세요: {"korean":"","romanized":""}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0]?.text?.trim() ?? '';
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'translate_failed' }, { status: 500 });
    }

    const korean = typeof parsed?.korean === 'string' ? parsed.korean.trim() : '';
    const romanized = typeof parsed?.romanized === 'string' ? parsed.romanized.trim() : '';

    if (!korean) {
      return NextResponse.json({ error: 'translate_failed' }, { status: 500 });
    }

    return NextResponse.json({ korean, romanized });
  } catch (error) {
    console.error(
      'translate-intent error:',
      error instanceof Error ? error.message : 'unknown',
    );
    return NextResponse.json({ error: 'translate_failed' }, { status: 500 });
  }
}
