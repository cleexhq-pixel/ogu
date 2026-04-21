export async function generateScript(scenario) {
  const prompt = `
You are a Korean language coach for K-pop fans preparing for a video call fansign (영통팬싸).

Generate exactly 2 Korean sentences for a fan to say during their fansign.
The fan has chosen the scenario: "${scenario.titleEn}" (${scenario.titleKo})

LINE 2 goal: ${scenario.line2Prompt}
LINE 3 goal: ${scenario.line3Prompt}

Rules (follow strictly):
- Every sentence must include a clear subject
- Maximum 10 syllables per sentence
- Never use demonstrative pronouns: 그거, 이거, 아까
- One meaning per sentence only
- Use natural spoken Korean (구어체), NOT formal translation-style Korean
  BAD: "당신은 매우 잘생겼습니다"
  GOOD: "오빠 진짜 너무 잘생겼어요~"
- Avoid: direct questions about appearance, body, plastic surgery, tattoos, relationships, or privacy
- Focus on: music, performances, emotions, daily life

Return ONLY valid JSON, no markdown, no explanation:
{
  "line2": {
    "korean": "Korean sentence",
    "romanization": "romanized pronunciation",
    "translation": "English translation"
  },
  "line3": {
    "korean": "Korean sentence",
    "romanization": "romanized pronunciation",
    "translation": "English translation"
  }
}
`;

  const response = await fetch("/api/generate-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) throw new Error("Script generation failed");
  return response.json();
}
