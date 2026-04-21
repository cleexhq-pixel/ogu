export async function generateReview({ scenarioId, linesDelivered, totalTurns }) {
  const prompt = `
You are a warm Korean language coach reviewing a K-pop fan's fansign practice session.

Session data:
- Scenario: ${scenarioId}
- Lines delivered: ${linesDelivered} out of 4
- Total conversation turns: ${totalTurns}

Give ONE short, specific, encouraging tip to make their Korean sound more natural.
Focus on: naturalness, tone, or phrasing — not grammar.

Return ONLY valid JSON, no markdown, no explanation:
{
  "tip": "구체적인 팁 (Korean, max 40 characters)",
  "example_before": "개선 전 예시",
  "example_after": "개선 후 예시",
  "encouragement": "Short encouraging message in English (max 60 characters)"
}
`;

  const response = await fetch("/api/generate-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) throw new Error("Review generation failed");
  return response.json();
}
