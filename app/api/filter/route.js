import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT =
  "You are a content moderator for a Korean language learning community.\n" +
  "Analyze the following post and determine if it should be allowed.\n\n" +
  "BLOCK if the post contains:\n" +
  "- Sexual, adult, or explicit content\n" +
  "- Promotional content, advertisements, product links, or spam URLs\n" +
  "- Hate speech, discrimination, or offensive language\n" +
  "- Profanity or vulgar language\n" +
  "- Content completely unrelated to Korean language/culture/learning\n\n" +
  "ALLOW if the post is about:\n" +
  "- Korean language learning tips, questions, experiences\n" +
  "- Korean culture, K-drama, K-pop, Korean food discussion\n" +
  "- Encouragement or sharing learning progress\n" +
  "- General friendly conversation related to Korea/Korean\n\n" +
  "Respond ONLY in this exact JSON format (no other text):\n" +
  '{"allowed": true, "reason_ko": "", "reason_en": ""}\n' +
  "or\n" +
  '{"allowed": false, "reason_ko": "차단 이유", "reason_en": "Block reason"}';

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const { title = "", content = "" } = body || {};
    const text = `Title: ${String(title)}\n\nContent: ${String(content)}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text }]
        }
      ]
    });

    let raw = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    }

    let result;
    try {
      result = JSON.parse(raw);
    } catch (e) {
      console.error("Filter API parse error:", e, raw);
      return new Response(
        JSON.stringify({
          allowed: false,
          reason_ko: "검토 결과를 확인할 수 없습니다.",
          reason_en: "Could not process moderation result."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        allowed: Boolean(result.allowed),
        reason_ko: result.reason_ko ?? "",
        reason_en: result.reason_en ?? ""
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Filter API error:", error);
    return new Response(
      JSON.stringify({ error: "Filter request failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
