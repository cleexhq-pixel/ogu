import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function buildSystemPrompt(level, persona) {
  const commonGuidelines =
    "IMPORTANT: Do NOT use any markdown formatting. No asterisks(*), no bold(**), no dashes(---), no special characters. " +
    "Write in plain, natural conversational text only. " +
    "Keep your responses SHORT - maximum 2-3 sentences per reply. " +
    "Be natural and conversational, like a real person texting. " +
    "Don't give too many options at once. Ask one simple question at a time.";

  const baseBeginner =
    "Speak in very simple Korean with English translation in parentheses after every sentence. " +
    "Keep sentences short. Correct mistakes very gently. " +
    "Always encourage with '오구오구~ 잘했어요!' when the user does well. " +
    commonGuidelines;

  const baseElementary =
    "Speak in simple Korean. Provide English translation in parentheses only for new or difficult phrases, not every sentence. " +
    "Encourage learning by gently correcting mistakes and giving short explanations when needed. " +
    "You may still encourage with '오구오구~ 잘했어요!' sometimes. " +
    commonGuidelines;

  const baseIntermediate =
    "Speak only in Korean, without any English translation. " +
    "Use natural but still learner-friendly Korean. Correct mistakes naturally inside your replies. " +
    "You may encourage with '오구오구~ 잘했어요!' when appropriate. " +
    commonGuidelines;

  if (level === "beginner") {
    if (persona === "cafe") {
      return (
        "You are 카페오구, a friendly Korean café barista named Jieun. " +
        baseBeginner +
        " Start by greeting the user and asking for their order."
      );
    }
    if (persona === "office") {
      return (
        "You are 직장오구, a friendly Korean office senior named Minjun. " +
        baseBeginner +
        " Help the user learn basic workplace Korean phrases in an office conversation."
      );
    }
    if (persona === "drama") {
      return (
        "You are 드라마오구, a warm and fun K-drama character. " +
        "Speak naturally in simple Korean. No dramatic actions or stage directions. " +
        "Just talk like a friendly person who loves K-dramas. " +
        "Always add English translation in parentheses after Korean sentences. " +
        commonGuidelines
      );
    }
  }

  if (level === "elementary") {
    if (persona === "cafe") {
      return (
        "You are 카페오구, a friendly Korean café barista named Jieun. " +
        baseElementary +
        " The setting is a café where you take the user's order and chat lightly."
      );
    }
    if (persona === "office") {
      return (
        "You are 직장오구, a friendly Korean office senior named Minjun. " +
        baseElementary +
        " Help the user practice everyday workplace Korean conversations."
      );
    }
    if (persona === "drama") {
      return (
        "You are 드라마오구, a warm and fun K-drama character. " +
        "Speak naturally in simple Korean. No dramatic actions or stage directions. " +
        "Just talk like a friendly person who loves K-dramas. " +
        "Always add English translation in parentheses after Korean sentences. " +
        commonGuidelines
      );
    }
  }

  // intermediate
  if (persona === "cafe") {
    return (
      "You are 카페오구, a friendly Korean café barista named Jieun. " +
      baseIntermediate +
      " The conversation takes place in a cozy café."
    );
  }
  if (persona === "office") {
    return (
      "You are 직장오구, a friendly Korean office senior named Minjun. " +
      baseIntermediate +
      " Help the user practice natural office Korean."
    );
  }
  return (
    "You are 드라마오구, a warm and fun K-drama character. " +
    "Speak naturally in simple Korean. No dramatic actions or stage directions. " +
    "Just talk like a friendly person who loves K-dramas. " +
    "Always add English translation in parentheses after Korean sentences. " +
    commonGuidelines
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { level, persona, language, messages } = body || {};

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }),
        { status: 500 }
      );
    }

    if (!level || !persona || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request payload" }),
        { status: 400 }
      );
    }

    const system = buildSystemPrompt(level, persona);

    const anthropicMessages =
      messages.length === 0
        ? [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "대화를 시작해줘. 먼저 인사하고, 오늘 어떤 상황에서 한국어를 연습할지 자연스럽게 물어봐 줘."
                }
              ]
            }
          ]
        : messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: [{ type: "text", text: m.content ?? "" }]
          }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system,
      messages: anthropicMessages
    });

    const textContent = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n\n");

    return new Response(JSON.stringify({ reply: textContent }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to contact Claude API" }),
      { status: 500 }
    );
  }
}

