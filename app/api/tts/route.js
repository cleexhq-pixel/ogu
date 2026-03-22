import { NextResponse } from "next/server";

console.log("TTS API Key exists:", !!process.env.GOOGLE_TTS_API_KEY);
console.log("TTS API Key value:", process.env.GOOGLE_TTS_API_KEY?.substring(0, 10));

/**
 * Google TTS용: 이모지·이모티콘 설명·괄호 안 이모티콘 표기 제거
 */
function sanitizeTextForTts(raw) {
  let s = String(raw);

  // 유니코드 이모지(그림문자 계열)
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, "");
  } catch {
    s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu, "");
  }

  s = s.replace(/[\uFE0F\u200D]/g, "");

  // 괄호 안 이모티콘/이모지 설명 (예: (🐥), (병아리), (이모지) — 이모지는 위에서 제거된 뒤 빈 괄호·텍스트만 남을 수 있음)
  const parenEmoticonPattern =
    /\(\s*(?:병아리|이모지|이모티콘|emoji|emoticon|chick|smile|smiley|하트|heart|thumbs|OK|ok)\s*\)/gi;
  let prev;
  do {
    prev = s;
    s = s.replace(parenEmoticonPattern, "");
  } while (s !== prev);

  // 남은 빈 괄호 / 공백만 있는 괄호
  s = s.replace(/\(\s*\)/g, "");

  // 이모티콘 설명으로 쓰이는 짧은 토큰 (앞뒤 구두점·공백 기준, 본문 문장 중 병아리 주제 학습 문장은 최대한 건드리지 않음)
  s = s.replace(
    /(^|[\s,.!?…，。、])(병아리|이모지|이모티콘)(?=[\s,.!?…，。、]|$)/g,
    "$1"
  );

  s = s.replace(/\b(?:emoji|emoticon|chick)\b/gi, "");

  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export async function POST(request) {
  try {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "TTS failed" }, { status: 400 });
    }

    const { text, lang } = body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "TTS failed" }, { status: 400 });
    }

    const sanitized = sanitizeTextForTts(text);
    if (!sanitized) {
      return NextResponse.json({ error: "TTS failed" }, { status: 400 });
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;

    const languageCode =
      typeof lang === "string" && lang.trim().startsWith("ko") ? "ko-KR" : "ko-KR";

    const ttsPayload = {
      input: { text: sanitized },
      voice: {
        languageCode,
        name: "ko-KR-Neural2-A",
        ssmlGender: "FEMALE"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.9,
        pitch: 0
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ttsPayload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Google TTS HTTP error — status:", res.status, res.statusText);
      console.error("Google TTS HTTP error — response body (text):", errText);
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    const data = await res.json();
    if (!data?.audioContent || typeof data.audioContent !== "string") {
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }

    return NextResponse.json({ audioContent: data.audioContent });
  } catch (error) {
    console.error("Google TTS full error:", JSON.stringify(error));
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
