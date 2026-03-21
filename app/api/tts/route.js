import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    console.log("TTS API Key exists:", !!process.env.GOOGLE_TTS_API_KEY);
    console.log("TTS API Key length:", process.env.GOOGLE_TTS_API_KEY?.length);

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

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;

    const languageCode =
      typeof lang === "string" && lang.trim().startsWith("ko") ? "ko-KR" : "ko-KR";

    const ttsPayload = {
      input: { text: text.trim() },
      voice: {
        languageCode,
        name: "ko-KR-Neural2-C",
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
      console.error("Google TTS Error:", errText);
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    const data = await res.json();
    if (!data?.audioContent || typeof data.audioContent !== "string") {
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }

    return NextResponse.json({ audioContent: data.audioContent });
  } catch {
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
