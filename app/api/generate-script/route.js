import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const scenarioContext = {
  compliment: '아이돌의 노래와 무대를 칭찬하고 싶은 팬',
  birthday: '아이돌 생일을 축하하고 싶은 팬',
  game: '아이돌과 가벼운 게임을 하고 싶은 팬',
  request: '아이돌에게 볼하트나 이름 불러주기를 요청하고 싶은 팬',
  ask: '아이돌에게 궁금한 것을 물어보고 싶은 팬',
  confession: '아이돌에 대한 마음을 전하고 싶은 팬',
};

export async function POST(request) {
  try {
    const body = await request.json();
    const scenarioId = body.scenarioId;

    if (!scenarioId) {
      return NextResponse.json(
        { error: 'scenarioId is required' },
        { status: 400 }
      );
    }

    const context = scenarioContext[scenarioId] || '아이돌과 대화하고 싶은 팬';

    const prompt = `당신은 K-pop 영통팬싸 90초 연습을 도와주는 코치입니다.
아래 상황에 맞는 한국어 대화 스크립트 4문장을 생성해주세요.

상황: ${context}

규칙:
- 모든 문장에 주어 포함
- 한 문장은 10음절 이내
- 지시대명사 사용 금지
- 실제 팬이 쓰는 구어체 사용
- 외모, 사생활, 연애 관련 질문 금지
- LINE 1: 인사 (안녕하세요로 시작)
- LINE 2: 핵심 메시지
- LINE 3: 대화 이어가기
- LINE 4: 마무리 (다음에 또 봐요로 끝)

JSON만 응답하세요:
{"lines":[{"label":"GREETING","korean":"","romanization":"","translation":""},{"label":"MAIN","korean":"","romanization":"","translation":""},{"label":"FOLLOW","korean":"","romanization":"","translation":""},{"label":"CLOSING","korean":"","romanization":"","translation":""}]}`;

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

    return NextResponse.json(parsed);

  } catch (error) {
    console.error('generate-script error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
