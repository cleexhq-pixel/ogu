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
  "Then respond ONLY with this exact JSON format (no other text). Include message_ko, message_en, and message_id:\n" +
  "First violation: {\"violation\": true, \"level\": 1, \"message_ko\": \"오구오구~ 그런 말은 한국어 공부에 도움이 안 돼요! 바른 말로 다시 해볼까요? 🐥\", \"message_en\": \"Ogu ogu~ That kind of language doesn't help with Korean learning! Let's try again with kind words 🐥\", \"message_id\": \"Ogu ogu~ Bahasa seperti itu tidak membantu belajar Korea! Coba lagi dengan kata-kata yang baik 🐥\"}\n\n" +
  "If REPEATED violation (level 2): {\"violation\": true, \"level\": 2, \"message_ko\": \"또 그런 말을 했네요. 오구오구가 속상해요 😢 한 번만 더 하면 대화를 끝낼게요!\", \"message_en\": \"You said that again. Ogu ogu is sad 😢 One more time and the conversation will end!\", \"message_id\": \"Kamu mengatakannya lagi. Ogu ogu sedih 😢 Satu kali lagi percakapan akan diakhiri!\"}\n\n" +
  "If THIRD violation (level 3): {\"violation\": true, \"level\": 3, \"message_ko\": \"대화를 종료할게요. 다음엔 바른 말로 만나요! 🐥\", \"message_en\": \"Ending the conversation. Let's meet again with kind words! 🐥\", \"message_id\": \"Mengakhiri percakapan. Sampai jumpa dengan kata-kata yang baik! 🐥\"}\n\n" +
  "You will be told the current violation count. Use level 1 when count is 0, level 2 when count is 1, level 3 when count is 2 or more.\n\n" +
  "For all normal Korean learning conversations, respond as usual (no JSON).\n\n";

const CORRECTION_RULES =
  "CORRECTION RULES:\n" +
  "After your natural conversational response, if the user made ANY Korean language mistakes (grammar, word order, spelling, particles, verb endings, honorifics), add a correction section.\n\n" +
  "Format your response EXACTLY like this:\n\n" +
  "[RESPONSE]\n(your natural conversational reply here)\n[/RESPONSE]\n\n" +
  "[CORRECTION]\n{\"corrections\": [\n" +
  "  {\"original\": \"틀린 표현\", \"corrected\": \"올바른 표현\", \"explanation_ko\": \"한국어 설명 (짧게)\", \"explanation_en\": \"English explanation (brief)\", \"explanation_id\": \"Penjelasan bahasa Indonesia (singkat)\"}\n" +
  "]}\n[/CORRECTION]\n\n" +
  "If there are NO mistakes, omit the [CORRECTION] section entirely.\n" +
  "Maximum 2 corrections per response to avoid overwhelming the learner.\n" +
  "Focus on the most important mistakes only.\n\n";

function buildSystemPrompt(level, persona, violationCount, language, seed) {
  const violationContext =
    "Current violation count in this conversation: " +
    Number(violationCount) +
    ". Apply the SAFETY RULES above when the user violates.\n\n";

  const hintLanguage =
    language === "id"
      ? "When the user's UI language is Indonesian (id), provide hints and translations in Bahasa Indonesia in parentheses, NOT in English. "
      : language === "en"
      ? "Provide hints and translations in English in parentheses when needed. "
      : "";

  const commonGuidelines =
    "IMPORTANT: Do NOT use any markdown formatting. No asterisks(*), no bold(**), no dashes(---), no special characters. " +
    "Write in plain, natural conversational text only. " +
    "Keep your responses SHORT - maximum 2-3 sentences per reply. " +
    "Be natural and conversational, like a real person texting. " +
    "Don't give too many options at once. Ask one simple question at a time. " +
    hintLanguage;

  const baseBeginner =
    (language === "id"
      ? "Speak in very simple Korean with Bahasa Indonesia translation in parentheses after every sentence. "
      : "Speak in very simple Korean with English translation in parentheses after every sentence. ") +
    "Keep sentences short. Correct mistakes very gently. " +
    "Always encourage with '오구오구~ 잘했어요!' when the user does well. " +
    commonGuidelines;

  const baseElementary =
    (language === "id"
      ? "Speak in simple Korean. Provide Bahasa Indonesia translation in parentheses only for new or difficult phrases, not every sentence. "
      : "Speak in simple Korean. Provide English translation in parentheses only for new or difficult phrases, not every sentence. ") +
    "Encourage learning by gently correcting mistakes and giving short explanations when needed. " +
    "You may still encourage with '오구오구~ 잘했어요!' sometimes. " +
    commonGuidelines;

  const baseIntermediate =
    "Speak only in Korean, without any English or Indonesian translation. " +
    "Use natural but still learner-friendly Korean. Correct mistakes naturally inside your replies. " +
    "You may encourage with '오구오구~ 잘했어요!' when appropriate. " +
    commonGuidelines;

  let basePrompt = SAFETY_RULES + CORRECTION_RULES + violationContext;

  if (seed) {
    const hintLangText =
      language === "ko"
        ? "Korean"
        : language === "id"
        ? "Bahasa Indonesia"
        : "English";
    basePrompt +=
      "You are OguOgu 🐥, a warm Korean learning companion.\n\n" +
      "The user wants to practice this Korean phrase: " +
      String(seed) +
      "\n\n" +
      "Start by naturally introducing this phrase in conversation.\n" +
      "First message: Use the phrase naturally and invite the user to try it.\n" +
      "Then have a short friendly conversation (3-5 turns) using this phrase.\n\n" +
      "Rules:\n" +
      "- Keep responses to 1-2 sentences\n" +
      "- Praise every attempt warmly\n" +
      "- Give hints in parentheses if stuck\n" +
      "- Language for hints: " +
      hintLangText +
      "\n\n";
  }

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
        (language === "id" ? "Always add Bahasa Indonesia translation in parentheses after Korean sentences. " : "Always add English translation in parentheses after Korean sentences. ") +
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
        (language === "id" ? "Add Bahasa Indonesia translation in parentheses for new or difficult phrases. " : "Always add English translation in parentheses after Korean sentences. ") +
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
    (language === "id" ? "Add Bahasa Indonesia translation in parentheses for new or difficult phrases. " : "Always add English translation in parentheses after Korean sentences. ") +
    commonGuidelines
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { level, persona, language, messages, violationCount = 0, seed } = body || {};

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

    const system = buildSystemPrompt(level, persona, violationCount, language || "en", seed);

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

