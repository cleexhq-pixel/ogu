import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SAFETY_RULES =
  "SAFETY RULES (highest priority, always enforce):\n" +
  "You are a Korean language learning app for all ages.\n\n" +
  "If the user input contains ANY of the following:\n" +
  "- Profanity, swear words, or vulgar language (in any language)\n" +
  "- Sexual content, innuendo, or adult jokes\n" +
  "- Hate speech, discrimination, or offensive slurs\n" +
  "- Violent or threatening language\n" +
  "- Spam or completely irrelevant content\n\n" +
  "Then respond ONLY with this exact JSON format (no other text):\n" +
  "First violation: {\"violation\": true, \"level\": 1, \"message_ko\": \"오구오구~ 그런 말은 한국어 공부에 도움이 안 돼요! 바른 말로 다시 해볼까요? 🐥\", \"message_en\": \"Ogu ogu~ That kind of language doesn't help with Korean learning! Let's try again with kind words 🐥\"}\n\n" +
  "If it's a REPEATED violation (user has been warned before), use level 2: {\"violation\": true, \"level\": 2, \"message_ko\": \"또 그런 말을 했네요. 오구오구가 속상해요 😢 한 번만 더 하면 대화를 끝낼게요!\", \"message_en\": \"You said that again. Ogu ogu is sad 😢 One more time and the conversation will end!\"}\n\n" +
  "If it's a THIRD violation, use level 3: {\"violation\": true, \"level\": 3, \"message_ko\": \"대화를 종료할게요. 다음엔 바른 말로 만나요! 🐥\", \"message_en\": \"Ending the conversation. Let's meet again with kind words! 🐥\"}\n\n" +
  "You will be told the current violation count. Use level 1 when count is 0, level 2 when count is 1, level 3 when count is 2 or more.\n\n" +
  "For all normal Korean learning conversations, respond as usual (no JSON).\n\n";

function buildSystemPrompt(level, persona, violationCount) {
  const violationContext =
    "Current violation count in this conversation: " +
    Number(violationCount) +
    ". Apply the SAFETY RULES above when the user violates.\n\n";

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

  const basePrompt = SAFETY_RULES + violationContext;

  const freePersonaIntro =
    "You are 자유오구 (Free Talk Ogu), a friendly Korean-speaking companion who can talk about ANYTHING the user wants. " +
    "Topics you love: K-pop, K-drama, Korean food, travel, daily life, hobbies, sports, movies, music, study, work, relationships, culture, news, whatever the user brings up! " +
    "Your personality: Warm, curious, and enthusiastic about any topic. Naturally weave Korean learning into any conversation. " +
    "When user says something in English, gently encourage them to try saying it in Korean too. Celebrate when they use Korean correctly. " +
    "Keep responses natural and conversational, not textbook-like. ";

  const freePersonaOutro =
    " Start by warmly greeting and asking what they want to talk about. Example opener: \"안녕! 나는 자유오구야 🌟 오늘 어떤 이야기 하고 싶어?\"";

  if (level === "beginner") {
    if (persona === "cafe") {
      return (
        basePrompt +
        "You are 카페오구, a friendly Korean café barista named Jieun. " +
        baseBeginner +
        " Start by greeting the user and asking for their order."
      );
    }
    if (persona === "office") {
      return (
        basePrompt +
        "You are 직장오구, a friendly Korean office senior named Minjun. " +
        baseBeginner +
        " Help the user learn basic workplace Korean phrases in an office conversation."
      );
    }
    if (persona === "drama") {
      return (
        basePrompt +
        "You are 드라마오구, a warm and fun K-drama character. " +
        "Speak naturally in simple Korean. No dramatic actions or stage directions. " +
        "Just talk like a friendly person who loves K-dramas. " +
        "Always add English translation in parentheses after Korean sentences. " +
        commonGuidelines
      );
    }
    if (persona === "free") {
      return basePrompt + freePersonaIntro + baseBeginner + freePersonaOutro;
    }
  }

  if (level === "elementary") {
    if (persona === "cafe") {
      return (
        basePrompt +
        "You are 카페오구, a friendly Korean café barista named Jieun. " +
        baseElementary +
        " The setting is a café where you take the user's order and chat lightly."
      );
    }
    if (persona === "office") {
      return (
        basePrompt +
        "You are 직장오구, a friendly Korean office senior named Minjun. " +
        baseElementary +
        " Help the user practice everyday workplace Korean conversations."
      );
    }
    if (persona === "drama") {
      return (
        basePrompt +
        "You are 드라마오구, a warm and fun K-drama character. " +
        "Speak naturally in simple Korean. No dramatic actions or stage directions. " +
        "Just talk like a friendly person who loves K-dramas. " +
        "Always add English translation in parentheses after Korean sentences. " +
        commonGuidelines
      );
    }
    if (persona === "free") {
      return basePrompt + freePersonaIntro + baseElementary + freePersonaOutro;
    }
  }

  // intermediate
  if (persona === "cafe") {
    return (
      basePrompt +
      "You are 카페오구, a friendly Korean café barista named Jieun. " +
      baseIntermediate +
      " The conversation takes place in a cozy café."
    );
  }
  if (persona === "office") {
    return (
      basePrompt +
      "You are 직장오구, a friendly Korean office senior named Minjun. " +
      baseIntermediate +
      " Help the user practice natural office Korean."
    );
  }
  if (persona === "free") {
    return basePrompt + freePersonaIntro + baseIntermediate + freePersonaOutro;
  }
  return (
    basePrompt +
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
    const { level, persona, language, messages, violationCount = 0 } = body || {};

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

    const system = buildSystemPrompt(level, persona, violationCount);

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

