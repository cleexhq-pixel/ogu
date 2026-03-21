import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function cleanJSON(text) {
  let cleaned = String(text)
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/gi, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }),
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided" }),
        { status: 400 }
      );
    }

    const conversationText = messages
      .map((m) => {
        const speaker = m.role === "user" ? "USER" : "OGU";
        return `${speaker}: ${m.content ?? ""}`;
      })
      .join("\n");

    const userPrompt =
      "Analyze this Korean conversation and extract exactly 3 key Korean expressions the user learned. " +
      "Return JSON only:\n" +
      "{ \"expressions\": [{ \"korean\": \"\", \"english\": \"\", \"example\": \"\" }] }\n\n" +
      "Conversation:\n" +
      conversationText;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system:
        "You are a helpful Korean teacher. You only output raw JSON, no markdown or explanations.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userPrompt }]
        }
      ]
    });

    let raw = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    raw = raw.trim();

    let parsed;
    try {
      const cleaned = cleanJSON(raw);
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse report JSON:", e, raw);
      return NextResponse.json({
        expressions: [],
        corrections: [],
        encouragement: "잘 하셨어요! 🐥"
      });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Report API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate report" }),
      { status: 500 }
    );
  }
}

