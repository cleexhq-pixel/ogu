export async function generateScript(scenario) {
  const prompt = `You are preparing a K-pop fan for a 90-second video fansign call.
The fan's goal: ${scenario.id}
LINE 2 purpose: ${scenario.line2Prompt}
LINE 3 purpose: ${scenario.line3Prompt}

Generate LINE 2 and LINE 3 in Korean for scenario: ${scenario.id}

Rules:
- Each sentence must be under 10 syllables
- Use natural spoken Korean, not formal/translated Korean
- No pronouns like 그거/이거/아까
- Include subject in every sentence
- Cultural taboos: no appearance/surgery/tattoo/dating questions
- LINE 2 and LINE 3 must be DIFFERENT from each other
- Must match the scenario goal: ${scenario.id}

Return ONLY valid JSON, no markdown, no explanation:
{
  "line2": {
    "korean": "",
    "romanization": "",
    "translation": ""
  },
  "line3": {
    "korean": "",
    "romanization": "",
    "translation": ""
  }
}`;

  const res = await fetch("/api/generate-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) throw new Error("API error");
  return await res.json();
}
