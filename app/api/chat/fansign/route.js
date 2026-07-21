import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import scenarios from '@/src/data/scenarios';
import idolScripts, {
  getRandomLine,
  getLineByScenario,
  getNervousResponse,
  getIdolQuestion,
} from '@/src/data/idol-scripts';

/**
 * Fansign rehearsal: Claude classifies ONLY. Lines always from idol-scripts.js.
 *
 * Existing /api/chat is used by app/chat — use this route instead.
 */

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const INTENT_LABELS = [
  'korean_attempt',
  'compliment',
  'request',
  'nervous',
  'game',
  'name_given',
  'general',
];

const EMOTIONS = ['happy', 'surprised', 'touched', 'playful', 'gentle'];

/** User history keyword → idol question topic (avoid obvious repeats) */
const TOPIC_KEYWORDS = {
  country: ['나라', 'country', '에서 왔', '국적', '미국', '일본', 'from '],
  fan_since: ['팬', '좋아했', '년 됐', 'years', 'since', '부터', '덕질'],
  korean_learning: ['한국어', '배웠', '공부', 'korean', 'learned', 'studied', '서툴'],
  song: ['노래', 'song', '곡', 'title track', 'favorite song'],
  concert: ['콘서트', '공연', 'concert', '와본', '가봤', 'fanmeet', '팬미'],
  album: ['앨범', 'album', '컴백', 'comeback', '신곡', 'new album'],
  wish: ['소원', 'wish', '사진', 'photo', '하고 싶', 'finger heart', '볼하트'],
  comeback: ['다음', '또 올', 'again', 'come back', '재방문', '다시 올'],
};

function extractUsedTopics(conversationHistory) {
  const userText = (conversationHistory || [])
    .filter((m) => m?.role === 'user')
    .map((m) => String(m.text || ''))
    .join(' ');
  const normalized = userText.toLowerCase();
  const used = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      used.push(topic);
    }
  }
  return used;
}

function replaceNamePlaceholder(text, idolNameRaw) {
  const nm =
    typeof idolNameRaw === 'string' && idolNameRaw.trim()
      ? idolNameRaw.trim()
      : '팬';
  return String(text ?? '').replaceAll('[이름]', nm);
}

async function classifyIntent({
  userText,
  scenario,
  uiPhase,
  conversationHistory,
  idolName,
  lang,
}) {
  const trimmed = typeof userText === 'string' ? userText.trim() : '';
  if (!trimmed) {
    return { intent: 'nervous', emotion: 'gentle' };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { intent: 'general', emotion: 'happy' };
  }

  const prompt =
    'You classify a K-pop fansign practice user utterance.\n' +
    'Respond with ONLY compact JSON {"intent":"<one>","emotion":"<one>"} — no markdown.\n' +
    `intent MUST be exactly one of: ${INTENT_LABELS.join(', ')}\n` +
    `emotion MUST be exactly one of: ${EMOTIONS.join(', ')}\n\n` +
    'Rules:\n' +
    '- korean_attempt: user used Korean / Hangul to speak or mix.\n' +
    '- compliment: praise / thanks toward the idol or their work.\n' +
    '- request: asks for gesture, sang, nickname, fav moment etc.\n' +
    '- nervous: ultra-short fillers, apologies, freezes, unreadable gibberish, embarrassment.\n' +
    '- game: proposes quiz / game.\n' +
    '- name_given: introduces their OWN name (“I\'m Maria”, 이름은 …예요).\n' +
    '- general: neutral small talk.\n\n' +
    `scenario id: ${String(scenario || 'compliment')}\n` +
    `timed phase label: ${String(uiPhase)}\n` +
    `idol badge name: ${String(idolName || 'IDOL')}\n` +
    `UI lang hint: ${String(lang || 'en')}\n` +
    `history (recent): ${JSON.stringify((conversationHistory || []).slice(-10))}\n` +
    `utterance: ${JSON.stringify(trimmed.slice(0, 600))}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 160,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0]?.text?.trim() ?? '{}';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    const o = JSON.parse(cleaned);
    const intent = INTENT_LABELS.includes(String(o.intent).toLowerCase())
      ? String(o.intent).toLowerCase()
      : 'general';
    const emotion = EMOTIONS.includes(String(o.emotion).toLowerCase())
      ? String(o.emotion).toLowerCase()
      : 'happy';
    return { intent, emotion };
  } catch {
    return { intent: 'general', emotion: 'gentle' };
  }
}

function pickPhaseB(intent, scenarioObj) {
  switch (intent) {
    case 'korean_attempt':
      return getRandomLine('reaction_to_korean');
    case 'compliment':
      return getRandomLine('reaction_compliment');
    case 'request':
      return getRandomLine('reaction_request');
    case 'nervous':
      return getNervousResponse();
    case 'game':
      return getRandomLine('reaction_game');
    case 'name_given':
      return getRandomLine('reaction_name');
    case 'general':
    default: {
      const byCat = getLineByScenario(scenarioObj, 'B');
      if (byCat?.text) return byCat;
      const pool =
        Math.random() < 0.5 ? 'reaction_compliment' : 'reaction_to_korean';
      return getRandomLine(pool);
    }
  }
}

const STT_FAILURE_MARKERS = new Set(['(인식 실패)', '(…)', '(...)']);

function isShortUtterance(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  return t.length <= 10;
}

function isSttFailureUtterance(text) {
  return STT_FAILURE_MARKERS.has(String(text || '').trim());
}

function countRecentSttFailuresInHistory(history) {
  const users = (history || []).filter((m) => m?.role === 'user');
  let streak = 0;
  for (let i = users.length - 1; i >= 0; i--) {
    if (isSttFailureUtterance(users[i].text)) streak++;
    else break;
  }
  return streak;
}

/** Phase B line pick: intent pool + small_talk / heart_talk overlays */
function pickPhaseBLine(intent, scenarioObj, ctx) {
  if (intent === 'name_given') {
    return getRandomLine('reaction_name');
  }

  const { userText, history, timeRemaining, recentSttFailures } = ctx;
  const remaining =
    typeof timeRemaining === 'number' ? timeRemaining : 90;

  if (remaining <= 40 && Math.random() < 0.12) {
    const ht = getRandomLine('heart_talk');
    if (ht?.text) return ht;
  }

  const failureStreak = Math.max(
    typeof recentSttFailures === 'number' ? recentSttFailures : 0,
    countRecentSttFailuresInHistory(history),
  );
  const trimmed = String(userText || '').trim();
  const wantsSmallTalk =
    failureStreak >= 2 ||
    isSttFailureUtterance(trimmed) ||
    (isShortUtterance(trimmed) && trimmed.length > 0);

  if (wantsSmallTalk) {
    const st = getRandomLine('small_talk');
    if (st?.text) return st;
  }

  return pickPhaseB(intent, scenarioObj);
}

function buildPayload(body, intent, emotion) {
  const phase = typeof body.phase === 'string' ? body.phase : 'PHASE_B';
  const history = Array.isArray(body.conversationHistory)
    ? body.conversationHistory
    : [];
  const idolName = typeof body.idolName === 'string' ? body.idolName : 'IDOL';
  const scenarioId =
    typeof body.scenario === 'string' ? body.scenario : 'compliment';
  const scenarioObj =
    scenarios.find((s) => s.id === scenarioId) || scenarios[0];

  let idolText = '';
  let idolQuestion = null;
  let shouldAskIdolQuestion = false;

  if (phase === 'PHASE_A') {
    const line =
      intent === 'name_given'
        ? getRandomLine('reaction_name')
        : getRandomLine('first_question');
    idolText = line?.text || '';
    return {
      idolText: replaceNamePlaceholder(idolText, idolName),
      shouldAskIdolQuestion: false,
      idolQuestion: null,
      emotion,
      scriptId: line?.id ?? null,
    };
  }

  if (phase === 'PHASE_B') {
    shouldAskIdolQuestion =
      history.length === 3 || history.length === 6;
    if (shouldAskIdolQuestion) {
      const usedTopics = extractUsedTopics(history);
      const q = getIdolQuestion(usedTopics);
      idolQuestion = q?.text ?? null;
    }
    let line = pickPhaseBLine(intent, scenarioObj, {
      userText: body.userText,
      history,
      timeRemaining: body.timeRemaining,
      recentSttFailures: body.recentSttFailures,
    });
    if (!line?.text) {
      line = getRandomLine('reaction_compliment');
    }
    idolText = line?.text || '';
    return {
      idolText: replaceNamePlaceholder(idolText, idolName),
      shouldAskIdolQuestion,
      idolQuestion: idolQuestion
        ? replaceNamePlaceholder(idolQuestion, idolName)
        : null,
      emotion,
      scriptId: line?.id ?? null,
    };
  }

  if (phase === 'PHASE_C') {
    const tp = getRandomLine('time_pressure');
    const rq = getRandomLine('reaction_request');
    idolText = `${tp?.text || ''} ${rq?.text || ''}`.trim();
    return {
      idolText: replaceNamePlaceholder(idolText, idolName),
      shouldAskIdolQuestion: false,
      idolQuestion: null,
      emotion,
      scriptId: null,
    };
  }

  if (phase === 'PHASE_D') {
    const line = getRandomLine('closing');
    idolText = line?.text || '';
    return {
      idolText: replaceNamePlaceholder(idolText, idolName),
      shouldAskIdolQuestion: false,
      idolQuestion: null,
      emotion,
      scriptId: line?.id ?? null,
    };
  }

  const fb =
    getRandomLine('closing') || getRandomLine('reaction_compliment');
  return {
    idolText: replaceNamePlaceholder(fb?.text ?? '', idolName),
    shouldAskIdolQuestion: false,
    idolQuestion: null,
    emotion,
    scriptId: fb?.id ?? null,
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const idolName =
      typeof body.idolName === 'string' ? body.idolName : 'IDOL';

    let userText =
      typeof body.userText === 'string' ? body.userText.trim() : '';
    const phase = typeof body.phase === 'string' ? body.phase : 'PHASE_B';
    const conversationHistory = Array.isArray(body.conversationHistory)
      ? body.conversationHistory
      : [];
    const lang = typeof body.lang === 'string' ? body.lang : 'en';
    const scenario =
      typeof body.scenario === 'string' ? body.scenario : 'compliment';

    if (!userText) {
      const n = getNervousResponse();
      return NextResponse.json({
        idolText: replaceNamePlaceholder(n?.text ?? '', idolName),
        shouldAskIdolQuestion: false,
        idolQuestion: null,
        emotion: 'gentle',
        scriptId: n?.id ?? null,
      });
    }

    const { intent, emotion } = await classifyIntent({
      userText,
      scenario,
      uiPhase: phase,
      conversationHistory,
      idolName,
      lang,
    });

    const out = buildPayload(
      {
        phase,
        conversationHistory,
        idolName,
        scenario,
        userText,
        timeRemaining: body.timeRemaining,
        recentSttFailures: body.recentSttFailures,
      },
      intent,
      emotion,
    );
    return NextResponse.json(out);
  } catch (e) {
    console.error('[api/chat/fansign]', e);
    const n = getNervousResponse();
    return NextResponse.json({
      idolText: replaceNamePlaceholder(
        n?.text ?? '괜찮아요~ 천천히 해요.',
        'IDOL',
      ),
      shouldAskIdolQuestion: false,
      idolQuestion: null,
      emotion: 'gentle',
      scriptId: n?.id ?? null,
    });
  }
}
